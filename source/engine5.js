// ===== Spellstorm engine, part 5: 3–4 player support (2-player behaviour is unchanged) =====
function nextOf(S, p) { const n = S.pl.length; for (let k = 1; k < n; k++) { const q = (p + k) % n; if (!S.pl[q].out) return q; } return p; }
function oppsOf(S, p) { const n = S.pl.length, r = []; for (let k = 1; k < n; k++) { const q = (p + k) % n; if (!S.pl[q].out) r.push(q); } return r; }
function strongestOpp(S, p) { const os = oppsOf(S, p); if (os.length <= 1) return os[0] ?? nextOf(S, p); return os.slice().sort((a, b) => scoreP(S, b) - scoreP(S, a))[0]; }
function evalState(S, p) { if (S.over) return S.over.winner === p ? 1e4 : -1e4; return scoreP(S, p) - scoreP(S, strongestOpp(S, p)); }
Game.prototype.next = function (p) { return nextOf(this.S, p); };
Game.prototype.opps = function (p) { return oppsOf(this.S, p); };
Game.prototype.order = function () { const S = this.S, n = S.pl.length, r = []; for (let k = 0; k < n; k++) { const q = (S.init + k) % n; if (!S.pl[q].out) r.push(q); } return r; };
Game.prototype.loseInit = function (p) { if (this.S.init === p) { this.S.init = this.next(p); this.log(`${this.nm(p)} ${p === 0 ? 'lose' : 'loses'} the Initiative.`, 'ini'); } };
Game.prototype.giveAll = async function (p, type) { for (const q of this.opps(p)) await this.gainSpecial(q, type); };
Game.prototype.chooseOpp = async function (p, q) { const os = this.opps(p); if (os.length <= 1) return os[0] ?? this.next(p);
  return this.decide(p, { k: 'player', q, opps: os, cpu: os.slice().sort((a, b) => this.S.pl[a].hp - this.S.pl[b].hp)[0] }); };
const _checkWin2 = Game.prototype.checkWin;
Game.prototype.checkWin = function () {
  const S = this.S, pl = S.pl, n = pl.length; if (n === 2) return _checkWin2.call(this);
  const alive = [...pl.keys()].filter(i => !pl[i].out), close = a => a.slice().sort((x, y) => ((x - S.init + n) % n) - ((y - S.init + n) % n))[0];
  const eight = alive.filter(i => pl[i].shards >= 8);
  if (eight.length) { const mh = Math.max(...eight.map(i => pl[i].hp)), w = close(eight.filter(i => pl[i].hp === mh)); S.over = { winner: w, why: eight.length > 1 ? 'tie' : 'shards' }; throw new GameOver(w, S.over.why); }
  const dying = alive.filter(i => pl[i].hp <= 0); if (!dying.length) return;
  const surv = alive.filter(i => pl[i].hp > 0);
  if (!surv.length) { const ms = Math.max(...dying.map(i => pl[i].shards)), w = close(dying.filter(i => pl[i].shards === ms)); S.over = { winner: w, why: 'tie' }; throw new GameOver(w, 'tie'); }
  for (const i of dying) this.eliminate(i);
  if (surv.length === 1) { S.over = { winner: surv[0], why: 'health' }; throw new GameOver(surv[0], 'health'); }
};
Game.prototype.eliminate = function (i) {
  const S = this.S, P = S.pl[i]; P.out = true; P.hp = 0;
  if (S.init === i) S.init = this.next(i);
  const all = [...P.hand.splice(0), ...P.deck.splice(0), ...P.discard.splice(0)]; if (S.slot && S.slot[i]) { all.push(S.slot[i]); S.slot[i] = null; }
  for (const c of all) { if (CARDS[c.id].junk) S.special[c.id]++; else S.void.push(c); }
  this.log(`${this.nm(i)} ${i === 0 ? 'are' : 'is'} eliminated! ${i === 0 ? 'Your' : this.nm(i, 1, 1)} cards go to the VOID.`, 'big'); this.ev('elim', i);
};
function newStateN(wizards, o = {}) {
  const S = newState(wizards[0], wizards[1]); const mk = id => ({ u: ++S.uid, id });
  for (const w of wizards.slice(2)) { const W = WIZ[w]; const deck = ['dart', 'dart', 'block', 'block', 'pgem', 'pgem', ...W.spells].map(mk);
    S.pl.push({ wiz: w, hp: W.hp, max: W.hp, mana: 2, power: 0, tier: 1, shards: 0, hand: [], deck: shuffle(deck), discard: [], blastMod: 0,
      doom: 0, energy: w === 'may' ? 2 : 0, research: [0, 0, 0, 0, 0, 0, 0, 0], chem: { F: 3, E: 3, W: 3 }, trap: null, dodge: 0, potions: [] }); }
  S.slot = S.pl.map(() => null); S.rev = S.pl.map(() => null);
  let lo = 0; S.pl.forEach((P, i) => { if (WIZ[P.wiz].ini < WIZ[S.pl[lo].wiz].ini) lo = i; }); S.init = lo;
  if (S.pl.length > 2 && o.ffa !== false) for (const P of S.pl) P.shards = 2;
  S.mode = 'ffa'; return S;
}
