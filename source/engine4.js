// ===== Spellstorm engine, part 4: AI difficulties (Easy / Normal / Hard / Expert), plans, randomness =====
const DIFF_T = { easy: 10, normal: 8, hard: 2.5, expert: 1.8 };     // softmax temperature: higher = more varied
const DIFF_EPS = { easy: 0.7, normal: 0.10, hard: 0.03, expert: 0.02 }; // chance of an off-script pick
function diffOf(S, p) { return (S.aiDiff && S.aiDiff[p]) || (p !== 0 ? (S.diff || 'normal') : 'normal'); }
function isAI(S, p) { return S.aiDiff ? !!S.aiDiff[p] : p !== 0; }

// The CPU never knows the order of face-down decks: its own deck, yours, the Spellstorm Deck, or the Weather Deck.
function determinize(S, p) {
  const os = oppsOf(S, p);
  for (const o of os) { const O = S.pl[o]; const pool = shuffle([...O.hand, ...O.deck]); const hn = O.hand.length; O.hand = pool.slice(0, hn); O.deck = pool.slice(hn); }
  shuffle(S.pl[p].deck); shuffle(S.sdeck); shuffle(S.wdeck);
  for (const o of os) { const O = S.pl[o]; if (O.trap && !O.trap.used) O.trap.id = ['mud', 'dodge', 'ice'][Math.floor(Math.random() * 3)]; }
}

// ---------- strategic concept: "what is my path to victory?" ----------
const PLANS = { damage: 'win by damage', shards: 'win the Blast race', power: 'build up Power', survive: 'play defensively' };
const DRAW_IDS = new Set(['opal', 'spirit', 'swamp', 'rapid', 'arctite', 'lapis', 'reflect', 'sapph', 'twin', 'undertow', 'deepgems', 'dStorm']);
const HEAL_IDS = new Set(['moon', 'arctite', 'twin', 'heart', 'frost', 'leap', 'reflect', 'sapph', 'step', 'lapis', 'block', 'snowday', 'dIce']);
function elFrac(P, el) { const all = [...P.hand, ...P.deck, ...P.discard].filter(c => !CARDS[c.id].junk); return all.length ? all.filter(c => CARDS[c.id].el === el).length / all.length : 0; }
function planScores(S, p) {
  const P = S.pl[p], O = S.pl[nextOppOf(S, p)];
  return {
    damage: (1 - O.hp / O.max) * 10 + elFrac(P, 'F') * 5 + (O.hp <= 8 ? 3 : 0),
    shards: P.shards * 1.5 + (P.shards - O.shards) * 0.8 + (handBlast(P) - handBlast(O)) * 0.7,
    power: (S.battle <= 2 ? 4 : 0) + (3 - P.tier) * 1.4 + elFrac(P, 'E') * 5 - (S.battle >= 4 ? 3 : 0),
    survive: (1 - P.hp / P.max) * 10 + (P.hp <= 5 ? 4 : 0) + elFrac(P, 'W') * 3,
  };
}
function updatePlan(g, p) {
  const S = g.S; S.plan = S.plan || {}; const sc = planScores(S, p), cur = S.plan[p];
  for (const k in sc) sc[k] += Math.random() * 2.5;                       // a little randomness in the read
  let best = Object.keys(sc).sort((a, b) => sc[b] - sc[a])[0];
  if (cur && sc[cur] >= sc[best] - 1.5) best = cur;                        // don't flip-flop over small differences
  if (best !== cur) { S.plan[p] = best; if (!S.aiProf) g.log(`${g.nm(p)} now aims to ${PLANS[best]}.`, 'ini'); }   // ranked opponents keep their intentions secret
}
function planBonus(S, p) {
  const k = S.plan && S.plan[p]; if (!k) return 0; const P = S.pl[p], O = S.pl[nextOppOf(S, p)];
  if (k === 'damage') return (O.max - O.hp) * 2.2;
  if (k === 'shards') return P.shards * 5 + (handBlast(P) - handBlast(O)) * 2.5;
  if (k === 'power') return ((P.tier - 1) * 7 + P.power) * 1.4 + Math.min(P.mana, WIZ[P.wiz].cost) * 0.4;
  if (k === 'survive') return P.hp * 2.2 - P.hand.filter(c => CARDS[c.id].junk).length * 2;
  return 0;
}
function planCardBonus(S, p, id) {
  const k = S.plan && S.plan[p]; if (!k) return 0; const d = CARDS[id];
  if (k === 'damage') return d.el === 'F' ? 2 : 0;
  if (k === 'power') return d.el === 'E' ? 2 : 0;
  if (k === 'survive') return HEAL_IDS.has(id) ? 2 : (d.el === 'W' ? 1 : 0);
  if (k === 'shards') return DRAW_IDS.has(id) ? 2 : 0;
  return 0;
}
const _roundP = Game.prototype.round;
Game.prototype.round = async function (r) {
  for (const p of this.S.pl.keys()) if (!this.S.pl[p].out && !this.S.pl[p].rb && isAI(this.S, p) && (rankCfg(this.S, p) ? rankCfg(this.S, p).plan : diffOf(this.S, p) !== 'easy') && (r === 1 || r === 3)) updatePlan(this, p);
  return _roundP.call(this, r);
};

