// ===== Spellstorm engine, part 7: team modes — Co-op vs Robot Boy and Two-on-Two (rulebook "Alternate Game Modes") =====
// Outside team modes every function here behaves exactly like before.
function oppsOf(S, p) { const n = S.pl.length, r = []; for (let k = 1; k < n; k++) { const q = (p + k) % n; if (!S.pl[q].out && (!S.team || S.team[q] !== S.team[p])) r.push(q); } return r; }   // written out in full: function declarations are hoisted, so it can't wrap the older one
function nextOppOf(S, p) { if (!S.team) return nextOf(S, p); const o = oppsOf(S, p); return o.length ? o[0] : nextOf(S, p); }   // "next clockwise opponent"
function alliesOf(S, p) { if (!S.team) return []; return [...S.pl.keys()].filter(q => q !== p && !S.pl[q].out && S.team[q] === S.team[p]); }
Game.prototype.opps = function (p) { return oppsOf(this.S, p); };
Game.prototype.nextOpp = function (p) { return nextOppOf(this.S, p); };
// Healing: "When you HEAL, you may choose to heal an ally instead."
const _healTeam = Game.prototype.heal;
Game.prototype.heal = async function (p, n) {
  const S = this.S; if (!S.team || n <= 0 || this.actor !== p) return _healTeam.call(this, p, n);
  const al = alliesOf(S, p).filter(q => !S.pl[q].rb); if (!al.length) return _healTeam.call(this, p, n);
  const frac = q => S.pl[q].hp / S.pl[q].max, best = [p, ...al].sort((a, b) => frac(a) - frac(b))[0];
  const t = await this.decide(p, { k: 'player', q: `Heal ${n}: heal yourself or an ally?`, opps: [p, ...al], cpu: best });
  if (t !== p) { this.log(`${this.nm(p)} ${p === 0 ? 'heal' : 'heals'} an ally instead.`); this.ev('allyheal', p); }
  return _healTeam.call(this, t, n);
};
// Victory: if any player wins, their whole team wins; a team keeps playing when a member is eliminated.
const _checkWinTeam = Game.prototype.checkWin;
Game.prototype.checkWin = function () {
  const S = this.S, pl = S.pl, n = pl.length; if (!S.team) return _checkWinTeam.call(this);
  const alive = [...pl.keys()].filter(i => !pl[i].out), close = a => a.slice().sort((x, y) => ((x - S.init + n) % n) - ((y - S.init + n) % n))[0];
  const pick = a => a.includes(0) ? 0 : a[0];
  const eight = alive.filter(i => pl[i].shards >= 8);
  if (eight.length) { let w; if (new Set(eight.map(i => S.team[i])).size === 1) w = pick(eight); else { const mh = Math.max(...eight.map(i => pl[i].hp)); w = close(eight.filter(i => pl[i].hp === mh)); }
    S.over = { winner: w, why: 'shards', team: S.team[w] }; throw new GameOver(w, 'shards'); }
  const dying = alive.filter(i => pl[i].hp <= 0); if (!dying.length) return;
  const surv = alive.filter(i => pl[i].hp > 0);
  if (!surv.length) { const ms = Math.max(...dying.map(i => pl[i].shards)), w = close(dying.filter(i => pl[i].shards === ms)); S.over = { winner: w, why: 'tie', team: S.team[w] }; throw new GameOver(w, 'tie'); }
  for (const i of dying) this.eliminate(i);
  if (new Set(surv.map(i => S.team[i])).size === 1) { const w = pick(surv); S.over = { winner: w, why: 'health', team: S.team[w] }; throw new GameOver(w, 'health'); }
};
function robotBoyPlayer(S, level) { const mk = id => ({ u: ++S.uid, id });
  return { wiz: 'robot', rb: true, hp: 15, max: 15, mana: 0, power: { easy: 0, medium: 2, hard: 4 }[level] || 0, tier: 1, shards: 0, hand: [], deck: shuffle(RB_IDS.map(mk)), discard: [], blastMod: 0,
    blast: 0, ultUp: null, ultDown: null, doom: 0, energy: 0, research: [0, 0, 0, 0, 0, 0, 0, 0], chem: { F: 3, E: 3, W: 3 }, trap: null, dodge: 0, potions: [] }; }
function lowestIni(S) { let lo = 0; S.pl.forEach((P, i) => { if (WIZ[P.wiz].ini < WIZ[S.pl[lo].wiz].ini) lo = i; }); return lo; }
// Co-op: you and 1–3 allies against Robot Boy (he sits last, so he counters you and everyone counters him).
function newStateCoop(me, allies, level, allyDiff) {
  const S = newStateN([me, ...allies, allies[0] === 'derby' ? 'eve' : 'derby'], { ffa: false }); const last = S.pl.length - 1;
  S.pl[last] = robotBoyPlayer(S, level); for (const P of S.pl) P.shards = 0;
  S.team = S.pl.map((_, i) => i === last ? 1 : 0); S.init = lowestIni(S); S.mode = 'coop'; S.diff = level; S.rbLevel = level;
  S.aiDiff = {}; for (let i = 1; i < last; i++) S.aiDiff[i] = allyDiff || 'normal'; return S; }
// Two-on-Two: seats alternate teams (you, opponent, ally, opponent).
function newState2v2(me, ally, oppA, oppB, diff) {
  const S = newStateN([me, oppA, ally, oppB], { ffa: false }); for (const P of S.pl) P.shards = 0;
  S.team = [0, 1, 0, 1]; S.init = lowestIni(S); S.mode = '2v2'; S.diff = diff || 'normal'; return S; }
