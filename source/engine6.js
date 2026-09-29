// ===== Spellstorm engine, part 6: Robot Boy (single-player opponent, from the rulebook) =====
const RB_IDS = ['rb_repair', 'rb_iceblock', 'rb_bounce', 'rb_laser', 'rb_fist', 'rb_upgrade', 'rb_hack', 'rb_drill', 'rb_blast'];
function handSize(S, q) { const P = S.pl[q]; return P.rb ? P.blast : P.hand.length; }
const perOpp = (g, p) => g.opps(p).length;                         // "Heal 1/opponent"
async function rbLoseToken(g, p) { const P = g.S.pl[p]; if (P.blast) { P.blast--; g.log('Robot Boy discards a Blast Token.'); } }
async function rbX(g, p, resolveIt) {                                // the Storm Cloud slot marked "X" is the last one
  const S = g.S, c = S.cloud[4]; if (!c) return; S.cloud[4] = null; g.refill(4);
  if (resolveIt) { g.log(`Robot Boy resolves ${CARDS[c.id].n} from the Storm Cloud’s X slot.`); await g.resolve(p, c, 'cloud'); }
  if (CARDS[c.id].junk) S.special[c.id]++; else S.void.push(c); g.log(`${CARDS[c.id].n} is VOIDED from the Storm Cloud.`);
}
Object.assign(CARDS, {
  rb_repair: { n: 'Robot Repair', el: 'W', t: 1, v: 6, wiz: 1, rb: 1, fx: async (g, p) => { const P = g.S.pl[p]; await g.heal(p, perOpp(g, p)); await g.draw(p, 1); await g.mana(p, 1);
    if (P.tier >= 2) { const it = P.discard.filter(c => c.id === 'curse' || c.id === 'ice'); if (it.length) g.voidFrom(p, it.find(c => c.id === 'curse') || it[0], P.discard); }
    if (P.tier >= 3) { await g.heal(p, 3); await g.draw(p, 1); } } },
  rb_iceblock: { n: 'Ice Block', el: 'W', t: 1, v: 6, wiz: 1, rb: 1, fx: async (g, p) => { const P = g.S.pl[p]; await g.power(p, 1); await g.heal(p, perOpp(g, p));
    if (P.tier >= 2) await g.giveAll(p, 'ice'); if (P.tier >= 3) { await g.draw(p, 1); await g.heal(p, perOpp(g, p)); } } },
  rb_bounce: { n: 'Robo Bounce', el: 'F', t: 1, v: 6, wiz: 1, rb: 1, fx: async (g, p) => { const P = g.S.pl[p]; await rbX(g, p, true); if (P.tier >= 2 && g.hasInit(p)) await g.dmg(p, 2); } },
  rb_laser: { n: 'Laser EYE', el: 'F', t: 1, v: 6, wiz: 1, rb: 1, fx: async (g, p) => { const P = g.S.pl[p]; g.gainInit(p); await g.dmg(p, 1); await rbLoseToken(g, p);
    if (P.tier >= 2) await g.giveAll(p, 'curse'); if (P.tier >= 3) await g.mana(p, 1); } },
  rb_fist: { n: 'Robo-Fist', el: 'F', t: 1, v: 6, wiz: 1, rb: 1, fx: async (g, p) => { const P = g.S.pl[p]; await g.mana(p, 1); await rbLoseToken(g, p); await g.dmg(p, 1);
    if (P.tier >= 2) await g.dmg(p, 1); if (P.tier >= 3) await g.dmg(p, 1); } },
  rb_upgrade: { n: 'Upgrade', el: 'E', t: 1, v: 6, wiz: 1, rb: 1, fx: async (g, p) => { const P = g.S.pl[p]; await g.power(p, 2); await g.mana(p, 1); await rbX(g, p, false);
    if (P.tier >= 3) { await g.power(p, 1); await g.mana(p, 1); } } },
  rb_hack: { n: 'Hack You Badly', el: 'E', t: 1, v: 6, wiz: 1, rb: 1, fx: async (g, p) => { const P = g.S.pl[p]; await g.power(p, 1); await g.draw(p, 1); await g.mana(p, 1);
    if (P.tier >= 2) for (const q of g.opps(p)) await g.randomDiscard(q, 1); if (P.tier >= 3) await g.power(p, 1); } },
  rb_drill: { n: 'Drill Ya', el: 'E', t: 1, v: 6, wiz: 1, rb: 1, fx: async (g, p) => { const P = g.S.pl[p]; await g.power(p, 1); await g.mana(p, 1);
    for (const q of g.opps(p)) if (isEl(g.S.rev[q], 'W')) await g.gainSpecial(q, 'ash'); if (P.tier >= 3) await g.dmg(p, 1); } },
  rb_blast: { n: 'Blast You', el: 'W', t: 1, v: 6, wiz: 1, rb: 1, fx: async (g, p) => { const P = g.S.pl[p]; await g.draw(p, 2);
    if (P.tier >= 2) await g.heal(p, 1); if (P.tier >= 3) await g.heal(p, perOpp(g, p)); } },
});
WIZ.robot = { n: 'Robot Boy', short: 'Robot Boy', hp: 15, ini: 0, cost: 6, un: 'El3mEnt4l CaScAdE#%$', els: ['F', 'W', 'E'], spells: [],
  start: 'Mode Switch: one card face-up and one face-down on his card. No Traction: loses a Blast Token whenever he reveals an ICE.',
  ut: 'Resolve the face-up, then the face-down card on his card, discard both, then draw a new pair.' };
