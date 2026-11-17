import {
  FunctionNode,
  FunctionTool,
  InMemoryRunner,
  Workflow,
  createRunConfig,
  type Context,
  type LlmAgent,
  type LlmRequest,
  type LlmResponse,
} from "@google/adk";
import { z } from "zod";
import { withRunId, type TelemetrySink } from "./telemetry.ts";
import { attestScript, digestText, verifyScriptAttestation, type GateConfig, type GateDecision } from "../verification/gate.ts";
import { STAGES, STAGE_RETRY_POLICY, type ApprovalRecord, type Job, type JobStore, type Stage, type StageRecord, type StageStatus } from "./jobs.ts";
import type { ProducedAsset, Providers } from "./providers.ts";
import {
  MAX_LLM_CALLS_PER_RUN,
  ScriptPackageSchema,
  checkScriptPackage,
  extractJson,
  lastUserText,
  runVerifiedScriptPipeline,
  scriptAgentView,
  type AuditSink,
  type PipelineResult,
  type VerifiedScriptPipeline,
} from "./verified-script-pipeline.ts";

/**
 * The production workflow: everything after the Script Agent.
 *
 *   START
 *    -> production_intake            code: re-verify the production package
 *    -> creative_producer            LLM, entry guard
 *    -> record_creative_plan         code
 *    -> hidaya_veo_video_generator   LLM, entry guard
 *    -> asset_production             code: prompt check, video provider
 *    -> hidaya_video_editor          LLM, entry guard
 *    -> assembly                     code: narration provider, renderer
 *    -> quality_control_agent        LLM, entry guard
 *    -> qc_gate                      code: decides publish readiness
 *    -> hidaya_channel_manager       LLM, entry guard
 *    -> approval_gate                code: requests owner approval, never publishes
 *
 * Any code node can route to production_halt instead of continuing.
 *
 * Every LLM stage has an entry guard that re-verifies the gate attestations
 * and the script attestation before its model is called, so a downstream
 * agent cannot be made to work on unattested evidence or an altered script.
 */

export const PRODUCTION_TOOL_NAME = "run_production_workflow";
export const PRODUCTION_BLOCKED_PREFIX = "PRODUCTION_STAGE_BLOCKED";

const STATE = {
  pkg: "hidaya:prod:package",
  outputs: "hidaya:prod:outputs",
  stages: "hidaya:prod:stages",
  assets: "hidaya:prod:assets",
  halt: "hidaya:prod:halt",
  approval: "hidaya:prod:approval",
  lastAt: "hidaya:prod:last_at",
} as const;

// ── Production package ───────────────────────────────────────────────────

export const ProductionPackageSchema = z.strictObject({
  packageType: z.literal("HIDAYA_PRODUCTION_PACKAGE"),
  evidence: ScriptPackageSchema,
  scriptDraft: z.string().min(1),
  scriptAttestation: z.strictObject({
    gateVersion: z.string(),
    batchSignature: z.string(),
    scriptDigest: z.string(),
    issuedAt: z.string(),
    signature: z.string(),
  }),
});
export type ProductionPackage = z.infer<typeof ProductionPackageSchema>;

const StageInputSchema = z.strictObject({
  stage: z.string(),
  production: ProductionPackageSchema,
  priorOutputs: z.record(z.string(), z.unknown()),
});

export type ProductionCheck = { accepted: true; pkg: ProductionPackage } | { accepted: false; reason: string };

/** Evidence attestations, batch attestation and script attestation must all verify. */
export function checkProductionPackage(input: unknown, attestationKey: string | undefined): ProductionCheck {
  const parsed = ProductionPackageSchema.safeParse(input);
  if (!parsed.success) return { accepted: false, reason: "Input is not a production package." };
  const pkg = parsed.data;
  const evidence = checkScriptPackage(pkg.evidence, attestationKey);
  if (!evidence.accepted) return { accepted: false, reason: evidence.reason };
  if (!verifyScriptAttestation(pkg.scriptAttestation, pkg.scriptDraft, pkg.evidence.batch, attestationKey)) {
    return { accepted: false, reason: "Script attestation is missing, forged or does not match the script draft." };
  }
  return { accepted: true, pkg };
}

