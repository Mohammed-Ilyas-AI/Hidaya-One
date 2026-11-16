# Implementation plan

Phases follow blueprint §18. Status reflects this repository only.

| Phase | Scope | Status |
| --- | --- | --- |
| 1 Agent Foundation | Verify the 13 agents, tool calls, auth, deterministic verification | In progress: no live model run yet |
| 2 Workflow Intelligence | Graph workflow with fail-closed gate branches | Done for research → verification → script; later stages not started |
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
- [ ] **M3 — Live agent verification.** Run the pipeline against Gemini with
  real credentials: confirm Google Search and URL Context calls execute, that
  the agents produce the required JSON, and that the model is served in
  `asia-south1`. Needs credentials this environment does not have.
- [ ] **M4 — Source retrieval in code.** Have the gate fetch the cited passage
  from registered sources itself and compare, instead of trusting two agent
  reports. Closes the main limitation in `ARCHITECTURE.md`.
- [ ] **M5 — Durable review and audit.** Persist gate decisions and the human
  review queue (Phase 3 data layer).
- [ ] **M6 — Attested hand-off to later stages.** Make the creative, video, QC
  and channel stages require an attested script package.
- [ ] **M7 — Monorepo move.** Relocate to `apps/agent` and `packages/contracts`
  once a second application needs the contracts.

## Decisions needed from the owner

1. **Source roles.** Confirm the role assigned to each registered host
   (`ARCHITECTURE.md`, "Source registry"), in particular that sunnah.com and
   dorar.net may be used for grading evidence.
2. **Script editions.** An Uthmani-script text compared with a simple-script
   text is a mismatch and stops. Confirm, or name the edition both agents
   should read.
3. **Partial batches.** Passing records proceed while failed ones are
   withheld. Say if a single failure should instead hold the whole batch.
4. **Other code.** The blueprint refers to an existing backend, Angular
   monorepo and Cloud Run services. None are in this repository.
