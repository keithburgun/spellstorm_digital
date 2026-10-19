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
        const S = structuredClone(base), g = new Game(S, ROLL_IO), slot = opts[i];
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
