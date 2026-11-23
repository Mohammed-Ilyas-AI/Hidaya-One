// Agent 5 — Creative Producer: turns verified records + script into a timed storyboard.
// Look: FavStash "Gilded Illumination" film style (Apache-2.0), adapted aniconically for Islamic art:
// lapis night sky, gold 8-point stars, vermilion/lapis border, vellum scroll — no figures.
import type { AyahRecord, Storyboard, TextSegment } from "../types.ts";
import type { Script } from "./script.ts";
import type { RunContext } from "./context.ts";

export function buildStoryboard(ctx: RunContext, rec: AyahRecord, sc: Script, duration = 30): Storyboard {
  const ar = rec.arabic, ta = rec.translations.find((t) => t.lang === "ta")!, en = rec.translations.find((t) => t.lang === "en")!;
  const recStart = 3.2, recEnd = recStart + (rec.recitation?.durationSec ?? 14);
  const transEnd = 25.4;
  // Takeaway lines are exact substrings of the verified translations (checked again in QC).
  const takeTa = ta.text.slice(ta.text.indexOf("நிச்சயமாக")).trim();
  const takeEn = en.text.slice(en.text.indexOf("Indeed")).trim();
  const src = (editionId: string, exact: "full" | "substring") => ({ kind: "source" as const, editionId, exact });
  const ed = (author: string) => ({ kind: "editorial" as const, author });
  const segs: TextSegment[] = [
    { id: "title", role: "title", lang: "ar", dir: "rtl", text: "صَبْر", start: 0.15, end: recStart, origin: ed("topic-label") },
    { id: "hook", role: "hook", lang: "ta", dir: "ltr", text: sc.hookTa, start: 0.6, end: recStart, origin: ed(sc.author) },
    { id: "hook2", role: "hook2", lang: "en", dir: "ltr", text: sc.hookEn, start: 1.0, end: recStart, origin: ed(sc.author) },
    { id: "verse", role: "verse", lang: "ar", dir: "rtl", text: ar.text, start: recStart - 0.2, end: recEnd + 0.3, origin: src(ar.editionId, "full") },
    { id: "ref", role: "ref", lang: "en", dir: "ltr", text: `Al-Baqarah ${rec.surahNumber}:${rec.ayahNumber}`, start: recStart + 0.4, end: recEnd + 0.3, origin: ed("reference-label") },
    { id: "credit", role: "credit", lang: "en", dir: "ltr", text: `Recitation: ${rec.recitation?.reciter}`, start: recStart + 0.8, end: recEnd, origin: ed("credit") },
    { id: "trans_ta", role: "trans_ta", lang: "ta", dir: "ltr", text: ta.text, start: recEnd + 0.2, end: transEnd, origin: src(ta.editionId, "full") },
    { id: "trans_en", role: "trans_en", lang: "en", dir: "ltr", text: en.text, start: recEnd + 0.9, end: transEnd, origin: src(en.editionId, "full") },
    { id: "take_ta", role: "take_ta", lang: "ta", dir: "ltr", text: takeTa, start: transEnd + 0.2, end: duration, origin: src(ta.editionId, "substring") },
    { id: "take_en", role: "take_en", lang: "en", dir: "ltr", text: takeEn, start: transEnd + 0.7, end: duration, origin: src(en.editionId, "substring") },
    { id: "brand", role: "brand", lang: "en", dir: "ltr", text: "HIDAYAH", start: transEnd + 1.3, end: duration, origin: ed("brand") },
  ];
  return {
    id: ctx.runId, topic: ctx.topic, width: 1080, height: 1920, fps: 30, duration,
    style: "gilded-illumination (FavStash, adapted aniconic)",
    segments: segs,
    // Darkness of hardship lifting as the verse is recited — light fully returns on "Allah is with the patient".
    light: [{ t: 0, night: 0.62 }, { t: recStart, night: 0.55 }, { t: recEnd, night: 0.3 }, { t: transEnd, night: 0.12 }, { t: duration, night: 0 }],
    recitationStart: recStart,
  };
}

export async function direct(ctx: RunContext, rec: AyahRecord, sc: Script) {
  const sb = buildStoryboard(ctx, rec, sc);
  return { value: sb, summary: `${sb.segments.length} text layers, ${sb.duration}s ${sb.width}×${sb.height}, look: ${sb.style}` };
}