// ---------- evaluation ----------
function evalAI(S, p) {
  if (S.over) return S.over.winner === p ? 1e4 : -1e4;
  const R = rankCfg(S, p); if (R) return (R.hardEval ? evalHard(S, p) : evalState(S, p)) + (R.plan ? planBonus(S, p) : 0) + persBonus(S, p, R.pers);
  const d = diffOf(S, p);
  return (d === 'hard' || d === 'expert' ? evalHard(S, p) : evalState(S, p)) + planBonus(S, p);
}

// ---------- in-card decisions ----------
function cpuDecideX(g, p, req) {
  const S = g.S, d = diffOf(S, p);
  if (isAI(S, p) && req.k === 'gain' && req.slots.length && req.verb === 'Gain' && rankCfg(S, p)) return rankedGain(S, p, req, rankCfg(S, p));
  if (isAI(S, p) && req.k === 'gain' && req.slots.length && req.verb === 'Gain') {
    if (d === 'easy' && Math.random() < 0.6) return req.slots[Math.floor(Math.random() * req.slots.length)];
    const P = S.pl[p], oe = domEl(S.pl[nextOppOf(S, p)]);
    const val = i => { const id = S.cloud[i].id; return cardVal(id, P) + planCardBonus(S, p, id) + ((d === 'hard' || d === 'expert') && BEATS[CARDS[id].el] === oe ? 1.5 : 0) + Math.random() * 1.2; };
    return req.slots.slice().sort((a, b) => val(b) - val(a))[0];
  }
  return cpuDecide(g, p, req);
}
SIM_IO.decide = (g, p, req) => Promise.resolve(cpuDecideX(g, p, req));

// ---------- choosing a card to play ----------
function softPick(scored, d) {
  if (scored.length === 1) return scored[0].c;
  if (Math.random() < DIFF_EPS[d]) return scored[Math.floor(Math.random() * scored.length)].c;
  const T = DIFF_T[d], mx = Math.max(...scored.map(s => s.v));
  const w = scored.map(s => Math.exp(Math.max(-50, (s.v - mx) / T))), tot = w.reduce((a, b) => a + b, 0);
  let r = Math.random() * tot; for (let i = 0; i < scored.length; i++) { r -= w[i]; if (r <= 0) return scored[i].c; }
  return scored[scored.length - 1].c;
}
// quick policy used inside Expert's look-ahead
function fastPlay(S, p) {
  const h = S.pl[p].hand.filter(c => !CARDS[c.id].junk); if (!h.length) return null;
  const oe = domEl(S.pl[nextOppOf(S, p)]);
  return h.map(c => ({ c, v: CARDS[c.id].v + (BEATS[CARDS[c.id].el] === oe ? 3 : 0) + planCardBonus(S, p, c.id) + Math.random() * 4 })).sort((a, b) => b.v - a.v)[0].c;
}
const ROLL_IO = { sim: true, decide: (g, p, req) => Promise.resolve(req.k === 'play' ? fastPlay(g.S, p) : cpuDecideX(g, p, req)), log() { }, render() { }, pause() { return Promise.resolve(); } };

