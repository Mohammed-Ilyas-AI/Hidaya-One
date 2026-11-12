/**
 * HIDAYA ONE — Verification Gate Unit Tests
 * Run with: node --experimental-vm-modules node_modules/.bin/jest
 * or: npx tsx src/verification/gate.test.ts
 *
 * Tests every requirement from Phase 2 of the master engineering prompt.
 */

import { runVerificationGate } from "./gate.js";
import type { EvidenceRecord } from "./types.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeQuranRecord(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    id: "test-quran-001",
    type: "QURAN",
    verificationStatus: "VERIFIED",
    verificationNotes: "Arabic text matches Tanzil.net source verbatim.",
    verifiedBy: "verification_agent",
    gatePassed: false,
    gateReason: "",
    quranRef: {
      surah: 13,
      ayah: 28,
      surahName: "Ar-Ra'd",
      arabicText: "أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ",
      sourceUrl: "https://tanzil.net/#13:28",
      retrievedAt: "2026-11-12T10:00:00Z",
      translationEnglish: "Verily, in the remembrance of Allah do hearts find rest.",
    },
    ...overrides,
  };
}

function makeHadithRecord(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    id: "test-hadith-001",
    type: "HADITH",
    verificationStatus: "VERIFIED",
    verificationNotes: "Verified against sunnah.com and Dar us-Salam edition.",
    verifiedBy: "verification_agent",
    gatePassed: false,
    gateReason: "",
    hadithRef: {
      collection: "Jami' at-Tirmidhi",
      book: "Chapters on Righteousness",
      hadithNumber: 1956,
      narrator: "Abu Huraira",
      arabicText: "الدُّنْيَا سِجْنُ الْمُؤْمِنِ وَجَنَّةُ الْكَافِرِ",
      translationEnglish: "The world is a prison for the believer and a paradise for the disbeliever.",
      grades: [
        { grade: "Hasan Sahih", scholar: "Imam al-Tirmidhi" },
        { grade: "Sahih", scholar: "Al-Albani" },
      ],
      sourceUrl: "https://sunnah.com/tirmidhi:2324",
      retrievedAt: "2026-11-12T10:05:00Z",
    },
    ...overrides,
  };
}

// ─── Test Runner (zero-dependency) ──────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertGatePassed(topicId: string, records: EvidenceRecord[]): void {
  const { gateResult, package: pkg } = runVerificationGate(topicId, records);
  assert(gateResult.passed, `Expected gate PASS but got FAIL: ${gateResult.errors.join("; ")}`);
  assert(pkg !== undefined, "Expected VerifiedEvidencePackage to be returned");
  assert(pkg!.attestation === "ALL_EVIDENCE_GATE_PASSED", "Expected attestation literal");
  for (const item of pkg!.evidenceItems) {
    assert(item.gatePassed === true, `Expected gatePassed=true on item ${item.id}`);
  }
}

