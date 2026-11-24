// Phrase planning for any ayah: where the Arabic is split, when each phrase is recited,
// and which exact substring of each translation goes with it. Pure functions + one ffmpeg read.
import { execFileSync } from "node:child_process";

const PAUSE = /^[ۖ-ۜ۞۩]+$/; // Qur'anic pause (waqf) marks written as their own token

export interface Phrase { ar: string; start: number; end: number; ta: string; en: string }

/** Loudness envelope (dB relative to peak) in 40 ms frames. */
export function envelope(audioPath: string, frameSec = 0.04): number[] {
  const pcm = execFileSync("ffmpeg", ["-v", "error", "-i", audioPath, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], { maxBuffer: 256 * 1024 * 1024 });
  const s = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 2));
  const w = Math.round(16000 * frameSec), env: number[] = [];
  for (let i = 0; i + w <= s.length; i += w) { let a = 0; for (let j = i; j < i + w; j++) a += s[j] * s[j]; env.push(Math.sqrt(a / w)); }
  const mx = Math.max(1, ...env);
  return env.map((e) => 20 * Math.log10(Math.max(e, 1) / mx));
}

/** Split the Arabic only at the verse's own pause (waqf) marks — the recited sense breaks. Max 3 phrases. */
export function splitArabic(arabic: string): string[][] {
  const toks = arabic.split(" ");
  const words: string[][] = [];               // each word carries any pause mark that follows it
  for (const t of toks) { if (PAUSE.test(t) && words.length) words[words.length - 1].push(t); else words.push([t]); }
  const n = words.length;
  let cuts = words.map((w, i) => (w.length > 1 && i < n - 1 ? i + 1 : -1)).filter((c) => c > 0);
  while (cuts.length > 2) {                    // keep the two cuts that make the most even phrases
    let worst = 0, best = Infinity;
    cuts.forEach((_, i) => { const rest = cuts.filter((__, j) => j !== i); const b = [0, ...rest, n];
      const spread = Math.max(...b.slice(1).map((x, j) => x - b[j])); if (spread < best) { best = spread; worst = i; } });
    cuts = cuts.filter((_, i) => i !== worst);
  }
  const out: string[][] = []; let a = 0;
  for (const c of [...cuts, n]) { out.push(words.slice(a, c).map((w) => w.join(" "))); a = c; }
  return out;
}

/** Time each phrase: expected boundary from letter share, snapped to the deepest dip within ±1.4 s. */
export function timePhrases(phrases: string[][], env: number[], frameSec = 0.04): { start: number; end: number }[] {
  const dur = env.length * frameSec;
  const lens = phrases.map((p) => p.join(" ").replace(/[ً-ٰٟۖ-ۭ\s]/g, "").length);
  const total = lens.reduce((a, b) => a + b, 0);
  const bounds: number[] = [0]; let acc = 0;
  for (let i = 0; i < phrases.length - 1; i++) {
    acc += lens[i];
    const exp = (acc / total) * dur;
    let bestT = exp, bestDb = 0;
    for (let f = Math.max(1, Math.floor((exp - 1.4) / frameSec)); f < Math.min(env.length - 1, Math.ceil((exp + 1.4) / frameSec)); f++) {
      if (env[f] < bestDb && env[f] <= env[f - 1] && env[f] <= env[f + 1] && f * frameSec > bounds.at(-1)! + 0.8) { bestDb = env[f]; bestT = f * frameSec; }
    }
    bounds.push(+bestT.toFixed(2));
  }
  bounds.push(+dur.toFixed(2));
  return phrases.map((_, i) => ({ start: bounds[i], end: bounds[i + 1] }));
}

/** Cut a published translation into k exact substrings, at punctuation nearest the Arabic proportions. */
export function splitTranslation(text: string, shares: number[]): string[] | null {
  const k = shares.length; if (k === 1) return [text.trim()];
  const strong: number[] = [], soft: number[] = [], space: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1] ?? " ";
    if (/[.!?;:]/.test(c) && /[\s.]/.test(next)) strong.push(next === "." ? i + 2 : i + 1);
    else if (c === "," && next === " ") soft.push(i + 1);
    else if (c === " ") space.push(i);
  }
  const cuts: number[] = []; let acc = 0;
  for (let j = 0; j < k - 1; j++) {
    acc += shares[j];
    const ideal = acc * text.length, prev = cuts.at(-1) ?? 0;
    const pick = (cands: number[], tol: number) => cands.filter((p) => p > prev + 3 && Math.abs(p - ideal) <= tol * text.length)
      .sort((a, b) => Math.abs(a - ideal) - Math.abs(b - ideal))[0];
    const c = pick(strong, 0.25) ?? pick(soft, 0.12);
    if (c === undefined) return null;          // no matching sense break — never cut mid-meaning
    cuts.push(c);
  }
  const parts: string[] = []; let a = 0;
  for (const c of [...cuts, text.length]) { parts.push(text.slice(a, c).trim()); a = c; }
  return parts;
}

export function planPhrases(arabic: string, ta: string, en: string, recitationPath: string): Phrase[] {
  const ar = splitArabic(arabic);
  const times = timePhrases(ar, envelope(recitationPath));
  const lens = ar.map((p) => p.join(" ").length), tot = lens.reduce((a, b) => a + b, 0);
  const shares = lens.map((l) => l / tot);
  const tas = splitTranslation(ta, shares), ens = splitTranslation(en, shares);
  if (!tas || !ens) {                          // translations don't break where the Arabic does: show the verse whole
    const dur = times.at(-1)!.end;
    return [{ ar: arabic, start: 0, end: dur, ta: ta.trim(), en: en.trim() }];
  }
  return ar.map((p, i) => ({ ar: p.join(" "), start: times[i].start, end: times[i].end, ta: tas[i], en: ens[i] }));
}
