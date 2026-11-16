# Free tools matrix

Audit date: 2026-11-16. Companion to `GOOGLE_ECOSYSTEM_AUDIT.md`, which holds
the sources and explains the evidence levels.

## Classifications

| Class | Meaning |
| --- | --- |
| `FREE` | No charge and no quota that matters at Hidaya One's volume |
| `INCLUDED_IN_EXISTING_SUBSCRIPTION` | Covered by Google AI Pro, if the owner confirms the plan |
| `FREE_TIER_WITH_LIMITS` | Free up to a stated limit, charged beyond it |
| `PAID_API` | No free API usage |
| `UNKNOWN_REQUIRES_OWNER_CONFIRMATION` | Could not be verified in this audit |

Nothing is marked free because a website or playground opens. A tool that is
free to use by hand but has no API is marked manual.

"Verified" column: **Google** = Google-owned page via search excerpt.
**Meta** = Meta page. **3rd** = third party only. **Repo** = checked in this
repository. **No** = not verified.

Planning volume: 3 Shorts a day, about 90 a month, 30–45 seconds each.

## AI reasoning and research

| Tool | Hidaya One use | Subscription entitlement | Free quota | API | Region | Authentication | Paid when | Verified | Class | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Gemini Developer API, Flash-Lite | Agents | None. Plan benefits stop at the AI Studio web page | Free tier exists; limits are per project, shown in AI Studio | Yes | Global service | API key | Beyond free limits, or on a billed project. Gemini 3.5 Flash-Lite: US$0.30 in, US$2.50 out per 1M tokens | Google | `FREE_TIER_WITH_LIMITS` | First choice for the first live test |
| Gemini Developer API, Flash (configured: `gemini-3.8-flash`) | Agents | None | One reading: 5 requests a minute, 20 a day | Yes | Global service | API key | As above; paid price not confirmed | 3rd | `UNKNOWN_REQUIRES_OWNER_CONFIRMATION` | Read the real limit in AI Studio before relying on it |
| Gemini on Vertex AI | Agents in production | None | No free tier | Yes | Gemini 3.5 Flash listed for `asia-south1`; 3.8 Flash not confirmed | Service account, no key | Always | Google | `PAID_API` | Preferred for Cloud Run because it needs no API key. Decide after the project audit |
| Google Search grounding | Research and verification helpers | None | Gemini 3 and newer: 5,000 requests a month shared, then US$14 per 1,000. Free-tier availability for current models not confirmed | Yes, model tool | — | Same as the model | Beyond the allowance | Google | `FREE_TIER_WITH_LIMITS` | Fits: a daily run needs far fewer than 5,000 a month |
| URL Context | Reading source pages | None | Tool is free; page content is billed as input tokens | Yes, model tool | — | Same as the model | Token cost only | Google | `FREE_TIER_WITH_LIMITS` | Use as now |
| Google AI Studio web page | Prompt testing by hand | Higher limits with AI Pro | Free with limits | No (it is a UI) | — | Google account | — | Google | `INCLUDED_IN_EXISTING_SUBSCRIPTION` | Manual prompt tuning only |
| Gemini app | Manual drafting | Higher limits with AI Pro | Free with limits | No | — | Google account | — | Google | `INCLUDED_IN_EXISTING_SUBSCRIPTION` | Not part of the pipeline |
| NotebookLM | Manual research notes | Higher limits with AI Pro | Free with limits | Not verified | — | Google account | — | Google | `INCLUDED_IN_EXISTING_SUBSCRIPTION` | Optional manual aid |
| Google Developer Program Cloud credit | Pays for API and Cloud usage | US$10 a month with AI Pro, must be claimed | — | — | — | Billing account | Reported US$5 prepayment needed for Gemini API use | Google | `INCLUDED_IN_EXISTING_SUBSCRIPTION` | The most valuable benefit. Claim only with the owner's approval |

## Religious verification

| Tool | Hidaya One use | Subscription entitlement | Free quota | API | Region | Authentication | Paid when | Verified | Class | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Deterministic gate (`verification/`) | Decides what may reach the Script Agent | — | — | In-process | — | Signing key | Never | Repo | `FREE` | Already built |
| Arabic comparison (`verification/arabic.ts`) | Wording and diacritics checks | — | — | In-process | — | — | Never | Repo | `FREE` | Already built |
| Quran text source (quran.com, tanzil.net) | Fetching source text by code | — | Not verified | Not verified | — | Not verified | Not verified | No | `UNKNOWN_REQUIRES_OWNER_CONFIRMATION` | Check API terms and text licence before any use |
| Hadith text and grading source (sunnah.com, dorar.net) | Fetching source text by code | — | Not verified | Not verified | — | Not verified | Not verified | No | `UNKNOWN_REQUIRES_OWNER_CONFIRMATION` | Same |

