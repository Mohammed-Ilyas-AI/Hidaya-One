// Agent 4 — Tamil Script: writes the editorial hook and the narration plan.
// Scripture lines are never written here: they are referenced from verified source records.
import type { AyahRecord } from "../types.ts";
import type { RunContext } from "./context.ts";
import { runSpec } from "../brain/spec.ts";
import { scriptSpec, editorialOk as editorialRule, HOOK_TEMPLATE } from "../brain/specs.ts";

export interface Script { hookTa: string; hookEn: string; author: string; narrationTa: string | null }

/** Editorial text must not contain Arabic (no quotes from memory), quotation marks, or exceed length. */
export const editorialOk = editorialRule;

/** Agent 5 · Scriptwriter: an ADK agent writes the hook under the typed spec; code checks it or uses the template. */
export async function writeScript(ctx: RunContext, rec: AyahRecord, topicEn = "patience (sabr)", recentHooks: string[] = []): Promise<{ value: Script; summary: string; llm?: string }> {
  const r = await runSpec(
    scriptSpec,
    { topic: topicEn, sourceId: rec.sourceId, meaningEn: rec.translations.find((t) => t.lang === "en")?.text ?? "", recentHooks },
    ctx.ledger,
  );
  const value = { hookTa: r.value.ta, hookEn: r.value.en, author: r.source === "MODEL" ? ctx.textModel : "editorial-template", narrationTa: null };
  return r.source === "MODEL"
    ? { value, summary: `hook by ${ctx.textModel}: "${r.value.en}"`, llm: ctx.textModel }
    : { value, summary: `hook from approved template: "${HOOK_TEMPLATE.en}" (${r.reason})`, llm: `${ctx.textModel} — template used` };
}
