# Architecture

The source of truth for system design is
[`docs/architecture/hidaya-one-architecture-blueprint.md`](docs/architecture/hidaya-one-architecture-blueprint.md).
Its last section tracks what is implemented. This file describes how the code
that exists today works, including where it falls short of the blueprint.

## What exists

```text
agent.ts                              buildHidayaAgents(): the 13 ADK LlmAgents
verification/
  contracts.ts                        Zod schemas: EvidenceCandidate, VerificationRecord
  source-registry.ts                  Versioned trusted-source registry
  arabic.ts                           Arabic normalisation and diacritic comparison
  gate.ts                             Deterministic gate, item and batch attestations
workflow/
  verified-script-pipeline.ts         Workflow 1, script entry guard, pipeline tool
  production-pipeline.ts              Workflow 2, production entry guards, jobs, approval
  jobs.ts                             Job and stage records, in-memory job store
  providers.ts                        Media and publishing adapters (none connected)
  test-support.ts                     Scripted mock model, fake providers, synthetic fixtures
```

## Agent structure

```text
hidaya_ai_orchestrator (root LlmAgent, no sub-agents)
  tool: run_verified_script_pipeline ---> workflow 1 only
  tool: run_production_workflow -------> workflow 1, then workflow 2

Workflow 1: verified_script_pipeline (own runner and session)
  START
   -> islamic_research_agent          tools: research search + URL helpers
   -> collect_candidates              code
        VERIFY            -> verification_agent   tools: verification search + URL helpers
        NOTHING_TO_VERIFY -> deterministic_gate
   -> deterministic_gate              code
        PROCEED      -> tamil_script_agent        entry guard, then model
        HUMAN_REVIEW -> human_review_queue        code
        STOP         -> stop_workflow             code

Workflow 2: production_workflow (own runner and session)
  START
   -> production_intake               code: re-verify the production package
   -> creative_producer               entry guard, then model
   -> record_creative_plan            code
   -> hidaya_veo_video_generator      entry guard, then model
   -> asset_production                code: prompt rule, video provider
   -> hidaya_video_editor             entry guard, then model
   -> assembly                        code: narration provider, renderer
   -> quality_control_agent           entry guard, then model
   -> qc_gate                         code: decides publish readiness
   -> hidaya_channel_manager          entry guard, then model
   -> approval_gate                   code: requests owner approval
  Any code node can route to production_halt instead.
```

All 13 agents and their original instructions are kept. What changed in how
they are wired:

- No agent is a sub-agent of the Orchestrator. All eight specialists are
  workflow nodes, reached only through the Orchestrator's two tools.
- The four helper agents are `AgentTool`s of their parent instead of
  sub-agents. An agent run as a workflow node cannot transfer to a sub-agent
  (ADK rejects the transfer), and as tools their results return to the parent.
- Instructions gained a section each describing the pipeline input or output;
  the original text is unchanged.

## ADK mechanisms used

Confirmed against the installed `@google/adk` 2.4.0, not assumed:

| Mechanism | Used for |
| --- | --- |
| `Workflow` with `edges` and routing maps | The graph above. ADK marks the class experimental |
| `LlmAgent` as a workflow node | Agents are nodes directly; a node agent sees only its node input, not the conversation |
| `FunctionNode` with `ctx.route` and `ctx.state` | `collect_candidates`, `deterministic_gate`, the review and stop nodes |
| `beforeModelCallback` | The Script Agent's entry guard |
| `FunctionTool` | `run_verified_script_pipeline` |
| `AgentTool` | Helper agents |
| `InMemoryRunner`, `createRunConfig({maxLlmCalls})` | Running the workflow as its own invocation, with a call limit of 40 |

`NodeTool` (passing the workflow in `tools`) was tried and rejected: when a
workflow runs through it, tool results do not reach the agents inside the
workflow on their next model call, so research with helper tools would not
work. The pipeline tool therefore runs the workflow as the root of its own
runner. A side effect is isolation: the pipeline's agents see nothing of the
Orchestrator's conversation, and the Orchestrator sees only the tool result.

