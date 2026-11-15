# Hidaya One

Agentic AI platform that researches, verifies, scripts, produces, quality-checks
and publishes Tamil-first Islamic educational Shorts (Tamil primary, Arabic
source text, English support).

**Read first:** `docs/architecture/hidaya-one-architecture-blueprint.md` is the
primary architecture reference. It describes the target system; its final
section records what actually exists in this repository. Consult it before
designing or changing any component, and keep that status section current.

## Repository today

A flat, single-package Google ADK TypeScript starter (Node.js 24, ESM):

- `agent.ts` — all 13 `LlmAgent` instances (orchestrator, 8 specialists, 4
  Google Search / URL Context helpers). `rootAgent` is the entry point.
- `npm run adk:web` — ADK dev UI (local only). `npm run adk:run` — one CLI run.
- `verification/` — typed evidence contracts and the deterministic religious
  validation gate (`evaluateEvidence`, `evaluateBatch`, `verifyAttestation`).
  Pure code, unit-tested, **not yet wired into the agent flow**.
- `npm run typecheck`, `npm test` (Node's built-in runner, runs `.ts` directly;
  relative imports use `.ts` extensions).

The monorepo (`apps/agent`, `apps/api`, `apps/web`, `packages/*`, `infra/`),
backend, Angular dashboard and all media/publishing integrations in the
blueprint are not in this repository yet.

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
- Keep these current as part of each milestone: `CLAUDE.md`, `ARCHITECTURE.md`,
  `IMPLEMENTATION_PLAN.md`, `SECURITY.md`, `INTEGRATIONS.md`, `TESTING.md`,
  `CHANGELOG.md`.
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