Google offers no Quran or Hadith verification product.

## Media

| Tool | Hidaya One use | Subscription entitlement | Free quota | API | Region | Authentication | Paid when | Verified | Class | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Nano Banana through the Gemini API | Scene images | None | None; free tier "not available" | Yes | — | API key or service account | Every image. About US$0.034 per 1K image reported | Google for "no free tier"; 3rd for the price | `PAID_API` | Avoid for routine use. Too costly at 5 images a Short |
| Nano Banana in the Gemini app or Flow | Scene images made by hand | Higher limits with AI Pro; exact number not found | Free with limits | No | — | Google account | Extra credits are a purchase | 3rd | `INCLUDED_IN_EXISTING_SUBSCRIPTION` | Build a reusable image library by hand |
| Code-drawn geometric backgrounds | Brand visuals | — | — | In-process | — | — | Never | No (not built) | `FREE` | Default visual source. No depiction risk, no cost |
| Veo through the Gemini API or Vertex AI | Video clips | None | None; free tier "not available" | Yes | Not confirmed for `asia-south1` | API key or service account | Every second. Veo 3.1 Lite US$0.05/s at 720p; Fast US$0.10/s; Standard US$0.40/s | Google | `PAID_API` | Do not use. See cost file |
| Google Flow | Hero clips made by hand | 1,000 credits a month with AI Pro | 50 credits a day reported for every account | **No public API** | — | Google account | Extra credits are a purchase | Google for 1,000; 3rd for the rest | `INCLUDED_IN_EXISTING_SUBSCRIPTION` | Manual step only. About one Lite clip per Short if credit costs hold |
| Cloud Text-to-Speech, Chirp 3 HD | Tamil narration | None | 1 million characters a month, then US$30 per 1M | Yes | Mumbai availability conflicting | Service account | Beyond the allowance | Google | `FREE_TIER_WITH_LIMITS` | First choice. 14 female Tamil voices listed |
| Cloud Text-to-Speech, WaveNet and Standard | Tamil narration fallback | None | Reported 1 million (WaveNet) and 4 million (Standard) characters a month | Yes | — | Service account | Beyond the allowance | Google | `FREE_TIER_WITH_LIMITS` | Fallback. Female voices `ta-IN-Wavenet-A`/`-C`, `ta-IN-Standard-A`/`-C` |
| Gemini TTS through the Gemini API | Tamil narration alternative | None | Free tier listed for the preview model | Yes | — | API key | Paid tier: US$1 per 1M input tokens, US$20 per 1M audio output tokens | Google | `FREE_TIER_WITH_LIMITS` | Compare voice quality with Chirp 3 HD in a test |
| Subtitles from script and audio durations | Tamil, Arabic, English captions | — | — | In-process | — | — | Never | No (not built) | `FREE` | No speech recognition needed |
| Cloud Speech-to-Text | Checking narration matches the script | None | Not verified | Yes | — | Service account | Not verified | No | `UNKNOWN_REQUIRES_OWNER_CONFIRMATION` | Optional QC step; price it first |
| FFmpeg | Assembly and encoding | — | — | Command line | — | — | Never (compute only) | Open source | `FREE` | Rendering engine |
| Headless Chromium | Drawing Tamil and Arabic text correctly | — | — | In-process | — | — | Never (compute only) | Open source | `FREE` | Use for text frames; browsers shape both scripts properly |
| Noto Sans Tamil, Noto Naskh Arabic, Amiri fonts | On-screen text | — | — | — | — | — | Never | Open licence; confirm each | `FREE` | Bundle with the renderer |

## Orchestration, development and design

| Tool | Hidaya One use | Subscription entitlement | Free quota | API | Region | Authentication | Paid when | Verified | Class | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Google ADK TypeScript | Agents and workflow | — | — | Library | — | — | Never | Repo (Apache-2.0) | `FREE` | Keep |
| ADK dev UI and CLI | Debugging | — | — | Local | — | — | Never | Repo | `FREE` | Keep local only |
| Vertex AI Agent Engine and session service | Hosted agent runtime | None | Not verified | Yes | — | Service account | Not verified | No | `UNKNOWN_REQUIRES_OWNER_CONFIRMATION` | Not needed. Cloud Run is enough |
| Google Antigravity | Coding assistant | Higher limits with AI Pro | Free individual plan with weekly limits | No | — | Google account | Extra credits are a purchase | Google | `INCLUDED_IN_EXISTING_SUBSCRIPTION` | Optional. Claude Code stays the assistant |
| Gemini CLI, Jules | Coding assistants | Not verified | Not verified | — | — | Google account | Not verified | No | `UNKNOWN_REQUIRES_OWNER_CONFIRMATION` | Optional |
| Google Stitch | Dashboard mock-ups | Not a listed plan benefit | Reported free with monthly generation limits | MCP server reported, undocumented | — | Google account | Not verified | 3rd | `UNKNOWN_REQUIRES_OWNER_CONFIRMATION` | Optional design aid |
| Angular, Tailwind | Dashboard build | — | — | — | — | — | Never | Open source | `FREE` | As planned |