## How the gate is enforced

1. **Research.** The Research Agent ends its reply with a JSON list of
   candidates. `collect_candidates` parses it, validates each candidate against
   the contract, and assigns `evidenceId`, `topicId` and `researchedBy` itself.
   A malformed candidate, or one beyond five per run, is not sent on.
2. **Verification.** The Verification Agent receives only each item's
   `evidenceId`, reference and the researcher's URL. It is not shown the
   researched Arabic text, gradings or translation, so it has to retrieve them.
   It ends its reply with one record per `evidenceId`.
3. **Gate.** `deterministic_gate` stamps `verifiedBy` and `verifiedAt`, then
   calls `evaluateEvidence` for every record. It writes each decision to the
   audit sink, signs the passing records and the batch, and sets the routes.
4. **Script.** Only on `PROCEED` does the Script Agent run, and its node input
   is the attested package. Its entry guard runs before every model call.

### Gate checks

| Check | Failing result |
| --- | --- |
| Both records match strict schemas; unknown fields such as `gatePassed` or `verified` rejected | Blocked |
| Model output supplies an identity field (`researchedBy`, `verifiedBy`, …) | Blocked |
| Verification Agent status is `VERIFIED` | Its status is kept: `NEEDS_HUMAN_REVIEW` → review, all others → blocked |
| Verification record carries this candidate's `evidenceId`; exactly one record per ID | Blocked |
| Verifier identity differs from researcher identity | Blocked |
| References identical; Quran surah 1–114, ayah range ordered | Blocked (`REFERENCE_MISMATCH`) |
| Source URLs are valid `https` | Blocked (`SOURCE_NOT_FOUND`) |
| Source host is registered for the needed role | Human review |
| Arabic base characters identical | Blocked (`ARABIC_MISMATCH`) |
| Arabic diacritics identical | Human review, both texts and each difference recorded |
| Hadith has a verified grading with a named scholar; every researched grading confirmed | Blocked (`AUTHENTICITY_UNCONFIRMED`) |
| Signing key present, 32+ characters | Blocked |

Status policy: `VERIFIED` proceeds only with a valid attestation;
`NEEDS_HUMAN_REVIEW` goes to the review list; `SOURCE_NOT_FOUND`,
`ARABIC_MISMATCH`, `REFERENCE_MISMATCH`, `AUTHENTICITY_UNCONFIRMED` and
`REJECTED` stop. Nothing is retried or upgraded. A corrected record needs a
new run, which produces a new digest and a new attestation.

### Arabic comparison

Texts are compared after Unicode NFC, with tatweel removed and whitespace
collapsed. A diacritic is a Unicode nonspacing mark (category Mn). If the base
characters match and only marks differ, the record goes to human review with
both original strings and, per character position, the marks on each side.
Diacritics are never stripped to make a record pass.

Any base-character difference is a mismatch. This includes characters that
look related, such as alef (U+0627) and alef wasla (U+0671). Comparing an
Uthmani-script edition against a simple-script edition of the same passage is
therefore reported as `ARABIC_MISMATCH` and stops; both agents need to read
the same script edition.

### Source registry

`verification/source-registry.ts`, version `2026-11-16.1`:

| Host | Roles |
| --- | --- |
| quran.com | `QURAN_TEXT` |
| tanzil.net | `QURAN_TEXT` |
| sunnah.com | `HADITH_TEXT`, `GRADING_EVIDENCE` |
| dorar.net | `HADITH_TEXT`, `GRADING_EVIDENCE` |

A fourth role, `SECONDARY_SUPPORT`, exists and has no hosts. Registration only
makes a host eligible for comparison; it is never evidence of correctness. An
unregistered host, or a registered host used outside its role, sends the
record to human review. The registry version is recorded in every decision
and attestation. Hosts are added only by editing the file; there is no
environment variable or runtime path that adds one, and a test pins the list.

