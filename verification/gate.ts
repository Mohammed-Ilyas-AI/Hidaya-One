import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  EvidenceCandidateSchema,
  VerificationRecordSchema,
  type EvidenceCandidate,
  type Grading,
  type Reference,
  type VerificationRecord,
  type VerificationStatus,
} from "./contracts.ts";

/**
 * Deterministic religious validation gate (blueprint §7).
 *
 * The gate takes the Research Agent's candidate and the Verification Agent's
 * record, re-checks them in code, and decides. No input field can force a
 * pass: the decision and its attestation are produced here and nowhere else.
 * Every check fails closed.
 */

export const GATE_VERSION = "1";

export type GateOutcome = "PASSED" | "HUMAN_REVIEW" | "BLOCKED";

export interface GateAttestation {
  gateVersion: string;
  evidenceId: string;
  /** SHA-256 of the exact candidate and verification record that passed. */
  evidenceDigest: string;
  issuedAt: string;
  /** HMAC-SHA256 over the fields above, keyed with the gate's secret. */
  signature: string;
}

export interface GateDecision {
  evidenceId: string | null;
  outcome: GateOutcome;
  status: VerificationStatus;
  reasons: string[];
  /** Present only when outcome is PASSED. */
  attestation: GateAttestation | null;
}

export interface BatchDecision {
  /** True only when every record in the batch passed. */
  fullyVerified: boolean;
  decisions: GateDecision[];
}

export interface GateConfig {
  /** Secret used to sign attestations. Without it the gate cannot pass anything. */
  attestationKey: string | undefined;
  /** Hosts accepted as primary sources. Subdomains are accepted. */
  trustedSourceHosts: readonly string[];
  now?: () => Date;
}

const MIN_KEY_LENGTH = 32;
const ARABIC_LETTER = /\p{Script=Arabic}/u;
const TATWEEL = /ـ/g;
// Harakat, Quranic annotation marks and superscript alef.
const ARABIC_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;

function normalizeArabic(value: string): string {
  return value.normalize("NFC").replace(TATWEEL, "").replace(/\s+/g, " ").trim();
}

function stripMarks(value: string): string {
  return value.replace(ARABIC_MARKS, "");
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

function trustedHttpsHost(rawUrl: string, trusted: readonly string[]): "OK" | "INVALID" | "UNTRUSTED" {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return "INVALID";
  }
  if (url.protocol !== "https:" || url.username || url.password) return "INVALID";
  const host = url.hostname.toLowerCase();
  const ok = trusted.some((t) => {
    const base = t.toLowerCase();
    return host === base || host.endsWith(`.${base}`);
  });
  return ok ? "OK" : "UNTRUSTED";
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1));
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

function decide(
  evidenceId: string | null,
  outcome: Exclude<GateOutcome, "PASSED">,
  status: VerificationStatus,
  reasons: string[],
): GateDecision {
  return { evidenceId, outcome, status, reasons, attestation: null };
}

