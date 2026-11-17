import { randomUUID } from "node:crypto";
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
import { EvidenceCandidateSchema, VerificationRecordSchema } from "../verification/contracts.ts";
import {
  attestBatch,
  evaluateEvidence,
  verifyAttestation,
  verifyBatchAttestation,
  type BatchAttestation,
  type GateConfig,
  type GateDecision,
} from "../verification/gate.ts";

/**
 * The enforced Research -> Verification -> Gate -> Script workflow.
 *
 *   START
 *     -> research agent                    (LLM)
 *     -> collect_candidates                (code: parse, validate, assign IDs)
 *     -> verification agent                (LLM; not shown the researched Arabic)
 *     -> deterministic_gate                (code: evaluate, attest, audit, route)
 *          PROCEED      -> script agent    (LLM; guarded by createScriptEntryGuard)
 *          HUMAN_REVIEW -> human_review_queue
 *          STOP         -> stop_workflow
 *
 * The Script Agent is reachable only through the PROCEED edge, and its own
 * entry guard re-verifies every attestation before the model is called.
 */

export const PIPELINE_TOOL_NAME = "run_verified_script_pipeline";
export const SCRIPT_BLOCKED_PREFIX = "SCRIPT_AGENT_BLOCKED";
/** Upper bound on evidence records per run (cost control). */
export const MAX_CANDIDATES_PER_RUN = 5;
/** Upper bound on model calls for one pipeline run (cost control). */
export const MAX_LLM_CALLS_PER_RUN = 40;

const STATE = {
  runId: "hidaya:run_id",
  entries: "hidaya:entries",
  decisions: "hidaya:gate_decisions",
  records: "hidaya:gate_records",
  reviewQueue: "hidaya:review_queue",
  stopped: "hidaya:stopped",
  scriptEntry: "hidaya:script_entry",
  scriptPackage: "hidaya:script_package",
} as const;

/** State key on the caller's session where the tool appends audit entries. */
export const AUDIT_STATE_KEY = "hidaya:gate_audit";

// ── Audit ────────────────────────────────────────────────────────────────

export type AuditEntry =
  | { type: "GATE_DECISION"; runId: string; decision: Omit<GateDecision, "attestation"> & { attested: boolean } }
  | { type: "SCRIPT_ENTRY"; accepted: boolean; reason: string; evidenceIds: string[]; at: string }
  | { type: "PRODUCTION_ENTRY"; agent: string; accepted: boolean; reason: string; at: string };

export interface AuditSink {
  record(entry: AuditEntry): void;
}

/** One JSON line per entry on stdout (picked up by Cloud Logging). No secrets. */
export const consoleAuditSink: AuditSink = {
  record(entry) {
    console.log(JSON.stringify({ severity: "NOTICE", message: "hidaya_gate_audit", ...entry }));
  },
};

// ── Agent output parsing ─────────────────────────────────────────────────

/** Extracts a JSON value from model text: the whole text, or its last json code block. */
export function extractJson(value: unknown): unknown {
  if (typeof value !== "string") return undefined;
  const candidates = [value.trim()];
  const fenced = [...value.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1].trim());
  candidates.push(...fenced.reverse());
  for (const text of candidates) {
    try {
      return JSON.parse(text);
    } catch {
      // try the next candidate
    }
  }
  return undefined;
}

/** Models often emit null for "not found"; the contracts use absent fields. */
function dropNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(dropNulls);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => [k, dropNulls(v)]),
    );
  }
  return value;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

// ── Script package (what crosses the gate -> Script Agent boundary) ──────

const ItemAttestationSchema = z.strictObject({
  gateVersion: z.string(),
  registryVersion: z.string(),
  evidenceId: z.string(),
  evidenceDigest: z.string(),
  issuedAt: z.string(),
  signature: z.string(),
});

const BatchAttestationSchema = z.strictObject({
  gateVersion: z.string(),
  runId: z.string(),
  totalRecords: z.number().int(),
  passedDigests: z.array(z.string()),
  fullyVerified: z.boolean(),
  issuedAt: z.string(),
  signature: z.string(),
});

