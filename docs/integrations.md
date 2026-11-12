# HIDAYA ONE — Integrations & Status Matrix

Integrations follow a strict truthful status protocol:
- `CONNECTED`: Service is actively reachable and authenticated.
- `NOT_CONFIGURED`: Missing required credentials, project variables, or buckets.
- `DISABLED`: Configured but disabled administratively.
- `DEGRADED`: Partial availability or reduced quota.
- `FAILED`: Credentials expired or connection blocked.

## Status Matrix

| Integration | Protocol / Engine | Status | Reason / Requirement |
|---|---|---|---|
| **Gemini 3.8 Flash** | `@google/genai` (ADK) | `CONNECTED` (local) / `FAILED` (GCP) | GCP API Key restricted: `generativelanguage.googleapis.com` blocked |
| **Google Search** | ADK `GOOGLE_SEARCH` | `CONNECTED` | Integrated directly into ADK subagents |
| **URL Context** | ADK `URL_CONTEXT` | `CONNECTED` | Integrated directly into ADK subagents |
| **Google Cloud Storage** | `@google-cloud/storage` | `NOT_CONFIGURED` | Media staging buckets not yet created |
| **Cloud Text-to-Speech** | `@google-cloud/text-to-speech` | `NOT_CONFIGURED` | Neural2 female Tamil voice adapter not yet connected |
| **Veo Video Generation** | Google GenAI SDK | `NOT_CONFIGURED` | Returns `VIDEO_GENERATION_TOOL_NOT_CONNECTED` |
| **Video Rendering Engine**| Remotion / FFmpeg / Cloud Run | `NOT_CONFIGURED` | Returns `RENDERER_NOT_CONNECTED` |
| **YouTube Data API v3** | `googleapis` (API Key) | `CONNECTED` | Search and public statistics only |
| **YouTube OAuth 2.0** | Google OAuth Client | `NOT_CONFIGURED` | Required for private staging and uploads |
| **Instagram Graph API** | Meta Graph API | `NOT_CONFIGURED` | Requires Professional Account & Meta App verification |
