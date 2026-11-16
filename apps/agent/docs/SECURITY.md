# Security

Target practices are in blueprint §13. This file records the current state.

## In place

- `.env` is git-ignored; `apps/agent/.env.example` contains no values or credentials.
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
- **Attestation at every agent boundary.** The Script Agent and all five
  production agents re-verify the gate attestations before their model is
  called; the production agents also verify a script attestation, so an
  altered script blocks them.
- **No agent can approve or publish.** The approval and publish functions are
  not tools. The Orchestrator has no sub-agents and only two workflow tools.
- **Publishing conditions are checked in code:** owner approval by a named
  person, QC pass, a real (not simulated) rendered video, a connected
  publisher, and at most once per script.
- Video generation prompts containing Arabic script fail the job before any
  provider is called.
- The `My Google` connector was used for two read tools only. Its three deploy
  tools were not called.

## Limitations

- The attestation is a symmetric HMAC. Any process holding the key can mint
  attestations. There is no key ID, rotation procedure or expiry.
- In Cloud Run the key must come from Secret Manager. That wiring does not
  exist yet; nothing has been deployed in this milestone.
- **The deployed `hidaya-one-dev` service predates all of this.** It runs the
  original starter, where verification is an LLM instruction, and it has no
  gate signing key. Whether it is publicly reachable is unknown; port 8000
  suggests the ADK development server, which must not be public.
- The `My Google` connector can deploy, and can make a service public. Any use
  of its deploy tools needs the owner's explicit approval.
- An OAuth client secret for this project was pasted into a chat on
  2026-11-16. It should be reset in the Cloud Console.
- Depiction rules (no depiction of Allah, the Prophet ﷺ or other prophets) are
  enforced by instructions, the QC Agent and the owner's review, not by code.
- Jobs and approvals are held in memory; a restart loses a pending approval.
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