export const ScriptPackageSchema = z.strictObject({
  packageType: z.literal("HIDAYA_ATTESTED_EVIDENCE"),
  batch: BatchAttestationSchema,
  items: z
    .array(
      z.strictObject({
        candidate: EvidenceCandidateSchema,
        verification: VerificationRecordSchema,
        attestation: ItemAttestationSchema,
      }),
    )
    .min(1),
});
export type ScriptPackage = z.infer<typeof ScriptPackageSchema>;

export type ScriptEntryCheck =
  | { accepted: true; pkg: ScriptPackage }
  | { accepted: false; reason: string };

/** Re-validates a script package: schema, every item attestation, and the batch attestation. */
export function checkScriptPackage(input: unknown, attestationKey: string | undefined): ScriptEntryCheck {
  const parsed = ScriptPackageSchema.safeParse(input);
  if (!parsed.success) return { accepted: false, reason: "Input is not an attested evidence package." };
  const pkg = parsed.data;
  for (const item of pkg.items) {
    if (item.verification.status !== "VERIFIED") {
      return { accepted: false, reason: `Record ${item.candidate.evidenceId} is not VERIFIED.` };
    }
    if (!verifyAttestation(item.attestation, item.candidate, item.verification, attestationKey)) {
      return { accepted: false, reason: `Attestation for ${item.candidate.evidenceId} is missing, forged or does not match the evidence.` };
    }
  }
  const digests = pkg.items.map((i) => i.attestation.evidenceDigest);
  if (new Set(digests).size !== digests.length) return { accepted: false, reason: "Duplicate evidence in package." };
  if (!verifyBatchAttestation(pkg.batch, digests, attestationKey)) {
    return { accepted: false, reason: "Batch attestation is missing, forged or does not match the package." };
  }
  return { accepted: true, pkg };
}

/** The only thing the Script Agent's model is shown. Contains no signatures. */
export function scriptAgentView(pkg: ScriptPackage) {
  return {
    notice:
      "Attested evidence from the deterministic verification gate. Use only this evidence. " +
      "Fields under unverifiedSupporting were NOT checked by the gate.",
    batch: {
      totalRecords: pkg.batch.totalRecords,
      passedRecords: pkg.items.length,
      withheldRecords: pkg.batch.totalRecords - pkg.items.length,
      fullyVerified: pkg.batch.fullyVerified,
    },
    evidence: pkg.items.map(({ candidate, verification }) => ({
      evidenceId: candidate.evidenceId,
      topicTitle: candidate.topicTitle,
      reference: candidate.reference,
      arabicText: candidate.arabicText,
      researchSourceUrl: candidate.sourceUrl,
      verificationSourceUrl: verification.sourceUrl,
      sourceEdition: verification.sourceEdition ?? candidate.sourceEdition,
      gradings: verification.gradings,
      unverifiedSupporting: candidate.unverifiedSupporting,
    })),
  };
}

export function lastUserText(request: LlmRequest): string | undefined {
  for (let i = request.contents.length - 1; i >= 0; i--) {
    const content = request.contents[i];
    if (content.role !== "user") continue;
    const text = (content.parts ?? []).map((p) => p.text ?? "").join("");
    if (text.trim()) return text;
  }
  return undefined;
}

/**
 * `beforeModelCallback` for the Script Agent. It runs on every model call the
 * Script Agent makes, however the agent was invoked. Unless the request carries
 * a package whose attestations verify, the model is not called at all. When it
 * does, the request is rewritten to contain only the verified evidence.
 */
export function createScriptEntryGuard(getGateConfig: () => GateConfig, audit: AuditSink) {
  return ({ context, request }: { context: Context; request: LlmRequest }): LlmResponse | undefined => {
    const config = getGateConfig();
    const at = (config.now?.() ?? new Date()).toISOString();
    const text = lastUserText(request);
    const check = checkScriptPackage(text === undefined ? undefined : extractJson(text), config.attestationKey);
    if (!check.accepted) {
      audit.record({ type: "SCRIPT_ENTRY", accepted: false, reason: check.reason, evidenceIds: [], at });
      context.state.set(STATE.scriptEntry, { accepted: false, reason: check.reason });
      return {
        content: {
          role: "model",
          parts: [{ text: `${SCRIPT_BLOCKED_PREFIX}: ${check.reason} No script was drafted.` }],
        },
      };
    }
    const evidenceIds = check.pkg.items.map((i) => i.candidate.evidenceId);
    audit.record({ type: "SCRIPT_ENTRY", accepted: true, reason: "All attestations verified.", evidenceIds, at });
    context.state.set(STATE.scriptEntry, { accepted: true, evidenceIds });
    request.contents = [{ role: "user", parts: [{ text: JSON.stringify(scriptAgentView(check.pkg)) }] }];
    return undefined;
  };
}

