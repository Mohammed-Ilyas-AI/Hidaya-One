# Security

Target practices are in blueprint §13. This file records the current state.

## In place

- `.env` is git-ignored; `.env.example` contains no values.
- No credentials, tokens or keys are committed.
- Gate attestations are HMAC-signed. The key (`HIDAYA_GATE_ATTESTATION_KEY`)
  must be at least 32 characters; without it the gate passes nothing.
- Gate inputs are schema-validated and unknown fields rejected.

## Not in place yet

- Nothing reads `HIDAYA_GATE_ATTESTATION_KEY` yet; the gate receives its key as
  a parameter. When wired in, the key must come from Secret Manager.
- No backend, so no user authentication, request authorization, rate limiting
  or audit log.
- Cloud Run services, service accounts and IAM have not been reviewed from
  this repository; their configuration is not in source control.
- `npm install` reports dependency advisories that have not been triaged.

## Rules

- Secrets live in Secret Manager; never in Git, logs or a frontend bundle.
- Internal services are private Cloud Run, called with Google-signed ID tokens.
- The ADK development UI is never publicly reachable.
- Public publishing always needs explicit owner authorization.
- Never request or store passwords or OTPs.
