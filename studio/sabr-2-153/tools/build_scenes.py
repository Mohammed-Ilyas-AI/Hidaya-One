"""Builds the scene files from the verified source record — scripture is never typed by hand.
Every phrase is an exact substring of its edition; the build fails otherwise."""
import json, html, sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
rec = json.load(open(ROOT / "../../tests/fixtures/quran-2-153.json", encoding="utf-8"))
AR = rec["arabic"]["text"]
TA = next(t for t in rec["translations"] if t["lang"] == "ta")["text"]
EN = next(t for t in rec["translations"] if t["lang"] == "en")["text"]
words = AR.split(" ")
P_AR = [" ".join(words[0:3]), " ".join(words[3:7]), " ".join(words[7:])]
def cut(text, marks):
    """Split the published translation right after each mark, keeping every byte."""
    parts, i = [], 0
    for m in marks:
        j = text.index(m, i) + len(m); parts.append(text[i:j].strip()); i = j
    parts.append(text[i:].strip()); return parts
P_TA = cut(TA, ["!", ";."])            # Jan Turst phrase boundaries
P_EN = cut(EN, ["believed,", "prayer."]) # Saheeh International phrase boundaries
for p in P_AR: assert p in AR, p
for p in P_TA: assert p in TA, p
for p in P_EN: assert p in EN, p
assert " ".join(P_AR) == AR
HOOK_TA, HOOK_EN = "பொறுமை தளர்கிறதா?", "Is your patience fading?"   # Gemini 3.8 Flash, editorial rules passed
# phrase boundaries (s, recitation-local) from the recitation's energy dips; 9.12 is the waqf
B = [0.0, 4.60, 9.12, 14.45]
E = html.escape
FONTS = """
    @font-face { font-family: "AmiriQ"; src: url("assets/fonts/AmiriQuran.ttf"); }
    @font-face { font-family: "Ruqaa"; font-weight: 700; src: url("assets/fonts/aref-ruqaa-arabic-700-normal.woff2"); }
    @font-face { font-family: "Corm"; font-weight: 500; src: url("assets/fonts/cormorant-garamond-latin-500-normal.woff2"); }
    @font-face { font-family: "Corm"; font-weight: 600; src: url("assets/fonts/cormorant-garamond-latin-600-normal.woff2"); }
    @font-face { font-family: "Corm"; font-weight: 500; font-style: italic; src: url("assets/fonts/cormorant-garamond-latin-500-italic.woff2"); }
    @font-face { font-family: "TamilSerif"; font-weight: 500; src: url("assets/fonts/noto-serif-tamil-tamil-500-normal.woff2"); }
    @font-face { font-family: "TamilSerif"; font-weight: 600; src: url("assets/fonts/noto-serif-tamil-tamil-600-normal.woff2"); }"""
BASE = """
    #root { position: absolute; inset: 0; }
    .scrim { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(4,6,18,0) 9%, rgba(4,6,18,var(--scrim,.45)) 22%, rgba(4,6,18,var(--scrim,.45)) 50%, rgba(4,6,18,0) 60%); }
    .col { position: absolute; left: 120px; width: 660px; text-align: center; }
    .col-n { position: absolute; left: 120px; width: 660px; text-align: center; }
    .w { display: inline-block; }
    .ar { font-family: "AmiriQ"; color: #FFF6DF; text-shadow: 0 0 26px rgba(255,214,140,.45), 0 3px 14px rgba(0,0,0,.7); }
    .ta { font-family: "TamilSerif"; color: #FFFDF6; text-shadow: 0 2px 20px rgba(0,0,0,.75); }
    .en { font-family: "Corm"; font-style: italic; font-weight: 500; color: #F1E6CF; text-shadow: 0 2px 18px rgba(0,0,0,.7); }"""

def words_html(text, cls, prefix):
    return " ".join(f'<span class="w {cls}" id="{prefix}-{i}">{E(w)}</span>' for i, w in enumerate(text.split(" ")))

def scene(cid, dur, css, body, js):
    return f"""<template>
  <style>{FONTS}{BASE}
{css}
  </style>
  <div id="root" data-composition-id="{cid}" data-width="1080" data-height="1920">
    <div class="scrim" data-layout-ignore></div>
{body}
  </div>
  <script>
    function fitWords(sel, maxW) {{
      document.querySelectorAll(sel).forEach((el) => {{
        const ws = el.querySelectorAll(".w"); let fs = parseFloat(getComputedStyle(el).fontSize);
        for (let k = 0; k < 30; k++) {{ const wide = Math.max(0, ...[...ws].map((w) => w.getBoundingClientRect().width)); if (wide <= maxW) break; fs -= 2; el.style.fontSize = fs + "px"; }}
      }});
    }}
    fitWords(".fit", 640);
    const tl = gsap.timeline({{ paused: true }});
{js}
    window.__timelines["{cid}"] = tl;
  </script>
</template>
"""

