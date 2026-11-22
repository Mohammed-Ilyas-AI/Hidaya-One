# Google Product / API Matrix — Phase 0

**Checked:** 2026-11-22 (UTC) · **Method:** official pages fetched directly where the session network allowed (`docs.cloud.google.com`, `developers.google.com`, `support.google.com`); other facts from web search, marked **[secondary]**. Nothing below was tested against the founder's project. "Account verified" is **NO** for every row unless stated.

Status key: `CONFIRMED-DOC` = read on an official page today · `SECONDARY` = only third-party/search evidence · `UNVERIFIED` = could not check · `ACCOUNT-NO` = not proven usable by this project.

## 1. Video generation

| Product | Official API? | Model ID / endpoint | Length | 9:16 | Audio | Resolutions | Region | Price (published) | Evidence | Fit |
|---|---|---|---|---|---|---|---|---|---|---|
| **Gemini Omni 1.2 Flash** | Yes — Agent Platform **Interactions API** (`POST https://aiplatform.googleapis.com/v1beta1/projects/{P}/locations/global/interactions`). *Not* GenerateContent. | `gemini-omni-1.2-flash` (GA 2026-11-05, retirement ≥ 2027-11-05) | 3–15 s (3–10 s first/last-frame mode); up to 3 videos/prompt | Yes (`16:9`, `9:16`) | Yes — speech, music, SFX | 360p, 720p (default), 1080p, 4K | `global` only | $0.07/s at 720p; billed as output tokens (≈5,792 tok/s × $12/M) **[secondary — Google blog not reachable from this session]**; 1080p/4K price not published | CONFIRMED-DOC (spec) / SECONDARY (price) | **Primary candidate** |
| Omni preview models | Yes (same API) | `gemini-omni-1.1-flash-preview`, `gemini-omni-flash-preview` | 3–10 s | Yes | Yes | preview: 720p only | global | ~$0.10/s (1.1) [secondary] | CONFIRMED-DOC | Do not use (preview, superseded) |
| **Veo 3.1 / Fast / Lite** | Yes — `predictLongRunning` on Agent Platform; also Gemini API | `veo-3.1-generate-001`, `veo-3.1-fast-generate-001`, `veo-3.1-lite-generate-001` | 4, 6 or 8 s per clip (two clips needed for 15 s) | Yes (`aspectRatio: "9:16"`) | Yes | 720p / 1080p (4K only Veo 3.1 preview) | per Agent Platform regions | Lite $0.05/s 720p, Fast $0.10/s, Std $0.40/s **[secondary, Gemini API rate card]** | CONFIRMED-DOC (IDs/params) / SECONDARY (price) | Fallback / cost alternative (Lite) |
| **Google Flow** | **No official public API found** | — | — | — | — | — | — | Consumer AI credits (Google One) | SECONDARY | Manual only. Third-party wrappers (useapi.net, gflow-cli calling a private `aisandbox-pa` endpoint) **rejected** — unofficial, ToS risk |
| **Google Vids** | **No public developer API found** | — | — | — | — | — | Workspace | Workspace plan | SECONDARY | Manual editing only |

Key facts from the Omni doc (`docs.cloud.google.com/.../omni-1-2-flash`, last updated 2026-11-20): system instructions, structured output, function calling, grounding **not supported**; **C2PA Content Credentials supported** (matters for YouTube auto-labelling, see §5); output inline base64 or `delivery: "uri"` to a `gs://` bucket (use GCS for anything ≥720p).

## 2. Text reasoning, grounding, images

| Product | Model ID | Status | Price | Evidence | Notes |
|---|---|---|---|---|---|
| Gemini 3.8 Flash | `gemini-3.8-flash` | GA (per secondary reporting) | $0.75 / $3.75 per 1M in/out **until 2026-12-31**, then **$1.50 / $7.50 from 2027-01-01**; thinking tokens billed as output | SECONDARY | Already configured in both deployed Cloud Run services and `agent.ts`. Pilot will be billed at 2027 rates. |
| Google Search grounding / URL context | ADK `GOOGLE_SEARCH`, `URL_CONTEXT` tools | Used in `agent.ts` | Grounding has its own per-query charge — **not verified** | UNVERIFIED | Discovery aid only; never authority for scripture |
| Image generation (Nano Banana family / Imagen) | not verified today | — | — | UNVERIFIED | Needed only for thumbnails/motion-graphic plates; research in Phase 3 |

## 3. Speech

| Product | Model ID | Status | Languages | Price | Evidence |
|---|---|---|---|---|---|
| Gemini 3.8 Flash TTS | Agent Platform API & Agent Studio only — **not** via Cloud Text-to-Speech API | GA (doc note) | incl. `ta-IN` Tamil **GA**, `en-IN`, `en-US`, `ar-EG`, `ar-001` | $9 / 1M audio tokens to 2026-12-31, **$18 from 2027-01-01**; 25 audio tok/s → 15 s ≈ 375 tok ≈ **$0.007** | CONFIRMED-DOC (availability/languages) / SECONDARY (price) |
| Gemini 3.8 Flash-Lite TTS | same | GA | same | $6 → $12 / 1M audio tok | SECONDARY |
| `gemini-2.5-flash-tts`, `gemini-2.5-pro-tts`, `gemini-3.1-flash-tts-preview` | Cloud TTS API | mixed GA/Preview | see doc | per Cloud TTS pricing | CONFIRMED-DOC |

