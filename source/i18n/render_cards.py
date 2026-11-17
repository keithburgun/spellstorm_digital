"""Render translated card images.
The card art has its English text baked in. This removes that text (flat backgrounds are refilled row by row,
text over artwork is inpainted) and typesets the translation with the same inline icons.

usage: python3 render_cards.py zh [key ...]      -> writes imgs_zh.json (+ spots) next to imgs.json
       python3 render_cards.py zh --png DIR key  -> also saves PNGs for checking
Needs: Pillow, numpy, opencv-python, scipy, and the Noto Sans CJK fonts (fonts-noto-cjk)."""
import base64, io, json, os, re, sys
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.dirname(HERE)
FONTDIR = '/usr/share/fonts/opentype/noto/'
def font(w, size): return ImageFont.truetype(FONTDIR + f'NotoSansCJK-{w}.ttc', size, index=2)  # index 2 = SC

def b64img(s): return Image.open(io.BytesIO(base64.b64decode(s.split(',', 1)[1]))).convert('RGBA')
IMGS = json.load(open(os.path.join(SRC, 'imgs.json')))
TPL = open(os.path.join(SRC, 'template.html'), encoding='utf-8').read()
ICONDATA = json.loads(re.search(r'const ICONDATA=(\{.*?\});\n', TPL, re.S).group(1))
PICS = {k: b64img(v) for k, v in ICONDATA['pics'].items()}
def _blast():  # the plain gold octagon on Robot Boy's cards, cut from one of them
    ic = b64img(IMGS['rb_iceblock']).crop((147, 155, 183, 191))
    a = np.asarray(ic).copy(); f = a[..., :3].astype(float); L = f[..., 0] * .299 + f[..., 1] * .587 + f[..., 2] * .114
    a[..., 3] = np.clip((236 - L) * 12, 0, 255).astype(np.uint8)
    return Image.fromarray(a, 'RGBA')
PICS['blast'] = _blast()
def _keyed(im):
    """The icon crops sit on the cream card panel: make that background transparent (flood-filled from the edges)."""
    a = np.asarray(im.convert('RGBA')).copy(); rgb = a[..., :3].astype(int)
    ref = np.median(np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]]), axis=0)
    near = np.abs(rgb - ref).max(axis=2) < 34
    lab, n = ndimage.label(near)
    edge = set(lab[0]) | set(lab[-1]) | set(lab[:, 0]) | set(lab[:, -1]); edge.discard(0)
    bg = np.isin(lab, list(edge))
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    alpha = np.asarray(Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(.6)))
    a[..., 3] = np.minimum(a[..., 3], alpha)
    return Image.fromarray(a, 'RGBA')
# the stored Initiative crop shows only the top half of the bolt: cut a whole one from Magic Dart
PICS['init'] = b64img(IMGS['dart']).crop((219, 469, 244, 505))
for _k in list(PICS):
    if _k != 'blast': PICS[_k] = _keyed(PICS[_k])

# ---------- helpers ----------
def lum(a): return a[..., 0] * .299 + a[..., 1] * .587 + a[..., 2] * .114
def rowfill(img, x0, x1, y0, y1, thr=45, dil=2, bgx=None, keep=None):
    """Flat background: each row's colour is the median of the row (or of the bgx columns); pixels far from it are text."""
    a = np.asarray(img).astype(np.int16).copy()
    reg = a[y0:y1, x0:x1, :3]
    if bgx == 'light':   # light panel with dark/coloured text: the row's light pixels are the background
        L = lum(reg.astype(float)); bg = np.array([np.median(reg[i][L[i] > 205], axis=0) if (L[i] > 205).sum() > 8 else np.median(reg[i], axis=0) for i in range(len(reg))])
    elif bgx: bg = np.median(a[y0:y1, bgx[0]:bgx[1], :3], axis=1)
    else: bg = np.median(reg, axis=1)
    m = (np.abs(reg - bg[:, None, :]).max(axis=2) > thr)
    if keep is not None: m &= ~keep[y0:y1, x0:x1]
    m = ndimage.binary_dilation(m, iterations=dil)
    if keep is not None: m &= ~keep[y0:y1, x0:x1]
    reg[m] = np.broadcast_to(bg[:, None, :], reg.shape)[m]
    a[y0:y1, x0:x1, :3] = reg
    rows = np.where(m.any(axis=1))[0]
    return Image.fromarray(a.astype(np.uint8), 'RGBA'), (y0 + rows.min(), y0 + rows.max()) if len(rows) else None

