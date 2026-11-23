# Open-source Claude Code video skills — evaluation (2026-11-23)

All four repositories were cloned read-only (`--depth 1`) into a scratch area and inspected. Nothing was installed into Claude Code and none of their scripts were run.

## Verified facts

| Repo (commit inspected) | Licence | What it really is | Runtime | Outbound services in code | Arabic / Tamil | Fit |
|---|---|---|---|---|---|---|
| **alisadiq-ai/favstash-ai-video-editing-skills** (`4c0e603`, 2026-11-21) | Apache-2.0 (sample characters & previews excluded) | 16 skills, 99 "film look" style guides (ink wash, gilded illumination, chalkboard, 3D map…), 9:16 + 16:9. Renders through **HyperFrames** (HeyGen, Apache-2.0) + GSAP + FFmpeg. Optional FavStash service for publish/learn | Node ≥22, Chrome, FFmpeg; local | FavStash CLI (optional), yt-dlp, ElevenLabs (optional, never called by the pack) | No explicit handling found; relies on browser text shaping | **Adopt as design/prototyping studio + engine candidate** |
| **Viprasol-Tech/claude-video-editing-skills** (`0212f77`, 2026-11-20) | MIT | 95 skills on one Python core (`video-studio-core`: plan → render → QC → deliver). Includes a **regional-devotional** skill with respect rules (no comic SFX, never cut a prayer mid-line, exact lyrics, no ASR for sacred text) | Python, FFmpeg, OpenCV, MediaPipe, faster-whisper, Playwright | HuggingFace model download only | **Yes** — QC detects Unicode script per glyph (ARABIC, TAMIL…), checks font glyph coverage, requires libraqm for RTL/complex shaping | **Adopt QC patterns** (MIT, Python = blueprint language) |
| **Melvynx/video-agent-skills** (`f454292`, 2026-11-06) | MIT | Creator workflow built around **your own camera takes** (split-screen paper look, Instagram CTA). Publishing through third-party "Treg" | Node, Chrome, FFmpeg, whisper.cpp; **ships prebuilt macOS Mach-O binaries** (`faces`, `matte`) | OpenAI, ElevenLabs, Gemini API, iconify | No | **Reject** — opaque binaries, macOS-centric, camera-first, third-party publishing |
| **nemock/video-explainer-system** (`5176639`, 2026-06-07) | MIT | Topic/PDF → HTML deck → narrated MP4; Kokoro TTS + torchaudio MMS forced alignment | Python (uv), Apple Silicon oriented | none | Kokoro has no Tamil/Arabic voices | **Reject as engine; borrow idea:** MMS forced alignment for word-timed captions (MMS covers Tamil and Arabic) |

## Corrections to the recommendation I received
- These are **interactive Claude Code skills for a creator at a laptop**. The blueprint makes Claude Code a development tool, not the production runtime. So they cannot *be* the daily unattended pipeline. What is reusable is their **engines and patterns**, ported into our Cloud Run Job renderer, plus manual use for style exploration.
- **Free local voices don't cover the launch languages.** Kokoro's published voices are English, Spanish, French, Hindi, Italian, Japanese, Portuguese and Chinese. Chatterbox was archived in Aug 2026 and adds a watermark. Keep **Gemini 3.8 Flash TTS** (Tamil `ta-IN` GA, ≈ $0.007 per 15 s Short).
- `npx skills add …` hands a third party instruction-level control of the agent. FavStash's `INSTALL_FOR_AGENTS.md` also tells the agent to connect the FavStash service. Install only at a pinned commit, after review, and skip the service connection.

## What we proved here (spike, no paid calls)
`spikes/html-renderer/` contains a minimal HyperFrames-style renderer: a data manifest, then an HTML composition, then headless Chromium screenshots each frame and pipes them to FFmpeg (H.264 1080×1920 30 fps plus an AAC track).
- **Arabic** (with full tashkeel, RTL, joined letters) and **Tamil** (conjuncts) render correctly using Noto Naskh Arabic / Noto Sans Tamil, verified visually.
- **Text QC gate:** every on-screen string is byte-equal to the manifest (6/6), so text can come only from the source registry.
- **Font QC gate:** all required families load (no fallback boxes).
- **Speed:** 15 s Short rendered in **24 s** on this container. Fine for a Cloud Run Job.
- **Deterministic:** every frame is a pure function of time with a seeded RNG, so a re-render gives the same video (useful for signed manifests).

## Decision (ADR-012)
1. **Primary visual = deterministic animated motion graphics** rendered with HTML/Chromium + FFmpeg in a Cloud Run Job. This replaces FFmpeg `drawtext`, which lacks proper Arabic shaping without libraqm. It costs nothing per video.
2. Evaluate **HyperFrames** (Apache-2.0) against our minimal renderer in M4. Adopt it if its timeline/caption features save more effort than the dependency costs.
3. Use **FavStash film-look style guides** to design 3–5 Hidayah series looks (for example ink wash, gilded illumination, night-sky astronomy, paper calligraphy). Rotating series formats also helps against YouTube's "inauthentic/templated content" rule.
4. Port **Viprasol QC ideas** into our QC stage: script detection, glyph coverage, a shaping-engine check, and the devotional respect rules.
5. **VEED Fabric** (presenter) and **Omni** (realistic scenery) become optional premium layers, not daily necessities.

## Budget impact
| Scenario | Video | LLM + TTS | Infra | Total / month |
|---|---:|---:|---:|---:|
| I. 30 Shorts, all deterministic animation | $0 | ≈ $18 | ≈ $5 | **≈ $23** |
| J. I + VEED 5 s presenter on 10 Shorts | $7.50 | ≈ $18 | ≈ $5 | **≈ $31** |
| K. I + Omni scenery on 10 Shorts | $10.50–12.60 | ≈ $18 | ≈ $5 | **≈ $34–36** |

The $50 ceiling now has real headroom. The binding constraints move from cost to **source verification and editorial quality**.