// ── Workflow ─────────────────────────────────────────────────────────────

interface Entry {
  evidenceId: string;
  /** The research draft with code-assigned identifiers; validated by the gate. */
  candidate: unknown;
  /** False when the draft is malformed or over the batch limit. */
  sendToVerifier: boolean;
  preGateReason?: string;
}

export interface ReviewQueueItem {
  evidenceId: string | null;
  reasons: string[];
  decision: GateDecision;
  candidate: unknown;
  verification: unknown;
}

export interface PipelineDeps {
  researchAgent: LlmAgent;
  verificationAgent: LlmAgent;
  scriptAgent: LlmAgent;
  getGateConfig: () => GateConfig;
  audit: AuditSink;
  /** Run start/end lines. Model calls inside the run are tagged with its runId. */
  telemetry?: TelemetrySink;
  createRunId?: () => string;
}

export interface VerifiedScriptPipeline {
  workflow: Workflow;
  deps: PipelineDeps;
}

const ResearchDraftSchema = EvidenceCandidateSchema.omit({ evidenceId: true, topicId: true, researchedBy: true });

/** Fields only the pipeline may set. A model that supplies one is out of contract. */
const RESEARCH_PIPELINE_FIELDS = ["evidenceId", "topicId", "researchedBy"];
const VERIFICATION_PIPELINE_FIELDS = ["verifiedBy", "verifiedAt"];
const suppliesAny = (draft: unknown, fields: readonly string[]) =>
  fields.some((field) => Object.hasOwn(asObject(draft) ?? {}, field));

