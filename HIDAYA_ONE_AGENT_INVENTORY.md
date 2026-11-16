# Hidaya One agent inventory

Checked against `agent.ts` at this commit and the installed `@google/adk`
2.4.0. All 13 agents are `LlmAgent` instances created by `buildHidayaAgents()`.

## Status definitions

| Status | Meaning |
| --- | --- |
| `IMPLEMENTED` | The agent exists in code with its instructions |
| `CONFIGURED` | It has a model setting, tools and a place in a workflow |
| `EXECUTION_TESTED` | It ran inside the real ADK runtime with a scripted mock model, in an automated test |
| `LIVE_VERIFIED` | It ran against a real Gemini model and the result was checked |
| `BLOCKED` | Something outside the code prevents the next status |
| `NOT_CONFIGURED` | Missing |

**No agent is `LIVE_VERIFIED`.** No authenticated Gemini call has been made
from this repository. An agent loading, or passing a mock test, is not live
verification.

## Common to all agents

| Aspect | Value |
| --- | --- |
| Model | `HIDAYA_MODEL` environment variable, default `gemini-3.8-flash` |
| Shared instructions | `COMMON_GUARDRAILS`: languages, targets, no invented religious content, no false success claims |
| ADK input/output schema | None declared on any agent. Structure is enforced by application code around the agents, as listed per agent |
| Errors | A model error fails the job (`FAILED`, with the error recorded). Nothing retries automatically |
| Live status | `BLOCKED`: this environment has no Gemini credentials |

## Nine primary agents

| # | Role | Agent name | Reached through | Tools | Input it receives | Output and how code checks it | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Hidaya AI Orchestrator | `hidaya_ai_orchestrator` | Root agent | `run_verified_script_pipeline`, `run_production_workflow`. No sub-agents | The user's request | Free text to the user. It cannot change tool results | IMPLEMENTED, CONFIGURED, EXECUTION_TESTED |
| 2 | Research Agent | `islamic_research_agent` | First node of `verified_script_pipeline` | Two helper agents | The production request | A JSON list of candidates, parsed and validated by `collect_candidates` | IMPLEMENTED, CONFIGURED, EXECUTION_TESTED |
| 3 | Verification Agent | `verification_agent` | Node after `collect_candidates` | Two helper agents | Evidence IDs, references, researcher URLs. Not the researched Arabic | A JSON list of records, validated and decided by `deterministic_gate` | IMPLEMENTED, CONFIGURED, EXECUTION_TESTED |
| 4 | Tamil Script Agent | `tamil_script_agent` | Gate's `PROCEED` route only | None | Attested evidence only, after its entry guard | Free-text draft; code signs a script attestation over it | IMPLEMENTED, CONFIGURED, EXECUTION_TESTED |
| 5 | Creative Producer | `creative_producer` | `production_workflow`, after intake | None | Attested evidence and script, after its entry guard | Free text, recorded as the creative plan | IMPLEMENTED, CONFIGURED, EXECUTION_TESTED |
| 6 | Veo Video Generator | `hidaya_veo_video_generator` | After the creative plan | None. No video provider is connected | Same, plus the creative plan | Clip specifications. Code rejects any Arabic script in them | IMPLEMENTED, CONFIGURED, EXECUTION_TESTED. Video generation: BLOCKED (no provider) |
| 7 | Video Editor | `hidaya_video_editor` | After asset production | None. No TTS or renderer is connected | Same, plus clip specifications | Free-text edit brief | IMPLEMENTED, CONFIGURED, EXECUTION_TESTED. Rendering: BLOCKED (no provider) |
| 8 | Quality Control Agent | `quality_control_agent` | After assembly | None | Same, plus all earlier outputs and whether a video exists | JSON verdict. `qc_gate` decides publish readiness; unparseable output is never a pass | IMPLEMENTED, CONFIGURED, EXECUTION_TESTED |
| 9 | Channel Manager | `hidaya_channel_manager` | After the QC gate | None. No publisher is connected | Same, plus the QC decision | Free-text draft release manifest | IMPLEMENTED, CONFIGURED, EXECUTION_TESTED. Publishing: BLOCKED (no provider, and needs owner approval) |

## Four helper agents

Each is an `AgentTool` of its parent. They were sub-agents in the original
starter; ADK rejects sub-agent transfer from an agent that runs as a workflow
node, so they are tools now and their results return to the parent.

| # | Agent name | Parent | Built-in tool | Responsibility | Status |
| --- | --- | --- | --- | --- | --- |
| 10 | `research_google_search_agent` | Research Agent | Google Search | Find primary Quran and Hadith references and source pages | IMPLEMENTED, CONFIGURED, EXECUTION_TESTED |
| 11 | `research_url_context_agent` | Research Agent | URL Context | Read supplied source URLs and extract exact wording and metadata | IMPLEMENTED, CONFIGURED, EXECUTION_TESTED |
| 12 | `verification_google_search_agent` | Verification Agent | Google Search | Independently search for the reference and grading attribution | IMPLEMENTED, CONFIGURED, EXECUTION_TESTED |
| 13 | `verification_url_context_agent` | Verification Agent | URL Context | Read source pages and compare wording, reference and grading | IMPLEMENTED, CONFIGURED, EXECUTION_TESTED |

For the helpers, `EXECUTION_TESTED` means the delegation was exercised: the
parent called the helper, the helper's mock model was invoked, and the reply
came back to the parent. The built-in Google Search and URL Context tools make
no call under a mock model, so **real search and page retrieval have never
been exercised**.

## Dependencies

| Agent | Needs before it can run for real |
| --- | --- |
| All | A Gemini credential (API key or Vertex AI access) |
| Research and Verification agents and their helpers | Google Search grounding and URL Context available on the chosen model and tier |
| Script Agent and all five production agents | `HIDAYA_GATE_ATTESTATION_KEY`, 32 characters or more. Without it nothing reaches them |
| Veo Video Generator | A video provider adapter (none exists) |
| Video Editor | TTS and renderer adapters (none exist) |
| Channel Manager | A publisher adapter, OAuth consent and owner approval (none exist) |

## Deployed copy

The Cloud Run service `hidaya-one-dev` runs an earlier version of these
agents, deployed on 12 November 2026, before the gate and workflows existed.
Whether its agents have executed successfully is unknown: logs are not
readable from here. See `GOOGLE_CONNECTOR_STATUS.md`.
