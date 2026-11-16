# Changelog

## Unreleased

### Monorepo port

#### Changed
- Moved the agent code from the flat layout into the monorepo: `agent.ts` to
  `apps/agent/agent.ts`, `verification/` and `workflow/` to `apps/agent/src/`.
  Paths in the entries below are written in the new layout.
- Agent documents moved to `apps/agent/docs/`; Google audit documents to
  `docs/google/`.

#### Removed
- The earlier monorepo gate (`src/verification/types.ts` and its 23 tests),
  which nothing called. The attested gate replaces it.

### Milestone 3 — controlled production workflow and connector validation

#### Added
- `apps/agent/src/workflow/production-pipeline.ts`: a second ADK workflow running the Creative
  Producer, Veo Video Generator, Video Editor, Quality Control Agent and
  Channel Manager with code nodes between them.
- Entry guards on all five production agents that re-verify gate attestations
  and a new script attestation before the model is called.
- `apps/agent/src/workflow/jobs.ts`: job and stage records, job statuses, idempotency keys,
  an in-memory job store.
- `apps/agent/src/workflow/providers.ts`: adapters for video, narration, rendering and
  publishing, defaulting to not connected.
- Owner approval and publish functions that no agent can call.
- A code rule that fails a job when video prompts contain Arabic script.
- `run_production_workflow` tool for the Orchestrator.
- `docs/google/GOOGLE_CONNECTOR_STATUS.md`, `HIDAYA_ONE_AGENT_INVENTORY.md`,
  `AGENT_EXECUTION_REPORT.md`.

#### Changed
- The Orchestrator has no sub-agents; the five production agents are workflow
  nodes. Their instructions gained a pipeline input section; QC gained an
  output format.
- The pipeline result records a timeline, and the pipeline accepts an abort
  signal.

#### Verified, not changed
- The `My Google` connector works for Cloud Run reads. The Cloud project has
  one service, `hidaya-one-dev`, running pre-gate code. Nothing was deployed.

### Step 1 — Google ecosystem and free-resource audit (documents only)

- Added `docs/google/GOOGLE_ECOSYSTEM_AUDIT.md`, `docs/google/FREE_TOOLS_MATRIX.md`,
  `docs/google/ACCOUNT_CONNECTION_CHECKLIST.md` and `docs/google/HIDAYA_ONE_COST_OPTIMIZATION.md`.
- No code, configuration, credential, billing or cloud-resource change.

### Milestone 2 — gate enforced in the workflow

#### Added
- ADK graph `Workflow` enforcing research → independent verification →
  deterministic gate → script drafting (`apps/agent/src/workflow/verified-script-pipeline.ts`).
- Script Agent entry guard that re-verifies every attestation before the model
  is called, and shows the model only attested evidence.
- `run_verified_script_pipeline` tool as the Orchestrator's only route to
  research, verification and script drafting.
- Versioned trusted-source registry (`2026-11-16.1`: quran.com, tanzil.net,
  sunnah.com, dorar.net) with roles for Quran text, Hadith text, grading
  evidence and secondary support.
- Diacritics policy: a diacritics-only difference goes to human review with
  both texts and the exact marks recorded.
- Batch attestation, so a partial batch cannot be presented as complete.
- Blind verification: the verifier is not shown the researched Arabic text.
- Audit entries for every gate decision and script-entry check.
- Limits of 5 evidence records and 40 model calls per pipeline run.
- Workflow-boundary tests with scripted model responses.

#### Changed
- `apps/agent/agent.ts` builds the agents through `buildHidayaAgents()`. All 13 agents and
  their instructions are kept; research, verification and script instructions
  gained a pipeline input/output section, the Orchestrator a pipeline rule.
- The Research, Verification and Tamil Script agents are workflow nodes, not
  Orchestrator sub-agents.
- The four helper agents are agent tools of their parent, not sub-agents.
- Gate version 2: attestations include the registry version; gradings may
  carry their own source URL; evidence may carry a source edition and
  labelled unverified supporting fields.
- Gate configuration takes a source registry instead of a host list.
- `apps/agent/.env.example`: Vertex AI mode needs `GOOGLE_GENAI_USE_ENTERPRISE=true`;
  `GOOGLE_CLOUD_LOCATION` is the single region setting, documented as
  `asia-south1` (previously `us-central1`).

#### Not changed
- No deployment, Cloud Run service, credential or publishing change.
- No live Gemini call has been made.

### Milestone 1

#### Added
- Deterministic religious validation gate with signed attestations and typed
  evidence contracts (`apps/agent/src/verification/`), with unit tests.
- `npm test` and `npm run typecheck`; `zod` declared as a direct dependency.
- Architecture blueprint (sections 1–20) and `CLAUDE.md` (repository root).
- `ARCHITECTURE.md`, `IMPLEMENTATION_PLAN.md`, `SECURITY.md`,
  `INTEGRATIONS.md`, `TESTING.md`, `CHANGELOG.md`.
- `HIDAYA_GATE_ATTESTATION_KEY` placeholder in `apps/agent/.env.example`.


## 0.1.0

- Initial ADK TypeScript starter with 13 agents.
