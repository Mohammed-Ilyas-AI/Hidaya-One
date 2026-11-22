# Phase 0 Decision Memo — GO / CONDITIONAL GO / NO-GO

**Date:** 2026-11-22 · **Recommendation: CONDITIONAL GO**

## Why it can work
- A suitable official API exists: **Gemini Omni 1.2 Flash** is GA (2026-11-05), produces 3–15 s **9:16** video with audio at 720p, via the Agent Platform Interactions API. No reliance on Flow/Vids is needed (neither has an official API).
- Gemini 3.8 Flash TTS is GA with **Tamil (ta-IN)** and English; narration cost per Short is negligible (<$0.01).
- YouTube quotas comfortably cover 1–3 uploads/day.
- The Google Cloud project already exists with two IAM-protected Cloud Run services and Secret Manager in use.

## Conditions (all must be met before build)
1. **Read access:** this session cannot authenticate to Google Cloud (gcloud has no credential; only a Cloud Run read connector works). Owner runs `scripts/phase0-readonly-audit.sh` or grants read-only access — needed to confirm billing, enabled APIs, Omni quota and IAM.
2. **Omni eligibility** for this project confirmed (Model Garden / quota page) — published availability ≠ project access.
3. **Scope decision** — the repo (Tamil, 3 × 30–45 s/day, Instagram) and blueprint (1 × 15 s/day) conflict. At 3 × 30–45 s/day Omni costs ≈ $190–$285/month in video alone. **$50 is only feasible at 1 Short/day with a mixed Omni + motion-graphics policy (≈ $42/month).**
4. **Language** and **named Quran translation with licence** chosen; **hadith excluded from auto-publish** until a licensed graded dataset and reviewer exist.
5. **Spend caps** on Agent Platform, Gemini API and Cloud Run; consolidate off the API-key path.
6. **Implementation language** chosen (recommend Python per blueprint; TypeScript acceptable).

## Key risks discovered today
| Risk | Severity |
|---|---|
| YouTube API uploads now default to **public** if privacy omitted (since 2026-11-02) | High — mitigated by explicit `private` + test |
| Omni output carries C2PA → **non-removable AI label** on YouTube | Medium — accept & disclose |
| YouTube "inauthentic content" rule targets templated mass-produced AI Shorts | High for monetisation — vary format, add genuine educational narrative |
| Gemini 3.8 Flash and TTS prices **double on 2027-01-01** [secondary] | Medium — budget uses 2027 prices |
| Interactions API is `v1beta1` | Medium — adapter + contract tests |
| Spend caps don't cover Firestore/GCS/Workflows and aren't instant | Low–Medium |
| Pricing pages not reachable from this session; prices are secondary-sourced | Medium — reconfirm before M4 |

## Missing owner confirmations
Language · cadence/length · Python vs TS · YouTube channel ID & OAuth client · Quran translation + licence · reviewer · hadith scope · budget currency & cap · source of currently deployed images · AI Pro credit activation.

## Expected first-month cash outlay
≈ **$40–50 + tax** (Scenario C, 2027 prices). Before the pilot: ≈ **$5–15** of test generations during M4 (≈ 5–10 Omni clips), requiring explicit approval.

## Recommended build order & first milestone
M0 (owner unblock) → M1 Foundation → M2 Source registry → M3 Content graph → M4 Production → M5 YouTube → M6 Ops → M7 Pilot (see `docs/plan/implementation-backlog.md`).

**First milestone (M1, no paid calls):** repository skeleton + typed contracts + idempotent job store + cost-reservation gate + CI, all tested against emulators. Acceptance: duplicate scheduler invocation creates exactly one job; overspend reservation is denied; kill switch blocks all paid adapters.

**STOPPED. Awaiting explicit approval before any paid call, API enablement, IAM/OAuth change, deployment or upload.**
