import { BaseLlm, InMemoryRunner, type BaseAgent, type LlmRequest, type LlmResponse } from "@google/adk";
import { buildHidayaAgents } from "../../agent.ts";
import type { GateConfig } from "../verification/gate.ts";
import type { SourceRegistry } from "../verification/source-registry.ts";
import { InMemoryJobStore } from "./jobs.ts";
import type { ProducedAsset, Providers } from "./providers.ts";
import type { AuditEntry } from "./verified-script-pipeline.ts";

/**
 * Test support: scripted model responses, so workflow tests are deterministic
 * and never call Gemini.
 *
 * All evidence fixtures are synthetic placeholders, not religious content. The
 * Arabic strings say "test text for testing only"; collection, number,
 * scholar, grade and host names are obvious dummies.
 */

export type Responder = (request: LlmRequest, callIndex: number) => LlmResponse;

export class MockLlm extends BaseLlm {
  readonly requests: LlmRequest[] = [];
  private readonly responder: Responder;

  /**
   * `modelName` overrides the reported model ID. The helper agents' built-in
   * Google Search and URL Context tools refuse any model whose name is not a
   * Gemini model, so their mock reports one. It is still this class: no
   * network call is made.
   */
  constructor(name: string, responder: Responder, modelName = `mock-${name}`) {
    super({ model: modelName });
    this.responder = responder;
  }

  async *generateContentAsync(request: LlmRequest): AsyncGenerator<LlmResponse, void> {
    // Snapshot: ADK may reuse the request object.
    this.requests.push({ ...request, contents: structuredClone(request.contents) });
    yield this.responder(request, this.requests.length - 1);
  }

  async connect(): Promise<never> {
    throw new Error("MockLlm does not support live connections.");
  }

  /** Everything this model was ever shown, as one string. */
  get seenText(): string {
    return JSON.stringify(this.requests.map((r) => r.contents));
  }
}

export const text = (value: string): LlmResponse => ({ content: { role: "model", parts: [{ text: value }] } });
export const call = (name: string, args: Record<string, unknown>): LlmResponse => ({
  content: { role: "model", parts: [{ functionCall: { name, args } }] },
});
export const jsonBlock = (value: unknown) => text(`Findings below.\n\`\`\`json\n${JSON.stringify(value)}\n\`\`\``);

export function lastUserJson(request: LlmRequest): any {
  const user = [...request.contents].reverse().find((c) => c.role === "user");
  return JSON.parse((user?.parts ?? []).map((p) => p.text ?? "").join(""));
}

