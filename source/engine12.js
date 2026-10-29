// ===== Spellstorm engine, part 12: Expert chooses Storm Cloud gains by playing the game out =====
// For each card it could gain, Expert plays many fast games to the end from this exact moment (hidden cards re-dealt
// at random each time, the same random futures for every option so the comparison is fair) and takes the card that wins most.
const GAINRO = { on: true, k: 450 };   // 450 (3x): +32 Elo over 835 mirrored games vs 150 (95% CI +9…+56, SPRT accept); ~1.7 s per pick on a desktop   // k = play-outs per option. ON for Expert: +24 Elo over 1,577 mirrored games (95% CI +7…+42, SPRT accept)
// (k = 48: +17 over 802 games; k = 300 vs 150: no further gain. Play-outs for the card played ('r'): worse and 5× slower.
//  Play-outs for 'use my Ultimate?' ('u'): no gain. Both kept off.)
const verHas = (S, p, f) => !!(S.aiVer && typeof S.aiVer[p] === 'string' && S.aiVer[p].includes(f));
// ----- play-out budget: plain (every option K times) or racing (A/B flag 'S'): the same total budget, but every BATCH
// samples, options clearly behind the leader are dropped (paired comparison on the shared futures: mean gap > Z standard
// errors), and the freed play-outs go to the options still in contention. Deterministic for a given seed (replays stay identical).
const RACE = { on: false, batch: 30, z: 2.0, min: 60 };
async function raceOptions(n, K, adaptive, setup, runOne, breathe) {
  const res = Array.from({ length: n }, () => []); let active = [...Array(n).keys()], budget = K * n, k = 0;
  while (budget > 0 && (adaptive ? active.length > 1 : k < K)) {
    const stop = adaptive ? Math.min(k + RACE.batch, k + Math.ceil(budget / active.length)) : K;
    for (; k < stop && budget > 0; k++) {
      if (breathe && k % 10 === 9) await breathe();
      const ctx = setup(k);
      for (const i of active) { res[i].push(await runOne(i, ctx)); budget--; }
    }
    if (!adaptive) break;
    const mean = i => res[i].reduce((a, b) => a + b, 0) / res[i].length, lead = active.reduce((a, b) => mean(b) > mean(a) ? b : a), m = res[lead].length;
    if (m < RACE.min) continue;
    active = active.filter(i => {
      if (i === lead) return true;
      const L = res[lead].slice(-res[i].length), d = res[i].map((x, t) => L[t] - x), md = d.reduce((a, b) => a + b, 0) / d.length;
      const sd = Math.sqrt(d.reduce((a, b) => a + (b - md) ** 2, 0) / Math.max(1, d.length - 1)) || 1e-9;
      return md <= RACE.z * sd / Math.sqrt(d.length);
    });
  }
  return res.map(r => r.length ? r.reduce((a, b) => a + b, 0) / r.length * K : -1);   // mean win rate, scaled to K (dropped options keep their mean)
}
const raceOn = (S, p) => RACE.on || verHas(S, p, 'S');
const gainRolloutOn = (S, p) => GAINRO.on || verHas(S, p, 'g') || verHas(S, p, 'G');
async function rolloutGain(g0, p, req) {
  const S0 = g0.S, seen = {}, opts = [];
  for (const i of req.slots) { const id = S0.cloud[i] && S0.cloud[i].id; if (id && !seen[id]) { seen[id] = 1; opts.push(i); } }
  if (opts.length <= 1) return null;
  const prev = Math.random, seed0 = Math.floor(prev() * 2147483647); let score;
  try {
    const K = verHas(S0, p, 'G') ? GAINRO.k * 2 : verHas(S0, p, 'K') ? GAINRO.k * 3 : GAINRO.k;   // ('G' = A/B test of twice the play-outs)
    score = await raceOptions(opts.length, K, raceOn(S0, p),
      k => { Math.random = seededRNG(seed0 + k * 7919); const base = structuredClone(S0); determinize(base, p); return { base, fut: seed0 + k * 7919 + 1 }; },
      async (i, { base, fut }) => {
        Math.random = seededRNG(fut);                                // same future for every option
        const S = structuredClone(base), g = new Game(S, ROLL_IO), slot = opts[i]; if (verHas(S0, p, 't')) S.rollTuned = true; if (DRAFTV.on || verHas(S0, p, 'd')) S.rollDraft = true; if (verHas(S0, p, 'e') && DRAFTV.alt) S.rollDraft = 2; if (PLAYV.on || verHas(S0, p, 'f')) S.rollPlay = true; if (verHas(S0, p, 'Q')) S.rollSmart = true;
        try {
          const c = S.cloud[slot]; S.cloud[slot] = null; g.refill(slot); S.pl[p].hand.push(c);
          const ord = g.order(), at = ord.indexOf(p);
          for (const q of ord.slice(at + 1)) { if (S.pl[q].rb || S.pl[q].out) continue;
            const j = cpuDecideX(g, q, { k: 'gain', slots: g.eligibleSlots(q), optional: 0, special: 1, verb: 'Gain' });
            if (typeof j === 'string') await g.gainSpecial(q, j); else if (j != null && j >= 0) { const cc = S.cloud[j]; S.cloud[j] = null; g.refill(j); S.pl[q].hand.push(cc); } }
          for (const q of ord) if (!S.pl[q].rb && !S.pl[q].out) await g.draw(q, 3 - S.pl[q].hand.length);
          for (let b = 0; b < 15; b++) { await g.battle(); await g.regroup(); }
        } catch (e) { if (!(e instanceof GameOver)) throw e; }
        return S.over ? (S.over.winner === p ? 1 : 0) : 0.5;
      },
      typeof window !== 'undefined' ? async () => { const r = Math.random; Math.random = prev; await new Promise(z => setTimeout(z, 0)); Math.random = r; } : null);   // let the screen breathe on slower phones
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
  const prev = Math.random, M = verHas(base, p, 'r') ? PLAYRO.m : ENDGAME.m; let tot = 0;
  try {
    for (let t = 0; t < M; t++) {
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
  return tot / M;
}
const playRolloutOn = (S, p) => verHas(S, p, 'r') || endgameOn(S, p);
// ----- #4 endgame: when someone is close to winning, judge each card by playing the game to the end (short, accurate games)
// instead of by the end-of-round position score. (A/B flag 'Z'; ENDGAME.m play-outs per table cell per sampled deal)
const ENDGAME = { on: false, m: 8, sh: 2, hp: 4 };
function isEndgame(S) { const W8 = S.win || 8; return S.pl.some(P => !P.out && (P.shards >= W8 - ENDGAME.sh || P.hp <= ENDGAME.hp)); }
function endgameOn(S, p) { return (ENDGAME.on || verHas(S, p, 'Z')) && diffOf(S, p) === 'expert' && !rankCfg(S, p) && S.pl.length === 2 && isEndgame(S); }

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
const MIDRO = { on: true, weather: false, k: 360 };   // 360 (3x, with GAINRO): part of the +32 above   // ON: +30 Elo (824 mirrored games, 95% CI +6…+54, SPRT accept)
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
  const S = this.S; let v;
  if (req.k === 'yn' && req.ult && this._fork && !this.io.sim && S.phase === 'resolve' && (MIDYN.ult || verHas(S, p, 'U')) && isAI(S, p) && !rankCfg(S, p)
      && diffOf(S, p) === 'expert' && S.pl.length === 2 && !S.puzzle && !S.tutorial) {   // Expert's Ultimates: replay the round both ways (A/B flag 'U')
    v = await rolloutMidAns(this, p, req, true); if (v == null) v = await _decide12.call(this, p, req);
  } else v = await _decide12.call(this, p, req);
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
  const S0 = g0.S, seen = {}, opts = [];
  for (const i of req.slots) { const id = S0.cloud[i] && S0.cloud[i].id; if (id && !seen[id]) { seen[id] = 1; opts.push(id); } }
  if (req.optional) opts.push(-1);
  if (opts.length <= 1) return null;
  const force = (S, r, o) => { if (o === -1) return r.optional ? -1 : undefined; const s = (r.slots || []).find(j => S.cloud[j] && S.cloud[j].id === o); return s; };
  const score = await rolloutMid(g0, p, req, opts, force, MIDRO.k * (verHas(S0, p, 'K') ? 3 : 1));
  if (GAINRO.rec) GAINRO.rec(S0, p, opts.filter(o => o !== -1).map(id => S0.cloud.findIndex(c => c && c.id === id)), score.filter((_, i) => opts[i] !== -1).map(x => x * GAINRO.k / (MIDRO.k * (verHas(S0, p, 'K') ? 3 : 1))), 'mid');   // (data collection for tests only)
  const pick = opts[score.indexOf(Math.max(...score))];
  if (pick === -1) return -1;
  return req.slots.find(j => S0.cloud[j] && S0.cloud[j].id === pick);
}
// the shared engine: score each option of p's current decision by replaying the round from the fork and playing the game out
async function rolloutMid(g0, p, req, opts, force, K) {
  const F = g0._fork, L = (g0._dlog || []).slice(), S0 = g0.S;
  const nth = L.filter(e => e[0] === p).length;                       // this is p's (nth+1)-th decision since the reveal
  const prev = Math.random, seed0 = Math.floor(prev() * 2147483647); let score;
  try {
    score = await raceOptions(opts.length, K, raceOn(S0, p),
      k => { Math.random = seededRNG(seed0 + k * 7919); const base = structuredClone(F); determinize(base, p); return { base, fut: seed0 + k * 7919 + 1 }; },
      async (i, { base, fut }) => {
        Math.random = seededRNG(fut);
        const S = structuredClone(base), seenN = {}, forced = opts[i]; if (verHas(S0, p, 't')) S.rollTuned = true; if (DRAFTV.on || verHas(S0, p, 'd')) S.rollDraft = true; if (verHas(S0, p, 'e') && DRAFTV.alt) S.rollDraft = 2; if (PLAYV.on || verHas(S0, p, 'f')) S.rollPlay = true; if (verHas(S0, p, 'Q')) S.rollSmart = true;
        const io = { sim: true, log() { }, render() { }, pause() { return Promise.resolve(); },
          decide: (g, q, r) => {
            const n = seenN[q] = (seenN[q] || 0) + 1, mine = L.filter(e => e[0] === q);
            if (q === p && n === nth + 1 && r.k === req.k && S.phase === S0.phase) {            // the decision being tested
              const v = force(S, r, forced); if (v !== undefined) return Promise.resolve(v);
            } else if (n <= mine.length && mine[n - 1][1] === r.k) {    // repeat what was actually chosen earlier this round
              const a = mine[n - 1][2];
              if (r.k === 'gain') { if (typeof a === 'string') return Promise.resolve(a); if (a === -1 || a == null) { if (r.optional) return Promise.resolve(-1); }
                else if (Array.isArray(a)) { const s = (r.slots || []).find(j => S.cloud[j] && S.cloud[j].id === a[1]); if (s != null) return Promise.resolve(s); } }
              else if (r.k === 'pick') { const it = (r.items || []).filter(c => a.includes(c.u)); if (it.length >= (r.min || 0)) return Promise.resolve(it); }
              else if (r.k === 'opt') { if (typeof a === 'number' && r.opts && a >= 0 && a < r.opts.length && !(r.dis && r.dis[a])) return Promise.resolve(a); }
              else return Promise.resolve(a);
            }
            return ROLL_IO.decide(g, q, r);
          } };
        const g = new Game(S, io);
        try { if (g0._forkAt === 'weather') { await g.weatherFx(S.wcur); await g.playStep(); } else await g.afterPlay(); for (let r = S.round + 1; r <= 4; r++) await g.round(r); await g.regroup(); for (let b = 0; b < 15; b++) { await g.battle(); await g.regroup(); } }
        catch (e) { if (!(e instanceof GameOver)) throw e; }
        return S.over ? (S.over.winner === p ? 1 : 0) : 0.5;
      },
      typeof window !== 'undefined' ? async () => { const r = Math.random; Math.random = prev; await new Promise(z => setTimeout(z, 0)); Math.random = r; } : null);
  } finally { Math.random = prev; }
  return score;
}
// ----- the same for Expert's other mid-round choices: yes/no questions (Drink another potion?, Gain the Dragon?) and
// option lists. Ultimates are left to ultDecide. (A/B flag 'y')
const MIDYN = { on: false, ult: false, k: 100 };
async function rolloutMidAns(g0, p, req, dflt) {
  let opts;
  if (req.k === 'yn') opts = [true, false];
  else { const n = (req.opts || req.o || []).length; opts = []; for (let i = 0; i < n; i++) if (!(req.dis && req.dis[i])) opts.push(i); }
  if (opts.length <= 1) return null;
  MIDYN.n = (MIDYN.n || 0) + 1;
  const score = await rolloutMid(g0, p, req, opts, (S, r, o) => r.k === 'opt' && (!r.opts || o >= r.opts.length || (r.dis && r.dis[o])) ? undefined : o, MIDYN.k);
  const best = Math.max(...score), di = opts.indexOf(req.k === 'yn' ? !!dflt : dflt);
  if (!(di >= 0 && score[di] >= best)) MIDYN.flip = (MIDYN.flip || 0) + 1;
  return di >= 0 && score[di] >= best ? opts[di] : opts[score.indexOf(best)];     // a tie keeps the usual answer
}
const _cpuDecideX12b = cpuDecideX;
cpuDecideX = function (g, p, req) {
  const S = g.S;
  if (req.k === 'gain' && req.verb === 'Gain' && req.slots && req.slots.length && (S.phase === 'resolve' ? midRolloutOn(S, p) : S.phase === 'weather' ? (MIDRO.weather || verHas(S, p, 'w')) : false) && g.io && !g.io.sim && g._fork && isAI(S, p) && !rankCfg(S, p)
      && diffOf(S, p) === 'expert' && S.pl.length === 2 && !S.puzzle && !S.tutorial)
    return rolloutMidGain(g, p, req).then(i => i == null ? _cpuDecideX12b(g, p, req) : i);
  if ((req.k === 'yn' && !req.ult || req.k === 'opt') && S.phase === 'resolve' && (MIDYN.on || verHas(S, p, 'y')) && g.io && !g.io.sim && g._fork && isAI(S, p) && !rankCfg(S, p)
      && diffOf(S, p) === 'expert' && S.pl.length === 2 && !S.puzzle && !S.tutorial) {
    const d = _cpuDecideX12b(g, p, req);
    return Promise.resolve(d).then(dv => rolloutMidAns(g, p, req, dv).then(v => v == null ? dv : v));
  }
  return _cpuDecideX12b(g, p, req);
};

// ----- drafting values learned from play-outs (tests/draft_gen.js + draft_fit.py): each option's play-out win rate at
// end-of-battle gains, fitted per card plus a few context terms. Used by the quick players inside Expert's play-outs.
// A/B ('d'): +14 Elo over 2279 mirrored games (95% CI -1 … +28). Values are play-out win-rate points.
const DRAFTV = { on: true, ids: {"amber":-2.14,"arctite":1.8,"beetle":0.0,"block":0.0,"blood":-7.88,"buddy":0.0,"charge":0.0,"coffee":0.0,"cross":-1.03,"curriculum":0.0,"dEarth":0.0,"dFire":0.0,"dIce":0.0,"dStorm":0.0,"dWind":0.0,"dart":0.0,"databreach":0.0,"deepgems":0.0,"diamond":-1.07,"essE":-1.28,"essF":0.53,"essW":0.27,"fb":-0.39,"fb2":7.81,"flame":1.29,"frost":-0.36,"heart":-5.52,"iceflume":-1.97,"lantern":-1.2,"lapis":-0.99,"lavabat":-0.06,"leap":0.22,"manafont":-3.84,"meteor":-6.04,"moon":5.56,"obsidian":-3.37,"opal":5.7,"pgem":-0.33,"potiongun":0.0,"punch":0.0,"quake":1.61,"rapid":0.27,"rb_blast":0.0,"rb_bounce":0.0,"rb_drill":0.0,"rb_fist":0.0,"rb_hack":0.0,"rb_iceblock":0.0,"rb_laser":0.0,"rb_repair":0.0,"rb_upgrade":0.0,"reflect":7.38,"riot":0.0,"ruby":0.93,"sapph":-1.11,"shatter":-1.62,"shock":1.94,"shuriken":0.0,"sift":-0.03,"sinking":0.0,"snowday":0.0,"spirit":-0.53,"starshot":0.0,"step":-1.01,"swamp":-0.15,"threepow":3.74,"twin":4.18,"twopow":4.03,"ultw":-2.49,"undertow":0.0,"unstable":0.0,"wave":-2.87}, we: {"abragail:F":-1.02,"abragail:E":-0.63,"abragail:W":1.65,"bunny:F":-1.03,"bunny:E":-0.19,"bunny:W":1.22,"croh:F":-0.23,"croh:E":-1.39,"croh:W":1.62,"derby:F":-0.46,"derby:E":-0.46,"derby:W":0.92,"eve:F":-0.19,"eve:E":-0.26,"eve:W":0.45,"may:F":-0.64,"may:E":-1.22,"may:W":1.87,"omar:F":0.83,"omar:E":-0.76,"omar:W":-0.07,"oren:F":-0.05,"oren:E":-0.91,"oren:W":0.95,"robot:F":0.0,"robot:E":0.0,"robot:W":0.0}, x: {"wizEl":0.716,"counter":0.03,"copies":-0.464,"sameElFrac":-2.286,"junkFrac":0.0,"tierXbattle":0.37,"valXbattle":-0.863,"deckSize":0.0} };
function draftVal(S, p, id) {
  const T = S.rollDraft === 2 && DRAFTV.alt ? DRAFTV.alt : DRAFTV;   // ('e' = A/B test of a newer table)
  const c = CARDS[id], P = S.pl[p], X = T.x, b = S.battle || 1;
  const mine = [...P.hand, ...P.deck, ...P.discard], nn = mine.filter(q => !CARDS[q.id].junk);
  const opp = S.pl[nextOppOf(S, p)], oe = domEl(opp);
  let v = (T.ids[id] != null ? T.ids[id] : 0) + (T.we[P.wiz + ':' + c.el] || 0);
  v += (WIZ[P.wiz].els.includes(c.el) ? X.wizEl || 0 : 0) + (BEATS[c.el] === oe ? X.counter || 0 : 0) + mine.filter(q => q.id === id).length * (X.copies || 0);
  v += (nn.length ? nn.filter(q => CARDS[q.id].el === c.el).length / nn.length : 0) * (X.sameElFrac || 0) + ((c.t || 1) - 1) * b * (X.tierXbattle || 0) + c.v * b / 10 * (X.valXbattle || 0);
  return v;
}

// ----- card-play values learned from play-outs (tests/play_gen.js + play_fit.py), for the quick players inside Expert's
// play-outs (A/B flag 'f'). Values are play-out win-rate points.
const PLAYV = { on: false, noise: 1, ids: {}, late: {}, x: {} };
function playCtx(S, p) {
  const O = S.pl[nextOppOf(S, p)], n = { F: 0, E: 0, W: 0 }; let t = 0;
  for (const c of [...O.hand, ...O.deck]) { const d = CARDS[c.id]; if (!d.junk) { n[d.el]++; t++; } }
  t = Math.max(1, t); return { F: n.F / t, E: n.E / t, W: n.W / t };
}
const LOSES_TO = { F: 'W', E: 'F', W: 'E' };
function playVal(S, p, id, cx) {
  const c = CARDS[id], X = PLAYV.x, late = ((S.round || 1) - 1) / 3, P = S.pl[p], O = S.pl[nextOppOf(S, p)];
  const beat = cx[BEATS[c.el]], lose = cx[LOSES_TO[c.el]];
  return (PLAYV.ids[id] || 0) + (PLAYV.late[id] || 0) * late + beat * (X.beat || 0) + lose * (X.lose || 0) + beat * late * (X.beatXr4 || 0)
    + ((c.t || 1) - 1) * (X.tier || 0) + (c.v / 10) * ((P.hp <= 4 ? X.hpLow || 0 : 0) + (O.hp <= 4 ? X.ohpLow || 0 : 0));
}

// ----- #1 hidden information: Expert keeps the cards it saw go into the opponent's hand (engine.js markSeen) when it
// imagines their hand, instead of reshuffling everything. (A/B flag 'H')
const KNOWN = { on: false };
function knownOn(S, p) { return (KNOWN.on || verHas(S, p, 'H')) && diffOf(S, p) === 'expert' && !rankCfg(S, p); }
