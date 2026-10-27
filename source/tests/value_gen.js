// Position data for the learned position score: Expert-vs-Expert games; after every round, the position's features from
// both sides, labelled with who went on to win. node value_gen.js <out.jsonl> <games> <shard> <nshards> [draftK]
const fs = require('fs'); const E = require('./eng_all.js');
const W = ['derby', 'eve', 'abragail', 'may', 'omar', 'bunny', 'oren', 'croh'];
const [out, NG, sh, ns, ks] = process.argv.slice(2); E.GAINRO.k = +(ks || 40); E.MIDRO.k = +(ks || 40);
let rec = null;
const _ap = E.Game.prototype.afterPlay;
E.Game.prototype.afterPlay = async function () {
  const r = await _ap.call(this);
  if (rec && !this.io.sim && !this.S.over) rec.push([E.featVec(this.S, 0), E.featVec(this.S, 1), E.evalAI(this.S, 0), E.evalAI(this.S, 1)]);
  return r;
};
(async () => {
  for (let i = +sh; i < +NG; i += +ns) {
    E.seedRandom(4099 * i + 11); const a = W[i % 8], b = W[(i + 1 + (Math.floor(i / 8) % 7)) % 8];
    const S = E.newState(a, b); E.applyEdition(S, 2); S.aiDiff = { 0: 'expert', 1: 'expert' };
    if (i % 4 === 3) S.aiDiff[i % 8 < 4 ? 0 : 1] = 'hard';            // some variety in the positions
    rec = [];
    const io = { sim: false, log() { }, render() { }, pause() { return Promise.resolve(); }, fx() { }, ev() { },
      decide: (g, p, req) => req.k === 'play' ? E.aiChoosePlay(g.S, p) : (req.k === 'yn' && req.ult ? E.ultDecide(g.S, p, req.free) : Promise.resolve(E.cpuDecideX(g, p, req))) };
    let r = null; try { r = await new E.Game(S, io).run(); } catch (e) { console.error(e.message); }
    E.unseedRandom();
    if (!r || r.winner == null) continue;
    const L = []; for (const [f0, f1, e0, e1] of rec) { L.push(JSON.stringify({ g: i, y: r.winner === 0 ? 1 : 0, e: +e0.toFixed(2), f: f0.map(x => +x.toFixed(4)) })); L.push(JSON.stringify({ g: i, y: r.winner === 1 ? 1 : 0, e: +e1.toFixed(2), f: f1.map(x => +x.toFixed(4)) })); }
    fs.appendFileSync(out, L.join('\n') + '\n');
  }
})();
