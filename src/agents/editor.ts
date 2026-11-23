// Agent 7 — Video Editor: sound design + mix + mux.
// Audio = human recitation (unaltered, no effects) over a quiet, non-musical ambient "air" bed that ducks
// under the recitation; Gemini TTS narration is mixed in when available. Loudness → −14 LUFS (YouTube).
import { execFileSync } from "node:child_process";
import path from "node:path";
import type { AyahRecord, Storyboard } from "../types.ts";
import type { RunContext } from "./context.ts";

export async function mixAndMux(ctx: RunContext, sb: Storyboard, rec: AyahRecord, visualPath: string, narrationPath: string | null) {
  const out = path.join(ctx.outDir, `${ctx.runId}.mp4`);
  const rs = sb.recitationStart, re = rs + (rec.recitation?.durationSec ?? 0), D = sb.duration;
  const inputs = ["-i", visualPath, "-i", rec.recitation!.localPath,
    "-f", "lavfi", "-t", String(D), "-i", "anoisesrc=color=brown:amplitude=0.6:seed=153:r=48000"];
  const filters = [
    // ambient bed: band-limited brown noise, slow breathing, ducked under the recitation, faded in/out
    `[2:a]highpass=f=70,lowpass=f=520,volume='0.16*(0.85+0.15*sin(2*PI*t/9))*if(between(t,${rs - 0.3},${re + 0.4}),0.4,1)':eval=frame,` +
      `afade=t=in:d=1.8,afade=t=out:st=${D - 2.2}:d=2.2,aformat=channel_layouts=stereo[amb]`,
    // recitation: untouched content, only placed in time and gently faded at the edges
    `[1:a]aresample=48000,aformat=channel_layouts=stereo,afade=t=in:d=0.08,adelay=${Math.round(rs * 1000)}|${Math.round(rs * 1000)},volume=1.0[rec]`,
  ];
  let mixInputs = "[amb][rec]", n = 2;
  if (narrationPath) {
    inputs.push("-i", narrationPath);
    filters.push(`[3:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${Math.round((re + 0.4) * 1000)}|${Math.round((re + 0.4) * 1000)}[nar]`);
    mixInputs += "[nar]"; n = 3;
  }
  filters.push(`${mixInputs}amix=inputs=${n}:duration=longest:normalize=0,apad,atrim=0:${D},loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[aout]`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...inputs, "-filter_complex", filters.join(";"),
    "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-t", String(D), "-movflags", "+faststart", out]);
  return { value: out, summary: `recitation @${rs}s + ambient bed${narrationPath ? " + narration" : ""}, loudness-normalised → ${path.basename(out)}` };
}
