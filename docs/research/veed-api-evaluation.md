# VEED API Evaluation — founder directive "use VEED for video creation"

**Checked:** 2026-11-23 against https://api.veed.io/docs, /pricing, /docs/media-retention, /docs/guides/lipsync (fetched directly).
**Account check:** API key stored as an environment network secret (proxy-injected, never in repo). A free authenticated probe (`GET /v1/fabric-1.0/<nonexistent-id>`) returned **404 `job_not_found`** (not 401) ⇒ **key is valid — CONFIRMED**. **No paid job has been submitted.**

## What VEED's API offers (official list)

| Model | Input → output | Price | Use for Hidayah |
|---|---|---|---|
| **Fabric 1.0** | still image + speech audio → talking lip-synced video | **$0.08/s (480p), $0.15/s (720p)** of output | Presenter/avatar segments |
| Fabric H3 | image + speech + text prompt → talking video | Early access | Later, if granted |
| Lipsync 2.0 | video + new audio → re-synced video | $0.07/s | Language versions of a presenter clip |
| Dubbing Std / Pro | video → translated, lip-synced video | $0.11 / $0.18 per s | Tamil ↔ English versions (needs religious re-verification) |
| Reframe | landscape → 9:16, optional captions | $0.50/min input (1-min min) | Repurpose 16:9 assets |
| Background removal | video → cut-out | from $0.008 / 30 frames | Composite presenter over scenery |
| Clean Audio | audio/video → denoised | $0.0125/min | Founder-recorded voice |
| Subtitles | — | **Coming soon** | Not available; keep deterministic renderer |

**Not offered:** text-to-video / scene generation, templates, timeline editing/rendering, Arabic text overlay. VEED therefore **cannot replace** the scenery generator (Omni / motion graphics) or the deterministic FFmpeg renderer — it adds a **talking presenter**.

## Integration facts
- Async: `POST /v1/fabric-1.0` → `202 {job_id, status: PROCESSING, credits_estimated}` → poll `GET /v1/fabric-1.0/{job_id}` until `COMPLETED`/`FAILED`. Billed only on completion.
- Inputs must be **public http(s) URLs** ⇒ serve audio/image from GCS via short-lived **V4 signed URLs** (≤ 1 h).
- Output URLs **expire** (default 24 h, max 30 days via `X-Veed-Media-Expiration-Seconds`; `410 Gone` after) ⇒ copy result to GCS immediately in the same workflow step.
- Request/response bodies kept 7 days unless `X-Veed-Store-IO: 0` — send `0` in production.
- Fabric takes **speech, not text** ⇒ pipeline stays: verified script → Gemini TTS (Tamil/English) → Fabric.
- Not verified yet: max clip length, output aspect ratio for a 9:16 source image, rate limits, content policy. To be checked with the first approved test job.

## Editorial / policy constraints (blueprint non-negotiables)
- The avatar image must **never** represent a prophet, companion or any real scholar/person without written consent. A realistic synthetic "sheikh" presenting rulings would amount to impersonating religious authority — **not allowed**.
- Acceptable options: (a) the **founder's own photo** with consent (strongest authenticity, also helps against YouTube's inauthentic-content rule); (b) a **non-photorealistic illustrated narrator/mascot** owned by Hidayah; (c) no face — voice over scenery.
- Lip-synced realistic person ⇒ `containsSyntheticMedia=true` and YouTube AI disclosure.
- Arabic Qur'anic recitation must **not** be lip-synced onto an avatar from TTS; avatar speaks translation/explanation only. Exact Arabic stays a deterministic overlay.

## Cost (15 s Short)
| Use of Fabric | Per Short | 30/month |
|---|---:|---:|
| Full 15 s @720p | $2.25 | **$67.50** (exceeds $50 alone) |
| Full 15 s @480p | $1.20 | $36.00 (480p looks soft on Shorts) |
| **5 s hook/presenter @720p + 10 s scenery/motion graphics** | $0.75 | **$22.50** |
| Recommended mix with motion graphics + TTS + Gemini (2027 rates) | — | **≈ $45–48** |

## Recommendation
Adopt VEED **Fabric 1.0 as the presenter adapter** behind the `VideoGenerator`/`PresenterGenerator` port, used for a ~5 s on-camera segment, composited by our FFmpeg renderer with motion-graphic scenery and exact-text overlays. Omni becomes optional (scenery upgrades) to keep within $50. First paid test (≈ $0.75–$2.25) only after founder approval and choice of avatar image.