/**
 * `beforeModelCallback` for every agent after the Script Agent. Unless the
 * request carries a production package that verifies, the model is not called.
 * When it does, the request is rewritten to the attested evidence, the
 * attested script and the earlier stage outputs, with no signatures.
 */
export function createProductionEntryGuard(getGateConfig: () => GateConfig, audit: AuditSink, agentName: string) {
  return ({ request }: { context: Context; request: LlmRequest }): LlmResponse | undefined => {
    const config = getGateConfig();
    const at = (config.now?.() ?? new Date()).toISOString();
    const text = lastUserText(request);
    const stageInput = StageInputSchema.safeParse(text === undefined ? undefined : extractJson(text));
    const check: ProductionCheck = stageInput.success
      ? checkProductionPackage(stageInput.data.production, config.attestationKey)
      : { accepted: false, reason: "Input is not a production stage input." };
    if (!check.accepted || !stageInput.success) {
      const reason = check.accepted ? "Input is not a production stage input." : check.reason;
      audit.record({ type: "PRODUCTION_ENTRY", agent: agentName, accepted: false, reason, at });
      return {
        content: { role: "model", parts: [{ text: `${PRODUCTION_BLOCKED_PREFIX}: ${reason} Nothing was produced.` }] },
      };
    }
    audit.record({ type: "PRODUCTION_ENTRY", agent: agentName, accepted: true, reason: "All attestations verified.", at });
    request.contents = [
      {
        role: "user",
        parts: [
          {
            text: JSON.stringify({
              notice:
                "Attested evidence and the script drafted from it. Work only from these. " +
                "Fields under unverifiedSupporting were NOT checked by the verification gate.",
              stage: stageInput.data.stage,
              evidence: scriptAgentView(check.pkg.evidence),
              script: check.pkg.scriptDraft,
              priorOutputs: stageInput.data.priorOutputs,
            }),
          },
        ],
      },
    ];
    return undefined;
  };
}

// ── Workflow ─────────────────────────────────────────────────────────────

export interface ProductionDeps {
  creativeProducer: LlmAgent;
  veoVideoGenerator: LlmAgent;
  videoEditor: LlmAgent;
  qualityControlAgent: LlmAgent;
  channelManager: LlmAgent;
  getGateConfig: () => GateConfig;
  audit: AuditSink;
  /** Run start/end lines. Model calls inside the job are tagged with its jobId. */
  telemetry?: TelemetrySink;
  providers: Providers;
  jobStore: JobStore;
}

type NodeCtx = { state: { get<T>(key: string): T | undefined; set(key: string, value: unknown): void }; route?: unknown };

const QcVerdictSchema = z.object({
  overall: z.enum(["PASS", "FAIL", "NEEDS_HUMAN_REVIEW"]),
});