The role assignment above was chosen during implementation and needs the
owner's confirmation.

## Signing and attestation

- **Item attestation.** HMAC-SHA256, keyed with `HIDAYA_GATE_ATTESTATION_KEY`,
  over the gate version, registry version, evidence ID, issue time and a
  SHA-256 digest of the canonical JSON of the full candidate and verification
  record. The digest covers the Arabic text, reference, URLs, edition,
  gradings, unverified supporting fields, status, notes, verifier identity and
  verification time. Changing any of them invalidates the attestation.
- **Batch attestation.** HMAC over the run ID, total record count, the sorted
  digests of the passing records and `fullyVerified`. A partial batch cannot be
  relabelled as complete, and records cannot be added or dropped.
- **Script entry guard.** Before each model call the Script Agent parses its
  input as a package, re-verifies every item attestation and the batch
  attestation, and requires each record's status to be `VERIFIED`. On failure
  the model is not called and the agent returns `SCRIPT_AGENT_BLOCKED`. On
  success the request is rewritten to contain only the verified evidence, with
  no signatures, so the model sees nothing else.
- **Fail closed.** With no key, or a key under 32 characters, the gate signs
  nothing, so nothing passes, and the guard accepts nothing.
- The key is never logged or placed in events, state, tool results or audit
  entries. Signatures are removed from what the Orchestrator's model sees.

## Mixed batches

Records are decided one by one. Passing records go to the Script Agent;
others go to review or stop. The Script Agent is told how many records were
withheld and that the batch is not fully verified; `fullyVerified` is true
only when every record in the run passed.

## Audit

Every gate decision (outcome, status, reasons, versions, digest, Arabic
difference, corroboration) and every script-entry check goes to an audit sink.
The default sink writes one JSON line to stdout, which Cloud Logging collects.
The pipeline tool also appends each run's decisions to the Orchestrator's
session state under `hidaya:gate_audit`, and returns them in its result.

## Production workflow

`startProduction` runs one job: workflow 1, then, only if a script was drafted
from attested evidence, workflow 2.

### Attestation at every agent boundary

After the Script Agent returns, code signs a **script attestation**: an HMAC
over the SHA-256 of the exact draft and the signature of the batch attestation
it was drafted from. Evidence, batch attestation, draft and script attestation
together form the production package.

Each of the five production agents has a `beforeModelCallback` entry guard. It
re-verifies every item attestation, the batch attestation and the script
attestation. If any check fails, the model is not called and the agent returns
`PRODUCTION_STAGE_BLOCKED`. If they pass, the request is rewritten to the
attested evidence, the attested script and the earlier stage outputs, with no
signatures. Changing one character of the script, or any evidence field,
blocks every later agent.

### Stage records

Each stage writes a record: stage, actor, status, start and finish time, what
it received, its output, and any error. Statuses used: `COMPLETED`, `PASSED`,
`PARTIAL`, `BLOCKED`, `FAILED`, `SKIPPED`, `NOT_CONNECTED`, `SIMULATED`,
`REQUESTED`, `DISABLED`. For workflow 1 the times are when each node was first
and last seen emitting, which is close to but not exactly its run time.

### Code checks between agents

| Node | Check |
| --- | --- |
| `production_intake` | The production package verifies |
| every `record_*` node | The agent returned output and was not blocked |
| `asset_production` | No Arabic script in the clip specifications, which are generation prompts. A violation fails the job before any provider is called |
| `assembly` | Narration and rendering are attempted only through a connected provider, and rendering only if clips and narration exist |
| `qc_gate` | Publish-ready only if QC returned `PASS` in the required format **and** a rendered video exists **and** it is not simulated. `FAIL` halts the job. Unparseable QC output is treated as needing human review |
| `approval_gate` | Records an approval request. It never publishes |

### Jobs

