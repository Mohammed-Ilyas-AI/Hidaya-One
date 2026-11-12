# HIDAYA ONE — Architecture Overview

## 1. System Topology

Hidaya One is structured as an end-to-end, production-grade automated Islamic educational video production platform. It utilizes a monorepo architecture with distinct responsibility boundaries:

```
[ Human User / Reviewer ]
          │ (HTTPS / IAP)
          ▼
┌─────────────────────────────────────────────────────────────┐
│  Service 3: hidaya-one-dashboard (Frontend & BFF)           │
│  - Angular 22 Standalone UI (Emerald, Teal, Holographic Gold)│
│  - Node.js BFF (Express 5 + Zod Validation)                 │
└──────────────────────────────┬──────────────────────────────┘
                               │ (Internal mTLS / Google ID Token)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Service 2: hidaya-one-agent-api (Private ADK Agent Core)   │
│  - 13 Specialized ADK Agents                                │
│  - Deterministic Religious Verification Gate                │
│  - Google Search & URL Context Retrieval                    │
└──────────────────────────────┬──────────────────────────────┘
                               │
             ┌─────────────────┴─────────────────┐
             ▼                                   ▼
┌───────────────────────────┐       ┌───────────────────────────┐
│ Google Cloud Services     │       │ External Publishing APIS  │
│ - Secret Manager          │       │ - YouTube Data API v3     │
│ - Cloud Storage (GCS)     │       │ - Meta Graph API (Reels)  │
│ - Cloud Run (asia-south1) │       │ (Owner Approval Gated)    │
│ - Gemini 3.8 Flash        │       └───────────────────────────┘
└───────────────────────────┘
```

## 2. Component Roles

1. **`apps/agent/`**: 
   The core intelligence engine running on Google ADK (Agent Development Kit) TypeScript 2.4.0. Houses the 13 specialist agents:
   - Root Orchestrator (`hidaya_ai_orchestrator`)
   - 8 specialist agents (Research, Verification, Script, Creative, Veo, Editor, QC, Channel Manager)
   - 4 research & verification helper agents (Google Search & URL Context)
   - Deterministic verification software gate (`src/verification/gate.ts`)

2. **`apps/api/`**: 
   Backend-for-Frontend (BFF) built on Express 5, TypeScript, and Zod. Acts as the protective boundary between the web UI and agent/cloud services. Ensures:
   - Zero API keys or tokens are ever exposed to the client browser.
   - Authorized service-to-service communication via Google Auth ID tokens.
   - Typed request/response validation adhering strictly to OpenAPI 3.1.

3. **`apps/web/`**: 
   Dashboard interface built with Angular 22, Signals, and Tailwind CSS. Provides production observability, review workflows, real-time integration status, and mandatory human-in-the-loop approval toggles.

4. **`packages/contracts/`**: 
   Single source of truth for API schemas and data interchange (`openapi.yaml`).
