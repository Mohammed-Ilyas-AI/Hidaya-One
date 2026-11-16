# Integrations

Statuses use blueprint §9. An integration is `CONNECTED` only after a real
operation has succeeded and been recorded here with its date.

| Integration | Status | Notes |
| --- | --- | --- |
| Gemini via ADK | NOT_CONFIGURED here | No authenticated model call has been made from this repository. The deployed `hidaya-one-dev` service is configured with a Gemini API key from Secret Manager; whether its calls succeed is unknown |
| `My Google` connector (Cloud Run) | CONNECTED, read tested 2026-11-16 | `list_services` and `get_service` succeeded against the project. Deploy tools not used. This is a development-time connector, not part of the runtime |
| Cloud Run service `hidaya-one-dev` | VERIFIED to exist and be Ready | Runs pre-gate code. Not changed |
| Google Search (ADK tool) | NOT_CONFIGURED | Declared on two helper agents; no verified call |
| URL Context (ADK tool) | NOT_CONFIGURED | Declared on two helper agents; no verified call |
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
been exercised only with scripted model responses.

## Region

`GOOGLE_CLOUD_LOCATION` is the single region setting. The ADK reads it
directly in Vertex AI mode (`GOOGLE_GENAI_USE_ENTERPRISE=true`) and fails
loudly if it is unset. The intended value is `asia-south1`. Whether the
configured model is available there is unverified.

A provider adapter layer exists (`workflow/providers.ts`) for video,
narration, rendering and publishing. It has no real implementations: every
default reports `NOT_CONFIGURED`.
