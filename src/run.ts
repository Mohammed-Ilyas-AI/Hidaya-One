// Agent 1 — Orchestrator: runs the 9-agent production graph with hard gates.
//   research → verification ─(BLOCKED → stop)→ script → creative → render → narration → editor → QC ─(FAIL → HOLD)→ channel
// Usage: node --experimental-strip-types src/run.ts --topic sabr
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { step, type RunContext } from "./agents/context.ts";
import { research } from "./agents/research.ts";
import { verify } from "./agents/verification.ts";
import { writeScript } from "./agents/script.ts";
import { direct } from "./agents/creative.ts";
import { renderVisual } from "./agents/render.ts";
import { mixAndMux } from "./agents/editor.ts";
import { qualityControl } from "./agents/qc.ts";
import { channelManager } from "./agents/channel.ts";
import { speak, GeminiUnavailable } from "./lib/gemini.ts";
import { writeJson, now } from "./lib/util.ts";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const topic = arg("topic", "sabr");
const runId = `hidayah-${topic}-${new Date().toISOString().slice(0, 10)}-01`;
const ctx: RunContext = {
  runId, topic, outDir: path.resolve(arg("out", `out/${runId}`)),
  textModel: process.env.HIDAYA_MODEL ?? "gemini-3.8-flash",
  ttsModel: process.env.HIDAYA_TTS_MODEL ?? "gemini-3.8-flash-tts", ttsVoice: process.env.HIDAYA_TTS_VOICE ?? "kore",
  logs: [],
};
mkdirSync(ctx.outDir, { recursive: true });
console.log(`HIDAYAH orchestrator · run ${runId} · ${now()}`);

const rec = await step(ctx, "2 research", () => research(ctx));
writeJson(path.join(ctx.outDir, "source-record.json"), rec);
const ver = await step(ctx, "3 verification", () => verify(ctx, rec));
writeJson(path.join(ctx.outDir, "verification.json"), ver);
if (ver.verdict === "BLOCKED") { console.error("✖ verification BLOCKED — nothing is produced"); process.exit(2); }

const sc = await step(ctx, "4 tamil-script", () => writeScript(ctx, rec));
const sb = await step(ctx, "5 creative-producer", () => direct(ctx, rec, sc));
writeJson(path.join(ctx.outDir, "storyboard.json"), sb);
const r = await step(ctx, "6 video-generator", () => renderVisual(ctx, sb));

// Narration (Gemini TTS) — only text that is an exact source translation may be spoken.
const narration = await step(ctx, "4b narration (Gemini TTS)", async () => {
  const ta = rec.translations.find((t) => t.lang === "ta")!;
  try {
    const wav = await speak(ctx.ttsModel, ctx.ttsVoice, `Read calmly, exactly as written: ${ta.text}`);
    const p = path.join(ctx.outDir, "assets", "narration.wav"); writeFileSync(p, wav);
    return { value: p as string | null, summary: "Tamil translation narrated", llm: ctx.ttsModel };
  } catch (e) {
    return { value: null, summary: "skipped — video carries recitation + on-screen translation", llm: e instanceof GeminiUnavailable ? `unavailable (${e.status})` : "error" };
  }
});
const finalPath = await step(ctx, "7 video-editor", () => mixAndMux(ctx, sb, rec, r.visualPath, narration));
const qc = await step(ctx, "8 quality-control", () => qualityControl(ctx, sb, rec, r, finalPath));
writeJson(path.join(ctx.outDir, "qc.json"), qc);
const md = await step(ctx, "9 channel-manager", () => channelManager(ctx, rec, sc, ver, qc));
writeJson(path.join(ctx.outDir, "youtube-metadata.json"), md);

writeJson(path.join(ctx.outDir, "run-report.json"), { runId, topic, finishedAt: now(), output: finalPath, gate: md.hidayah.releaseGate, agents: ctx.logs });
console.log(`\n${md.hidayah.releaseGate === "HOLD" ? "⚠ HOLD" : "✔ READY_FOR_HUMAN_SIGNOFF"} → ${finalPath}`);