export function buildProductionWorkflow(deps: ProductionDeps): Workflow {
  const now = () => (deps.getGateConfig().now?.() ?? new Date()).toISOString();

  const record = (ctx: NodeCtx, entry: Omit<StageRecord, "startedAt" | "finishedAt">) => {
    const finishedAt = now();
    const startedAt = ctx.state.get<string>(STATE.lastAt) ?? finishedAt;
    ctx.state.set(STATE.stages, [...(ctx.state.get<StageRecord[]>(STATE.stages) ?? []), { ...entry, startedAt, finishedAt }]);
    ctx.state.set(STATE.lastAt, finishedAt);
  };
  const halt = (ctx: NodeCtx, outcome: string, reason: string) => {
    ctx.state.set(STATE.halt, { outcome, reason });
    ctx.route = "HALT";
  };
  const stageInput = (ctx: NodeCtx, stage: Stage) => ({
    stage,
    production: ctx.state.get<ProductionPackage>(STATE.pkg),
    priorOutputs: ctx.state.get<Record<string, unknown>>(STATE.outputs) ?? {},
  });
  const keepOutput = (ctx: NodeCtx, key: string, value: unknown) =>
    ctx.state.set(STATE.outputs, { ...(ctx.state.get<Record<string, unknown>>(STATE.outputs) ?? {}), [key]: value });

  /** Records an LLM stage from the text its agent returned. Returns the text, or null if the stage failed. */
  const recordAgentStage = (ctx: NodeCtx, stage: Stage, agent: LlmAgent, input: unknown, outputKey: string): string | null => {
    const text = typeof input === "string" ? input : "";
    if (text.startsWith(PRODUCTION_BLOCKED_PREFIX)) {
      record(ctx, { stage, actor: agent.name, status: "BLOCKED", input: "production package", output: null, error: text });
      halt(ctx, "STAGE_BLOCKED", text);
      return null;
    }
    if (text.trim() === "") {
      record(ctx, { stage, actor: agent.name, status: "FAILED", input: "production package", output: null, error: "Agent returned no output." });
      halt(ctx, "STAGE_FAILED", `${agent.name} returned no output.`);
      return null;
    }
    record(ctx, { stage, actor: agent.name, status: "COMPLETED", input: "production package", output: text, error: null });
    keepOutput(ctx, outputKey, text);
    return text;
  };

  /** Runs a provider at most once per key, and only when it reports CONNECTED. */
  const runProvider = async (
    ctx: NodeCtx,
    stage: Stage,
    provider: Providers["video"],
    key: string,
    brief: string,
    missingInputs: string | null,
  ): Promise<ProducedAsset[]> => {
    if (provider.connectionStatus() !== "CONNECTED") {
      record(ctx, { stage, actor: provider.name, status: "NOT_CONNECTED", input: "stage brief", output: null, error: `Provider status: ${provider.connectionStatus()}.` });
      return [];
    }
    if (missingInputs) {
      record(ctx, { stage, actor: provider.name, status: "SKIPPED", input: "stage brief", output: null, error: missingInputs });
      return [];
    }
    const { result, reused } = await deps.jobStore.once(key, () => provider.produce({ idempotencyKey: key, brief }));
    if (result.status !== "PRODUCED") {
      record(ctx, { stage, actor: provider.name, status: "NOT_CONNECTED", input: "stage brief", output: null, error: result.reason });
      return [];
    }
    const simulated = result.assets.some((a) => a.simulated);
    record(ctx, {
      stage,
      actor: provider.name,
      status: simulated ? "SIMULATED" : "COMPLETED",
      input: "stage brief",
      output: { assets: result.assets, reusedExistingResult: reused },
      error: null,
    });
    ctx.state.set(STATE.assets, [...(ctx.state.get<ProducedAsset[]>(STATE.assets) ?? []), ...result.assets]);
    return result.assets;
  };

  const scriptDigestOf = (ctx: NodeCtx) => ctx.state.get<ProductionPackage>(STATE.pkg)!.scriptAttestation.scriptDigest;

  const intake = new FunctionNode("production_intake", (ctx) => {
    ctx.state.set(STATE.lastAt, now());
    const check = checkProductionPackage(ctx.state.get(STATE.pkg), deps.getGateConfig().attestationKey);
    if (!check.accepted) {
      halt(ctx, "PACKAGE_REJECTED", check.reason);
      return undefined;
    }
    ctx.route = "CONTINUE";
    return stageInput(ctx, "CREATIVE_PLANNING");
  });

  const recordCreativePlan = new FunctionNode("record_creative_plan", (ctx, input) => {
    if (recordAgentStage(ctx, "CREATIVE_PLANNING", deps.creativeProducer, input, "creativePlan") === null) return undefined;
    ctx.route = "CONTINUE";
    return stageInput(ctx, "VIDEO_SPECIFICATION");
  });

  const assetProduction = new FunctionNode("asset_production", async (ctx, input) => {
    const specs = recordAgentStage(ctx, "VIDEO_SPECIFICATION", deps.veoVideoGenerator, input, "clipSpecifications");
    if (specs === null) return undefined;
    // Rule: no Quran or Hadith Arabic text inside generation prompts. The clip
    // specifications are prompts, so any Arabic script in them stops the job.
    if (/\p{Script=Arabic}/u.test(specs)) {
      const reason = "Arabic script found in video generation prompts.";
      record(ctx, { stage: "ASSET_GENERATION", actor: "asset_production", status: "FAILED", input: "clip specifications", output: null, error: reason });
      halt(ctx, "PROMPT_RULE_VIOLATION", reason);
      return undefined;
    }
    await runProvider(ctx, "ASSET_GENERATION", deps.providers.video, `video:${scriptDigestOf(ctx)}`, specs, null);
    ctx.route = "CONTINUE";
    return stageInput(ctx, "EDIT_PLANNING");
  });

  const assembly = new FunctionNode("assembly", async (ctx, input) => {
    const brief = recordAgentStage(ctx, "EDIT_PLANNING", deps.videoEditor, input, "editBrief");
    if (brief === null) return undefined;
    const pkg = ctx.state.get<ProductionPackage>(STATE.pkg)!;
    const digest = scriptDigestOf(ctx);
    const clips = (ctx.state.get<ProducedAsset[]>(STATE.assets) ?? []).filter((a) => a.kind === "VIDEO_CLIP");
    const narration = await runProvider(ctx, "NARRATION", deps.providers.narration, `narration:${digest}`, pkg.scriptDraft, null);
    const missing = clips.length === 0 || narration.length === 0 ? "Video clips or narration are missing, so nothing can be assembled." : null;
    await runProvider(ctx, "VIDEO_ASSEMBLY", deps.providers.renderer, `render:${digest}`, brief, missing);
    const rendered = (ctx.state.get<ProducedAsset[]>(STATE.assets) ?? []).find((a) => a.kind === "RENDERED_VIDEO");
    keepOutput(ctx, "productionStatus", {
      renderedVideoExists: Boolean(rendered),
      renderedVideoIsSimulated: rendered?.simulated ?? null,
      note: rendered ? "A rendered video asset was returned by the renderer." : "No rendered video exists.",
    });
    ctx.route = "CONTINUE";
    return stageInput(ctx, "QUALITY_CONTROL");
  });

  const qcGate = new FunctionNode("qc_gate", (ctx, input) => {
    const text = recordAgentStage(ctx, "QUALITY_CONTROL", deps.qualityControlAgent, input, "qualityControl");
    if (text === null) return undefined;
    const verdict = QcVerdictSchema.safeParse(extractJson(text));
    // Unparseable QC output is never treated as a pass.
    const overall = verdict.success ? verdict.data.overall : "NEEDS_HUMAN_REVIEW";
    const rendered = (ctx.state.get<ProducedAsset[]>(STATE.assets) ?? []).find((a) => a.kind === "RENDERED_VIDEO");
    const publishReady = overall === "PASS" && Boolean(rendered) && rendered!.simulated === false;
    keepOutput(ctx, "qcDecision", {
      overall,
      publishReady,
      reasons: [
        ...(verdict.success ? [] : ["QC output was not in the required format."]),
        ...(rendered ? [] : ["No rendered video exists."]),
        ...(rendered?.simulated ? ["The rendered video is simulated."] : []),
      ],
    });
    if (overall === "FAIL") {
      halt(ctx, "QC_FAILED", "Quality control returned FAIL.");
      return undefined;
    }
    ctx.route = "CONTINUE";
    return stageInput(ctx, "RELEASE_PREPARATION");
  });

  const approvalGate = new FunctionNode("approval_gate", (ctx, input) => {
    if (recordAgentStage(ctx, "RELEASE_PREPARATION", deps.channelManager, input, "releaseManifest") === null) return;
    const qc = (ctx.state.get<Record<string, any>>(STATE.outputs) ?? {}).qcDecision;
    const approval: ApprovalRecord = { status: "REQUESTED", requestedAt: now(), publishReady: qc?.publishReady === true };
    ctx.state.set(STATE.approval, approval);
    record(ctx, { stage: "HUMAN_APPROVAL", actor: "approval_gate", status: "REQUESTED", input: "production pack", output: approval, error: null });
    record(ctx, {
      stage: "PUBLISHING",
      actor: deps.providers.publisher.name,
      status: "DISABLED",
      input: "release manifest",
      output: null,
      error: `Publishing needs explicit owner approval. Publisher status: ${deps.providers.publisher.connectionStatus()}.`,
    });
    record(ctx, { stage: "ANALYTICS", actor: "analytics", status: "NOT_CONNECTED", input: "publication", output: null, error: "Nothing has been published." });
  });

  const productionHalt = new FunctionNode("production_halt", () => undefined);

  return new Workflow({
    name: "production_workflow",
    description: "Creative planning, asset production, assembly, quality control and the owner approval request.",
    edges: [
      ["START", intake, { CONTINUE: deps.creativeProducer, HALT: productionHalt }],
      [deps.creativeProducer, recordCreativePlan, { CONTINUE: deps.veoVideoGenerator, HALT: productionHalt }],
      [deps.veoVideoGenerator, assetProduction, { CONTINUE: deps.videoEditor, HALT: productionHalt }],
      [deps.videoEditor, assembly, { CONTINUE: deps.qualityControlAgent, HALT: productionHalt }],
      [deps.qualityControlAgent, qcGate, { CONTINUE: deps.channelManager, HALT: productionHalt }],
      [deps.channelManager, approvalGate],
    ],
  });
}

