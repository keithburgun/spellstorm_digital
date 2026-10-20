// Drafting data: at every end-of-battle "gain a card" choice, score each Storm Cloud option by playing the game out (Expert's
// regroup rollouts) and save the position + win rate per option. node draft_gen.js <out.jsonl> <games> <shard> <nshards> [k]
const fs = require('fs'); const E = require('./eng_all.js');
const W = ['derby', 'eve', 'abragail', 'may', 'omar', 'bunny', 'oren', 'croh'];
const [out, NG, sh, ns, ks] = process.argv.slice(2); E.GAINRO.k = +(ks || 100); E.MIDRO.on = false;
const ids = P => [...P.hand, ...P.deck, ...P.discard].map(c => c.id);
let cur = null;
E.GAINRO.rec = (S, p, opts, score) => {
  const o = 1 - p, me = S.pl[p], op = S.pl[o], K = E.GAINRO.k;
  fs.appendFileSync(out, JSON.stringify({ g: cur, battle: S.battle, p, wiz: me.wiz, owiz: op.wiz, tier: me.tier, otier: op.tier, hp: me.hp, ohp: op.hp, sh: me.shards, osh: op.shards,
    mine: ids(me), theirs: ids(op), opts: opts.map(i => S.cloud[i].id), wr: score.map(x => x / K) }) + '\n');
};
(async () => {
  for (let i = +sh; i < +NG; i += +ns) {
    cur = i; E.seedRandom(7777 * i + 3); const a = W[i % 8], b = W[(i * 3 + 1 + Math.floor(i / 8)) % 8 === i % 8 ? (i + 1) % 8 : (i * 3 + 1 + Math.floor(i / 8)) % 8];
    const S = E.newState(a, b); E.applyEdition(S, 2); S.aiDiff = { 0: 'expert', 1: 'expert' };
    const io = { sim: false, log() { }, render() { }, pause() { return Promise.resolve(); }, fx() { }, ev() { },
      decide: (g, p, req) => req.k === 'play' ? Promise.resolve(E.fastPlay(g.S, p)) : (req.k === 'yn' && req.ult ? Promise.resolve(E.cpuDecideX(g, p, req)) : Promise.resolve(E.cpuDecideX(g, p, req))) };
    try { await new E.Game(S, io).run(); } catch (e) { console.error(e.message); }
    E.unseedRandom();
  }
})();
