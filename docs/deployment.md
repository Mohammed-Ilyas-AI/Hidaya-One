# HIDAYA ONE — Cloud Run Deployment & Secrets Guide

## 1. Services Topology in `asia-south1`

| Service Name | Description | Ingress | Auth Required |
|---|---|---|---|
| `hidaya-one-dev` | Developer ADK Explorer UI (`--with_ui`) | All | Currently `allUsers` (Action: remove via script) |
| `hidaya-one-agent-api` | Headless ADK API (Private agent runtime) | Internal / Cloud Run | Yes (Service Account ID Token) |
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
