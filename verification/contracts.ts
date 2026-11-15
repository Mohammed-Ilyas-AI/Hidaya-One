import { z } from "zod";

/**
 * Typed evidence contracts for the religious verification gate
 * (blueprint §7). Schemas are strict: unknown keys are rejected, so an agent
 * cannot smuggle a field such as `gatePassed` through its output.
 */

export const VERIFICATION_STATUSES = [
  "VERIFIED",
  "NEEDS_HUMAN_REVIEW",
  "SOURCE_NOT_FOUND",
  "ARABIC_MISMATCH",
  "REFERENCE_MISMATCH",
  "AUTHENTICITY_UNCONFIRMED",
  "REJECTED",
] as const;

export const VerificationStatusSchema = z.enum(VERIFICATION_STATUSES);
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;

const text = z.string().trim().min(1);

export const QuranReferenceSchema = z.strictObject({
  kind: z.literal("QURAN"),
  surah: z.number().int().min(1).max(114),
  ayahStart: z.number().int().min(1).max(286),
  ayahEnd: z.number().int().min(1).max(286),
});

export const HadithReferenceSchema = z.strictObject({
  kind: z.literal("HADITH"),
  collection: text,
  hadithNumber: text,
});

export const ReferenceSchema = z.discriminatedUnion("kind", [
  QuranReferenceSchema,
  HadithReferenceSchema,
]);
export type Reference = z.infer<typeof ReferenceSchema>;

/** One authenticity grade, always attributed to the scholar who gave it. */
export const GradingSchema = z.strictObject({
  grade: text,
  scholar: text,
});
export type Grading = z.infer<typeof GradingSchema>;

/** Output of the Research Agent. Carries no verification status by design. */
export const EvidenceCandidateSchema = z.strictObject({
  evidenceId: text,
  topicId: text,
  reference: ReferenceSchema,
  arabicText: text,
  sourceUrl: text,
  gradings: z.array(GradingSchema),
  researchedBy: text,
});
export type EvidenceCandidate = z.infer<typeof EvidenceCandidateSchema>;

/** Output of the Verification Agent: what it independently retrieved. */
export const VerificationRecordSchema = z.strictObject({
  evidenceId: text,
  reference: ReferenceSchema,
  arabicText: text,
  sourceUrl: text,
  gradings: z.array(GradingSchema),
  status: VerificationStatusSchema,
  notes: text,
  verifiedBy: text,
  verifiedAt: z.iso.datetime(),
});
export type VerificationRecord = z.infer<typeof VerificationRecordSchema>;
