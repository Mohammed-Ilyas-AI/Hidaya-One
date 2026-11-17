import { AsyncLocalStorage } from "node:async_hooks";
import { BaseLlm, LLMRegistry, type BaseLlmConnection, type LlmRequest, type LlmResponse } from "@google/adk";

/**
 * Model-call bounds and telemetry.
 *
 * The Gemini SDK sets no client-side timeout, so one stalled call can hold a
 * run until the server gives up (10 minutes for a unary request). On
 * 2026-11-16 exactly that turned a ~210 s run into 808 s. Every agent's model
 * is wrapped in an `ObservedModel`, which puts a per-attempt deadline on the
 * request and writes one log line per call: agent, run, latency, tokens and
 * outcome. ADK turns model errors into error events rather than exceptions,
 * so without this line a failed call leaves no trace.
 *
 * Nothing here retries. A call that times out fails, and the workflow's
 * fail-closed rules decide what happens next.
 */

export const DEFAULT_MODEL_TIMEOUT_MS = 180_000;
export const MIN_MODEL_TIMEOUT_MS = 10_000;
/** Above this the server's own 10-minute bound applies first. */
export const MAX_MODEL_TIMEOUT_MS = 600_000;

/** Reads HIDAYA_MODEL_TIMEOUT_MS. Missing → default; invalid or out of range → error. */
export function modelTimeoutFromEnv(value: string | undefined = process.env.HIDAYA_MODEL_TIMEOUT_MS): number {
  if (value === undefined || value.trim() === "") return DEFAULT_MODEL_TIMEOUT_MS;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < MIN_MODEL_TIMEOUT_MS || parsed > MAX_MODEL_TIMEOUT_MS) {
    throw new Error(
      `HIDAYA_MODEL_TIMEOUT_MS must be an integer between ${MIN_MODEL_TIMEOUT_MS} and ${MAX_MODEL_TIMEOUT_MS}; got "${value}".`,
    );
  }
  return parsed;
}

export type ModelCallOutcome = "OK" | "ERROR" | "TIMEOUT" | "CANCELLED";

export interface TokenUsage {
  promptTokens: number | null;
  outputTokens: number | null;
  thoughtsTokens: number | null;
  toolUsePromptTokens: number | null;
  totalTokens: number | null;
}

export type TelemetryEntry =
  | {
      type: "MODEL_CALL";
      agent: string;
      model: string;
      runId: string | null;
      outcome: ModelCallOutcome;
      latencyMs: number;
      timeoutMs: number;
      usage: TokenUsage | null;
      errorCode?: string;
      errorMessage?: string;
    }
  | {
      type: "PIPELINE_RUN";
      pipeline: "verified_script" | "production";
      runId: string;
      phase: "START" | "END";
      status?: string;
      durationMs?: number;
      error?: string;
    };

export interface TelemetrySink {
  record(entry: TelemetryEntry): void;
}

/** One JSON line per entry on stdout (picked up by Cloud Logging). No prompts, outputs or secrets. */
export const consoleTelemetrySink: TelemetrySink = {
  record(entry) {
    const failed =
      (entry.type === "MODEL_CALL" && entry.outcome !== "OK") ||
      (entry.type === "PIPELINE_RUN" && (entry.status === "ERROR" || entry.error !== undefined));
    console.log(JSON.stringify({ severity: failed ? "WARNING" : "INFO", message: "hidaya_telemetry", ...entry }));
  },
};

// ── Run context ──────────────────────────────────────────────────────────

const runContext = new AsyncLocalStorage<{ runId: string }>();

/** Runs `fn` with `runId` attached to every model call it makes. */
export function withRunId<T>(runId: string, fn: () => Promise<T>): Promise<T> {
  return runContext.run({ runId }, fn);
}

export function currentRunId(): string | null {
  return runContext.getStore()?.runId ?? null;
}

// ── Observed model ───────────────────────────────────────────────────────

