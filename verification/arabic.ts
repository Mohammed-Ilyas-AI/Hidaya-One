/**
 * Arabic text comparison for the verification gate.
 *
 * Policy (Milestone 2): two texts that differ only in diacritics are never
 * passed automatically and never treated as a wording mismatch; they go to
 * human review with the exact difference recorded. Any difference in a base
 * character is a wording mismatch.
 *
 * "Diacritic" here means a Unicode nonspacing mark (general category Mn):
 * harakat, shadda, sukun, superscript alef, Quranic annotation marks. Letters
 * that merely look related are different base characters and count as a
 * wording difference — for example alef (U+0627) versus alef wasla (U+0671),
 * so comparing an Uthmani-script edition with a simple-script edition is
 * reported as a mismatch, not as a diacritics-only difference.
 */

const TATWEEL = /ـ/g;
const MARK = /^\p{Mn}$/u;

/** NFC, tatweel removed, whitespace collapsed. Diacritics are kept. */
export function normalizeArabic(value: string): string {
  return value.normalize("NFC").replace(TATWEEL, "").replace(/\s+/g, " ").trim();
}

export interface DiacriticDifference {
  /** Zero-based index of the base character in the normalized text. */
  position: number;
  baseCharacter: string;
  /** Marks on this character in each text, as code points (e.g. "U+064E"). */
  candidateMarks: string[];
  verificationMarks: string[];
}

export type ArabicComparison =
  | { kind: "IDENTICAL" }
  | { kind: "DIACRITICS_ONLY"; differences: DiacriticDifference[] }
  | { kind: "DIFFERENT" };

function split(value: string): Array<{ base: string; marks: string[] }> {
  const slots: Array<{ base: string; marks: string[] }> = [];
  for (const ch of normalizeArabic(value)) {
    if (MARK.test(ch)) {
      if (slots.length === 0) slots.push({ base: "", marks: [] });
      slots[slots.length - 1].marks.push(ch);
    } else {
      slots.push({ base: ch, marks: [] });
    }
  }
  return slots;
}

const codePoint = (ch: string) => `U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;

export function compareArabic(candidate: string, verification: string): ArabicComparison {
  const a = split(candidate);
  const b = split(verification);
  if (a.length !== b.length || a.some((slot, i) => slot.base !== b[i].base)) return { kind: "DIFFERENT" };
  const differences: DiacriticDifference[] = [];
  a.forEach((slot, i) => {
    if (slot.marks.join("") !== b[i].marks.join("")) {
      differences.push({
        position: i,
        baseCharacter: slot.base,
        candidateMarks: slot.marks.map(codePoint),
        verificationMarks: b[i].marks.map(codePoint),
      });
    }
  });
  return differences.length === 0 ? { kind: "IDENTICAL" } : { kind: "DIACRITICS_ONLY", differences };
}
