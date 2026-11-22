# Implementation Backlog — ordered (starts only after Phase 0 approval)

Estimates are engineering-days for one developer with Claude Code; indicative only.

## M0 — Owner unblock (founder, ~1–2 h)
| ID | Task | Acceptance |
|---|---|---|
| M0.1 | Run `scripts/phase0-readonly-audit.sh` in Cloud Shell, share redacted output | Audit doc rows move from NOT_CHECKED to CONFIRMED/DENIED |
| M0.2 | Decide: language, cadence/length, Python vs TS, hadith scope, reviewer, Quran translation | Recorded in `docs/decisions/` |
| M0.3 | Create spend caps + budget alerts (values in budget doc) | Screenshot / `gcloud billing budgets list` output |
| M0.4 | Give dev environment read access (Viewer + Billing Viewer SA, or allow-list hosts) | `gcloud projects list` works read-only |

## M1 — Foundation (4–5 d) — depends M0.2
| ID | Task | Acceptance |
|---|---|---|
| 1.1 | Repo restructure per blueprint §12; pinned deps; lint/type/test CI | CI green on empty skeleton |
| 1.2 | Contracts: Job, SourceRecord, Script, Storyboard, CostReservation, ReleaseManifest, ModelCapabilityRecord | Schema tests incl. invalid fixtures |
| 1.3 | Firestore + GCS adapters with emulator tests; idempotent job creation | Duplicate scheduler call → one job |
| 1.4 | Cost ledger + reservation gate + kill switch | Tests: overspend, expired reservation, kill switch |
| 1.5 | Terraform for SAs, buckets, Firestore, Scheduler (plan only) | `terraform plan` reviewed, not applied |

## M2 — Source registry & verification (4–5 d) — depends M1, M0.2
| 2.1 | Ingest pinned Tanzil edition + chosen translation with SHA-256 | Hash test; locator lookup test |
| 2.2 | Deterministic verifier (exact text, licence, grading, paraphrase marking) | **30+ negative tests all block** |
| 2.3 | Review queue + approval states | Unapproved record unusable by agents |

## M3 — Content intelligence (3–5 d) — depends M2
| 3.1 | ADK 2.x graph Workflow: strategist → researcher → verifier node → script → policy node | Failing verifier always routes to HOLD (test) |
| 3.2 | Prompt/eval harness (ADK eval) with golden + adversarial sets | Eval report committed |

## M4 — Production (4–5 d) — depends M3, **paid-call approval**
| 4.1 | `VideoGenerator` port: Omni adapter (Interactions API, GCS delivery) + motion-graphic adapter | One real 15 s 9:16 720p Omni clip; cost recorded vs estimate |
| 4.2 | Gemini TTS adapter (launch language) | Pronunciation review sample approved |
| 4.3 | Cloud Run Job renderer: FFmpeg + exact Arabic/translation overlay | Pixel/glyph check vs reference |
| 4.4 | QA: STT-vs-script, black frames, loudness, safe areas, multimodal policy check | Bad fixtures rejected |
| 4.5 | Three varied private end-to-end videos | Founder review sign-off |

## M5 — YouTube (3–5 d) — depends M4, OAuth approval
| 5.1 | OAuth (Production consent), token in Secret Manager | Refresh works after 8 days |
| 5.2 | Private resumable upload with explicit fields; processing poll; reconciliation | Retry-chaos test → zero duplicates |
| 5.3 | publishAt scheduling from signed manifest only | Unsigned manifest rejected |
| 5.4 | Analytics collector | Daily metrics stored |

## M6 — Ops & dashboard (3–4 d)
Firebase-hosted control center (queue, review diff, budget, kill switch), alerts, runbooks, 7-day unattended staging rehearsal.

## M7 — Controlled pilot (30 d)
Review-first publishing → founder-approved autonomy scope → weekly reports.

**Total build before pilot:** ≈ 21–29 engineering days.
