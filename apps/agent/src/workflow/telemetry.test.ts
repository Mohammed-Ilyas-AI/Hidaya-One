import assert from "node:assert/strict";
import { test } from "node:test";
import { BaseLlm, type LlmRequest, type LlmResponse } from "@google/adk";
import {
  DEFAULT_MODEL_TIMEOUT_MS,
  ObservedModel,
  currentRunId,
  modelTimeoutFromEnv,
  withRunId,
  type TelemetryEntry,
} from "./telemetry.ts";
import { runVerifiedScriptPipeline } from "./verified-script-pipeline.ts";
import { startProduction } from "./production-pipeline.ts";
import { agreeing, buildSystem, quranDraft, text } from "./test-support.ts";

/**
 * Model-call bounds and telemetry. Background: on 2026-11-16 one Gemini call
 * on Cloud Run hung for ~600 s until Vertex AI returned 504, because no
 * client timeout was set, and ADK absorbed the error without a log line.
 */

class ScriptedModel extends BaseLlm {
  readonly requests: LlmRequest[] = [];
  private readonly behave: (request: LlmRequest) => Promise<LlmResponse>;
  constructor(behave: (request: LlmRequest) => Promise<LlmResponse>) {
    super({ model: "gemini-3.8-flash" });
    this.behave = behave;
  }
  async *generateContentAsync(request: LlmRequest): AsyncGenerator<LlmResponse, void> {
    this.requests.push(request);
    yield await this.behave(request);
  }
  async connect(): Promise<never> {
    throw new Error("not supported");
  }
}

const request = (): LlmRequest => ({ contents: [], config: {}, liveConnectConfig: {}, toolsDict: {} }) as unknown as LlmRequest;

function observed(behave: (request: LlmRequest) => Promise<LlmResponse>, timeoutMs = 120_000) {
  const entries: TelemetryEntry[] = [];
  const inner = new ScriptedModel(behave);
  let clock = 1_000;
  const model = new ObservedModel(inner, {
    agentName: "test_agent",
    timeoutMs,
    sink: { record: (e) => entries.push(e) },
    now: () => (clock += 250),
  });
  return { model, inner, entries };
}

async function drain(model: BaseLlm, req = request()) {
  const out: LlmResponse[] = [];
  for await (const r of model.generateContentAsync(req)) out.push(r);
  return out;
}

test("timeout setting: default, valid value, and out-of-range values refused", () => {
  assert.equal(modelTimeoutFromEnv(undefined), DEFAULT_MODEL_TIMEOUT_MS);
  assert.equal(modelTimeoutFromEnv(""), DEFAULT_MODEL_TIMEOUT_MS);
  assert.equal(modelTimeoutFromEnv("90000"), 90_000);
  for (const bad of ["abc", "5000", "700000", "150000.5", "-1"]) {
    assert.throws(() => modelTimeoutFromEnv(bad), /HIDAYA_MODEL_TIMEOUT_MS/);
  }
});

test("every call carries the per-attempt deadline and logs latency and tokens", async () => {
  const { model, inner, entries } = observed(async () => ({
    ...text("ok"),
    usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 80, thoughtsTokenCount: 40, totalTokenCount: 1320 },
  }));
  const req = request();
  req.config!.httpOptions = { headers: { "x-keep": "1" } };
  await withRunId("run-telemetry-1", () => drain(model, req));

  assert.equal(inner.requests[0].config?.httpOptions?.timeout, 120_000);
  assert.deepEqual(inner.requests[0].config?.httpOptions?.headers, { "x-keep": "1" });
  assert.deepEqual(entries, [
    {
      type: "MODEL_CALL",
      agent: "test_agent",
      model: "gemini-3.8-flash",
      runId: "run-telemetry-1",
      timeoutMs: 120_000,
      outcome: "OK",
      latencyMs: 250,
      usage: { promptTokens: 1200, outputTokens: 80, thoughtsTokens: 40, toolUsePromptTokens: null, totalTokens: 1320 },
    },
  ]);
});

