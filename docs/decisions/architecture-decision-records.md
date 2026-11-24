# Architecture Decision Records — Phase 0 (proposed, awaiting founder approval)

Each ADR: context → decision → alternatives rejected → consequences. Status of all: **PROPOSED**.

## ADR-001 Production runs on Google Cloud; Claude Code is dev-only
- **Decision:** Gemini + ADK on Cloud Run/Jobs, Workflows, Scheduler, Firestore, GCS, Secret Manager. Claude Code never in the runtime path.
- **Rejected:** running agents from a laptop/Claude session (no durability, not Google-native).

## ADR-002 Video model: Omni 1.2 Flash primary, motion-graphics fallback, Veo 3.1 Lite optional
- **Context:** Omni 1.2 Flash is GA, 3–15 s, 9:16, `global` only, Interactions API (v1beta1 path). Veo clips max 8 s.
- **Decision:** `gemini-omni-1.2-flash` @720p, `delivery: uri` to GCS, behind a `VideoGenerator` port. Deterministic FFmpeg motion-graphic generator is a first-class second adapter (not just an error fallback) so the budget mix (Scenario C) works. Veo 3.1 Lite adapter only if Omni access fails.
- **Rejected:** Flow/Vids automation (no official API; unofficial wrappers violate blueprint non-negotiables); Omni preview models.
- **Consequence:** Interactions API is `v1beta1` — wrap it and pin request/response fixtures; expect C2PA → permanent YouTube AI label.

## ADR-003 Orchestration: Cloud Workflows outside, ADK graph `Workflow` inside
- **Decision:** Cloud Workflows owns the durable daily job (state, retries, waits for long-running video ops, human-review callbacks). Each step calls a Cloud Run endpoint; content-intelligence steps run an ADK 2.x graph `Workflow` with deterministic validation nodes whose failure is a hard branch to `HOLD_FOR_REVIEW`.
- **Rejected:** LLM sub-agent delegation as the gate (current `agent.ts`) — an LLM can skip a "verifier"; deprecated `SequentialAgent`/`LoopAgent`.

## ADR-004 Implementation language — **founder decision required**
- **Context:** Blueprint mandates Python + Pydantic. Repo is ADK **TypeScript** (`@google/adk ^2.4.0`) and the deployed services appear to be TS/Node. ADK 2.x graph workflows exist in both.
- **Recommendation:** **Python** for agents/contracts (blueprint; larger ADK ecosystem and eval tooling; Pydantic contracts), keep `agent.ts` as an archived reference. Choose TypeScript only if the founder wants to keep the already-deployed code path — then Zod replaces Pydantic and all other ADRs stand.

## ADR-005 Single Gemini billing path: Agent Platform with service identity
- **Decision:** Retire the API-key path (`hidaya-one-dev`, `GOOGLE_GENAI_API_KEY`) once the new service is live; use per-service service accounts with `roles/aiplatform.user` only.
- **Rejected:** API keys in production (long-lived secret, second billing surface, second spend cap).

## ADR-006 State: Firestore (jobs, ledger, source index) + GCS (immutable assets)
- Idempotency key = `channel_id + publish_date + slot`; Firestore transaction creates the job; GCS objects versioned + retention lock on release manifests. BigQuery deferred.

## ADR-007 Religious text is never model output
- Canonical Arabic + approved translation come from the versioned source registry and are rendered by the deterministic renderer (FFmpeg/ASS subtitles with a licensed Arabic font). Video prompts forbid text, people-as-prophets and calligraphy. See `docs/source-governance/`.

## ADR-008 YouTube publisher: private-first, explicit fields
- `videos.insert` resumable, scope `youtube.upload` (+ `youtube.readonly` for reconciliation, `yt-analytics.readonly` for analytics). Always send `privacyStatus: "private"`, `containsSyntheticMedia`, `selfDeclaredMadeForKids`, `paidProductPlacementDetails.hasPaidProductPlacement=false`. Publish = later `videos.update` to `public` or `publishAt`, only from an approved release manifest. Before any re-upload, reconcile by searching own uploads for the job's idempotency tag in the description.
- **Why:** since 2026-11-02 omitted privacy defaults to **public** for all API projects.

## ADR-009 Cost control = ledger reservation + spend caps
- In-app atomic reservation per paid call (blueprint §25) is primary; per-service spend caps on `aiplatform`, `generativelanguage`, `run` are secondary.

## ADR-010 Region
- Run services in `asia-south1` (existing, near founder/audience); call Omni at `global` (only region offered). Document cross-region data flow (prompts + generated media only, no personal data).

## Workflow diagram

```mermaid
flowchart TD
  S[Cloud Scheduler daily] --> W{{Cloud Workflows job<br/>idempotency key}}
  W --> T[Topic strategist] --> R[Researcher: registry lookup]
  R --> V{Deterministic verifier<br/>exact text + license + grading}
  V -- fail --> H[HOLD_FOR_REVIEW + notify]
  V -- pass --> SC[Script writer] --> E{Editorial/rights policy check}
  E -- fail --> H
  E -- pass --> B{Cost gate reservation}
  B -- deny --> MG[Motion-graphic generator]
  B -- allow --> O[Omni 1.2 Flash → GCS]
  O -- error/timeout --> MG
  O --> TTS[Gemini TTS narration]
  MG --> TTS
  TTS --> RD[Cloud Run Job: FFmpeg + exact text overlay]
  RD --> QA{Multimodal + deterministic QA}
  QA -- fail --> H
  QA -- pass --> UP[Private upload + processing check]
  UP --> M[Signed release manifest]
  M --> PUB{Autonomy scope allows?}
  PUB -- yes --> SCHED[Set publishAt]
  PUB -- no --> H
  SCHED --> AN[Analytics worker, async]
```

