// Offline tests (no network, no paid calls): the verification and editorial gates must fail closed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deterministicChecks } from "../src/agents/verification.ts";
import { editorialOk } from "../src/agents/script.ts";
import { textChecks } from "../src/agents/qc.ts";
import { buildStoryboard } from "../src/agents/creative.ts";
import { stripPauseMarks, sha256 } from "../src/lib/util.ts";
import type { AyahRecord } from "../src/types.ts";

const fixture = (): AyahRecord => JSON.parse(readFileSync("tests/fixtures/quran-2-153.json", "utf8"));
const verdict = (r: AyahRecord) => deterministicChecks(r).some((c) => c.status === "FAIL") ? "BLOCKED" : "VERIFIED";
const ctx = { runId: "t", topic: "sabr", outDir: "/tmp", textModel: "x", ttsModel: "x", ttsVoice: "x", logs: [] };

test("real 2:153 from two sources verifies (pause marks only differ)", () => assert.equal(verdict(fixture()), "VERIFIED"));

test("a single changed diacritic blocks", () => {
  const r = fixture(); const before = r.arabicCrossCheck.text;
  r.arabicCrossCheck.text = before.replace("\u0652", "\u064E");   // first sukun → fatha
  assert.notEqual(r.arabicCrossCheck.text, before);
  assert.equal(verdict(r), "BLOCKED");
});

test("a changed letter blocks", () => {
  const r = fixture(); const before = r.arabicCrossCheck.text;
  r.arabicCrossCheck.text = before.replace("\u0645", "\u0639");   // first meem → ain
  assert.notEqual(r.arabicCrossCheck.text, before);
  assert.equal(verdict(r), "BLOCKED");
});

test("text modified after fetch blocks (hash)", () => {
  const r = fixture(); r.arabic.text += " ";
  assert.equal(verdict(r), "BLOCKED");
});

test("wrong ayah from the second source blocks", () => {
  const r = fixture(); r.arabicCrossCheck.text = "ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ"; r.arabicCrossCheck.sha256 = sha256(r.arabicCrossCheck.text);
  assert.equal(verdict(r), "BLOCKED");
});

test("missing recitation blocks", () => { const r = fixture(); delete r.recitation; assert.equal(verdict(r), "BLOCKED"); });

test("pause-mark normalisation keeps letters and harakat", () => {
  assert.equal(stripPauseMarks("وَٱلصَّلَوٰةِ ۚ إِنَّ"), "وَٱلصَّلَوٰةِ إِنَّ");
});

test("editorial hooks may not contain Arabic, quotes, or exceed length", () => {
  assert.equal(editorialOk("பொறுமை தளர்கிறதா?", "ta"), true);
  assert.equal(editorialOk("Is your patience fading?", "en"), true);
  assert.equal(editorialOk("Remember: إِنَّ ٱللَّهَ مَعَ", "en"), false);
  assert.equal(editorialOk('"Allah is with the patient"', "en"), false);
  assert.equal(editorialOk("x".repeat(60), "en"), false);
});

test("QC: on-screen scripture must match its source verbatim", () => {
  const rec = fixture();
  const sb = buildStoryboard(ctx, rec, { hookTa: "பொறுமை தளர்கிறதா?", hookEn: "Is your patience fading?", author: "t", narrationTa: null });
  const rendered = Object.fromEntries(sb.segments.map((s) => [s.id, s.text]));
  assert.ok(!textChecks(sb, rec, rendered).some((c) => c.status === "FAIL"));
  const tampered = { ...rendered, verse: rendered.verse.replace("\u064E", "") };   // drop one fatha
  assert.notEqual(tampered.verse, rendered.verse);
  assert.ok(textChecks(sb, rec, tampered).some((c) => c.id === "text.verse.rendered-exact" && c.status === "FAIL"));
  sb.segments.find((s) => s.id === "take_en")!.text = "Allah loves the patient.";   // plausible but not in the source
  const r2 = Object.fromEntries(sb.segments.map((s) => [s.id, s.text]));
  assert.ok(textChecks(sb, rec, r2).some((c) => c.id === "text.take_en.matches-source" && c.status === "FAIL"));
});