// ── Running a production job ─────────────────────────────────────────────

export interface ProductionSystem {
  scriptPipeline: VerifiedScriptPipeline;
  productionWorkflow: Workflow;
  deps: ProductionDeps;
}

export interface StartOptions {
  request: string;
  /** A second start with the same key returns the first job instead of running again. */
  requestKey?: string;
  abortSignal?: AbortSignal;
}

const iso = () => new Date().toISOString();

function scriptStageRecords(system: ProductionSystem, script: PipelineResult): StageRecord[] {
  const { deps } = system.scriptPipeline;
  const span = (name: string) => ({
    startedAt: script.timeline[name]?.firstEventAt ?? script.startedAt,
    finishedAt: script.timeline[name]?.lastEventAt ?? script.finishedAt,
  });
  const ran = (name: string) => name in script.timeline;
  const { batch } = script;
  const gateStatus: StageStatus = batch.totalRecords === 0 ? "BLOCKED" : batch.fullyVerified ? "PASSED" : batch.passed > 0 ? "PARTIAL" : "BLOCKED";
  return [
    {
      stage: "TOPIC_DISCOVERY_AND_RESEARCH",
      actor: deps.researchAgent.name,
      status: ran(deps.researchAgent.name) && batch.totalRecords > 0 ? "COMPLETED" : "FAILED",
      ...span(deps.researchAgent.name),
      input: "production request",
      output: { candidateRecords: batch.totalRecords },
      error: batch.totalRecords > 0 ? null : (script.error ?? "No usable candidate records were returned."),
    },
    {
      stage: "VERIFICATION",
      actor: deps.verificationAgent.name,
      status: ran(deps.verificationAgent.name) ? "COMPLETED" : "SKIPPED",
      ...span(deps.verificationAgent.name),
      input: "evidence IDs, references and researcher URLs",
      output: null,
      error: ran(deps.verificationAgent.name) ? null : "No candidate was eligible for verification.",
    },
    {
      stage: "VERIFICATION_GATE",
      actor: "deterministic_gate",
      status: gateStatus,
      ...span("deterministic_gate"),
      input: "candidates and verification records",
      output: batch,
      error: gateStatus === "BLOCKED" ? "No record passed the gate." : null,
    },
    {
      stage: "SCRIPT",
      actor: deps.scriptAgent.name,
      status: script.status === "SCRIPTS_DRAFTED" ? "COMPLETED" : script.status === "SCRIPT_ENTRY_REJECTED" ? "BLOCKED" : "SKIPPED",
      ...span(deps.scriptAgent.name),
      input: "attested evidence package",
      output: script.scriptDraft,
      error: script.status === "SCRIPTS_DRAFTED" ? null : "No attested evidence reached the Script Agent.",
    },
  ];
}

