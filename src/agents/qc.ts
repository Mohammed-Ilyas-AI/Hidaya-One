// Agent 8 — Quality Control. Deterministic gates (Viprasol-style: script detection, glyph coverage,
// loudness, format, black frames) plus source-integrity checks. Any FAIL → HOLD, never publish.
import { execFileSync, spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import type { AyahRecord, Check, Storyboard } from "../types.ts";
import { scriptsOf } from "../lib/util.ts";
import type { RenderResult } from "./render.ts";
import type { RunContext } from "./context.ts";

const FONT: Record<string, string> = {
  ar: "/usr/share/fonts/opentype/fonts-hosny-amiri/AmiriQuran.ttf",
  ta: "/usr/share/fonts/truetype/noto/NotoSansTamil-Regular.ttf",
  en: "/usr/share/fonts/truetype/noto/NotoSerif-Regular.ttf",
};
const WANT: Record<string, string> = { ar: "ARABIC", ta: "TAMIL", en: "LATIN" };

export function textChecks(sb: Storyboard, rec: AyahRecord, rendered: Record<string, string>): Check[] {
  const c: Check[] = [];
  const all = [rec.arabic, ...rec.translations];
  for (const s of sb.segments) {
    const shown = rendered[s.id];
    c.push(shown === s.text ? { id: `text.${s.id}.rendered-exact`, status: "PASS", detail: "DOM text byte-equal to storyboard" }
      : { id: `text.${s.id}.rendered-exact`, status: "FAIL", detail: "rendered text differs from storyboard" });
    if (s.origin.kind === "source") {
      const src = all.find((x) => x.editionId === (s.origin as any).editionId);
      const ok = src && ((s.origin as any).exact === "full" ? src.text === s.text : src.text.includes(s.text));
      c.push(ok ? { id: `text.${s.id}.matches-source`, status: "PASS", detail: `${(s.origin as any).exact} match with ${src!.editionId}` }
        : { id: `text.${s.id}.matches-source`, status: "FAIL", detail: "not found verbatim in its source edition" });
    }
    const sc = scriptsOf(s.text);
    c.push(sc.has(WANT[s.lang]) && (s.lang !== "en" || !sc.has("ARABIC"))
      ? { id: `text.${s.id}.script`, status: "PASS", detail: [...sc].join("+") }
      : { id: `text.${s.id}.script`, status: "FAIL", detail: `declared ${s.lang}, found ${[...sc].join("+")}` });
  }
  return c;
}

export function layoutChecks(r: RenderResult, sb: Storyboard): Check[] {
  // Shorts safe area: keep text clear of the border (62 px) and of the bottom UI overlay (~420 px).
  const bad = r.layout.filter((l) => {
    const seg = sb.segments.find((s) => s.id === l.id)!;
    const visible = l.t >= seg.start && l.t <= seg.end;
    return visible && (l.left < 70 || l.right > sb.width - 70 || l.top < 120 || l.bottom > sb.height - 420);
  });
  const vis = (l: any) => { const seg = sb.segments.find((s) => s.id === l.id)!; return l.t >= seg.start && l.t <= seg.end; };
  const over = r.layout.filter((l) => vis(l) && l.overflowX);
  const overlaps: string[] = [];
  for (const t of [...new Set(r.layout.map((l) => l.t))]) {
    const v = r.layout.filter((l) => l.t === t && vis(l));
    for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) {
      const a = v[i], b = v[j];
      if (a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2) overlaps.push(`${a.id}×${b.id}@${t}s`);
    }
  }
  return [
    bad.length ? { id: "layout.safe-area", status: "FAIL", detail: bad.map((b) => `${b.id}@${b.t}s`).join(", ") }
      : { id: "layout.safe-area", status: "PASS", detail: "all visible text inside Shorts safe area" },
    over.length ? { id: "layout.no-overflow", status: "FAIL", detail: over.map((b) => `${b.id}@${b.t}s`).join(", ") }
      : { id: "layout.no-overflow", status: "PASS", detail: "no text wider than its column" },
    ((tiny) => tiny.length ? { id: "layout.min-font", status: "FAIL" as const, detail: tiny.map((b: any) => `${b.id} ${b.fontPx}px`).join(", ") }
      : { id: "layout.min-font", status: "PASS" as const, detail: "all text ≥ 28 px" })(r.layout.filter((l) => vis(l) && l.fontPx < 28)),
    overlaps.length ? { id: "layout.no-overlap", status: "FAIL", detail: overlaps.join(", ") }
      : { id: "layout.no-overlap", status: "PASS", detail: "no simultaneously visible text boxes overlap" },
  ];
}

