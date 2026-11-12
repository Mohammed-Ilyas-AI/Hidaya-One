# HIDAYA ONE — Monorepo

> Islamic educational Shorts automation platform.
> Built on Google ADK TypeScript, Node.js, Angular 22, Cloud Run.

## Repository structure

```
hidaya-one/
├── apps/
│   ├── agent/     ← ADK TypeScript agents (deployed to hidaya-one-dev)
│   ├── api/       ← Node.js BFF API (Express 5 + Zod)
│   └── web/       ← Angular 22 dashboard
├── packages/
│   └── contracts/ ← OpenAPI spec + Zod schemas (shared types)
├── infra/
│   └── scripts/   ← Cloud Run, IAM, Secret Manager scripts
└── docs/
```

## Key facts

| Item | Value |
|---|---|
| GCP project | `even-boulder-514217-d5` |
| Project number | `440186659444` |
| Region | `asia-south1` |
| Dev service URL | `https://hidaya-one-dev-440186659444.asia-south1.run.app` |
| Stable tag | `v0.1.0-stable-pre-monorepo` |
| Feature branch | `feature/hidaya-one-monorepo-dashboard` |

## Quick start (agent)

```bash
cd apps/agent
cp .env.example .env     # fill in GOOGLE_GENAI_API_KEY
npm install
npm run adk:web          # opens ADK dev UI on localhost:8000
```

## Security

- `.env` is in `.gitignore` — never committed.
- Secrets in Cloud Run via Secret Manager (see `infra/scripts/inject-secrets.sh`).
- `hidaya-one-dev` currently has `allUsers` invoker — remove with `infra/scripts/remove-public-access.sh`.
- All publishing requires explicit human approval — never automatic.

## Religious safety

The deterministic verification gate (`apps/agent/src/verification/gate.ts`) is a
software function — not an LLM instruction — that validates all evidence before
any scriptwriting begins. 23 unit tests cover all bypass scenarios.

## Status by phase

| Phase | Status |
|---|---|
| Phase 0 — Audit & backup | ✅ Complete |
| Phase 1 — Agent testing | 🔶 Blocked (Gemini API key restricted — see docs/deployment.md) |
| Phase 2 — Verification gate | ✅ Complete — 23/23 tests pass |
| Phase 3 — Integration adapters | 🔶 In progress |
| Phase 4 — Persistence | ⬜ Not started |
| Phase 5 — Node.js API | ✅ Scaffolded |
| Phase 6 — Angular dashboard | ⬜ Not started |
| Phase 7 — Secure deployment | 🔶 In progress |
| Phase 8 — Testing | 🔶 Gate tests complete |
