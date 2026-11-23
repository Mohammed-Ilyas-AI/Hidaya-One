# Spike: deterministic HTML → MP4 renderer

Proves headless Arabic/Tamil/English rendering for 9:16 Shorts with no paid APIs.
**Render test only. Contains no religious content and is not for publication.**

```bash
# needs: node >= 22, playwright + chromium, ffmpeg, fonts-noto-core (Noto Naskh Arabic, Noto Sans Tamil)
node render.mjs manifest.json out.mp4
```

- `manifest.json` holds every on-screen string (in production: generated from approved source-registry records only).
- `composition.html` makes each frame a pure function of `t` (seeded RNG, no wall clock), so renders are reproducible.
- `render.mjs` runs two QC gates before rendering: byte-equality of rendered text vs manifest, and font availability. Then it pipes JPEG frames to FFmpeg (H.264 + AAC, faststart).

Result on the dev container: 450 frames (15 s @ 30 fps, 1080×1920) in about 24 s.
See `docs/research/open-source-video-skills-evaluation.md`.