export function evaluateEvidence(
  candidateInput: unknown,
  verificationInput: unknown,
  config: GateConfig,
): GateDecision {
  const candidateResult = EvidenceCandidateSchema.safeParse(candidateInput);
  const verificationResult = VerificationRecordSchema.safeParse(verificationInput);
  if (!candidateResult.success || !verificationResult.success) {
    const reasons = [
      ...(candidateResult.success ? [] : candidateResult.error.issues.map((i) => `candidate.${i.path.join(".")}: ${i.message}`)),
      ...(verificationResult.success ? [] : verificationResult.error.issues.map((i) => `verification.${i.path.join(".")}: ${i.message}`)),
    ];
    const id = candidateResult.success ? candidateResult.data.evidenceId : null;
    return decide(id, "BLOCKED", "REJECTED", reasons);
  }

  const candidate = candidateResult.data;
  const verification = verificationResult.data;
  const id = candidate.evidenceId;

  // The agent's own non-VERIFIED verdict is never upgraded.
  if (verification.status === "NEEDS_HUMAN_REVIEW") {
    return decide(id, "HUMAN_REVIEW", "NEEDS_HUMAN_REVIEW", ["Verification Agent requested human review."]);
  }
  if (verification.status !== "VERIFIED") {
    return decide(id, "BLOCKED", verification.status, [`Verification Agent returned ${verification.status}.`]);
  }

  // From here the agent claims VERIFIED; the gate re-checks the claim.
  const blocked: Array<[VerificationStatus, string]> = [];
  const review: string[] = [];

  if (verification.evidenceId !== id) {
    blocked.push(["REFERENCE_MISMATCH", "Verification record belongs to a different evidence ID."]);
  }
  if (normalizeLabel(verification.verifiedBy) === normalizeLabel(candidate.researchedBy)) {
    blocked.push(["REJECTED", "Verification was not independent: verifier is the researcher."]);
  }

  for (const [label, ref] of [["candidate", candidate.reference], ["verification", verification.reference]] as const) {
    if (ref.kind === "QURAN" && ref.ayahEnd < ref.ayahStart) {
      blocked.push(["REFERENCE_MISMATCH", `${label}: ayah range ends before it starts.`]);
    }
  }
  if (!sameReference(candidate.reference, verification.reference)) {
    blocked.push(["REFERENCE_MISMATCH", "Researched and independently verified references differ."]);
  }

  for (const [label, url] of [["candidate", candidate.sourceUrl], ["verification", verification.sourceUrl]] as const) {
    const result = trustedHttpsHost(url, config.trustedSourceHosts);
    if (result === "INVALID") blocked.push(["SOURCE_NOT_FOUND", `${label}: source URL is not a valid https URL.`]);
    if (result === "UNTRUSTED") review.push(`${label}: source host is not on the trusted source list.`);
  }

  const researched = normalizeArabic(candidate.arabicText);
  const verified = normalizeArabic(verification.arabicText);
  if (!ARABIC_LETTER.test(researched) || !ARABIC_LETTER.test(verified)) {
    blocked.push(["ARABIC_MISMATCH", "Arabic wording contains no Arabic script."]);
  } else if (researched !== verified) {
    if (stripMarks(researched) === stripMarks(verified)) {
      review.push("Arabic wording differs only in diacritics between the two sources.");
    } else {
      blocked.push(["ARABIC_MISMATCH", "Researched and independently verified Arabic wording differ."]);
    }
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
  }

  if (blocked.length > 0) {
    return decide(id, "BLOCKED", blocked[0][0], blocked.map(([, reason]) => reason));
  }
  if (review.length > 0) {
    return decide(id, "HUMAN_REVIEW", "NEEDS_HUMAN_REVIEW", review);
  }

  const key = config.attestationKey;
  if (!key || key.length < MIN_KEY_LENGTH) {
    return decide(id, "BLOCKED", "REJECTED", ["Gate attestation key is not configured; nothing can pass."]);
  }

  const fields = {
    gateVersion: GATE_VERSION,
    evidenceId: id,
    evidenceDigest: digestEvidence(candidate, verification),
    issuedAt: (config.now?.() ?? new Date()).toISOString(),
  };
  return {
    evidenceId: id,
    outcome: "PASSED",
    status: "VERIFIED",
    reasons: [],
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
  if (!attestationKey || attestationKey.length < MIN_KEY_LENGTH) return false;
  if (attestation === null || typeof attestation !== "object") return false;
  const a = attestation as Partial<GateAttestation>;
  if (
    typeof a.gateVersion !== "string" ||
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
      { gateVersion: a.gateVersion, evidenceId: a.evidenceId, evidenceDigest: a.evidenceDigest, issuedAt: a.issuedAt },
      attestationKey,
    ),
    "hex",
  );
  const actual = Buffer.from(a.signature, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
