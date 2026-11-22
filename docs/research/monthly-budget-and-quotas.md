# Monthly Budget and Quotas — Phase 0

**Currency:** USD, excluding taxes (Indian GST on cloud services likely applies — **unverified**). Pilot runs in 2027, so **2027 list prices** are used where they differ. Prices marked [S] are secondary-source and must be confirmed on Google's pricing pages before Phase 3.

## Unit prices used

| Item | Unit price | Source |
|---|---|---|
| Omni 1.2 Flash 720p | $0.070 / generated second | [S] Google GA blog via secondary reports |
| Veo 3.1 Lite 720p (with audio) | $0.050 / s; clips 4/6/8 s only | [S] |
| Gemini 3.8 Flash (2027) | $1.50 in / $7.50 out per 1M tokens (thinking = output) | [S] |
| Gemini 3.8 Flash TTS (2027) | $18 / 1M audio tokens; 25 tok/s | [S] |
| Cloud Run, Firestore, GCS, Workflows, Scheduler, Logging | usage-based; mostly within free tiers at this scale | estimate |

## Per-Short cost model (15 s)

| Component | Lean | Realistic | Heavy |
|---|---:|---:|---:|
| Video generation (720p, 15 s) | $1.05 | $1.26 (+20% rerolls) | $1.58 (+50%) |
| Agent LLM calls (research, verify, script, QA) | 60k in / 15k out → $0.20 | 150k / 40k → $0.53 | 300k / 80k → $1.05 |
| Multimodal QA on rendered video | incl. | $0.05 | $0.15 |
| TTS narration | $0.01 | $0.01 | $0.02 |
| Search grounding | unknown | unknown | unknown |

## 30-day scenarios

| Scenario | Video | LLM + QA + TTS | Infra (Run/Store/Logs) | **Total** | vs $50 |
|---|---:|---:|---:|---:|---|
| A. 30 × Omni, lean | $31.50 | $6.30 | $3 | **≈ $41** | fits, ~18% headroom |
| B. 30 × Omni, realistic | $37.80 | $17.70 | $5 | **≈ $61** | **exceeds** |
| C. 15 Omni + 15 motion-graphic, realistic (**recommended**) | $18.90 | $17.70 | $5 | **≈ $42** | fits |
| D. 10 Omni + 20 motion-graphic, lean | $10.50 | $6.30 | $3 | **≈ $20** | comfortable |
| E. Repo spec: 3 Shorts/day × 30–45 s Omni | ≈ $189–$283 (90 × 30–45 s × $0.07) | $50+ | $10 | **≈ $250–$345** | **4–7× over** |
| F. 30 × Veo 3.1 Lite (2 × 8 s clips) | $24.00 | $17.70 | $5 | **≈ $47** | marginal; clip stitching needed |

**Conclusion:** $50/month is feasible only with (a) a mixed Omni + original motion-graphic policy or (b) very disciplined token budgets. The current repo target (3/day, 30–45 s) is not compatible with $50.

**Expected first-month cash outlay (pilot month in 2027, Scenario C):** ≈ $40–50 + tax. A possible $10/month AI Pro Cloud credit (if activated) offsets some cost **but spend caps are computed on gross cost before credits**, so set caps on gross amounts.

## Spend-cap design (second layer behind the in-app ledger)

| Project-scoped spend cap | Suggested monthly gross cap |
|---|---|
| Agent Platform (`aiplatform.googleapis.com`) | $45 |
| Gemini API (`generativelanguage.googleapis.com`) | $5 (or $0 after consolidation) |
| Cloud Run (`run.googleapis.com`) | $10 |
| Plus a classic budget alert on the whole project at 50/80/100% of $60 | alerts only |

Caveats (official doc): enforcement is not instant and overage is billed; Firestore/GCS/Workflows/Logging are not cappable; manually lifting a cap disables it for the rest of the month. The deterministic ledger reservation gate (blueprint §25) remains the primary control.

## Quotas

| Quota | Default | Need | OK? |
|---|---|---|---|
| YouTube `videos.insert` | 100/day | 1–3/day | ✅ |
| YouTube other units | 10,000/day | ~200/day (status polls, thumbnails 50, list calls) | ✅ |
| Omni 1.2 Flash requests/min (project) | **unknown** | ~1–3 per run | owner check |
| Gemini 3.8 Flash RPM/TPM | **unknown** | low | owner check |
