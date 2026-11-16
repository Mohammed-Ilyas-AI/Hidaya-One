# Hidaya One cost optimization

Audit date: 2026-11-16. A plan for staying inside about ₹2,000 a month. Every
figure is an estimate built on the prices recorded in `FREE_TOOLS_MATRIX.md`;
several of those are unconfirmed, and the assumptions are stated so they can be
corrected.

## The budget

₹2,000 a month is roughly US$23 at recent exchange rates (rate not checked in
this audit). The existing Google AI Pro subscription is a separate, already
committed cost and is not counted against it.

Volume: 3 Shorts a day, about 90 a month, 30–45 seconds each (40 used below).

## Where the money would go

### Video generation decides everything

| Approach | Calculation | Monthly cost | Against budget |
| --- | --- | --- | --- |
| Every second from Veo 3.1 Lite (720p) by API | 90 × 40 s × US$0.05 | US$180 | About 8 times over |
| Every second from Veo 3.1 Fast (720p) by API | 90 × 40 s × US$0.10 | US$360 | About 16 times over |
| One 8-second Veo Lite clip per Short by API | 90 × 8 s × US$0.05 | US$36 | Over on its own |
| One Veo Lite clip per Short made by hand in Flow | 90 × about 10 credits | 900 of 1,000 monthly credits | US$0, if the credit cost holds |
| No generated video; animated stills and code-drawn motion | — | US$0 | Fits |

**Conclusion: the Veo API cannot be part of a ₹2,000 pipeline.** Generated
video is affordable only through Flow credits, and Flow has no API, so it is a
manual step.

### Images

| Approach | Calculation | Monthly cost |
| --- | --- | --- |
| 5 API images per Short | 450 × about US$0.034 | About US$15 |
| 1 API image per Short | 90 × about US$0.034 | About US$3 |
| Reusable library made by hand under the subscription, plus code-drawn backgrounds | — | US$0 |

### Everything else

| Item | Assumption | Monthly estimate |
| --- | --- | --- |
| Gemini text (13 agents, one run a day) | About 200,000 input and 30,000 output tokens a run at Flash-Lite prices | US$4 to US$6 |
| Google Search grounding | Under 1,500 requests a month against a 5,000 allowance | US$0 |
| Tamil narration | 90 × about 700 characters = about 63,000 characters against a 1,000,000 allowance | US$0 |
| Rendering compute | 90 renders × about 2 minutes × 2 vCPU = about 21,600 vCPU-seconds against 180,000 | US$0 if the allowance applies in the region |
| Media storage in `asia-south1` | About 3 GB of finished video a month, intermediates deleted | Under US$1 |
| Firestore, Secret Manager, Cloud Build | Inside allowances | US$0 |
| YouTube and Instagram publishing | Free APIs | US$0 |

The token figure is a guess until a live run is measured. It is the first
number to replace with a real one.

## Lowest-cost architecture

```text
Daily trigger (Cloud Scheduler)
   |
   v
Cloud Run, scale to zero ............................ free allowance
   |
   +- ADK workflow: research -> verification -> gate -> script
   |     Gemini Flash-Lite / Flash ................... free tier, then ~US$5
   |     Google Search grounding, URL Context ........ inside allowance
   |
   +- Narration: Cloud Text-to-Speech, Tamil ......... inside allowance
   |
   +- Visuals
   |     default: code-drawn geometric motion ........ free
   |     library: stills made by hand in Gemini/Flow . subscription
   |     optional: one hero clip by hand in Flow ..... subscription credits
   |
   +- Render: FFmpeg + headless Chromium ............. free software
   |
   +- Records: Firestore ............................. free allowance
   +- Media: Cloud Storage, asia-south1 .............. under US$1
   |
   v
Owner approval in the dashboard
   |
   v
YouTube Data API, Instagram publishing ............... free
```

Estimated total: **US$5 to US$10 a month** with no API images or video, before
the Developer Program credit. If the owner claims that US$10 monthly credit,
the expected out-of-pocket Cloud cost is close to zero.

### The one manual step

Anything that uses the subscription's creative allowance (Flow clips, Gemini
app images) has to be done by a person in a browser. Two ways to live with
that:

1. **Fully automated, no generated video.** Code-drawn visuals and a still
   library. Nothing manual in the daily run. Recommended starting point.
2. **Semi-automated.** The pipeline writes a prompt sheet for the day; the
   owner generates the clips in Flow and uploads them to a folder; the pipeline
   continues. About 900 credits a month for one clip per Short, which leaves
   almost no margin in a 1,000-credit allowance.

Starting with option 1 and adding option 2 for selected Shorts keeps the daily
run independent of a person and of the credit balance.

## Rules that keep the cost down

1. No Veo or image API calls without the owner's explicit approval per use.
2. Keep Cloud Run at zero minimum instances.
3. Keep the existing limits: 5 evidence records and 40 model calls per
   pipeline run. Add a daily cap on runs.
4. No automatic retries of generation steps. A failed step stops and reports.
5. Delete intermediate media automatically; keep only the final video,
   narration and records.
6. Use Flash-Lite where quality allows and Flash only where it is needed.
   Measure before choosing.
7. Set a budget alert before the first paid call.
8. Record tokens, characters and seconds used per run, so estimates here are
   replaced by measurements.

## Risks to the estimate

| Risk | Effect | How to settle it |
| --- | --- | --- |
| Free-tier request limits are far lower than assumed (one reading says 20 a day for Flash) | The pipeline needs a billed project from the start; cost is still about US$5 | Part C of the checklist |
| Search grounding is not available on the free tier for current models | Same as above | First live test |
| Cloud Run allowance does not apply in `asia-south1` | A few US dollars a month for rendering | Confirm on the pricing page |
| Token use per run is higher than guessed | Text cost scales with it | Measure the first live run |
| Flow credit costs differ from third-party reports | Fewer hero clips than planned | Part B of the checklist |
| The configured model is not served in `asia-south1` | Use another region or the global endpoint for model calls only | First live test |
| The US$10 credit needs a US$5 prepayment | A one-time US$5 outlay | Owner decision E1 |
| Prices change | Any line here | Re-check the pricing pages each quarter |

## What this plan does not include

- The Google AI Pro subscription itself.
- Any purchase of extra Flow or Antigravity credits.
- Domain, email or other non-Google services.
- The backend and dashboard hosting, which are small and inside free
  allowances as far as can be told, but are not built yet.