## Storage, deployment and operations

| Tool | Hidaya One use | Subscription entitlement | Free quota | API | Region | Authentication | Paid when | Verified | Class | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Cloud Run | Agent service, API, render jobs | None | 2 million requests, 180,000 vCPU-seconds, 360,000 GB-seconds a month | Yes | Whether it applies in `asia-south1` not confirmed | Service account | Beyond the allowance, or with minimum instances | Google | `FREE_TIER_WITH_LIMITS` | Keep scale-to-zero |
| Firestore | Operational records | None | 1 GiB storage; 50,000 reads, 20,000 writes, 20,000 deletes a day | Yes | — | Service account | Beyond the allowance | Google | `FREE_TIER_WITH_LIMITS` | Use |
| Cloud Storage | Media files | None | 5 GB a month, **US regions only** | Yes | Not free in `asia-south1` | Service account | All storage in `asia-south1` | Google | `PAID_API` in `asia-south1` | Small cost. Delete intermediates automatically |
| Secret Manager | Signing key, OAuth tokens | None | 6 active secret versions, 10,000 access operations a month | Yes | — | Service account | Beyond the allowance | Google | `FREE_TIER_WITH_LIMITS` | Use; stay within 6 versions |
| Cloud Build | Deployment | None | 2,500 build-minutes a month | Yes | — | Service account | Beyond the allowance | Google | `FREE_TIER_WITH_LIMITS` | Use |
| Cloud Logging and Monitoring | Audit lines, alerts | None | Not verified | Yes | — | Service account | Not verified | No | `UNKNOWN_REQUIRES_OWNER_CONFIRMATION` | Use; confirm the allowance |
| Cloud Scheduler | Daily trigger | None | Not verified | Yes | — | Service account | Not verified | No | `UNKNOWN_REQUIRES_OWNER_CONFIRMATION` | Use; one job is enough |
| Artifact Registry | Container images | None | Not verified | Yes | — | Service account | Not verified | No | `UNKNOWN_REQUIRES_OWNER_CONFIRMATION` | Keep only recent images |
| Firebase Hosting | Dashboard hosting | None | Free plan exists; limits not verified | Yes | — | Google account | Not verified | No | `UNKNOWN_REQUIRES_OWNER_CONFIRMATION` | Alternative to a Cloud Run dashboard |
| Google Cloud new-customer trial | General credit | None | US$300 for new customers only; reported not to cover the Gemini API in AI Studio for newer accounts | — | — | Billing account | After expiry | 3rd | `UNKNOWN_REQUIRES_OWNER_CONFIRMATION` | Owner to check whether any remains |

## Publishing

| Tool | Hidaya One use | Subscription entitlement | Free quota | API | Region | Authentication | Paid when | Verified | Class | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| YouTube Data API | Uploads and analytics | None | Uploads have their own daily limit, default about 100; 10,000 units a day for other calls | Yes | — | OAuth by the channel owner | Never; more quota is by application | Google | `FREE_TIER_WITH_LIMITS` | Use. Three uploads a day is far inside the limit |
| Instagram content publishing | Reels | None | 50 API-published posts per 24 hours (one page says 100) | Yes | — | Professional account; Meta app and login | Never | Meta | `FREE_TIER_WITH_LIMITS` | Use later. The video must be at a reachable URL |

## What has genuinely free API access

- Google ADK, FFmpeg, headless Chromium, open fonts, and the code in this
  repository.
- Gemini Flash-Lite through the Developer API, inside per-project limits.
- URL Context as a tool (token cost still applies on a paid project).
- Cloud Text-to-Speech inside its monthly character allowance.
- Firestore, Cloud Run, Secret Manager and Cloud Build inside their allowances.
- YouTube Data API and Instagram publishing.

## What always costs money through an API

- Veo video generation.
- Nano Banana image generation.
- Gemini on Vertex AI.
- Cloud Storage in `asia-south1`.

## What cannot be automated through a supported API

- Google Flow, and therefore the 1,000 monthly Flow credits.
- The Gemini app, including its image and video generation.
- The AI Studio web interface and its subscriber limits.