export function buildVerifiedScriptPipeline(deps: PipelineDeps): VerifiedScriptPipeline {
  // Research, verification and script drafting must be three distinct agents
  // with distinct identities. This is a structural check, not proof that the
  // two retrievals are independent (see ARCHITECTURE.md, "Trust boundary").
  const roles = [deps.researchAgent, deps.verificationAgent, deps.scriptAgent];
  const identities = new Set(roles.map((agent) => agent.name.trim().toLowerCase()));
  if (new Set(roles).size !== roles.length || identities.size !== roles.length) {
    throw new Error("Research, verification and script agents must be three distinct agents with distinct names.");
  }

  const collectCandidates = new FunctionNode(
    "collect_candidates",
    (ctx, input) => {
      const runId = ctx.state.get<string>(STATE.runId) ?? "run";
      const drafts = asObject(extractJson(input))?.candidates;
      const list = Array.isArray(drafts) ? drafts : [];
      const entries: Entry[] = list.map((raw, index) => {
        const evidenceId = `${runId}-ev-${index + 1}`;
        const draft = dropNulls(raw);
        const valid = !suppliesAny(draft, RESEARCH_PIPELINE_FIELDS) && ResearchDraftSchema.safeParse(draft).success;
        const overLimit = index >= MAX_CANDIDATES_PER_RUN;
        return {
          evidenceId,
          // Identity fields are stamped here, by code, not taken from model output.
          candidate: asObject(draft)
            ? { ...(draft as object), evidenceId, topicId: `${runId}-topic-${index + 1}`, researchedBy: deps.researchAgent.name }
            : draft,
          sendToVerifier: valid && !overLimit,
          preGateReason: overLimit
            ? `Exceeds the limit of ${MAX_CANDIDATES_PER_RUN} records per run.`
            : valid
              ? undefined
              : "Research output for this record does not match the evidence contract.",
        };
      });
      ctx.state.set(STATE.entries, entries);
      const toVerify = entries.filter((e) => e.sendToVerifier);
      ctx.route = toVerify.length > 0 ? "VERIFY" : "NOTHING_TO_VERIFY";
      // Blind verification: the verifier gets the reference and the URL the
      // researcher used, but not the researched Arabic text or gradings.
      return {
        task:
          "Independently retrieve and verify each item from the source. Return one record per evidenceId.",
        items: toVerify.map((e) => {
          const c = e.candidate as { reference: unknown; sourceUrl: string };
          return { evidenceId: e.evidenceId, reference: c.reference, researcherSourceUrl: c.sourceUrl };
        }),
      };
    },
  );

  const deterministicGate = new FunctionNode(
    "deterministic_gate",
    (ctx, input) => {
      const config = deps.getGateConfig();
      const runId = ctx.state.get<string>(STATE.runId) ?? "run";
      const entries = ctx.state.get<Entry[]>(STATE.entries) ?? [];
      const verifiedAt = (config.now?.() ?? new Date()).toISOString();

      const draftsById = new Map<string, unknown[]>();
      const records = asObject(extractJson(input))?.records;
      for (const raw of Array.isArray(records) ? records : []) {
        const draft = asObject(dropNulls(raw));
        const id = draft && typeof draft.evidenceId === "string" ? draft.evidenceId : undefined;
        if (id) draftsById.set(id, [...(draftsById.get(id) ?? []), draft]);
      }

      const decisions: GateDecision[] = [];
      const recordsByIndex: Array<{ candidate: unknown; verification: unknown }> = [];
      for (const entry of entries) {
        const drafts = entry.sendToVerifier ? (draftsById.get(entry.evidenceId) ?? []) : [];
        let extraReason = entry.preGateReason;
        let verification: unknown = null;
        if (entry.sendToVerifier && drafts.length === 0) {
          extraReason = "No verification record was returned for this evidence ID.";
        } else if (drafts.length > 1) {
          extraReason = "More than one verification record was returned for this evidence ID.";
        } else if (drafts.length === 1 && suppliesAny(drafts[0], VERIFICATION_PIPELINE_FIELDS)) {
          extraReason = "Verification output supplied identity fields that only the pipeline may set.";
        } else if (drafts.length === 1) {
          // Verifier identity and time are stamped by code, not by the model.
          verification = { ...(drafts[0] as object), verifiedBy: deps.verificationAgent.name, verifiedAt };
        }
        const decision = evaluateEvidence(entry.candidate, verification, config);
        if (extraReason) decision.reasons.unshift(extraReason);
        if (decision.evidenceId === null) decision.evidenceId = entry.evidenceId;
        decisions.push(decision);
        recordsByIndex.push({ candidate: entry.candidate, verification });
        const { attestation, ...rest } = decision;
        deps.audit.record({ type: "GATE_DECISION", runId, decision: { ...rest, attested: attestation !== null } });
      }

      const batch: BatchAttestation | null = attestBatch(runId, decisions, config);
      const items = batch
        ? decisions.flatMap((decision, i) =>
            decision.outcome === "PASSED" && decision.attestation
              ? [
                  {
                    candidate: EvidenceCandidateSchema.parse(recordsByIndex[i].candidate),
                    verification: VerificationRecordSchema.parse(recordsByIndex[i].verification),
                    attestation: decision.attestation,
                  },
                ]
              : [],
          )
        : [];

      const scriptPackage: ScriptPackage | null =
        batch && items.length > 0 ? { packageType: "HIDAYA_ATTESTED_EVIDENCE", batch, items } : null;
      ctx.state.set(STATE.decisions, decisions);
      ctx.state.set(STATE.records, recordsByIndex);
      ctx.state.set(STATE.scriptPackage, scriptPackage);

      const routes: string[] = [];
      if (scriptPackage) routes.push("PROCEED");
      if (decisions.some((d) => d.outcome === "HUMAN_REVIEW")) routes.push("HUMAN_REVIEW");
      if (decisions.some((d) => d.outcome === "BLOCKED") || routes.length === 0) routes.push("STOP");
      ctx.route = routes;

      // This output is the Script Agent's input on the PROCEED edge. It holds
      // attested records only; nothing that failed the gate is in it.
      return scriptPackage ?? { packageType: "NOTHING_PASSED" };
    },
  );

  const collectByOutcome = (ctx: { state: { get<T>(key: string): T | undefined } }, outcome: GateDecision["outcome"]) => {
    const decisions = ctx.state.get<GateDecision[]>(STATE.decisions) ?? [];
    const records = ctx.state.get<Array<{ candidate: unknown; verification: unknown }>>(STATE.records) ?? [];
    return decisions.flatMap((decision, i): ReviewQueueItem[] =>
      decision.outcome === outcome
        ? [{ evidenceId: decision.evidenceId, reasons: decision.reasons, decision, ...records[i] }]
        : [],
    );
  };

  const humanReviewQueue = new FunctionNode("human_review_queue", (ctx) => {
    const queue = collectByOutcome(ctx, "HUMAN_REVIEW");
    // No node output: ADK allows a workflow one terminal output, which is the
    // Script Agent's draft. The queue is read from state by the caller.
    ctx.state.set(STATE.reviewQueue, queue);
  });

  const stopWorkflow = new FunctionNode("stop_workflow", (ctx) => {
    const stopped = collectByOutcome(ctx, "BLOCKED");
    ctx.state.set(STATE.stopped, stopped);
  });

  const workflow = new Workflow({
    name: "verified_script_pipeline",
    description: "Research, independent verification, deterministic gate, then script drafting from attested evidence only.",
    edges: [
      ["START", deps.researchAgent, collectCandidates, { VERIFY: deps.verificationAgent, NOTHING_TO_VERIFY: deterministicGate }],
      [deps.verificationAgent, deterministicGate],
      [deterministicGate, { PROCEED: deps.scriptAgent, HUMAN_REVIEW: humanReviewQueue, STOP: stopWorkflow }],
    ],
  });

  return { workflow, deps };
}

