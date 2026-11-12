#!/usr/bin/env bash
# infra/scripts/inject-secrets.sh
# Injects the Gemini API key into Cloud Run from Secret Manager.
# Run from Cloud Shell after creating the secret:
#   gcloud secrets create gemini-api-key --data-file=- <<< "YOUR_KEY"
#
# Usage: ./infra/scripts/inject-secrets.sh [SERVICE_NAME]
set -euo pipefail

PROJECT_ID="even-boulder-514217-d5"
REGION="asia-south1"
SA="440186659444-compute@developer.gserviceaccount.com"
SERVICE_NAME="${1:-hidaya-one-dev}"

echo "Granting secret accessor to: $SA"
gcloud secrets add-iam-policy-binding gemini-api-key \
  --project="$PROJECT_ID" \
  --member="serviceAccount:$SA" \
  --role="roles/secretmanager.secretAccessor"

echo "Mounting secret as GOOGLE_GENAI_API_KEY on service: $SERVICE_NAME"
gcloud run services update "$SERVICE_NAME" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --set-secrets="GOOGLE_GENAI_API_KEY=gemini-api-key:latest" \
  --set-env-vars="HIDAYA_MODEL=gemini-3.8-flash,HIDAYA_MODE=DEVELOPMENT,NODE_ENV=production"

echo "Done. Verify with:"
echo "  gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(spec.template.spec.containers[0].env)'"