out = ROOT / "compositions"
# ---------- hook 0–3.2 ----------
hook_body = f"""    <div id="hook-title" class="clip col" data-start="0" data-duration="3.2" style="top:330px"><div id="hook-title-in" class="title" dir="rtl" lang="ar">صَبْر</div></div>
    <div id="hook-ta" class="clip col-n" data-start="0.3" data-duration="2.9" style="top:880px"><div class="ta hook-ta fit" lang="ta">{words_html(HOOK_TA, "", "hook-taw")}</div></div>
    <div id="hook-en" class="clip col-n" data-start="0.9" data-duration="2.3" style="top:1060px"><div id="hook-en-in" class="en hook-en" lang="en">{E(HOOK_EN)}</div></div>"""
hook_css = """    .title { font: 700 240px/1.3 "Ruqaa"; color: #F7E3A8; text-shadow: 0 0 40px rgba(255,205,120,.55), 0 0 90px rgba(255,170,80,.25); }
    .hook-ta { font-weight: 600; font-size: 64px; line-height: 1.45; }
    .hook-en { font-size: 52px; line-height: 1.3; color: #E7E0F2; }"""
nta = len(HOOK_TA.split(" "))
hook_js = f"""    tl.fromTo("#hook-title-in", {{ opacity: 1, scale: 1.04 }}, {{ scale: 1, duration: 3.2, ease: "power2.inOut" }}, 0);
    for (let i = 0; i < {nta}; i++) tl.fromTo("#hook-taw-" + i, {{ opacity: 0, filter: "blur(6px)" }}, {{ opacity: 1, filter: "blur(0px)", duration: 0.13, ease: "power4.out" }}, 0.35 + i * 0.067);
    tl.fromTo("#hook-en-in", {{ opacity: 0, filter: "blur(8px)" }}, {{ opacity: 1, filter: "blur(0px)", duration: 0.2, ease: "power4.out" }}, 1.05);
    tl.to(["#hook-title-in", "#hook-ta > div", "#hook-en-in"], {{ opacity: 0, filter: "blur(8px)", duration: 0.2, ease: "power3.in" }}, 2.98);"""
(out / "hook.html").write_text(scene("hook", 3.2, hook_css, hook_body, hook_js), encoding="utf-8")

# ---------- verse 3.2–17.95 (local 0–14.75) ----------
vb, vj = [], []
vb.append('    <div id="verse-ref" class="clip col" data-start="0.4" data-duration="14.35" style="top:300px"><div id="verse-ref-in" class="ref">AL-BAQARAH&nbsp;&nbsp;·&nbsp;&nbsp;2:153</div></div>')
vj.append('    tl.fromTo("#verse-ref-in", { opacity: 0, filter: "blur(6px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.5, ease: "expo.out" }, 0.4);')
for k in range(3):
    s, e = B[k], (B[k + 1] if k < 2 else 14.75)
    d = round(e - s, 2)
    vb.append(f'    <div id="v-ar{k}" class="clip col" data-start="{s}" data-duration="{d}" data-hold style="top:380px"><div id="v-ar{k}-in" class="ar verse-ar fit" dir="rtl" lang="ar">{E(P_AR[k])}</div></div>')
    vb.append(f'    <div id="v-tr{k}" class="clip col-n" data-start="{round(s + 0.35, 2)}" data-duration="{round(d - 0.35, 2)}" data-hold style="top:820px"><div class="ta verse-ta fit" lang="ta">{words_html(P_TA[k], "", f"v-taw{k}")}</div><div id="v-en{k}-in" class="en verse-en" lang="en">{E(P_EN[k])}</div></div>')
    vj.append(f'    tl.fromTo("#v-ar{k}-in", {{ opacity: 0, filter: "blur(10px)", scale: 1.03 }}, {{ opacity: 1, filter: "blur(0px)", scale: 1, duration: 0.45, ease: "expo.out" }}, {s + 0.02});')
    n = len(P_TA[k].split(" "))
    vj.append(f'    for (let i = 0; i < {n}; i++) tl.fromTo("#v-taw{k}-" + i, {{ opacity: 0, color: "#8C8A86" }}, {{ opacity: 1, color: "#FFFDF6", duration: 0.25, ease: "power2.out" }}, {s + 0.4} + i * 0.09);')
    vj.append(f'    tl.fromTo("#v-en{k}-in", {{ opacity: 0, filter: "blur(8px)" }}, {{ opacity: 1, filter: "blur(0px)", duration: 0.2, ease: "power4.out" }}, {s + 0.55 + n * 0.09});')
    vj.append(f'    tl.to(["#v-ar{k}-in", "#v-tr{k} > div"], {{ opacity: 0, filter: "blur(8px)", duration: 0.18, ease: "power3.in" }}, {round(e - 0.2, 2)});')
