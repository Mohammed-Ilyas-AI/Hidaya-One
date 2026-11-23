// Agent 2 — Islamic Research: picks an APPROVED ayah for the topic and fetches canonical text,
// translations and a human recitation from named sources. Gemini may only *suggest* (logged).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type { AyahRecord, SourceText, Lang } from "../types.ts";
import { sha256, now } from "../lib/util.ts";
import { chat, GeminiUnavailable } from "../lib/gemini.ts";
import type { RunContext } from "./context.ts";

const ALQURAN = "https://api.alquran.cloud/v1";
const TANZIL = "https://tanzil.net/pub/download/index.php?quranType=uthmani&outType=txt-2&agree=true";

async function getJson(url: string): Promise<any> {
  const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
}

export async function research(ctx: RunContext): Promise<{ value: AyahRecord; summary: string; llm?: string }> {
  const topics = JSON.parse(readFileSync("registry/topics.json", "utf8"));
  const approved = (topics[ctx.topic] ?? []).filter((e: any) => e.status === "APPROVED");
  if (!approved.length) throw new Error(`no APPROVED ayah for topic "${ctx.topic}"`);
  const ref: string = approved[0].ref;
  const [s, a] = ref.split(":").map(Number);

  // Live Gemini call: ask for additional candidate ayat (suggestions only, never used as text).
  let llm = "";
  try {
    const r = await chat(ctx.textModel, "You suggest Qur'an references only (surah:ayah), no quotations.",
      `Topic: ${ctx.topic}. List 3 ayah references about this topic, one per line, format surah:ayah.`);
    writeFileSync(path.join(ctx.outDir, "research-suggestions.txt"), r.text);
    llm = `${ctx.textModel} suggested candidates (saved for reviewer)`;
  } catch (e) {
    llm = e instanceof GeminiUnavailable ? `unavailable (${e.status}) — used curated registry` : `error — used curated registry`;
  }

  const editions = "quran-uthmani,ta.tamil,en.sahih";
  const d = (await getJson(`${ALQURAN}/ayah/${ref}/editions/${editions}`)).data as any[];
  const mk = (e: any, lang: Lang): SourceText => ({
    editionId: e.edition.identifier, editionName: e.edition.englishName, provider: "api.alquran.cloud",
    lang, text: e.text, sha256: sha256(e.text), fetchedAt: now(),
  });
  const arabic = mk(d[0], "ar");

  const tanzil = await (await fetch(TANZIL, { signal: AbortSignal.timeout(30000) })).text();
  const line = tanzil.split("\n").find((l) => l.startsWith(`${s}|${a}|`));
  if (!line) throw new Error(`Tanzil has no ${ref}`);
  const tz = line.split("|")[2];
  const arabicCrossCheck: SourceText = { editionId: "tanzil-uthmani", editionName: "Tanzil Uthmani", provider: "tanzil.net",
    lang: "ar", text: tz, sha256: sha256(tz), fetchedAt: now() };

  // Human recitation (EveryAyah, Mishary Rashid Alafasy 128 kbps).
  const url = `https://everyayah.com/data/Alafasy_128kbps/${String(s).padStart(3, "0")}${String(a).padStart(3, "0")}.mp3`;
  const buf = Buffer.from(await (await fetch(url, { signal: AbortSignal.timeout(60000) })).arrayBuffer());
  mkdirSync(path.join(ctx.outDir, "assets"), { recursive: true });
  const localPath = path.join(ctx.outDir, "assets", "recitation.mp3");
  writeFileSync(localPath, buf);
  const durationSec = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", localPath]).toString());

  const rec: AyahRecord = {
    sourceId: `quran:${ref}`, surahNumber: s, ayahNumber: a, surahNameEn: d[0].surah.englishName,
    arabic, arabicCrossCheck, translations: [mk(d[1], "ta"), mk(d[2], "en")],
    recitation: { reciter: "Mishary Rashid Alafasy", url, localPath, durationSec, sha256: sha256(buf) },
    license: [
      "Qur'an text: Tanzil Project (CC BY 3.0, verbatim only) — credit tanzil.net",
      "Translations via alquran.cloud: Jan Turst Foundation (ta), Saheeh International (en) — permission for commercial/monetized use NOT yet confirmed",
      "Recitation: Mishary Rashid Alafasy via everyayah.com — usage permission NOT yet confirmed",
    ],
  };
  return { value: rec, summary: `${rec.sourceId} (${rec.surahNameEn}) + 2 translations + recitation ${durationSec.toFixed(2)} s`, llm };
}