async function simRound(base, p, myU, oid, lookahead) {
  const S = structuredClone(base), nx = nextOppOf(S, p), me = S.pl[p], op = S.pl[nx];
  const mc = me.hand.find(x => x.u === myU); me.hand.splice(me.hand.indexOf(mc), 1); S.slot[p] = mc;
  if (oid) { const oc = op.hand.find(x => x.id === oid); op.hand.splice(op.hand.indexOf(oc), 1); S.slot[nx] = oc; }
  for (const q of oppsOf(S, p)) { if (q === nx) continue; const h = S.pl[q].hand.filter(x => !CARDS[x.id].junk); if (h.length) { const c = h[Math.floor(Math.random() * h.length)]; S.pl[q].hand.splice(S.pl[q].hand.indexOf(c), 1); S.slot[q] = c; } }
  const g = new Game(S, lookahead ? ROLL_IO : SIM_IO);
  try {
    await g.afterPlay();
  } catch (e) { if (!(e instanceof GameOver)) throw e; }
  const now = evalAI(S, p);
  if (!lookahead || S.over) return now;
  try { for (let r = S.round + 1; r <= 4; r++) await g.round(r); await g.regroup(); } catch (e) { if (!(e instanceof GameOver)) throw e; }
  return 0.45 * now + 0.55 * evalAI(S, p);          // blend: this round's result + where the battle ends up
}
async function aiChoosePlay(S0, p) {
  const d = diffOf(S0, p), hand = S0.pl[p].hand.filter(c => !CARDS[c.id].junk);
  if (hand.length <= 1) return hand[0] || null;
  if (S0.puzzle) return puzzlePlay(S0, p);
  if (rankCfg(S0, p)) return aiChooseRanked(S0, p, rankCfg(S0, p), hand);
  if ((d === 'hard' || d === 'expert') && !(S0.aiOld && S0.aiOld[p])) return aiChooseMatrix(S0, p, { hard: { n: 18, look: false, lateLook: true, mode: 'mix' }, expert: { n: 16, look: true, mode: 'br' } }[d], hand);
  if (d === 'easy' && Math.random() < 0.75) return hand[Math.floor(Math.random() * hand.length)];
  const cfg = { easy: { n: 6, all: false, look: false }, normal: { n: 16, all: false, look: false }, hard: { n: 22, all: true, look: false }, expert: { n: 18, all: true, look: true } }[d];
  const uniq = []; const seen = {}; for (const c of hand) if (!seen[c.id]) { seen[c.id] = 1; uniq.push(c); }
  const scored = [];
  for (const c of uniq) {
    let tot = 0;
    for (let k = 0; k < cfg.n; k++) {
      const base = structuredClone(S0); determinize(base, p);
      const opts = base.pl[nextOppOf(base, p)].hand.filter(x => !CARDS[x.id].junk); const ids = [...new Set(opts.map(x => x.id))];
      if (!cfg.all) { const oc = opts.length ? opts[Math.floor(Math.random() * opts.length)].id : null; tot += await simRound(base, p, c.u, oc, cfg.look); continue; }
      const vals = []; for (const oid of (ids.length ? ids : [null])) vals.push(await simRound(base, p, c.u, oid, cfg.look));
      tot += 0.6 * vals.reduce((a, b) => a + b, 0) / vals.length + 0.4 * Math.min(...vals);
    }
    scored.push({ c, v: tot / cfg.n });
  }
  return softPick(scored, d);
}

// ---------- should I use my Ultimate now, or save the mana? ----------
async function ultDecide(S0, p, free) {
  const d = diffOf(S0, p), R = rankCfg(S0, p); if (R) { if (R.pers === 'D' || !R.ultSim) return true; } else if (d === 'easy' || d === 'normal') return true;
  const W = WIZ[S0.pl[p].wiz], N = d === 'expert' ? 8 : 5; let yes = 0, no = 0;
  for (let k = 0; k < N; k++) {
    const base = structuredClone(S0); determinize(base, p); no += evalAI(base, p);
    const A = structuredClone(base); if (!free) A.pl[p].mana -= W.cost;
    const g = new Game(A, SIM_IO); try { await W.ult(g, p); } catch (e) { if (!(e instanceof GameOver)) throw e; }
    yes += evalAI(A, p);
  }
  return yes / N + (Math.random() - 0.5) * 2 >= no / N;
}
