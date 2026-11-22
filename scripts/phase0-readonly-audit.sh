#!/usr/bin/env bash
# HIDAYAH Phase 0 — READ-ONLY Google Cloud audit.
# Run in Google Cloud Shell as the project owner:
#   bash scripts/phase0-readonly-audit.sh <PROJECT_ID> > audit.txt
# Makes NO changes: only list/describe/get commands. Prints no secret values,
# no tokens, and masks billing account IDs. Review audit.txt before sharing.
set -uo pipefail
P="${1:?usage: $0 PROJECT_ID}"
R="asia-south1"
mask() { sed -E 's/[0-9A-F]{6}-[0-9A-F]{6}-[0-9A-F]{6}/XXXXXX-XXXXXX-XXXXXX/g'; }
h() { printf '\n===== %s =====\n' "$1"; }

h "Active account (domain only)"; gcloud config get-value account 2>/dev/null | sed -E 's/^[^@]+@/***@/'
h "Project"; gcloud projects describe "$P" --format='value(projectId,lifecycleState)'
h "Billing enabled"; gcloud billing projects describe "$P" --format='value(billingEnabled)' 2>&1 | mask
h "Enabled APIs"; gcloud services list --enabled --project "$P" --format='value(config.name)' | sort
h "Budgets (names/amounts only)"
BA=$(gcloud billing projects describe "$P" --format='value(billingAccountName)' 2>/dev/null | sed 's#billingAccounts/##')
[ -n "$BA" ] && gcloud billing budgets list --billing-account="$BA" \
  --format='table(displayName,amount.specifiedAmount.units,amount.specifiedAmount.currencyCode)' 2>&1 | mask
h "Cloud Run services + service accounts + ingress"
gcloud run services list --project "$P" --region "$R" \
  --format='table(metadata.name,spec.template.spec.serviceAccountName,metadata.annotations."run.googleapis.com/ingress")'
for s in $(gcloud run services list --project "$P" --region "$R" --format='value(metadata.name)'); do
  h "Invokers for $s"; gcloud run services get-iam-policy "$s" --project "$P" --region "$R" --format='table(bindings.role,bindings.members)'
done
h "Service accounts"; gcloud iam service-accounts list --project "$P" --format='table(email,disabled)'
h "Project IAM roles (members masked to type + domain)"
gcloud projects get-iam-policy "$P" --flatten='bindings[].members' --format='value(bindings.role,bindings.members)' \
  | sed -E 's/(user:|serviceAccount:|group:)[^@]+@/\1***@/'
h "Secret names (no values)"; gcloud secrets list --project "$P" --format='value(name)'
h "Firestore databases"; gcloud firestore databases list --project "$P" --format='value(name,locationId,type)' 2>&1
h "Buckets"; gcloud storage buckets list --project "$P" --format='value(name,location)' 2>&1
h "Scheduler jobs"; gcloud scheduler jobs list --project "$P" --location "$R" 2>&1
h "Workflows"; gcloud workflows list --project "$P" --location "$R" 2>&1
h "Agent Platform quotas mentioning omni/veo/gemini (if command available)"
gcloud alpha services quota list --service=aiplatform.googleapis.com --consumer="projects/$P" \
  --format='value(metric,consumerQuotaLimits[0].quotaBuckets[0].effectiveLimit)' 2>&1 | grep -iE 'omni|veo|gemini|generate' | head -40
echo; echo "Manual checks: Billing > Credits (AI Pro credit?), Model Garden > Gemini Omni 1.2 Flash, OAuth consent screen status, YouTube channel ID."
