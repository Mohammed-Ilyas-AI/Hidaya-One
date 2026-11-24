// HIDAYAH production orchestrator (Agent 1). One verse → one finished, checked, privately-uploaded Short.
//   research → verification (gate) → script → creative (phrase plan + HyperFrames build + Adobe Stock plates)
//   → hyperframes check (gate) → render → QC (gate) → channel metadata → YouTube upload per HIDAYAH_PUBLISH_MODE
// Usage:
//   npm run produce -- --ref 2:152                 one Short
//   npm run produce -- --batch 21 --start 2026-12-01   next 21 unpublished verses, scheduled 3/day
//   npm run produce -- --daily                     autonomous daily run: fill today's remaining slots (IST);
//                                                  a verse that fails a gate is skipped and the next one takes its slot
import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { step, type RunContext } from "./agents/context.ts";
import { research } from "./agents/research.ts";
import { verify } from "./agents/verification.ts";
import { writeScript } from "./agents/script.ts";
import { mediaChecks, builtTextChecks, builtGlyphChecks, hfCheckToChecks } from "./agents/qc.ts";
import { channelManager } from "./agents/channel.ts";
import { publish, paused } from "./agents/publisher.ts";
import { planPhrases } from "./hf/timing.ts";
import { buildProject, gradeFootage, T } from "./hf/build.ts";
import { writeJson, now } from "./lib/util.ts";
import { SLOTS_IST, remainingSlotsToday } from "./lib/slots.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const HF = ["node", path.join(ROOT, ".claude/skills/hyperframes/scripts/plugin-cli.mjs"), "--cli-version", "0.9.86"];
const arg = (k: string, d = "") => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const REG = () => JSON.parse(readFileSync(path.join(ROOT, "registry/verses.json"), "utf8"));
// 3 Shorts/day, Asia/Kolkata (src/lib/slots.ts)

function hf(dir: string, args: string[], timeoutMs = 3_600_000): string {
  return execFileSync(HF[0], [...HF.slice(1), ...args], { cwd: dir, env: { ...process.env, HYPERFRAMES_TELEMETRY: "0" }, maxBuffer: 64 << 20, timeout: timeoutMs }).toString();
}
/** Two-pass loudnorm to −14 LUFS / −1.5 dBTP; video stream is copied untouched. */
export function normalizeLoudness(file: string): string {
  const pass1 = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], { encoding: "utf8" }).stderr;
  const m = JSON.parse(pass1.slice(pass1.lastIndexOf("{"), pass1.lastIndexOf("}") + 1));
  const tmp = file.replace(/\.mp4$/, ".norm.mp4");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", file, "-af",
    `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=48000`,
    "-map", "0:v", "-map", "0:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-t", String(T.DURATION), "-movflags", "+faststart", tmp]);
  renameSync(tmp, file);
  return `${m.input_i} LUFS → −14 LUFS`;
}
const firstJson = (s: string) => { const i = s.indexOf("{"); return JSON.parse(s.slice(i, s.lastIndexOf("}") + 1)); };

