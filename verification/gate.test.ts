import assert from "node:assert/strict";
import { test } from "node:test";
import { compareArabic } from "./arabic.ts";
import { evaluateBatch, evaluateEvidence, verifyAttestation, type GateConfig } from "./gate.ts";
import { DEFAULT_SOURCE_REGISTRY, checkSource, type SourceRegistry } from "./source-registry.ts";

/**
 * All fixtures are synthetic placeholders, not religious content. The Arabic
 * strings say "test text for testing only"; collection, number, scholar,
 * grade and host names are obvious dummies.
 */
const KEY = "test-only-attestation-key-0123456789abcdef";
const TEST_REGISTRY: SourceRegistry = {
  version: "test-1",
  sources: [
    { host: "source.example", roles: ["QURAN_TEXT", "HADITH_TEXT", "GRADING_EVIDENCE"] },
    { host: "qurantext.example", roles: ["QURAN_TEXT"] },
    { host: "secondary.example", roles: ["SECONDARY_SUPPORT"] },
  ],
};
const config: GateConfig = {
  attestationKey: KEY,
  registry: TEST_REGISTRY,
  now: () => new Date("2026-01-01T00:00:00.000Z"),
};

const ARABIC = "نَصٌّ تجريبي للاختبار فقط";
const ARABIC_NO_MARKS = "نص تجريبي للاختبار فقط";
const ARABIC_OTHER = "نص تجريبي آخر للاختبار";

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    evidenceId: "ev-1",
    topicId: "topic-1",
    reference: { kind: "HADITH", collection: "TEST-COLLECTION", hadithNumber: "0000" },
    arabicText: ARABIC,
    sourceUrl: "https://source.example/research/0000",
    gradings: [{ grade: "TEST-GRADE", scholar: "TEST-SCHOLAR" }],
    researchedBy: "islamic_research_agent",
    ...overrides,
  };
}