function finish(store: JobStore, job: Job, status: Job["status"], outcome: string, error: string | null = null): Job {
  job.status = status;
  job.outcome = outcome;
  job.error = error;
  job.completedAt = status === "WAITING_FOR_APPROVAL" ? null : iso();
  job.currentStage = job.stages.at(-1)?.stage ?? null;
  job.progress = Math.round((new Set(job.stages.map((s) => s.stage)).size / STAGES.length) * 100) / 100;
  store.save(job);
  return job;
}

/** Runs one production job: the verified script pipeline, then the production workflow. */
type StartResult = { job: Job; reusedExistingJob: boolean; decisions: GateDecision[] };

export async function startProduction(system: ProductionSystem, options: StartOptions): Promise<StartResult> {
  const store = system.deps.jobStore;
  if (options.requestKey) {
    const existing = store.findByRequestKey(options.requestKey);
    if (existing) return { job: existing, reusedExistingJob: true, decisions: [] };
  }
  const job = store.create({ request: options.request, requestKey: options.requestKey ?? null, workflowId: "hidaya_production_v1", now: iso() });
  const telemetry = system.deps.telemetry;
  const started = Date.now();
  telemetry?.record({ type: "PIPELINE_RUN", pipeline: "production", runId: job.jobId, phase: "START" });
  const result = await withRunId(job.jobId, () => runProductionJob(system, job, options));
  telemetry?.record({
    type: "PIPELINE_RUN",
    pipeline: "production",
    runId: job.jobId,
    phase: "END",
    status: result.job.status,
    durationMs: Date.now() - started,
    ...(result.job.status === "FAILED" ? { error: result.job.outcome ?? "FAILED" } : {}),
  });
  return result;
}