export const TEST_KEY = "test-only-attestation-key-0123456789abcdef";
export const TEST_REGISTRY: SourceRegistry = {
  version: "test-1",
  sources: [
    { host: "qurantext.example", roles: ["QURAN_TEXT"] },
    { host: "hadithtext.example", roles: ["HADITH_TEXT", "GRADING_EVIDENCE"] },
  ],
};
export const gateConfig = (overrides: Partial<GateConfig> = {}): GateConfig => ({
  attestationKey: TEST_KEY,
  registry: TEST_REGISTRY,
  now: () => new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

export const ARABIC = "نَصٌّ تجريبي للاختبار فقط";
export const ARABIC_NO_MARKS = "نص تجريبي للاختبار فقط";
export const ARABIC_OTHER = "نص تجريبي آخر مختلف";

export const quranDraft = (overrides: Record<string, unknown> = {}) => ({
  topicTitle: "TEST-TOPIC-QURAN",
  reference: { kind: "QURAN", surah: 1, ayahStart: 1, ayahEnd: 1 },
  arabicText: ARABIC,
  sourceUrl: "https://qurantext.example/research/1",
  gradings: [],
  ...overrides,
});

export const hadithDraft = (overrides: Record<string, unknown> = {}) => ({
  topicTitle: "TEST-TOPIC-HADITH",
  reference: { kind: "HADITH", collection: "TEST-COLLECTION", hadithNumber: "0000" },
  arabicText: ARABIC,
  sourceUrl: "https://hadithtext.example/research/0000",
  gradings: [{ grade: "TEST-GRADE", scholar: "TEST-SCHOLAR" }],
  ...overrides,
});

/** A verification record that agrees with the given research draft. */
export const agreeing = (draft: Record<string, any>, overrides: Record<string, unknown> = {}) => ({
  reference: draft.reference,
  arabicText: draft.arabicText,
  sourceUrl: String(draft.sourceUrl).replace("/research/", "/verify/"),
  gradings: draft.gradings,
  status: "VERIFIED",
  notes: "Compared wording and reference against the source page.",
  ...overrides,
});

export interface SystemOptions {
  /** What the Research Agent's model returns as candidates. */
  research: unknown[];
  /** Verification record per research index (without evidenceId), or a full custom responder. */
  verification: Array<Record<string, unknown> | null> | ((items: any[]) => unknown[]);
  gate?: Partial<GateConfig>;
  orchestrator?: Responder;
  /** Scripted replies for the five production agents, by agent name. */
  responders?: Record<string, Responder>;
  providers?: Providers;
}

export const PRODUCTION_AGENTS = [
  "creative_producer",
  "hidaya_veo_video_generator",
  "hidaya_video_editor",
  "quality_control_agent",
  "hidaya_channel_manager",
] as const;

const DEFAULT_PRODUCTION_REPLIES: Record<string, Responder> = {
  creative_producer: () => text("MOCK-CREATIVE-PLAN: three scenes, geometric motion backgrounds."),
  hidaya_veo_video_generator: () => text("MOCK-CLIP-SPECS: scene 1 emerald geometric pattern, 9:16, 8 seconds."),
  hidaya_video_editor: () => text("MOCK-EDIT-BRIEF: timeline, subtitle timings, render settings."),
  quality_control_agent: () => jsonBlock({ overall: "PASS", checks: [{ name: "religious fidelity", verdict: "PASS" }], notes: "mock" }),
  hidaya_channel_manager: () => text("MOCK-RELEASE-MANIFEST: draft title and description."),
};

/**
 * Test doubles for media and publishing. `simulated` marks what they return;
 * the default (true) can never be published. `simulated: false` exists only to
 * exercise the publish control logic and still touches no real service.
 */
export function fakeProviders(options: { simulated?: boolean } = {}) {
  const simulated = options.simulated ?? true;
  const calls = { video: 0, narration: 0, renderer: 0, publisher: 0 };
  const media = (name: "video" | "narration" | "renderer", kind: ProducedAsset["kind"]) => ({
    name: `fake-${name}`,
    connectionStatus: () => "CONNECTED" as const,
    produce: async ({ idempotencyKey }: { idempotencyKey: string }) => {
      calls[name]++;
      return { status: "PRODUCED" as const, assets: [{ kind, uri: `fake://${idempotencyKey}`, simulated }] };
    },
  });
  const providers: Providers = {
    video: media("video", "VIDEO_CLIP"),
    narration: media("narration", "NARRATION_AUDIO"),
    renderer: media("renderer", "RENDERED_VIDEO"),
    publisher: {
      name: "fake-publisher",
      connectionStatus: () => "CONNECTED",
      publish: async ({ idempotencyKey }) => {
        calls.publisher++;
        return { status: "PUBLISHED", reference: `fake-publication:${idempotencyKey}`, simulated };
      },
    },
  };
  return { providers, calls };
}

/** Builds the real 13-agent system from agent.ts with scripted models. */
export function buildSystem(options: SystemOptions) {
  const audit: AuditEntry[] = [];
  const research = new MockLlm("research", () => jsonBlock({ candidates: options.research }));
  const verification = new MockLlm("verification", (request) => {
    const items: any[] = lastUserJson(request).items;
    const records =
      typeof options.verification === "function"
        ? options.verification(items)
        : items.flatMap((item) => {
            const index = Number(String(item.evidenceId).split("-ev-")[1]) - 1;
            const record = (options.verification as Array<Record<string, unknown> | null>)[index];
            return record ? [{ evidenceId: item.evidenceId, ...record }] : [];
          });
    return jsonBlock({ records });
  });
  const script = new MockLlm("script", () => text("SCRIPT-DRAFT-FROM-MOCK"));
  const orchestrator = new MockLlm("orchestrator", options.orchestrator ?? (() => text("ORCHESTRATOR-DONE")));
  const other = new MockLlm("other", () => text("OTHER-AGENT-REPLY"), "gemini-3.8-flash");
  const production = Object.fromEntries(
    PRODUCTION_AGENTS.map((name) => [name, new MockLlm(name, options.responders?.[name] ?? DEFAULT_PRODUCTION_REPLIES[name])]),
  ) as Record<(typeof PRODUCTION_AGENTS)[number], MockLlm>;
  const models: Record<string, MockLlm> = {
    islamic_research_agent: research,
    verification_agent: verification,
    tamil_script_agent: script,
    hidaya_ai_orchestrator: orchestrator,
    ...production,
  };
  let run = 0;
  const system = buildHidayaAgents({
    modelFor: (name) => models[name] ?? other,
    getGateConfig: () => gateConfig(options.gate),
    audit: { record: (entry) => audit.push(entry) },
    createRunId: () => `run${++run}`,
    providers: options.providers,
    jobStore: new InMemoryJobStore(),
  });
  return { ...system, audit, models: { research, verification, script, orchestrator, other, ...production } };
}

/** Runs any agent as the root of a fresh runner with one user message. */
export async function runAsRoot(agent: BaseAgent, message: string) {
  const runner = new InMemoryRunner({ agent, appName: "test" });
  const session = await runner.sessionService.createSession({ appName: "test", userId: "u" });
  const events = [];
  for await (const event of runner.runAsync({
    userId: "u",
    sessionId: session.id,
    newMessage: { role: "user", parts: [{ text: message }] },
  })) {
    events.push(event);
  }
  const finalSession = await runner.sessionService.getSession({ appName: "test", userId: "u", sessionId: session.id });
  return { events, state: (finalSession?.state ?? {}) as Record<string, unknown> };
}
