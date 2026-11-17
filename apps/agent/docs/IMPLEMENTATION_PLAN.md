# Implementation plan

Phases follow blueprint §18. Status reflects this repository only.

| Phase | Scope | Status |
| --- | --- | --- |
| 1 Agent Foundation | Verify the 13 agents, tool calls, auth, deterministic verification | In progress: two live verified-script runs; production workflow not run live |
| 2 Workflow Intelligence | Graph workflow with fail-closed gate branches | Done for all agent stages, with mock models only |
| 3 Backend Foundation | API gateway, auth, job manager, persistence | Not started |
| 4 Frontend Foundation | Angular dashboard on real backend contracts | Not started |
| 5 Research and Script Automation | Topic discovery through script approval | Not started |
| 6 Media Automation | Image, Veo, TTS, rendering | Not started |
| 7 Quality and Approval | QC, revisions, human approval | Not started |
| 8 Publishing | YouTube OAuth, Instagram authorization | Not started |
| 9 Analytics | Publication tracking, performance | Not started |
| 10 Production Hardening | Security review, reliability, backup, monitoring, cost | Not started |

## Milestones

- [x] **M0 — Reference documents.**
- [x] **M1 — Deterministic gate.** Contracts, gate, attestation, unit tests.
- [x] **M2 — Gate enforced in the workflow.** ADK graph workflow, script entry
  guard, source registry, diacritics policy, workflow-boundary tests.
- [x] **M3 — Controlled production workflow.** The five downstream agents run
  as a second ADK workflow with attestation checks at every agent boundary,
  stage records, job tracking, idempotency, cancellation, and an owner
  approval step no agent can reach. Demonstrated end to end with mock models
  and nothing connected.
- [ ] **M4 — Live agent verification.** Run both workflows against Gemini with
  a real credential and a gate signing secret: confirm Google Search and URL
  Context execute, that the agents produce the required JSON, and measure
  tokens per run. **In progress.** Done: `hidaya-one-agent-api` deployed with
  the gate secret; two verified-script runs (`SCRIPTS_DRAFTED`); the 808 s run
  traced to a model call with no client deadline; per-call deadline and
  token telemetry added (not yet deployed). Left: redeploy with the owner's
  go-ahead, measure tokens per run from the telemetry, one bounded live run
  of the production workflow. **Recommended next.**
- [ ] **M5 — Source retrieval in code.** Have the gate fetch the cited passage
  from registered sources itself and compare, instead of trusting two agent
  reports. Closes the main limitation in `ARCHITECTURE.md`.
- [ ] **M6 — Durable jobs, review and audit.** A persistent `JobStore`, the
  human review queue, and an approval interface (Phase 3 and 4).
- [ ] **M7 — First real provider.** Tamil narration through Cloud
  Text-to-Speech, inside its free allowance, behind the provider adapter.
- [ ] **M8 — Rendering.** FFmpeg and a headless browser in a Cloud Run job.
- [x] **M9 — Monorepo move.** The agent code is in `apps/agent`, next to
  `apps/api` and `apps/web`.

## Decisions needed from the owner

1. **Source roles.** Confirm the role assigned to each registered host
   (`ARCHITECTURE.md`, "Source registry"), in particular that sunnah.com and
   dorar.net may be used for grading evidence.
2. **Script editions.** An Uthmani-script text compared with a simple-script
   text is a mismatch and stops. Confirm, or name the edition both agents
   should read.
3. **Partial batches.** Passing records proceed while failed ones are
   withheld. Say if a single failure should instead hold the whole batch.
4. ~~**Other code.**~~ Settled: the backend and dashboard are in this
   monorepo (`apps/api`, `apps/web`).
5. ~~**Is `hidaya-one-dev` public?**~~ Settled: no public invoker (checked
   2026-11-17, `docs/deployment.md`).
6. **Model access path.** Both services now call Gemini through Vertex AI at
   location `global` with the runtime service account. Confirm this is the
   path to keep, and whether the unused `gemini-api-key` secret can go.
