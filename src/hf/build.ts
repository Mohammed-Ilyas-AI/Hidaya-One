// Builds a complete HyperFrames project for one Short from verified records.
// Scripture strings are only ever taken from the source record (asserted again here).
import { cpSync, linkSync, mkdirSync, readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import type { AyahRecord } from "../types.ts";
import type { Phrase } from "./timing.ts";

export const T = { HOOK: 3.2, END_START: 25.4, DURATION: 30 };
const ROOT = path.resolve(import.meta.dirname, "..", "..");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const words = (text: string, prefix: string) => text.split(" ").map((w, i) => `<span class="w" id="${prefix}-${i}">${esc(w)}</span>`).join(" ");

export interface ShortSpec {
  id: string; topicLabelAr: string; hookTa: string; hookEn: string;
  rec: AyahRecord; phrases: Phrase[]; moods: string[];
}
export interface BuiltShort { dir: string; recitationSec: number; reflect: { mode: "full" | "last-phrase"; reps: number; start: number }; footage: { mood: string; file: string; start: number; dur: number; rate: number }[]; onScreen: { id: string; text: string; source: string; exact: "full" | "substring" | "editorial" }[] }

const FONTS = `
    @font-face { font-family: "AmiriQ"; src: url("assets/fonts/AmiriQuran.ttf"); }
    @font-face { font-family: "Ruqaa"; font-weight: 700; src: url("assets/fonts/aref-ruqaa-arabic-700-normal.woff2"); }
    @font-face { font-family: "Corm"; font-weight: 500; src: url("assets/fonts/cormorant-garamond-latin-500-normal.woff2"); }
    @font-face { font-family: "Corm"; font-weight: 600; src: url("assets/fonts/cormorant-garamond-latin-600-normal.woff2"); }
    @font-face { font-family: "Corm"; font-weight: 500; font-style: italic; src: url("assets/fonts/cormorant-garamond-latin-500-italic.woff2"); }
    @font-face { font-family: "TamilSerif"; font-weight: 500; src: url("assets/fonts/noto-serif-tamil-tamil-500-normal.woff2"); }
    @font-face { font-family: "TamilSerif"; font-weight: 600; src: url("assets/fonts/noto-serif-tamil-tamil-600-normal.woff2"); }
    @font-face { font-family: "TamilSerif"; font-weight: 500; src: url("assets/fonts/noto-serif-tamil-latin-500-normal.woff2"); unicode-range: U+0000-00FF, U+2000-206F; }
    @font-face { font-family: "TamilSerif"; font-weight: 600; src: url("assets/fonts/noto-serif-tamil-latin-600-normal.woff2"); unicode-range: U+0000-00FF, U+2000-206F; }`;
const BASE = `
    #root { position: absolute; inset: 0; }
    .scrim { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(4,6,18,0) 9%, rgba(4,6,18,var(--scrim,.45)) 22%, rgba(4,6,18,var(--scrim,.45)) 56%, rgba(4,6,18,0) 68%); }
    .col { position: absolute; left: 120px; width: 660px; text-align: center; }
    .w { display: inline-block; }
    .ar { font-family: "AmiriQ"; color: #FFF6DF; text-shadow: 0 0 26px rgba(255,214,140,.45), 0 3px 14px rgba(0,0,0,.75); }
    .ta { font-family: "TamilSerif"; color: #FFFDF6; text-shadow: 0 2px 20px rgba(0,0,0,.8); }
    .en { font-family: "Corm"; font-style: italic; font-weight: 500; color: #F6EAD0; text-shadow: 0 2px 18px rgba(0,0,0,.75); }`;
// Shrink a block until its widest word fits the column and it fits its height budget (measured once, before tweens).
const FIT = `
    function fitBox(sel, maxW, maxH) {
      document.querySelectorAll(sel).forEach((el) => {
        const ws = el.querySelectorAll(".w"); let fs = parseFloat(getComputedStyle(el).fontSize);
        for (let k = 0; k < 40; k++) {
          const wide = ws.length ? Math.max(...[...ws].map((w) => w.getBoundingClientRect().width)) : el.scrollWidth;
          if (wide <= maxW && el.scrollHeight <= maxH) break; if (fs <= 30) break; fs -= 2; el.style.fontSize = fs + "px";
        }
      });
    }`;

function scene(cid: string, css: string, body: string, js: string): string {
  return `<template>
  <style>${FONTS}${BASE}
${css}
  </style>
  <div id="root" data-composition-id="${cid}" data-width="1080" data-height="1920">
    <div class="scrim" data-layout-ignore></div>
${body}
  </div>
  <script>${FIT}
${js}
  </script>
</template>
`;
}

export function buildProject(spec: ShortSpec, outDir: string): BuiltShort {
  const { rec, phrases } = spec;
  const ar = rec.arabic.text, ta = rec.translations.find((t) => t.lang === "ta")!, en = rec.translations.find((t) => t.lang === "en")!;
  // ---- provenance assertions: every phrase is an exact substring of its edition ----
  if (phrases.map((p) => p.ar).join(" ") !== ar) throw new Error("Arabic phrases do not reassemble the source verse");
  for (const p of phrases) {
    if (!ta.text.includes(p.ta)) throw new Error(`Tamil phrase not in source: ${p.ta}`);
    if (!en.text.includes(p.en)) throw new Error(`English phrase not in source: ${p.en}`);
  }
  const R = rec.recitation!.durationSec;
  const verseEnd = +(T.HOOK + R + 0.3).toFixed(2);
  const reflectDur = +(T.END_START - verseEnd).toFixed(2);
  if (reflectDur < 4) throw new Error(`recitation ${R}s too long for a 30 s Short`);
  const fullReps = Math.min(3, Math.floor((reflectDur - 0.8) / (R + 1.0)));
  const mode: "full" | "last-phrase" = fullReps >= 1 || phrases.length === 1 ? "full" : "last-phrase";
  const last = phrases.at(-1)!;
  const rf = mode === "full" ? { ar, ta: ta.text.trim(), en: en.text.trim() } : { ar: last.ar, ta: last.ta, en: last.en };

  mkdirSync(path.join(outDir, "compositions"), { recursive: true });
  cpSync(path.join(ROOT, "studio/_template"), outDir, { recursive: true });
  mkdirSync(path.join(outDir, "assets/audio"), { recursive: true });
  copyFileSync(rec.recitation!.localPath, path.join(outDir, "assets/audio/recitation.mp3"));

  // ---- footage: three mood plates, crossfaded; slowed (≥0.6×) if a plate is shorter than its slot ----
  const lib = JSON.parse(readFileSync(path.join(ROOT, "library/footage.json"), "utf8")).clips as any[];
  const a1 = +(T.HOOK + R * 0.55).toFixed(2), b1 = +(verseEnd - 0.2).toFixed(2);
  const slots = [{ start: 0, end: a1 }, { start: a1 - 0.8, end: b1 }, { start: b1 - 1.0, end: T.DURATION }];
  mkdirSync(path.join(outDir, "assets/footage"), { recursive: true });
  const footage = spec.moods.slice(0, 3).map((mood, i) => {
    const clip = lib.find((c) => c.mood === mood) ?? lib[i];
    const src = path.join(ROOT, "library/footage", clip.file);
    if (!existsSync(src)) throw new Error(`footage missing: ${clip.file} (download it into library/footage)`);
    const dst = path.join(outDir, "assets/footage", clip.file);
    if (!existsSync(dst)) { try { linkSync(src, dst); } catch { copyFileSync(src, dst); } }
    const clipDur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src]).toString());
    const need = +(slots[i].end - slots[i].start).toFixed(2);
    const rate = Math.max(0.6, Math.min(1, +(clipDur / need - 0.01).toFixed(3)));
    return { mood, file: clip.file, start: +slots[i].start.toFixed(2), dur: need, rate, grade: clip.grade };
  });

  // ---- scenes ----
  const out = path.join(outDir, "compositions");
  const hookN = spec.hookTa.split(" ").length;
  writeFileSync(path.join(out, "hook.html"), scene("hook", `
    .title { font: 700 240px/1.3 "Ruqaa"; color: #F7E3A8; text-shadow: 0 0 40px rgba(255,205,120,.55), 0 0 90px rgba(255,170,80,.25); }
    .hook-ta { font-weight: 600; font-size: 64px; line-height: 1.45; }
    .hook-en { font-size: 52px; line-height: 1.3; color: #E7E0F2; }`,
`    <div id="hook-title" class="clip col" data-start="0" data-duration="${T.HOOK}" style="top:330px"><div id="hook-title-in" class="title" dir="rtl" lang="ar">${esc(spec.topicLabelAr)}</div></div>
    <div id="hook-ta" class="clip col" data-start="0.3" data-duration="${T.HOOK - 0.3}" style="top:880px"><div class="ta hook-ta fit" lang="ta">${words(spec.hookTa, "hook-taw")}</div></div>
    <div id="hook-en" class="clip col" data-start="0.9" data-duration="${T.HOOK - 0.9}" style="top:1080px"><div id="hook-en-in" class="en hook-en" lang="en">${esc(spec.hookEn)}</div></div>`,
`    fitBox(".hook-ta", 640, 190); fitBox(".title", 640, 330);
    const tl = gsap.timeline({ paused: true });
    tl.fromTo("#hook-title-in", { opacity: 1, scale: 1.04 }, { scale: 1, duration: ${T.HOOK}, ease: "power2.inOut" }, 0);
    for (let i = 0; i < ${hookN}; i++) tl.fromTo("#hook-taw-" + i, { opacity: 0, filter: "blur(6px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.13, ease: "power4.out" }, 0.35 + i * 0.067);
    tl.fromTo("#hook-en-in", { opacity: 0, filter: "blur(8px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.2, ease: "power4.out" }, 1.05);
    tl.to(["#hook-title-in", "#hook-ta > div", "#hook-en-in"], { opacity: 0, filter: "blur(8px)", duration: 0.2, ease: "power3.in" }, ${T.HOOK - 0.22});
    window.__timelines["hook"] = tl;`));

  const vDur = +(verseEnd - T.HOOK).toFixed(2);
  const vb: string[] = [`    <div id="verse-ref" class="clip col" data-start="0.4" data-duration="${vDur - 0.4}" style="top:300px"><div id="verse-ref-in" class="ref">${esc(rec.surahNameEn.toUpperCase())}&nbsp;&nbsp;·&nbsp;&nbsp;${rec.surahNumber}:${rec.ayahNumber}</div></div>`];
  const vj: string[] = [`    tl.fromTo("#verse-ref-in", { opacity: 0, filter: "blur(6px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.5, ease: "expo.out" }, 0.4);`];
  phrases.forEach((p, k) => {
    const s = p.start, e = k < phrases.length - 1 ? phrases[k + 1].start : vDur;
    const d = +(e - s).toFixed(2), n = p.ta.split(" ").length;
    vb.push(`    <div id="v-ar${k}" class="clip col" data-start="${s}" data-duration="${d}" data-hold style="top:380px"><div id="v-ar${k}-in" class="ar verse-ar" dir="rtl" lang="ar">${words(p.ar, `v-arw${k}`)}</div></div>`);
    vb.push(`    <div id="v-tr${k}" class="clip col" data-start="${+(s + 0.35).toFixed(2)}" data-duration="${+(d - 0.35).toFixed(2)}" data-hold style="top:820px"><div class="ta verse-ta" lang="ta">${words(p.ta, `v-taw${k}`)}</div><div id="v-en${k}-in" class="en verse-en" lang="en">${words(p.en, `v-enw${k}`)}</div></div>`);
    vj.push(`    tl.fromTo("#v-ar${k}-in", { opacity: 0, filter: "blur(10px)", scale: 1.03 }, { opacity: 1, filter: "blur(0px)", scale: 1, duration: 0.45, ease: "expo.out" }, ${+(s + 0.02).toFixed(2)});`);
    vj.push(`    for (let i = 0; i < ${n}; i++) tl.fromTo("#v-taw${k}-" + i, { opacity: 0, color: "#8C8A86" }, { opacity: 1, color: "#FFFDF6", duration: 0.25, ease: "power2.out" }, ${+(s + 0.4).toFixed(2)} + i * 0.09);`);
    vj.push(`    tl.fromTo("#v-en${k}-in", { opacity: 0, filter: "blur(8px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.2, ease: "power4.out" }, ${+(s + 0.55 + n * 0.09).toFixed(2)});`);
    vj.push(`    tl.to(["#v-ar${k}-in", "#v-tr${k} > div"], { opacity: 0, filter: "blur(8px)", duration: 0.18, ease: "power3.in" }, ${+(e - 0.2).toFixed(2)});`);
  });
  writeFileSync(path.join(out, "verse.html"), scene("verse", `
    #root { --scrim: .42; }
    .ref { font: 600 28px/1 "Corm"; letter-spacing: .32em; color: #EBD9A6; text-shadow: 0 2px 12px rgba(0,0,0,.6); }
    .verse-ar { font-size: 96px; line-height: 1.85; }
    .verse-ta { font-weight: 500; font-size: 46px; line-height: 1.6; }
    .verse-en { margin-top: 22px; font-size: 46px; line-height: 1.35; }`, vb.join("\n"),
`    fitBox(".verse-ar", 640, 400); fitBox(".verse-ta", 640, 250); fitBox(".verse-en", 640, 150);
    const tl = gsap.timeline({ paused: true });
${vj.join("\n")}
    window.__timelines["verse"] = tl;`));

  const rDur = reflectDur, nar = rf.ar.split(" ").length, nta = rf.ta.split(" ").length;
  writeFileSync(path.join(out, "reflect.html"), scene("reflect", `
    #root { --scrim: .5; }
    .rf-ar { font-size: ${mode === "full" && phrases.length > 1 ? 92 : 112}px; line-height: 1.8; color: #FFF3D1; text-shadow: 0 0 34px rgba(255,200,110,.6), 0 3px 16px rgba(0,0,0,.6); }
    .rf-ta { font-weight: 600; font-size: 50px; line-height: 1.55; }
    .rf-en { margin-top: 26px; font-size: 52px; line-height: 1.3; color: #FFF6E6; }`,
`    <div id="rf-ar" class="clip col" data-start="0.3" data-duration="${+(rDur - 0.3).toFixed(2)}" data-hold style="top:400px"><div class="ar rf-ar" dir="rtl" lang="ar">${words(rf.ar, "rf-arw")}</div></div>
    <div id="rf-tr" class="clip col" data-start="1.4" data-duration="${+(rDur - 1.4).toFixed(2)}" data-hold style="top:820px"><div class="ta rf-ta" lang="ta">${words(rf.ta, "rf-taw")}</div><div id="rf-en-in" class="en rf-en" lang="en">${words(rf.en, "rf-enw")}</div></div>`,
`    fitBox(".rf-ar", 640, 380); fitBox(".rf-ta", 640, 250); fitBox(".rf-en", 640, 140);
    const tl = gsap.timeline({ paused: true });
    for (let i = 0; i < ${nar}; i++) tl.fromTo("#rf-arw-" + i, { opacity: 0, filter: "blur(6px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.35, ease: "power4.out" }, 0.35 + i * 0.12);
    for (let i = 0; i < ${nta}; i++) tl.fromTo("#rf-taw-" + i, { opacity: 0, color: "#8C8A86" }, { opacity: 1, color: "#FFFDF6", duration: 0.25, ease: "power2.out" }, 1.45 + i * 0.08);
    tl.fromTo("#rf-en-in", { opacity: 0, filter: "blur(4px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.35, ease: "expo.out" }, ${+(1.6 + nta * 0.08).toFixed(2)});
    tl.to(["#rf-ar > div", "#rf-tr > div"], { opacity: 0, filter: "blur(8px)", duration: 0.22, ease: "power3.in" }, ${+(rDur - 0.25).toFixed(2)});
    window.__timelines["reflect"] = tl;`));

  const brand = "HIDAYAH";
  writeFileSync(path.join(out, "end.html"), scene("end", `
    #root { --scrim: .42; }
    .brand { font: 600 76px/1 "Corm"; letter-spacing: .24em; padding-left: .24em; color: #FFF4D8; text-shadow: 0 0 30px rgba(255,200,120,.45); }
    .sub { font: 500 30px/1.5 "Corm"; letter-spacing: .06em; color: #F6EAD0; text-shadow: 0 2px 14px rgba(0,0,0,.6); }`,
`    <div id="end-brand" class="clip col" data-start="0.2" data-duration="4.4" data-hold style="top:600px"><div class="brand">${[...brand].map((c, i) => `<span class="w" id="end-l${i}">${c}</span>`).join("")}</div></div>
    <div id="end-sub" class="clip col" data-start="1.1" data-duration="3.5" data-hold style="top:720px"><div id="end-sub-in" class="sub">${esc(rec.surahNameEn)} ${rec.surahNumber}:${rec.ayahNumber}<br>Recitation · ${esc(rec.recitation!.reciter)}</div></div>`,
`    const tl = gsap.timeline({ paused: true });
    for (let i = 0; i < ${brand.length}; i++) tl.fromTo("#end-l" + i, { opacity: 0, filter: "blur(3px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.3, ease: "power2.out" }, 0.25 + i * 0.1);
    tl.fromTo("#end-sub-in", { opacity: 0, filter: "blur(6px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.2, ease: "power4.out" }, 1.15);
    window.__timelines["end"] = tl;`));

  // ---- root ----
  const reps = mode === "full" ? Math.max(1, fullReps) : 1;
  const repStart = +(verseEnd + 0.55).toFixed(2);
  const audio: string[] = [`      <audio id="recitation" class="clip" src="assets/audio/recitation.mp3" data-start="${T.HOOK}" data-duration="${R}" data-track-index="2" data-volume="1" data-fade-in="0.05"></audio>`];
  if (mode === "full") for (let r = 0; r < reps; r++)
    audio.push(`      <audio id="reprise${r}" class="clip" src="assets/audio/recitation.mp3" data-start="${+(repStart + r * (R + 1.0)).toFixed(2)}" data-duration="${R}" data-track-index="${3 + r}" data-volume="0.9" data-fade-in="0.05" data-fade-out="0.3"></audio>`);
  else audio.push(`      <audio id="reprise0" class="clip" src="assets/audio/recitation.mp3" data-start="${repStart}" data-media-start="${last.start}" data-duration="${+(R - last.start).toFixed(2)}" data-track-index="3" data-volume="0.9" data-fade-in="0.05" data-fade-out="0.4"></audio>`);
  const vids = footage.map((f, i) => `      <div id="bg${i}-wrap" class="bgwrap" style="z-index:${i + 1}"><video id="bg${i}" class="clip" src="assets/footage/${f.file}" muted playsinline data-start="${f.start}" data-duration="${f.dur}" data-playback-rate="${f.rate}" data-track-index="${i === 1 ? 6 : 0}"></video></div>`);
  const tw = footage.map((f, i) => i === 0
    ? `      tl.fromTo("#bg0-wrap", { scale: 1.0 }, { scale: 1.07, duration: ${f.dur}, ease: "power1.inOut" }, 0);`
    : `      tl.fromTo("#bg${i}-wrap", { scale: ${i === 1 ? 1.08 : 1.0} }, { scale: ${i === 1 ? 1.0 : 1.06}, duration: ${f.dur}, ease: "${i === 1 ? "power1.inOut" : "none"}" }, ${f.start});
      tl.fromTo("#bg${i}-wrap", { opacity: 0 }, { opacity: 1, duration: ${i === 1 ? 0.9 : 1.0}, ease: "power2.inOut", immediateRender: false }, ${f.start});`).join("\n");
  const host = (id: string, start: number, dur: number, z: number, track: number) =>
    `      <div id="${id}" data-composition-id="${id}" data-composition-src="compositions/${id}.html" data-start="${start}" data-duration="${dur}" data-track-index="${track}" data-track-kind="graphics" data-width="1080" data-height="1920" style="z-index:${z}"></div>`;
  writeFileSync(path.join(outDir, "index.html"), `<!doctype html>
<html lang="en" data-resolution="portrait">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="assets/lib/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: #02040c; }
      .bgwrap { position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; overflow: hidden; }
      .bgwrap video { position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; object-fit: cover; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${T.DURATION}" data-width="1080" data-height="1920">
${vids.join("\n")}
${host("dust", 0, T.DURATION, 5, 5)}
${host("hook", 0, T.HOOK, 7, 1)}
${host("verse", T.HOOK, vDur, 8, 1)}
${host("reflect", verseEnd, rDur, 9, 1)}
${host("end", T.END_START, +(T.DURATION - T.END_START).toFixed(2), 10, 1)}
${audio.join("\n")}
      <audio id="air" class="clip" src="assets/audio/desert-air.mp3" data-start="0" data-duration="${T.DURATION}" data-track-index="7" data-volume="0.35" data-fade-in="1.5" data-fade-out="2.5"></audio>
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
${tw}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`);
  writeFileSync(path.join(outDir, ".gitignore"), "renders/\n.hyperframes/\nnode_modules/\nassets/footage/\n");
  writeFileSync(path.join(outDir, "meta.json"), JSON.stringify({ id: spec.id, name: spec.id }, null, 2) + "\n");

  const onScreen: BuiltShort["onScreen"] = [
    { id: "hook-title", text: spec.topicLabelAr, source: "registry topic label", exact: "editorial" },
    { id: "hook-ta", text: spec.hookTa, source: "script agent", exact: "editorial" },
    { id: "hook-en", text: spec.hookEn, source: "script agent", exact: "editorial" },
    ...phrases.flatMap((p, k) => [
      { id: `v-ar${k}`, text: p.ar, source: rec.arabic.editionId, exact: "substring" as const },
      { id: `v-ta${k}`, text: p.ta, source: ta.editionId, exact: "substring" as const },
      { id: `v-en${k}`, text: p.en, source: en.editionId, exact: "substring" as const }]),
    { id: "rf-ar", text: rf.ar, source: rec.arabic.editionId, exact: mode === "full" ? "full" : "substring" },
    { id: "rf-ta", text: rf.ta, source: ta.editionId, exact: "substring" },
    { id: "rf-en", text: rf.en, source: en.editionId, exact: "substring" },
  ];
  return { dir: outDir, recitationSec: R, reflect: { mode, reps, start: verseEnd }, footage: footage.map(({ grade, ...f }) => f), onScreen };
}

/** Apply each plate's legibility grade through HyperFrames' own media-treatment (never CSS filters). */
export function gradeFootage(dir: string, moods: string[], hf: string[]): void {
  const lib = JSON.parse(readFileSync(path.join(ROOT, "library/footage.json"), "utf8")).clips as any[];
  moods.slice(0, 3).forEach((mood, i) => {
    const clip = lib.find((c) => c.mood === mood) ?? lib[i];
    const grading = { ...clip.grade, details: { vignette: 0.35, vignetteFeather: 0.8, grain: 0.08 } };
    execFileSync(hf[0], [...hf.slice(1), "media-treatment", "--selector", `#bg${i}`, "--grading", JSON.stringify(grading), "--apply", "--json"], { cwd: dir, stdio: "ignore", env: { ...process.env, HYPERFRAMES_TELEMETRY: "0" } });
  });
}