// ── Running the pipeline ─────────────────────────────────────────────────

export interface PipelineResult {
  runId: string;
  status: "SCRIPTS_DRAFTED" | "NOTHING_PASSED" | "SCRIPT_ENTRY_REJECTED" | "ERROR";
  batch: { totalRecords: number; passed: number; humanReview: number; blocked: number; fullyVerified: boolean };
  decisions: GateDecision[];
  humanReviewQueue: ReviewQueueItem[];
  stopped: ReviewQueueItem[];
  /** The Script Agent's draft; null unless attested evidence reached it. */
  scriptDraft: string | null;
  /**
   * The attested evidence the draft was written from, for later stages to
   * re-verify. Null unless a draft was produced. Not shown to the Orchestrator.
   */
  attestedPackage: ScriptPackage | null;
  /** When each agent or code node was first and last seen emitting, by name. */
  timeline: Record<string, { firstEventAt: string; lastEventAt: string }>;
  startedAt: string;
  finishedAt: string;
  error?: string;
}

/**
 * Runs the workflow as the root of its own ADK runner and session, so the
 * agents inside it see nothing of the caller's conversation.
 */
export async function runVerifiedScriptPipeline(
  pipeline: VerifiedScriptPipeline,
  request: string,
  options: { abortSignal?: AbortSignal } = {},
): Promise<PipelineResult> {
  const runId = pipeline.deps.createRunId?.() ?? `run-${randomUUID()}`;
  const telemetry = pipeline.deps.telemetry;
  const started = Date.now();
  telemetry?.record({ type: "PIPELINE_RUN", pipeline: "verified_script", runId, phase: "START" });
  const result = await withRunId(runId, () => executeVerifiedScriptPipeline(pipeline, runId, request, options));
  telemetry?.record({
    type: "PIPELINE_RUN",
    pipeline: "verified_script",
    runId,
    phase: "END",
    status: result.status,
    durationMs: Date.now() - started,
    ...(result.error ? { error: result.error } : {}),
  });
  return result;
}

