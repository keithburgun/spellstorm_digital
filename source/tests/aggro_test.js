// Does a one-note "all-in damage" player beat Expert more than Expert's own play would?
// node aggro_test.js <out.jsonl> <wizard> <opp|all> <pairs> <shard> <nshards> [k] [policy: aggro|expert]
const fs = require('fs'); const E = require('./eng_all.js');
const W = ['derby', 'eve', 'abragail', 'may', 'omar', 'bunny', 'oren', 'croh'];
const [out, wz, oppA, NP, sh, ns, ks, pol] = process.argv.slice(2); E.GAINRO.k = +(ks || 60); E.MIDRO.k = +(ks || 60);
const POL = pol || 'aggro', OPPS = oppA === 'all' ? W.filter(w => w !== wz) : [oppA];
const dmgV = id => { const d = E.CARDS[id]; return (d.el === 'F' ? 10 : 0) + d.v; };
function aggroDecide(g, p, req) {
  const S = g.S, P = S.pl[p];
  if (req.k === 'play') { const h = P.hand.filter(c => !E.CARDS[c.id].junk); return Promise.resolve(h.sort((a, b) => dmgV(b.id) - dmgV(a.id))[0] || null); }
  if (req.k === 'yn' && req.ult) return Promise.resolve(true);
  if (req.k === 'gain' && req.verb === 'Gain' && req.slots && req.slots.length) return Promise.resolve(req.slots.slice().sort((a, b) => dmgV(S.cloud[b].id) - dmgV(S.cloud[a].id))[0]);
  return Promise.resolve(E.cpuDecideX(g, p, req));
}
const expDecide = (g, p, req) => req.k === 'play' ? E.aiChoosePlay(g.S, p) : (req.k === 'yn' && req.ult ? E.ultDecide(g.S, p, req.free) : Promise.resolve(E.cpuDecideX(g, p, req)));
(async () => {
  for (let i = +sh; i < +NP; i += +ns) {
    const opp = OPPS[i % OPPS.length];
    for (const side of [0, 1]) {
      E.seedRandom(31337 * i + 7 + side); const S = side === 0 ? E.newState(wz, opp) : E.newState(opp, wz); E.applyEdition(S, 2);
      S.aiDiff = { 0: 'expert', 1: 'expert' };
      const io = { sim: false, log() { }, render() { }, pause() { return Promise.resolve(); }, fx() { }, ev() { },
        decide: (g, p, req) => (p === side && POL === 'aggro') ? aggroDecide(g, p, req) : expDecide(g, p, req) };
      let r = null; try { r = await new E.Game(S, io).run(); } catch (e) { console.error(e.message); }
      E.unseedRandom();
      fs.appendFileSync(out, JSON.stringify({ i, side, opp, pol: POL, w: r ? (r.winner === side ? 1 : 0) : null, why: r && r.why, battles: S.battle }) + '\n');
    }
  }
})();
