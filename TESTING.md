# Testing

```bash
npm run typecheck   # tsc --noEmit
npm test            # node --test, runs TypeScript directly (Node 22.18+ / 24)
```

## Covered

`verification/gate.test.ts` — the deterministic gate: pass path, attestation
binding and tampering, injected `gatePassed`, each non-`VERIFIED` status,
Arabic mismatch and diacritics, reference mismatch, grading attribution,
source URL rules, self-verification, missing key, malformed input, mixed batch.

## Not covered

- The 13 agents. They need live Gemini credentials; no automated or manual
  run has been recorded from this repository.
- Any integration (none exist).

## Fixture rule

Test data must be synthetic and obviously so. Never put real or
realistic-looking Quran or Hadith text, references, gradings or source URLs in
fixtures; a wrong one would be fabricated religious content.
