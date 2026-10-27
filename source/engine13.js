// ---------- learned position score (route #2) ----------
// featVec(S, p) describes a position from p's side; VMODEL (fitted by tests/value_fit.py on Expert-vs-Expert games) turns it
// into a win chance. Expert uses it in place of the hand-set end-of-round score when VMODEL.on (A/B flag 'V').
const VWIZ = ['abragail', 'bunny', 'croh', 'derby', 'eve', 'may', 'omar', 'oren'];
function sideFeats(S, i) {
  const P = S.pl[i], W = WIZ[P.wiz], W8 = S.win || 8, all = [...P.hand, ...P.deck, ...P.discard];
  let val = 0, nn = 0, junk = 0, jh = 0, t2 = 0, t3 = 0; const el = { F: 0, E: 0, W: 0 }, hel = { F: 0, E: 0, W: 0 }; let hval = 0;
  for (const c of all) { const d = CARDS[c.id]; if (d.junk) { junk++; continue; } nn++; val += d.v; el[d.el]++; if (d.t === 2) t2++; if (d.t >= 3) t3++; }
  for (const c of P.hand) { const d = CARDS[c.id]; if (d.junk) { jh++; continue; } hval += d.v; hel[d.el]++; }
  const hn = Math.max(1, P.hand.length), dn = Math.max(1, nn);
  return [P.hp, P.hp / P.max, Math.min(P.hp, 3), P.hp <= 2 ? 1 : 0, P.hp <= 4 ? 1 : 0, P.shards, Math.max(0, P.shards - (W8 - 3)), P.shards >= W8 - 1 ? 1 : 0,
    Math.min(P.mana, W.cost), Math.max(0, P.mana - W.cost), P.mana >= W.cost ? 1 : 0, P.power, P.tier, P.hand.length, P.deck.length, P.discard.length,
    junk, jh, nn, val / dn, hval / hn, el.F / dn, el.E / dn, el.W / dn, hel.F / hn, hel.E / hn, hel.W / hn, t2, t3,
    S.init === i ? 1 : 0, P.doom || 0, P.energy || 0, (P.research || []).filter(Boolean).length, P.trap && !P.trap.used ? 1 : 0,
    P.wiz === 'oren' ? (P.chem.F + P.chem.E + P.chem.W) : 0, handBlast(P)];
}
const VSIDE = 36;
function featVec(S, p) {
  const o = strongestOpp(S, p), a = sideFeats(S, p), b = sideFeats(S, o), W8 = S.win || 8;
  const ctx = [S.round || 0, S.battle || 1, (S.round || 0) >= 3 ? 1 : 0, W8];
  const wz = VWIZ.map(w => S.pl[p].wiz === w ? 1 : 0), wo = VWIZ.map(w => S.pl[o].wiz === w ? 1 : 0);
  const d = a.map((x, k) => x - b[k]);
  return [...a, ...b, ...d, ...ctx, ...wz, ...wo];
}
// model: z-scored inputs -> (optional hidden layer, tanh) -> logit. Filled in from value_fit.py output.
const VMODEL = { on: false, blend: 0, scale: 100, mu: null, sd: null, W1: null, b1: null, w2: null, b2: 0 };
function valueNet(x) {
  const M = VMODEL, n = x.length, z = new Array(n);
  for (let k = 0; k < n; k++) z[k] = (x[k] - M.mu[k]) / M.sd[k];
  if (!M.W1) { let s = M.b2; for (let k = 0; k < n; k++) s += M.w2[k] * z[k]; return s; }
  let s = M.b2;
  for (let j = 0; j < M.W1.length; j++) { const r = M.W1[j]; let h = M.b1[j]; for (let k = 0; k < n; k++) h += r[k] * z[k]; s += M.w2[j] * Math.tanh(h); }
  return s;
}
function valueOn(S, p) { return (VMODEL.on || verHas(S, p, 'V')) && VMODEL.mu && diffOf(S, p) === 'expert' && !rankCfg(S, p) && S.pl.length === 2; }
const _evalAI13 = evalAI;
evalAI = function (S, p) {
  if (!S.over && valueOn(S, p)) return VMODEL.blend ? _evalAI13(S, p) + VMODEL.blend * 48 * valueNet(featVec(S, p)) : VMODEL.scale * valueNet(featVec(S, p));   // logit of the win chance, scaled (blend: added to the hand-set score; 1 logit ≈ 48 points of it)
  if (S.over && valueOn(S, p)) return S.over.winner === p ? 1e4 : -1e4;
  return _evalAI13(S, p);
};
