import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { compareArabic, type DiacriticDifference } from "./arabic.ts";
import {
  EvidenceCandidateSchema,
  VerificationRecordSchema,
  type EvidenceCandidate,
  type Grading,
  type Reference,
  type VerificationRecord,
  type VerificationStatus,
} from "./contracts.ts";
import { checkSource, type SourceRegistry, type SourceRole } from "./source-registry.ts";

/**
 * Deterministic religious validation gate (blueprint §7).
 *
 * The gate takes the Research Agent's candidate and the Verification Agent's
 * record, re-checks them in code, and decides. No input field can force a
 * pass: the decision and its attestation are produced here and nowhere else.
 * Every check fails closed.
 *
 * Status policy:
 *   VERIFIED            -> PASSED only if every check here also passes
 *   NEEDS_HUMAN_REVIEW  -> HUMAN_REVIEW
 *   anything else       -> BLOCKED (the workflow stops for that record)
 * A blocked or reviewed record is never upgraded; a corrected record must go
 * through a new verification run, which produces a different digest.
 */

export const GATE_VERSION = "2";
export const MIN_ATTESTATION_KEY_LENGTH = 32;

export type GateOutcome = "PASSED" | "HUMAN_REVIEW" | "BLOCKED";

export interface GateAttestation {
  gateVersion: string;
  registryVersion: string;
  evidenceId: string;
  /** SHA-256 of the exact candidate and verification record that passed. */
  evidenceDigest: string;
  issuedAt: string;
  /** HMAC-SHA256 over the fields above, keyed with the gate's secret. */
  signature: string;
}

/** Recorded when two Arabic texts are not identical. Both originals are kept. */
export interface ArabicDifferenceRecord {
  kind: "DIACRITICS_ONLY" | "DIFFERENT";
  candidateArabicText: string;
  verificationArabicText: string;
  /** Exact per-character mark differences; empty when kind is DIFFERENT. */
  diacriticDifferences: DiacriticDifference[];
}

export interface GateDecision {
  evidenceId: string | null;
  outcome: GateOutcome;
  status: VerificationStatus;
  reasons: string[];
  gateVersion: string;
  registryVersion: string;
  decidedAt: string;
  /** Digest of the evaluated records; null when they could not be parsed. */
  evidenceDigest: string | null;
  arabicDifference: ArabicDifferenceRecord | null;
  /**
   * How far apart the two retrievals were. Informational: two reads of the
   * same page are weaker corroboration than two different sources.
   */
  corroboration: "SAME_URL" | "SAME_HOST" | "DIFFERENT_HOST" | null;
  /** Present only when outcome is PASSED. */
  attestation: GateAttestation | null;
}

export interface BatchDecision {
  /** True only when the batch is non-empty and every record passed. */
  fullyVerified: boolean;
  decisions: GateDecision[];
}

export interface GateConfig {
  /** Secret used to sign attestations. Without it the gate cannot pass anything. */
  attestationKey: string | undefined;
  registry: SourceRegistry;
  now?: () => Date;
}

function normalizeLabel(value: string): string {
  return value.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
}

function sameReference(a: Reference, b: Reference): boolean {
  if (a.kind === "QURAN" && b.kind === "QURAN") {
    return a.surah === b.surah && a.ayahStart === b.ayahStart && a.ayahEnd === b.ayahEnd;
  }
  if (a.kind === "HADITH" && b.kind === "HADITH") {
    return (
      normalizeLabel(a.collection) === normalizeLabel(b.collection) &&
      normalizeLabel(a.hadithNumber) === normalizeLabel(b.hadithNumber)
    );
  }
  return false;
}

function gradingKeys(gradings: readonly Grading[]): Set<string> {
  return new Set(gradings.map((g) => `${normalizeLabel(g.scholar)}\u0000${normalizeLabel(g.grade)}`));
}

function corroborationOf(a: string, b: string): GateDecision["corroboration"] {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    if (ua.href === ub.href) return "SAME_URL";
    return ua.hostname.toLowerCase() === ub.hostname.toLowerCase() ? "SAME_HOST" : "DIFFERENT_HOST";
  } catch {
    return null;
  }
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function digestEvidence(candidate: EvidenceCandidate, verification: VerificationRecord): string {
  return createHash("sha256").update(canonicalJson({ candidate, verification })).digest("hex");
}