// --- Robot Boy has no hand: drawing gains Blast Tokens (max 6), random discards lose them ---
const _drawRB = Game.prototype.draw;
Game.prototype.draw = async function (p, n) { const P = this.S.pl[p]; if (!P.rb) return _drawRB.call(this, p, n); const k = Math.max(0, Math.min(n, 6 - P.blast)); P.blast += k; return k; };
const _rdRB = Game.prototype.randomDiscard;
Game.prototype.randomDiscard = async function (p, n) { const P = this.S.pl[p]; if (!P.rb) return _rdRB.call(this, p, n); const k = Math.min(n, P.blast); P.blast -= k; if (k) this.log(`Robot Boy loses ${k} Blast Token${k > 1 ? 's' : ''}.`); };
const _gcRB = Game.prototype.gainCard;
Game.prototype.gainCard = async function (p, o) { if (this.S.pl[p].rb) return null; return _gcRB.call(this, p, o); };   // never gains from the Storm Cloud
const _ouRB = Game.prototype.offerUlt;
Game.prototype.offerUlt = async function (p, free) { if (this.S.pl[p].rb) return; return _ouRB.call(this, p, free); };  // his Ultimate fires at end of turn instead
const _epRB = Game.prototype.ensurePlayable;
Game.prototype.ensurePlayable = async function (p) { if (this.S.pl[p].rb) return true; return _epRB.call(this, p); };
const _gdRB = Game.prototype.gainDragon;
Game.prototype.gainDragon = async function (p) {                     // Tier III overflow: he instantly resolves the top Dragon
  if (!this.S.pl[p].rb) return _gdRB.call(this, p); const S = this.S, top = S.dragons[S.dragons.length - 1];
  if (!top) { this.log('The Dragon deck is empty: deal 2 damage and gain 2 Storm Shards.'); await this.dmg(p, 2); await this.shards(p, 2); return; }
  this.log(`Robot Boy resolves ${CARDS[top.id].n}!`, 'big'); await this.resolve(p, top, 'copy'); S.dragons.pop(); S.dragons.unshift(top);
};
Game.prototype.rbTop = function (p) { const P = this.S.pl[p]; if (!P.deck.length) this.reshuffle(p); return P.deck.pop() || null; };
Game.prototype.rbNoTraction = function (p, c) { const P = this.S.pl[p]; if (c && c.id === 'ice' && P.blast) { P.blast--; this.log('No Traction: Robot Boy revealed an ICE and loses a Blast Token.'); } };
// If he reveals ICE/CURSE/ASH it still counters as usual; then he reveals more until he hits one of his own cards.
Game.prototype.rbRevealMore = function () {
  const S = this.S; S.rbMore = S.rbMore || S.pl.map(() => []);
  for (const p of S.pl.keys()) { const P = S.pl[p], c = S.slot[p]; S.rbMore[p] = []; if (!P.rb || !c) continue;
    this.rbNoTraction(p, c); let cur = c;
    while (CARDS[cur.id].junk) { const nx = this.rbTop(p); if (!nx) break; S.rbMore[p].push(nx); this.rbNoTraction(p, nx); cur = nx; }
    if (S.rbMore[p].length) this.log(`Robot Boy revealed ${CARDS[c.id].n}, so he reveals more: ${S.rbMore[p].map(x => CARDS[x.id].n).join(', ')}.`); }
};
// El3mEnt4l CaScAdE#%$ — at the end of his turn, if he has 6 mana.
Game.prototype.rbEndTurn = async function (p) {
  const P = this.S.pl[p]; if (P.mana < 6 || !P.ultUp) return; P.mana -= 6;
  this.log('Robot Boy unleashes El3mEnt4l CaScAdE#%$!', 'big'); if (!this.io.sim && this.io.fx) this.io.fx('ult', p); await this.pause(500);
  const up = P.ultUp, down = P.ultDown; P.ultUp = P.ultDown = null;
  this.log(`He resolves ${CARDS[up.id].n}${down ? `, then the face-down ${CARDS[down.id].n}` : ''}.`);
  await this.resolve(p, up, 'copy'); if (down) { this.rbNoTraction(p, down); await this.resolve(p, down, 'copy'); }
  P.discard.push(up); if (down) P.discard.push(down);
  P.ultUp = this.rbTop(p); P.ultDown = this.rbTop(p); this.rbNoTraction(p, P.ultUp);
};
const _gsRB = Game.prototype.gameStart;
Game.prototype.gameStart = async function () { await _gsRB.call(this);
  for (const p of this.S.pl.keys()) { const P = this.S.pl[p]; if (!P.rb) continue;
    P.ultUp = this.rbTop(p); P.ultDown = this.rbTop(p); this.rbNoTraction(p, P.ultUp);
    this.log(`Mode Switch: Robot Boy places ${CARDS[P.ultUp.id].n} face-up and another card face-down on his card.`); } };
