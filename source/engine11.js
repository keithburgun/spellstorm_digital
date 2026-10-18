// ---------- Threat model: "rounds to live", the race clock, and health as a fraction of max health ----------
// STATUS (Oct 2026): OFF by default (THREAT_ON = false) — measured, no strength gain.
//  A/B vs current Expert, mirrored pairs (tests/ab_threat.js): rounds-to-live + race eval −4 Elo (703 games); variants −22/−15;
//  health-fraction eval −8 (516); full Texel refit with these features −14 (500); + race-clock plan choice 0 (1615); per-wizard subset −7 (763).
//  But as a PREDICTOR of who wins, health as a fraction of max health is a big improvement (Texel held-out loss 0.578 → 0.566,
//  tests/texel2_fit.py) while the rounds-to-live / race terms add nothing. Kept for future work (e.g. a learned evaluation).
// Damage and healing rates come from measured averages: what each card deals to opponents / heals itself when played,
// and each wizard's Ultimate per use and uses per round (tests: /tmp dmgtab.js, 400 games per edition).
const THREAT = {"2":{"card":{"pgem":[0,0.08],"block":[0,0.25],"dart":[0.54,0],"charge":[1.59,0],"punch":[0.03,0],"essE":[0,0.04],"coffee":[0,0.05],"flame":[1.92,0.03],"fb":[2.02,0],"threepow":[0,0.08],"sapph":[0.02,0.75],"reflect":[0.89,0.78],"lavabat":[0,0],"cross":[1.59,0],"iceflume":[0,0],"dIce":[0,2.34],"twopow":[0,0.03],"ultw":[0,0],"diamond":[0.01,0.08],"amber":[0,0.13],"curriculum":[0,0.07],"essF":[1,0],"lantern":[0.34,0],"essW":[0,0],"frost":[0,0.77],"rapid":[1.31,0],"deepgems":[0.08,0.68],"obsidian":[0,-0.1],"opal":[0,0.03],"twin":[0.01,1.51],"dStorm":[3,0],"starshot":[1.4,-0.01],"swamp":[0.02,0],"ruby":[1.2,0.03],"shock":[0.99,0],"databreach":[0,0.03],"step":[0,0.39],"beetle":[2.76,0],"spirit":[0.06,0.1],"snowday":[0,1.7],"blood":[0,0.15],"buddy":[0,0.04],"shatter":[0,0.09],"quake":[0,0.05],"fb2":[3.2,0],"leap":[0.01,0.81],"arctite":[0.21,0],"unstable":[0,0.04],"potiongun":[1.44,0],"heart":[0.01,2.04],"moon":[0,3.11],"sift":[0,0.09],"undertow":[0.19,0],"riot":[1.3,0],"lapis":[0.01,0.67],"meteor":[0.67,0.24],"wave":[0.19,0],"shuriken":[0,0],"sinking":[1.39,0],"dEarth":[2,0],"manafont":[0,0],"dWind":[1.93,0.7],"dFire":[3.85,0]},"ult":{"eve":[0,0,0.15],"derby":[1.99,0,0.14],"abragail":[0,0,0.17],"may":[0.77,0.33,0.09],"omar":[0,0,0.17],"bunny":[0.51,1.24,0.14],"oren":[0.79,0.11,0.14],"croh":[0.1,0,0.14]}},"1":{"card":{"pgem":[0,0.07],"block":[0,0.25],"dart":[0.53,0],"amber":[0,0.04],"fb":[2.15,0],"charge":[1.59,0],"ultw":[0,0],"sift":[0,0.06],"lavabat":[0,0],"riot":[1.28,0],"rapid":[1.27,0],"sapph":[0.02,0.71],"essW":[0,0],"lantern":[0,0],"lapis":[0.02,0.55],"coffee":[0,0.04],"heart":[0.01,1.81],"ruby":[1.06,0],"swamp":[0.02,0],"threepow":[0,0.05],"punch":[0.02,0],"curriculum":[0,0.01],"quake":[0,0.02],"essE":[0,0.04],"deepgems":[0.03,0.5],"twopow":[0,0.05],"wave":[0.2,0],"spirit":[0.04,0.1],"shock":[1.04,0],"opal":[0,0.08],"dStorm":[2.98,0],"starshot":[1.07,0],"essF":[0.99,0],"meteor":[0.53,0.52],"shatter":[0,0.15],"frost":[0.02,0.65],"twin":[0.02,1.45],"shuriken":[0,0],"blood":[0,0.11],"flame":[1.96,0.07],"buddy":[0,0.02],"snowday":[-0.01,1.51],"leap":[0.02,0.77],"cross":[1.62,0],"potiongun":[0.99,0],"unstable":[0,0.03],"reflect":[0.78,0.73],"undertow":[0.03,0],"fb2":[3.11,0],"dFire":[4,0],"step":[0.01,0.27],"arctite":[0.01,1.64],"iceflume":[0,0],"manafont":[0,0],"dWind":[1.37,1.37],"dEarth":[1.93,0.07],"databreach":[0,0.07],"moon":[0,2.9],"beetle":[1.76,0],"obsidian":[0,-0.06],"sinking":[0.95,0],"dIce":[0,2.07],"diamond":[0,0.15]},"ult":{"eve":[0,0,0.16],"derby":[1.98,0,0.16],"abragail":[0,0,0.19],"may":[0.67,0.27,0.12],"omar":[0,0,0.18],"bunny":[0.53,1.18,0.16],"oren":[0.59,0.09,0.16],"croh":[0,0,0.13]}}};
const THREAT_W = { dng: 0, race: 0, tau: 2.5, noLow: false, skipOren: false, hpF: 68, hpLin: 1, plan: false };   // hpF: value of full health as a FRACTION of max health (replaces hpLin × the flat per-point value)   // weights (tuned by A/B); noLow: drop the old fixed '5 health or less' penalties
const EVW_NOLOW = Object.assign({}, EVW0, { low: 0, low2: 0 });
let THREAT_ON = false;                                  // Expert uses this when on; the A/B harness turns it on per side with S.aiVer[p] === 'c'
const threatOn = (S, p) => (THREAT_ON || !!(S.aiVer && S.aiVer[p] === 'c')) && !(THREAT_W.skipOren && S.pl[p].wiz === 'oren') && !(THREAT_W.only && !THREAT_W.only.includes(S.pl[p].wiz));
function rateOf(S, q) {                                 // expected damage q deals per round, and q's own healing per round
  const T = THREAT[ED2(S) ? 2 : 1], P = S.pl[q];
  if (P.rb) return { d: 1.1, h: 0 };
  const avg = L => { let d = 0, h = 0, n = 0; for (const c of L) { if (CARDS[c.id].junk) continue; const x = T.card[c.id]; n++; if (x) { d += x[0]; h += x[1]; } } return n ? { d: d / n, h: h / n, n } : null; };
  const all = avg([...P.hand, ...P.deck, ...P.discard]) || { d: 0.6, h: 0.3 };   // the whole card pool (weighting the hand would reward hoarding damage cards)
  let d = all.d, h = all.h;
  const u = T.ult[P.wiz] || [0, 0, 0.14], ready = P.mana >= WIZ[P.wiz].cost;
  const ur = ready ? Math.max(u[2], 0.35) : u[2];
  d += u[0] * ur; h += u[1] * ur;
  if (P.wiz === 'croh') h = 0;                            // Croh can't heal
  return { d, h };
}
function roundsToKill(S, a, t) {                        // how many rounds a needs to bring t to 0 at the current pace
  const A = rateOf(S, a), T = rateOf(S, t), P = S.pl[t];
  const heal = P.hp < P.max || P.wiz === 'bunny' ? T.h : 0;
  return P.hp / Math.max(0.25, A.d - 0.6 * heal);
}
function roundsToShards(S, p, op) {                     // how many rounds until p reaches the winning Storm Shards
  const P = S.pl[p], W8 = S.win || 8, need = W8 - P.shards; if (need <= 0) return 0;
  const left = Math.max(0, 4 - (S.round || 0)) + (S.phase === 'regroup' || S.phase === 'gain' ? 0 : 0.5);
  const edge = handBlast(P) - handBlast(S.pl[op]), now = 1 + 0.8 * Math.tanh(edge / 2);   // expected shards from this battle's Blast
  return left + Math.max(0, need - now) * 4;            // later battles: about 1 shard per battle (4 rounds) each
}
function threatEval(S, p) {
  const op = strongestOpp(S, p), w = THREAT_W, A = S.pl[p], B = S.pl[op];
  let v = w.hpF * (A.hp / A.max - B.hp / B.max) - w.hpLin * EVW0.hp * (A.hp - B.hp);   // health relative to the wizard's maximum (Bunny's 4/8 is as bad as Croh's 10/20)
  if (!w.dng && !w.race) return v;
  const ttlMe = roundsToKill(S, op, p), ttlOp = roundsToKill(S, p, op);
  const myWin = Math.min(ttlOp, roundsToShards(S, p, op)), theirWin = Math.min(ttlMe, roundsToShards(S, op, p));
  return v + w.dng * (Math.exp(-ttlOp / w.tau) - Math.exp(-ttlMe / w.tau)) + w.race * Math.tanh((theirWin - myWin) / 3);
}
function threatPlan(S, p) {                             // the race clock picks the plan: kill them, out-Blast them, or survive
  const op = strongestOpp(S, p), ttlMe = roundsToKill(S, op, p), ttlOp = roundsToKill(S, p, op), sh = roundsToShards(S, p, op);
  if (ttlMe < 3 && ttlMe < Math.min(ttlOp, sh)) return 'survive';
  if (ttlOp < sh - 1) return 'damage';
  if (S.battle <= 2 && S.pl[p].tier < 3 && sh > 8) return 'power';
  return 'shards';
}