export async function produceOne(ref: string, publishAt?: string) {
  const reg = REG();
  const entry = reg.verses.find((v: any) => v.ref === ref);
  if (!entry) throw new Error(`${ref} not in registry`);
  const topic = reg.topics[entry.topic];
  const id = `hidayah-${entry.topic}-${ref.replace(":", "-")}`;
  const ctx: RunContext = { runId: id, topic: entry.topic, outDir: path.join(ROOT, "out", id), textModel: process.env.HIDAYA_MODEL ?? "gemini-3.8-flash",
    ttsModel: "gemini-3.8-flash-tts", ttsVoice: "kore", logs: [] };
  mkdirSync(ctx.outDir, { recursive: true });
  console.log(`\n━━ ${id} · ${now()}`);

  const rec = await step(ctx, "2 research", () => research(ctx, ref));
  writeJson(path.join(ctx.outDir, "source-record.json"), rec);
  const R = rec.recitation!.durationSec;
  if (R > 18.6) throw new Error(`recitation ${R.toFixed(1)} s is too long for a 30 s Short`);
  const ver = await step(ctx, "3 verification", () => verify(ctx, rec, `${topic.label_en.toLowerCase()} (${entry.topic})`));
  writeJson(path.join(ctx.outDir, "verification.json"), ver);
  if (ver.verdict === "BLOCKED") throw new Error(`verification BLOCKED — ${JSON.stringify(ver.checks.filter((c) => c.status === "FAIL"))} ${ver.aiReview.notes}`);
  if (entry.status === "PROPOSED" && ver.aiReview.status === "APPROVED") {   // record the review result (deterministic checks also passed)
    entry.status = "AI_APPROVED"; entry.aiReview = ver.aiReview.notes;
    writeFileSync(path.join(ROOT, "registry/verses.json"), JSON.stringify(reg, null, 2) + "\n");
  }
  const sc = await step(ctx, "4 script", () => writeScript(ctx, rec, `${topic.label_en} (${entry.topic})`));

  const project = path.join(ROOT, "studio", id);
  const built = await step(ctx, "5 creative", async () => {
    const phrases = planPhrases(rec.arabic.text, rec.translations.find((t) => t.lang === "ta")!.text, rec.translations.find((t) => t.lang === "en")!.text, rec.recitation!.localPath);
    const b = buildProject({ id, topicLabelAr: topic.label_ar, hookTa: sc.hookTa, hookEn: sc.hookEn, rec, phrases, moods: topic.moods }, project);
    gradeFootage(project, topic.moods, HF);
    writeJson(path.join(ctx.outDir, "build.json"), { ...b, phrases });
    return { value: b, summary: `${phrases.length} phrase(s) at ${phrases.map((p) => p.start).join("/")} s, reflect ${b.reflect.mode}×${b.reflect.reps}, plates ${b.footage.map((f) => f.mood).join("→")}` };
  });

  const checkJson = await step(ctx, "6a hyperframes check", async () => {
    let raw = ""; try { raw = hf(project, ["check", "--json"]); } catch (e: any) { raw = String(e.stdout ?? ""); }
    const j = firstJson(raw);
    return { value: j, summary: j.ok ? "ok" : "FAILED" };
  });
  if (!checkJson.ok) throw new Error("hyperframes check failed — see studio project");

  const final = path.join(ctx.outDir, `${id}.mp4`);
  await step(ctx, "6b render", async () => { hf(project, ["render", "--quality", "delivery", "-o", final]); return { value: final, summary: path.basename(final) }; });
  await step(ctx, "7 editor (loudness)", async () => ({ value: null, summary: normalizeLoudness(final) }));

  const qc = await step(ctx, "8 quality-control", async () => {
    const checks = [...builtTextChecks(built.onScreen, rec), ...builtGlyphChecks(ctx.outDir, built.onScreen), ...hfCheckToChecks(checkJson),
      ...mediaChecks(final, { duration: T.DURATION, recitationStart: T.HOOK })];
    return { value: checks, summary: `${checks.filter((c) => c.status === "PASS").length}/${checks.length} PASS, ${checks.filter((c) => c.status === "FAIL").length} FAIL, ${checks.filter((c) => c.status === "WARN").length} WARN` };
  });
  writeJson(path.join(ctx.outDir, "qc.json"), qc);
  const md = await step(ctx, "9 channel", () => channelManager(ctx, rec, sc, ver, qc, topic.label_en));
  writeJson(path.join(ctx.outDir, "youtube-metadata.json"), md);
  if (md.hidayah.releaseGate === "HOLD") { console.log("⚠ HOLD — QC failed, not uploading"); return { id, final, gate: "HOLD" }; }

  const pub = await step(ctx, "10 youtube", async () => {
    const r: any = await publish(id, final, md, { publishAt });
    return { value: r, summary: `${r.status}${r.videoId ? ` · https://youtu.be/${r.videoId}` : ""}${r.detail ? ` · ${r.detail}` : ""}` };
  });
  writeJson(path.join(ctx.outDir, "run-report.json"), { id, ref, finishedAt: now(), final, gate: md.hidayah.releaseGate, publish: pub, agents: ctx.logs });
  return { id, final, gate: md.hidayah.releaseGate, publish: pub };
}

/** Next N verses: AI_APPROVED/SCHOLAR_APPROVED/PROPOSED, not yet published, rotating topics. */
function nextVerses(n: number): string[] {
  const reg = REG(), pub = existsSync(path.join(ROOT, "registry/published.json")) ? JSON.parse(readFileSync(path.join(ROOT, "registry/published.json"), "utf8")) : {};
  const done = new Set(Object.keys(pub).map((k) => k.split("-").slice(-2).join(":")));
  const pool = reg.verses.filter((v: any) => v.status !== "REJECTED" && v.recitationSec <= 18.6 && !done.has(v.ref));
  const byTopic: Record<string, any[]> = {}; for (const v of pool) (byTopic[v.topic] ??= []).push(v);
  const out: string[] = []; const topics = Object.keys(byTopic);
  for (let i = 0; out.length < n && topics.some((t) => byTopic[t].length); i++) { const t = topics[i % topics.length]; const v = byTopic[t].shift(); if (v) out.push(v.ref); }
  return out;
}

function slotIso(startDate: string, i: number): string {
  const d = new Date(`${startDate}T00:00:00+05:30`); d.setUTCDate(d.getUTCDate() + Math.floor(i / SLOTS_IST.length));
  const day = d.toISOString().slice(0, 10);
  return new Date(`${day}T${SLOTS_IST[i % SLOTS_IST.length]}:00+05:30`).toISOString();
}

/**
 * Autonomous daily run: one Short per remaining slot today. A verse that fails verification, QC or rendering is
 * skipped and the next candidate takes the slot. Bounded: at most 2 candidates per slot (cost guard).
 */
async function daily() {
  if (paused()) { console.log("⏸ paused (HIDAYAH_PAUSED or registry/PAUSE) — nothing produced"); return []; }
  const slots = remainingSlotsToday();
  const candidates = nextVerses(slots.length * 2);
  const results: any[] = [];
  for (const slot of slots) {
    while (candidates.length) {
      const r = candidates.shift()!;
      try {
        const out = await produceOne(r, slot);
        results.push({ slot, ...out });
        if (out.gate !== "HOLD") break;            // slot filled
      } catch (e: any) { console.error(`✖ ${r}: ${e.message} — trying the next verse`); results.push({ slot, ref: r, error: e.message }); }
    }
  }
  return results;
}

if (import.meta.filename === path.resolve(process.argv[1] ?? "")) {
  if (process.argv.includes("--daily")) {
    const results = await daily();
    writeJson(path.join(ROOT, "out", `daily-${now().slice(0, 10)}.json`), results);
    console.log(`\ndaily done: ${results.filter((r) => r.gate === "READY_TO_PUBLISH").length} ready, ${results.filter((r) => r.error || r.gate === "HOLD").length} skipped`);
    process.exit(0);
  }
  const ref = arg("ref"), batch = Number(arg("batch", "0")), start = arg("start");
  const refs = ref ? [ref] : nextVerses(batch || 1);
  const results: any[] = [];
  for (const [i, r] of refs.entries()) {
    try { results.push(await produceOne(r, start ? slotIso(start, i) : undefined)); }
    catch (e: any) { console.error(`✖ ${r}: ${e.message}`); results.push({ ref: r, error: e.message }); }
  }
  writeJson(path.join(ROOT, "out", `batch-${now().slice(0, 16).replace(/[:T]/g, "-")}.json`), results);
  console.log(`\nbatch done: ${results.filter((r) => r.gate && r.gate !== "HOLD").length}/${results.length} ready`);
}