function assertGateFailed(topicId: string, records: EvidenceRecord[], errorContains?: string): void {
  const { gateResult, package: pkg } = runVerificationGate(topicId, records);
  assert(!gateResult.passed, `Expected gate FAIL but got PASS`);
  assert(pkg === undefined, "Expected no package when gate fails");
  if (errorContains) {
    const hasMatch = gateResult.errors.some((e) => e.includes(errorContains));
    assert(hasMatch, `Expected error containing "${errorContains}" but got: ${gateResult.errors.join("; ")}`);
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

console.log("\n=== HIDAYA ONE — Verification Gate Tests ===\n");

console.log("Group: Quran references");
test("Correct Quran 13:28 passes gate", () => {
  assertGatePassed("topic-001", [makeQuranRecord()]);
});

test("Incorrect Quran surah (0) fails gate", () => {
  assertGateFailed("topic-002", [
    makeQuranRecord({ quranRef: { ...makeQuranRecord().quranRef!, surah: 0 } }),
  ], "surah");
});

test("Incorrect Quran surah (115) fails gate", () => {
  assertGateFailed("topic-003", [
    makeQuranRecord({ quranRef: { ...makeQuranRecord().quranRef!, surah: 115 } }),
  ], "surah");
});

test("Incorrect Quran ayah (beyond max for Surah 13) fails gate", () => {
  assertGateFailed("topic-004", [
    makeQuranRecord({ quranRef: { ...makeQuranRecord().quranRef!, surah: 13, ayah: 999 } }),
  ], "ayah");
});

test("Missing Quran arabicText fails gate", () => {
  assertGateFailed("topic-005", [
    makeQuranRecord({ quranRef: { ...makeQuranRecord().quranRef!, arabicText: "" } }),
  ], "arabicText");
});

test("Missing Quran sourceUrl fails gate", () => {
  assertGateFailed("topic-006", [
    makeQuranRecord({ quranRef: { ...makeQuranRecord().quranRef!, sourceUrl: "" } }),
  ], "sourceUrl");
});

console.log("\nGroup: Hadith references");
test("Correct Hadith Tirmidhi 1956 passes gate", () => {
  assertGatePassed("topic-010", [makeHadithRecord()]);
});

test("Hadith with no grades fails gate", () => {
  assertGateFailed("topic-011", [
    makeHadithRecord({ hadithRef: { ...makeHadithRecord().hadithRef!, grades: [] } }),
  ], "no authenticity grades");
});

test("Hadith with vague scholar ('Various scholars') fails gate", () => {
  assertGateFailed("topic-012", [
    makeHadithRecord({
      hadithRef: {
        ...makeHadithRecord().hadithRef!,
        grades: [{ grade: "Hasan", scholar: "Various scholars" }],
      },
    }),
  ], "unnamed/vague scholar");
});

test("Hadith with missing arabicText fails gate", () => {
  assertGateFailed("topic-013", [
    makeHadithRecord({ hadithRef: { ...makeHadithRecord().hadithRef!, arabicText: "" } }),
  ], "arabicText");
});

test("Hadith with invalid number (0) fails gate", () => {
  assertGateFailed("topic-014", [
    makeHadithRecord({ hadithRef: { ...makeHadithRecord().hadithRef!, hadithNumber: 0 } }),
  ], "Hadith number invalid");
});

console.log("\nGroup: Verification status");
test("NEEDS_HUMAN_REVIEW status blocked from gate", () => {
  assertGateFailed("topic-020", [
    makeQuranRecord({ verificationStatus: "NEEDS_HUMAN_REVIEW" }),
  ], "NEEDS_HUMAN_REVIEW");
});

test("SOURCE_NOT_FOUND status blocked from gate", () => {
  assertGateFailed("topic-021", [
    makeQuranRecord({ verificationStatus: "SOURCE_NOT_FOUND" }),
  ], "SOURCE_NOT_FOUND");
});

test("REJECTED status blocked from gate", () => {
  assertGateFailed("topic-022", [
    makeHadithRecord({ verificationStatus: "REJECTED" }),
  ], "REJECTED");
});

test("ARABIC_MISMATCH status blocked from gate", () => {
  assertGateFailed("topic-023", [
    makeHadithRecord({ verificationStatus: "ARABIC_MISMATCH" }),
  ], "ARABIC_MISMATCH");
});

test("AUTHENTICITY_UNCONFIRMED status blocked from gate", () => {
  assertGateFailed("topic-024", [
    makeHadithRecord({ verificationStatus: "AUTHENTICITY_UNCONFIRMED" }),
  ], "AUTHENTICITY_UNCONFIRMED");
});

console.log("\nGroup: Bypass prevention");
test("LLM pre-setting gatePassed=true is rejected", () => {
  assertGateFailed("topic-030", [
    makeQuranRecord({ gatePassed: true }),
  ], "bypass");
});

test("Missing verificationNotes fails gate", () => {
  assertGateFailed("topic-031", [
    makeQuranRecord({ verificationNotes: "" }),
  ], "verificationNotes");
});

test("Missing verifiedBy fails gate", () => {
  assertGateFailed("topic-032", [
    makeQuranRecord({ verifiedBy: "" }),
  ], "verifiedBy");
});

console.log("\nGroup: Empty / mixed batches");
test("Empty records array fails gate", () => {
  assertGateFailed("topic-040", [], "No evidence");
});

test("Mixed batch: one invalid blocks entire batch", () => {
  const good = makeQuranRecord({ id: "good-001" });
  const bad = makeHadithRecord({ id: "bad-001", verificationStatus: "REJECTED" });
  assertGateFailed("topic-041", [good, bad]);
});

test("Both Quran and Hadith VERIFIED in one batch passes", () => {
  assertGatePassed("topic-042", [
    makeQuranRecord({ id: "q-042" }),
    makeHadithRecord({ id: "h-042" }),
  ]);
});

test("Attestation literal is set by gate, not agent", () => {
  const { package: pkg } = runVerificationGate("topic-043", [makeQuranRecord({ id: "q-043" })]);
  assert(pkg?.attestation === "ALL_EVIDENCE_GATE_PASSED", "Attestation must equal the literal");
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error("\n⛔  Some verification gate tests FAILED.");
  process.exit(1);
} else {
  console.log("\n✅  All verification gate tests passed.");
}

