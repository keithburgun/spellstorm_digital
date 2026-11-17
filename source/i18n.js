/* ===== Spellstorm translations =====
   The game is written in English. For another language this layer translates what is on screen, as it appears:
   - whole elements whose inner HTML matches an entry (keeps sentences with <b> etc. in one piece),
   - single text nodes (exact match, or a pattern with numbers / card names / wizard names in it),
   - the title, aria-label, placeholder and alt attributes.
   English costs nothing: nothing runs. Dictionaries live in i18n/<lang>.json and are built into the page.
   Collect mode (window.I18N_COLLECT = true before load) records every English string seen, for building dictionaries. */
const I18N = (function () {
  const LANGS = { en: 'English', zh: '简体中文' };
  const DICTS = /*I18N_DICTS*/{};
  let lang = 'en', D = null, pats = [], names = null, nameRe = null, obs = null, busy = false;
  const seen = window.I18N_COLLECT ? { t: new Map(), h: new Map(), a: new Map() } : null;
  const INLINE = new Set(['B', 'I', 'EM', 'STRONG', 'BR', 'SPAN', 'SMALL', 'U', 'KBD', 'CODE', 'SUP', 'SUB']);
  const ATTRS = ['title', 'aria-label', 'placeholder', 'alt'];
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'svg', 'SVG']);
  const norm = s => s.replace(/\s+/g, ' ').trim();
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  /* Names (cards, wizards, weather, elements…) can appear inside sentences: "{c}" in a pattern matches any of them and
     the matched name is translated too. Digits are "{0}", "{1}"…; any other run of text is "{s}" (left as is). */
  function compile() {
    names = D.names || {};
    const keys = Object.keys(names).sort((a, b) => b.length - a.length).map(esc);
    nameRe = keys.length ? '(' + keys.join('|') + ')' : '(\\S+)';
    pats = (D.p || []).map(([src, out]) => {
      const order = [];
      const re = src.split(/(\{\d\}|\{c\d?\}|\{s\d?\})/).map(part => {
        if (/^\{\d\}$/.test(part)) { order.push(part); return '(-?\\d+(?:\\.\\d+)?)'; }
        if (/^\{c\d?\}$/.test(part)) { order.push(part); return nameRe; }
        if (/^\{s\d?\}$/.test(part)) { order.push(part); return '(.+?)'; }
        return esc(part);
      }).join('');
      return { re: new RegExp('^' + re + '$'), order, out };
    });
  }
  function tName(s) { return (names && names[s]) || (D && D.t && D.t[s]) || s; }
  const cache = new Map();
  function tText(s) {
    const k = norm(s); if (!k) return null;
    if (cache.has(k)) return cache.get(k);
    const r = tText0(k); if (cache.size > 20000) cache.clear(); cache.set(k, r); return r;
  }
  function tText0(k) {
    if (D.t[k] !== undefined) return D.t[k];
    if (names[k] !== undefined) return names[k];
    for (const p of pats) {
      const m = p.re.exec(k); if (!m) continue;
      let out = p.out;
      p.order.forEach((ph, i) => { const v = m[i + 1]; out = out.split(ph).join(ph[1] === 'c' ? tName(v) : ph[1] === 's' ? (tText(v) || v) : v); });
      return out;
    }
    // a sentence with a full stop the dictionary has without one ("no change.")
    if (/[.!]$/.test(k) && k.length > 2) { const r = tText(k.slice(0, -1)); if (r !== null) return r + (k.endsWith('!') ? '！' : '。'); }
    // lists (e.g. a round summary "Derby: +1 Mana, +2 Power; Eve: took 2 damage"): translate the parts
    for (const [sep, to] of [['; ', '；'], [', ', '，']]) {
      if (!k.includes(sep)) continue;
      const parts = k.split(sep).map(x => tText(x));
      if (parts.every(x => x !== null)) return parts.join(to);
    }
    return null;
  }
  function collectText(k, where) { if (!seen || !/[A-Za-z]/.test(k)) return; seen.t.set(k, (seen.t.get(k) || 0) + 1); }

  function doEl(el) {
    if (SKIP.has(el.tagName) || el.hasAttribute && el.hasAttribute('data-noi18n')) return;
    for (const a of ATTRS) {
      const v = el.getAttribute && el.getAttribute(a); if (!v || !/[A-Za-z]/.test(v)) continue;
      if (seen) { seen.a.set(norm(v), (seen.a.get(norm(v)) || 0) + 1); continue; }
      const r = tText(v); if (r !== null && r !== v) el.setAttribute(a, r);
    }
    // whole element with only inline markup inside, e.g. <p>Press <b>A</b> to play.</p>
    if (el.firstChild && el.childNodes.length > 1 && [...el.children].every(c => INLINE.has(c.tagName))) {
      const h = norm(el.innerHTML);
      if (/[A-Za-z]/.test(h)) {
        if (seen) seen.h.set(h, (seen.h.get(h) || 0) + 1);
        else if (D.h && D.h[h] !== undefined) { el.innerHTML = D.h[h]; return; }
      }
    }
    for (const n of [...el.childNodes]) {
      if (n.nodeType === 3) doText(n);
      else if (n.nodeType === 1) doEl(n);
    }
  }
  function doText(n) {
    const v = n.nodeValue; if (!v || !/[A-Za-z]/.test(v)) return;
    const p = n.parentNode; if (p && (SKIP.has(p.tagName) || (p.closest && p.closest('[data-noi18n]')))) return;
    if (seen) { collectText(norm(v)); return; }
    const r = tText(v); if (r === null) return;
    const lead = v.match(/^\s*/)[0], trail = v.match(/\s*$/)[0];
    const out = lead + r + trail; if (out !== v) n.nodeValue = out;
  }
  function run(muts) {
    if (busy) return; busy = true;
    try {
      for (const m of muts) {
        if (m.type === 'characterData') doText(m.target);
        else if (m.type === 'attributes') doEl(m.target);
        else for (const n of m.addedNodes) { if (n.nodeType === 3) doText(n); else if (n.nodeType === 1) doEl(n); }
      }
    } finally { busy = false; }
  }
  function start() {
    if (lang === 'en' && !seen) return;
    if (!seen) { D = DICTS[lang]; if (!D) return; D.t = D.t || {}; compile(); }
    document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : lang;
    document.documentElement.classList.add('lang-' + lang);
    doEl(document.body);
    if (!seen && D.t[document.title]) document.title = D.t[document.title];
    obs = new MutationObserver(run);
    obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  return {
    LANGS,
    get lang() { return lang; },
    setInitial(l) { lang = (l && (l === 'en' || DICTS[l])) ? l : 'en'; },
    start,
    /** translate a string from code (for things that never reach the page, e.g. the Rich Presence line or alerts) */
    t(s) { return lang === 'en' || !D ? s : (tText(s) ?? s); },
    seen() { return seen && { t: [...seen.t], h: [...seen.h], a: [...seen.a] }; },
  };
})();