test("a server error is logged with its status and still reaches ADK", async () => {
  const { model, entries } = observed(async () => {
    throw Object.assign(new Error("Gateway timeout from upstream"), { status: 504 });
  });
  await assert.rejects(drain(model), /Gateway timeout/);
  assert.equal(entries.length, 1);
  const entry = entries[0];
  assert.ok(entry.type === "MODEL_CALL");
  assert.equal(entry.outcome, "ERROR");
  assert.equal(entry.errorCode, "504");
  assert.equal(entry.runId, null);
});

test("an aborted attempt is logged as a client timeout", async () => {
  const { model, entries } = observed(async () => {
    throw Object.assign(new Error("This operation was aborted"), { name: "AbortError" });
  });
  await assert.rejects(drain(model));
  assert.ok(entries[0].type === "MODEL_CALL");
  assert.equal(entries[0].outcome, "TIMEOUT");
  assert.equal(entries[0].errorCode, "CLIENT_TIMEOUT");
});

test("a response that carries an error code is logged as an error", async () => {
  const { model, entries } = observed(async () => ({ errorCode: "SAFETY", errorMessage: "blocked" }) as LlmResponse);
  await drain(model);
  assert.ok(entries[0].type === "MODEL_CALL");
  assert.equal(entries[0].outcome, "ERROR");
  assert.equal(entries[0].errorCode, "SAFETY");
});

test("a model name is not resolved until the first call", () => {
  // Without credentials the Gemini constructor throws; building must not.
  const model = new ObservedModel("gemini-3.8-flash", { agentName: "a", timeoutMs: 60_000, sink: { record() {} } });
  assert.equal(model.model, "gemini-3.8-flash");
  assert.equal(currentRunId(), null);
});

test("every agent built by agent.ts uses an observed model with the configured deadline", () => {
  const system = buildSystem({ research: [], verification: [] });
  const agents = [
    system.rootAgent,
    system.researchAgent,
    system.verificationAgent,
    system.scriptAgent,
    system.creativeProducer,
    system.veoVideoGenerator,
    system.videoEditor,
    system.qualityControlAgent,
    system.channelManager,
    ...system.helperAgents,
  ];
  assert.equal(agents.length, 13);
  for (const agent of agents) {
    assert.ok(agent.model instanceof ObservedModel, `${agent.name} model is not observed`);
    assert.equal(agent.model.timeoutMs, DEFAULT_MODEL_TIMEOUT_MS);
  }
});

test("a pipeline run logs start and end, and tags its model calls with its runId", async () => {
  const q = quranDraft();
  const system = buildSystem({ research: [q], verification: [agreeing(q)] });
  const result = await runVerifiedScriptPipeline(system.pipeline, "daily batch");
  assert.equal(result.status, "SCRIPTS_DRAFTED");

  const runs = system.telemetry.filter((e) => e.type === "PIPELINE_RUN");
  assert.deepEqual(
    runs.map((e) => [e.pipeline, e.runId, e.phase, e.status]),
    [
      ["verified_script", result.runId, "START", undefined],
      ["verified_script", result.runId, "END", "SCRIPTS_DRAFTED"],
    ],
  );
  const calls = system.telemetry.filter((e) => e.type === "MODEL_CALL");
  assert.deepEqual(
    calls.map((e) => e.agent),
    ["islamic_research_agent", "verification_agent", "tamil_script_agent"],
  );
  assert.ok(calls.every((e) => e.runId === result.runId && e.outcome === "OK"));
});

test("a production job tags its agents' calls with the jobId", async () => {
  const q = quranDraft();
  const system = buildSystem({ research: [q], verification: [agreeing(q)] });
  const { job } = await startProduction(system.productionSystem, { request: "TEST-TOPIC" });
  const runs = system.telemetry.filter((e) => e.type === "PIPELINE_RUN");
  assert.deepEqual(
    runs.map((e) => [e.pipeline, e.phase]),
    [
      ["production", "START"],
      ["verified_script", "START"],
      ["verified_script", "END"],
      ["production", "END"],
    ],
  );
  const end = runs.at(-1);
  assert.ok(end?.type === "PIPELINE_RUN");
  assert.equal(end.status, job.status);
  const production = system.telemetry.filter((e) => e.type === "MODEL_CALL" && e.agent === "creative_producer");
  assert.equal(production.length, 1);
  assert.ok(production[0].type === "MODEL_CALL");
  assert.equal(production[0].runId, job.jobId);
});
