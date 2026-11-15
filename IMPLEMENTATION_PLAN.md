# Implementation plan

Phases follow blueprint §18. Status reflects this repository only.

| Phase | Scope | Status |
| --- | --- | --- |
| 1 Agent Foundation | Verify the 13 agents, tool calls, auth, deterministic verification | In progress |
| 2 Workflow Intelligence | Graph workflow with fail-closed gate branches | Not started |
| 3 Backend Foundation | API gateway, auth, job manager, persistence | Not started |
| 4 Frontend Foundation | Angular dashboard on real backend contracts | Not started |
| 5 Research and Script Automation | Topic discovery through script approval | Not started |
| 6 Media Automation | Image, Veo, TTS, rendering | Not started |
| 7 Quality and Approval | QC, revisions, human approval | Not started |
| 8 Publishing | YouTube OAuth, Instagram authorization | Not started |
| 9 Analytics | Publication tracking, performance | Not started |
| 10 Production Hardening | Security review, reliability, backup, monitoring, cost | Not started |

## Milestones

- [x] **M0 — Reference documents.** Blueprint, `CLAUDE.md` and the maintained
  documents are in the repository.
- [x] **M1 — Deterministic gate.** Evidence contracts, gate, attestation and
  unit tests in `verification/`.
- [ ] **M2 — Live agent verification.** Run all 13 agents against Gemini and
  confirm Google Search and URL Context calls actually execute. Needs Google
  Cloud or AI Studio credentials, which this environment does not have.
- [ ] **M3 — Gate in the workflow.** Make research and verification agents emit
  the contract schemas, and run the gate as a code node in an ADK graph
  workflow so only attested evidence reaches the Script Agent.
- [ ] **M4 — Monorepo move.** Relocate to `apps/agent` and `packages/contracts`
  once a second application needs the contracts.

## Decisions needed from the owner

1. **Trusted source hosts.** The gate takes the list as configuration and has
   no default. Which sites count as primary sources?
2. **Non-`VERIFIED` statuses.** Today only `NEEDS_HUMAN_REVIEW` goes to the
   review queue; `SOURCE_NOT_FOUND`, `ARABIC_MISMATCH`, `REFERENCE_MISMATCH`,
   `AUTHENTICITY_UNCONFIRMED` and `REJECTED` stop the workflow. Should any of
   those go to review instead?
3. **Region.** The blueprint says `asia-south1`; `.env.example` suggests
   `us-central1`. Model availability in `asia-south1` has not been checked.
4. **Other code.** The blueprint refers to an existing backend, Angular
   monorepo and Cloud Run services. None are in this repository.