def inpaint(img, x0, x1, y0, y1, mode='light', thr=None, dil=4, rad=6, keep=None):
    """Text over artwork: mask the text (bright, dark, or anything that stands out from a blurred copy) and inpaint."""
    a = np.asarray(img).copy()
    rgb = np.ascontiguousarray(a[..., :3])
    reg = rgb[y0:y1, x0:x1].astype(np.int16)
    L = lum(reg)
    if mode == 'light': m = (L > (thr or 175)) & ((reg.max(2) - reg.min(2)) < 70)
    elif mode == 'dark': m = L < (thr or 80)
    elif mode == 'teal':
        hsv = cv2.cvtColor(np.ascontiguousarray(rgb[y0:y1, x0:x1]), cv2.COLOR_RGB2HSV).astype(np.int16)
        m = ~((hsv[..., 0] >= 62) & (hsv[..., 0] <= 95) & (hsv[..., 1] > 30)) | (L > 175)
    else:
        bl = cv2.medianBlur(rgb[y0:y1, x0:x1], 31).astype(np.int16)
        m = np.abs(reg - bl).max(axis=2) > (thr or 45)
    if keep is not None: m &= ~keep[y0:y1, x0:x1]
    m = ndimage.binary_dilation(m, iterations=dil)
    if keep is not None: m &= ~keep[y0:y1, x0:x1]
    full = np.zeros(rgb.shape[:2], np.uint8); full[y0:y1, x0:x1] = m * 255
    out = cv2.inpaint(cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), full, rad, cv2.INPAINT_TELEA)
    a[..., :3] = cv2.cvtColor(out, cv2.COLOR_BGR2RGB)
    rows = np.where(m.any(axis=1))[0]
    return Image.fromarray(a, 'RGBA'), (y0 + rows.min(), y0 + rows.max()) if len(rows) else None

HL = {'风暴碎片': (232, 48, 74), '末日标记': (170, 30, 180), '能量标记': (240, 160, 30)}
TOK = re.compile(r'(\{[a-z]+\}|' + '|'.join(HL) + r'|[A-Za-z0-9+\-−/.!#%&$Ω"“”]+|.)')

def layout(text, f, width, isz):
    """Break a line into rows: Chinese breaks anywhere (but never before closing punctuation), Latin words stay whole."""
    toks = TOK.findall(text)
    rows, cur, w = [], [], 0
    def tw(t): return isz + 2 if t.startswith('{') else f.getlength(t)
    NOSTART = set('，。、；：！？）」』”’…·%')
    for t in toks:
        x = tw(t)
        if w + x > width and cur and not (t in NOSTART):
            rows.append(cur); cur, w = [], 0
            if t == ' ': continue
        cur.append(t); w += x
    if cur: rows.append(cur)
    return rows

def draw_rows(img, rows, f, x, y, lh, isz, color, center=None, stroke=0, scol=None, spots=None):
    d = ImageDraw.Draw(img)
    asc = f.getmetrics()[0]
    for r in rows:
        tw = sum((isz + 2) if t.startswith('{') else f.getlength(t) for t in r)
        cx = (center - tw / 2) if center is not None else x
        for t in r:
            if t.startswith('{'):
                k = t[1:-1]; p = PICS.get(k)
                if p:
                    ic = p.copy(); ic.thumbnail((isz, isz), Image.LANCZOS)
                    iy = int(y + (lh - ic.height) / 2 - lh * .08)
                    img.alpha_composite(ic, (int(cx + (isz - ic.width) / 2), iy))
                    if spots is not None: spots.append([cx, iy, isz, ic.height, k])
                cx += isz + 2
            else:
                col = HL.get(t, color)
                d.text((cx, y + (lh - asc) / 2 - lh * .05), t, font=f, fill=col, stroke_width=stroke, stroke_fill=scol)
                cx += f.getlength(t)
        y += lh
    return y

def fit(lines, wname, width, height, smax, smin, lhk=1.42, ik=1.15):
    for s in range(smax, smin - 1, -1):
        f = font(wname, s); isz = int(s * ik); lh = int(s * lhk)
        rows = [r for ln in lines for r in layout(ln, f, width, isz)]
        if len(rows) * lh <= height: return f, rows, lh, isz
    return f, rows, lh, isz

