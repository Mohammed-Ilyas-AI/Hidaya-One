// Spike: deterministic HTML -> MP4 renderer (headless Chromium frames piped to FFmpeg).
// Usage: node render.mjs manifest.json out.mp4
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright'); // global install in CI image; pin in package.json for production
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const [manifestPath = 'manifest.json', out = 'out.mp4'] = process.argv.slice(2);
const M = JSON.parse(readFileSync(manifestPath, 'utf8'));
const here = path.dirname(fileURLToPath(import.meta.url));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: M.width, height: M.height }, deviceScaleFactor: 1 });
await page.goto('file://' + path.join(here, 'composition.html'));
await page.evaluate(m => window.setup(m), M);

// QC gate 1: every rendered string must equal the manifest string exactly (NFC, byte-equal).
const rendered = await page.evaluate(() => window.renderedTexts());
const expected = M.segments.map(s => s.text);
for (let i = 0; i < expected.length; i++) {
  if (rendered[i].normalize('NFC') !== expected[i].normalize('NFC') || rendered[i] !== expected[i]) {
    console.error(`TEXT MISMATCH in segment ${i}`); process.exit(2);
  }
}
console.log(`text QC: ${expected.length}/${expected.length} segments byte-equal`);

// QC gate 2: every glyph's font family must actually be available (no tofu fallback).
const fontsOk = await page.evaluate(() => ['Noto Naskh Arabic','Noto Sans Tamil','Noto Serif']
  .map(f => [f, document.fonts.check(`40px "${f}"`)]));
console.log('font QC:', JSON.stringify(fontsOk));
if (fontsOk.some(([, ok]) => !ok)) process.exit(3);

const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(M.fps), '-c:v', 'mjpeg', '-i', '-',
  '-f', 'lavfi', '-t', String(M.duration), '-i', 'anullsrc=r=48000:cl=stereo',   // silent bed; TTS track goes here later
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-crf', '18', '-preset', 'medium',
  '-c:a', 'aac', '-shortest', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });

const frames = Math.round(M.duration * M.fps);
const t0 = Date.now();
for (let f = 0; f < frames; f++) {
  await page.evaluate(t => window.seek(t), f / M.fps);
  const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
}
ff.stdin.end();
await new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))));
await browser.close();
console.log(`rendered ${frames} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${out}`);
