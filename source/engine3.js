// ===== Spellstorm engine, part 3: event hooks for stats/achievements, and the Hard CPU =====
Game.prototype.ev = function (t, p, x) { if (!this.io.sim && this.io.ev) this.io.ev(t, p, x); };
(function wrap() {
  const G = Game.prototype;
  const _damage = G.damage;
  G.damage = async function (t, n, src) { const b = this.S.pl[t].hp; try { await _damage.call(this, t, n, src); } finally { const d = b - this.S.pl[t].hp; if (d > 0) this.ev('dmg', src === undefined ? -1 : src, { t, d }); } };
  const _power = G.power;
  G.power = async function (p, n) { const t0 = this.S.pl[p].tier; await _power.call(this, p, n); const t1 = this.S.pl[p].tier; if (t1 > t0) this.ev('tier', p, t1); };
  const _gd = G.gainDragon;
  G.gainDragon = async function (p) { const n0 = this.S.dragons.length; await _gd.call(this, p); if (this.S.dragons.length < n0) this.ev('dragon', p); };
  const _gc = G.gainCard;
  G.gainCard = async function (p, o) { const c = await _gc.call(this, p, o); if (c) this.ev('gain', p); return c; };
  const _vf = G.voidFrom;
  G.voidFrom = function (p, c, z) { const r = _vf.call(this, p, c, z); if (r) this.ev('void', p); return r; };
  const _gs = G.gainSpecial;
  G.gainSpecial = async function (t, type) { const a = this.actor; await _gs.call(this, t, type); if (a !== undefined && a !== null && a !== t) this.ev('give', a, type); };
  const _res = G.resolve;
  G.resolve = async function (p, c, how) { const prev = this.actor; this.actor = p; try { return await _res.call(this, p, c, how); } finally { this.actor = prev; } };
  const _ep = G.ensurePlayable;
  G.ensurePlayable = async function (p) { if (!this.S.pl[p].hand.some(c => !CARDS[c.id].junk)) this.ev('unplayable', p); return _ep.call(this, p); };
  for (const w of Object.keys(WIZ)) {
    const o = WIZ[w].ult;
    WIZ[w].ult = async (g, p) => { const prev = g.actor; g.actor = p; g.ev('ult', p, w); if (w === 'derby' && g.S.pl[p].hp % 2 === 1) g.ev('yardodd', p);
      const a0 = snapP(g.S, p), bs = g.opps(p).map(q => [q, snapP(g.S, q)]);
      try { await o(g, p); } finally { g.actor = prev; const la = deltaList(a0, snapP(g.S, p), { hand: 1 }), lbs = bs.map(([q, b0]) => [q, deltaList(b0, snapP(g.S, q), { hand: 1 })]).filter(x => x[1].length);
        g.log(`${WIZ[w].un} result — ${g.nm(p)}: ${fmtDelta(la)}${lbs.map(([q, lb]) => `; ${g.nm(q)}: ${fmtDelta(lb)}`).join('')}.`, 'res'); } };
  }
})();

// ---------- Blast ceremony helpers ----------
// discard-effect order: ICE, ASH, CURSE, self-damaging cards, positive Earth cards, other positive cards
// Discard effects at the end of a battle can go in any order. When the order matters (ASH before the Earth cards that give
// Power when you have none; damage before healing unless the damage would be fatal...), try each order on a copy of the game
// and use the best one for that player. Ties keep the usual order. (Real games only; the AI's quick simulations skip this.)
async function discOrder(g, p, cards) {
  if (g.io.sim || cards.length < 2 || cards.length > 6 || new Set(cards.map(c => c.id)).size < 2) return cards;
  const perms = [], seen = new Set();
  const walk = (left, acc) => { if (!left.length) { const k = acc.map(c => c.id).join(','); if (!seen.has(k)) { seen.add(k); perms.push(acc); } return; }
    for (let i = 0; i < left.length; i++) walk([...left.slice(0, i), ...left.slice(i + 1)], [...acc, left[i]]); };
  walk(cards, []);
  const prev = Math.random; let best = cards, bestV = -Infinity;
  try {
    for (const order of perms) {
      Math.random = seededRNG(4242);                                  // a private random stream: the real game's stays untouched
      const S2 = structuredClone(g.S), g2 = new Game(S2, SIM_IO), P2 = S2.pl[p]; P2.blastMod = 0;
      try { for (const c of order) { const cc = P2.hand.find(x => x.u === c.u); if (cc) await g2.discardFrom(p, cc, 'hand', { regroup: true }); } }
      catch (e) { if (!(e instanceof GameOver)) throw e; }
      let v = S2.over ? (S2.over.winner === p ? 1e9 : -1e9) : scoreP(S2, p) + 10 * P2.blastMod;
      if (!S2.over) for (const q of S2.pl.keys()) if (q !== p && !S2.pl[q].out) v -= scoreP(S2, q) / Math.max(1, S2.pl.length - 1);
      if (v > bestV + 1e-9) { bestV = v; best = order; }                // the usual order is tried first, so a tie keeps it
    }
  } finally { Math.random = prev; }
  return best;
}
function blastRank(id) { return ({ ice: 0, ash: 1, curse: 2, meteor: 2.5, heart: 2.5, manafont: 2.5 })[id] ?? (CARDS[id].el === 'E' ? 3 : 4); }
const DISC_TEXT = { pgem: '+1 Power', essE: '+1 Power', twopow: '+2 Power', opal: '+2 Power', diamond: '+1 Power', spirit: '+1 Power', amber: '+1 Power', shatter: '+1 Power',
  quake: '+1 Power', threepow: '+2 Power', meteor: 'Take 1 Damage!', blood: '+1 Mana', heart: 'Take 1 Damage!', manafont: 'Take 1 Damage!', moon: 'Heal 2', step: 'Gain Initiative',
  ice: '−1 Blast Score', ash: 'Lose 1 Power', curse: 'Take 1 Damage!' };

