/**
 * HIDAYA ONE — Deterministic Religious Verification Gate
 *
 * This is NOT an LLM instruction. It is a typed, deterministic software
 * function that validates EvidenceRecord[] before any scriptwriting begins.
 *
 * Rules:
 *  1. Every item must have verificationStatus === "VERIFIED".
 *  2. Quran items must have arabicText, surah ∈ [1,114], ayah ≥ 1, sourceUrl.
 *  3. Hadith items must have arabicText, hadithNumber, at least one grade
 *     with a named scholar, and a sourceUrl.
 *  4. gatePassed must NOT already be set to true by any agent.
 *     The gate itself sets gatePassed.
 *  5. Any item that fails results in the entire batch failing.
 *  6. Attestation literal is set only here — never accepted from agent output.
 */

import type {
  EvidenceRecord,
  VerifiedEvidencePackage,
  VerificationStatus,
} from "./types.js";

export interface GateResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

// Known valid Surah ayah counts (1-indexed). Subset — extend as needed.
const SURAH_AYAH_COUNTS: Record<number, number> = {
  1: 7, 2: 286, 3: 200, 4: 176, 5: 120, 6: 165, 7: 206, 8: 75,
  9: 129, 10: 109, 11: 123, 12: 111, 13: 43, 14: 52, 15: 99,
  16: 128, 17: 111, 18: 110, 19: 98, 20: 135, 21: 112, 22: 78,
  23: 118, 24: 64, 25: 77, 26: 227, 27: 93, 28: 88, 29: 69,
  30: 60, 31: 34, 32: 30, 33: 73, 34: 54, 35: 45, 36: 83,
  37: 182, 38: 88, 39: 75, 40: 85, 41: 54, 42: 53, 43: 89,
  44: 59, 45: 37, 46: 35, 47: 38, 48: 29, 49: 18, 50: 45,
  51: 60, 52: 49, 53: 62, 54: 55, 55: 78, 56: 96, 57: 29,
  58: 22, 59: 24, 60: 13, 61: 14, 62: 11, 63: 11, 64: 18,
  65: 12, 66: 12, 67: 30, 68: 52, 69: 52, 70: 44, 71: 28,
  72: 28, 73: 20, 74: 56, 75: 40, 76: 31, 77: 50, 78: 40,
  79: 46, 80: 42, 81: 29, 82: 19, 83: 36, 84: 25, 85: 22,
  86: 17, 87: 19, 88: 26, 89: 30, 90: 20, 91: 15, 92: 21,
  93: 11, 94: 8, 95: 8, 96: 19, 97: 5, 98: 8, 99: 8,
  100: 11, 101: 11, 102: 8, 103: 3, 104: 9, 105: 5, 106: 4,
  107: 7, 108: 3, 109: 6, 110: 3, 111: 5, 112: 4, 113: 5, 114: 6,
};

const ALLOWED_STATUSES_TO_ENTER: VerificationStatus[] = ["VERIFIED"];

function validateQuranItem(record: EvidenceRecord): string[] {
  const errors: string[] = [];
  const ref = record.quranRef;
  if (!ref) {
    errors.push(`[${record.id}] QURAN record missing quranRef.`);
    return errors;
  }
  if (!ref.arabicText || ref.arabicText.trim().length < 3) {
    errors.push(`[${record.id}] Quran arabicText is missing or too short.`);
  }
  if (!ref.surah || ref.surah < 1 || ref.surah > 114) {
    errors.push(`[${record.id}] Quran surah ${ref.surah} out of range [1–114].`);
  } else {
    const maxAyah = SURAH_AYAH_COUNTS[ref.surah];
    if (maxAyah !== undefined && (ref.ayah < 1 || ref.ayah > maxAyah)) {
      errors.push(
        `[${record.id}] Surah ${ref.surah} has ${maxAyah} ayahs — ayah ${ref.ayah} invalid.`,
      );
    }
  }
  if (!ref.sourceUrl || !ref.sourceUrl.startsWith("http")) {
    errors.push(`[${record.id}] Quran sourceUrl missing or malformed.`);
  }
  if (!ref.retrievedAt) {
    errors.push(`[${record.id}] Quran retrievedAt timestamp missing.`);
  }
  return errors;
}

