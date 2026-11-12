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
- ADK TypeScript agents and sub-agent delegation
- Google Search helper agents
- URL Context helper agents

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

5. Copy `.env.example` to `.env`, then replace `YOUR_GOOGLE_CLOUD_PROJECT_ID` with your project ID. Do not commit `.env`.

```bash
cp .env.example .env
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

## Important architecture note

This initial TypeScript port uses ADK `LlmAgent` sub-agent delegation, matching the exported Agent Studio structure. LLM delegation is not a hard deterministic gate. Before production, we must implement an ADK 2 graph-based Workflow with explicit validation nodes and branches so a failed religious verification blocks all downstream production. ADK TypeScript 2.0 supports graph-based workflows; the old `SequentialAgent` templates are deprecated in TypeScript.

## Next milestones

1. Confirm this project runs in ADK Web.
2. Verify Google Search and URL Context events.
3. Add typed evidence records and deterministic religious validation.
4. Add an ADK graph workflow with fail-closed branches.
5. Connect Veo, TTS, storage and renderer through real backend tools.
6. Connect YouTube OAuth; test with private uploads only.
7. Add Meta Graph API only after Instagram Professional account authorization.
8. Add Cloud Scheduler after an authenticated production endpoint exists.

Do not deploy publicly or enable publishing from this starter.