function verification(overrides: Record<string, unknown> = {}) {
  return {
    evidenceId: "ev-1",
    reference: { kind: "HADITH", collection: "TEST-COLLECTION", hadithNumber: "0000" },
    arabicText: ARABIC,
    sourceUrl: "https://www.source.example/verify/0000",
    gradings: [{ grade: "TEST-GRADE", scholar: "TEST-SCHOLAR" }],
    status: "VERIFIED",
    notes: "Compared wording and reference against the source page.",
    verifiedBy: "verification_agent",
    verifiedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const quranRef = { kind: "QURAN", surah: 1, ayahStart: 1, ayahEnd: 1 };

test("valid evidence passes and the attestation verifies", () => {
  const c = candidate();
  const v = verification();
  const d = evaluateEvidence(c, v, config);
  assert.equal(d.outcome, "PASSED");
  assert.equal(d.status, "VERIFIED");
  assert.ok(d.attestation);
  assert.equal(verifyAttestation(d.attestation, c, v, KEY), true);
});

test("valid Quran-kind evidence passes without gradings", () => {
  const d = evaluateEvidence(
    candidate({ reference: quranRef, gradings: [] }),
    verification({ reference: quranRef, gradings: [] }),
    config,
  );
  assert.equal(d.outcome, "PASSED");
});

test("an agent cannot inject gatePassed", () => {
  const d = evaluateEvidence(candidate(), verification({ status: "REJECTED", gatePassed: true }), config);
  assert.equal(d.outcome, "BLOCKED");
  assert.equal(d.attestation, null);
});

test("research candidate cannot carry its own status", () => {
  const d = evaluateEvidence(candidate({ status: "VERIFIED" }), verification(), config);
  assert.equal(d.outcome, "BLOCKED");
});

test("non-VERIFIED agent statuses are never upgraded", () => {
  for (const status of ["SOURCE_NOT_FOUND", "ARABIC_MISMATCH", "REFERENCE_MISMATCH", "AUTHENTICITY_UNCONFIRMED", "REJECTED"]) {
    const d = evaluateEvidence(candidate(), verification({ status }), config);
    assert.equal(d.outcome, "BLOCKED");
    assert.equal(d.status, status);
  }
  const review = evaluateEvidence(candidate(), verification({ status: "NEEDS_HUMAN_REVIEW" }), config);
  assert.equal(review.outcome, "HUMAN_REVIEW");
});

test("differing Arabic wording is blocked", () => {
  const d = evaluateEvidence(candidate(), verification({ arabicText: ARABIC_OTHER }), config);
  assert.equal(d.outcome, "BLOCKED");
  assert.equal(d.status, "ARABIC_MISMATCH");
});

test("non-Arabic text in the Arabic field is blocked", () => {
  const d = evaluateEvidence(candidate({ arabicText: "test" }), verification({ arabicText: "test" }), config);
  assert.equal(d.status, "ARABIC_MISMATCH");
});

test("diacritics-only difference goes to human review with both texts and the exact difference", () => {
  const d = evaluateEvidence(candidate(), verification({ arabicText: ARABIC_NO_MARKS }), config);
  assert.equal(d.outcome, "HUMAN_REVIEW");
  assert.equal(d.status, "NEEDS_HUMAN_REVIEW");
  assert.equal(d.attestation, null);
  assert.ok(d.arabicDifference);
  assert.equal(d.arabicDifference.kind, "DIACRITICS_ONLY");
  assert.equal(d.arabicDifference.candidateArabicText, ARABIC);
  assert.equal(d.arabicDifference.verificationArabicText, ARABIC_NO_MARKS);
  // ARABIC carries fatha on the first letter and dammatan + shadda on the second.
  assert.deepEqual(d.arabicDifference.diacriticDifferences, [
    { position: 0, baseCharacter: "ن", candidateMarks: ["U+064E"], verificationMarks: [] },
    { position: 1, baseCharacter: "ص", candidateMarks: ["U+064C", "U+0651"], verificationMarks: [] },
  ]);
});

test("letter, word and word-order differences are not diacritics-only", () => {
  assert.equal(compareArabic("نص تجريبي", "نص تجريبى").kind, "DIFFERENT"); // different final letter
  assert.equal(compareArabic("نص تجريبي", "نص تجريبي فقط").kind, "DIFFERENT"); // extra word
  assert.equal(compareArabic("نص تجريبي", "تجريبي نص").kind, "DIFFERENT"); // word order
  assert.equal(compareArabic("اختبار", "ٱختبار").kind, "DIFFERENT"); // alef vs alef wasla
  assert.equal(compareArabic("نَص", "نُص").kind, "DIACRITICS_ONLY");
  assert.equal(compareArabic("نص  تجريبي", " نص تجريبي ").kind, "IDENTICAL");
  const blockedDecision = evaluateEvidence(candidate(), verification({ arabicText: ARABIC_OTHER }), config);
  assert.equal(blockedDecision.arabicDifference?.kind, "DIFFERENT");
  assert.equal(blockedDecision.arabicDifference?.candidateArabicText, ARABIC);
});

test("whitespace and tatweel differences do not matter", () => {
  const d = evaluateEvidence(candidate(), verification({ arabicText: `  ${ARABIC.replace(" ", "  ")}ـ ` }), config);
  assert.equal(d.outcome, "PASSED");
});

test("reference mismatch is blocked", () => {
  const d = evaluateEvidence(
    candidate(),
    verification({ reference: { kind: "HADITH", collection: "TEST-COLLECTION", hadithNumber: "0001" } }),
    config,
  );
  assert.equal(d.status, "REFERENCE_MISMATCH");
});

test("out-of-range and inverted Quran references are blocked", () => {
  const outOfRange = { ...quranRef, surah: 115 };
  assert.equal(
    evaluateEvidence(candidate({ reference: outOfRange }), verification({ reference: outOfRange }), config).outcome,
    "BLOCKED",
  );
  const inverted = { ...quranRef, ayahStart: 5, ayahEnd: 2 };
  assert.equal(
    evaluateEvidence(candidate({ reference: inverted, gradings: [] }), verification({ reference: inverted, gradings: [] }), config).status,
    "REFERENCE_MISMATCH",
  );
});

test("hadith without a verified, attributed grading is blocked", () => {
  const none = evaluateEvidence(candidate(), verification({ gradings: [] }), config);
  assert.equal(none.status, "AUTHENTICITY_UNCONFIRMED");
  const unnamed = evaluateEvidence(candidate(), verification({ gradings: [{ grade: "TEST-GRADE", scholar: " " }] }), config);
  assert.equal(unnamed.outcome, "BLOCKED");
});

test("a researched grading not confirmed by verification is blocked", () => {
  const d = evaluateEvidence(
    candidate({ gradings: [{ grade: "TEST-GRADE", scholar: "OTHER-SCHOLAR" }] }),
    verification(),
    config,
  );
  assert.equal(d.status, "AUTHENTICITY_UNCONFIRMED");
});

test("multiple attributed gradings are preserved and pass", () => {
  const gradings = [
    { grade: "TEST-GRADE", scholar: "TEST-SCHOLAR" },
    { grade: "OTHER-GRADE", scholar: "OTHER-SCHOLAR" },
  ];
  assert.equal(evaluateEvidence(candidate(), verification({ gradings }), config).outcome, "PASSED");
});

test("source URL rules", () => {
  assert.equal(evaluateEvidence(candidate({ sourceUrl: "http://source.example/x" }), verification(), config).status, "SOURCE_NOT_FOUND");
  assert.equal(evaluateEvidence(candidate({ sourceUrl: "not a url" }), verification(), config).status, "SOURCE_NOT_FOUND");
  assert.equal(evaluateEvidence(candidate(), verification({ sourceUrl: "https://untrusted.example/x" }), config).outcome, "HUMAN_REVIEW");
  assert.equal(evaluateEvidence(candidate(), verification({ sourceUrl: "https://evilsource.example/x" }), config).outcome, "HUMAN_REVIEW");
});

test("a registered host used outside its role goes to human review", () => {
  // Quran-text host offered as a Hadith source.
  assert.equal(evaluateEvidence(candidate(), verification({ sourceUrl: "https://qurantext.example/x" }), config).outcome, "HUMAN_REVIEW");
  // Secondary source offered as primary text.
  assert.equal(evaluateEvidence(candidate({ sourceUrl: "https://secondary.example/x" }), verification(), config).outcome, "HUMAN_REVIEW");
  // Grading read from a host not registered for grading evidence.
  const gradings = [{ grade: "TEST-GRADE", scholar: "TEST-SCHOLAR", sourceUrl: "https://qurantext.example/g" }];
  const d = evaluateEvidence(candidate(), verification({ gradings }), config);
  assert.equal(d.outcome, "HUMAN_REVIEW");
  assert.match(d.reasons.join(" "), /GRADING_EVIDENCE/);
});

test("default registry is pinned: four hosts, explicit roles, no silent expansion", () => {
  assert.equal(DEFAULT_SOURCE_REGISTRY.version, "2026-11-16.1");
  assert.deepEqual(
    DEFAULT_SOURCE_REGISTRY.sources.map((s) => [s.host, [...s.roles]]),
    [
      ["quran.com", ["QURAN_TEXT"]],
      ["tanzil.net", ["QURAN_TEXT"]],
      ["sunnah.com", ["HADITH_TEXT", "GRADING_EVIDENCE"]],
      ["dorar.net", ["HADITH_TEXT", "GRADING_EVIDENCE"]],
    ],
  );
  assert.ok(Object.isFrozen(DEFAULT_SOURCE_REGISTRY) && Object.isFrozen(DEFAULT_SOURCE_REGISTRY.sources));
  assert.equal(checkSource("https://www.quran.com/x", "QURAN_TEXT", DEFAULT_SOURCE_REGISTRY).result, "OK");
  assert.equal(checkSource("https://quran.com/x", "HADITH_TEXT", DEFAULT_SOURCE_REGISTRY).result, "WRONG_ROLE");
  assert.equal(checkSource("https://notquran.com/x", "QURAN_TEXT", DEFAULT_SOURCE_REGISTRY).result, "UNREGISTERED_HOST");
  assert.equal(checkSource("https://quran.com.evil.example/x", "QURAN_TEXT", DEFAULT_SOURCE_REGISTRY).result, "UNREGISTERED_HOST");
});

test("decisions record versions, digest and corroboration for audit", () => {
  const d = evaluateEvidence(candidate(), verification(), config);
  assert.equal(d.registryVersion, "test-1");
  assert.equal(d.attestation?.registryVersion, "test-1");
  assert.match(d.evidenceDigest ?? "", /^[0-9a-f]{64}$/);
  assert.equal(d.corroboration, "DIFFERENT_HOST");
  const same = evaluateEvidence(candidate(), verification({ sourceUrl: "https://source.example/research/0000" }), config);
  assert.equal(same.corroboration, "SAME_URL");
});

test("self-verification is blocked", () => {
  const d = evaluateEvidence(candidate(), verification({ verifiedBy: "Islamic_Research_Agent" }), config);
  assert.equal(d.outcome, "BLOCKED");
});

test("missing notes or wrong evidence ID are blocked", () => {
  assert.equal(evaluateEvidence(candidate(), verification({ notes: "" }), config).outcome, "BLOCKED");
  assert.equal(evaluateEvidence(candidate(), verification({ evidenceId: "ev-2" }), config).outcome, "BLOCKED");
});

test("malformed input is blocked, not thrown", () => {
  assert.equal(evaluateEvidence(null, undefined, config).outcome, "BLOCKED");
  assert.equal(evaluateEvidence("VERIFIED", { gatePassed: true }, config).outcome, "BLOCKED");
});

test("without a configured key nothing passes", () => {
  for (const attestationKey of [undefined, "", "short"]) {
    const d = evaluateEvidence(candidate(), verification(), { ...config, attestationKey });
    assert.equal(d.outcome, "BLOCKED");
    assert.equal(d.attestation, null);
  }
});

test("attestation is bound to the exact evidence and key", () => {
  const c = candidate();
  const v = verification();
  const { attestation } = evaluateEvidence(c, v, config);
  assert.equal(verifyAttestation(attestation, candidate({ arabicText: ARABIC_OTHER }), v, KEY), false);
  assert.equal(verifyAttestation(attestation, c, verification({ notes: "changed" }), KEY), false);
  assert.equal(verifyAttestation(attestation, c, v, "another-key-0123456789abcdef0123456789"), false);
  assert.equal(verifyAttestation({ ...attestation, signature: "00" }, c, v, KEY), false);
  assert.equal(verifyAttestation({ gatePassed: true }, c, v, KEY), false);
  assert.equal(verifyAttestation(attestation, c, v, undefined), false);
});

test("one invalid record means the batch is not fully verified", () => {
  const good = { candidate: candidate(), verification: verification() };
  const bad = {
    candidate: candidate({ evidenceId: "ev-2" }),
    verification: verification({ evidenceId: "ev-2", arabicText: ARABIC_OTHER }),
  };
  const mixed = evaluateBatch([good, bad, good], config);
  assert.equal(mixed.fullyVerified, false);
  assert.deepEqual(mixed.decisions.map((d) => d.outcome), ["PASSED", "BLOCKED", "PASSED"]);
  assert.equal(evaluateBatch([good, good], config).fullyVerified, true);
  assert.equal(evaluateBatch([], config).fullyVerified, false);
});
