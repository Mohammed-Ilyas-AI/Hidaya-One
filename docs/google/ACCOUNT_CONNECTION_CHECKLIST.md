# Account connection checklist

Steps only the owner can perform. Audit date: 2026-11-16.

## Ground rules

- **Never paste an API key, token, password, OTP, service-account key file or
  secret value into Claude Code, ChatGPT or any chat.**
- The outputs requested below contain names, counts and true/false values
  only. They are safe to share.
- Nothing in Part A changes anything. Parts B to D are look-ups in Google's
  own pages. Part E lists decisions that are **not** to be acted on until the
  owner approves them.

## Part A — Read-only project audit (the next action)

This answers every open question in section 1A of `GOOGLE_ECOSYSTEM_AUDIT.md`.

1. Open <https://console.cloud.google.com> signed in with the Google account
   that owns project `even-boulder-514217-d5`.
2. Click the Cloud Shell icon (top right, `>_`).
3. Paste the block below and press Enter. Every command only reads.
4. Copy the output and share it. Before sharing, glance over it: it should
   contain no long random strings. If something looks like a key, remove it.

```bash
P=even-boulder-514217-d5
echo "== 1 account ==";      gcloud config get-value account
echo "== 2 project ==";      gcloud projects describe $P --format="value(projectId,projectNumber,lifecycleState)"
echo "== 3 billing on? ==";  gcloud billing projects describe $P --format="value(billingEnabled)"
echo "== 4 enabled APIs =="; gcloud services list --enabled --project $P --format="value(config.name)"
echo "== 5 Cloud Run ==";    gcloud run services list --project $P \
  --format="table(metadata.name,region,spec.template.spec.serviceAccountName,spec.template.metadata.annotations.'autoscaling.knative.dev/minScale',status.url)"
echo "== 6 who can invoke hidaya-one-dev =="; gcloud run services get-iam-policy hidaya-one-dev \
  --project $P --region asia-south1 --format="table(bindings.role,bindings.members)"
echo "== 7 env var NAMES on hidaya-one-dev (no values) =="; gcloud run services describe hidaya-one-dev \
  --project $P --region asia-south1 --format="value(spec.template.spec.containers[0].env[].name)"
echo "== 8 service accounts =="; gcloud iam service-accounts list --project $P --format="table(email,disabled)"
echo "== 9 secret NAMES (no values) =="; gcloud secrets list --project $P --format="value(name)"
echo "== 10 buckets ==";     gcloud storage buckets list --project $P --format="table(name,location,storageClass)"
echo "== 11 Firestore ==";   gcloud firestore databases list --project $P --format="table(name,locationId,type)"
```

Notes:

- Step 7 prints variable **names** only. Do not replace it with a plain
  `describe`, which would print values.
- An error on one line is itself an answer (for example, an API that is not
  enabled). Share it as it is.
- If `hidaya-one-dev` is in a region other than `asia-south1`, step 5 shows
  the real region; steps 6 and 7 will then report "not found", which is fine.
- In step 5, a `minScale` above 0 means the service is billed while idle.
- In step 6, `allUsers` means the service is public. The blueprint requires it
  to be private.

## Part B — Confirm the Google AI Pro subscription

Claude Code cannot see this. Check it yourself and report yes/no and numbers.

1. Open <https://one.google.com> with the subscribing account.
   - Plan name shown (expected: Google AI Pro).
   - Are you the plan's primary subscriber, or a family member? Developer
     credits go to the primary subscriber only.
   - Renewal date and monthly price.
2. Open <https://labs.google/flow>.
   - Credit balance shown.
   - Credits charged for one Veo Lite clip, one Fast clip, and one image.
     Read the number on the generate button; do not generate.
3. Open <https://gemini.google.com>, then Settings.
   - Which models and which image and video generation limits it shows.

## Part C — Read the real API limits

1. Open <https://aistudio.google.com> with the same account.
2. Open the rate-limit or usage page (under the dashboard or API keys area).
3. Note, for each Flash and Flash-Lite model listed: requests per minute and
   requests per day on the free tier.
4. Note which Google Cloud project AI Studio shows as the default.
5. **Do not create an API key yet.** That is Part E.

## Part D — Publishing accounts (needed later, confirm now)

1. YouTube: the channel that will publish, and that this Google account is its
   owner or manager.
2. Instagram: whether the account is a Professional (Business or Creator)
   account and whether it is linked to a Facebook Page.

## Part E — Decisions awaiting approval (do not do these yet)

Each one changes billing, credentials or resources. They are listed so the
owner can decide; none is part of this audit.

| # | Decision | What it would involve | Why it matters |
| --- | --- | --- | --- |
| E1 | Claim the Google Developer Program Cloud credit | Create a developer profile and link a billing account at the Developer Program benefits page. A US$5 prepayment is reported to be required before credit applies to Gemini API use | US$10 a month would cover the estimated runtime cost |
| E2 | Choose the model access path | Developer API with a key held in Secret Manager, or Vertex AI with the service account and no key | Decides whether a free tier exists and how credentials are handled |
| E3 | Create the gate signing secret | One Secret Manager secret holding a random value the owner generates and never shares | Needed before any live pipeline run |
| E4 | Set a budget alert | A Cloud Billing budget with email alerts | Protects the ₹2,000 ceiling |
| E5 | Give a development machine access | On the owner's own machine or Cloud Shell: `gcloud auth login`, then `gcloud auth application-default login`. Nothing is sent to any chat | Lets the owner run the agents locally |

If a later milestone needs this cloud session to call Google directly, the
credential is entered by the owner in the environment's settings page, never
in chat. Part A makes that unnecessary for now.

## What to send back

1. The Part A output.
2. Part B: plan name, primary subscriber yes/no, Flow credit balance and
   per-generation credit costs.
3. Part C: the free-tier request limits AI Studio shows.
4. Part D: yes/no for each account.
