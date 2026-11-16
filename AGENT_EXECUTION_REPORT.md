# Agent execution report

Date: 2026-11-16. What has actually been executed, with what, and what that
does and does not prove.

## What kind of execution this is

Every run described here used the real agents from `agent.ts`, the real ADK
runtime and both real ADK workflows. **The model was a scripted mock** that
returns prepared text and records every request it receives. Media and
publishing used either the real default (nothing connected) or labelled fakes.

So these runs prove the control system: order, gates, guards, state, records.
They prove nothing about Gemini's behaviour, search results, or media quality.

| Evidence level | Count |
| --- | --- |
| Automated tests passing | 61 of 61 |
| Agents executed with a mock model | 13 of 13 |
| Agents executed against live Gemini | 0 of 13 |
| Real videos produced | 0 |
| Publications | 0 |

Commands: `npm run typecheck` (clean) and `npm test`.

## End-to-end demonstration

Test: "end-to-end demonstration: one job from topic to approval request,
nothing connected" in `workflow/production.test.ts`. Content: synthetic
placeholders only, marked as such in the fixtures. Providers: the production
default, with nothing connected.

| # | Required step | What happened | Recorded as |
| --- | --- | --- | --- |
| 1 | Topic received | The request was stored on the job | job `request` |
| 2 | Research performed | Research Agent ran; one candidate record | `TOPIC_DISCOVERY_AND_RESEARCH`: COMPLETED |
| 3 | Verification performed | Verification Agent ran, without sight of the researched Arabic | `VERIFICATION`: COMPLETED |
| 4 | Gate passed or failed | The record passed and was attested | `VERIFICATION_GATE`: PASSED |
| 5 | Script only if permitted | Script Agent's model was called once, with attested evidence only | `SCRIPT`: COMPLETED |
| 6 | Creative plan produced | Creative Producer ran after its entry guard | `CREATIVE_PLANNING`: COMPLETED |
| 7 | Production status recorded | Clip specifications and edit brief produced; no provider connected | `VIDEO_SPECIFICATION`, `EDIT_PLANNING`: COMPLETED. `ASSET_GENERATION`, `NARRATION`, `VIDEO_ASSEMBLY`: NOT_CONNECTED |
| 8 | QC status recorded | QC Agent ran; code decided the job is not publish-ready because no video exists | `QUALITY_CONTROL`: COMPLETED, `publishReady: false` |
| 9 | Human approval requested | An approval request was recorded and the job paused | `HUMAN_APPROVAL`: REQUESTED; job `WAITING_FOR_APPROVAL` |
| 10 | Publishing stays disabled | Nothing was published; no agent can approve or publish | `PUBLISHING`: DISABLED, `ANALYTICS`: NOT_CONNECTED |

The job's report states: "No real video exists and nothing has been published."

## Stage by stage

| Stage | Works with mocks | Works for real | Why not, if not |
| --- | --- | --- | --- |
| Topic discovery and research | Yes | Untested | No Gemini credential here |
| Independent verification | Yes | Untested | Same |
| Deterministic gate | Yes | Yes, it is code | Its inputs are agent reports, not fetched sources |
| Script generation | Yes | Untested | No Gemini credential |
| Creative storyboarding | Yes | Untested | Same |
| Video specification | Yes | Untested | Same |
| Image and video assets | Records NOT_CONNECTED | No | No provider adapter; the API is paid |
| Narration | Records NOT_CONNECTED | No | No TTS adapter |
| Video assembly | Records NOT_CONNECTED | No | No renderer |
| Quality control | Yes | Untested | No Gemini credential; nothing to inspect without a video |
| Human approval | Request recorded; decision function tested | Partly | No screen or durable queue for the owner to act in |
| Publishing | Refuses correctly | No | No publisher adapter, no OAuth |
| Analytics | Records NOT_CONNECTED | No | Nothing is published |

## Control behaviour that was tested

| Behaviour | Test |
| --- | --- |
| A failed gate stops the job before any production agent | "a failed verification gate stops the job before any production agent runs" |
| Production agents see only attested material | "production agents see attested evidence, the attested script and earlier outputs only" |
| No production agent runs on a tampered, forged or missing package | "no production agent can be invoked without a valid production package" |
| Arabic text in video prompts stops the job | "Arabic script in video generation prompts stops the job before any provider is called" |
| QC cannot declare something publishable | "QC decides nothing on its own: FAIL halts, unparseable output is not a pass" |
| Simulated media is never publishable | "simulated media is recorded as simulated and can never be published" |
| Publishing needs approval and happens once | "publishing needs owner approval, a real video, and happens once" |
| Rejection and revision end the job | "rejection and revision requests end the job without publishing" |
| No duplicate jobs or duplicate media generation | "duplicate starts and duplicate media generation are prevented" |
| Cancel, list, inspect | "jobs can be cancelled, listed and inspected" |
| Failures are visible | "a model error fails the job visibly instead of being swallowed" |
| Mixed batches | "a mixed batch produces from the passing records only" |
| The Orchestrator cannot approve or publish | "the Orchestrator runs production through its tool and can neither approve nor publish" |
| Helpers execute and report back | "the four helper agents execute as tools of their parents and their results return to the parent" |

The gate's own tests are listed in `TESTING.md`.

Five safeguards were weakened one at a time to confirm the tests notice:
removing the production entry guards, skipping the script attestation check,
skipping the approval check, removing the Arabic prompt rule, and letting a
simulated video count as publish-ready. Each made tests fail; the code was
then restored.

## What is blocked

| Blocker | Blocks |
| --- | --- |
| No Gemini credential in this environment | Live verification of all 13 agents |
| No gate signing secret in the Cloud project | Any real run of the current code |
| No provider adapters | Images, video, narration, rendering, publishing |
| No durable job store | Jobs, approvals and audit records survive only as long as the process |
| No approval screen | The owner has no place to approve; the function exists, the interface does not |
