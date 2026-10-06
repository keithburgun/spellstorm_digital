// ===== Spellstorm engine, part 10: stronger Hard / Expert play — game-theoretic choice at the simultaneous reveal =====
// Build a payoff table (my card × their card) from simulations over sampled hidden hands, then solve it with regret
// matching (as in poker AI) to get the best MIX of plays against an opponent who is choosing too. Then play from that mix.
// No hidden information is used: the opponent's hand is only ever guessed (determinize), exactly as before.
const MXMODE = { v: 'br' };   // 'br': best response to the opponent's equilibrium mix (near-ties broken at random); 'mix': play the mixed strategy
// Analysis shared by the Expert bot and Expert Tips. `cap` (optional) collects what happened in each simulation.
async function matrixAnalyze(S0, p, cfg, uniq, cap) {
  const look = cfg.look || (cfg.lateLook && S0.round >= 3), n = look && !cfg.look ? Math.max(8, Math.round(cfg.n * .5)) : cfg.n;
  const M = new Map(), avail = {};
  for (let k = 0; k < n; k++) {
    const base = structuredClone(S0); determinize(base, p); const nx = nextOppOf(base, p); if (S0.aiVer && S0.aiVer[p] === 'c') { base.rollPol = 2; }   // (test 11b, no Ultimates in two-turn futures: worse, rejected)
    const ids = [...new Set(base.pl[nx].hand.filter(x => !CARDS[x.id].junk).map(x => x.id))], js = ids.length ? ids : ['_'];
    for (const j of js) avail[j] = (avail[j] || 0) + 1;
    for (const c of uniq) for (const j of js) {
      if (cap) SIMCAP = {};
      const v = cfg.depth2 && S0.round < 4 && j !== '_' ? await simDepth2(base, p, c.u, j) : await simRound(base, p, c.u, j === '_' ? null : j, look);
      if (cap) { const key = c.id + '|' + j, r = cap[key] = cap[key] || { n: 0, round: {}, end: {} };
        for (const [w, snap] of [['round', SIMCAP.round], ['end', SIMCAP.end || SIMCAP.round]]) if (snap) for (const f in snap) r[w][f] = (r[w][f] || 0) + snap[f];
        r.n++; SIMCAP = null; }
      const key = c.id + '|' + j, e = M.get(key) || { s: 0, c: 0 }; e.s += v; e.c++; M.set(key, e);
    }
  }
  const J = Object.keys(avail), prior = J.map(j => avail[j] / n), V = uniq.map(c => J.map(j => { const e = M.get(c.id + '|' + j); return e ? e.s / e.c : 0; }));
  const strat = r => { const pos = r.map(v => Math.max(0, v)), t = pos.reduce((a, b) => a + b, 0); return t > 0 ? pos.map(v => v / t) : r.map(() => 1 / r.length); };
  const rx = uniq.map(() => 0), ry = J.map(() => 0), sx = uniq.map(() => 0), sy = J.map(() => 0);
  for (let it = 0; it < 400; it++) {
    const x = strat(rx), y0 = strat(ry), yw = y0.map((v, j) => v * prior[j]), yt = yw.reduce((a, b) => a + b, 0) || 1, y = yw.map(v => v / yt);
    const ux = V.map(row => row.reduce((a, v, j) => a + y[j] * v, 0)), vx = x.reduce((a, xi, i) => a + xi * ux[i], 0);
    const uy = J.map((_, j) => -V.reduce((a, row, i) => a + x[i] * row[j], 0)), vy = y.reduce((a, yj, j) => a + yj * uy[j], 0);
    for (let i = 0; i < uniq.length; i++) { rx[i] += ux[i] - vx; sx[i] += x[i]; }
    for (let j = 0; j < J.length; j++) { ry[j] += uy[j] - vy; sy[j] += y[j]; }
  }
  const yT = sy.reduce((a, b) => a + b, 0) || 1, oppMix = sy.map(v => v / yT), ev = V.map(row => row.reduce((a, v, j) => a + oppMix[j] * v, 0));
  const xT = sx.reduce((a, b) => a + b, 0) || 1;
  return { J, prior, V, oppMix, ev, mix: sx.map(v => v / xT) };
}
async function aiChooseMatrix(S0, p, cfg, hand) {
  const uniq = [], seen = {}; for (const c of hand) if (!seen[c.id]) { seen[c.id] = 1; uniq.push(c); }
  if (uniq.length === 1) return uniq[0];
  const A = await matrixAnalyze(S0, p, cfg, uniq);
  if ((cfg.mode || MXMODE.v) === 'br') {                         // expected value of each card against the opponent's balanced mix
    const best = Math.max(...A.ev), span = Math.max(1, best - Math.min(...A.ev));
    const near = uniq.filter((c, i) => best - A.ev[i] <= span * .04); return near[Math.floor(Math.random() * near.length)];
  }
  let mix = A.mix.slice(); const top = Math.max(...mix);
  // (test 10, lighter pruning: neutral)
  mix = mix.map(v => v < Math.max(.06, top * .15) ? 0 : v); const mt = mix.reduce((a, b) => a + b, 0) || 1;
  let r = Math.random() * mt; for (let i = 0; i < uniq.length; i++) { r -= mix[i]; if (r <= 0) return uniq[i]; } return uniq[mix.indexOf(Math.max(...mix))];
}