// Solo game vs Robot Boy. Levels: easy / medium / hard = 0 / 2 / 4 starting Power.
function newStateRB(humanWiz, level) {
  const S = newState(humanWiz, humanWiz === 'derby' ? 'eve' : 'derby'); const mk = id => ({ u: ++S.uid, id });
  S.pl[1] = { wiz: 'robot', rb: true, hp: 15, max: 15, mana: 0, power: { easy: 0, medium: 2, hard: 4 }[level] || 0, tier: 1, shards: 0, hand: [], deck: shuffle(RB_IDS.map(mk)), discard: [], blastMod: 0,
    blast: 0, ultUp: null, ultDown: null, doom: 0, energy: 0, research: [0, 0, 0, 0, 0, 0, 0, 0], chem: { F: 3, E: 3, W: 3 }, trap: null, dodge: 0, potions: [] };
  S.init = 1;                                                          // Robot Boy's Initiative rating is 0
  S.mode = 'rb'; S.diff = level; return S;
}

// ---------- pacing: your own draws and random discards happen one card at a time, so they can be seen ----------
const _drawPace = Game.prototype.draw;
Game.prototype.draw = async function (p, n) { if (this.io.sim || p !== 0 || this.S.blast || n < 1 || this.S.pl[p].rb) return _drawPace.call(this, p, n);
  let k = 0; for (let i = 0; i < n; i++) { const got = await _drawPace.call(this, p, 1); k += got; if (got) await this.pause(280); } return k; };
const _rdPace = Game.prototype.randomDiscard;
Game.prototype.randomDiscard = async function (p, n) { if (this.io.sim || p !== 0 || this.S.blast || this.S.pl[p].rb) return _rdPace.call(this, p, n);
  for (let i = 0; i < n; i++) { if (!this.S.pl[p].hand.length) return; await _rdPace.call(this, p, 1); await this.pause(450); } };
