# Security

Target practices are in blueprint §13. This file records the current state.

## In place

- `.env` is git-ignored; `.env.example` contains no values or credentials.
- No credentials, tokens or keys are committed.
- **Gate signing key.** `HIDAYA_GATE_ATTESTATION_KEY`, read from the
  environment only, minimum 32 characters. If it is missing or short, the gate
  signs nothing and the Script Agent accepts nothing; a single warning that
  does not contain the key is printed.
- The key never appears in logs, events, session state, tool results or audit
  entries. Tests assert this for the audit trail and the Script Agent's input.
- Signatures are removed from what the Orchestrator's model is shown.
- Agent output is schema-validated with unknown fields rejected, so
  `gatePassed`, `verified` and similar fields cannot authorize anything.
- The Script Agent's entry guard runs before every model call that agent
  makes. Tested routes: the workflow, a direct run, an agent tool and a
  transfer from another agent.
- The trusted-source list can only change through a reviewed code change.
- A pipeline run is limited to 5 evidence records and 40 model calls.

## Limitations

- The attestation is a symmetric HMAC. Any process holding the key can mint
  attestations. There is no key ID, rotation procedure or expiry.
- In Cloud Run the key must come from Secret Manager. That wiring does not
  exist yet; nothing has been deployed in this milestone.
- The gate trusts what the agents report they retrieved; see
  `ARCHITECTURE.md`, "Trust boundary and limitations".
- Audit entries go to stdout and in-memory session state. They are not durable
  or tamper-evident.
- No backend, so no user authentication, request authorization or rate limiting.
- Cloud Run services, service accounts and IAM are not in source control and
  were not reviewed or changed.
- `npm install` reports dependency advisories that have not been triaged.
- The ADK `Workflow` class is marked experimental by ADK 2.4.0.

## Rules

- Secrets live in Secret Manager; never in Git, logs or a frontend bundle.
- Internal services are private Cloud Run, called with Google-signed ID tokens.
- The ADK development UI is never publicly reachable.
- Public publishing always needs explicit owner authorization.
- Never request or store passwords or OTPs.
- Never weaken a gate check to make a test pass.