def title_text(img, txt, cx, cy, maxw, size, col=(255, 255, 255), scol=(40, 20, 20), stroke=3, w='Black'):
    s = size
    while font(w, s).getlength(txt) > maxw and s > 12: s -= 1
    f = font(w, s); d = ImageDraw.Draw(img)
    d.text((cx, cy), txt, font=f, fill=col, anchor='mm', stroke_width=stroke, stroke_fill=scol)

def keepmask(shape, boxes):
    k = np.zeros(shape, bool)
    for x0, y0, x1, y1 in boxes: k[y0:y1, x0:x1] = True
    return k

# ---------- card kinds ----------
def portrait(key, im, T, subs):
    W, H = im.size  # 480 x 672
    a = np.asarray(im)
    wizard = 'Wizard' in (T['_en'].get('sub') or '')
    keep = keepmask((H, W), [(392, 575, 470, 662), (400, 595, 452, 650), (6, 632, 46, 664), (20, 20, 88, 88), (392, 18, 460, 80)])
    # title band
    im, _ = inpaint(im, 86, 394, 22, 112, 'light', thr=165, dil=4, rad=7, keep=keep)
    sub = subs.get(T['_en'].get('sub', ''), T['_en'].get('sub', ''))
    if wizard:
        title_text(im, sub, 240, 41, 300, 19, stroke=2, w='Bold'); title_text(im, T['title'], 240, 80, 300, 40)
    else:
        title_text(im, sub, 240, 47, 260, 19, stroke=2, w='Bold'); title_text(im, T['title'], 240, 84, 300, 42)
    # text box: find where the flat panel starts (left margin matches the bottom colour)
    a = np.asarray(im).astype(np.int16)
    BX = (27, 43)
    ref = np.median(a[560:600, BX[0]:BX[1], :3].reshape(-1, 3), axis=0)
    ytop = 380
    for y in range(380, 560):
        if (np.abs(a[y, 27:466, :3] - ref).max(axis=1) < 22).mean() > .8: ytop = y; break
    im, mr = rowfill(im, 26, 466, ytop, 600, thr=48, bgx=BX, keep=keep)
    im, fr = rowfill(im, 50, 395, 598, 662, thr=40, bgx=(44, 52), keep=keep)
    spots = []
    y0 = (mr[0] if mr else ytop + 20) - 2
    bot = 592
    col = (29, 29, 27)
    f, rows, lh, isz = fit(T.get('text', []), 'Bold', 384, bot - y0, 25, 15)
    draw_rows(im, rows, f, 48, y0, lh, isz, col, spots=spots)
    if T.get('flavor'):
        fy = fr[0] - 2 if fr else 604
        ff, frows, flh, _ = fit([T['flavor']], 'Regular', 335, 660 - fy, 13, 10, lhk=1.35)
        draw_rows(im, frows, ff, 53, fy, flh, 14, (70, 70, 66))
    return im, spots

def robot(key, im, T, subs):
    W, H = im.size
    a = np.asarray(im)
    im, _ = rowfill(im, 60, 420, 28, 124, thr=50, dil=2, bgx=(64, 94))
    title_text(im, T['title'], 240, 58, 330, 44, col=(78, 52, 140), scol=(78, 52, 140), stroke=0)
    title_text(im, T['sub'], 240, 106, 330, 22, col=(20, 20, 20), stroke=0, w='Bold')
    im, mr = rowfill(im, 62, 422, 140, 282, thr=50, dil=2, bgx='light')
    spots = []
    lines = T.get('text', [])
    f, rows0, lh, isz = fit([l.lstrip('~') for l in lines], 'Bold', 340, 280 - 146, 22, 13)
    y = 146 + max(0, (134 - len(rows0) * lh) // 2)
    for ln in lines:
        blue = ln.startswith('~'); ln = ln.lstrip('~')
        rows = layout(ln, f, 340, isz)
        y = draw_rows(im, rows, f, 0, y, lh, isz, (100, 140, 200) if blue else (20, 20, 20), center=242, spots=spots)
    if T.get('bubble'):
        a = np.asarray(im).astype(np.int16)
        L = lum(a[..., :3]); Wm = L > 228
        reg = np.zeros_like(Wm); reg[440:665, 20:280] = True
        lab, n = ndimage.label(Wm & reg)
        if n:
            big = 1 + int(np.argmax(ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))))
            fill = ndimage.binary_fill_holes(lab == big)
            inner = ndimage.binary_erosion(fill, iterations=5)
            txt = inner & ~Wm
            txt = ndimage.binary_dilation(txt, iterations=2) & inner
            b = np.asarray(im).copy(); b[txt, :3] = 255; im = Image.fromarray(b, 'RGBA')
            ys, xs = np.where(inner)
            cy = (ys.min() + ys.max()) / 2; cx = (xs.min() + xs.max()) / 2
            # the bubble's tail points right: its text sits in the left part
            bw = xs.max() - xs.min()
            f2, rows, lh2, _ = fit([T['bubble']], 'Bold', int(bw * .62), int((ys.max() - ys.min()) * .7), 20, 11)
            yy = cy - len(rows) * lh2 / 2
            draw_rows(im, rows, f2, 0, yy, lh2, 20, (78, 52, 140), center=xs.min() + bw * .45)
    return im, spots

