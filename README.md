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
- `hidaya-one-dev` has no public invoker binding (checked with gcloud on 2026-11-17).
- All publishing requires explicit human approval — never automatic.

## Religious safety

The deterministic verification gate (`apps/agent/src/verification/gate.ts`) is
software — not an LLM instruction. It issues signed attestations, and the ADK
workflows in `apps/agent/src/workflow/` let the Script Agent and the five
production agents run only on attested evidence. 61 tests cover the gate and
the workflow boundary using mock models. It compares what two agents report
they retrieved; it does not yet fetch sources itself. See
`apps/agent/docs/SECURITY.md` for the limitations.

## Status by phase

| Phase | Status |
|---|---|
| Phase 0 — Audit & backup | ✅ Complete |
| Phase 1 — Agent testing | 🔶 Blocked (Gemini API key restricted — see docs/deployment.md) |
| Phase 2 — Verification gate | ✅ Enforced in the agent workflow — 61/61 tests pass (mock models; not yet run against live Gemini) |
| Phase 3 — Integration adapters | 🔶 In progress |
| Phase 4 — Persistence | ⬜ Not started |
| Phase 5 — Node.js API | ✅ Scaffolded |
| Phase 6 — Angular dashboard | ⬜ Not started |
| Phase 7 — Secure deployment | 🔶 In progress |
| Phase 8 — Testing | 🔶 Gate tests complete |
