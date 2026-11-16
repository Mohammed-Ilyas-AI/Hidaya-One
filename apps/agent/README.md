# HIDAYA ONE — Agent Core (Google ADK TypeScript)

Core intelligence runtime: 13 agents, the deterministic religious verification gate with signed attestations (`src/verification/`), and the two ADK workflows that enforce it (`src/workflow/`). Agent documents are in `docs/`.

## Commands
```bash
npm install
npm test          # Type-check, then all 61 gate and workflow tests (mock models, no paid calls)
npm run test:unit # Tests only
npm run typecheck # Verifies TypeScript compilation
npm run adk:run   # Executes agent interactive session
npm run adk:web   # Launches ADK web development UI
```

