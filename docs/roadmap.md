# HIDAYA ONE — Phased Engineering Roadmap

## Phase 0: Project & Security Audit (Completed)
- [x] Initialized Git repository, main branch, and pre-monorepo backup tag `v0.1.0-stable-pre-monorepo`.
- [x] Audited Cloud Run IAM policy (`allUsers` identified and remediation script created).
- [x] Audited Cloud Run environment and Secret Manager readiness.
- [x] Re-structured repository into monorepo layout without breaking existing deployments.

## Phase 1: Agent Execution & Verification (In Progress)
- [x] 13 specialized agents verified and preserved in `apps/agent/agent.ts`.
- [ ] Inject unrestricted Gemini API key into `hidaya-one-dev` via Secret Manager.
- [ ] End-to-end SSE run verification against live ADK server.

## Phase 2: Deterministic Religious Verification Gate (Completed)
- [x] Created typed evidence models in `apps/agent/src/verification/types.ts`.
- [x] Implemented deterministic gate logic in `apps/agent/src/verification/gate.ts`.
- [x] Implemented 23 automated unit test cases covering all edge cases (`gate.test.ts`).
- [x] Verified 23/23 tests pass cleanly.

## Phase 3: Integration Adapters (In Progress)
- [x] YouTube Data API v3 search and metadata client scaffolded.
- [x] Standardized integration status protocol (`CONNECTED`, `NOT_CONFIGURED`, etc.).
- [ ] GCS media staging client.
- [ ] Google Cloud TTS Neural2 female Tamil voice adapter.

## Phase 4: Persistence (Next)
- [ ] Provision Google Cloud Firestore in `even-boulder-514217-d5`.
- [ ] Implement data repositories for topics, verification records, scripts, and audit logs.
- [ ] Implement GCS media asset storage.

## Phase 5: Node.js BFF API (Completed)
- [x] Express 5 + TypeScript + Zod application in `apps/api`.
- [x] OpenAPI 3.1 contract in `packages/contracts/openapi.yaml`.
- [x] Service-to-service Google ID token auth integration.
- [x] Zero-secret client exposure.

## Phase 6: Angular 22 Dashboard (Next)
- [ ] Scaffold Angular 22 standalone application with Tailwind CSS in `apps/web`.
- [ ] Implement 10 operational views (Overview, Research, Verification, Script Studio, Creative Studio, Video Production, QC, Publishing, Analytics, Settings).
- [ ] Wire Angular Signals to BFF API endpoints.

## Phase 7: Secure Cloud Deployment
- [ ] Deploy `apps/api` and `apps/web` as unified `hidaya-one-dashboard` on Cloud Run.
- [ ] Deploy headless `hidaya-one-agent-api`.
- [ ] Apply least-privilege IAM and Cloud Run Invoker bindings.