async function runProductionJob(system: ProductionSystem, job: Job, options: StartOptions): Promise<StartResult> {
  const store = system.deps.jobStore;
  if (options.abortSignal?.aborted) return { job: finish(store, job, "CANCELLED", "CANCELLED_BEFORE_START"), reusedExistingJob: false, decisions: [] };
  job.status = "RUNNING";
  store.save(job);

  let decisions: GateDecision[] = [];
  try {
    const script = await runVerifiedScriptPipeline(system.scriptPipeline, options.request, { abortSignal: options.abortSignal });
    decisions = script.decisions;
    job.evidenceRunId = script.runId;
    job.stages.push(...scriptStageRecords(system, script));
    store.save(job);
    if (options.abortSignal?.aborted) return { job: finish(store, job, "CANCELLED", "CANCELLED"), reusedExistingJob: false, decisions };
    if (script.status === "ERROR") return { job: finish(store, job, "FAILED", "SCRIPT_PIPELINE_ERROR", script.error ?? null), reusedExistingJob: false, decisions };
    if (script.status !== "SCRIPTS_DRAFTED" || !script.attestedPackage || !script.scriptDraft) {
      return { job: finish(store, job, "COMPLETED", "STOPPED_AT_VERIFICATION_GATE"), reusedExistingJob: false, decisions };
    }

    const config = system.deps.getGateConfig();
    const scriptAttestation = attestScript(script.scriptDraft, script.attestedPackage.batch, config);
    if (!scriptAttestation) return { job: finish(store, job, "FAILED", "SCRIPT_NOT_ATTESTED", "The script draft could not be attested."), reusedExistingJob: false, decisions };
    const pkg: ProductionPackage = {
      packageType: "HIDAYA_PRODUCTION_PACKAGE",
      evidence: script.attestedPackage,
      scriptDraft: script.scriptDraft,
      scriptAttestation,
    };
    job.scriptDigest = digestText(script.scriptDraft);

    const appName = "hidaya_production_workflow";
    const runner = new InMemoryRunner({ agent: system.productionWorkflow, appName });
    const session = await runner.sessionService.createSession({ appName, userId: "pipeline", state: { [STATE.pkg]: pkg } });
    for await (const _event of runner.runAsync({
      userId: "pipeline",
      sessionId: session.id,
      newMessage: { role: "user", parts: [{ text: `Production job ${job.jobId}` }] },
      runConfig: createRunConfig({ maxLlmCalls: MAX_LLM_CALLS_PER_RUN }),
      abortSignal: options.abortSignal,
    })) {
      // Stage records are read from state after the run.
    }
    const final = await runner.sessionService.getSession({ appName, userId: "pipeline", sessionId: session.id });
    const state = (final?.state ?? {}) as Record<string, unknown>;
    job.stages.push(...((state[STATE.stages] as StageRecord[] | undefined) ?? []));
    job.assets = (state[STATE.assets] as ProducedAsset[] | undefined) ?? [];
    job.releaseManifest = ((state[STATE.outputs] as Record<string, unknown> | undefined)?.releaseManifest as string | undefined) ?? null;
    job.approval = (state[STATE.approval] as ApprovalRecord | undefined) ?? null;

    if (options.abortSignal?.aborted) return { job: finish(store, job, "CANCELLED", "CANCELLED"), reusedExistingJob: false, decisions };
    const halted = state[STATE.halt] as { outcome: string; reason: string } | undefined;
    if (halted) return { job: finish(store, job, "FAILED", halted.outcome, halted.reason), reusedExistingJob: false, decisions };
    if (!job.approval) return { job: finish(store, job, "FAILED", "INCOMPLETE", "The workflow ended before requesting approval."), reusedExistingJob: false, decisions };
    return { job: finish(store, job, "WAITING_FOR_APPROVAL", "AWAITING_OWNER_APPROVAL"), reusedExistingJob: false, decisions };
  } catch (cause) {
    if (options.abortSignal?.aborted) return { job: finish(store, job, "CANCELLED", "CANCELLED"), reusedExistingJob: false, decisions };
    return { job: finish(store, job, "FAILED", "ERROR", cause instanceof Error ? cause.message : String(cause)), reusedExistingJob: false, decisions };
  }
}

