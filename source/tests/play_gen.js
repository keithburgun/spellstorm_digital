// Card-play data: at play decisions in quick games, score each card in hand by playing the game out (opponent plays the
// usual quick policy) and save the position + win rate per card. node play_gen.js <out.jsonl> <games> <shard> <nshards> [k]
const fs = require('fs'); const E = require('./eng_all.js');
const W = ['derby', 'eve', 'abragail', 'may', 'omar', 'bunny', 'oren', 'croh'];
const [out, NG, sh, ns, ks] = process.argv.slice(2); const K = +(ks || 60);
const ids = P => [...P.hand, ...P.deck, ...P.discard].map(c => c.id);
async function score(S0, p) {
  const hand = S0.pl[p].hand.filter(c => !E.CARDS[c.id].junk), seen = {}, opts = [];
  for (const c of hand) if (!seen[c.id]) { seen[c.id] = 1; opts.push(c); }
  if (opts.length <= 1) return null;
  const prev = Math.random, seed0 = Math.floor(prev() * 2147483647), sc = opts.map(() => 0);
  try {
    for (let k = 0; k < K; k++) {
      Math.random = E.seededRNG(seed0 + k * 7919); const base = structuredClone(S0); E.determinize(base, p); const fut = seed0 + k * 7919 + 1;
      for (let i = 0; i < opts.length; i++) {
        Math.random = E.seededRNG(fut); const S = structuredClone(base); S.rollDraft = true; let first = true;
        const io = { sim: true, log() { }, render() { }, pause() { return Promise.resolve(); },
          decide: (g, q, r) => { if (q === p && r.k === 'play' && first) { first = false; return Promise.resolve(g.S.pl[p].hand.find(c => c.u === opts[i].u)); } return E.ROLL_IO.decide(g, q, r); } };
        const g = new E.Game(S, io);
        try { await g.playStep(); for (let r = S.round + 1; r <= 4; r++) await g.round(r); await g.regroup(); for (let b = 0; b < 15; b++) { await g.battle(); await g.regroup(); } }
        catch (e) { if (!(e instanceof E.GameOver)) throw e; }
        sc[i] += S.over ? (S.over.winner === p ? 1 : 0) : 0.5;
      }
    }
  } finally { Math.random = prev; }
  return { opts: opts.map(c => c.id), wr: sc.map(x => x / K) };
}
(async () => {
  for (let i = +sh; i < +NG; i += +ns) {
    E.seedRandom(8191 * i + 5); const a = W[i % 8], b = W[(i + 1 + Math.floor(i / 8)) % 8] === a ? W[(i + 2) % 8] : W[(i + 1 + Math.floor(i / 8)) % 8];
    const S = E.newState(a, b); E.applyEdition(S, 2); S.aiDiff = { 0: 'expert', 1: 'expert' }; S.rollDraft = true;
    let nDec = 0;
    const io = { sim: true, log() { }, render() { }, pause() { return Promise.resolve(); },
      decide: async (g, p, req) => {
        if (req.k === 'play' && Math.random() < 0.35) {             // sample some positions (keeps games varied and the data spread out)
          const S0 = g.S, me = S0.pl[p], op = S0.pl[1 - p], r = await score(S0, p);
          if (r) { nDec++; fs.appendFileSync(out, JSON.stringify({ g: i, battle: S0.battle, round: S0.round, p, wiz: me.wiz, owiz: op.wiz, hp: me.hp, ohp: op.hp, sh: me.shards, osh: op.shards, mana: me.mana, omana: op.mana,
            hand: me.hand.map(c => c.id), opool: [...op.hand, ...op.deck].map(c => c.id), ohandN: op.hand.length, w: S0.wcur, ...r }) + '\n'); }
        }
        return E.ROLL_IO.decide(g, p, req);
      } };
    try { await new E.Game(S, io).run(); } catch (e) { if (!(e instanceof E.GameOver)) console.error(e.message); }
    E.unseedRandom();
  }
})();
