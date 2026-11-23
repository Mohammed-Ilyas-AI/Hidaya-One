import type { AgentLog } from "../types.ts";
import { now } from "../lib/util.ts";

export interface RunContext {
  runId: string;
  topic: string;
  outDir: string;
  textModel: string;
  ttsModel: string;
  ttsVoice: string;
  logs: AgentLog[];
}

/** Wraps an agent step: times it and records a one-line summary for the run report. */
export async function step<T>(ctx: RunContext, agent: string, fn: () => Promise<{ value: T; summary: string; llm?: string }>): Promise<T> {
  const t0 = Date.now(); const startedAt = now();
  process.stdout.write(`▶ ${agent} … `);
  const { value, summary, llm } = await fn();
  const ms = Date.now() - t0;
  ctx.logs.push({ agent, startedAt, ms, summary, llm });
  console.log(`${summary}${llm ? `  [LLM: ${llm}]` : ""} (${ms} ms)`);
  return value;
}