def trap(key, im, T, subs):
    im, _ = inpaint(im, 60, 420, 25, 98, 'light', thr=200, dil=4, rad=7)
    title_text(im, T['title'], 240, 62, 320, 46, scol=(30, 30, 30), stroke=3)
    im, _ = rowfill(im, 40, 440, 104, 192, thr=40, dil=2, bgx=(30, 48))
    im, _ = rowfill(im, 40, 440, 210, 296, thr=40, dil=2, bgx=(30, 48))
    im, _ = inpaint(im, 60, 420, 300, 330, 'dark', thr=70, dil=2, rad=4)
    spots = []
    pink = (245, 120, 140)
    lab = T['_labels']
    f, rows, lh, isz = fit([T['trigger']], 'Bold', 380, 60, 19, 12)
    title_text(im, lab['TRIGGER:'], 240, 122, 300, 19, col=pink, stroke=0, w='Bold')
    draw_rows(im, rows, f, 0, 134 + max(0, (54 - len(rows) * lh) // 2), lh, isz, pink, center=240, spots=spots)
    title_text(im, lab['EFFECT:'], 240, 228, 300, 19, col=(20, 20, 20), stroke=0, w='Bold')
    f, rows, lh, isz = fit(T['text'], 'Bold', 380, 56, 19, 12)
    draw_rows(im, rows, f, 0, 240 + max(0, (54 - len(rows) * lh) // 2), lh, isz, (20, 20, 20), center=240, spots=spots)
    title_text(im, T['after'], 240, 316, 400, 13, col=(20, 20, 20), stroke=0, w='Medium')
    # flavour on the arrow banner at the bottom
    im, fr = inpaint(im, 120, 372, 604, 660, 'dark', thr=125, dil=3, rad=5)
    ff, frows, flh, _ = fit([T['flavor']], 'Regular', 250, 52, 12, 9, lhk=1.3)
    draw_rows(im, frows, ff, 0, 632 - len(frows) * flh / 2, flh, 12, (40, 40, 40), center=245)
    return im, spots

def weather(key, im, T, subs):
    W, H = im.size  # 672 x 480
    im, _ = inpaint(im, 120, 560, 20, 118, 'light', thr=170, dil=4, rad=8)
    title_text(im, '天气', 336, 36, 200, 18, stroke=2, w='Bold', scol=(20, 50, 50))
    title_text(im, T['title'], 336, 82, 500, 50, scol=(20, 50, 50))
    im, _ = inpaint(im, 330, 668, 110, 470, 'teal', dil=6, rad=9)
    im, _ = inpaint(im, 330, 668, 110, 470, 'any', thr=38, dil=5, rad=9)
    spots = []
    f, rows, lh, isz = fit(T['text'], 'Black', 300, 300, 35, 16, ik=1.25)
    y = 300 - len(rows) * lh / 2
    draw_rows(im, rows, f, 0, y, lh, isz, (255, 255, 255), center=490, stroke=3, scol=(20, 50, 50), spots=spots)
    return im, spots

def potion(key, im, T, subs, toxic):
    W, H = im.size  # 420 x 608
    im, _ = inpaint(im, 8, 414, 12, 108, 'any', thr=32, dil=4, rad=8)
    title_text(im, T['title'], 210, 52, 380, 34, col=(25, 25, 25), stroke=0)
    keep = keepmask((H, W), [(15, 200, 95, 330)])
    im, mr = inpaint(im, 92, 412, 150, 420, 'any', thr=50, dil=5, rad=7, keep=keep)
    im, _ = inpaint(im, 92, 412, 150, 420, 'any', thr=30, dil=4, rad=7, keep=keep)
    spots = []
    f, rows, lh, isz = fit(T['text'], 'Black', 290, 220, 26, 14)
    y = (mr[0] + mr[1]) / 2 - len(rows) * lh / 2 if mr else 220
    draw_rows(im, rows, f, 100, y, lh, isz, (255, 255, 255), stroke=3, scol=(40, 30, 20), spots=spots)
    if toxic:
        im, _ = inpaint(im, 20, 400, 488, 600, 'any', thr=45, dil=3, rad=7, keep=keepmask((H, W), [(170, 420, 250, 492)]))
        title_text(im, toxic['TOXIC'], 210, 518, 200, 36, col=(200, 230, 40), scol=(10, 10, 10), stroke=3)
        ff, frows, flh, _ = fit([toxic['note']], 'Medium', 380, 40, 13, 10, lhk=1.3)
        draw_rows(im, frows, ff, 0, 552, flh, 12, (20, 20, 20), center=210)
    return im, spots

def render(lang, key):
    L = json.load(open(os.path.join(HERE, f'cards_{lang}.json'), encoding='utf-8'))
    E = json.load(open(os.path.join(HERE, 'cards_en.json'), encoding='utf-8'))
    T = dict(L[key]); T['_en'] = E[key]; T['_labels'] = L.get('_labels', {})
    im = b64img(IMGS[key])
    subs = L.get('_subs', {})
    if key.startswith('rb_'): out, spots = robot(key, im, T, subs)
    elif key.startswith('trap_'): out, spots = trap(key, im, T, subs)
    elif key.startswith('w_'): out, spots = weather(key, im, T, subs)
    elif key.startswith('pot_'): out, spots = potion(key, im, T, subs, L['_toxic'] if E[key].get('toxic') else None)
    else: out, spots = portrait(key, im, T, subs)
    W, H = out.size
    spots = [[round(x / W * 100, 1), round(y / H * 100, 1), round(w / W * 100, 1), round(h / H * 100, 1), k] for x, y, w, h, k in spots]
    return out, spots

# ---------- language-free base images: the art with the English removed, plus where the text goes ----------
# The game typesets each language onto these at runtime (cardArt in template.html), so one set of images serves
# every language.
def clean(key):
    E = json.load(open(os.path.join(HERE, 'cards_en.json'), encoding='utf-8'))[key]
    im = b64img(IMGS[key]); W, H = im.size
    if key.startswith('rb_'):
        im, _ = rowfill(im, 60, 420, 28, 124, thr=50, dil=2, bgx=(64, 94))
        im, _ = rowfill(im, 62, 422, 140, 282, thr=50, dil=2, bgx='light')
        lay = {'k': 'r'}
        if E.get('bubble'):
            a = np.asarray(im).astype(np.int16); L = lum(a[..., :3]); Wm = L > 228
            reg = np.zeros_like(Wm); reg[440:665, 20:280] = True
            lab, n = ndimage.label(Wm & reg)
            if n:
                big = 1 + int(np.argmax(ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))))
                fill = ndimage.binary_fill_holes(lab == big); inner = ndimage.binary_erosion(fill, iterations=5)
                txt = ndimage.binary_dilation(inner & ~Wm, iterations=2) & inner
                b = np.asarray(im).copy(); b[txt, :3] = 255; im = Image.fromarray(b, 'RGBA')
                ys, xs = np.where(inner)
                lay['bub'] = [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]
        return im, lay
    if key.startswith('trap_'):
        im, _ = inpaint(im, 60, 420, 25, 98, 'light', thr=200, dil=4, rad=7)
        im, _ = rowfill(im, 40, 440, 104, 192, thr=40, dil=2, bgx=(30, 48))
        im, _ = rowfill(im, 40, 440, 210, 296, thr=40, dil=2, bgx=(30, 48))
        im, _ = inpaint(im, 60, 420, 300, 330, 'dark', thr=70, dil=2, rad=4)
        im, _ = inpaint(im, 120, 372, 604, 660, 'dark', thr=125, dil=3, rad=5)
        return im, {'k': 't'}
    if key.startswith('w_'):
        im, _ = inpaint(im, 120, 560, 20, 118, 'light', thr=170, dil=4, rad=8)
        im, _ = inpaint(im, 330, 668, 110, 470, 'teal', dil=6, rad=9)
        im, _ = inpaint(im, 330, 668, 110, 470, 'any', thr=38, dil=5, rad=9)
        return im, {'k': 'w'}
    if key.startswith('pot_'):
        im, _ = inpaint(im, 8, 414, 12, 108, 'any', thr=32, dil=4, rad=8)
        keep = keepmask((H, W), [(15, 200, 95, 330)])
        im, mr = inpaint(im, 92, 412, 150, 420, 'any', thr=50, dil=5, rad=7, keep=keep)
        im, _ = inpaint(im, 92, 412, 150, 420, 'any', thr=30, dil=4, rad=7, keep=keep)
        lay = {'k': 'o', 'mid': int((mr[0] + mr[1]) / 2) if mr else 230}
        if E.get('toxic'):
            im, _ = inpaint(im, 20, 400, 488, 600, 'any', thr=45, dil=3, rad=7, keep=keepmask((H, W), [(170, 420, 250, 492)]))
            lay['tox'] = 1
        return im, lay
    keep = keepmask((H, W), [(392, 575, 470, 662), (400, 595, 452, 650), (6, 632, 46, 664), (20, 20, 88, 88), (392, 18, 460, 80)])
    im, _ = inpaint(im, 86, 394, 22, 112, 'light', thr=165, dil=4, rad=7, keep=keep)
    a = np.asarray(im).astype(np.int16); BX = (27, 43)
    ref = np.median(a[560:600, BX[0]:BX[1], :3].reshape(-1, 3), axis=0); ytop = 380
    for y in range(380, 560):
        if (np.abs(a[y, 27:466, :3] - ref).max(axis=1) < 22).mean() > .8: ytop = y; break
    im, mr = rowfill(im, 26, 466, ytop, 600, thr=48, bgx=BX, keep=keep)
    im, fr = rowfill(im, 50, 395, 598, 662, thr=40, bgx=(44, 52), keep=keep)
    return im, {'k': 'p', 'wiz': int('Wizard' in (E.get('sub') or '')), 'y0': int((mr[0] if mr else ytop + 20) - 2), 'fy': int(fr[0] - 2 if fr else 604), 'sub': E.get('sub', '')}

def build_base(keys=None):
    E = json.load(open(os.path.join(HERE, 'cards_en.json'), encoding='utf-8'))
    keys = keys or [k for k in E if not k.startswith('_')]
    outp = os.path.join(SRC, 'imgs_base.json')
    res = json.load(open(outp)) if os.path.exists(outp) else {'img': {}, 'lay': {}}
    for k in keys:
        im, lay = clean(k)
        b = io.BytesIO(); im.convert('RGB').save(b, 'WEBP', quality=72, method=6)
        res['img'][k] = 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode(); res['lay'][k] = lay
        print(k, len(b.getvalue()) // 1024, 'KB', flush=True)
    # the icons the text uses (Initiative re-cut whole, cream background keyed out)
    res['icons'] = {}
    for k, im in PICS.items():
        b = io.BytesIO(); im.save(b, 'PNG'); res['icons'][k] = 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
    json.dump(res, open(outp, 'w'), separators=(',', ':'))

if __name__ == '__main__' and sys.argv[1] == 'base':
    build_base(sys.argv[2:] or None); sys.exit()
if __name__ == '__main__':
    lang = sys.argv[1]; args = sys.argv[2:]
    png = None
    if '--png' in args: i = args.index('--png'); png = args[i + 1]; del args[i:i + 2]
    L = json.load(open(os.path.join(HERE, f'cards_{lang}.json'), encoding='utf-8'))
    keys = args or [k for k in L if not k.startswith('_')]
    outp = os.path.join(SRC, f'imgs_{lang}.json')
    res = json.load(open(outp)) if os.path.exists(outp) else {'img': {}, 'spots': {}}
    for k in keys:
        im, spots = render(lang, k)
        if png: os.makedirs(png, exist_ok=True); im.save(os.path.join(png, k + '.png'))
        b = io.BytesIO(); im.save(b, 'WEBP', quality=70, method=6)
        res['img'][k] = 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()
        res['spots'][k] = spots
        print(k, len(b.getvalue()) // 1024, 'KB', flush=True)
    json.dump(res, open(outp, 'w'), separators=(',', ':'))
