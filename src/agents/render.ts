// Agent 6 — Video Generator: renders the storyboard with the deterministic HTML engine
// (HyperFrames-style: headless Chromium frames → FFmpeg). Paid video models (Veo/Omni) are off.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Storyboard } from "../types.ts";
import type { RunContext } from "./context.ts";

const { chromium } = createRequire(import.meta.url)("playwright");
const COMPOSITION = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "composition", "gilded.html");

export interface RenderResult { visualPath: string; rendered: Record<string, string>; layout: any[]; frames: number }

export async function renderVisual(ctx: RunContext, sb: Storyboard) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: sb.width, height: sb.height }, deviceScaleFactor: 1 });
  await page.goto("file://" + COMPOSITION);
  await page.evaluate((s: Storyboard) => (window as any).setup(s), sb);
  const rendered = await page.evaluate(() => (window as any).renderedTexts());
  const out = path.join(ctx.outDir, "visual.mp4");
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(sb.fps), "-c:v", "mjpeg", "-i", "-",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-profile:v", "high", "-crf", "17", "-preset", "medium", out], { stdio: ["pipe", "inherit", "inherit"] });
  const frames = Math.round(sb.duration * sb.fps);
  let layout: any[] = [];
  for (let f = 0; f < frames; f++) {
    const t = f / sb.fps;
    await page.evaluate((tt: number) => (window as any).seek(tt), t);
    if ([2, 10, 17, 21, 24, 28.5].some((x) => Math.abs(t - x) < 1e-6))
      layout = layout.concat((await page.evaluate(() => (window as any).layoutReport())).map((l: any) => ({ ...l, t })));
    const buf = await page.screenshot({ type: "jpeg", quality: 93 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  }
  ff.stdin.end();
  await new Promise<void>((res, rej) => ff.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exit ${c}`)))));
  await browser.close();
  return { value: { visualPath: out, rendered, layout, frames } as RenderResult, summary: `${frames} frames rendered → visual.mp4 (no paid video API)` };
}
