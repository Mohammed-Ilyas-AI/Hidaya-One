# Testing

```bash
npm run typecheck   # tsc --noEmit
npm test            # node --test, runs TypeScript directly (Node 22.18+ / 24)
```

No test calls Gemini or any network service. Models are replaced with
`MockLlm` (`apps/agent/src/workflow/test-support.ts`), which returns scripted responses and
records every request it receives.

## Unit tests — `apps/agent/src/verification/gate.test.ts`

The gate function in isolation: pass path, attestation binding and tampering,
injected fields, each status, Arabic mismatch, diacritics-only differences
(both texts and the exact marks recorded), letter / word / word-order
differences, source registry roles and the pinned default list, grading
attribution, self-verification, missing key, malformed input, mixed batch.

## Workflow tests — `apps/agent/src/workflow/pipeline.test.ts`

These build the real 13 agents with `buildHidayaAgents()` and run the real ADK
workflow. "Reached the Script Agent" is measured by counting the requests the
Script Agent's model received and inspecting their content.

| # | Test |
| --- | --- |
| 1 | valid Quran evidence reaches the Script Agent |
| 2 | valid Hadith evidence reaches the Script Agent with attributed gradings |
| 3 | invalid Quran reference never reaches the Script Agent |
| 4 | Arabic wording mismatch never reaches the Script Agent |
| 5 | diacritic-only difference enters human review |
| 6 | unregistered source enters human review |
| 7 | missing Hadith grading attribution is blocked |
| 8 | unconfirmed authenticity is blocked |
| 9 | researcher and verifier being the same identity is blocked |
| 10 | tampered evidence invalidates its attestation |
| 11 | forged gatePassed input is rejected |
| 12 | a mixed valid/invalid batch never reaches the Script Agent as fully verified |
| 13 | missing signing key fails closed |
| 14 | the Orchestrator cannot override a failed gate |
| 15 | no alternate workflow path can invoke the Script Agent with unattested evidence |

Further workflow tests: the verifier is not shown the researcher's Arabic text;
the Script Agent is shown attested evidence only; audit entries are recorded
without secrets; missing, duplicated or unparseable verification output blocks;
records over the per-run limit are blocked; all 13 agents exist; the four
helper agents execute as tools of their parents.

Test 15 covers the Script Agent run directly, wrapped as an agent tool, and
reached by transfer from another agent, plus a structural check that it is not
in the Orchestrator's agent tree and has one incoming graph edge.

The tests were checked by weakening the code: skipping the item attestation
check, removing the entry guard, re-adding the Script Agent as an Orchestrator
sub-agent, and skipping the batch attestation check each make tests fail.

## Production workflow tests — `apps/agent/src/workflow/production.test.ts`

The real 13 agents and both real workflows, with scripted models. Providers
are either the real default (nothing connected) or labelled fakes whose assets
are marked `simulated`.

- End-to-end demonstration from topic to approval request, with every stage
  record checked.
- A failed gate stops the job before any production agent.
- Production agents see attested evidence, the attested script and earlier
  outputs only.
- No production agent runs on a tampered, forged, missing or keyless package.
- Arabic script in video prompts stops the job before any provider call.
- QC `FAIL` halts; unparseable QC output is not a pass.
- Simulated media can never be published.
- Publishing needs owner approval and a real video, and happens once.
- Rejection and revision requests end the job.
- Duplicate starts and duplicate media generation are prevented.
- Jobs can be cancelled, listed and inspected.
- A model error fails the job visibly.
- A mixed batch produces from passing records only.
- The Orchestrator can neither approve nor publish.

`AGENT_EXECUTION_REPORT.md` maps these to the demonstration steps.

## Not covered

- Real model behaviour: whether Gemini produces the required JSON, and whether
  Google Search and URL Context calls execute. Needs credentials.
- Whether what an agent reports matches the source page.
- Any external integration (none exist).

## Fixture rule

Test data must be synthetic and obviously so. Never put real or
realistic-looking Quran or Hadith text, references, gradings or source URLs in
fixtures; a wrong one would be fabricated religious content.
