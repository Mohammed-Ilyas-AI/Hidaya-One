// Agent 4 — Tamil Script: writes the editorial hook and the narration plan.
// Scripture lines are never written here: they are referenced from verified source records.
import type { AyahRecord } from "../types.ts";
import { scriptsOf } from "../lib/util.ts";
import { chat, GeminiUnavailable } from "../lib/gemini.ts";
import type { RunContext } from "./context.ts";

export interface Script { hookTa: string; hookEn: string; author: string; narrationTa: string | null }

const FALLBACK = { hookTa: "கஷ்டமான நேரத்தில் என்ன செய்வது?", hookEn: "Going through a hard time?" };

/** Editorial text must not contain Arabic (no quotes from memory), quotation marks, or exceed length. */
export function editorialOk(s: string, lang: "ta" | "en"): boolean {
  const sc = scriptsOf(s);
  if (sc.has("ARABIC") || /["“”«»]/.test(s) || s.length > 48) return false;
  return lang === "ta" ? sc.has("TAMIL") : sc.has("LATIN") && !sc.has("TAMIL");
}

export async function writeScript(ctx: RunContext, rec: AyahRecord): Promise<{ value: Script; summary: string; llm?: string }> {
  try {
    const r = await chat(ctx.textModel,
      "You write one-line hooks for 30-second Islamic reminder Shorts. Never quote or paraphrase scripture. Output JSON {\"ta\":\"...\",\"en\":\"...\"}, each under 40 characters, a gentle question.",
      `Topic: patience (sabr). The verse shown after the hook is ${rec.sourceId}.`);
    const j = JSON.parse(r.text.replace(/```json|```/g, ""));
    if (editorialOk(j.ta, "ta") && editorialOk(j.en, "en"))
      return { value: { hookTa: j.ta, hookEn: j.en, author: ctx.textModel, narrationTa: null }, summary: `hook by ${ctx.textModel}: "${j.en}"`, llm: ctx.textModel };
    return { value: { ...FALLBACK, author: "editorial-template", narrationTa: null }, summary: "model hook rejected by editorial rules → template", llm: ctx.textModel };
  } catch (e) {
    const why = e instanceof GeminiUnavailable ? `unavailable (${e.status})` : "error";
    return { value: { ...FALLBACK, author: "editorial-template", narrationTa: null }, summary: `hook from approved template: "${FALLBACK.hookEn}"`, llm: `${why} — template used` };
  }
}
