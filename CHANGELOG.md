# Changelog

## Unreleased

### Added
- Deterministic religious validation gate with signed attestations and typed
  evidence contracts (`verification/`), with unit tests.
- `npm test` and `npm run typecheck`; `zod` declared as a direct dependency.
- Architecture blueprint (sections 1–20) and `CLAUDE.md`.
- `ARCHITECTURE.md`, `IMPLEMENTATION_PLAN.md`, `SECURITY.md`,
  `INTEGRATIONS.md`, `TESTING.md`, `CHANGELOG.md`.
- `HIDAYA_GATE_ATTESTATION_KEY` placeholder in `.env.example`.

### Not changed
- `agent.ts`. The gate is not yet called by the agent flow.

## 0.1.0

- Initial ADK TypeScript starter with 13 agents.
