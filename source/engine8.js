// ===== Spellstorm engine, part 8: Ranked (single-player Elo) — CPU ranks 1–10 and secret personalities =====
// Only active when S.aiProf is set; every other mode is untouched.
// Ranks subdivide the Easy -> Expert spectrum: rand = chance of a random play, n = simulations per card,
// all = consider every card you might play (vs one guess), look = simulate to the end of the battle,
// T/eps = how loosely it picks among good options, plan = strategic plans, hardEval = Hard's evaluator, ultSim = judges Ultimates.
const RANKS = [
  { rand: .70, n: 6, all: false, look: false, T: 10, eps: .25, plan: false, hardEval: false, ultSim: false },  // 1
  { rand: .45, n: 8, all: false, look: false, T: 9, eps: .18, plan: false, hardEval: false, ultSim: false },   // 2
  { rand: .25, n: 10, all: false, look: false, T: 8.5, eps: .14, plan: true, hardEval: false, ultSim: false }, // 3
  { rand: .10, n: 14, all: false, look: false, T: 8, eps: .10, plan: true, hardEval: false, ultSim: false },   // 4 ~ Normal
  { rand: 0, n: 18, all: false, look: false, T: 6, eps: .07, plan: true, hardEval: false, ultSim: false },     // 5
  { rand: 0, n: 16, all: true, look: false, T: 4, eps: .05, plan: true, hardEval: true, ultSim: false },       // 6
  { rand: 0, n: 22, all: true, look: false, T: 2.5, eps: .03, plan: true, hardEval: true, ultSim: true },      // 7 ~ Hard
  { rand: 0, n: 26, all: true, look: false, T: 2.2, eps: .025, plan: true, hardEval: true, ultSim: true },     // 8
  { rand: 0, n: 12, all: true, look: true, T: 2, eps: .02, plan: true, hardEval: true, ultSim: true },         // 9
  { rand: 0, n: 18, all: true, look: true, T: 1.8, eps: .015, plan: true, hardEval: true, ultSim: true },      // 10 ~ Expert
];
const PERSONALITIES = {
  A: 'Aggressor: values the damage it deals; buys Fire.',
  B: 'Economist: builds Power and Tier; buys strong Earth and higher-tier cards.',
  C: 'Hexer: loves filling your deck with ICE, ASH and CURSE; buys cards that give them.',
  D: 'Ultimate Junkie: hoards mana and fires its Ultimate every chance; buys Ultimate and mana cards.',
  E: 'Reader: studies more of your possible plays and weighs the worst case at the reveal.',
  F: 'Hoarder: plays for the Blast Score; keeps a big hand; buys card draw.',
  G: 'Turtle: plays defensively and values its own health; buys healing.',
  H: 'Initiative Hawk: fights to hold the Initiative; buys Initiative cards.',
  I: 'Gambler: erratic and much more random, occasionally brilliant.',
  J: 'Dragon Chaser: rushes Tier III and the Dragons.',
};
function rankCfg(S, p) { const a = S.aiProf && S.aiProf[p]; return a ? { ...RANKS[Math.max(1, Math.min(10, a.rank)) - 1], pers: a.pers, rank: a.rank } : null; }
const JUNK_GIVERS = new Set(['swamp', 'frost', 'arctite', 'iceflume', 'quake', 'dIce', 'dEarth', 'snowday', 'devil', 'frostb', 'dbauble']);
const INIT_IDS = new Set(['block', 'step', 'leap', 'lavabat', 'iceflume', 'reflect', 'dWind', 'punch', 'laser']);
const MANA_IDS = new Set(['lavabat', 'manafont', 'blood', 'wave', 'dart', 'coffee']);
const junkIn = P => [...P.hand, ...P.deck, ...P.discard].filter(c => CARDS[c.id].junk).length;
function persBonus(S, p, t) {
  const P = S.pl[p], O = S.pl[nextOppOf(S, p)], pw = (P.tier - 1) * 7 + P.power;
  switch (t) {
    case 'A': return (O.max - O.hp) * 2.5;
    case 'B': return pw * 1.5;
    case 'C': return junkIn(O) * 3 - junkIn(P);
    case 'D': { const c = WIZ[P.wiz].cost || 6; return Math.min(P.mana, c) * 2 + (P.mana >= c ? 3 : 0); }
    case 'F': return handBlast(P) * 3;
    case 'G': return P.hp * 2.5;
    case 'H': return S.init === p ? 6 : 0;
    case 'J': return pw * 2 + P.tier * 4;
    default: return 0;                       // E reads better (see below); I is erratic
  }
}
function persCard(S, p, t, id) {
  const d = CARDS[id];
  switch (t) {
    case 'A': return d.el === 'F' ? 3 : 0;
    case 'B': return (d.el === 'E' ? 2 : 0) + (d.t >= 2 ? 1.5 : 0);
    case 'C': return JUNK_GIVERS.has(id) ? 3 : 0;
    case 'D': return (d.ult ? 2 : 0) + (MANA_IDS.has(id) ? 1 : 0);
    case 'F': return DRAW_IDS.has(id) ? 2.5 : 0;
    case 'G': return HEAL_IDS.has(id) ? 2.5 : 0;
    case 'H': return INIT_IDS.has(id) ? 2.5 : 0;
    case 'I': return Math.random() * 3;
    case 'J': return d.t >= 2 ? 2.5 : 0;
    default: return 0;
  }
}
function rankedGain(S, p, req, R) {
  if (Math.random() < R.rand * .8) return req.slots[Math.floor(Math.random() * req.slots.length)];
  const P = S.pl[p], oe = domEl(S.pl[nextOppOf(S, p)]);
  const val = i => { const id = S.cloud[i].id; return cardVal(id, P) + (R.plan ? planCardBonus(S, p, id) : 0) + (R.hardEval && BEATS[CARDS[id].el] === oe ? 1.5 : 0) + persCard(S, p, R.pers, id) + Math.random() * 1.2; };
  return req.slots.slice().sort((a, b) => val(b) - val(a))[0];
}
function softPickTE(scored, T, eps) {
  if (scored.length === 1) return scored[0].c;
  if (Math.random() < eps) return scored[Math.floor(Math.random() * scored.length)].c;
  const mx = Math.max(...scored.map(s => s.v)), w = scored.map(s => Math.exp(Math.max(-50, (s.v - mx) / T))), tot = w.reduce((a, b) => a + b, 0);
  let r = Math.random() * tot; for (let i = 0; i < scored.length; i++) { r -= w[i]; if (r <= 0) return scored[i].c; } return scored[scored.length - 1].c;
}
async function aiChooseRanked(S0, p, R, hand) {
  if (Math.random() < R.rand) return hand[Math.floor(Math.random() * hand.length)];
  const reader = R.pers === 'E', n = R.n + (reader ? 6 : 0), all = R.all || reader, look = R.look;
  const uniq = [], seen = {}; for (const c of hand) if (!seen[c.id]) { seen[c.id] = 1; uniq.push(c); }
  const scored = [];
  for (const c of uniq) {
    let tot = 0;
    for (let k = 0; k < n; k++) {
      const base = structuredClone(S0); determinize(base, p);
      const opts = base.pl[nextOppOf(base, p)].hand.filter(x => !CARDS[x.id].junk), ids = [...new Set(opts.map(x => x.id))];
      if (!all) { const oc = opts.length ? opts[Math.floor(Math.random() * opts.length)].id : null; tot += await simRound(base, p, c.u, oc, look); continue; }
      const vals = []; for (const oid of (ids.length ? ids : [null])) vals.push(await simRound(base, p, c.u, oid, look));
      const w = reader ? .5 : .4;                                   // the Reader leans harder on the worst case
      tot += (1 - w) * vals.reduce((a, b) => a + b, 0) / vals.length + w * Math.min(...vals);
    }
    scored.push({ c, v: tot / n });
  }
  const gam = R.pers === 'I';
  return softPickTE(scored, R.T * (gam ? 2.5 : 1), R.eps + (gam ? .1 : 0));
}
// ---------- Elo ----------
const RANK_ELO = r => 700 + 100 * (r - 1);                          // Rank 1 = 700 ... Rank 10 = 1600 (spacing measured: ~100 Elo per rank)
function eloExpected(a, b) { return 1 / (1 + Math.pow(10, (b - a) / 400)); }
function eloDelta(me, opp, score, games) { const K = games < 15 ? 40 : 24; return Math.round(K * (score - eloExpected(me, opp))); }
// Matchmaking: a rank near your rating, sometimes above, sometimes below.
function matchRank(elo) { const g = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const target = elo + g() * 110; return Math.max(1, Math.min(10, Math.round((target - 700) / 100) + 1)); }
const PERS_WIZ = { A: ['derby', 'omar', 'may'], B: ['abragail', 'derby', 'oren'], C: ['eve', 'bunny', 'croh'], D: ['may', 'oren', 'derby'], F: ['abragail', 'bunny'], G: ['bunny', 'abragail', 'croh'], H: ['omar', 'eve', 'derby'], J: ['abragail', 'oren', 'may'] };
function pickOppWizard(pers, me, roster) { const pref = (PERS_WIZ[pers] || []).filter(w => w !== me); const pool = roster.filter(w => w !== me);
  return pref.length && Math.random() < .6 ? pref[Math.floor(Math.random() * pref.length)] : pool[Math.floor(Math.random() * pool.length)]; }
