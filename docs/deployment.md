# HIDAYA ONE — Cloud Run Deployment & Secrets Guide

## 1. Services Topology in `asia-south1`

| Service Name | Description | Ingress | Auth Required |
|---|---|---|---|
| `hidaya-one-dev` | Developer ADK Explorer UI (`--with_ui`), pre-gate code | All | Yes (no public invoker; checked 2026-11-17) |
| `hidaya-one-agent-api` | Headless ADK API running the gated code (deployed 2026-11-17) | All | Yes (no public invoker; identity token required) |
| `hidaya-one-dashboard` | Angular 22 Dashboard + Node.js BFF | All / IAP | Yes (Google Workspace / IAP User) |

## 2. Resolving Cloud Run Secret Injection

Cloud Run services in project `even-boulder-514217-d5` run under service account:
`440186659444-compute@developer.gserviceaccount.com`

### Step 1: Create secret in Google Secret Manager
Run in Cloud Shell:
```bash
echo -n "YOUR_UNRESTRICTED_GEMINI_KEY" | gcloud secrets create gemini-api-key \
  --project=even-boulder-514217-d5 \
  --data-file=-
```

### Step 2: Grant Secret Accessor role to the Cloud Run Service Account
```bash
gcloud secrets add-iam-policy-binding gemini-api-key \
  --project=even-boulder-514217-d5 \
  --member="serviceAccount:440186659444-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Step 3: Mount secret to Cloud Run service
Run the provided helper script:
```bash
./infra/scripts/inject-secrets.sh hidaya-one-dev
```
Or directly:
```bash
gcloud run services update hidaya-one-dev \
  --region=asia-south1 \
  --project=even-boulder-514217-d5 \
  --set-secrets="GOOGLE_GENAI_API_KEY=gemini-api-key:latest" \
  --set-env-vars="HIDAYA_MODEL=gemini-3.8-flash,HIDAYA_MODE=DEVELOPMENT"
```

## 2a. Deploying `hidaya-one-agent-api`

Both services call Gemini through Vertex AI at location `global` using the
runtime service account; `hidaya-one-agent-api` does not use `gemini-api-key`.

From `apps/agent` (pass option values with `=`; on Windows the ADK tool
mis-parses space-separated values and any extra flag containing `=` or `,`):
```bash
npx adk deploy cloud_run agent.ts --project=even-boulder-514217-d5 \n  --region=asia-south1 --service_name=hidaya-one-agent-api --app_name=agent \n  --adk_version=2.4.0 --no-allow-unauthenticated
```
Then apply settings and the gate signing secret:
```bash
gcloud run services update hidaya-one-agent-api \n  --region=asia-south1 --project=even-boulder-514217-d5 \n  --timeout=900 --max-instances=3 --memory=512Mi \n  --update-env-vars=GOOGLE_GENAI_USE_ENTERPRISE=true,GOOGLE_CLOUD_PROJECT=even-boulder-514217-d5,GOOGLE_CLOUD_LOCATION=global,HIDAYA_MODEL=gemini-3.8-flash,HIDAYA_MODE=DEVELOPMENT \n  --update-secrets=HIDAYA_GATE_ATTESTATION_KEY=hidaya-gate-attestation-key:latest
```
The secret `hidaya-gate-attestation-key` holds a random 64-character value;
the runtime service account has Secret Accessor on it. Without it the gate
passes nothing.

## 3. Removing Public Exposure (`allUsers`)
During initial deployment, unauthenticated invocation was enabled. Run:
```bash
./infra/scripts/remove-public-access.sh
```
After execution, access the developer UI via:
```bash
gcloud run services proxy hidaya-one-dev --region asia-south1 --project even-boulder-514217-d5
```
And use Cloud Shell Web Preview on port 8080.

