import type { AgentLog } from "../types.ts";
import { now } from "../lib/util.ts";
import { DecisionLedger, type DecisionOutcome } from "../brain/decisions.ts";

export interface RunContext {
  runId: string;
  topic: string;
  outDir: string;
  textModel: string;
  ttsModel: string;
  ttsVoice: string;
  logs: AgentLog[];
  /** Every agent step writes one Decision here (and to out/<run>/decisions.jsonl). */
  ledger: DecisionLedger;
}

/**
 * Wraps an agent step: times it, records a one-line summary for the run report, and writes a Decision.
 * `agent` is "<n> <roster id>" (e.g. "4 verifier"). A thrown error is recorded as FAILED and re-thrown.
 */
export async function step<T>(
  ctx: RunContext,
  agent: string,
  fn: () => Promise<{ value: T; summary: string; llm?: string; outcome?: DecisionOutcome }>,
): Promise<T> {
  const t0 = Date.now(); const startedAt = now();
  process.stdout.write(`▶ ${agent} … `);
  try {
    const { value, summary, llm, outcome } = await fn();
    const ms = Date.now() - t0;
    ctx.logs.push({ agent, startedAt, ms, summary, llm });
    ctx.ledger.record({ agent, outcome: outcome ?? "ACCEPTED", summary, inputHash: null, evidence: null, model: llm ?? null, ms });
    console.log(`${summary}${llm ? `  [LLM: ${llm}]` : ""} (${ms} ms)`);
    return value;
  } catch (e) {
    const ms = Date.now() - t0;
    const msg = e instanceof Error ? e.message : String(e);
    ctx.ledger.record({ agent, outcome: "FAILED", summary: msg.slice(0, 500), inputHash: null, evidence: null, model: null, ms });
    console.log(`FAILED: ${msg}`);
    throw e;
  }
}
