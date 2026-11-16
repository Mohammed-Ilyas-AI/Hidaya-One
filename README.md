# HIDAYA ONE — ADK TypeScript starter

This is a code-first TypeScript port of the nine main roles in the Agent Studio export.

## Important distinction

The Google Cloud Agent Studio **Get code** flow in your screenshot generated Python (`agent.py`). That Python file is not Node.js code and cannot be pasted into an ADK TypeScript project. This folder re-creates the agent roles with Google's TypeScript ADK package.

This starter preserves:
- 9 main agents (Orchestrator + 8 specialist agents)
- 4 internal helper agents (Google Search and URL Context helpers for Research and Verification)

So the source contains 13 `LlmAgent` instances in total, while retaining the same 9 main roles.

## What is and is not connected

Configured in code:
- Gemini 3.8 Flash model ID
- ADK TypeScript agents
- Google Search and URL Context helper agents, exposed to the Research and
  Verification agents as agent tools
- An ADK graph Workflow that enforces research → independent verification →
  deterministic gate → script drafting (see `ARCHITECTURE.md`)

None of this has been run against a live Gemini model from this repository
yet; see `INTEGRATIONS.md`.

Not connected yet:
- Veo video generation API
- Female Tamil TTS
- Cloud Storage asset persistence
- Video rendering / assembly service
- YouTube OAuth and Data API upload
- Instagram Graph API publishing
- Persistent topic/history database

Those agents return technical briefs and explicit NOT_CONNECTED statuses. They do not pretend to generate files or publish videos.

## Requirements

Use the current official ADK TypeScript quickstart prerequisites:
- Node.js 24.13.0 or later
- npm 11.8.0 or later

## Run in Google Cloud Shell (browser-based)

1. Open Google Cloud Console and start Cloud Shell.
2. Upload/extract this folder into Cloud Shell, or clone the project from your Git repository.
3. Check the runtime:

```bash
node --version
npm --version
```

4. Install dependencies:

```bash
npm install
```

5. Copy `.env.example` to `.env`, uncomment the Vertex AI block and set your project ID. `GOOGLE_CLOUD_LOCATION` is the one region setting (intended: `asia-south1`). Do not commit `.env`.

```bash
cp .env.example .env
```

   Set the gate signing key as well. Without it the verification gate blocks
   everything and no script is drafted:

```bash
echo "HIDAYA_GATE_ATTESTATION_KEY=$(openssl rand -hex 32)" >> .env
```

6. Authenticate with Google Cloud for Vertex AI:

```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project YOUR_GOOGLE_CLOUD_PROJECT_ID
```

7. Start the ADK development chat UI:

```bash
npm run adk:web
```

The ADK Web UI is for local development and debugging, not production hosting. Open the URL printed by the command (normally port 8000).

Alternatively, run a single CLI interaction:

```bash
npm run adk:run
```

## First test prompt

```text
Start a Hidaya One daily research batch.
Return three distinct topic candidates with exact primary Quran/Hadith source URLs.
Do not draft scripts for any item that is not independently VERIFIED.
Return a research report and state the missing evidence clearly.
Do not generate videos or publish anything.
```

## Architecture note

Research, verification and script drafting run as an ADK graph `Workflow` with
a deterministic gate in application code. The Orchestrator reaches them only
through the `run_verified_script_pipeline` tool, and the Tamil Script Agent
re-checks the gate's attestation before its model is called. The other five
specialists are still coordinated by LLM delegation. Details and limitations:
`ARCHITECTURE.md`.

## Checks

```bash
npm run typecheck
npm test
```

Tests use scripted model responses and make no Gemini calls.

## Next milestones

See `IMPLEMENTATION_PLAN.md`.

Do not deploy publicly or enable publishing from this starter.