## ADR-011 VEED Fabric 1.0 as presenter adapter (founder directive, 2026-11-23)
- **Context:** Founder chose VEED for video creation. VEED's API provides image+audio → talking video (Fabric 1.0), lipsync, dubbing, reframe, background removal — **no scene/text-to-video and no subtitles yet** (see `docs/research/veed-api-evaluation.md`).
- **Decision:** Add `PresenterGenerator` port with a VEED Fabric adapter (async submit/poll, GCS signed-URL inputs, immediate copy of expiring outputs to GCS, `X-Veed-Store-IO: 0`). Scenery = motion graphics (default) or Omni (optional). FFmpeg renderer composites presenter + scenery + exact text.
- **Deviation from blueprint:** VEED is a non-Google hosted service; the blueprint's "Google-only hosted services" rule is relaxed for this adapter by founder decision. Data sent: TTS audio + avatar image only.
- **Guardrails:** avatar must be founder (with consent) or an owned non-photoreal character; no prophets/companions/real scholars; no lip-synced Qur'anic recitation; VEED spend tracked by the same ledger reservation (VEED has prepaid credits — top-up amount acts as an external hard cap).
- **Secret handling:** key held as an environment network secret / Secret Manager in production; never in code, logs or chat.

## ADR-012 Deterministic HTML/Chromium motion graphics as the primary visual (2026-11-23)
- **Context:** Reviewed FavStash, Viprasol, Melvynx and video-explainer skills (`docs/research/open-source-video-skills-evaluation.md`). Spike `spikes/html-renderer/` proved headless Arabic (RTL, tashkeel) and Tamil rendering, byte-exact text QC and a 24 s render time for a 15 s 1080×1920 Short.
- **Decision:** The renderer (Cloud Run Job) composites an HTML/GSAP-style composition rendered by headless Chromium, then encodes it with FFmpeg. This supersedes FFmpeg `drawtext` for text in ADR-007. Motion graphics become the default visual. VEED Fabric (ADR-011) and Omni (ADR-002) are optional premium layers. HyperFrames (Apache-2.0) to be evaluated in M4. Viprasol-style QC (script/glyph/shaping checks) is added to the QC stage.
- **Rejected:** Melvynx engine (prebuilt macOS binaries, camera-first, third-party publishing); Kokoro/Chatterbox as launch TTS (no Tamil/Arabic; archived/watermarked); running Claude Code skills as the production pipeline (blueprint: Claude Code is dev-only).

## ADR-013 Adobe (Express Premium) as the media toolkit; HyperFrames as the renderer; weekly batch (2026-11-24)
- **Context:** Founder has Adobe Express Premium (+250 Firefly credits). The Adobe connector in Claude sessions provides Adobe Stock search/licensing, image editing, fonts and Express design export; **Firefly generation is disabled in this connector** (except generative expand), and the connector exists only inside an interactive Claude session — it cannot be called from Cloud Run.
- **Decision:**
  1. Visual plates come from a **footage library** (`library/footage.json`, files in `library/footage/`, git-ignored) filled from Adobe Stock in Claude sessions — free-tier clips licensed through the founder's account — and, when the founder generates them, from Firefly (picked up via `asset_search` scope `GenAIAsset`).
  2. The Creative agent maps each topic's moods to library plates; plates are graded with HyperFrames `media-treatment` for legibility.
  3. **HyperFrames** renders every Short from a generated project (`src/hf/build.ts`); `hyperframes check` is a hard gate.
  4. **Operating model:** a weekly batch session (`npm run produce -- --batch 21 --start <date>`) produces 21 Shorts, each uploaded to YouTube as **private** with a `publishAt` slot (07:00 / 13:00 / 19:30 IST). The founder reviews in YouTube Studio; anything not approved is simply left private.
- **Supersedes:** ADR-011 (VEED presenter — dropped by founder), ADR-012's code-drawn background (kept only as a fallback look).
- **Rejected:** unattended Cloud Run rendering with Adobe (needs Adobe Firefly Services enterprise API); Express `animate_design` for Shorts (cannot sync text to recitation).

## ADR-014 Verse registry and approval levels
- `registry/verses.json` holds references only (never text). Status ladder: `PROPOSED` → `AI_APPROVED` (set automatically when the verification agent's Gemini review approves the verse for its topic) → `SCHOLAR_APPROVED` (human). `REJECTED` is never produced.
- Recitation must be ≤ 18.6 s to fit the 30 s format (measured; 13 of 42 candidates excluded).
- The verification agent is asked about the **verse's own topic**; a topic mismatch blocks production (observed on the first 2:152 run when the prompt was still hard-coded to sabr — the gate held).
