# Source Registry and Review Plan — Phase 0

**Principle:** every Quran or hadith word shown or spoken comes from a pinned, licensed registry record — never from model memory or search snippets. Licences below were only partly verified; each needs owner/legal confirmation before ingestion.

## 1. Candidate datasets

| Content | Candidate | Licence (as found) | Verified? | Notes |
|---|---|---|---|---|
| Quran Arabic (Uthmani) | **Tanzil Quran Text** (Uthmani / Simple), pinned version | CC BY 3.0 **with "verbatim only, no changes"**; must credit Tanzil Project and link tanzil.net | [S] — Tanzil credits page via search | Strong default. Store SHA-256 of the full file; never alter diacritics. |
| Quran translations | Per-translator copyright (Tanzil hosts many; each has its own terms) | Varies — many **not** licensed for commercial/monetized use | NO | Founder must pick named translation(s) per language (English/Tamil) and obtain written permission where required. |
| Quran recitation audio | Licensed reciter recordings | Varies | NO | Not in pilot. |
| Hadith (Arabic + translation + grading) | sunnah.com API / dataset; other scholarly editions | **Not verified today** | NO | Pilot recommendation: **Quran-only for automated publishing**; hadith only with human scholarly sign-off per item until a licensed, graded dataset is confirmed. |
| Quran API (quran.com / Quran Foundation, alquran.cloud) | Convenience APIs | Terms not verified | NO | Use only as cross-check, not as runtime dependency. |

## 2. Record schema (minimum)
`source_id`, `type` (quran|hadith), `edition_id` + version + file SHA-256, `locator` (surah:ayah | collection/book/number), `arabic_text` (exact), `translation_id` + `translation_text`, `grading` + grader (hadith), `context_note`, `license_id`, `attribution_text`, `reviewer_id`, `review_status` (PENDING|APPROVED|REJECTED|DISPUTED), `approved_at`, `allowed_uses` (on_screen|narration|description).

## 3. Mechanical checks (block on any failure)
1. Locator exists in pinned edition.
2. Rendered Arabic == registry Arabic after Unicode NFC normalisation, byte-equal (no diacritic loss, correct RTL shaping verified by rendering a reference image diff).
3. Narration script quoted segments == approved translation text (or flagged as paraphrase, which is never presented in quotation marks).
4. Captions transcript (STT of the final audio) ≈ script (WER threshold) — catches TTS insertions.
5. Hadith: grading present and in allowed set (e.g. ṣaḥīḥ/ḥasan per named grader); "da'īf"/"mawḍū'"/unknown → block.
6. Licence permits the use class and attribution string appears in description.
7. Topic classifier: disputed fiqh, sectarian, political or prophet-depiction topics → HOLD.

## 4. Review workflow
- **Registry approval (one-time per record):** qualified reviewer (named by founder) approves each record into `APPROVED`. Only approved records are usable by agents.
- **Per-video:** if every claim maps to approved records and passes checks, the video may auto-advance **within the founder-approved autonomy scope**; anything else → `HOLD_FOR_REVIEW` with a diff view in the dashboard.
- **Corrections:** a published error triggers unpublish-to-private, incident log, registry fix, and re-review of all videos using that record.

## 5. Negative test corpus (≥30 before Phase 2 exit)
Fabricated hadith with real-looking citation; real hadith with wrong number; ayah with missing/extra diacritics; correct ayah, wrong translation; out-of-context ayah (e.g. war verses as general command); weak hadith presented as authentic; model-paraphrase in quotes; Arabic rendered LTR/disconnected; TTS inserted honorific/word; unlicensed translation; prophet depiction prompt; disputed fiqh ruling as consensus.

## 6. Owner decisions needed
Named Quran edition; named translation(s) per launch language + permission; hadith scope (recommend excluded from auto-publish in pilot); reviewer name/qualification and SLA.