const UN_W = ['clyve', 'mossy', 'frog', 'pixel', 'nova', 'drift', 'ember', 'quill', 'raven', 'basil', 'juniper', 'otter', 'static', 'lumen', 'bramble', 'cobalt', 'fig', 'kestrel', 'mango', 'nimbus',
  'orbit', 'pebble', 'quartz', 'rook', 'sable', 'tango', 'umber', 'vesper', 'wren', 'yarrow', 'zephyr', 'ash', 'blip', 'cinder', 'dune', 'echo', 'flint', 'glitch', 'hazel', 'ion', 'jett', 'koi', 'lark',
  'mint', 'nyx', 'onyx', 'pip', 'rune', 'sprocket', 'tofu', 'volt', 'waffle', 'yeti', 'gremlin', 'noodle', 'biscuit', 'turnip', 'pickle', 'moth', 'storm', 'shard', 'gecko', 'badger', 'comet', 'lint', 'spud'];
const UN_N = ['clyve', 'brandon', 'kaylee', 'marcus', 'jen', 'tobias', 'anya', 'dmitri', 'leo', 'priya', 'sam', 'nate', 'ivy', 'rosa', 'theo', 'kenji', 'lucia', 'finn', 'maya', 'gus', 'bex', 'otto', 'vera', 'jojo', 'hal'];
function genUsername() {
  const r = a => a[Math.floor(Math.random() * a.length)], d = k => String(Math.floor(Math.random() * Math.pow(10, k))).padStart(k, '0'), cap = s => s[0].toUpperCase() + s.slice(1);
  const w = r(UN_W), w2 = r(UN_W.filter(x => x !== w)), n = r(UN_N);
  return r([() => `${w}_${d(4)}`, () => `${n}${d(2)}`, () => `xX${cap(w)}Xx`, () => `${w}${w2}`, () => `the_${w}`, () => `${w}.${w2}`, () => `${cap(n)}_${cap(w)}`, () => `${w}${d(3)}`,
    () => `${cap(w)}${cap(w2)}${d(2)}`, () => `${n}_the_${w}`, () => `not${cap(w)}`, () => `${w}lord${d(2)}`, () => `${w}_${w2}_${d(2)}`, () => `${w.toUpperCase()}_${d(3)}`, () => `${n}.${d(4)}`])();
}
