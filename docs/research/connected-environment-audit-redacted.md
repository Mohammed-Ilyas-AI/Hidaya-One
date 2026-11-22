# Connected Environment Audit (Redacted) — Phase 0

**Date:** 2026-11-22 · **Mode:** read-only. No API enabled, no IAM/OAuth/billing change, no paid call, no deploy.
Identifiers are partially masked. No secrets, tokens or billing IDs were read or printed.

## 1. What this Claude Code session can actually reach

| Access path | Result | Status |
|---|---|---|
| `gcloud` CLI in container | Installed (SDK 570.0.0) but **no valid credential** — every call (`projects.list`, `billing.accounts.list`) returns `UNAUTHENTICATED / CREDENTIALS_MISSING` | **ACCESS_DENIED** |
| "My Google" Cloud Run connector (MCP) | Works for **Cloud Run read** (`list_services`, `get_service`) — only deploy/get/list Cloud Run tools exist | **CONFIRMED (Cloud Run read only)** |
| Network allow-list | `docs.cloud.google.com`, `developers.google.com`, `support.google.com`, `ai.google.dev`, `gemini.google`, the `hidaya-one-dev` Cloud Run host | Partial — `cloud.google.com`, `aistudio.google.com`, `adk.dev` blocked |
| YouTube Data/Analytics API | No OAuth client or token available to this session | **NOT_CHECKED** |

## 2. Inventory found

**Project:** `even-boulder-******-d5` (project number `4401******44`). Owner/deployer is a personal Gmail account (not recorded here).

| Cloud Run service (asia-south1) | Created / updated | Model config | Auth to Gemini | Secrets referenced (names only) | Public? |
|---|---|---|---|---|---|
| `hidaya-one-dev` | 2026-11-12 / 2026-11-16 | `gemini-3.8-flash`, location `global`, `HIDAYA_MODE=DEVELOPMENT` | **Gemini Developer API key** (`GOOGLE_GENAI_API_KEY` from Secret Manager `gemini-api-key`) | `gemini-api-key` | No — unauthenticated request returns **403** (IAM-protected) ✅ |
| `hidaya-one-agent-api` | 2026-11-16 / 2026-11-17 | `gemini-3.8-flash`, `GOOGLE_GENAI_USE_VERTEXAI=true`, `GOOGLE_GENAI_USE_ENTERPRISE=true`, location `global`, timeout 180 s | **Agent Platform (Vertex) via service identity** | `hidaya-gate-attestation-key` | Not tested (host not on allow-list) |

Both images live in Artifact Registry `asia-south1-docker.pkg.dev/<project>/cloud-run-source-deploy/`. Both services report `Ready`. No Cloud Run services in `us-central1`.

**Inferences (not verified):** Cloud Run, Artifact Registry, Cloud Build, Secret Manager and at least one of `aiplatform`/`generativelanguage` APIs are enabled and billing is attached (Cloud Run source deploys require billing).

## 3. Observations that matter

1. **Two billing paths are in use.** `hidaya-one-dev` bills the Gemini Developer API (API key); `hidaya-one-agent-api` bills Agent Platform. Spend caps are per service, so both need a cap — or consolidate on one path (recommended: Agent Platform, because Omni 1.2 Flash GA is documented there and service-account auth avoids long-lived API keys).
2. **The deployed code is not in this repo.** The repo contains a TypeScript ADK starter (`agent.ts`, 13 `LlmAgent`s). The `agent-api` service references a gate attestation key, implying newer code exists elsewhere. Owner must confirm the source of the deployed images.
3. **Spec conflict:** the repo targets **Tamil primary, 3 Shorts/day, 30–45 s**, plus Instagram; the master blueprint targets **1 Short/day, ~15 s, language founder-selected, Python**. A single decision is needed (see go/no-go).

## 4. Could NOT verify (owner checks required)

| Item | Status | How to verify (read-only) |
|---|---|---|
| Enabled APIs | NOT_CHECKED | `gcloud services list --enabled` |
| Billing attached / account open, credits | NOT_CHECKED | Console → Billing → Overview / Credits |
| Existing budgets & spend caps | NOT_CHECKED | Console → Billing → Budgets |
| Omni 1.2 Flash / Veo access & quota for this project | NOT_CHECKED | Console → Agent Platform → Model Garden; IAM & Admin → Quotas (filter `aiplatform`) |
| Service accounts and roles of both Cloud Run services | NOT_CHECKED | `gcloud run services describe … --format='value(spec.template.spec.serviceAccountName)'` + `gcloud projects get-iam-policy` |
| Google AI Pro $10/mo Cloud credit activation | NOT_CHECKED | Google Developer Program profile → benefits; Billing → Credits |
| YouTube channel ID, OAuth consent screen, OAuth client | NOT_CHECKED | Console → APIs & Services → OAuth consent; YouTube Studio |
| Agent-api ingress / invoker policy | NOT_CHECKED | `gcloud run services get-iam-policy hidaya-one-agent-api --region asia-south1` |

A read-only script that collects all of the above with redaction is provided at `scripts/phase0-readonly-audit.sh` for the owner to run in Cloud Shell. It makes no changes.

## 5. Account status table (per blueprint §17)

| Entitlement | Status |
|---|---|
| Google Cloud project | CONFIRMED (exists, Cloud Run read) |
| Agent Platform (Vertex) usage | NOT_CHECKED (configured in a service; not called) |
| Gemini Developer API paid tier | NOT_CHECKED (API key secret exists) |
| Omni 1.2 Flash eligibility | NOT_CHECKED |
| Google AI Pro subscription | NOT_CHECKED — consumer plan; does **not** pay for API generation except possibly a $10/mo Cloud credit if activated [secondary] |
| YouTube API quota / channel permission | NOT_CHECKED |
| Spend caps | NOT_CHECKED |