// ── Approval and publishing ──────────────────────────────────────────────

export type ApprovalDecision = "APPROVED" | "REJECTED" | "REVISION_REQUESTED";

/**
 * Records the owner's decision. This function is not exposed to any agent:
 * no model can approve its own work.
 */
export function recordApprovalDecision(store: JobStore, jobId: string, decision: ApprovalDecision, decidedBy: string, note?: string): Job {
  const job = store.get(jobId);
  if (!job) throw new Error(`Unknown job ${jobId}.`);
  if (job.status !== "WAITING_FOR_APPROVAL" || job.approval?.status !== "REQUESTED") {
    throw new Error(`Job ${jobId} is not waiting for an approval decision.`);
  }
  if (!decidedBy.trim()) throw new Error("An approval decision needs a named decider.");
  job.approval = { ...job.approval, status: decision, decidedAt: iso(), decidedBy, ...(note ? { note } : {}) };
  if (decision !== "APPROVED") return finish(store, job, "COMPLETED", decision === "REJECTED" ? "REJECTED_BY_OWNER" : "REVISION_REQUESTED");
  store.save(job);
  return job;
}

export type PublishOutcome = { published: true; reference: string; reusedExistingResult: boolean } | { published: false; reason: string };

/** Publishes only an approved, QC-passed, real rendered video, and only once. */
export async function publishApprovedJob(store: JobStore, jobId: string, providers: Providers): Promise<PublishOutcome> {
  const job = store.get(jobId);
  if (!job) return { published: false, reason: `Unknown job ${jobId}.` };
  if (job.approval?.status !== "APPROVED") return { published: false, reason: "The owner has not approved this job." };
  if (!job.approval.publishReady) return { published: false, reason: "The job is not publish-ready: QC did not pass on a real rendered video." };
  const video = job.assets.find((a) => a.kind === "RENDERED_VIDEO");
  if (!video || video.simulated) return { published: false, reason: "No real rendered video exists." };
  if (providers.publisher.connectionStatus() !== "CONNECTED") {
    return { published: false, reason: `Publisher is ${providers.publisher.connectionStatus()}.` };
  }
  const key = `publish:${job.scriptDigest}`;
  const { result, reused } = await store.once(key, () =>
    providers.publisher.publish({ idempotencyKey: key, video, manifest: job.releaseManifest ?? "" }),
  );
  if (result.status !== "PUBLISHED") return { published: false, reason: result.reason };
  if (result.simulated) return { published: false, reason: "The publisher returned a simulated result; nothing was published." };
  job.publication = { status: "PUBLISHED", reference: result.reference };
  finish(store, job, "COMPLETED", "PUBLISHED");
  return { published: true, reference: result.reference, reusedExistingResult: reused };
}

