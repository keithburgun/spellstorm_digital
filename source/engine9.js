// ===== Spellstorm engine, part 9: Puzzle Mode (fixed positions, scripted opponents, goals) and seeded randomness =====
function seededRNG(seed, st) { st = st || { a: seed >>> 0 }; const f = () => { st.a = (st.a + 0x6D2B79F5) >>> 0; let t = st.a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; f.st = st; return f; }
let _mathRandom = null;
function seedRandom(seed) { if (!_mathRandom) _mathRandom = Math.random; Math.random = seededRNG(seed); }
function seedRandomState(a) { if (!_mathRandom) _mathRandom = Math.random; Math.random = seededRNG(0, { a: a >>> 0 }); }   // continue a stream exactly where it was saved
function rngState() { return _mathRandom && Math.random.st ? Math.random.st.a : null; }
function unseedRandom() { if (_mathRandom) { Math.random = _mathRandom; _mathRandom = null; } }
// Build a mid-game position from a puzzle definition. Decks are listed top card first.
function puzzleState(D) {
  const S = newState(D.you.wiz, D.opp.wiz), mk = id => ({ u: ++S.uid, id });
  const setP = (P, d) => {
    if (d.max != null) P.max = d.max; if (d.hp != null) P.hp = d.hp;
    for (const k of ['mana', 'power', 'tier', 'shards', 'energy', 'doom']) if (d[k] != null) P[k] = d[k];
    P.hand = (d.hand || []).map(mk); P.deck = (d.deck || []).slice().reverse().map(mk); P.discard = (d.discard || []).map(mk);
  };
  setP(S.pl[0], D.you); setP(S.pl[1], D.opp);
  if (D.cloud) S.cloud = D.cloud.map(id => id ? mk(id) : null);
  if (D.sdeck) S.sdeck = D.sdeck.slice().reverse().map(mk);
  if (D.dragons) S.dragons = D.dragons.slice().reverse().map(mk);
  S.battle = D.battle || 1; S.round = D.round || 1; S.wcur = D.weather[0];
  S.wdeck = D.weather.slice(1).reverse().concat([]); while (S.wdeck.length < 8) S.wdeck.unshift('heat');
  S.init = D.youInit ? 0 : 1; S.slot = [null, null]; S.rev = [null, null]; S.phase = 'play'; S.diff = 'normal';
  S.puzzle = { id: D.id, goal: D.goal, rounds: 0, plays: 0, oppPlays: D.oppPlays || [] };
  return S;
}
// The opponent plays its scripted card for each round.
function puzzlePlay(S, p) { const P = S.puzzle, H = S.pl[p].hand, id = P.oppPlays[P.plays++]; return H.find(c => c.id === id) || H.find(c => !CARDS[c.id].junk) || H[0] || null; }
// Has the goal been met or missed?  ev: 'round' (a round just ended) | 'blast' (a Blast just scored) | 'over' (the game ended)
function puzzleJudge(S, ev, x) {
  const Z = S.puzzle, G = Z.goal, me = S.pl[0];
  if (ev === 'over') { const w = S.over && S.over.winner === 0; if (G.type === 'survive') return me.hp > 0 ? 'win' : 'fail'; return w ? 'win' : 'fail'; }
  if (ev === 'blast') { if (G.type === 'blast') return x && x[0] > x[1] ? 'win' : 'fail'; return null; }
  if (ev === 'round') {
    Z.rounds++;
    if (G.type === 'tier' && me.tier >= G.n) return 'win';
    if (Z.rounds >= G.rounds && G.type !== 'blast') return G.type === 'survive' ? (me.hp > 0 ? 'win' : 'fail') : 'fail';
  }
  return null;
}
const PUZZLE_GOAL_TEXT = G => G.type === 'kill' ? (G.rounds === 1 ? 'Win this round.' : `Win within ${G.rounds} rounds.`) : G.type === 'survive' ? (G.rounds === 1 ? 'Survive this round.' : `Survive the next ${G.rounds} rounds.`)
  : G.type === 'tier' ? `Reach Tier ${['', 'I', 'II', 'III'][G.n]} this round.` : G.type === 'blast' ? 'Win this battle’s Blast Score.' : '';
