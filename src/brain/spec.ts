// AgentSpec: an agent is typed data + code, not a prompt file.
// The brain (this code) decides; the LLM only produces a bounded piece of language that is schema-checked
// (Zod) and policy-checked here. Invalid output, a policy breach, a timeout or a model error means the
// code fallback is used — the model can never push an unchecked result forward.
import { BaseLlm, InMemoryRunner, LlmAgent, createRunConfig } from "@google/adk";
import type { z } from "zod";
import { hashOf, type DecisionLedger } from "./decisions.ts";

export const MODEL = process.env.HIDAYA_MODEL ?? "gemini-3.8-flash";

/** A policy returns null when the output is fine, or the reason it is not. */
export type Policy<In, Out> = (out: Out, input: In) => string | null;

export interface AgentSpec<In, Out> {
  id: string;
  /** One line: what this agent is for. */
  role: string;
  /** Model name, or a BaseLlm (tests use a mock). */
  model?: string | BaseLlm;
  input: z.ZodType<In>;
  output: z.ZodType<Out>;
  /** Fixed system instruction (bounded task, output format). Typed state goes in `prompt`. */
  instruction: string;
  /** Compiles the user message from typed input at run time. */
  prompt: (input: In) => string;
  policies: Array<Policy<In, Out>>;
  /** Used whenever the model output cannot be accepted. Must be safe on its own. */
  fallback: (input: In) => Out;
  /** ADK call cap for one run of this agent (cost bound). */
  maxLlmCalls?: number;
  timeoutMs?: number;
}

/** Builds the ADK agent for a spec: no tools, no sub-agents, no transfer. */
export function toLlmAgent<In, Out>(spec: AgentSpec<In, Out>): LlmAgent {
  return new LlmAgent({
    name: spec.id,
    model: spec.model ?? MODEL,
    description: spec.role,
    instruction: spec.instruction,
    disallowTransferToParent: true,
    disallowTransferToPeers: true,
  });
}

export function extractJson(value: string): unknown {
  const candidates = [value.trim(), ...[...value.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1].trim()).reverse()];
  for (const c of candidates) {
    try {
      return JSON.parse(c);
    } catch {
      /* next */
    }
  }
  const i = value.indexOf("{"), j = value.lastIndexOf("}");
  if (i >= 0 && j > i) {
    try {
      return JSON.parse(value.slice(i, j + 1));
    } catch {
      /* none */
    }
  }
  return undefined;
}

async function runAgentOnce(agent: LlmAgent, message: string, maxLlmCalls: number, timeoutMs: number) {
  const appName = `hidayah_${agent.name}`;
  const runner = new InMemoryRunner({ agent, appName });
  const session = await runner.sessionService.createSession({ appName, userId: "hidayah" });
  let text = "";
  let error: string | null = null;
  const run = (async () => {
    for await (const event of runner.runAsync({
      userId: "hidayah",
      sessionId: session.id,
      newMessage: { role: "user", parts: [{ text: message }] },
      runConfig: createRunConfig({ maxLlmCalls }),
    })) {
      if (event.errorCode) error = `${event.errorCode}: ${event.errorMessage ?? ""}`.trim();
      if (event.author !== agent.name || event.partial) continue;
      const t = (event.content?.parts ?? []).map((p) => p.text ?? "").join("");
      if (t.trim()) text = t;
    }
  })();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new Error(`timeout after ${timeoutMs} ms`)), timeoutMs)));
  try {
    await Promise.race([run, timeout]);
  } finally {
    clearTimeout(timer);
  }
  return { text, error };
}

export interface SpecResult<Out> {
  value: Out;
  source: "MODEL" | "FALLBACK";
  reason: string | null;
}

/**
 * Runs one spec: validate input → ADK agent → JSON → Zod → policies. Anything that does not pass uses the
 * fallback. Writes one Decision either way.
 */
export async function runSpec<In, Out>(spec: AgentSpec<In, Out>, rawInput: In, ledger: DecisionLedger, agent = toLlmAgent(spec)): Promise<SpecResult<Out>> {
  const t0 = Date.now();
  const input = spec.input.parse(rawInput);
  const modelName = typeof spec.model === "string" || spec.model === undefined ? (spec.model ?? MODEL) : spec.model.model;
  let reason: string | null = null;
  let value: Out | null = null;
  try {
    const { text, error } = await runAgentOnce(agent, spec.prompt(input), spec.maxLlmCalls ?? 2, spec.timeoutMs ?? 60_000);
    if (error) reason = `model error ${error}`;
    else {
      const parsed = spec.output.safeParse(extractJson(text));
      if (!parsed.success) reason = "output does not match the contract";
      else {
        const breach = spec.policies.map((p) => p(parsed.data, input)).find((r) => r !== null) ?? null;
        if (breach) reason = `policy: ${breach}`;
        else value = parsed.data;
      }
    }
  } catch (e) {
    reason = e instanceof Error ? e.message : String(e);
  }
  const accepted = value !== null;
  const out = accepted ? (value as Out) : spec.fallback(input);
  ledger.record({
    agent: spec.id,
    outcome: accepted ? "ACCEPTED" : "FALLBACK",
    summary: accepted ? `${spec.id}: model output accepted` : `${spec.id}: fallback used (${reason})`,
    inputHash: hashOf(input),
    evidence: { output: out },
    model: modelName,
    ms: Date.now() - t0,
  });
  return { value: out, source: accepted ? "MODEL" : "FALLBACK", reason };
}
