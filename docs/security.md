# HIDAYA ONE — Security & Governance Architecture

## 1. Secrets Management
- `.env` files are strictly isolated from version control via `.gitignore`.
- Cloud Run instances receive credentials exclusively via Google Cloud Secret Manager mounts.
- Node.js BFF (`apps/api`) acts as the security boundary; client browsers and frontends never receive Gemini API keys, YouTube OAuth refresh tokens, or service account keys.

## 2. Service-to-Service Authentication
- The web frontend communicates with `apps/api` via standard session/IAP credentials.
- `apps/api` communicates with `hidaya-one-agent-api` using Google-signed OpenID Connect (OIDC) identity tokens via `google-auth-library` (`getIdTokenClient`).
- The agent service accepts calls only from authorized service accounts possessing `roles/run.invoker`.

## 3. Human-in-the-Loop Release Gates
- Video rendering and channel publishing require explicit manual approvals recorded with cryptographic timestamps and user IDs.
- Fully automated publishing is disabled by design.
- The `channelManager` agent strictly operates in `DRAFT_ONLY` mode unless an explicit human override is delivered via the verified approval endpoint.

## 4. Religious Safeguards as Software Invariants
- Religious verification is enforced deterministically by code (`apps/agent/src/verification/gate.ts`).
- An LLM asserting `status = "VERIFIED"` is untrusted until the 23-point software gate validates:
  1. Arabic source text presence and length.
  2. Surah (1–114) and Ayah boundary constraints.
  3. Hadith collection and number validity.
  4. Explicit named scholars on all authenticity grades.
  5. Source URL and timestamp integrity.
  6. Prevention of gate bypass flags (`gatePassed: true` cannot be pre-set by an agent).