// ---------- what-changed helpers (floats, logs, summaries) ----------
function snapP(S, p) {
  const P = S.pl[p], all = [...P.hand, ...P.deck, ...P.discard], j = id => all.filter(c => c.id === id).length;
  return { hp: P.hp, mana: P.mana, pw: P.tier * 7 + P.power, tier: P.tier, shards: P.shards, hand: P.hand.length, doom: P.doom || 0, energy: P.energy || 0,
    ice: j('ice'), ash: j('ash'), curse: j('curse'), bm: P.blastMod || 0, init: S.init === p ? 1 : 0, ...(P.rb ? { hand: P.blast } : {}) };
}
function deltaList(a, b, o = {}) {
  const L = [], d = k => b[k] - a[k], sg = n => (n > 0 ? '+' : '−') + Math.abs(n), pl = (n, w) => w + (Math.abs(n) === 1 ? '' : 's');
  if (d('hp') < 0) L.push({ k: 'dmg', t: o.float ? `Take ${-d('hp')} Damage!` : `took ${-d('hp')} damage` });
  if (d('hp') > 0) L.push({ k: 'heal', t: o.float ? `Heal ${d('hp')}` : `healed ${d('hp')}` });
  if (d('mana')) L.push({ k: 'mana', t: `${sg(d('mana'))} Mana` });
  if (d('pw')) L.push({ k: 'power', t: `${sg(d('pw'))} Power` });
  if (d('tier') > 0) L.push({ k: 'power', t: `Tier ${'I'.repeat(b.tier)}!` });
  if (d('shards')) L.push({ k: 'shard', t: `${sg(d('shards'))} ${pl(d('shards'), 'Storm Shard')}` });
  if (o.hand && d('hand')) L.push({ k: 'card', t: `${sg(d('hand'))} ${pl(d('hand'), 'card')} in hand` });
  for (const jk of ['ice', 'ash', 'curse']) if (d(jk)) L.push({ k: 'junk', t: `${sg(d(jk))} ${jk.toUpperCase()}` });
  if (d('doom')) L.push({ k: 'doom', t: `${sg(d('doom'))} DOOM` });
  if (d('energy')) L.push({ k: 'energy', t: `${sg(d('energy'))} Energy` });
  if (d('bm')) L.push({ k: 'blast', t: `${sg(d('bm'))} Blast Score` });
  if (d('init') > 0) L.push({ k: 'init', t: 'Gained Initiative' });
  if (d('init') < 0) L.push({ k: 'init', t: 'Lost Initiative' });
  return L;
}
const fmtDelta = L => L.length ? L.map(x => x.t).join(', ') : 'no change';

