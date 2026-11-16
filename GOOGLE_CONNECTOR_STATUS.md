# Google connector status

Checked: 2026-11-16. Connector name: `My Google`.

## Summary

The connector is installed, connected and working. It exposes **Cloud Run
only**: two tools that read and three that deploy. Only the two read tools
were used. Nothing was created, changed or deployed.

It cannot show enabled APIs, IAM, service accounts, secrets, storage,
Firestore, Cloud Build or billing. Those remain unverified.

## Connector

| Item | Result |
| --- | --- |
| Availability | Installed for the account, connected, enabled in this session |
| Authentication | Working: read calls against the project succeeded |
| Google account identity | Not exposed by the connector. The Cloud Run service records a personal Gmail account as its creator and last modifier (address not written in this file) |
| Google Cloud services covered | Cloud Run services only |
| Other Google connector present | `Google Drive`, a separate connector. Not used and not confused with this one |

### Tools

| Tool | Kind | Used |
| --- | --- | --- |
| `list_services` | Read: lists Cloud Run services in a project and region | Yes |
| `get_service` | Read: describes one Cloud Run service | Yes |
| `deploy_service_from_image` | **Write**: deploys a container image as a service | No |
| `deploy_service_from_file_contents` | **Write**: deploys source files as a service | No |
| `deploy_service_from_archive` | **Write**: deploys a source archive as a service | No |

The three deploy tools can create or replace a service and can make it public
(`invokerIamDisabled`). They were not called and must not be without the
owner's explicit approval.

### Calls made

| Call | Result |
| --- | --- |
| `list_services`, `asia-south1` | One service: `hidaya-one-dev` |
| `list_services`, `us-central1` | None |
| `list_services`, `asia-southeast1` | None |
| `list_services`, `europe-west1` | None |
| `get_service`, `hidaya-one-dev`, `asia-south1` | Succeeded |
| `get_service`, `hidaya-one-agent-api`, `asia-south1` | Failed: "Resource 'hidaya-one-agent-api' of kind 'SERVICE' in region 'asia-south1' in project 'even-boulder-514217-d5' does not exist." |

No call was refused for permissions.

## Project inventory

Statuses: `VERIFIED`, `NOT_CONFIGURED`, `NOT_ACCESSIBLE` (the connector has no
tool for it), `UNKNOWN`, `FAILED`. "Inferred" means it follows from something
verified but was not itself observed.

| # | Item | Status | Finding |
| --- | --- | --- | --- |
| 1 | Project metadata | NOT_ACCESSIBLE | The project accepts Cloud Run reads under the ID `even-boulder-514217-d5`; the service URL contains project number `440186659444`. Name, state and labels were not readable |
| 2 | Enabled APIs | NOT_ACCESSIBLE | Inferred enabled: Cloud Run, Artifact Registry, Secret Manager. The full list is unknown |
| 3 | Cloud Run services | VERIFIED | Exactly one in `asia-south1`: `hidaya-one-dev`. None in the three other regions checked |
| 4 | Hidaya One development service | VERIFIED | Details below |
| 5 | Cloud Run revisions | NOT_ACCESSIBLE | Only the current template is shown |
| 6 | Runtime service account | UNKNOWN | Not included in the tool's response |
| 7 | IAM permissions | NOT_ACCESSIBLE | Including who may invoke the service |
| 8 | Secret Manager metadata | VERIFIED (one secret, by reference) | The service reads a secret named `gemini-api-key`, version `latest`. No value was seen. Other secrets are unknown |
| 9 | Cloud Storage buckets | NOT_ACCESSIBLE | — |
| 10 | Firestore | NOT_ACCESSIBLE | — |
| 11 | Cloud Build configuration | NOT_ACCESSIBLE | Inferred used: the image is in the `cloud-run-source-deploy` repository, which Cloud Run source deployments create |
| 12 | Billing status and credits | NOT_ACCESSIBLE | Inferred enabled, since a deployed service and an Artifact Registry image exist. Credits unknown |
| — | `hidaya-one-agent-api` | NOT_CONFIGURED | Does not exist |
| — | `hidaya-one-dashboard` | NOT_CONFIGURED | Not in the `asia-south1` service list |

## The `hidaya-one-dev` service

| Field | Value |
| --- | --- |
| Region | `asia-south1` |
| State | Ready (`CONDITION_SUCCEEDED`) |
| Created | 2026-11-12 16:44 UTC |
| Last updated | 2026-11-12 19:03 UTC |
| URL | `https://hidaya-one-dev-440186659444.asia-south1.run.app` |
| Image | In Artifact Registry, `asia-south1`, repository `cloud-run-source-deploy` |
| Container port | 8000 |
| Environment | `GOOGLE_GENAI_API_KEY` from secret `gemini-api-key`; `HIDAYA_MODEL=gemini-3.8-flash`; `HIDAYA_MODE=DEVELOPMENT` |

What this tells us:

1. **The service runs older code.** It was last updated on 12 November, before
   the verification gate and both workflows were written. The deployed agents
   are still governed by LLM instructions only.
2. **It uses the Gemini Developer API with an API key**, not Vertex AI. So the
   region setting plays no part in its model calls, and a free tier may apply
   to the key's project.
3. **It has no gate signing key.** `HIDAYA_GATE_ATTESTATION_KEY` is not set.
   If the current code were deployed as it is, the gate would block all
   evidence. A signing secret has to exist first.
4. **Port 8000 is the ADK development server's default port**, which suggests
   the ADK dev UI or API server is what is running. Whether the URL is open to
   the public could not be determined: the connector does not show invoker
   permissions, and this session's network policy blocks the URL. The
   blueprint requires that the ADK development interface is not public.

## What is needed to see more

No further permission is needed on this connector; it has no tools for the
rest. The read-only Cloud Shell script in `ACCOUNT_CONNECTION_CHECKLIST.md`
(Part A) covers items 1, 2, 5, 6, 7, 8, 9, 10 and 12, including whether
`hidaya-one-dev` allows unauthenticated access.
