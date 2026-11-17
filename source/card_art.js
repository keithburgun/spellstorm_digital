/* ===== Translated card art =====
   The card images have their English text baked in. For another language the game draws each card itself:
   a copy of the art with the English removed (IMG_I18N.base, made by i18n/render_cards.py base) plus the
   translated text from the dictionary (I18N.cards), set with the same inline icons. The results replace the
   card images through CSS, and the icon hotspots follow the new text. English uses the original images. */
const CARDART = (function () {
  const FONT = "Corporata,'Noto Sans CJK SC','Noto Sans JP','Hiragino Sans','PingFang SC','Microsoft YaHei',sans-serif";
  const CJK = /[⺀-鿿豈-﫿＀-￯　-〿]/;
  const NOSTART = new Set('，。、；：！？）」』”’…·%,.;:!?)»'.split(''));
  let icons = {}, ctx = null, HL = {};
  const font = (w, s) => `${w} ${s}px ${FONT}`;
  function toks(text) {
    const out = []; const hl = Object.keys(HL).sort((a, b) => b.length - a.length);
    let i = 0;
    while (i < text.length) {
      const m = /^\{[a-z]+\}/.exec(text.slice(i)); if (m) { out.push(m[0]); i += m[0].length; continue; }
      const h = hl.find(w => text.startsWith(w, i)); if (h) { out.push(h); i += h.length; continue; }
      const c = text[i];
      if (c === ' ' || CJK.test(c)) { out.push(c); i++; continue; }
      let j = i; while (j < text.length && text[j] !== ' ' && text[j] !== '{' && !CJK.test(text[j])) j++;
      out.push(text.slice(i, j)); i = j;
    }
    return out;
  }
  const tw = (t, isz) => t[0] === '{' && t.length > 2 ? isz + 2 : ctx.measureText(t).width;
  function layout(text, width, isz) {
    const rows = []; let cur = [], w = 0;
    for (const t of toks(text)) {
      const x = tw(t, isz);
      if (w + x > width && cur.length && !NOSTART.has(t[0])) {
        while (cur.length && cur[cur.length - 1] === ' ') cur.pop();
        rows.push(cur); cur = []; w = 0; if (t === ' ') continue;
      }
      cur.push(t); w += x;
    }
    if (cur.length) rows.push(cur);
    return rows;
  }
  function fit(lines, weight, width, height, smax, smin, lhk = 1.42, ik = 1.15) {
    let r;
    for (let s = smax; s >= smin; s--) {
      ctx.font = font(weight, s); const isz = Math.round(s * ik), lh = Math.round(s * lhk);
      const rows = lines.flatMap(l => layout(l, width, isz));
      r = { s, rows, lh, isz, weight };
      if (rows.length * lh <= height) return r;
    }
    return r;
  }
  function drawRows(F, x, y, color, o = {}) {
    const { rows, lh, isz } = F; ctx.font = font(F.weight, F.s); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    for (const r of rows) {
      const w = r.reduce((a, t) => a + tw(t, isz), 0);
      let cx = o.center != null ? o.center - w / 2 : x;
      for (const t of r) {
        if (t[0] === '{' && t.length > 2) {
          const k = t.slice(1, -1), ic = icons[k];
          if (ic) {
            const sc = Math.min(isz / ic.width, isz / ic.height), iw = ic.width * sc, ih = ic.height * sc, iy = y + (lh - ih) / 2 - lh * .06;
            ctx.drawImage(ic, cx + (isz - iw) / 2, iy, iw, ih);
            if (o.spots) o.spots.push([cx, iy, isz, ih, k]);
          }
          cx += isz + 2;
        } else {
          const ym = y + lh / 2;
          if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.stroke * 2; ctx.strokeStyle = o.scol; ctx.strokeText(t, cx, ym); }
          ctx.fillStyle = HL[t] || color; ctx.fillText(t, cx, ym);
          cx += ctx.measureText(t).width;
        }
      }
      y += lh;
    }
    return y;
  }
  function title(txt, cx, cy, maxw, size, col, o = {}) {
    if (!txt) return;
    let s = size; const w = o.weight || 900;
    ctx.font = font(w, s); while (ctx.measureText(txt).width > maxw && s > 10) { s--; ctx.font = font(w, s); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.stroke * 2; ctx.strokeStyle = o.scol || '#2a1a1a'; ctx.strokeText(txt, cx, cy); }
    ctx.fillStyle = col; ctx.fillText(txt, cx, cy);
  }
  const U = (s, C) => C._upper ? s.toLocaleUpperCase() : s;
  // the five layouts, matching the printed cards
  const KIND = {
    p(T, L, C, sp) {   // portrait spell / special card
      const sub = (C._subs || {})[L.sub] || L.sub;
      if (L.wiz) { title(sub, 240, 41, 300, 19, '#fff', { weight: 700, stroke: 2 }); title(U(T.title, C), 240, 80, 280, 40, '#fff', { stroke: 3 }); }
      else { title(sub, 240, 47, 260, 19, '#fff', { weight: 700, stroke: 2 }); title(U(T.title, C), 240, 84, 280, 42, '#fff', { stroke: 3 }); }
      const F = fit(T.text || [], 700, 384, 592 - L.y0, 25, 14); drawRows(F, 48, L.y0, '#1d1d1b', { spots: sp });
      if (T.flavor) { const G = fit([T.flavor], 400, 335, 660 - L.fy, 13, 9, 1.35); drawRows(G, 53, L.fy, '#46463f'); }
    },
    r(T, L, C, sp) {   // Robot Boy
      title(U(T.title, C), 240, 58, 330, 44, '#4e348c');
      title(T.sub, 240, 106, 330, 22, '#141414', { weight: 700 });
      const lines = T.text || [], F = fit(lines.map(l => l.replace(/^~/, '')), 700, 340, 134, 22, 12);
      let y = 146 + Math.max(0, (134 - F.rows.length * F.lh) / 2);
      for (const l of lines) { const rows = (ctx.font = font(700, F.s), layout(l.replace(/^~/, ''), 340, F.isz)); y = drawRows({ ...F, rows }, 0, y, l[0] === '~' ? '#648cc8' : '#141414', { center: 242, spots: sp }); }
      if (T.bubble && L.bub) {
        const [x0, y0, x1, y1] = L.bub, bw = x1 - x0;
        const G = fit([T.bubble], 700, bw * .62, (y1 - y0) * .7, 20, 10);
        drawRows(G, 0, (y0 + y1) / 2 - G.rows.length * G.lh / 2, '#4e348c', { center: x0 + bw * .45 });
      }
    },
    t(T, L, C, sp) {   // Omar's traps
      const lab = C._labels || {};
      title(T.title, 240, 62, 320, 46, '#fff', { stroke: 3, scol: '#1e1e1e' });
      title(lab['TRIGGER:'] || 'TRIGGER:', 240, 122, 300, 19, '#f5788c', { weight: 700 });
      let F = fit([T.trigger], 700, 380, 56, 19, 11); drawRows(F, 0, 134 + Math.max(0, (54 - F.rows.length * F.lh) / 2), '#f5788c', { center: 240, spots: sp });
      title(lab['EFFECT:'] || 'EFFECT:', 240, 228, 300, 19, '#141414', { weight: 700 });
      F = fit(T.text || [], 700, 380, 56, 19, 11); drawRows(F, 0, 240 + Math.max(0, (54 - F.rows.length * F.lh) / 2), '#141414', { center: 240, spots: sp });
      title(T.after, 240, 316, 400, 13, '#141414', { weight: 500 });
      const G = fit([T.flavor], 400, 250, 52, 12, 8, 1.3); drawRows(G, 0, 632 - G.rows.length * G.lh / 2, '#282828', { center: 245 });
    },
    w(T, L, C, sp) {   // weather
      title(C._weather || 'WEATHER', 336, 36, 200, 18, '#fff', { weight: 700, stroke: 2, scol: '#143232' });
      title(U(T.title, C), 336, 82, 500, 50, '#fff', { stroke: 3, scol: '#143232' });
      const F = fit(T.text || [], 900, 300, 300, 35, 15, 1.42, 1.25);
      drawRows(F, 0, 300 - F.rows.length * F.lh / 2, '#fff', { center: 490, stroke: 3, scol: '#143232', spots: sp });
    },
    o(T, L, C, sp) {   // Oren's potions
      title(T.title, 210, 52, 380, 34, '#191919');
      const F = fit(T.text || [], 900, 290, 220, 26, 13); drawRows(F, 100, L.mid - F.rows.length * F.lh / 2, '#fff', { stroke: 3, scol: '#281e14', spots: sp });
      if (L.tox && C._toxic) {
        title(C._toxic.TOXIC, 210, 518, 200, 36, '#c8e628', { stroke: 3, scol: '#0a0a0a' });
        const G = fit([C._toxic.note], 500, 380, 40, 13, 9, 1.3); drawRows(G, 0, 552, '#141414', { center: 210 });
      }
    },
  };
  const loadImg = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
  async function render(lang) {
    const B = (typeof IMG_I18N !== 'undefined' && IMG_I18N.base) || null, C = I18N.cards();
    if (!B || !C) return;
    HL = C._hl || {};
    for (const [k, v] of Object.entries(B.icons || {})) icons[k] = await loadImg(v);
    try { await Promise.all([document.fonts.load(font(400, 20) , 'Aa' + (C.dart && C.dart.title || '')), document.fonts.load(font(900, 20), 'Aa')]); } catch (e) { }
    const sheet = document.createElement('style'); document.head.appendChild(sheet);
    const cv = document.createElement('canvas'); ctx = cv.getContext('2d');
    const keys = Object.keys(B.img).filter(k => C[k]);
    for (const k of keys) {
      const im = await loadImg(B.img[k]); if (!im) continue;
      cv.width = im.width; cv.height = im.height; ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(im, 0, 0);
      const spots = [], L = B.lay[k];
      try { KIND[L.k](C[k], L, C, spots); } catch (e) { console.error('card art', k, e); continue; }
      const url = await new Promise(r => cv.toBlob(b => r(b ? URL.createObjectURL(b) : cv.toDataURL()), 'image/webp', .9));
      const sel = k.endsWith('_2e') ? `html.lang-${lang} body.ed2 .ci-${k.slice(0, -3)}` : `html.lang-${lang} .ci-${k}`;
      sheet.textContent += `${sel}{background-image:url(${url})}\n`;
      if (typeof ICONDATA !== 'undefined') ICONDATA.spots[k] = spots.map(([x, y, w, h, n]) => [+(x / cv.width * 100).toFixed(1), +(y / cv.height * 100).toFixed(1), +(w / cv.width * 100).toFixed(1), +(h / cv.height * 100).toFixed(1), n]);
      await new Promise(r => setTimeout(r, 0));   // keep the page responsive
    }
  }
  return { render };
})();