// ---------- Hard CPU ----------
// Differences from Normal: more hidden-hand samples, assumes the opponent answers with a strong card
// (mix of average and worst case), projects the coming Blast, weighs shard/health races near the end,
// and buys cards that counter the opponent's deck.
function handBlast(P) { return P.hand.filter(c => !CARDS[c.id].disc).length - P.hand.filter(c => c.id === 'ice').length; }
function evalHard(S, p) {
  if (S.over) return S.over.winner === p ? 1e4 : -1e4;
  const w = (S.evw && S.evw[p]) || (THREAT_W.noLow && threatOn(S, p) ? EVW_NOLOW : EVW0), op = strongestOpp(S, p);
  let v = scoreP(S, p, w) - scoreP(S, op, w);
  const d = handBlast(S.pl[p]) - handBlast(S.pl[op]);
  const wt = S.round >= 3 ? 1 : w.blastE;
  v += wt * (d > 0 ? w.blast : d < 0 ? -w.blast : 0);
  for (const [i, s] of [[p, 1], [op, -1]]) {
    const P = S.pl[i];
    const W8 = S.win || 8; if (P.shards >= W8 - 3) v += s * (P.shards - (W8 - 4)) * w.close;   // closing in on the win
    if (P.hp <= 5) v -= s * (6 - P.hp) * w.low2;
  }
  return v;
}
function domEl(P) { const n = { F: 0, E: 0, W: 0 }; for (const c of [...P.hand, ...P.deck, ...P.discard]) if (!CARDS[c.id].junk) n[CARDS[c.id].el]++; return Object.keys(n).sort((a, b) => n[b] - n[a])[0]; }
const _cpuDecide = cpuDecide;
function cpuDecideX(g, p, req) {
  if (g.S.diff === 'hard' && p === 1 && req.k === 'gain' && req.slots.length && req.verb === 'Gain') {
    const S = g.S, P = S.pl[p], oe = domEl(S.pl[1 - p]);
    const val = i => { const d = CARDS[S.cloud[i].id]; return cardVal(d.id || S.cloud[i].id, P) + (BEATS[d.el] === oe ? 1.5 : 0); };
    return req.slots.slice().sort((a, b) => val(b) - val(a))[0];
  }
  return _cpuDecide(g, p, req);
}
async function choosePlayHard(S0, p, samples = 22) {
  const hand = S0.pl[p].hand.filter(c => !CARDS[c.id].junk);
  if (hand.length <= 1) return hand[0] || null;
  let bestC = null, bestV = -Infinity; const seen = {};
  for (const c of hand) {
    if (seen[c.id]) continue; seen[c.id] = 1;
    let tot = 0;
    for (let k = 0; k < samples; k++) {
      const base = structuredClone(S0); determinize(base, p);
      const opts = base.pl[1 - p].hand.filter(x => !CARDS[x.id].junk); const ids = [...new Set(opts.map(x => x.id))];
      const vals = [];
      for (const oid of (ids.length ? ids : [null])) {
        const S = structuredClone(base); const me = S.pl[p], op = S.pl[1 - p];
        const mc = me.hand.find(x => x.u === c.u); me.hand.splice(me.hand.indexOf(mc), 1); S.slot[p] = mc;
        if (oid) { const oc = op.hand.find(x => x.id === oid); op.hand.splice(op.hand.indexOf(oc), 1); S.slot[1 - p] = oc; }
        const g = new Game(S, SIM_IO);
        try { await g.afterPlay(); } catch (e) { if (!(e instanceof GameOver)) throw e; }
        vals.push(evalHard(S, p));
      }
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length, min = Math.min(...vals);
      tot += 0.6 * mean + 0.4 * min;
    }
    const v = tot / samples + Math.random() * 0.01;
    if (v > bestV) { bestV = v; bestC = c; }
  }
  return bestC;
}
SIM_IO.decide = (g, p, req) => Promise.resolve(cpuDecideX(g, p, req));

