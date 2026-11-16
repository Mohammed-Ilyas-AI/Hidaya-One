# Integrations

Statuses use blueprint §9. An integration is `CONNECTED` only after a real
operation has succeeded and been recorded here with its date.

| Integration | Status | Notes |
| --- | --- | --- |
| Gemini via ADK (Vertex AI, location `global`) | CONNECTED, tested 2026-11-17 | `gemini-3.8-flash` answered from a local run and from both Cloud Run services. It returns 404 in `asia-south1`, `us-central1` and `asia-southeast1` |
| `My Google` connector (Cloud Run) | CONNECTED, read tested 2026-11-16 | `list_services` and `get_service` succeeded against the project. Deploy tools not used. This is a development-time connector, not part of the runtime |
| Cloud Run service `hidaya-one-dev` | CONNECTED, tested 2026-11-17 | Runs pre-gate code with the dev UI. `GOOGLE_CLOUD_LOCATION=global` added (revision `00003-hl8`). 12 of 13 agents responded in a stepped test; the research URL helper was not called |
| Cloud Run service `hidaya-one-agent-api` | CONNECTED, tested 2026-11-17 | Gated code, API only, private. One verified-script run returned `SCRIPTS_DRAFTED` with 3 attested records. Two identical requests took 268 s and 808 s against a 900 s timeout |
| Google Search (ADK tool) | CONNECTED, tested 2026-11-17 | Search grounding was recorded for the research and verification helpers on `hidaya-one-dev` |
| URL Context (ADK tool) | NOT_CONFIGURED | Declared on two helper agents. The verification URL helper was called on 2026-11-17 but no page retrieval was recorded |
| Image generation | NOT_CONFIGURED | No adapter |
| Veo video generation | NOT_CONFIGURED | Agent returns `VIDEO_GENERATION_TOOL_NOT_CONNECTED` |
| Cloud Text-to-Speech (Tamil) | NOT_CONFIGURED | No adapter |
| Cloud Storage | NOT_CONFIGURED | No adapter |
| Firestore | NOT_CONFIGURED | No adapter |
| Video renderer | NOT_CONFIGURED | Agent returns `RENDERER_NOT_CONNECTED` |
| YouTube Data API / OAuth | NOT_CONFIGURED | Agent returns `CHANNEL_API_NOT_CONNECTED` |
| Instagram Graph API | NOT_CONFIGURED | Agent returns `CHANNEL_API_NOT_CONNECTED` |

The registered source sites (quran.com, tanzil.net, sunnah.com, dorar.net) are
an allowlist of hostnames. Nothing in this repository connects to them.

The ADK workflow engine is a library, not an external integration. It has
been exercised with scripted model responses and, on 2026-11-17, with live
model calls for the verified-script workflow only. The production workflow has
not been run live.

## Region

`GOOGLE_CLOUD_LOCATION` is the single region setting. The ADK reads it
directly in Vertex AI mode (`GOOGLE_GENAI_USE_ENTERPRISE=true`) and fails
loudly if it is unset. It is the model location, not the Cloud Run region:
the services run in `asia-south1` and call the model at `global`, the only
location where `gemini-3.8-flash` answered for this project.

A provider adapter layer exists (`apps/agent/src/workflow/providers.ts`) for video,
narration, rendering and publishing. It has no real implementations: every
default reports `NOT_CONFIGURED`.
