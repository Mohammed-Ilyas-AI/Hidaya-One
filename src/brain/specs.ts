// The bounded LLM tasks of the nine agents, as typed specs. Only these touch a model.
import { z } from "zod";
import type { AgentSpec } from "./spec.ts";
import { scriptsOf } from "../lib/util.ts";

const HAS_ARABIC = /\p{Script=Arabic}/u;

// ── Agent 5 · Scriptwriter: the Tamil and English hook ─────────────────────
export const ScriptIn = z.object({
  topic: z.string().min(2),
  sourceId: z.string().regex(/^quran:\d+:\d+$/),
  meaningEn: z.string().min(1),
  recentHooks: z.array(z.string()).default([]),
});
export const ScriptOut = z.object({ ta: z.string().min(2).max(48), en: z.string().min(2).max(48) });
export type ScriptInT = z.infer<typeof ScriptIn>;
export type ScriptOutT = z.infer<typeof ScriptOut>;

/** Editorial text: no Arabic (no quoting from memory), no quotation marks, right script, short. */
export function editorialOk(s: string, lang: "ta" | "en"): boolean {
  const sc = scriptsOf(s);
  if (sc.has("ARABIC") || /["“”«»]/.test(s) || s.length > 48) return false;
  return lang === "ta" ? sc.has("TAMIL") : sc.has("LATIN") && !sc.has("TAMIL");
}

export const HOOK_TEMPLATE = { ta: "இன்றைய நினைவூட்டல்", en: "Today's reminder" };

export const scriptSpec: AgentSpec<ScriptInT, ScriptOutT> = {
  id: "scriptwriter",
  role: "Writes the one-line Tamil and English hook for a Short; never quotes or paraphrases scripture.",
  input: ScriptIn,
  output: ScriptOut,
  instruction:
    "You write one-line hooks for 30-second Islamic reminder Shorts. Never quote or paraphrase scripture, never write Arabic, " +
    'no quotation marks. Reply with JSON only: {"ta": "<Tamil, under 40 characters>", "en": "<English, under 40 characters>"}, ' +
    "each a gentle question.",
  prompt: (s) =>
    JSON.stringify({
      topic: s.topic,
      verse: s.sourceId,
      meaningEnglish: s.meaningEn,
      avoidRepeating: s.recentHooks,
      task: "Write a hook that makes a viewer want to hear the verse, without quoting it.",
    }),
  policies: [
    (o) => (editorialOk(o.ta, "ta") ? null : "Tamil hook breaks the editorial rules"),
    (o) => (editorialOk(o.en, "en") ? null : "English hook breaks the editorial rules"),
    (o, s) => (s.recentHooks.some((h) => h.trim() === o.en.trim() || h.trim() === o.ta.trim()) ? "repeats a recent hook" : null),
  ],
  fallback: () => HOOK_TEMPLATE,
  maxLlmCalls: 2,
  timeoutMs: 60_000,
};

// ── Agent 4 · Verifier: context review (can only block, never approve alone) ─
export const ContextIn = z.object({
  sourceId: z.string().regex(/^quran:\d+:\d+$/),
  topic: z.string().min(2),
  translationEn: z.string().min(1),
});
export const ContextOut = z.object({ status: z.enum(["APPROVED", "CONCERNS"]), notes: z.string().max(2000) });
export type ContextInT = z.infer<typeof ContextIn>;
export type ContextOutT = z.infer<typeof ContextOut> | { status: "UNAVAILABLE"; notes: string };

export const contextReviewSpec: AgentSpec<ContextInT, ContextOutT> = {
  id: "verifier_context_review",
  role: "Judges whether a verse fits a topic for a 30-second reminder; its CONCERNS blocks, its APPROVED never passes anything alone.",
  input: ContextIn,
  output: ContextOut as z.ZodType<ContextOutT>,
  instruction:
    "You are a careful Islamic studies reviewer. Do not quote scripture from memory and do not write Arabic. " +
    'Reply with JSON only: {"status": "APPROVED" | "CONCERNS", "notes": "..."}. When unsure, answer CONCERNS.',
  prompt: (s) =>
    JSON.stringify({
      question: `Is it appropriate and in context to present Qur'an ${s.sourceId} as a general reminder about ${s.topic} in a 30-second video, quoting the full verse with this translation?`,
      translationEnglish: s.translationEn,
    }),
  policies: [(o) => (HAS_ARABIC.test(o.notes) ? "notes contain Arabic (model text is never scripture)" : null)],
  // The model is down or broke its contract: the deterministic checks still decide; nothing is approved by this.
  fallback: () => ({ status: "UNAVAILABLE", notes: "context review unavailable; deterministic checks decide" }),
  maxLlmCalls: 2,
  timeoutMs: 60_000,
};