function sign(fields: Omit<GateAttestation, "signature">, key: string): string {
  return createHmac("sha256", key).update(canonicalJson(fields)).digest("hex");
}

export function isUsableAttestationKey(key: string | undefined): key is string {
  return typeof key === "string" && key.length >= MIN_ATTESTATION_KEY_LENGTH;
}

export function evaluateEvidence(
  candidateInput: unknown,
  verificationInput: unknown,
  config: GateConfig,
): GateDecision {
  const base = {
    gateVersion: GATE_VERSION,
    registryVersion: config.registry.version,
    decidedAt: (config.now?.() ?? new Date()).toISOString(),
  };
  const candidateResult = EvidenceCandidateSchema.safeParse(candidateInput);
  const verificationResult = VerificationRecordSchema.safeParse(verificationInput);
  if (!candidateResult.success || !verificationResult.success) {
    const reasons = [
      ...(candidateResult.success ? [] : candidateResult.error.issues.map((i) => `candidate.${i.path.join(".")}: ${i.message}`)),
      ...(verificationResult.success ? [] : verificationResult.error.issues.map((i) => `verification.${i.path.join(".")}: ${i.message}`)),
    ];
    return {
      ...base,
      evidenceId: candidateResult.success ? candidateResult.data.evidenceId : null,
      outcome: "BLOCKED",
      status: "REJECTED",
      reasons,
      evidenceDigest: null,
      arabicDifference: null,
      corroboration: null,
      attestation: null,
    };
  }

  const candidate = candidateResult.data;
  const verification = verificationResult.data;
  const id = candidate.evidenceId;
  const evidenceDigest = digestEvidence(candidate, verification);
  const corroboration = corroborationOf(candidate.sourceUrl, verification.sourceUrl);
  let arabicDifference: ArabicDifferenceRecord | null = null;

  const finish = (outcome: Exclude<GateOutcome, "PASSED">, status: VerificationStatus, reasons: string[]): GateDecision => ({
    ...base,
    evidenceId: id,
    outcome,
    status,
    reasons,
    evidenceDigest,
    arabicDifference,
    corroboration,
    attestation: null,
  });

  // The agent's own non-VERIFIED verdict is never upgraded.
  if (verification.status === "NEEDS_HUMAN_REVIEW") {
    return finish("HUMAN_REVIEW", "NEEDS_HUMAN_REVIEW", ["Verification Agent requested human review."]);
  }
  if (verification.status !== "VERIFIED") {
    return finish("BLOCKED", verification.status, [`Verification Agent returned ${verification.status}.`]);
  }

  // From here the agent claims VERIFIED; the gate re-checks the claim.
  const blocked: Array<[VerificationStatus, string]> = [];
  const review: string[] = [];

  if (verification.evidenceId !== id) {
    blocked.push(["REFERENCE_MISMATCH", "Verification record does not reference this candidate's evidence ID."]);
  }
  if (normalizeLabel(verification.verifiedBy) === normalizeLabel(candidate.researchedBy)) {
    blocked.push(["REJECTED", "Verification was not independent: the verifier identity is the researcher identity."]);
  }

  for (const [label, ref] of [["candidate", candidate.reference], ["verification", verification.reference]] as const) {
    if (ref.kind === "QURAN" && ref.ayahEnd < ref.ayahStart) {
      blocked.push(["REFERENCE_MISMATCH", `${label}: ayah range ends before it starts.`]);
    }
  }
  if (!sameReference(candidate.reference, verification.reference)) {
    blocked.push(["REFERENCE_MISMATCH", "Researched and independently verified references differ."]);
  }

  const textRole: SourceRole = candidate.reference.kind === "QURAN" ? "QURAN_TEXT" : "HADITH_TEXT";
  for (const [label, url] of [["candidate", candidate.sourceUrl], ["verification", verification.sourceUrl]] as const) {
    const check = checkSource(url, textRole, config.registry);
    if (check.result === "INVALID_URL") {
      blocked.push(["SOURCE_NOT_FOUND", `${label}: source URL is not a valid https URL.`]);
    } else if (check.result === "UNREGISTERED_HOST") {
      review.push(`${label}: source host ${check.host} is not in the trusted-source registry.`);
    } else if (check.result === "WRONG_ROLE") {
      review.push(`${label}: source host ${check.host} is not registered for ${textRole}.`);
    }
  }

  const comparison = compareArabic(candidate.arabicText, verification.arabicText);
  if (!/\p{Script=Arabic}/u.test(candidate.arabicText) || !/\p{Script=Arabic}/u.test(verification.arabicText)) {
    blocked.push(["ARABIC_MISMATCH", "Arabic wording contains no Arabic script."]);
  } else if (comparison.kind === "DIFFERENT") {
    arabicDifference = {
      kind: "DIFFERENT",
      candidateArabicText: candidate.arabicText,
      verificationArabicText: verification.arabicText,
      diacriticDifferences: [],
    };
    blocked.push(["ARABIC_MISMATCH", "Researched and independently verified Arabic wording differ."]);
  } else if (comparison.kind === "DIACRITICS_ONLY") {
    arabicDifference = {
      kind: "DIACRITICS_ONLY",
      candidateArabicText: candidate.arabicText,
      verificationArabicText: verification.arabicText,
      diacriticDifferences: comparison.differences,
    };
    review.push(
      `Arabic wording differs only in diacritics at ${comparison.differences.length} character position(s); both texts are recorded.`,
    );
  }

  if (candidate.reference.kind === "HADITH") {
    if (verification.gradings.length === 0) {
      blocked.push(["AUTHENTICITY_UNCONFIRMED", "No authenticity grade with a named scholar was verified."]);
    } else {
      const confirmed = gradingKeys(verification.gradings);
      for (const key of gradingKeys(candidate.gradings)) {
        if (!confirmed.has(key)) {
          blocked.push(["AUTHENTICITY_UNCONFIRMED", "A researched grading was not confirmed by verification."]);
          break;
        }
      }
    }
    const gradingSources: Array<[string, string]> = [
      ...candidate.gradings.map((g): [string, string] => ["candidate", g.sourceUrl ?? candidate.sourceUrl]),
      ...verification.gradings.map((g): [string, string] => ["verification", g.sourceUrl ?? verification.sourceUrl]),
    ];
    for (const [label, url] of gradingSources) {
      const check = checkSource(url, "GRADING_EVIDENCE", config.registry);
      if (check.result === "INVALID_URL") {
        blocked.push(["AUTHENTICITY_UNCONFIRMED", `${label}: grading source URL is not a valid https URL.`]);
      } else if (check.result !== "OK") {
        review.push(`${label}: grading source host ${check.host} is not registered for GRADING_EVIDENCE.`);
      }
    }
  }

  if (blocked.length > 0) {
    return finish("BLOCKED", blocked[0][0], [...new Set(blocked.map(([, reason]) => reason))]);
  }
  if (review.length > 0) {
    return finish("HUMAN_REVIEW", "NEEDS_HUMAN_REVIEW", [...new Set(review)]);
  }

  const key = config.attestationKey;
  if (!isUsableAttestationKey(key)) {
    return finish("BLOCKED", "REJECTED", ["Gate attestation key is not configured; nothing can pass."]);
  }

  const fields = {
    gateVersion: GATE_VERSION,
    registryVersion: config.registry.version,
    evidenceId: id,
    evidenceDigest,
    issuedAt: base.decidedAt,
  };
  return {
    ...base,
    evidenceId: id,
    outcome: "PASSED",
    status: "VERIFIED",
    reasons: [],
    evidenceDigest,
    arabicDifference: null,
    corroboration,
    attestation: { ...fields, signature: sign(fields, key) },
  };
}

