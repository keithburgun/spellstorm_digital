// ===== Spellstorm engine, part 12: Expert chooses Storm Cloud gains by playing the game out =====
// For each card it could gain, Expert plays many fast games to the end from this exact moment (hidden cards re-dealt
// at random each time, the same random futures for every option so the comparison is fair) and takes the card that wins most.
const GAINRO = { on: true, k: 150 };   // k = play-outs per option. ON for Expert: +24 Elo over 1,577 mirrored games (95% CI +7…+42, SPRT accept)
// (k = 48: +17 over 802 games; k = 300 vs 150: no further gain. Play-outs for the card played ('r'): worse and 5× slower.
//  Play-outs for 'use my Ultimate?' ('u'): no gain. Both kept off.)
const verHas = (S, p, f) => !!(S.aiVer && typeof S.aiVer[p] === 'string' && S.aiVer[p].includes(f));
const gainRolloutOn = (S, p) => GAINRO.on || verHas(S, p, 'g') || verHas(S, p, 'G');
async function rolloutGain(g0, p, req) {
  const S0 = g0.S, seen = {}, opts = [];
  for (const i of req.slots) { const id = S0.cloud[i] && S0.cloud[i].id; if (id && !seen[id]) { seen[id] = 1; opts.push(i); } }
  if (opts.length <= 1) return null;
  const prev = Math.random, seed0 = Math.floor(prev() * 2147483647), score = opts.map(() => 0);
  try {
    const K = verHas(S0, p, 'G') ? GAINRO.k * 2 : GAINRO.k;   // ('G' = A/B test of twice the play-outs)
    for (let k = 0; k < K; k++) {
      if (k % 10 === 9 && typeof window !== 'undefined') { Math.random = prev; await new Promise(r => setTimeout(r, 0)); }   // let the screen breathe on slower phones
      Math.random = seededRNG(seed0 + k * 7919);
      const base = structuredClone(S0); determinize(base, p);
      const fut = seed0 + k * 7919 + 1;
      for (let i = 0; i < opts.length; i++) {
        Math.random = seededRNG(fut);                                // same future for every option
        const S = structuredClone(base), g = new Game(S, ROLL_IO), slot = opts[i]; if (verHas(S0, p, 't')) S.rollTuned = true; if (DRAFTV.on || verHas(S0, p, 'd')) S.rollDraft = true;
        try {
          const c = S.cloud[slot]; S.cloud[slot] = null; g.refill(slot); S.pl[p].hand.push(c);
          const ord = g.order(), at = ord.indexOf(p);
          for (const q of ord.slice(at + 1)) { if (S.pl[q].rb || S.pl[q].out) continue;
            const j = cpuDecideX(g, q, { k: 'gain', slots: g.eligibleSlots(q), optional: 0, special: 1, verb: 'Gain' });
            if (typeof j === 'string') await g.gainSpecial(q, j); else if (j != null && j >= 0) { const cc = S.cloud[j]; S.cloud[j] = null; g.refill(j); S.pl[q].hand.push(cc); } }
          for (const q of ord) if (!S.pl[q].rb && !S.pl[q].out) await g.draw(q, 3 - S.pl[q].hand.length);
          for (let b = 0; b < 15; b++) { await g.battle(); await g.regroup(); }
        } catch (e) { if (!(e instanceof GameOver)) throw e; }
        score[i] += S.over ? (S.over.winner === p ? 1 : 0) : 0.5;
      }
    }
  } finally { Math.random = prev; }
  if (GAINRO.rec) GAINRO.rec(S0, p, opts, score);                   // (data collection for tests only)
  const best = Math.max(...score), top = opts.filter((_, i) => score[i] >= best - 0.5);
  if (top.length === 1) return top[0];
  const P = S0.pl[p]; return top.sort((a, b) => cardVal(S0.cloud[b].id, P) - cardVal(S0.cloud[a].id, P))[0];   // a tie: the usual card values decide
}
const _cpuDecideX12 = cpuDecideX;
cpuDecideX = function (g, p, req) {
  const S = g.S;
  if (req.k === 'gain' && req.verb === 'Gain' && req.slots && req.slots.length > 1 && S.phase === 'gain' && g.io && !g.io.sim && isAI(S, p) && !rankCfg(S, p) && diffOf(S, p) === 'expert'
      && gainRolloutOn(S, p) && S.pl.length === 2 && !S.puzzle)
    return rolloutGain(g, p, req).then(i => i == null ? _cpuDecideX12(g, p, req) : i);
  return _cpuDecideX12(g, p, req);
};

