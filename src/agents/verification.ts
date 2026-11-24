// Agent 3 — Verification: deterministic checks decide; the Gemini reviewer can only add concerns.
import type { AyahRecord, Check, VerificationReport } from "../types.ts";
import { stripPauseMarks, scriptsOf, sha256 } from "../lib/util.ts";
import { runSpec } from "../brain/spec.ts";
import { contextReviewSpec } from "../brain/specs.ts";
import type { RunContext } from "./context.ts";

export function deterministicChecks(rec: AyahRecord): Check[] {
  const c: Check[] = [];
  const a = rec.arabic.text.normalize("NFC"), b = rec.arabicCrossCheck.text.normalize("NFC");
  if (a === b) c.push({ id: "arabic.two-source-exact", status: "PASS", detail: "byte-identical in both sources" });
  else if (stripPauseMarks(a) === stripPauseMarks(b))
    c.push({ id: "arabic.two-source-exact", status: "PASS", detail: "identical except Qur'anic pause (waqf) marks — display edition keeps them" });
  else c.push({ id: "arabic.two-source-exact", status: "FAIL", detail: "letters/diacritics differ between independent sources" });

  c.push(sha256(rec.arabic.text) === rec.arabic.sha256
    ? { id: "arabic.integrity", status: "PASS", detail: "sha256 unchanged since fetch" }
    : { id: "arabic.integrity", status: "FAIL", detail: "text modified after fetch" });

  const sc = scriptsOf(rec.arabic.text);
  c.push(sc.size === 1 && sc.has("ARABIC") ? { id: "arabic.script", status: "PASS", detail: "Arabic script only" }
    : { id: "arabic.script", status: "FAIL", detail: `unexpected scripts ${[...sc]}` });

  for (const t of rec.translations) {
    const want = t.lang === "ta" ? "TAMIL" : "LATIN";
    const s = scriptsOf(t.text);
    c.push(s.has(want) ? { id: `translation.${t.editionId}.script`, status: "PASS", detail: `${want} script` }
      : { id: `translation.${t.editionId}.script`, status: "FAIL", detail: `expected ${want}` });
    if (/[;,:]\./.test(t.text)) c.push({ id: `translation.${t.editionId}.typography`, status: "WARN", detail: "source contains stray punctuation (e.g. ';.') — shown verbatim; reviewer may pick another edition" });
  }
  if (!rec.recitation || rec.recitation.durationSec < 1) c.push({ id: "recitation.present", status: "FAIL", detail: "missing" });
  else c.push({ id: "recitation.present", status: "PASS", detail: `${rec.recitation.reciter}, ${rec.recitation.durationSec.toFixed(2)} s` });
  return c;
}

export async function verify(ctx: RunContext, rec: AyahRecord, topicEn = "patience (sabr)"): Promise<{ value: VerificationReport; summary: string; llm?: string }> {
  const checks = deterministicChecks(rec);
  // Context review by an ADK agent under a typed spec. It can only block (CONCERNS); it never passes anything.
  const r = await runSpec(contextReviewSpec, { sourceId: rec.sourceId, topic: topicEn, translationEn: rec.translations.find((t) => t.lang === "en")?.text ?? "" }, ctx.ledger);
  const aiReview: VerificationReport["aiReview"] =
    r.value.status === "UNAVAILABLE" ? { status: "UNAVAILABLE", notes: `${r.value.notes} (${r.reason})` } : { ...r.value, model: ctx.textModel };
  const verdict = checks.some((c) => c.status === "FAIL") || aiReview.status === "CONCERNS" ? "BLOCKED" : "VERIFIED";
  const pass = checks.filter((c) => c.status === "PASS").length;
  return {
    value: { sourceId: rec.sourceId, checks, aiReview, verdict },
    summary: `${verdict}: ${pass}/${checks.length} deterministic checks pass, ${checks.filter(c => c.status === "WARN").length} warning(s); AI review ${aiReview.status}`,
    llm: aiReview.status === "UNAVAILABLE" ? "unavailable — deterministic verdict only" : ctx.textModel,
  };
}
