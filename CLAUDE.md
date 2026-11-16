# Hidaya One

Agentic AI platform that researches, verifies, scripts, produces, quality-checks
and publishes Tamil-first Islamic educational Shorts (Tamil primary, Arabic
source text, English support).

**Read first:** `docs/architecture/hidaya-one-architecture-blueprint.md` is the
primary architecture reference. It describes the target system; its final
section records what actually exists in this repository. Consult it before
designing or changing any component, and keep that status section current.

## Repository today

A monorepo with independently installed applications (no root `package.json`;
run npm inside each app):

- `apps/agent/` — Google ADK TypeScript agents (Node.js 24, ESM). Described
  below.
- `apps/api/` — Express 5 + Zod backend that sits between the browser and the
  agent service. Contract in `packages/contracts/openapi.yaml`.
- `apps/web/` — Angular 22 dashboard with ten page components.
- `infra/scripts/` — Cloud Run and Secret Manager scripts.
- `docs/` — repository documents; `docs/google/` holds the Google ecosystem
  audit. Agent documents live in `apps/agent/docs/`.

Inside `apps/agent/`:

- `agent.ts` — `buildHidayaAgents()` creates all 13 `LlmAgent` instances
  (orchestrator, 8 specialists, 4 Google Search / URL Context helpers) and
  exports the default set. `rootAgent` is the entry point. Tests call the
  builder with mock models.
- `src/verification/` — evidence contracts, trusted-source registry, Arabic
  comparison, and the deterministic gate with signed attestations.
- `src/workflow/verified-script-pipeline.ts` — workflow 1: research →
  verification → gate → script, the Script Agent's entry guard, and the
  `run_verified_script_pipeline` tool.
- `src/workflow/production-pipeline.ts` — workflow 2: the five production
  agents with entry guards, stage records, the QC gate, the approval request,
  and the `run_production_workflow` tool. `src/workflow/jobs.ts` holds job
  records and the in-memory store; `src/workflow/providers.ts` holds media and
  publishing adapters (none connected).
- `npm run adk:web` — ADK dev UI (local only). `npm run adk:run` — one CLI run.
- `npm run typecheck`, `npm test` (type-check, then Node's built-in runner,
  which runs `.ts` directly; relative imports use `.ts` extensions; no enums or
  parameter properties).

Invariants to keep when changing this code:

- The Orchestrator has no sub-agents. Every specialist is a workflow node,
  reached only through the two workflow tools.
- The Script Agent and the five production agents keep their
  `beforeModelCallback` entry guards.
- Approval and publishing are never exposed to an agent as a tool.
- A provider adapter reports `CONNECTED` only when it is; assets from test
  doubles are marked `simulated` and can never be published.
- Hosts are added to `apps/agent/src/verification/source-registry.ts` only on the owner's
  instruction, with a version bump and the pinning test updated.
- Do not use ADK `NodeTool` (or `tools: [workflow]`) for a workflow whose
  agents call tools: in ADK 2.4.0 their tool results are lost. Run the
  workflow as the root of its own runner, as `runVerifiedScriptPipeline` does.
- Agents run as workflow nodes cannot transfer to sub-agents; give them
  `AgentTool`s instead.
- A workflow may have only one terminal node that returns an output.
- The `My Google` connector reads Cloud Run and can also deploy. Use only
  `list_services` and `get_service` unless the owner approves a deployment.

The backend and dashboard have not been run against the gated agent workflows,
and no media or publishing integration is connected. The Cloud project has one
Cloud Run service, `hidaya-one-dev`, running code from before the gate existed.
It has no `HIDAYA_GATE_ATTESTATION_KEY` secret yet, so the gated code would
pass nothing if deployed as-is.

## Rules that are never traded away

1. **Religious verification is deterministic and fail-closed.** Software, not an
   LLM, decides whether evidence passes. An LLM can never set `gatePassed=true`;
   the gate issues its own attestation. One invalid record means the batch is
   not fully verified. The Research Agent never marks its own work `VERIFIED`.
2. **Never invent religious content.** No fabricated or guessed Quran verses,
   Hadith, narrators, reference numbers, gradings, translations or source URLs —
   in code, prompts, fixtures, seed data or UI copy. Keep each Hadith grading
   attributed to its named scholar; never merge textual variants.
3. **No depiction of Allah, Prophet Muhammad ﷺ or other prophets.** No Quran or
   Hadith Arabic text inside image- or video-generation prompts.
4. **No fabricated outcomes.** An integration is `CONNECTED` only after a real
   operation succeeds; otherwise report `NOT_CONFIGURED` / `NOT_CONNECTED`.
   Never claim a video, upload or publication exists without a successful
   provider response. No hardcoded success states or made-up dashboard stats.
5. **Human approval before public publishing.** Always explicit owner
   authorization; never automated around.
6. **Secrets stay out of Git, logs and the browser.** Use Secret Manager.
   Internal services are private Cloud Run with service-to-service ID tokens.
   The ADK dev UI is never publicly exposed.
7. **Cost is bounded.** Budget is about ₹2,000/month. No unbounded generation
   or retry loops; check pricing and quotas before enabling a paid service.

## Working method

- Small, independently testable milestones; never rewrite the application in
  one operation, and preserve working implementations.
- "Done" is defined by blueprint §19: real execution, not a UI that loads or an
  agent that replies.
- Keep these current as part of each milestone: `CLAUDE.md`, and in
  `apps/agent/docs/`: `ARCHITECTURE.md`, `IMPLEMENTATION_PLAN.md`,
  `SECURITY.md`, `INTEGRATIONS.md`, `TESTING.md`, `CHANGELOG.md`.
- End each milestone with the report in blueprint §20: changes, files, commands,
  tests passed/failed, integrations connected/disconnected, blockers, security
  implications, estimated operating cost, recommended next milestone.

## Engineering conventions

- Business rules live in code; agent instructions are not an enforcement layer.
- Provider calls go behind adapters (auth, config validation, health check,
  timeout, retry, usage/cost tracking, status).
- Long-running work runs as tracked, idempotent jobs with persisted state — not
  in-memory sessions or Cloud Run local disk.
- Validate data crossing a boundary (Zod); share contracts rather than
  duplicating types.
- Google Cloud: project `even-boulder-514217-d5`, region `asia-south1`. Keep
  the `hidaya-one-dev` deployment available for debugging and rollback.
- Do not deploy, enable publishing, or enable a paid API without the owner's
  explicit go-ahead.
