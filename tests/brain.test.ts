// The agent kernel: typed specs on ADK agents, schema + policy checks, code fallback, decision ledger.
// Offline: a mock model stands in for Gemini.
import { test } from "node:test";
import assert from "node:assert/strict";
import { BaseLlm, type LlmRequest, type LlmResponse } from "@google/adk";
import { DecisionLedger } from "../src/brain/decisions.ts";
import { runSpec } from "../src/brain/spec.ts";
import { HOOK_TEMPLATE, contextReviewSpec, scriptSpec } from "../src/brain/specs.ts";
import { ROSTER } from "../src/brain/roster.ts";
import { step, type RunContext } from "../src/agents/context.ts";

class MockLlm extends BaseLlm {
  readonly requests: LlmRequest[] = [];
  private readonly reply: () => LlmResponse;
  constructor(reply: () => LlmResponse) {
    super({ model: "mock-gemini" });
    this.reply = reply;
  }
  async *generateContentAsync(request: LlmRequest): AsyncGenerator<LlmResponse, void> {
    this.requests.push(request);
    yield this.reply();
  }
  async connect(): Promise<never> {
    throw new Error("no live connection");
  }
}
const text = (t: string): LlmResponse => ({ content: { role: "model", parts: [{ text: t }] } });
const scriptIn = { topic: "patience", sourceId: "quran:2:153", meaningEn: "TEST-MEANING", recentHooks: ["Is your patience fading?"] };

test("scriptwriter: a valid model hook is accepted and recorded", async () => {
  const ledger = new DecisionLedger("t", null);
  const model = new MockLlm(() => text('```json\n{"ta":"பொறுமை தளர்கிறதா?","en":"Feeling tired of waiting?"}\n```'));
  const r = await runSpec({ ...scriptSpec, model }, scriptIn, ledger);
  assert.equal(r.source, "MODEL");
  assert.deepEqual(r.value, { ta: "பொறுமை தளர்கிறதா?", en: "Feeling tired of waiting?" });
  assert.equal(ledger.decisions[0].outcome, "ACCEPTED");
  assert.equal(ledger.decisions[0].agent, "scriptwriter");
  assert.match(ledger.decisions[0].inputHash!, /^[0-9a-f]{64}$/);
  // The model saw typed state, compiled by code.
  assert.match(JSON.stringify(model.requests[0].contents), /quran:2:153/);
});

test("scriptwriter: bad JSON, an editorial breach, a repeat or a model error all fall back to the template", async () => {
  for (const reply of [
    () => text("not json"),
    () => text('{"ta":"பொறுமை","en":"Remember إِنَّ"}'), // Arabic from a model is never allowed
    () => text('{"ta":"பொறுமை தளர்கிறதா?","en":"Is your patience fading?"}'), // repeats a recent hook
    () => text('{"ta":"x"}'), // contract
    () => {
      throw new Error("model down");
    },
  ]) {
    const ledger = new DecisionLedger("t", null);
    const r = await runSpec({ ...scriptSpec, model: new MockLlm(reply) }, scriptIn, ledger);
    assert.equal(r.source, "FALLBACK");
    assert.deepEqual(r.value, HOOK_TEMPLATE);
    assert.equal(ledger.decisions[0].outcome, "FALLBACK");
  }
});

test("verifier context review: CONCERNS can block; Arabic in notes or no answer never approves", async () => {
  const input = { sourceId: "quran:2:153", topic: "patience", translationEn: "TEST" };
  const concerns = await runSpec({ ...contextReviewSpec, model: new MockLlm(() => text('{"status":"CONCERNS","notes":"TEST"}')) }, input, new DecisionLedger("t", null));
  assert.equal(concerns.value.status, "CONCERNS");
  for (const reply of [() => text('{"status":"APPROVED","notes":"قال"}'), () => text("APPROVED")]) {
    const r = await runSpec({ ...contextReviewSpec, model: new MockLlm(reply) }, input, new DecisionLedger("t", null));
    assert.equal(r.value.status, "UNAVAILABLE", "never APPROVED without a clean, valid answer");
  }
});

test("input outside the contract is refused before any model call", async () => {
  const model = new MockLlm(() => text("{}"));
  await assert.rejects(runSpec({ ...scriptSpec, model }, { ...scriptIn, sourceId: "not-a-verse" }, new DecisionLedger("t", null)));
  assert.equal(model.requests.length, 0);
});

test("roster: nine agents with unique ids; only three have a bounded LLM task", () => {
  assert.equal(ROSTER.length, 9);
  assert.equal(new Set(ROSTER.map((a) => a.id)).size, 9);
  assert.deepEqual(ROSTER.map((a) => a.n), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(ROSTER.filter((a) => a.llm).map((a) => a.id), ["researcher", "verifier", "scriptwriter"]);
});

test("every orchestrated step writes a decision; a failure is recorded as FAILED", async () => {
  const ctx = { runId: "t", topic: "x", outDir: "x", textModel: "x", ttsModel: "x", ttsVoice: "x", logs: [], ledger: new DecisionLedger("t", null) } as RunContext;
  await step(ctx, "6 creative", async () => ({ value: 1, summary: "ok" }));
  await assert.rejects(step(ctx, "7 producer · render", async () => { throw new Error("TEST-RENDER-FAIL"); }));
  assert.deepEqual(ctx.ledger.decisions.map((d) => [d.agent, d.outcome]), [["6 creative", "ACCEPTED"], ["7 producer · render", "FAILED"]]);
});