// ── Report and Orchestrator tool ─────────────────────────────────────────

/** A consolidated report built by code from recorded state. No signatures. */
export function buildProductionReport(job: Job, decisions: GateDecision[] = []) {
  const rendered = job.assets.find((a) => a.kind === "RENDERED_VIDEO");
  return {
    jobId: job.jobId,
    status: job.status,
    outcome: job.outcome,
    error: job.error,
    currentStage: job.currentStage,
    progress: job.progress,
    stages: job.stages.map((s) => ({ ...s, retryPolicy: STAGE_RETRY_POLICY[s.stage] })),
    gateDecisions: decisions.map(({ attestation, ...rest }) => ({ ...rest, attested: attestation !== null })),
    video: rendered
      ? { exists: true, simulated: rendered.simulated, uri: rendered.uri }
      : { exists: false, simulated: null, uri: null },
    approval: job.approval,
    publishing: job.publication ?? { status: "NOT_PUBLISHED", reference: null },
    statement: rendered && !rendered.simulated
      ? "A rendered video exists. Nothing is published without the owner's approval."
      : "No real video exists and nothing has been published.",
  };
}

/** The Orchestrator's route to a full production run. It cannot approve or publish. */
export function createProductionTool(system: ProductionSystem) {
  return new FunctionTool({
    name: PRODUCTION_TOOL_NAME,
    description:
      "Runs one full production job: verified research and script, creative planning, asset production, assembly, " +
      "quality control and the owner approval request. Returns a report built by application code. " +
      "It never publishes; approval and publishing are done by the owner outside this tool.",
    parameters: z.object({
      request: z.string().describe("The production brief, e.g. today's topic or batch."),
      requestKey: z.string().optional().describe("Optional key. Reusing it returns the earlier job instead of running again."),
    }),
    execute: async ({ request, requestKey }) => {
      const { job, reusedExistingJob, decisions } = await startProduction(system, { request, requestKey });
      return { reusedExistingJob, ...buildProductionReport(job, decisions) };
    },
  });
}
