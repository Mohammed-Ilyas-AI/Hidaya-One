# Google ecosystem audit

Audit date: 2026-11-16. Audit only: no code, credentials, billing, IAM, cloud
resources or deployments were changed.

## How to read this audit

Every finding carries one of these evidence levels:

| Level | Meaning |
| --- | --- |
| **Checked here** | Observed directly in this session or in the installed packages |
| **Google page** | Stated on a Google-owned page, read through a search-result excerpt |
| **Third party** | Reported only by non-Google sites; treat as a lead, not a fact |
| **Not verified** | Could not be checked; the owner must confirm |

Two limits shaped the whole audit:

1. **No Google credentials exist in this session**, so nothing inside the
   Cloud project or the Google account could be inspected.
2. **Google's documentation sites are blocked by this session's network
   policy** (`ai.google.dev`, `cloud.google.com` docs, `gemini.google`,
   `developers.google.com`, `support.google.com`). Facts from those pages were
   read through search excerpts, not the full pages. Prices and quotas change
   often; confirm each figure on the linked page before budgeting on it.

## 1A. Account and authentication

| Check | Result | Evidence |
| --- | --- | --- |
| gcloud CLI installed | Yes, Google Cloud SDK 570.0.0, with `bq` and `gsutil` | Checked here |
| Authenticated Google account | **None.** `gcloud auth list` reports no credentialed accounts | Checked here |
| Active project | None set in the gcloud configuration | Checked here |
| Project `even-boulder-514217-d5` accessible | **Not from here.** `gcloud projects describe` was rejected with `CREDENTIALS_MISSING` | Checked here |
| Enabled APIs | Not verified. `gcloud services list` was rejected the same way | Checked here |
| Application Default Credentials | Not configured. No ADC file is present | Checked here |
| Vertex AI access | Not verified | — |
| Cloud Run service and service accounts | Not verified | — |
| Billing enabled | Not verified | — |

The session has an access-token environment variable set by the hosting
environment, but Google rejects it, so it grants no access. Its value was not
read or printed.

Nothing in this section says the project is broken. It says this session has
no way to look. `ACCOUNT_CONNECTION_CHECKLIST.md` gives a read-only script the
owner can run in Cloud Shell to answer all eight questions without sharing a
credential.

## 1B. Google AI Pro subscription

**Claude Code cannot inspect a Google AI Pro subscription.** There is no
supported integration that exposes a consumer subscription, its plan, or its
remaining credits. Everything in this section is what Google says the plan
includes; whether the owner's account has it is for the owner to confirm.

### The central fact

