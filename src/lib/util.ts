import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export const sha256 = (b: string | Buffer): string => createHash("sha256").update(b).digest("hex");
export const now = (): string => new Date().toISOString();
export function writeJson(file: string, data: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}

/** Qur'anic annotation marks that differ between editions without changing the text:
 *  small high ligatures / pause (waqf) signs U+06D6–U+06DC and U+06DE, U+06E9. */
const PAUSE_MARKS = /[ۖ-ۜ۞۩]/g;
export const stripPauseMarks = (s: string): string => s.replace(PAUSE_MARKS, "").replace(/\s+/g, " ").trim();

/** Unicode script of each letter (port of Viprasol video-studio-core qc.script_of, MIT). */
export function scriptsOf(text: string): Set<string> {
  const out = new Set<string>();
  for (const ch of text) {
    if (/\p{Script=Arabic}/u.test(ch)) out.add("ARABIC");
    else if (/\p{Script=Tamil}/u.test(ch)) out.add("TAMIL");
    else if (/\p{Script=Latin}/u.test(ch)) out.add("LATIN");
  }
  return out;
}