const MAX_ERROR_MESSAGE = 300;

function usageOf(response: LlmResponse): TokenUsage | null {
  const u = response.usageMetadata;
  if (!u) return null;
  return {
    promptTokens: u.promptTokenCount ?? null,
    outputTokens: u.candidatesTokenCount ?? null,
    thoughtsTokens: u.thoughtsTokenCount ?? null,
    toolUsePromptTokens: u.toolUsePromptTokenCount ?? null,
    totalTokens: u.totalTokenCount ?? null,
  };
}

function trimMessage(message: string): string {
  return message.length > MAX_ERROR_MESSAGE ? `${message.slice(0, MAX_ERROR_MESSAGE)}…` : message;
}

export interface ObservedModelOptions {
  agentName: string;
  timeoutMs: number;
  sink: TelemetrySink;
  /** Clock for latency; tests replace it. */
  now?: () => number;
}

export class ObservedModel extends BaseLlm {
  private resolved: BaseLlm | null;
  private readonly modelName: string;
  private readonly options: ObservedModelOptions;

  /**
   * `inner` may be a model name. It is resolved on the first call, not here:
   * the Gemini constructor throws when credentials are absent, and the module
   * builds the default agents at import time.
   */
  constructor(inner: string | BaseLlm, options: ObservedModelOptions) {
    const name = typeof inner === "string" ? inner : inner.model;
    super({ model: name });
    this.modelName = name;
    this.resolved = typeof inner === "string" ? null : inner;
    this.options = options;
  }

  get inner(): BaseLlm {
    this.resolved ??= LLMRegistry.newLlm(this.modelName);
    return this.resolved;
  }

  get timeoutMs(): number {
    return this.options.timeoutMs;
  }

  async *generateContentAsync(llmRequest: LlmRequest, stream = false, abortSignal?: AbortSignal): AsyncGenerator<LlmResponse, void> {
    const { agentName, timeoutMs, sink } = this.options;
    const now = this.options.now ?? Date.now;
    llmRequest.config ??= {};
    llmRequest.config.httpOptions = { ...llmRequest.config.httpOptions, timeout: timeoutMs };

    const runId = currentRunId();
    const startedAt = now();
    let usage: TokenUsage | null = null;
    let responseError: { code: string; message?: string } | null = null;
    const base = { type: "MODEL_CALL" as const, agent: agentName, model: this.modelName, runId, timeoutMs };

    try {
      for await (const response of this.inner.generateContentAsync(llmRequest, stream, abortSignal)) {
        usage = usageOf(response) ?? usage;
        if (response.errorCode) responseError = { code: String(response.errorCode), message: response.errorMessage };
        yield response;
      }
    } catch (cause) {
      const latencyMs = now() - startedAt;
      const error = cause instanceof Error ? cause : new Error(String(cause));
      const aborted = error.name === "AbortError" || error.name === "TimeoutError";
      const outcome: ModelCallOutcome = abortSignal?.aborted ? "CANCELLED" : aborted || latencyMs >= timeoutMs ? "TIMEOUT" : "ERROR";
      const status = (cause as { status?: unknown })?.status;
      sink.record({
        ...base,
        outcome,
        latencyMs,
        usage,
        errorCode: outcome === "TIMEOUT" ? "CLIENT_TIMEOUT" : status !== undefined ? String(status) : error.name,
        errorMessage: trimMessage(error.message),
      });
      throw cause;
    }

    sink.record({
      ...base,
      outcome: responseError ? "ERROR" : "OK",
      latencyMs: now() - startedAt,
      usage,
      ...(responseError
        ? { errorCode: responseError.code, ...(responseError.message ? { errorMessage: trimMessage(responseError.message) } : {}) }
        : {}),
    });
  }

  connect(llmRequest: LlmRequest): Promise<BaseLlmConnection> {
    return this.inner.connect(llmRequest);
  }
}