// ----- the same idea for the card Expert plays: each cell of its payoff table (my card × their card) is scored by
// playing the whole game out instead of judging the position at the end of the battle. (A/B flag: S.aiVer[p] === 'r')
const PLAYRO = { m: 4 };                                          // play-outs per table cell per sampled deal (same futures in every cell)
async function simRoundRoll(base, p, myU, oid, seed) {
  const prev = Math.random; let tot = 0;
  try {
    for (let t = 0; t < PLAYRO.m; t++) {
      Math.random = seededRNG(seed + t * 104729);
      const S = structuredClone(base), nx = nextOppOf(S, p), me = S.pl[p], op = S.pl[nx];
      const mc = me.hand.find(x => x.u === myU); me.hand.splice(me.hand.indexOf(mc), 1); S.slot[p] = mc;
      if (oid) { const oc = op.hand.find(x => x.id === oid); op.hand.splice(op.hand.indexOf(oc), 1); S.slot[nx] = oc; }
      const g = new Game(S, ROLL_IO);
      try { await g.afterPlay(); for (let r = S.round + 1; r <= 4; r++) await g.round(r); await g.regroup(); for (let b = 0; b < 15; b++) { await g.battle(); await g.regroup(); } }
      catch (e) { if (!(e instanceof GameOver)) throw e; }
      tot += S.over ? (S.over.winner === p ? 1 : 0) : 0.5;
    }
  } finally { Math.random = prev; }
  return tot / PLAYRO.m;
}
const playRolloutOn = (S, p) => verHas(S, p, 'r');

// ----- and for "use my Ultimate now?": play the game out both ways (the rest of the current round is skipped in both, so the comparison stays fair)
const ULTRO = { on: false, k: 80 };
const ultRolloutOn = (S, p) => ULTRO.on || verHas(S, p, 'u');
async function rolloutUlt(S0, p, free) {
  const W = WIZ[S0.pl[p].wiz], prev = Math.random, seed0 = Math.floor(prev() * 2147483647); let yes = 0, no = 0;
  try {
    for (let k = 0; k < ULTRO.k; k++) {
      Math.random = seededRNG(seed0 + k * 7919);
      const base = structuredClone(S0); determinize(base, p); const fut = seed0 + k * 7919 + 1;
      for (const use of [true, false]) {
        Math.random = seededRNG(fut);
        const S = structuredClone(base), g = new Game(S, ROLL_IO);
        try {
          if (use) { if (!free) S.pl[p].mana -= W.cost; await W.ult(g, p); }
          for (const q of S.pl.keys()) { const c = S.slot[q]; if (c) S.pl[q].discard.push(c); }
          S.slot = S.pl.map(() => null); S.revealed = false; S.resolving = null;
          for (let r = (S.round || 0) + 1; r <= 4; r++) await g.round(r);
          await g.regroup(); for (let b = 0; b < 15; b++) { await g.battle(); await g.regroup(); }
        } catch (e) { if (!(e instanceof GameOver)) throw e; }
        const v = S.over ? (S.over.winner === p ? 1 : 0) : 0.5; if (use) yes += v; else no += v;
      }
    }
  } finally { Math.random = prev; }
  return yes >= no;
}
const _ultDecide12 = ultDecide;
ultDecide = async function (S0, p, free) {
  if (isAI(S0, p) && !rankCfg(S0, p) && diffOf(S0, p) === 'expert' && ultRolloutOn(S0, p) && S0.pl.length === 2 && !S0.puzzle && S0.phase !== 'gain') return rolloutUlt(S0, p, free);
  return _ultDecide12(S0, p, free);
};

