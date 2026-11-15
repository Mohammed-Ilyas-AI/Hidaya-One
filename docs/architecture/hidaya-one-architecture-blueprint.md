# HIDAYA ONE
## High-Level System Architecture & Automation Blueprint

**Document Version:** 1.0
**Product:** Hidaya One
**Category:** Agentic AI Content Automation Platform
**Primary Market:** Tamil-speaking Islamic educational audience
**Primary Languages:** Tamil, Arabic and English
**Architecture:** Multi-Agent AI + Workflow Orchestration + Cloud-Native SaaS
**Development Approach:** Claude Code Pro + Google ADK TypeScript + Angular + Node.js

> This is the primary architecture reference for the repository. It describes the
> target system. For what exists in the repository today, see
> [Current implementation status](#current-implementation-status) at the end.

---

# 1. Executive Summary

Hidaya One is an AI-powered Islamic educational content automation platform designed to research, verify, create, produce, quality-check and publish short-form educational videos.

The platform transforms a content idea into a fully prepared Islamic educational video through a coordinated system of specialized AI agents, deterministic verification engines, media-generation services and human approval workflows.

The primary objective is to automate the complete production lifecycle of Islamic educational Shorts while maintaining strict religious accuracy, source traceability, copyright compliance and human oversight.

The platform initially targets:

- YouTube Shorts
- Instagram Reels
- Tamil Islamic educational content
- Arabic source references
- English supporting translations

The initial production objective is three high-quality Shorts per day, each approximately 30–45 seconds long.

Hidaya One is not simply an AI video generator. It is an end-to-end content intelligence and production operating system.

# 2. Product Vision

Build an autonomous content production platform that can:

1. Discover relevant Islamic educational topics.
2. Research Quran and Hadith references.
3. Independently verify religious evidence.
4. Generate Tamil-first educational scripts.
5. Create visual storyboards.
6. Generate images and video assets.
7. Produce narration and subtitles.
8. Assemble complete vertical videos.
9. Perform automated quality checks.
10. Request human approval.
11. Publish to authorized channels.
12. Collect analytics and improve future content decisions.

The system must be modular so that additional languages, channels, content formats and AI providers can be introduced without redesigning the platform.

# 3. Core Architectural Principles

The architecture must follow these principles:

### 3.1 Agent specialization

Each AI agent has a clearly defined responsibility. Avoid building one enormous agent that performs every operation.

### 3.2 Deterministic workflow control

Critical business rules must be implemented in software, not delegated entirely to LLM instructions.

### 3.3 Religious accuracy first

No content containing Quran or Hadith claims can proceed to production without passing independent verification.

### 3.4 Human-in-the-loop

Human approval is mandatory before public publishing.

### 3.5 Provider independence

Media generation, TTS, storage and publishing should use interchangeable provider adapters.

### 3.6 Event-driven automation

Long-running operations must be managed as jobs and workflow events rather than relying on one long-running browser request.

### 3.7 Persistent state

Research evidence, verification decisions, scripts, assets, approval history and publishing records must survive application restarts.

### 3.8 Security by design

Credentials, OAuth tokens and internal service identities must never be exposed to the browser or committed to source control.

# 4. High-Level System Architecture

The platform consists of seven major architectural layers.

1. Presentation Layer
2. Application API Layer
3. Agent Intelligence Layer
4. Workflow Orchestration Layer
5. Integration and Provider Layer
6. Data and Storage Layer
7. Infrastructure and Security Layer

## Architecture Overview

```text
User
  |
  v
Angular 22 Web Dashboard
  |
  v
Node.js Backend / API Gateway
  |
  +-------------------------------+
  |                               |
  v                               v
Authentication                Job Manager
  |                               |
  +---------------+---------------+
                  |
                  v
          Workflow Orchestrator
                  |
                  v
          Google ADK Agent System
                  |
    +-------------+-------------+
    |             |             |
    v             v             v
 Research     Verification    Creative
  Agents        Agents        Agents
    |             |             |
    +-------------+-------------+
                  |
                  v
       Deterministic Validation
                  |
                  v
         Content Production
                  |
    +-------------+-------------+
    |             |             |
    v             v             v
   Image        Video           TTS
 Generation   Generation     Generation
    |             |             |
    +-------------+-------------+
                  |
                  v
             Video Renderer
                  |
                  v
             Quality Control
                  |
                  v
           Human Approval
                  |
                  v
          Publishing Manager
                  |
          +-------+-------+
          |               |
          v               v
       YouTube         Instagram
                  |
                  v
              Analytics
```

All stages communicate through validated APIs, workflow state and persistent data records.

# 5. Application Architecture

Hidaya One will use a monorepository with independently configured applications.

Repository:

```text
hidaya-one/

apps/
  agent/
  api/
  web/

packages/
  contracts/
  shared/

infra/
  cloud-run/
  iam/
  secrets/
  scripts/

docs/
  architecture/
  agents/
  workflows/
  integrations/
  security/
  deployment/
```

## 5.1 Agent Application

Technology:
- Google ADK TypeScript 2.4.0 initially
- Node.js 24
- TypeScript
- Gemini
- Google Search
- URL Context

Responsibility:

Run the specialized AI agents and coordinate their reasoning and tool execution.

The agent application must remain independently deployable.

## 5.2 Backend Application

Technology:
- Node.js
- TypeScript
- Express 5 or Fastify
- Zod
- Google Cloud authentication libraries

Responsibility:

- Expose application APIs.
- Authenticate users.
- Coordinate workflow execution.
- Communicate with the private ADK service.
- Manage jobs and status.
- Validate requests and responses.
- Record audit events.
- Manage integrations.
- Provide data to the Angular frontend.

The backend acts as the secure boundary between the browser and internal AI services.

## 5.3 Frontend Application

Technology:
- Angular 22
- Standalone components
- Angular Signals
- RxJS
- Tailwind CSS 4
- TypeScript

Responsibility:

Provide a complete operational dashboard for monitoring and controlling the content production lifecycle.

The frontend must never directly access Gemini credentials, YouTube OAuth refresh tokens or private agent service credentials.

# 6. Multi-Agent Intelligence Architecture

Hidaya One contains 13 agent instances.

## 6.1 Main Orchestrator

Hidaya AI Orchestrator

Responsibilities:
- Understand the user's request.
- Select the correct workflow.
- Coordinate specialized agents.
- Pass validated structured data.
- Track execution status.
- Handle failures and retries.
- Produce a consolidated result.

The Orchestrator must not override deterministic verification decisions.

## 6.2 Research Agent

Responsibilities:
- Discover Islamic educational topics.
- Search reliable sources.
- Identify Quran and Hadith references.
- Retrieve Arabic source wording.
- Record source URLs.
- Prepare candidate evidence.

Output: Research Candidate Records.

The Research Agent must never independently mark its own research VERIFIED.

## 6.3 Verification Agent

Responsibilities:
- Independently verify candidate evidence.
- Validate references.
- Compare Arabic wording.
- Check source reliability.
- Preserve Hadith grading attribution.
- Identify conflicting variants.
- Produce structured verification results.

Output: Verification Records.

## 6.4 Tamil Script Agent

Responsibilities:
- Create natural Tamil narration.
- Maintain educational accuracy.
- Preserve exact Arabic quotations.
- Produce English supporting translations.
- Create engaging short-form scripts.
- Estimate narration duration.

Only accept content that has passed the deterministic verification gate.

## 6.5 Creative Producer Agent

Responsibilities:
- Design storyboards.
- Define scene transitions.
- Prepare visual prompts.
- Select suitable visual styles.
- Ensure generated visuals respect Islamic content restrictions.

Never depict Allah, Prophet Muhammad ﷺ or other prophets.

Never put generated Quran or Hadith Arabic quotations inside image-generation prompts.

## 6.6 Veo Video Generator Agent

Responsibilities:
- Prepare video-generation requests.
- Generate scene assets through connected video providers.
- Track generation jobs.
- Record generated asset references.

Must report NOT_CONNECTED when the actual provider is unavailable.

## 6.7 Video Editor Agent

Responsibilities:
- Coordinate narration, visuals, subtitles and transitions.
- Prepare video assembly instructions.
- Track rendering jobs.
- Produce final video metadata.

Must not claim a video exists until an actual renderer returns a completed asset.

## 6.8 Quality Control Agent

Responsibilities:
- Validate religious content.
- Check subtitle correctness.
- Check narration.
- Check video duration.
- Check aspect ratio.
- Check visual safety.
- Check copyright.
- Produce a structured QC report.

## 6.9 Channel Manager Agent

Responsibilities:
- Manage channel configuration.
- Prepare titles and descriptions.
- Manage publishing schedules.
- Coordinate uploads.
- Track publication results.
- Retrieve analytics.

Public publishing requires explicit human authorization.

## 6.10 Helper Agents

Four supporting helper agents provide research and verification capabilities using Google Search and URL Context.

They must return source-backed evidence to their parent agents rather than independently authorizing publication.

# 7. Religious Verification and Governance Engine

This is the most critical component of Hidaya One.

Religious accuracy must be enforced through deterministic software validation.

Verification statuses:

- VERIFIED
- NEEDS_HUMAN_REVIEW
- SOURCE_NOT_FOUND
- ARABIC_MISMATCH
- REFERENCE_MISMATCH
- AUTHENTICITY_UNCONFIRMED
- REJECTED

Required verification sequence:

```text
Research Candidate
    |
    v
Evidence Normalization
    |
    v
Independent Verification
    |
    v
Deterministic Validation Gate
    |
    +---- VERIFIED
    |       |
    |       v
    |   Script Generation
    |
    +---- NEEDS_HUMAN_REVIEW
    |       |
    |       v
    |   Human Review Queue
    |
    +---- REJECTED
            |
            v
        Stop Workflow
```

The gate must validate:

- Source reference.
- Source URL.
- Arabic wording.
- Quran chapter and verse numbers where applicable.
- Hadith collection and number where applicable.
- Authenticity grade and named scholar attribution.
- Verification notes.
- Independent verification record.

An LLM cannot set gatePassed=true by itself.

The gate must generate its own attestation after successful validation.

A mixed evidence batch containing even one invalid record must not proceed as a fully verified batch.

# 8. End-to-End Production Workflow

The standard production workflow is:

**STAGE 1 — TOPIC DISCOVERY**

Research topics and identify educational opportunities.

**STAGE 2 — RESEARCH**

Retrieve primary sources and supporting evidence.

**STAGE 3 — VERIFICATION**

Independently verify Quran and Hadith references.

**STAGE 4 — SCRIPT GENERATION**

Generate Tamil-first narration with Arabic source text and English support.

**STAGE 5 — CREATIVE PLANNING**

Create storyboards and scene instructions.

**STAGE 6 — ASSET GENERATION**

Generate images, video clips and other visual assets.

**STAGE 7 — AUDIO GENERATION**

Generate narration using an approved Tamil voice profile.

**STAGE 8 — VIDEO ASSEMBLY**

Combine assets, narration, subtitles and transitions.

**STAGE 9 — QUALITY CONTROL**

Run religious, audio, subtitle, visual and technical checks.

**STAGE 10 — HUMAN APPROVAL**

Present the completed video for approval.

**STAGE 11 — PUBLISHING**

Upload to authorized channels.

**STAGE 12 — ANALYTICS**

Collect performance data and update production insights.

Each stage must have its own execution status, input, output, timestamps, errors and audit records.

# 9. Provider Integration Architecture

Use provider adapters instead of hardcoding provider-specific calls into business logic.

Integration categories:

## AI Reasoning
- Google Gemini
- Google ADK

## Research
- Google Search
- URL Context
- Verified source retrieval

## Image Generation
- Nano Banana or supported Google image-generation APIs.

## Video Generation
- Google Veo, subject to API access, availability and quotas.

## Text-to-Speech
- Google Cloud Text-to-Speech.
- Approved Tamil voice profiles.

## Storage
- Google Cloud Storage.

## Database
- Firestore or another appropriate persistent database.

## Video Rendering
- Dedicated rendering worker/service.

## Publishing
- YouTube Data API.
- YouTube OAuth 2.0.
- Instagram Graph API.

Every integration must implement:

- Authentication.
- Configuration validation.
- Health checks.
- Timeout handling.
- Retry policies.
- Usage tracking.
- Cost tracking.
- Error reporting.
- Connection status.

Standard integration statuses:

- CONNECTED
- NOT_CONFIGURED
- DISABLED
- DEGRADED
- FAILED
- BLOCKED

A provider must not be marked CONNECTED until an actual operation has been successfully tested.

# 10. Data Architecture

Use persistent storage for operational data.

Recommended logical data entities:

- User
- Workspace
- Channel
- Topic
- ResearchRun
- EvidenceRecord
- VerificationRecord
- Script
- Storyboard
- MediaAsset
- GenerationJob
- RenderJob
- QCReport
- Approval
- PublishingJob
- PublishedVideo
- AnalyticsRecord
- Integration
- AuditLog

Firestore is a candidate for operational metadata.

Cloud Storage is a candidate for large assets:

- Images.
- Video clips.
- Narration audio.
- Subtitles.
- Rendered videos.
- Thumbnails.

Every production artifact must be linked to its originating topic and workflow.

Maintain version history for scripts and approval records.

Do not use Cloud Run local storage or in-memory sessions as permanent data storage.

# 11. Job and Workflow Management

Long-running AI operations must execute as tracked jobs.

Example job lifecycle:

- CREATED
- QUEUED
- RUNNING
- WAITING_FOR_APPROVAL
- COMPLETED
- FAILED
- CANCELLED
- RETRYING

Each job should contain:

- Job ID.
- Workflow ID.
- Topic ID.
- Current stage.
- Progress.
- Started time.
- Completed time.
- Error details.
- Input references.
- Output references.
- Retry count.

Implement idempotency to prevent duplicate video generation and duplicate publishing.

Use asynchronous job execution for video generation and rendering.

# 12. Angular Dashboard Architecture

The dashboard is the operational control center.

Required screens:

1. Dashboard Overview
2. Topic Research
3. Religious Verification
4. Tamil Script Studio
5. Creative Studio
6. Video Production
7. Quality Control
8. Publishing Center
9. Analytics
10. Settings and Integrations

The dashboard must display actual workflow states and backend data.

No fabricated statistics or hardcoded successful integrations.

Provide clear status indicators for:

- Research progress.
- Verification progress.
- Script approval.
- Media generation.
- Rendering.
- QC.
- Human approval.
- Publishing.

Users must be able to inspect evidence, review scripts, approve content and monitor production.

# 13. Security Architecture

Use Google Cloud identity and access management.

Required security practices:

- Private Cloud Run services.
- Dedicated runtime service accounts.
- Least-privilege IAM.
- Google-signed service-to-service ID tokens.
- Secret Manager.
- Secure OAuth refresh-token storage.
- No credentials in Git.
- No credentials in frontend bundles.
- No secrets in logs.
- Input validation.
- Request authorization.
- Audit logging.
- Rate limiting.

Public publishing must always require explicit owner authorization.

The ADK development interface must not be publicly accessible.

# 14. Deployment Architecture

Initial Google Cloud project:

`even-boulder-514217-d5`

Project number:

`440186659444`

Primary region:

`asia-south1`

Recommended services:

Cloud Run:
- hidaya-one-dev
- hidaya-one-agent-api
- hidaya-one-dashboard

Google Cloud Storage:
- Media assets.

Firestore:
- Operational records.

Secret Manager:
- API credentials and OAuth secrets.

Cloud Build:
- Automated deployment.

GitHub:
- Source control and version history.

Keep development, staging and production environments logically separated.

The current hidaya-one-dev deployment should remain available for debugging and rollback.

# 15. Automation Strategy

The platform should support scheduled daily production.

Target:
Three Shorts per day.

Suggested daily workflow:

Morning:
- Research three distinct topics.
- Verify source evidence.
- Prepare scripts.

Production:
- Generate approved visual assets.
- Generate narration.
- Assemble videos.
- Run QC.

Approval:
- Present finished videos to the owner.
- Collect approval or revision instructions.

Publishing:
- Upload only after explicit authorization.
- Record the publication ID and URL.

Analytics:
- Collect performance data.
- Track audience retention and engagement.
- Use insights to inform future topic selection.

Automation must pause when religious verification fails, required integrations are disconnected, or human approval is pending.

# 16. Cost and Resource Governance

The initial budget target is approximately ₹2,000 per month.

Prioritize Google-native services where they offer suitable functionality.

Before enabling a paid service, evaluate:

- API pricing.
- Free quotas.
- Regional availability.
- Generation costs.
- Storage costs.
- Network transfer.
- Cloud Run compute costs.
- Retry costs.

Implement usage monitoring and budget alerts.

Never run unlimited generation loops.

# 17. Non-Functional Requirements

The system must provide:

- Reliability.
- Security.
- Auditability.
- Scalability.
- Modularity.
- Maintainability.
- Observability.
- Cost control.
- Data persistence.
- Religious accountability.

Every major operation must be traceable.

Failures must be visible and recoverable.

# 18. Development Roadmap

**PHASE 1 — Agent Foundation**
Verify all existing ADK agents, tool calls, authentication and deterministic verification.

**PHASE 2 — Workflow Intelligence**
Implement explicit graph workflows and religious validation gates.

**PHASE 3 — Backend Foundation**
Complete API gateway, authentication, job manager and persistent data layer.

**PHASE 4 — Frontend Foundation**
Connect the Angular dashboard to actual backend contracts.

**PHASE 5 — Research and Script Automation**
Complete topic discovery, evidence retrieval, verification and script approval.

**PHASE 6 — Media Automation**
Integrate image generation, Veo, TTS and video rendering.

**PHASE 7 — Quality and Approval**
Complete QC, revision handling and human approvals.

**PHASE 8 — Publishing**
Integrate YouTube OAuth and Instagram authorization.

**PHASE 9 — Analytics**
Implement publication tracking and performance intelligence.

**PHASE 10 — Production Hardening**
Security review, reliability tests, backup, monitoring and cost optimization.

# 19. Definition of Done

Hidaya One is not considered complete because the frontend loads or the agents return conversational responses.

The platform is operational only when:

1. All 13 agents are preserved and their actual execution is verified.
2. Research uses real source retrieval.
3. Independent religious verification works.
4. Invalid evidence is blocked by deterministic code.
5. Tamil scripts are generated only from approved evidence.
6. Media generation uses real connected providers.
7. Video rendering produces real files.
8. QC results are recorded.
9. Human approval is enforced.
10. YouTube OAuth works for authorized uploads.
11. Persistent workflow records survive service restarts.
12. The Angular dashboard communicates with the actual backend.
13. Security and deployment checks pass.
14. All external actions report truthful outcomes.

# 20. Instructions for Claude Code

Act as the Principal Engineer responsible for implementing this architecture.

Before modifying code:

1. Inspect the entire existing repository.
2. Read all existing agent instructions.
3. Read the architecture and integration documentation.
4. Understand existing Cloud Run services.
5. Preserve all working implementations.
6. Identify gaps between the target architecture and current implementation.

Implement in small, independently testable milestones.

Maintain:

- CLAUDE.md
- ARCHITECTURE.md
- IMPLEMENTATION_PLAN.md
- SECURITY.md
- INTEGRATIONS.md
- TESTING.md
- CHANGELOG.md

Use CLAUDE.md as the project-specific operating guide for Claude Code.

Use the architecture document as the source of truth for system design.

Do not rewrite the entire application in one operation.

Do not mark an integration complete without a successful real test.

Do not deploy untested changes over the stable service.

Do not publish videos publicly without explicit owner approval.

For every milestone, report:

- Changes made.
- Files created or modified.
- Commands executed.
- Tests passed and failed.
- Integrations connected and disconnected.
- Remaining blockers.
- Security implications.
- Estimated operating costs.
- Recommended next milestone.

The goal is to build a maintainable, secure, reliable and genuinely operational AI-powered Islamic content production platform.

---

# Current implementation status

Recorded against the repository at the time this document was added. This
section is not part of the owner's blueprint; update it as the code changes.

| Blueprint area | Status in this repository |
| --- | --- |
| 13 ADK agent instances (§6) | Present in a single root-level `agent.ts` as `LlmAgent`s with sub-agent delegation |
| Monorepo layout `apps/`, `packages/`, `infra/` (§5) | Not present; the repository is a flat single-package ADK starter |
| Deterministic validation gate and attestation (§7) | Implemented and unit-tested in `verification/`; not yet wired into the agent flow, which still relies on LLM instructions |
| Graph workflow with fail-closed branches (§3.2, §8) | Not present |
| Backend API, job manager, persistence (§5.2, §10, §11) | Not present in this repository |
| Angular dashboard (§5.3, §12) | Not present in this repository |
| Veo, TTS, storage, renderer, YouTube, Instagram (§9) | Not connected; agents return `NOT_CONNECTED` statuses |
| Region (§14) | `.env.example` suggests `us-central1`; the blueprint specifies `asia-south1` |