function validateHadithItem(record: EvidenceRecord): string[] {
  const errors: string[] = [];
  const ref = record.hadithRef;
  if (!ref) {
    errors.push(`[${record.id}] HADITH record missing hadithRef.`);
    return errors;
  }
  if (!ref.arabicText || ref.arabicText.trim().length < 3) {
    errors.push(`[${record.id}] Hadith arabicText is missing or too short.`);
  }
  if (!ref.collection || ref.collection.trim().length === 0) {
    errors.push(`[${record.id}] Hadith collection name is missing.`);
  }
  if (!ref.hadithNumber || ref.hadithNumber < 1) {
    errors.push(`[${record.id}] Hadith number invalid.`);
  }
  if (!ref.grades || ref.grades.length === 0) {
    errors.push(`[${record.id}] Hadith has no authenticity grades.`);
  } else {
    for (const grade of ref.grades) {
      if (!grade.scholar || grade.scholar.trim().length === 0 ||
          grade.scholar.toLowerCase().includes("various")) {
        errors.push(
          `[${record.id}] Hadith grade has unnamed/vague scholar: "${grade.scholar}".`,
        );
      }
      if (!grade.grade || grade.grade.trim().length === 0) {
        errors.push(`[${record.id}] Hadith grade value is empty for scholar "${grade.scholar}".`);
      }
    }
  }
  if (!ref.sourceUrl || !ref.sourceUrl.startsWith("http")) {
    errors.push(`[${record.id}] Hadith sourceUrl missing or malformed.`);
  }
  if (!ref.retrievedAt) {
    errors.push(`[${record.id}] Hadith retrievedAt timestamp missing.`);
  }
  return errors;
}

/**
 * Run the deterministic verification gate.
 * Returns a GateResult. If passed === true, also returns the
 * VerifiedEvidencePackage (attestation set here, not by any agent).
 */
export function runVerificationGate(
  topicId: string,
  records: EvidenceRecord[],
): { gateResult: GateResult; package?: VerifiedEvidencePackage } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!records || records.length === 0) {
    return {
      gateResult: {
        passed: false,
        errors: ["No evidence records provided to verification gate."],
        warnings: [],
      },
    };
  }

  for (const record of records) {
    // Rule 1: Status must be VERIFIED (set by Verification Agent, not gate)
    if (!ALLOWED_STATUSES_TO_ENTER.includes(record.verificationStatus)) {
      errors.push(
        `[${record.id}] Status is "${record.verificationStatus}" — only VERIFIED may pass gate.`,
      );
      continue; // still check structure for diagnostics
    }

    // Rule 2: gatePassed must NOT already be true (would indicate bypass attempt)
    if ((record as any).gatePassed === true) {
      errors.push(
        `[${record.id}] gatePassed was pre-set to true — potential bypass attempt. REJECTED.`,
      );
      continue;
    }

    // Rule 3: Type-specific structural validation
    if (record.type === "QURAN") {
      errors.push(...validateQuranItem(record));
    } else if (record.type === "HADITH") {
      errors.push(...validateHadithItem(record));
    } else if (record.type === "SCHOLARLY_OPINION") {
      if (!record.scholarlyOpinion || record.scholarlyOpinion.trim().length < 10) {
        warnings.push(`[${record.id}] SCHOLARLY_OPINION text is very short or missing.`);
      }
    }

    // Rule 4: verificationNotes must be present
    if (!record.verificationNotes || record.verificationNotes.trim().length === 0) {
      errors.push(`[${record.id}] verificationNotes is empty — verification appears incomplete.`);
    }

    // Rule 5: verifiedBy must be present
    if (!record.verifiedBy || record.verifiedBy.trim().length === 0) {
      errors.push(`[${record.id}] verifiedBy agent name missing.`);
    }
  }

  if (errors.length > 0) {
    return {
      gateResult: { passed: false, errors, warnings },
    };
  }

  // All records passed — set gatePassed and attestation here (and only here)
  const passedRecords: EvidenceRecord[] = records.map((r) => ({
    ...r,
    gatePassed: true,
    gateReason: "Passed deterministic verification gate.",
  }));

  const verifiedPackage: VerifiedEvidencePackage = {
    topicId,
    evidenceItems: passedRecords,
    verificationCompletedAt: new Date().toISOString(),
    attestation: "ALL_EVIDENCE_GATE_PASSED",
  };

  return {
    gateResult: { passed: true, errors: [], warnings },
    package: verifiedPackage,
  };
}