// ----- Drafting in the middle of a round (cards like Coffee Run or Amber: "gain a card"). The engine can't pause a card
// half-way, so Expert keeps a copy of the game from the moment the cards were revealed, plus every choice made since;
// to test an option it replays the round from that copy (repeating those choices), forces the option, and plays the game out.
const MIDRO = { on: true, weather: false, k: 120 };   // ON: +30 Elo (824 mirrored games, 95% CI +6…+54, SPRT accept)
const midRolloutOn = (S, p) => MIDRO.on || verHas(S, p, 'm');
const encAnsG = (req, v) => req.k === 'gain' ? (typeof v === 'string' || v == null || v < 0 ? v : ['id', null]) : req.k === 'pick' ? (v || []).map(c => c.u) : v;
const _afterPlay12 = Game.prototype.afterPlay;
Game.prototype.afterPlay = async function () {
  if (!this.io.sim && this.S.pl.length === 2) { this._fork = structuredClone(this.S); this._forkAt = 'reveal'; this._dlog = []; }
  try { return await _afterPlay12.call(this); } finally { this._fork = null; this._dlog = null; }
};
const _weatherFx12 = Game.prototype.weatherFx;                         // the same for Weather cards that let everyone gain (Falling Star)
Game.prototype.weatherFx = async function (w) {
  if (!this.io.sim && this.S.pl.length === 2) { this._fork = structuredClone(this.S); this._forkAt = 'weather'; this._dlog = []; }
  try { return await _weatherFx12.call(this, w); } finally { this._fork = null; this._dlog = null; }
};
const _decide12 = Game.prototype.decide;
Game.prototype.decide = async function (p, req) {
  const v = await _decide12.call(this, p, req);
  if (this._dlog) { let e = encAnsG(req, v); if (Array.isArray(e) && e[0] === 'id') e = ['id', this._lastGainId]; this._dlog.push([p, req.k, e]); }
  return v;
};
// remember which card a numbered gain answer referred to (the Storm Cloud slot is refilled right after)
const _gainCard12 = Game.prototype.gainCard;
Game.prototype.gainCard = async function (p, o) {
  if (!this._dlog) return _gainCard12.call(this, p, o);
  const S = this.S, before = S.cloud.map(c => c && c.u), r = await _gainCard12.call(this, p, o);
  if (r && this._dlog.length) { const last = this._dlog[this._dlog.length - 1]; if (last[1] === 'gain' && Array.isArray(last[2])) last[2] = ['id', r.id]; }
  return r;
};
async function rolloutMidGain(g0, p, req) {
  const F = g0._fork, L = (g0._dlog || []).slice(), S0 = g0.S, seen = {}, opts = [];
  for (const i of req.slots) { const id = S0.cloud[i] && S0.cloud[i].id; if (id && !seen[id]) { seen[id] = 1; opts.push(id); } }
  if (req.optional) opts.push(-1);
  if (opts.length <= 1) return null;
  const nth = L.filter(e => e[0] === p).length;                       // this is p's (nth+1)-th decision since the reveal
  const prev = Math.random, seed0 = Math.floor(prev() * 2147483647), score = opts.map(() => 0);
  try {
    for (let k = 0; k < MIDRO.k; k++) {
      if (k % 10 === 9 && typeof window !== 'undefined') { Math.random = prev; await new Promise(r => setTimeout(r, 0)); }
      Math.random = seededRNG(seed0 + k * 7919);
      const base = structuredClone(F); determinize(base, p); const fut = seed0 + k * 7919 + 1;
      for (let i = 0; i < opts.length; i++) {
        Math.random = seededRNG(fut);
        const S = structuredClone(base), seenN = {}, forced = opts[i]; if (verHas(S0, p, 't')) S.rollTuned = true; if (DRAFTV.on || verHas(S0, p, 'd')) S.rollDraft = true;
        const io = { sim: true, log() { }, render() { }, pause() { return Promise.resolve(); },
          decide: (g, q, r) => {
            const n = seenN[q] = (seenN[q] || 0) + 1, mine = L.filter(e => e[0] === q);
            if (q === p && n === nth + 1 && r.k === 'gain') {           // the decision being tested
              if (forced === -1) return Promise.resolve(-1);
              const s = (r.slots || []).find(j => S.cloud[j] && S.cloud[j].id === forced); if (s != null) return Promise.resolve(s);
            } else if (n <= mine.length && mine[n - 1][1] === r.k) {    // repeat what was actually chosen earlier this round
              const a = mine[n - 1][2];
              if (r.k === 'gain') { if (typeof a === 'string' || a === -1 || a == null) return Promise.resolve(a == null ? -1 : a);
                const s = (r.slots || []).find(j => S.cloud[j] && S.cloud[j].id === a[1]); if (s != null) return Promise.resolve(s); }
              else if (r.k === 'pick') { const it = (r.items || []).filter(c => a.includes(c.u)); if (it.length >= (r.min || 0)) return Promise.resolve(it); }
              else return Promise.resolve(a);
            }
            return ROLL_IO.decide(g, q, r);
          } };
        const g = new Game(S, io);
        try { if (g0._forkAt === 'weather') { await g.weatherFx(S.wcur); await g.playStep(); } else await g.afterPlay(); for (let r = S.round + 1; r <= 4; r++) await g.round(r); await g.regroup(); for (let b = 0; b < 15; b++) { await g.battle(); await g.regroup(); } }
        catch (e) { if (!(e instanceof GameOver)) throw e; }
        score[i] += S.over ? (S.over.winner === p ? 1 : 0) : 0.5;
      }
    }
  } finally { Math.random = prev; }
  const best = Math.max(...score), bi = score.indexOf(best), pick = opts[bi];
  if (pick === -1) return -1;
  return req.slots.find(j => S0.cloud[j] && S0.cloud[j].id === pick);
}
const _cpuDecideX12b = cpuDecideX;
cpuDecideX = function (g, p, req) {
  const S = g.S;
  if (req.k === 'gain' && req.verb === 'Gain' && req.slots && req.slots.length && (S.phase === 'resolve' ? midRolloutOn(S, p) : S.phase === 'weather' ? (MIDRO.weather || verHas(S, p, 'w')) : false) && g.io && !g.io.sim && g._fork && isAI(S, p) && !rankCfg(S, p)
      && diffOf(S, p) === 'expert' && S.pl.length === 2 && !S.puzzle && !S.tutorial)
    return rolloutMidGain(g, p, req).then(i => i == null ? _cpuDecideX12b(g, p, req) : i);
  return _cpuDecideX12b(g, p, req);
};