`workflow/jobs.ts` defines the job record (ID, workflow, request, status,
outcome, current stage, progress, times, error, stage records, approval,
assets) and a `JobStore` interface. Job statuses: `CREATED`, `RUNNING`,
`WAITING_FOR_APPROVAL`, `COMPLETED`, `FAILED`, `CANCELLED`.

- **Start:** `startProduction`. A `requestKey` makes the start idempotent: a
  second start with the same key returns the first job and runs nothing.
- **Stop:** an `AbortSignal` cancels a job; agents after the cancellation
  point do not run.
- **Track:** `jobStore.get` and `jobStore.list`, optionally by status.
- **Idempotency:** media generation, narration, rendering and publishing each
  run at most once per key derived from the script digest. A second job for
  the same script reuses the stored result.
- **Retries:** nothing retries automatically. A failed stage fails the job.
  `STAGE_RETRY_POLICY` records, per stage, whether a re-run is side-effect free
  or deduplicated by key.

The only store is `InMemoryJobStore`. Jobs are lost when the process ends.

### Providers

`workflow/providers.ts` defines adapters for video, narration, rendering and
publishing. The defaults report `NOT_CONFIGURED` and refuse to act, so stages
are recorded as `NOT_CONNECTED`. An asset carries a `simulated` flag; test
doubles set it, and a simulated asset can never make a job publish-ready.

### Approval and publishing

`recordApprovalDecision` records the owner's decision and requires a named
decider. `publishApprovedJob` publishes only when the owner approved, the job
is publish-ready, a real rendered video exists, and the publisher is
connected; it publishes once per script. Neither function is exposed to any
agent as a tool, so no model can approve or publish. There is no screen for
the owner to call them from yet.

### The Orchestrator

It accepts the request, chooses between its two tools, and reports. Its tools
return reports built by code from recorded state. It has no sub-agents, no
approval tool and no publishing tool, and tool results contain no signatures.

## Trust boundary and limitations

What is enforced by code: a script draft can only come from the Script Agent,
the Script Agent's model can only be called with evidence the gate attested,
and the Orchestrator cannot change either.

What is not:

1. **The gate does not read sources.** It compares what two LLM agents report
   having retrieved. If both report the same wrong text, or the verifier
   reports text that is not on the page, the gate passes it. This is the main
   remaining risk; code-side retrieval from registered sources would close it.
2. **Independence is procedural, not cryptographic.** The two agents are
   separate ADK agents with separate helper tools, the verifier is not shown
   the researcher's wording, and code stamps their identities. They are still
   the same model family using the same search service, and the verifier is
   given the researcher's URL. Each decision records whether the two source
   URLs were the same URL, the same host or different hosts.
3. **The Orchestrator is still an LLM.** It cannot invoke any specialist
   outside the workflows, alter a gate decision, approve or publish. It can
   still write text of its own in its reply to the user.
3a. **Downstream outputs are not themselves verified.** The production agents
   can only start from attested evidence and the attested script, but what
   they then write (storyboard, captions, titles) is model output. Code checks
   only that video prompts contain no Arabic script. Depiction rules and
   caption accuracy rely on the QC Agent and the owner's review.
4. **Translation, narrator and context are not verified.** They are carried
   under `unverifiedSupporting`, covered by the attestation so they cannot be
   altered, and labelled as unchecked to the Script Agent.
5. **Nothing is durable.** Jobs, approvals, the human review list and the audit
   trail live in memory, tool results and stdout logs. There is no persistent
   store and no review or approval screen.
6. **Symmetric key.** Anything holding the key can mint attestations. There is
   no key ID, rotation or expiry; an attested package stays valid.
7. **Not run against a live model.** Whether Gemini reliably produces the
   required JSON has not been tested. Output that does not parse is blocked.
8. **Quran reference bounds are coarse.** Surah 1–114 and ayah 1–286 are
   checked, not the ayah count of each surah.
9. **Cost limit scope.** The limit of 40 model calls per run covers the
   pipeline's own agents. Helper agents run in nested ADK runners and are not
   counted by it.