export function mediaChecks(file: string, sb: Storyboard): Check[] {
  const c: Check[] = [];
  const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", file]).toString());
  const v = probe.streams.find((s: any) => s.codec_type === "video"), a = probe.streams.find((s: any) => s.codec_type === "audio");
  const dur = Number(probe.format.duration);
  c.push(v?.width === 1080 && v?.height === 1920 ? { id: "media.resolution", status: "PASS", detail: "1080×1920 (9:16)" } : { id: "media.resolution", status: "FAIL", detail: `${v?.width}×${v?.height}` });
  c.push(v?.codec_name === "h264" && v?.pix_fmt === "yuv420p" ? { id: "media.codec", status: "PASS", detail: "H.264 yuv420p" } : { id: "media.codec", status: "FAIL", detail: `${v?.codec_name} ${v?.pix_fmt}` });
  c.push(Math.abs(dur - sb.duration) < 0.1 ? { id: "media.duration", status: "PASS", detail: `${dur.toFixed(2)} s` } : { id: "media.duration", status: "FAIL", detail: `${dur} s` });
  c.push(a?.codec_name === "aac" && Number(a?.sample_rate) === 48000 ? { id: "media.audio", status: "PASS", detail: `AAC 48 kHz ${a.channels}ch` } : { id: "media.audio", status: "FAIL", detail: "missing/wrong audio" });
  const err = spawnStderr(["-hide_banner", "-nostats", "-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"]);
  const I = Number(/I:\s+(-?[\d.]+) LUFS/.exec(err.split("Summary:").pop() ?? "")?.[1]);
  const TP = Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(err.split("Summary:").pop() ?? "")?.[1]);
  c.push(Math.abs(I + 14) <= 1.5 ? { id: "audio.loudness", status: "PASS", detail: `${I} LUFS integrated (target −14)` } : { id: "audio.loudness", status: "FAIL", detail: `${I} LUFS` });
  c.push(TP <= -1.0 ? { id: "audio.true-peak", status: "PASS", detail: `${TP} dBFS` } : { id: "audio.true-peak", status: "WARN", detail: `${TP} dBFS (> −1)` });
  const sil = spawnStderr(["-hide_banner", "-nostats", "-ss", String(sb.recitationStart + 0.5), "-t", "10", "-i", file, "-af", "silencedetect=n=-45dB:d=1.5", "-f", "null", "-"]);
  c.push(/silence_start/.test(sil) ? { id: "audio.recitation-audible", status: "FAIL", detail: "silence during recitation window" } : { id: "audio.recitation-audible", status: "PASS", detail: "recitation audible throughout" });
  const blk = spawnStderr(["-hide_banner", "-nostats", "-i", file, "-vf", "blackdetect=d=0.4:pix_th=0.06", "-an", "-f", "null", "-"]);
  c.push(/black_start/.test(blk) ? { id: "video.black-frames", status: "FAIL", detail: "black segment detected" } : { id: "video.black-frames", status: "PASS", detail: "no black segments" });
  return c;
}

function spawnStderr(args: string[]): string {
  return spawnSync("ffmpeg", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).stderr ?? "";
}

export function glyphChecks(ctx: RunContext, sb: Storyboard): Check[] {
  const items = sb.segments.map((s) => ({ id: s.id, font: FONT[s.lang], text: s.text }));
  const f = path.join(ctx.outDir, "glyph-items.json");
  writeFileSync(f, JSON.stringify(items));
  const rep = JSON.parse(execFileSync("python3", ["-I", "src/qc/glyph_coverage.py", f]).toString());
  return rep.map((r: any) => r.missing.length
    ? { id: `glyphs.${r.id}`, status: "FAIL", detail: `${r.font} missing ${r.missing.join(", ")}` }
    : { id: `glyphs.${r.id}`, status: "PASS", detail: `${r.font} covers every character` });
}

export async function qualityControl(ctx: RunContext, sb: Storyboard, rec: AyahRecord, r: RenderResult, finalPath: string) {
  const checks = [...textChecks(sb, rec, r.rendered), ...glyphChecks(ctx, sb), ...layoutChecks(r, sb), ...mediaChecks(finalPath, sb),
    { id: "ai.multimodal-review", status: "SKIPPED" as const, detail: "Gemini multimodal QC unavailable (billing) — human review required" }];
  const fails = checks.filter((c) => c.status === "FAIL");
  return { value: checks, summary: `${checks.filter((c) => c.status === "PASS").length}/${checks.length} PASS, ${fails.length} FAIL, ${checks.filter((c) => c.status === "WARN").length} WARN` };
}
