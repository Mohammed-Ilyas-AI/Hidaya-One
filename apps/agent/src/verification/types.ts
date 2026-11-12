/**
 * HIDAYA ONE — Religious Evidence & Verification Types
 * These are the canonical typed records used by the deterministic
 * verification gate. All agent outputs must conform to these shapes.
 */

export type VerificationStatus =
  | "VERIFIED"
  | "NEEDS_HUMAN_REVIEW"
  | "SOURCE_NOT_FOUND"
  | "ARABIC_MISMATCH"
  | "REFERENCE_MISMATCH"
  | "AUTHENTICITY_UNCONFIRMED"
  | "REJECTED";

export type EvidenceType = "QURAN" | "HADITH" | "SCHOLARLY_OPINION";

export interface QuranReference {
  surah: number;         // 1–114
  ayah: number;          // must be valid for the surah
  surahName?: string;
  arabicText: string;    // exact Arabic from verified source
  sourceUrl: string;
  retrievedAt: string;   // ISO 8601
  translationEnglish?: string;
  translationTamil?: string;
}

export interface HadithGrade {
  grade: string;         // e.g. "Hasan", "Sahih", "Da'if"
  scholar: string;       // named authority — never "Various scholars"
  gradeSource?: string;  // URL or book reference
}

export interface HadithReference {
  collection: string;    // e.g. "Jami' at-Tirmidhi"
  book?: string;
  hadithNumber: number;
  narrator?: string;
  arabicText: string;    // exact Arabic — never LLM-generated
  translationEnglish: string;
  translationTamil?: string;
  grades: HadithGrade[]; // every grade preserved separately
  sourceUrl: string;
  retrievedAt: string;
}

export interface EvidenceRecord {
  id: string;
  type: EvidenceType;
  topicId?: string;

  quranRef?: QuranReference;
  hadithRef?: HadithReference;
  scholarlyOpinion?: string; // only for SCHOLARLY_OPINION type

  // Set by the Verification Agent — never by the Research Agent
  verificationStatus: VerificationStatus;
  verificationNotes: string;
  verifiedAt?: string;
  verifiedBy?: string; // agent name

  // Set by the deterministic gate — never an LLM assertion
  gatePassed: boolean;
  gateReason: string;
}

/** What the script agent may receive — only gate-passed records */
export interface VerifiedEvidencePackage {
  topicId: string;
  evidenceItems: EvidenceRecord[];  // ALL must have gatePassed === true
  verificationCompletedAt: string;
  attestation: "ALL_EVIDENCE_GATE_PASSED"; // literal — set only by gate
}

