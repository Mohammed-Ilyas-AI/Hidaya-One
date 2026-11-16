# Changelog

## Unreleased

### Step 1 — Google ecosystem and free-resource audit (documents only)

- Added `GOOGLE_ECOSYSTEM_AUDIT.md`, `FREE_TOOLS_MATRIX.md`,
  `ACCOUNT_CONNECTION_CHECKLIST.md` and `HIDAYA_ONE_COST_OPTIMIZATION.md`.
- No code, configuration, credential, billing or cloud-resource change.

### Milestone 2 — gate enforced in the workflow

#### Added
- ADK graph `Workflow` enforcing research → independent verification →
  deterministic gate → script drafting (`workflow/verified-script-pipeline.ts`).
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
- `agent.ts` builds the agents through `buildHidayaAgents()`. All 13 agents and
  their instructions are kept; research, verification and script instructions
  gained a pipeline input/output section, the Orchestrator a pipeline rule.
- The Research, Verification and Tamil Script agents are workflow nodes, not
  Orchestrator sub-agents.
- The four helper agents are agent tools of their parent, not sub-agents.
- Gate version 2: attestations include the registry version; gradings may
  carry their own source URL; evidence may carry a source edition and
  labelled unverified supporting fields.
- Gate configuration takes a source registry instead of a host list.
- `.env.example`: Vertex AI mode needs `GOOGLE_GENAI_USE_ENTERPRISE=true`;
  `GOOGLE_CLOUD_LOCATION` is the single region setting, documented as
  `asia-south1` (previously `us-central1`).

#### Not changed
- No deployment, Cloud Run service, credential or publishing change.
- No live Gemini call has been made.

### Milestone 1

#### Added
- Deterministic religious validation gate with signed attestations and typed
  evidence contracts (`verification/`), with unit tests.
- `npm test` and `npm run typecheck`; `zod` declared as a direct dependency.
- Architecture blueprint (sections 1–20) and `CLAUDE.md`.
- `ARCHITECTURE.md`, `IMPLEMENTATION_PLAN.md`, `SECURITY.md`,
  `INTEGRATIONS.md`, `TESTING.md`, `CHANGELOG.md`.
- `HIDAYA_GATE_ATTESTATION_KEY` placeholder in `.env.example`.


## 0.1.0

- Initial ADK TypeScript starter with 13 agents.