Google's Gemini API documentation states that Google AI plan benefits for
developers apply **only inside the Google AI Studio web interface**, and that
direct use of the Gemini API (API keys, external applications) is billed and
managed separately. *(Google page:
[Google AI plans](https://ai.google.dev/gemini-api/docs/google-ai-plans))*

So the subscription does **not** pay for the Hidaya One agents. The runtime
agents call the API, and the API has its own free tier and its own billing.

### What the plan is reported to include

| Benefit | What is stated | Evidence | Usable by Hidaya One automation? |
| --- | --- | --- | --- |
| Gemini app | Higher usage limits and model access than free | Google page ([subscriptions](https://gemini.google/subscriptions/)) | No API. Manual use only |
| Google AI Studio | Greater model access and higher rate limits in the AI Studio web interface | Google page ([Google AI plans](https://ai.google.dev/gemini-api/docs/google-ai-plans)) | Manual prototyping only |
| Google Cloud credits | US$10 per month through the Google Developer Program. Must be claimed. Primary subscriber only | Google page ([One plans](https://one.google.com/intl/en_in/about/google-ai-plans/), [blog](https://blog.google/innovation-and-ai/technology/developers-tools/google-cloud-credits-gdp-ai-studio/)) | **Yes.** This is the one benefit that pays for API usage |
| Flow | 1,000 AI credits per month | Google page ([I/O 2026 subscriptions post](https://blog.google/products-and-platforms/products/google-one/google-ai-subscriptions/)) | Manual only; see below |
| Veo in Flow | A Veo 3.1 Lite clip is reported at about 10 credits, a Quality clip about 100 | Third party | Manual only |
| Nano Banana images | Higher limits in the Gemini app and Search; no exact number found | Third party | Manual only |
| Google Antigravity | Higher rate limits than the free individual plan | Google page ([subscriptions](https://gemini.google/subscriptions/)) | Development tool, not runtime |
| NotebookLM | Higher limits than free | Google page | Manual research aid only |
| Storage | Reported as 5 TB | Google page (One plans) | Personal storage, not project storage |
| Gemini in Gmail, Docs and other Workspace apps | Not verified in this audit | Not verified | Not relevant to the pipeline |
| Stitch | Not listed as a plan benefit in anything found. Reported free with a Google account, with monthly generation limits | Third party | Design-time only |
| Jules, Gemini CLI | Not verified | Not verified | Development tools |

Conditions reported on the Cloud credit: using the Gemini API on Cloud billing
needs a US$5 minimum prepayment before promotional credit is drawn down, and
the credit is not shared with family members. *(Google page, blog post above.)*
Claiming it links a billing account, so it is a billing change and is **not**
done in this audit.

### Six things that are easy to confuse

| Thing | What it is | Who pays |
| --- | --- | --- |
| Subscription benefits | Higher limits in Google's own apps (Gemini app, AI Studio UI, Flow, Antigravity) | Included in AI Pro |
| AI Studio free tier | Using models in the AI Studio web page | Free, with limits |
| Gemini Developer API | Calling models with an API key from code | Free tier on some models, otherwise pay per token |
| Vertex AI | Calling models through Google Cloud with a service account | Always billed to the Cloud project |
| Google Cloud free tier | Monthly free usage of Cloud Run, Firestore and others | Free within limits, needs a billing account |
| Flow credits | Credits for generating in the Flow website | Included monthly; extra credits are a purchase |

## 1C. Tool inventory by requirement

Full classification is in `FREE_TOOLS_MATRIX.md`. Summary:

| # | Requirement | Best fit found | Cost position |
| --- | --- | --- | --- |
| 1 | Research and source retrieval | Gemini with Google Search grounding and URL Context, already declared on the helper agents | Free allowance on paid tier; see matrix |
| 2 | Quran and Hadith verification | The deterministic gate in this repository, plus retrieval of source text by code (planned) | No Google product does this. Text sources are third-party and need licence checks |
| 3 | Tamil script generation | Gemini Flash or Flash-Lite through the ADK | Free tier with tight limits, otherwise low per-token cost |
| 4 | Arabic text handling | Code in `verification/arabic.ts`; open fonts for rendering | Free |
| 5 | Image generation | No free API. Subscription generation is manual. Code-drawn geometric backgrounds are free | Paid API or manual |
| 6 | Video generation | No free API. Flow credits are manual | Paid API or manual |
| 7 | Tamil text-to-speech | Cloud Text-to-Speech, which lists female Tamil voices | Free monthly allowance |
| 8 | Subtitles | Built from the script and measured audio durations; no speech recognition needed | Free |
| 9 | Editing and rendering | FFmpeg and a headless browser. Google has no free rendering service | Free software; small compute cost |
| 10 | Workflow orchestration | Google ADK `Workflow`, already in use | Free library |
| 11 | Agent development and debugging | ADK dev UI and CLI, already in the repository | Free |
| 12 | Storage and database | Cloud Storage and Firestore | Firestore free tier; Storage free only in US regions |
| 13 | Dashboard design | Stitch for mock-ups; Angular for the build | Free with limits, not verified |
| 14 | Deployment and monitoring | Cloud Run, Cloud Build, Cloud Logging | Free tiers; regional detail not verified |

## 1D. Agent architecture and control

Checked here, in this repository and the installed `@google/adk` 2.4.0.

### What already runs

- 13 `LlmAgent` instances built by `buildHidayaAgents()` in `agent.ts`.
- An ADK graph `Workflow` enforcing research → verification → deterministic
  gate → script, with code nodes and routed edges.
- The Orchestrator reaches that workflow only through one tool.
- 46 passing tests with scripted model responses. No live model call yet.

### What ADK offers for the remaining stages

Present in the installed package; **not yet exercised** in this repository:

| Need | ADK mechanism in the package |
| --- | --- |
| Human approval that pauses and resumes a workflow | `RequestInput`, resumability configuration, tool confirmation |
| Long-running jobs such as rendering | Long-running tool support |
| State that survives restarts | `DatabaseSessionService`; a Vertex AI session service also exists but is a paid Cloud service |
| Storing generated files | `GcsArtifactService` |
| Policy checks around tool calls | Security plugin with a policy engine; before-tool callbacks |
| Parallel work | `ParallelWorker`, `JoinNode` |
| Connecting external tools | MCP toolset, OpenAPI toolset |
| Tracing and logs | Google Cloud telemetry module |
| Evaluation | An eval command in the CLI |

Two ADK limits found during Milestone 2 still apply: a workflow run through
`NodeTool` loses tool results for the agents inside it, and an agent run as a
workflow node cannot transfer to sub-agents. ADK marks `Workflow` experimental.

### What can be integrated, and how

| Service | Supported API for automation? | Evidence |
| --- | --- | --- |
| Gemini text models | Yes: Gemini Developer API or Vertex AI | Google page |
| Google Search grounding | Yes, as a model tool | Google page ([docs](https://ai.google.dev/gemini-api/docs/google-search)) |
| URL Context | Yes, as a model tool | Google page ([pricing](https://ai.google.dev/gemini-api/docs/pricing)) |
| Veo | Yes through the Gemini API or Vertex AI, paid only | Google page |
| Nano Banana images | Yes through the API, paid only | Google page |
| Cloud Text-to-Speech | Yes | Google page |
| **Google Flow** | **No public API found.** Flow is a website. Third-party "Flow APIs" drive the site in a browser and are not Google products | Third party, consistent across sources; no Google page says otherwise |
| Gemini app | No API | — |
| NotebookLM (consumer) | Not verified | — |
| Stitch | An MCP server is reported; authentication and limits are not officially documented | Third party |
| YouTube Data API | Yes, free, quota-limited | Google page |
| Instagram publishing | Yes, free, Professional account required | Meta page |

**Flow must be treated as a manual production step.** Automating it through an
unofficial wrapper would depend on browser automation against a site with
anti-automation checks, and is not something to build a daily pipeline on.

Claude Code stays the development assistant. Nothing here replaces the ADK or
Gemini runtime.

## Region findings

| Item | Finding | Evidence |
| --- | --- | --- |
| Gemini Flash on Vertex AI in `asia-south1` | Gemini 3.5 Flash is listed for `asia-south1`. The configured model ID `gemini-3.8-flash` was not confirmed for that region | Google page ([model page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-5-flash)) |
| Veo on Vertex AI in `asia-south1` | No Veo row was seen for Asia Pacific regions | Google page excerpt; incomplete |
| Chirp 3 HD voices in `asia-south1` | Sources conflict; newer page lists Mumbai, older notes do not | Google page, conflicting |
| Cloud Storage free tier | Applies only to `us-east1`, `us-west1`, `us-central1` | Google page ([free tier](https://docs.cloud.google.com/free/docs/free-cloud-features)) |
| Vertex AI name | Google's documentation now calls it Gemini Enterprise Agent Platform | Google page |

## What this audit could not establish

1. Anything about the state of project `even-boulder-514217-d5`.
2. Whether the owner's account has Google AI Pro, and its credit balances.
3. Current free-tier rate limits for the Gemini API. Google's rate-limit page
   says limits are per project and shown in AI Studio; third-party readings
   range from 20 to 1,500 requests per day for Flash models.
4. The paid price of `gemini-3.8-flash`.
5. Whether Google Search grounding is available on the API free tier for
   current models. One third-party source says it is not.
6. Whether free-tier prompts are used to improve Google products. Not
   confirmed in this audit; check the Gemini API terms before sending anything
   sensitive on the free tier.
7. Whether the Cloud Run free tier applies in `asia-south1`.
8. Licence terms for Quran and Hadith text sources.

## Sources

Google pages:

- [Google AI plans — Gemini API docs](https://ai.google.dev/gemini-api/docs/google-ai-plans)
- [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini API rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Gemini API billing](https://ai.google.dev/gemini-api/docs/billing)
- [Grounding with Google Search](https://ai.google.dev/gemini-api/docs/google-search)
- [Google AI Pro and Ultra subscriptions](https://gemini.google/subscriptions/)
- [Google AI plans with cloud storage (India)](https://one.google.com/intl/en_in/about/google-ai-plans/)
- [Everything new in Google AI subscriptions, I/O 2026](https://blog.google/products-and-platforms/products/google-one/google-ai-subscriptions/)
- [Google Developer Program Cloud credits within AI Studio](https://blog.google/innovation-and-ai/technology/developers-tools/google-cloud-credits-gdp-ai-studio/)
- [Purchase Google AI credits](https://support.google.com/googleone/answer/17103110?hl=en)
- [Free Google Cloud features](https://docs.cloud.google.com/free/docs/free-cloud-features)
- [Text-to-Speech pricing](https://cloud.google.com/text-to-speech/pricing)
- [Text-to-Speech supported voices](https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types)
- [Gemini-TTS](https://docs.cloud.google.com/text-to-speech/docs/gemini-tts)
- [Agent Platform pricing](https://docs.cloud.google.com/vertex-ai/generative-ai/pricing)
- [Gemini 3.5 Flash model page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-5-flash)
- [Secret Manager pricing](https://cloud.google.com/secret-manager/pricing)
- [Firebase pricing](https://firebase.google.com/pricing)
- [YouTube Data API quota calculator](https://developers.google.com/youtube/v3/determine_quota_cost?hl=en)
- [YouTube Data API revision history](https://developers.google.com/youtube/data/revision_history)

Meta pages:

- [Instagram content publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing/)
- [IG User content publishing limit](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/content_publishing_limit.md)

Third party, used only where marked:

- [Google AI Pro limits](https://whizi.io/resources/google-ai-pro-limits/)
- [Google Flow pricing and credits](https://felloai.com/google-flow/)
- [Google Flow API: there is no official one](https://www.wireflow.ai/blog/google-flow-api)
- [useapi.net Flow documentation](https://useapi.net/docs/api-google-flow-v1)
- [Nano Banana pricing](https://whizi.io/resources/nano-banana-pricing/)
- [Gemini API free tier limits](https://imisofts.com/blog/gemini-api-free-tier-limits/)
- [Gemini API free tier in 2026](https://dev.to/hassann/gemini-api-free-tier-in-2026-limits-models-and-when-you-get-billed-4081)
- [Google AI Pro monthly Cloud credit: how to claim](https://www.aipromonow.com/en/promos/google-ai-pro-10-usd-monthly-google-cloud-credit)
- [Google Antigravity pricing](https://www.cloudzero.com/blog/google-antigravity-pricing/)
- [Google Stitch review](https://animaapp.com/blog/ai-design-en/google-stitch-review/)
- [Google Stitch MCP guide](https://sotaaz.com/post/stitch-mcp-api-en)
