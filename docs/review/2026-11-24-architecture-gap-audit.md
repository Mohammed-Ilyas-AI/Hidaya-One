# Architecture gap audit — response to the external review of the Autonomy Blueprint (24 Nov 2026)

Scope: each finding checked against the repository at commit `2790ef0`. Only the OAuth repair was implemented
(`83da80a`, plus `--verify` in this change). Everything else below is a reported gap with a planned fix,
**not yet changed**. Publishing stays **DRAFT_ONLY**.

## Status of YouTube integration (evidence-based)

| Capability | Status | Evidence |
|---|---|---|
| Google Cloud project `hidaya-one-youtube` | Created | client JSON supplied by founder |
| YouTube Data API v3 | Enabled (founder-reported) | not independently verified from this session |
| Desktop OAuth client | Created | client JSON, type `installed` |
| Loopback callback | **Fixed in code, not yet proven live** | `scripts/youtube-auth.mjs`; 6 tests vs. mock Google |
| Refresh token | Not yet obtained | needs the founder's sign-in on Windows |
| Token survives restart | Code ready (`--verify`), not yet proven live | test 2 |
| Channel identity check | Not yet proven live | read-only `channels.list mine=true` in both modes |
| Private upload test | Not performed | publisher is DRAFT_ONLY |
| Scheduling | Not enabled | — |

The blueprint previously labelled YouTube "ready, draft-only". That overstated it; corrected to the table above.

## Findings

| # | Finding (review) | Verdict | Evidence in code | Planned fix |
|---|---|---|---|---|
| 1 | OAuth callback never listened | **Agree — fixed** | old script had no server; new one: loopback `127.0.0.1:0`, verified before browser, state + PKCE S256, offline, single callback, lock, timeout, 0600 file, no secrets logged | Founder runs sign-in + `--verify` on Windows |
| 2 | Testing-mode refresh tokens expire in 7 days | **Agree** | docs told founder to publish the app; not verified | Confirm *In production* before L1; `--verify` reports `invalid_grant` with this hint; separate prod project when Cloud Run goes live |
| 3 | L0 bypass in the workflow | **Partly agree** | Code enforces DRAFT_ONLY (`src/agents/publisher.ts:58`); the **diagram** skipped the gate; there is no per-video release approval | Diagram corrected. Add `ReleaseApproval` bound to `scriptHash` + `renderHash` + channel + platform + visibility; Distributor requires it at L1+ |
| 4 | Approval is a status, not content-bound | **Agree** | `produce.ts:62` auto-promotes a verse to `AI_APPROVED`; nothing approves a specific render | Rename to `CONTEXT_REVIEWED`; add the status ladder (SOURCE_* → CONTEXT_REVIEWED → SCHOLAR_APPROVED → SCRIPT/RENDER/RELEASE_APPROVED); only humans set SCHOLAR_ and RELEASE_ |
| 5 | Byte equality ≠ religious correctness; normalisation can hide differences | **Agree** | `src/lib/util.ts:14` strips only waqf marks U+06D6–06DC, U+06DE, U+06E9 before comparing; original bytes and SHA-256 are kept | Document this as the single approved comparison rule; add fields: riwayah (Hafs ʿan ʿĀṣim), script standard, edition IDs, retrieval date, approved display text hash |
| 6 | Segmentation needs human-approved maps | **Agree** | waqf-only splits + aligned translation or whole-verse fallback (`src/hf/timing.ts`) | Store each verse's segment map in the registry; first use requires human approval |
| 7 | Recitation rights | **Agree** | flagged as unconfirmed in every run's licence list | `rights` record per recording; block L1+ without it |
| 8 | Upload and scheduling in one call | **Agree** | `publishPrivate(..., { publishAt })` sets both at insert | Split `uploadPrivate()` and `scheduleApprovedVideo()` (`videos.update` with `privacyStatus: private` + future `publishAt`; reject past times) |
| 9 | Hidden-tag de-dup is secondary; uploads need a durable lifecycle | **Agree** | ledger written only after success (`publisher.ts:85`) | Persist UPLOAD_CREATED → SESSION_STARTED → RESPONSE_RECEIVED → VIDEO_ID_RECORDED → VERIFIED; reconcile before any retry |
| 10 | Learning loop vs. YouTube derived-metrics policy | **Agree — not verified by me** | loop not built | Keep disabled; review the derived-metrics policy and amendment before building; add `yt-analytics.readonly` only then; 30-day retention handling |
| 11 | Asset rights records | **Agree** | `library/footage.json` has stock ID + title only | Add licence type, acquisition date, permitted use, attribution, file SHA-256 |
| 12 | Inauthentic/repetitive content risk | **Agree** | one template, varied footage | Vary substance: verse explanation, practical question, reflection formats |
| 13 | Cost must be enforced, not reported | **Agree** | `maxCostUsd` exists only in the blueprint sketch | `CostRecord` + reservation before each model call; daily/monthly caps (founder budget ₹2,000/month) |
| 14 | Workflows vs. ADK must not both own state | **Agree** | not yet deployed | Cloud Workflows owns business state; ADK runs bounded steps only |
| 15 | Only the Distributor may write to platforms | **Agree** | true today in code (only `publisher.ts` calls the upload API) | Enforce via IAM/secret access at deploy time, not just code layout |
| 16 | "33 checks" must be enumerated | **Agree** | ids are in each run's `qc.json` | Publish the check catalogue; add shaping/RTL rendering checks beyond glyph coverage |

## Security note from the review
An authorization code from the earlier failed attempt was visible in a browser URL that was shared outside this
session. Codes are single-use and short-lived, but to be safe: revoke "Hidaya One" at
https://myaccount.google.com/permissions before signing in again. No code or token has been sent to this session.