**Rule unchanged:** no TTS-generated Quranic recitation at pilot launch; TTS narrates translation/explanation only.

## 4. Agent framework and infrastructure

| Product | Finding | Evidence |
|---|---|---|
| ADK 2.x | Graph `Workflow` is the supported orchestration; `SequentialAgent`/`ParallelAgent`/`LoopAgent` deprecated (still run; removal date not announced). Known gap: a `Workflow` is not a `BaseAgent` and cannot sit in `sub_agents` (adk-python issue #5872, v2.1.0). Repo pins `@google/adk ^2.4.0` (TypeScript). | SECONDARY (adk.dev not reachable from this session) |
| Google Agents CLI | Scaffolding/eval/deploy helper; not verified today. Optional developer tool only. | UNVERIFIED |
| Cloud Run / Jobs, Workflows, Scheduler, Tasks, Firestore, GCS, Secret Manager, Monitoring | Standard GA services. Cloud Run already used by the project (see audit). | Account partially verified (Cloud Run only) |
| **Cloud Billing spend caps** | Per-project, per-service, monthly. **Eligible services only: Gemini API (`generativelanguage`), Agent Platform (`aiplatform`), Cloud Run, Cloud Run functions.** Computed on **gross cost before credits**; enforcement not instant, overage billed; lifting manually disables it for the rest of the month; reset on the 1st. Firestore, GCS, Workflows, Logging are **not** capped. | CONFIRMED-DOC (page updated 2026-11) |

## 5. YouTube

| Item | Finding (official, checked today) |
|---|---|
| Upload | `videos.insert`, resumable upload, scope `youtube.upload` sufficient for upload; max 256 GB. |
| **Default privacy (changed 2026-11-02)** | Unverified API projects are **no longer locked to private**. If `status.privacyStatus` is omitted the video is **PUBLIC**. ⇒ Publisher must always send `privacyStatus: "private"` explicitly and a test must assert it. |
| Synthetic media | `status.containsSyntheticMedia` is settable via API. |
| Paid placement (changed 2026-11-16) | `paidProductPlacementDetails.hasPaidProductPlacement` no longer defaults to false — send `false` explicitly. |
| Shorts thumbnails (2026-11-03) | `thumbnails.set` now supports custom Shorts thumbnails after processing (`shortsAspectRatio`). |
| Quota | Default: **100 `videos.insert`/day** (own bucket), 100 `search.list`/day, 10,000 units/day for all else; resets midnight PT. Ample for 1–3 uploads/day. |
| View counting (2026-11-16) | Public view counts include co-views; engaged views do not. Use engaged views / retention as KPIs. |
| AI disclosure | Required for realistic AI content. YouTube **auto-labels content carrying C2PA metadata** and such labels **cannot be removed**. Omni outputs support C2PA ⇒ expect a permanent AI label on Omni-based Shorts; plan for it and disclose honestly. |
| Inauthentic content (monetization) | Ineligible: "AI-generated content made with generic or unoriginal templates giving the impression of mass production", templated storylines, scrolling text/slideshows with minimal narrative. Directly constrains the daily-series design. |
| YPP from 2027-02-01 | Activity: 1,000 watch hours/365 d **or** 1M Shorts views/90 d **or** 2 long-form / **5 Shorts per 90 days**; new module terms must be accepted by 2027-01-31 (only relevant once in YPP). |

## Sources (fetched 2026-11-22)

- Omni 1.2 Flash model page (updated 2026-11-20): https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/omni-1-2-flash
- Generate videos from text (Omni + Veo params): https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/video/generate-videos-from-text
- Generate videos from references: https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/video/generate-videos-from-references
- Gemini-TTS: https://docs.cloud.google.com/text-to-speech/docs/gemini-tts
- Spend caps: https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps
- `videos.insert`: https://developers.google.com/youtube/data/reference/rest/v3/videos/insert
- Revision history: https://developers.google.com/youtube/data/revision_history
- Quota calculator: https://developers.google.com/youtube/data/determine_quota_cost
- OAuth guide: https://developers.google.com/youtube/data/guides/authentication
- Analytics metrics: https://developers.google.com/youtube/analytics/metrics
- Monetization policies: https://support.google.com/youtube/answer/1311392
- YPP 2027 changes: https://support.google.com/youtube/answer/12843009
- AI disclosure: https://support.google.com/youtube/answer/14328491
- Secondary (pricing, Flow/Vids, ADK): search results 2026-11-22 incl. https://blog.google/innovation-and-ai/technology/ai/veo-3-1-lite/, https://blog.google/innovation-and-ai/technology/developers-tools/gdp-premium-ai-pro-ultra/, https://github.com/google/adk-python/issues/5872, https://developers.googleblog.com/en/why-we-built-adk-20/

**Not reachable from this session (must be re-checked by owner or after allow-listing):** `cloud.google.com` (blog, Agent Platform pricing, TTS pricing), `aistudio.google.com/docs/pricing` (ai.google.dev pricing redirects there), `adk.dev`, `google.github.io/agents-cli`, `one.google.com`.