verse_css = """    #root { --scrim: .4; }
    .ref { font: 600 28px/1 "Corm"; letter-spacing: .32em; color: #EBD9A6; text-shadow: 0 2px 12px rgba(0,0,0,.6); }
    .verse-ar { font-size: 96px; line-height: 1.85; }
    .verse-ta { font-weight: 500; font-size: 46px; line-height: 1.6; }
    .verse-en { margin-top: 22px; font-size: 46px; line-height: 1.35; }"""
(out / "verse.html").write_text(scene("verse", 14.75, verse_css, "\n".join(vb), "\n".join(vj)), encoding="utf-8")

# ---------- reflect 17.95–25.4 (local 0–7.45) ----------
nar = len(P_AR[2].split(" ")); nta3 = len(P_TA[2].split(" "))
ref_body = f"""    <div id="rf-ar" class="clip col" data-start="0.3" data-duration="7.15" data-hold style="top:400px"><div class="ar rf-ar fit" dir="rtl" lang="ar">{words_html(P_AR[2], "", "rf-arw")}</div></div>
    <div id="rf-tr" class="clip col-n" data-start="1.4" data-duration="6.05" data-hold style="top:860px"><div class="ta rf-ta fit" lang="ta">{words_html(P_TA[2], "", "rf-taw")}</div><div id="rf-en-in" class="en rf-en" lang="en">{E(P_EN[2])}</div></div>"""
ref_css = """    #root { --scrim: .5; }
    .rf-ar { font-size: 112px; line-height: 1.8; color: #FFF3D1; text-shadow: 0 0 34px rgba(255,200,110,.6), 0 3px 16px rgba(0,0,0,.6); }
    .rf-ta { font-weight: 600; font-size: 50px; line-height: 1.55; }
    .rf-en { margin-top: 26px; font-size: 52px; line-height: 1.3; color: #FFF6E6; }"""
ref_js = f"""    for (let i = 0; i < {nar}; i++) tl.fromTo("#rf-arw-" + i, {{ opacity: 0, filter: "blur(6px)" }}, {{ opacity: 1, filter: "blur(0px)", duration: 0.35, ease: "power4.out" }}, 0.35 + i * 0.12);
    for (let i = 0; i < {nta3}; i++) tl.fromTo("#rf-taw-" + i, {{ opacity: 0, color: "#8C8A86" }}, {{ opacity: 1, color: "#FFFDF6", duration: 0.25, ease: "power2.out" }}, 1.45 + i * 0.08);
    tl.fromTo("#rf-en-in", {{ opacity: 0, filter: "blur(4px)" }}, {{ opacity: 1, filter: "blur(0px)", duration: 0.35, ease: "expo.out" }}, 2.65);
    tl.to(["#rf-ar > div", "#rf-tr > div"], {{ opacity: 0, filter: "blur(8px)", duration: 0.22, ease: "power3.in" }}, 7.2);"""
(out / "reflect.html").write_text(scene("reflect", 7.45, ref_css, ref_body, ref_js), encoding="utf-8")

# ---------- end 25.4–30 (local 0–4.6) ----------
letters = "HIDAYAH"
end_body = f"""    <div id="end-brand" class="clip col" data-start="0.2" data-duration="4.4" data-hold style="top:600px"><div class="brand">{"".join(f'<span class="w" id="end-l{i}">{c}</span>' for i, c in enumerate(letters))}</div></div>
    <div id="end-sub" class="clip col" data-start="1.1" data-duration="3.5" data-hold style="top:720px"><div id="end-sub-in" class="sub">Al-Baqarah 2:153<br>Recitation · Mishary Rashid Alafasy</div></div>"""
end_css = """    #root { --scrim: .42; }
    .brand { font: 600 76px/1 "Corm"; letter-spacing: .24em; padding-left: .26em; color: #FFF4D8; text-shadow: 0 0 30px rgba(255,200,120,.45); }
    .sub { font: 500 30px/1.5 "Corm"; letter-spacing: .06em; color: #F6EAD0; text-shadow: 0 2px 14px rgba(0,0,0,.6); }"""
end_js = f"""    for (let i = 0; i < {len(letters)}; i++) tl.fromTo("#end-l" + i, {{ opacity: 0.0, filter: "blur(3px)" }}, {{ opacity: 1, filter: "blur(0px)", duration: 0.3, ease: "power2.out" }}, 0.25 + i * 0.1);
    tl.fromTo("#end-sub-in", {{ opacity: 0, filter: "blur(6px)" }}, {{ opacity: 1, filter: "blur(0px)", duration: 0.2, ease: "power4.out" }}, 1.15);"""
(out / "end.html").write_text(scene("end", 4.6, end_css, end_body, end_js), encoding="utf-8")
print("scenes built; all phrases verified as exact substrings")
