// Offline tests for phrase planning: splits must be exact substrings, follow the verse's own pause marks,
// and never pair an Arabic phrase with a translation piece that does not mean the same thing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { splitArabic, splitTranslation, timePhrases } from "../src/hf/timing.ts";

const r = JSON.parse(readFileSync("tests/fixtures/quran-2-153.json", "utf8"));
const AR = r.arabic.text, TA = r.translations.find((t: any) => t.lang === "ta").text, EN = r.translations.find((t: any) => t.lang === "en").text;

test("2:153 splits only at its waqf: 2 phrases, the 1st ending on ۚ", () => {
  const p = splitArabic(AR).map((w) => w.join(" "));
  assert.equal(p.length, 2);
  assert.equal(p.join(" "), AR);                        // reassembles byte-for-byte
  assert.ok(p[0].endsWith("ۚ"));                    // the pause mark stays with its phrase
});

test("a verse with no waqf is never split (2:152 regression: 'washkuru | li' was cut mid-meaning)", () => {
  assert.equal(splitArabic("فَٱذْكُرُونِىٓ أَذْكُرْكُمْ وَٱشْكُرُوا۟ لِى وَلَا تَكْفُرُونِ").length, 1);
});

test("translations split into exact substrings at the matching sentence break", () => {
  const ta = splitTranslation(TA, [0.64, 0.36])!, en = splitTranslation(EN, [0.64, 0.36])!;
  for (const x of ta) assert.ok(x.length > 0 && TA.includes(x));
  for (const x of en) assert.ok(x.length > 0 && EN.includes(x));
  assert.equal(en[0], "O you who have believed, seek help through patience and prayer.");
  assert.equal(en[1], "Indeed, Allah is with the patient.");
  assert.ok(ta[0].endsWith(";."));
});

test("translation split refuses when there is no matching sense break", () => {
  assert.equal(splitTranslation("So remember Me I will remember you and be grateful to Me and do not deny Me", [0.5, 0.5]), null);
});

test("phrase times snap to the deepest pause near the expected boundary", () => {
  const env = Array(250).fill(-6); env[115] = -35;       // 10 s at 40 ms; a clear pause at 4.6 s
  const t = timePhrases([["a", "b"], ["c", "d"]], env);
  assert.equal(t[0].end, 4.6); assert.equal(t[1].start, 4.6); assert.equal(t[1].end, 10);
});