async function executeVerifiedScriptPipeline(
  pipeline: VerifiedScriptPipeline,
  runId: string,
  request: string,
  options: { abortSignal?: AbortSignal },
): Promise<PipelineResult> {
  const { deps, workflow } = pipeline;
  const appName = "hidaya_verified_script_pipeline";
  const userId = "pipeline";
  const runner = new InMemoryRunner({ agent: workflow, appName });
  const session = await runner.sessionService.createSession({ appName, userId, state: { [STATE.runId]: runId } });

  let scriptText: string | null = null;
  let error: string | undefined;
  const timeline: PipelineResult["timeline"] = {};
  const startedAt = new Date().toISOString();
  try {
    for await (const event of runner.runAsync({
      userId,
      sessionId: session.id,
      newMessage: { role: "user", parts: [{ text: request }] },
      runConfig: createRunConfig({ maxLlmCalls: MAX_LLM_CALLS_PER_RUN }),
      abortSignal: options.abortSignal,
    })) {
      const seenAt = new Date().toISOString();
      const author = event.author ?? "unknown";
      timeline[author] = { firstEventAt: timeline[author]?.firstEventAt ?? seenAt, lastEventAt: seenAt };
      if (event.author === deps.scriptAgent.name && typeof event.output === "string") scriptText = event.output;
    }
  } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause);
  }

  const finalSession = await runner.sessionService.getSession({ appName, userId, sessionId: session.id });
  const state = (finalSession?.state ?? {}) as Record<string, unknown>;
  const decisions = (state[STATE.decisions] as GateDecision[] | undefined) ?? [];
  const scriptEntry = state[STATE.scriptEntry] as { accepted: boolean } | undefined;
  const passed = decisions.filter((d) => d.outcome === "PASSED").length;
  const drafted = !error && scriptEntry?.accepted === true && scriptText !== null;

  return {
    runId,
    status: error ? "ERROR" : drafted ? "SCRIPTS_DRAFTED" : scriptEntry?.accepted === false ? "SCRIPT_ENTRY_REJECTED" : "NOTHING_PASSED",
    batch: {
      totalRecords: decisions.length,
      passed,
      humanReview: decisions.filter((d) => d.outcome === "HUMAN_REVIEW").length,
      blocked: decisions.filter((d) => d.outcome === "BLOCKED").length,
      fullyVerified: decisions.length > 0 && passed === decisions.length,
    },
    decisions,
    humanReviewQueue: (state[STATE.reviewQueue] as ReviewQueueItem[] | undefined) ?? [],
    stopped: (state[STATE.stopped] as ReviewQueueItem[] | undefined) ?? [],
    scriptDraft: drafted ? scriptText : null,
    attestedPackage: drafted ? ((state[STATE.scriptPackage] as ScriptPackage | null | undefined) ?? null) : null,
    timeline,
    startedAt,
    finishedAt: new Date().toISOString(),
    ...(error ? { error } : {}),
  };
}

/** The Orchestrator's only route to research, verification and script drafting. */
export function createPipelineTool(pipeline: VerifiedScriptPipeline) {
  return new FunctionTool({
    name: PIPELINE_TOOL_NAME,
    description:
      "Runs research, independent verification, the deterministic religious validation gate and Tamil script drafting. " +
      "Scripts are drafted only from evidence the gate attested. The gate decision in the result is final and cannot be overridden.",
    parameters: z.object({
      request: z.string().describe("What to research, e.g. the daily batch brief or a specific topic."),
    }),
    execute: async ({ request }, toolContext) => {
      const result = await runVerifiedScriptPipeline(pipeline, request);
      // Signatures stay in application code; the Orchestrator's model sees decisions only.
      const withoutSignatures = (decision: GateDecision) => {
        const { attestation, ...rest } = decision;
        return { ...rest, attested: attestation !== null };
      };
      const stripItem = (item: ReviewQueueItem) => ({ ...item, decision: withoutSignatures(item.decision) });
      const { attestedPackage: _notForTheModel, timeline: _timeline, ...rest } = result;
      const visible = {
        ...rest,
        decisions: result.decisions.map(withoutSignatures),
        humanReviewQueue: result.humanReviewQueue.map(stripItem),
        stopped: result.stopped.map(stripItem),
      };
      if (toolContext) {
        const previous = toolContext.state.get<unknown[]>(AUDIT_STATE_KEY) ?? [];
        toolContext.state.set(AUDIT_STATE_KEY, [
          ...previous,
          { runId: visible.runId, status: visible.status, batch: visible.batch, decisions: visible.decisions },
        ]);
      }
      return visible;
    },
  });
}
