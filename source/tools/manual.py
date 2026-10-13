#!/usr/bin/env python3
"""Turn the rulebook PDF into the in-game Manual: one compressed WebP per page, written to source/manual.json.
    python3 tools/manual.py path/to/Spellstorm_Rulebook.pdf      (needs pdftoppm and Pillow)
900 px wide at WebP quality 50 keeps the small print sharp on phones and the Steam Deck at about 80 KB a page."""
import base64, glob, io, json, os, subprocess, sys, tempfile
from PIL import Image
W, Q = 900, 50
pdf = sys.argv[1]; here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
with tempfile.TemporaryDirectory() as d:
    subprocess.run(['pdftoppm', '-r', '150', '-png', pdf, os.path.join(d, 'p')], check=True)
    pages = []
    for f in sorted(glob.glob(os.path.join(d, 'p-*.png'))):
        im = Image.open(f).convert('RGB'); im = im.resize((W, round(im.height * W / im.width)), Image.LANCZOS)
        b = io.BytesIO(); im.save(b, 'WEBP', quality=Q, method=6)
        pages.append('data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode())
json.dump(pages, open(os.path.join(here, 'manual.json'), 'w'))
print(f'{len(pages)} pages, {sum(len(p) for p in pages)/1e6:.2f} MB embedded')