/** A batch is fully verified only if it is non-empty and every record passed. */
export function evaluateBatch(
  items: ReadonlyArray<{ candidate: unknown; verification: unknown }>,
  config: GateConfig,
): BatchDecision {
  const decisions = items.map((item) => evaluateEvidence(item.candidate, item.verification, config));
  return {
    fullyVerified: decisions.length > 0 && decisions.every((d) => d.outcome === "PASSED"),
    decisions,
  };
}

/**
 * Downstream stages call this before using evidence. It proves the attestation
 * was issued by the gate for exactly this candidate and verification record.
 */
export function verifyAttestation(
  attestation: unknown,
  candidateInput: unknown,
  verificationInput: unknown,
  attestationKey: string | undefined,
): boolean {
  if (!isUsableAttestationKey(attestationKey)) return false;
  if (attestation === null || typeof attestation !== "object") return false;
  const a = attestation as Partial<GateAttestation>;
  if (
    typeof a.gateVersion !== "string" ||
    typeof a.registryVersion !== "string" ||
    typeof a.evidenceId !== "string" ||
    typeof a.evidenceDigest !== "string" ||
    typeof a.issuedAt !== "string" ||
    typeof a.signature !== "string"
  ) {
    return false;
  }
  const candidate = EvidenceCandidateSchema.safeParse(candidateInput);
  const verification = VerificationRecordSchema.safeParse(verificationInput);
  if (!candidate.success || !verification.success) return false;
  if (a.gateVersion !== GATE_VERSION || a.evidenceId !== candidate.data.evidenceId) return false;
  if (a.evidenceDigest !== digestEvidence(candidate.data, verification.data)) return false;

  const expected = Buffer.from(
    sign(
      {
        gateVersion: a.gateVersion,
        registryVersion: a.registryVersion,
        evidenceId: a.evidenceId,
        evidenceDigest: a.evidenceDigest,
        issuedAt: a.issuedAt,
      },
      attestationKey,
    ),
    "hex",
  );
  const actual = Buffer.from(a.signature, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Signed summary of one gate run, so a partial batch cannot be relabelled as complete. */
export interface BatchAttestation {
  gateVersion: string;
  runId: string;
  totalRecords: number;
  /** Evidence digests of the records that passed, sorted. */
  passedDigests: string[];
  fullyVerified: boolean;
  issuedAt: string;
  signature: string;
}

/** Returns null when nothing passed or the signing key is unusable. */
export function attestBatch(runId: string, decisions: readonly GateDecision[], config: GateConfig): BatchAttestation | null {
  const key = config.attestationKey;
  const passedDigests = decisions
    .filter((d) => d.outcome === "PASSED" && d.attestation)
    .map((d) => d.attestation!.evidenceDigest)
    .sort();
  if (!isUsableAttestationKey(key) || passedDigests.length === 0) return null;
  const fields = {
    gateVersion: GATE_VERSION,
    runId,
    totalRecords: decisions.length,
    passedDigests,
    fullyVerified: passedDigests.length === decisions.length,
    issuedAt: (config.now?.() ?? new Date()).toISOString(),
  };
  return { ...fields, signature: createHmac("sha256", key).update(canonicalJson(fields)).digest("hex") };
}

/** Checks the batch signature and that it covers exactly the given item digests. */
export function verifyBatchAttestation(
  batch: unknown,
  itemDigests: readonly string[],
  attestationKey: string | undefined,
): batch is BatchAttestation {
  if (!isUsableAttestationKey(attestationKey)) return false;
  if (batch === null || typeof batch !== "object") return false;
  const b = batch as Partial<BatchAttestation>;
  if (
    typeof b.gateVersion !== "string" ||
    typeof b.runId !== "string" ||
    typeof b.totalRecords !== "number" ||
    !Array.isArray(b.passedDigests) ||
    !b.passedDigests.every((d) => typeof d === "string") ||
    typeof b.fullyVerified !== "boolean" ||
    typeof b.issuedAt !== "string" ||
    typeof b.signature !== "string"
  ) {
    return false;
  }
  if (b.gateVersion !== GATE_VERSION) return false;
  const fields = {
    gateVersion: b.gateVersion,
    runId: b.runId,
    totalRecords: b.totalRecords,
    passedDigests: b.passedDigests,
    fullyVerified: b.fullyVerified,
    issuedAt: b.issuedAt,
  };
  const expected = Buffer.from(createHmac("sha256", attestationKey).update(canonicalJson(fields)).digest("hex"), "hex");
  const actual = Buffer.from(b.signature, "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;
  if (b.fullyVerified !== (b.passedDigests.length === b.totalRecords)) return false;
  const given = [...itemDigests].sort();
  return given.length === b.passedDigests.length && given.every((d, i) => d === b.passedDigests![i]);
}