// ---------- presentation beats: NEW BATTLE! and the Blast Score ceremony ----------
const _battleX = Game.prototype.battle;
Game.prototype.battle = async function () {
  if (!this.io.sim && this.io.fx) { this.S.phase = 'newbattle'; this.io.fx('newbattle', this.S.battle + 1); await this.pause(1700); }
  return _battleX.call(this);
};
Game.prototype.regroup = async function () {
  if (!this.io.sim) await this.pause(1600);   // let the last round's effects play out on the board before the Blast screen covers it
  const S = this.S; S.phase = 'regroup'; this.log(`Regroup after battle ${S.battle}.`, 'head');
  S.wdisc.push(...S.wused); S.wused = []; S.wcur = null;
  const now = () => Date.now(); S.blastSkip = false; const bp = ms => S.blastSkip ? Promise.resolve() : this.pause(ms);
  const B = S.blast = { score: S.pl.map(() => 0), ts: S.pl.map(() => 0), cards: S.pl.map(() => []), turn: null, stage: 'intro', winner: null };
  const sync = p => { for (const c of S.pl[p].hand) if (!B.cards[p].some(e => e.u === c.u)) B.cards[p].push({ u: c.u, id: c.id, up: false, gone: false, disc: !!CARDS[c.id].disc, t: 0 }); };
  const setScore = (p, v) => { if (B.score[p] !== v) { B.score[p] = v; B.ts[p] = now(); } };
  for (const q of S.pl.keys()) if (!S.pl[q].out) sync(q);
  await bp(1300);
  for (const p of [...[...S.pl.keys()].filter(q => q !== 0), 0].filter(q => !S.pl[q].out)) {
    const P = S.pl[p]; P.blastMod = 0; B.turn = p; B.stage = 'disc';
    for (const c of await discOrder(this, p, P.hand.filter(c => CARDS[c.id].disc).sort((a, b) => blastRank(a.id) - blastRank(b.id)))) {
      if (!P.hand.includes(c)) continue;
      const e = B.cards[p].find(x => x.u === c.u);                       // flip, resolve and show its text at the same moment
      const a0 = snapP(S, p);
      await this.discardFrom(p, c, 'hand', { regroup: true });
      const fl = deltaList(a0, snapP(S, p), { float: 1 });
      if (e) { e.up = true; e.t = now(); e.fx = fl.length ? fl : [{ k: c.id === 'step' ? 'init' : 'none', t: DISC_TEXT[c.id] || 'No effect' }]; e.ft = now(); }
      setScore(p, P.blastMod); sync(p); await bp(900); if (e) e.gone = true;
    }
    B.stage = 'count'; sync(p); await bp(300);
    let n = 0;
    for (const c of P.hand.slice()) { const e = B.cards[p].find(x => x.u === c.u); if (e) { e.up = true; e.t = now(); } n++; setScore(p, n + P.blastMod); await bp(210); }
    setScore(p, P.rb ? P.blast : P.hand.length + P.blastMod); await bp(600);
  }
  const sc = B.score.slice();
  for (const p of S.pl.keys()) { const P = S.pl[p]; P.discard.push(...P.hand.splice(0)); }
  this.log(S.pl.length === 2 ? `Blast Scores — you: ${sc[0]}, ${this.nm(1)}: ${sc[1]}.` : `Blast Scores — ${[...S.pl.keys()].filter(q => !S.pl[q].out).map(q => `${q ? this.nm(q) : 'you'}: ${sc[q]}`).join(', ')}.`, 'head');
  for (const P of S.pl) if (P.rb) P.blast = 0;
  S.lastBlast = sc; this.ev('blast', -1, sc);
  B.turn = null; B.stage = 'result';
  if (S.pl.length > 2) { const al = [...S.pl.keys()].filter(q => !S.pl[q].out), mx = Math.max(...al.map(q => sc[q])), top = al.filter(q => sc[q] === mx); B.winners = top;
    if (top.length === 1) { B.winner = top[0]; S.pl[top[0]].shards += 2; this.log(`${this.nm(top[0])} ${top[0] === 0 ? 'win' : 'wins'} the Blast and ${top[0] === 0 ? 'gain' : 'gains'} 2 Storm Shards.`, 'shard'); }
    else { B.winner = -1; for (const q of top) S.pl[q].shards++; this.log(`Tied Blast Score — ${top.map(q => this.nm(q)).join(', ')} each gain 1 Storm Shard.`, 'shard'); } }
  else if (sc[0] === sc[1]) { B.winner = -1; S.pl[0].shards++; S.pl[1].shards++; this.log('Tied Blast Score — both gain 1 Storm Shard.', 'shard'); }
  else { const w = sc[0] > sc[1] ? 0 : 1; B.winner = w; S.pl[w].shards += 2; this.log(`${this.nm(w)} ${w === 0 ? 'win' : 'wins'} the Blast and ${w === 0 ? 'gain' : 'gains'} 2 Storm Shards.`, 'shard'); }
  if (!this.io.sim && this.io.ack) { this.io.render(); await this.io.ack('blast'); } else await bp(2200);        // Skip still lands on the result, waiting for OK
  S.blast = null;
  this.checkWin();
  S.phase = 'gain';
  for (const p of this.order()) {
    if (S.pl[p].rb) continue;
    const slots = this.eligibleSlots(p);
    const i = await this.decide(p, { k: 'gain', q: 'Gain Spell: take one card from the Storm Cloud, or a free special card.', slots, optional: 0, special: 1, verb: 'Gain' });
    if (typeof i === 'string') { await this.gainSpecial(p, i); }
    else { const c = S.cloud[i]; S.cloud[i] = null; this.refill(i); S.pl[p].hand.push(c); markSeen(S, p, c); this.log(`${this.nm(p)} ${p === 0 ? 'gain' : 'gains'} ${CARDS[c.id].n}.`, 'gain'); this.ev('gain', p); }
    await bp(900);
  }
  for (const p of this.order()) if (!S.pl[p].rb) await this.draw(p, 3 - S.pl[p].hand.length);
};
