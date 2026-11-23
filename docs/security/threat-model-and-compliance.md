# Threat Model and Compliance — Phase 0

## Assets
YouTube channel (reputation, OAuth refresh token), religious accuracy, Google Cloud billing, source registry integrity, founder trust.

## Threats and mitigations

| # | Threat | Impact | Mitigation |
|---|---|---|---|
| T1 | Fabricated/altered verse or hadith published | Severe reputational/religious harm | Registry-only text, byte-equality check, fail-closed graph branch, human review for non-approved classes (source-governance doc) |
| T2 | **Accidental public upload** (API default is public since 2026-11-02) | Unreviewed content live | Publisher always sets `private`; unit test asserts payload; release manifest required to flip visibility |
| T3 | Duplicate uploads on retry / uncertain response | Spam signal, quota waste | Idempotency key, tag in description, reconcile via `youtube.readonly` before retry; at most one in-flight upload per job |
| T4 | Runaway spend (retry loops, leaked key) | Bill shock | Ledger reservation, bounded retries, per-service spend caps, remove API-key path, budget alerts |
| T5 | Prompt injection from web pages / search results into agents | Agent bypasses gates | Retrieved text treated as data; gates are deterministic code, not LLM decisions; agents have no tool to change billing/IAM/publish state |
| T6 | OAuth refresh-token theft | Channel takeover | Secret Manager, single service account accessor, minimal scopes, no logging of tokens, rotation runbook; consent screen in **Production** status (Testing-mode refresh tokens expire after 7 days) |
| T7 | Public invocation of expensive endpoints | Cost abuse | Cloud Run `--no-allow-unauthenticated` (dev service confirmed 403 ✅; agent-api to verify), Workflows-only invoker SA |
| T8 | Copyright: unlicensed translation, font, music | Strikes, demonetisation | Licence field enforced; only Google-generated or licensed audio; licensed Arabic font |
| T9 | Inauthentic/repetitive-content policy | YPP rejection | Topic-diversity checks, varied formats, real educational narrative per video, no template-only output; human editorial review of series design |
| T10 | Undisclosed realistic AI content | Labels/penalties | Set `containsSyntheticMedia=true` when Omni footage is realistic; accept C2PA auto-label (cannot be removed) |
| T11 | Prophet/companion depiction, sensitive imagery | Community harm | Prompt deny-list + multimodal QA classifier + reviewer |
| T13 | VEED API key leak (key was pasted in chat 2026-11-23) | Credit drain | Rotate key; store only as network secret / Secret Manager; keep VEED prepaid balance small |
| T14 | Avatar impersonates scholar or depicts prophet | Severe community harm | Avatar allow-list (founder/owned character only), reviewer approval of avatar image |
| T15 | Expiring VEED output URLs / third-party retention | Lost assets, data retention | Copy to GCS immediately; `X-Veed-Store-IO: 0`; short signed input URLs |
| T12 | Supply chain (deps, images) | Compromise | Pinned deps, Artifact Registry scanning, Cloud Build provenance |

## Compliance checklist
- [ ] OAuth consent screen published (Production), scopes: `youtube.upload`, `youtube.readonly`, `yt-analytics.readonly`.
- [ ] YouTube API Services Terms & Developer Policies accepted; data retention per policy.
- [ ] AI disclosure policy written into publisher.
- [ ] Every translation/dataset licence documented with evidence.
- [ ] Spend caps on `aiplatform`, `generativelanguage`, `run`; project budget alerts.
- [ ] No secrets in repo (`.env` git-ignored ✅); secret scanning in CI.
- [ ] Least-privilege service accounts per service; no Owner/Editor on runtime SAs.
- [ ] Logging redaction for tokens and personal data.
- [ ] Incident runbook: unpublish, revoke token, pause scheduler (kill switch).
