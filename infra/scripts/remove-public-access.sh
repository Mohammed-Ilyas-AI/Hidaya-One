#!/usr/bin/env bash
# infra/scripts/remove-public-access.sh
# Removes allUsers invoker from hidaya-one-dev (discovered in Phase 0 audit).
# This makes the dev UI accessible only via authenticated gcloud proxy.
set -euo pipefail

PROJECT_ID="even-boulder-514217-d5"
REGION="asia-south1"
SERVICE="hidaya-one-dev"

echo "CURRENT IAM policy on $SERVICE:"
gcloud run services get-iam-policy "$SERVICE" \
  --region="$REGION" --project="$PROJECT_ID"

echo ""
echo "Removing allUsers roles/run.invoker..."
gcloud run services remove-iam-policy-binding "$SERVICE" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --member="allUsers" \
  --role="roles/run.invoker"

echo "Done. The dev UI is now accessible only via:"
echo "  gcloud run services proxy $SERVICE --region=$REGION --project=$PROJECT_ID"

