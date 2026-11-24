"""Glyph-coverage QC (approach ported from Viprasol video-studio-core qc.py, MIT):
every character of every on-screen string must exist in the font that renders it.
Usage: python3 -I glyph_coverage.py <json [{"id","font","text"}]>  → prints JSON report."""
import json, sys, unicodedata
from fontTools.ttLib import TTFont
items = json.loads(open(sys.argv[1], encoding="utf-8").read())
cache, out = {}, []
for it in items:
    fonts = it["font"] if isinstance(it["font"], list) else [it["font"]]
    key = "|".join(fonts)
    if key not in cache:
        cmap = {}
        for path in fonts: cmap.update(TTFont(path, lazy=True).getBestCmap())
        cache[key] = cmap
    f = cache[key]
    missing = sorted({c for c in it["text"] if not c.isspace() and ord(c) not in f and unicodedata.category(c) not in ("Cf",)})
    out.append({"id": it["id"], "font": "+".join(x.split("/")[-1] for x in fonts), "missing": [f"U+{ord(c):04X} {unicodedata.name(c, '?')}" for c in missing]})
print(json.dumps(out, ensure_ascii=False))
