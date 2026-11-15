# Architecture

The source of truth for system design is
[`docs/architecture/hidaya-one-architecture-blueprint.md`](docs/architecture/hidaya-one-architecture-blueprint.md).
Its last section tracks what is implemented. This file records only how the
code that exists today is put together.

## What exists

```text
agent.ts                 13 ADK LlmAgents; rootAgent delegates to 8 specialists
verification/
  contracts.ts           Zod schemas: EvidenceCandidate, VerificationRecord
  gate.ts                Deterministic validation gate + signed attestation
  gate.test.ts           Unit tests
```

## Religious validation gate

`evaluateEvidence(candidate, verificationRecord, config)` returns one of:

| Outcome | Meaning | Next step |
| --- | --- | --- |
| `PASSED` | All checks passed; a signed attestation is attached | Script generation |
| `HUMAN_REVIEW` | Not provably wrong, not provably right | Human review queue |
| `BLOCKED` | Invalid, mismatched or unverified | Stop workflow |

Checks, all in code:

- Both records match strict schemas; unknown fields (for example `gatePassed`)
  are rejected.
- The Verification Agent's status is `VERIFIED`. Any other status is kept as is
  and never upgraded.
- The verifier is not the researcher, and the record is for the same evidence ID.
- Researched and verified references are identical (surah/ayah range, or
  collection/number).
- Both source URLs are valid `https`; a host outside the trusted list goes to
  human review.
- Arabic wording matches after Unicode normalisation, ignoring whitespace and
  tatweel. A difference in diacritics only goes to human review; any other
  difference is blocked.
- Hadith needs at least one verified grading with a named scholar, and every
  researched grading must be confirmed. Several gradings are kept separately.

The attestation is an HMAC-SHA256 over the gate version, evidence ID, issue
time and a SHA-256 digest of the exact candidate and verification record.
Downstream stages call `verifyAttestation` with the same records; any change
to the evidence invalidates it. With no key configured, nothing passes.
`evaluateBatch` reports `fullyVerified` only when every record passed.

## Known gap

The gate is a library. Nothing in `agent.ts` calls it yet, so the running
agent system is still governed by LLM instructions. Wiring it in as a
graph-workflow node is the next milestone (see `IMPLEMENTATION_PLAN.md`).
