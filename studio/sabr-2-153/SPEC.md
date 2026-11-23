# SPEC — Hidayah · Sabr · Qur'an 2:153 (30 s, 1080×1920, 30 fps)

**Storyline chosen — "The night before dawn".** A lone desert at night: hardship. The recitation begins and the
horizon warms; on "inna Allāha maʿa ṣ-ṣābirīn" the sun breaks the dunes. Patience is the waiting; the light is the promise.
(Not built: "the single lamp" — one lantern in a vast dark mosque courtyard; "the river stone" — water smoothing a stone, macro.)

## Look (every adjective as a number)
- Sky: lapis night `#03061A`→ rose dawn horizon `#C76B6B` → gold sunrise `#FFB257`. Dawn value 0→1 over 3.2 s → 25.4 s.
- Sun: disc 0.035 of frame height, rises from y = 78 % to 53 % of frame; god rays only after dawn 0.3.
- Dunes: three parallax ridges, crest rim light ≤ 35 % sun colour. Stars fade out by dawn 0.55.
- Dust: ~90 motes, 1–4 px, rising 6–22 px/s, 18 % soft bokeh.
- Type: Arabic **Amiri Quran** (verse), **Aref Ruqaa** 700 (title صبر), Tamil **Noto Serif Tamil** 500/600, English **Cormorant Garamond** 500/600.
  Arabic verse 84–100 px; Tamil 44–50 px; English 44–48 px italic; reference 28 px tracked 0.3 em; no boxes, no borders — soft radial scrim only.
- Accent: gold `#F2D48A` for the one word that carries meaning (none on scripture — scripture is never re-coloured per word).
- Safe zone: all text y 288–1248, x 120–888 (x 120–780 below y 840).

## Shots
| t (s) | Scene | What happens |
|---|---|---|
| 0.0–3.2 | hook | Frame 0 already shows صبر over night dunes (thumbnail). Tamil hook arrives word by word (blur 6→0, 67 ms apart) at 0.35 s; English line blurs in whole at 1.05 s. Blur-out 0.2 s at 2.95. |
| 3.2–17.95 | verse | Alafasy recites. Phrase 1 (0–4.60 s of recitation), 2 (4.60–9.12), 3 (9.12–14.45) — measured from the recitation's energy dips; the 9.12 s dip is the waqf ۚ. Each phrase lands with a whole-line blur-in, holds dead still, leaves with a blur swap. Tamil + English translation of the same phrase swap with it. Reference "AL-BAQARAH · 2:153" holds from 3.6 s. |
| 17.95–25.4 | reflect | Sun crests the dunes (colour flood is the cause of the cut). "إِنَّ ٱللَّهَ مَعَ ٱلصَّٰبِرِينَ" arrives word by word (120 ms), Tamil then English. Recitation reprise of phrase 3 (source 9.12–14.45 s) plays under it. |
| 25.4–30 | end | HIDAYAH letter by letter (opacity .3→1, 0.1 s apart), sub-lines, holds ≥ 2 s. |

## Sound
Recitation is the clock and the only voice; untouched (no reverb, no music — deliberate for Qur'an content).
A quiet desert-air bed (band-limited noise, no tones) under everything, ducked to 0.35 under recitation. No SFX.
Tamil narration slot (Gemini 3.8 Flash TTS) is reserved for the reflect scene once the native-header key is configured.

## Text provenance (every on-screen word)
Arabic: alquran.cloud `quran-uthmani`, cross-checked with Tanzil. Tamil: Jan Turst Foundation. English: Saheeh International.
Translation phrase lines are exact substrings of the published translations. Hook lines: Gemini 3.8 Flash, editorial rules applied.

## BANNED here
Floating/pulsing titles; every element fading and sliding up; per-word colour on scripture; music; boxes/plaques; text outside the safe zone.