// ----- drafting values learned from play-outs (tests/draft_gen.js + draft_fit.py): each option's play-out win rate at
// end-of-battle gains, fitted per card plus a few context terms. Used by the quick players inside Expert's play-outs.
const DRAFTV = { on: false, ids: {}, we: {}, x: {} };
function draftVal(S, p, id) {
  const c = CARDS[id], P = S.pl[p], X = DRAFTV.x, b = S.battle || 1;
  const mine = [...P.hand, ...P.deck, ...P.discard], nn = mine.filter(q => !CARDS[q.id].junk);
  const opp = S.pl[nextOppOf(S, p)], oe = domEl(opp);
  let v = (DRAFTV.ids[id] != null ? DRAFTV.ids[id] : 0) + (DRAFTV.we[P.wiz + ':' + c.el] || 0);
  v += (WIZ[P.wiz].els.includes(c.el) ? X.wizEl || 0 : 0) + (BEATS[c.el] === oe ? X.counter || 0 : 0) + mine.filter(q => q.id === id).length * (X.copies || 0);
  v += (nn.length ? nn.filter(q => CARDS[q.id].el === c.el).length / nn.length : 0) * (X.sameElFrac || 0) + ((c.t || 1) - 1) * b * (X.tierXbattle || 0) + c.v * b / 10 * (X.valXbattle || 0);
  return v;
}
