// ===== Spellstorm rules engine (no DOM) =====
const ELN = { F: 'Fire', W: 'Water', E: 'Earth' };
const BEATS = { F: 'E', E: 'W', W: 'F' }; // key COUNTERS value
class GameOver { constructor(w, why) { this.winner = w; this.why = why; } }

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---------- card helpers used by effects ----------
const isEl = (c, el) => c && CARDS[c.id].el === el;

const CARDS = {
  // starters
  dart: { n: 'Magic Dart', el: 'F', t: 1, v: 3, ult: 1, fx: async (g, p) => { await g.mana(p, 1); if (g.hasInit(p)) await g.dmg(p, 1); } },
  block: { n: 'Block', el: 'W', t: 1, v: 3, fx: async (g, p) => { g.gainInit(p); const n = g.S.rev.filter(c => isEl(c, 'F')).length; if (n) await g.heal(p, n); } },
  pgem: { n: 'Power Gem', el: 'E', t: 1, v: 4, disc: 1,
    fx: async (g, p) => { await g.power(p, 1); const c = await g.gainCard(p); if (c && g.S.pl[p].hand.includes(c)) await g.pause(650); if (c) await g.discardFrom(p, c, 'hand'); },
    dfx: async (g, p) => { await g.power(p, 1); } },
  // essences
  essF: { n: 'Fire Essence', el: 'F', t: 1, v: 7, ess: 1, fx: async (g, p, x) => { await g.dmg(p, 1); await g.gainCard(p, { anyTier: 1, maxTier: 2, el: 'F' }); x.dest = 'void'; } },
  essW: { n: 'Water Essence', el: 'W', t: 1, v: 7, ess: 1, fx: async (g, p, x) => { await g.mana(p, 1); await g.gainCard(p, { anyTier: 1, maxTier: 2, el: 'W' }); x.dest = 'void'; } },
  essE: { n: 'Earth Essence', el: 'E', t: 1, v: 7, ess: 1, disc: 1,
    fx: async (g, p, x) => { await g.power(p, 1); await g.gainCard(p, { anyTier: 1, maxTier: 2, el: 'E' }); x.dest = 'void'; },
    dfx: async (g, p) => { await g.power(p, 1); } },
  // wizard spells
  coffee: { n: 'Coffee Run', el: 'E', t: 1, v: 7, wiz: 1, ult: 1, fx: async (g, p) => { const e2 = ED2(g.S); await g.power(p, e2 ? 1 : 2); const c = await g.gainCard(p); if (c && CARDS[c.id].el === 'E') { if (e2) await g.power(p, 1); g.gainInit(p); } } },   // 2E: +1 Power, +1 more only if you gained an Earth card
  charge: { n: 'Reckless Charge', el: 'F', t: 1, v: 7, wiz: 1, ult: 1, fx: async (g, p) => { const e2 = ED2(g.S); await g.mana(p, e2 ? 1 : 2); await g.power(p, 1); await g.dmg(p, 1); await g.gainSpecial(p, 'ash'); if (g.hasInit(p)) { if (e2) await g.mana(p, 1); await g.dmg(p, 1); } } },   // 2E: +1 Mana, +1 more only with the Initiative
  punch: { n: 'Face Punch', el: 'W', t: 1, v: 7, wiz: 1, ult: 1, fx: async (g, p) => {
    g.gainInit(p); const t = await g.askPlayer(p, 'Steal 1 mana from which player? They also discard a random card.', g.nextOpp(p));
    const T = g.S.pl[t]; const take = Math.min(1, T.mana); T.mana -= take; g.S.pl[p].mana += take;
    g.log(`${g.nm(p)} stole ${take} mana from ${g.nm(t, 1)}.`); await g.randomDiscard(t, 1); } },
  riot: { n: 'Riot', el: 'F', t: 1, v: 7, wiz: 1, ult: 1, fx: async (g, p) => {
    const P = g.S.pl[p]; const h = P.hand.splice(0); P.discard.push(...h); const n = h.filter(c => isEl(c, 'E')).length;
    g.log(`${g.nm(p)} discarded ${h.length} card${h.length === 1 ? '' : 's'} (${n} Earth).`); if (n) await g.dmg(p, n); await g.draw(p, 2); } },
  // earth
  twopow: { n: 'Two Power', el: 'E', t: 1, v: 8, disc: 1, fx: async (g, p) => { await g.power(p, 2); await g.gainCard(p); }, dfx: async (g, p) => { await g.power(p, 2); } },
  opal: { n: 'Opal', el: 'E', t: 3, v: 14, disc: 1, fx: async (g, p) => { await g.draw(p, 1); await g.power(p, 2); await g.mana(p, 2); await g.gainCard(p); }, dfx: async (g, p) => { await g.power(p, 2); } },
  sift: { n: 'Sift', el: 'E', t: 1, v: 4, fx: async (g, p) => {
    await g.power(p, 1); const P = g.S.pl[p]; const top = [];
    for (let i = 0; i < 2; i++) { if (!P.deck.length) g.reshuffle(p); if (!P.deck.length) break; top.push(P.deck.pop()); }
    P.deck.push(...top.slice().reverse());
    if (!top.length) { g.nofx('Sift: no cards left in the deck to look at.'); return; }
    const pick = await g.decide(p, { k: 'pick', q: 'Sift: choose cards from the top of your deck to discard. The rest stay on top.', items: top, min: 0, max: top.length, cpu: it => it.filter(c => CARDS[c.id].junk || CARDS[c.id].v <= 3 || CARDS[c.id].disc) });
    for (const c of pick) await g.discardFrom(p, c, 'deck'); } },
  diamond: { n: 'Diamond', el: 'E', t: 1, v: 5, disc: 1, fx: async (g, p) => {
    const P = g.S.pl[p]; if (P.hand.length < 3) { g.log(`${g.nm(p)} couldn't discard 3 cards.`); return; }
    const pick = await g.decide(p, { k: 'pick', q: 'Diamond: discard exactly 3 cards.', items: P.hand.slice(), min: 3, max: 3, cpu: it => cheapest(it, 3) });
    for (const c of pick) await g.discardFrom(p, c, 'hand'); await g.power(p, 3); }, dfx: async (g, p) => { await g.power(p, 1); } },
  spirit: { n: 'Spirit Crystal', el: 'E', t: 1, v: 5, disc: 1, fx: async (g, p) => {
    await g.draw(p, 1); const P = g.S.pl[p]; const es = P.hand.filter(c => isEl(c, 'E')); if (!es.length) { g.nofx('Spirit Crystal: no Earth card in hand to resolve.'); return; }
    const [c] = await g.decide(p, { k: 'pick', q: 'Spirit Crystal: reveal an Earth card from your hand to resolve, then discard it.', items: es, min: 1, max: 1, cpu: it => [best(it)] });
    await g.resolveFromHand(p, c); }, dfx: async (g, p) => { await g.power(p, 1); } },
  amber: { n: 'Amber', el: 'E', t: 1, v: 7, disc: 1, fx: async (g, p) => { if (ED2(g.S)) { await g.gainCard(p, { el: 'E' }); await g.gainCard(p, { el: 'E' }); return; }   // 2E: you may gain up to two Earth cards
    await g.power(p, 1); await g.gainCard(p, { must: 1 }); await g.gainCard(p, { must: 1 }); }, dfx: async (g, p) => { await g.power(p, 1); } },
  shatter: { n: 'Shatter', el: 'E', t: 2, v: 7, disc: 1, fx: async (g, p) => {
    const P = g.S.pl[p]; const it = P.hand.filter(c => !CARDS[c.id].wiz); if (!it.length) { g.nofx('Shatter: no cards in hand to VOID.'); return; }
    const pick = await g.decide(p, { k: 'pick', q: 'Shatter: VOID up to 2 cards from your hand. Power Up for each.', items: it, min: 0, max: 2, cpu: x => x.filter(c => CARDS[c.id].junk).slice(0, 2) });
    let n = 0; for (const c of pick) if (g.voidFrom(p, c, P.hand)) n++; if (n) await g.power(p, n); }, dfx: async (g, p) => { await g.power(p, 1); } },
  meteor: { n: 'Meteorite', el: 'E', t: 1, v: 4, disc: 1, fx: async (g, p) => {
    await g.damage(p, 1); const slots = g.S.cloud.map((c, i) => c ? i : -1).filter(i => i >= 0); if (!slots.length) { g.nofx('Meteorite: the Storm Cloud is empty.'); return; }
    const i = await g.decide(p, { k: 'gain', q: 'Meteorite: you may resolve any Storm Cloud card (any Tier), then VOID it.', slots, optional: 1, verb: 'Resolve' });
    if (i < 0) return; const c = g.S.cloud[i]; g.S.cloud[i] = null; g.refill(i);
    g.log(`${g.nm(p)} resolved ${CARDS[c.id].n} from the Storm Cloud.`); await g.resolve(p, c, 'cloud'); g.S.void.push(c); }, dfx: async (g, p) => { await g.damage(p, 1); } },
  blood: { n: 'Bloodstone', el: 'E', t: 1, v: 5, disc: 1, fx: async (g, p) => {
    if (ED2(g.S)) {   // 2E: you may take 1 or 2 damage, then draw that many cards
      const P = g.S.pl[p], safe = Math.max(0, P.hp - 1), opts = ['Take 1 damage, draw 1', 'Take 2 damage, draw 2', 'Neither'], dis = [safe < 1, safe < 2, false];
      const k = await g.decide(p, { k: 'opt', q: 'Bloodstone: you may take 1 or 2 damage, then draw that many cards.', opts, dis, cpu: P.hp >= 7 ? (dis[1] ? 0 : 1) : P.hp >= 4 ? (dis[0] ? 2 : 0) : 2 });
      if (k < 2) { const n = k + 1; await g.damage(p, n); if (!g.S.over) await g.draw(p, n); } return; }
    await g.mana(p, 1); await g.damage(p, 1); await g.voidOneHandOrDiscard(p, 'Bloodstone: you may VOID a card from your hand or discard pile.'); },
    dfx: async (g, p) => { if (ED2(g.S)) { await g.damage(p, 1); return; } await g.mana(p, 1); } },   // 2E discard effect: take 1 damage
  quake: { n: 'Quake', el: 'E', t: 1, v: 7, disc: 1, fx: async (g, p) => { for (const o of g.opps(p)) { g.losePower(o, 2); await g.gainSpecial(o, 'ash'); } await g.gainCard(p); }, dfx: async (g, p) => { await g.power(p, 1); } },
  threepow: { n: 'Three Power', el: 'E', t: 2, v: 10, disc: 1, fx: async (g, p) => { await g.power(p, 2); await g.gainCard(p); if (g.S.rev.some(c => isEl(c, 'W'))) await g.power(p, 1); }, dfx: async (g, p) => { await g.power(p, 2); } },
  // fire
  swamp: { n: 'Swamp Silt', el: 'F', t: 1, v: 7, fx: async (g, p) => { await g.draw(p, 1); const h = g.S.init; g.loseInit(h); await g.giveAll(p, 'curse'); } },
  lavabat: { n: 'Lava Bat', el: 'F', t: 1, v: 5, fx: async (g, p) => {
    await g.mana(p, 1); const S = g.S; const it = [];
    for (const q of S.pl.keys()) for (const c of S.pl[q].discard) if (isEl(c, 'F') && !CARDS[c.id].wiz) it.push(c);
    if (!it.length) g.nofx('Lava Bat: no Fire cards in any discard pile to move.');
    if (it.length) {
      const pick = await g.decide(p, { k: 'pick', q: 'Lava Bat: you may move a Fire card to the other discard pile.', items: it, owner: c => { const q = S.pl.findIndex(P => P.discard.includes(c)); return q === 0 ? 'Your discard' : WIZ[S.pl[q].wiz].short + '’s discard'; }, min: 0, max: 1,
        cpu: x => { const mine = x.filter(c => S.pl[p].discard.includes(c) && CARDS[c.id].junk); if (mine.length) return [mine[0]]; const th = x.filter(c => !S.pl[p].discard.includes(c) && !CARDS[c.id].junk); const b = th.length ? best(th) : null; return b && CARDS[b.id].v >= 6 ? [b] : []; } });
      for (const c of pick) { const from = S.pl.findIndex(P => P.discard.includes(c)), to = from === p ? await g.chooseOpp(p, 'Lava Bat: move it to which opponent’s discard pile?') : p; S.pl[from].discard.splice(S.pl[from].discard.indexOf(c), 1); if (S.pl[to].rb && !CARDS[c.id].junk) S.void.push(c); else S.pl[to].discard.push(c); g.log(`${g.nm(p)} moved ${CARDS[c.id].n} to ${g.nm(to, 1, 1)} discard.`); }
    }
    g.gainInit(p); } },
  ruby: { n: 'Ruby', el: 'F', t: 1, v: 6, fx: async (g, p) => {
    const P = g.S.pl[p]; const got = [];
    for (let i = 0; i < 3; i++) { if (!P.deck.length) g.reshuffle(p); if (!P.deck.length) break; const c = P.deck[P.deck.length - 1]; got.push(c); await g.discardFrom(p, c, 'deck'); }
    const n = got.filter(c => isEl(c, 'F')).length; const vo = got.filter(c => !CARDS[c.id].wiz && P.discard.includes(c));
    g.log(`${g.nm(p)} discarded ${got.map(c => CARDS[c.id].n).join(', ') || 'nothing'} from the top of the deck.`);
    if (ED2(g.S)) { if (n) await g.dmg(p, n); return; }   // 2E: just the damage
    if (!n && !vo.length) { g.nofx('Ruby: no Fire cards and nothing to VOID.'); return; }
    const opts = [`Deal ${n} damage`, 'VOID one of them', 'Do neither'];
    const k = await g.decide(p, { k: 'opt', q: 'Ruby: choose one.', opts, dis: [n === 0, !vo.length, false], cpu: n > 0 ? 0 : (vo.some(c => CARDS[c.id].junk) ? 1 : 2) });
    if (k === 0) await g.dmg(p, n);
    else if (k === 1) { const [c] = await g.decide(p, { k: 'pick', q: 'Ruby: choose a card to VOID.', items: vo, min: 1, max: 1, cpu: x => [worst(x)] }); g.voidFrom(p, c, P.discard); } } },
  shock: { n: 'Shockwave', el: 'F', t: 2, v: 9, fx: async (g, p) => {
    if (ED2(g.S)) { const t = await g.askPlayer(p, 'Shockwave: choose a player. They take 1 damage and lose 2 Power and 2 Mana.', g.nextOpp(p)), T = g.S.pl[t];   // 2E
      await g.damage(t, 1, p); g.losePower(t, 2); const m = Math.min(2, T.mana || 0); if (m) { T.mana -= m; g.log(`${g.nm(t)} ${t === 0 ? 'lose' : 'loses'} ${m} mana.`); } return; }   // 2E (fixed): 1 damage total
    const t = await g.askPlayer(p, 'Shockwave: choose a player. They lose 2 Power, discard a random card, lose Initiative and take 1 damage.', g.nextOpp(p));
    g.losePower(t, 2); await g.randomDiscard(t, 1); g.loseInit(t); await g.damage(t, 1, p); } },
  rapid: { n: 'Rapid Fire', el: 'F', t: 2, v: 10, fx: async (g, p, x) => {
    if (ED2(g.S)) { if (g.hasInit(p)) { await g.dmg(p, 2); await g.gainSpecial(p, 'ash'); if (x.how === 'play' || x.how === 'hand') { x.dest = 'hand'; g.log('Rapid Fire returns to the hand.'); } } else g.nofx('Rapid Fire: no Initiative, so no effect.'); return; }   // 2E
    await g.draw(p, 1); if (g.hasInit(p)) { await g.dmg(p, 2); if (x.how === 'play' || x.how === 'hand') { if (await g.yn(p, 'Rapid Fire: return it to your hand?', true)) x.dest = 'hand'; } } } },
  obsidian: { n: 'Obsidian', el: 'F', t: 2, v: 6, fx: async (g, p) => {
    await g.damage(p, 1); const P = g.S.pl[p]; if (P.mana >= 2) { P.mana -= 2; g.log(`${g.nm(p)} lost 2 mana.`); await g.offerUlt(p, true); } else g.log(`${g.nm(p)} didn't have 2 mana to lose.`); } },
  lantern: { n: 'Lantern', el: 'F', t: 1, v: 6, fx: async (g, p, x) => {
    if (ED2(g.S)) { await g.mana(p, 2); if (g.S.rev.some(c => isEl(c, 'W'))) { g.log('The Lantern flares!'); for (const q of g.order()) { await g.damage(q, 1, p); await g.gainSpecial(q, 'curse'); } } return; }   // 2E
    await g.mana(p, 2); if (isEl(g.S.rev[g.next(p)], 'W')) { x.dest = 'void'; g.log('The Lantern goes out.'); await g.gainSpecial(p, 'curse'); await g.damage(p, 1); } } },
  heart: { n: 'Heart Gem', el: 'F', t: 1, v: 6, disc: 1, ult: 1, fx: async (g, p) => { await g.heal(p, 3); await g.gainSpecial(p, 'curse'); }, dfx: async (g, p) => { await g.damage(p, 1); } },
  manafont: { n: 'Mana Font', el: 'F', t: 1, v: 5, disc: 1, fx: async (g, p) => {
    if (ED2(g.S)) { const P = g.S.pl[p], ws = P.hand.filter(c => isEl(c, 'W')); if (!ws.length) { g.log('Mana Font: no Water card to discard.'); return; }   // 2E: discard a Water card from your hand
      const [c] = await g.decide(p, { k: 'pick', q: 'Mana Font: discard a Water card. If you did, gain 3 mana.', items: ws, min: 1, max: 1, cpu: x => [x.slice().sort((a, b) => CARDS[a.id].v - CARDS[b.id].v)[0]] });
      await g.discardFrom(p, c, 'hand'); await g.mana(p, 3); return; }
    const slots = g.S.cloud.map((c, i) => isEl(c, 'W') ? i : -1).filter(i => i >= 0); if (!slots.length) { g.nofx('Mana Font: no Water card in the Storm Cloud.'); return; }
    const i = await g.decide(p, { k: 'gain', q: 'Mana Font: VOID a Water card in the Storm Cloud.', slots, optional: 0, verb: 'VOID' });
    const c = g.S.cloud[i]; g.S.cloud[i] = null; g.S.void.push(c); g.refill(i); g.log(`${g.nm(p)} voided ${CARDS[c.id].n} from the Storm Cloud.`); await g.mana(p, 3); },
    dfx: async (g, p) => { if (!ED2(g.S)) await g.damage(p, 1); await g.mana(p, 1); } },   // 2E: no damage
  flame: { n: 'Flame', el: 'F', t: 1, v: 6, ult: 1, fx: async (g, p) => {
    await g.dmg(p, 1); const fs = g.S.pl[p].hand.filter(c => isEl(c, 'F') && !CARDS[c.id].junk); if (!fs.length) { g.nofx('Flame: no other Fire card in hand to resolve.'); return; }   // ICE / ASH / CURSE have nothing to resolve
    const [c] = await g.decide(p, { k: 'pick', q: 'Flame: resolve and discard a different Fire card from your hand.', items: fs, min: 1, max: 1, cpu: it => { const b = best(it.filter(c => !CARDS[c.id].junk)); if (b && CARDS[b.id].v >= 6) return [b]; const j = it.find(c => CARDS[c.id].junk); return [j || b]; } });
    await g.resolveFromHand(p, c); } },
  fb2: { n: 'Fireball II', el: 'F', t: 3, v: 14, fx: async (g, p) => { await g.dmg(p, 2); if (g.hasInit(p)) await g.dmg(p, 2); else g.nofx('Fireball II: no Initiative, no extra damage.'); } },
  cross: { n: 'Crossfire', el: 'F', t: 2, v: 9, fx: async (g, p, x) => { if (!g.hasInit(p)) { g.nofx('Crossfire: no Initiative, so no damage.'); return; } const t = await g.chooseOpp(p, 'Crossfire: deal 3 damage to which opponent?'); await g.damage(t, 3, p); g.loseInit(p); x.dest = 'to' + t; } },
  fb: { n: 'Fireball', el: 'F', t: 1, v: 7, fx: async (g, p) => { await g.dmg(p, 1); await g.gainSpecial(p, 'ash'); if (g.hasInit(p)) { await g.dmg(p, 2); g.loseInit(p); } else g.nofx('Fireball: no Initiative, no extra damage.'); } },
  // water
  arctite: { n: 'Arctite', el: 'W', t: 3, v: 12, fx: async (g, p) => { await g.draw(p, 2); if (ED2(g.S)) { for (const q of g.opps(p)) await g.randomDiscard(q, 2); return; }   // 2E: opponents discard 2 random cards
    await g.heal(p, 2); await g.giveAll(p, 'ice'); } },
  iceflume: { n: 'Ice Flume', el: 'W', t: 2, v: 8, fx: async (g, p) => {
    await g.giveAll(p, 'ice'); const P = g.S.pl[p]; const it = [...P.hand, ...P.discard].filter(c => c.id === 'ice');
    if (!it.length) g.nofx('Ice Flume: no ICE in hand or discard to VOID.');
    if (it.length) { const pick = await g.decide(p, { k: 'pick', q: 'Ice Flume: you may VOID an ICE from your hand or discard pile.', items: it, min: 0, max: 1, cpu: x => [x.find(c => P.hand.includes(c)) || x[0]] });
      for (const c of pick) g.voidFrom(p, c, P.hand.includes(c) ? P.hand : P.discard); }
    g.gainInit(p); } },
  frost: { n: 'Frost Magic', el: 'W', t: 1, v: 6, fx: async (g, p) => { await g.heal(p, 1); g.losePower(p, 1); await g.giveAll(p, 'ice'); } },
  lapis: { n: 'Lapis', el: 'W', t: 1, v: 5, fx: async (g, p) => {
    await g.draw(p, 1); const P = g.S.pl[p]; if (!P.hand.length) { g.nofx('Lapis: no cards in hand to discard.'); return; }
    const pick = await g.decide(p, { k: 'pick', q: 'Lapis: you may discard up to 2 cards. Heal 1 for each Water card discarded.', items: P.hand.slice(), min: 0, max: 2,
      cpu: it => { const r = it.filter(c => c.id === 'ice'); if (P.hp < P.max - 1) r.push(...it.filter(c => isEl(c, 'W') && c.id !== 'ice' && CARDS[c.id].v <= 5)); return r.slice(0, 2); } });
    let n = 0; for (const c of pick) { if (isEl(c, 'W')) n++; await g.discardFrom(p, c, 'hand'); } if (n) await g.heal(p, n); } },
  leap: { n: 'Leap', el: 'W', t: 2, v: 8, fx: async (g, p) => { g.gainInit(p); await g.heal(p, 1); if (ED2(g.S)) { await g.voidOneHandOrDiscard(p, 'Leap: VOID a card from your hand or discard pile.', true); return; }   // 2E: always, and required
    if (g.opps(p).some(q => isEl(g.S.rev[q], 'F'))) await g.voidOneHandOrDiscard(p, 'Leap: you may VOID a card from your hand or discard pile.'); else g.nofx('Leap: no opponent revealed Fire, so no VOID.'); } },
  moon: { n: 'Moonstone', el: 'W', t: 3, v: 11, disc: 1, fx: async (g, p) => { await g.heal(p, 4); }, dfx: async (g, p) => { await g.heal(p, 2); } },
  reflect: { n: 'Reflect', el: 'W', t: 2, v: 10, fx: async (g, p) => { await g.draw(p, 1); g.gainInit(p); await g.heal(p, 1); for (const q of g.S.pl.keys()) if (isEl(g.S.rev[q], 'F')) await g.damage(q, 2, p); } },
  sapph: { n: 'Sapphire', el: 'W', t: 1, v: 6, ult: 1, fx: async (g, p) => { await g.draw(p, 1); await g.heal(p, 1); await g.gainSpecial(p, 'ash'); } },
  step: { n: 'Step', el: 'W', t: 1, v: 5, disc: 1, fx: async (g, p) => { if (g.hasInit(p)) await g.heal(p, 1); else g.gainInit(p); }, dfx: async (g, p) => { g.gainInit(p); } },
  twin: { n: 'Twin Sapphire', el: 'W', t: 2, v: 9, ult: 1, fx: async (g, p) => { await g.draw(p, 1); await g.heal(p, 2); } },
  ultw: { n: 'Ultimate', el: 'W', t: 1, v: 5, ult: 1, fx: async (g, p) => {
    const P = g.S.pl[p]; const es = P.hand.filter(c => isEl(c, 'E') && !CARDS[c.id].wiz); if (!es.length) { g.nofx('Ultimate: no Earth card in hand to VOID.'); return; }
    const pick = await g.decide(p, { k: 'pick', q: 'Ultimate: you may VOID an Earth card from your hand to gain 3 mana.', items: es, min: 0, max: 1, cpu: it => [worst(it)] });
    if (pick.length && g.voidFrom(p, pick[0], P.hand)) await g.mana(p, 3); } },
  wave: { n: 'Wave', el: 'W', t: 2, v: 8, fx: async (g, p) => {
    await g.mana(p, 3); const S = g.S;
    const t = await g.askPlayer(p, 'Wave: choose a player to discard their hand and draw a new hand of 4.', S.pl[p].hand.length < 4 || S.pl[p].hand.some(c => CARDS[c.id].junk) ? p : g.nextOpp(p));
    const T = S.pl[t]; for (const c of T.hand.slice()) await g.discardFrom(t, c, 'hand'); if (T.rb) T.blast = 0; await g.draw(t, 4); } },
  // dragons
  dEarth: { n: 'Earth Dragon', el: 'E', t: 4, v: 30, drag: 1, ult: 1, fx: async (g, p) => { await g.gainCard(p); await g.gainCard(p); await g.dmg(p, 2); await g.shards(p, 1); await g.giveAll(p, 'ash'); } },
  dFire: { n: 'Fire Dragon', el: 'F', t: 4, v: 30, drag: 1, ult: 1, fx: async (g, p) => { const t = await g.askPlayer(p, 'Fire Dragon: deal 4 damage to which player?', g.nextOpp(p)); await g.damage(t, 4, p); await g.mana(p, 2); } },
  dIce: { n: 'Ice Dragon', el: 'W', t: 4, v: 30, drag: 1, ult: 1, fx: async (g, p) => { await g.heal(p, 3); await g.shards(p, 1); await g.giveAll(p, 'ice'); } },
  dStorm: { n: 'Storm Dragon', el: 'W', t: 4, v: 30, drag: 1, ult: 1, fx: async (g, p) => { await g.dmg(p, 3); await g.shards(p, 1); } },
  dWind: { n: 'Wind Dragon', el: 'F', t: 4, v: 30, drag: 1, ult: 1, fx: async (g, p) => {
    g.gainInit(p); await g.shards(p, 1); const P = g.S.pl[p]; if (!P.hand.length) { g.nofx('Wind Dragon: no cards in hand to resolve.'); return; }
    // one card at a time, so the order is clear and the second choice is made from the hand as it is after the first resolves
    const done = [];
    for (const nth of ['first', 'second']) {
      const items = P.hand.filter(c => !CARDS[c.id].junk && !done.includes(c));
      if (!items.length) { if (nth === 'first') g.nofx('Wind Dragon: no card in hand to resolve.'); break; }
      const [c] = await g.decide(p, { k: 'pick', q: `Wind Dragon: pick the ${nth} card to resolve (it stays in your hand). You may skip.`, items, min: 0, max: 1,
        cpu: it => it.slice().sort((a, b) => CARDS[b.id].v - CARDS[a.id].v).slice(0, 1) });
      if (!c) break;
      const i = P.hand.indexOf(c); if (i < 0) break;
      P.hand.splice(i, 1); g.log(`Wind Dragon: ${g.nm(p)} ${p === 0 ? 'resolve' : 'resolves'} ${CARDS[c.id].n} (${nth}); it stays in hand.`);
      await g.resolve(p, c, 'copy'); if (!P.hand.includes(c)) P.hand.splice(Math.min(i, P.hand.length), 0, c); done.push(c);
      if (g.S.over) break;
    } } },
  // special
  ice: { n: 'ICE', el: 'W', t: 0, v: 0, junk: 1, disc: 1, dfx: async (g, p, o) => { if (o && o.regroup) { g.S.pl[p].blastMod -= 1; g.log(`ICE: −1 to ${g.nm(p, 1, 1)} Blast Score.`); } } },
  ash: { n: 'ASH', el: 'E', t: 0, v: 0, junk: 1, disc: 1, dfx: async (g, p) => { g.losePower(p, 1); } },
  curse: { n: 'CURSE', el: 'F', t: 0, v: 0, junk: 1, disc: 1, dfx: async (g, p) => { await g.damage(p, 1); } },
};
const STORM_IDS = ['twopow', 'opal', 'sift', 'diamond', 'spirit', 'amber', 'shatter', 'meteor', 'blood', 'quake', 'threepow', 'swamp', 'lavabat', 'ruby', 'shock', 'rapid', 'obsidian', 'lantern', 'heart', 'manafont', 'flame', 'fb2', 'cross', 'fb', 'arctite', 'iceflume', 'frost', 'lapis', 'leap', 'moon', 'reflect', 'sapph', 'step', 'twin', 'ultw', 'wave'];
const DRAGON_IDS = ['dEarth', 'dFire', 'dIce', 'dStorm', 'dWind'];

function best(it) { return it.slice().sort((a, b) => CARDS[b.id].v - CARDS[a.id].v)[0]; }
function worst(it) { return it.slice().sort((a, b) => junkRank(a) - junkRank(b))[0]; }
function junkRank(c) { const d = CARDS[c.id]; return d.junk ? -10 : d.v; }
function cheapest(it, n) { // prefer junk that is harmless to discard, then discard-effect cards, then low value
  const sc = c => { const d = CARDS[c.id]; if (c.id === 'ice') return -20; if (d.junk) return -5; return d.v - (d.disc ? 3 : 0) + (d.wiz ? 3 : 0); };
  return it.slice().sort((a, b) => sc(a) - sc(b)).slice(0, n);
}

const WIZ = {
  derby: { n: 'Derby Pocket', short: 'Derby', hp: 13, ini: 3, cost: 6, un: 'Flaming Yardstick', els: ['F', 'E'], spells: ['coffee', 'charge'],
    start: 'Distributor Connection: gains Earth Essence into their discard.', ut: 'Deal 2 damage. If you have an odd number of health, gain 2 mana.',
    ult: async (g, p) => { await g.dmg(p, 2); if (g.S.pl[p].hp % 2 === 1) await g.mana(p, 2); } },
  eve: { n: 'Eve Williams', short: 'Eve', hp: 14, ini: 5, cost: 5, un: 'Doom Bauble', els: ['F', 'W'], spells: ['punch', 'riot'],
    start: 'Always Already: gives all players an ICE.', ut: 'You may move a CURSE or ICE from your discard or hand to an opponent’s discard. Draw 2.',
    ult: async (g, p) => {
      const P = g.S.pl[p]; const it = [...P.hand, ...P.discard].filter(c => c.id === 'curse' || c.id === 'ice');
      if (it.length) { const pick = await g.decide(p, { k: 'pick', q: 'Doom Bauble: you may move a CURSE or ICE to your opponent’s discard.', items: it, min: 0, max: 1,
        cpu: x => { const h = x.filter(c => P.hand.includes(c)); const pool = h.length ? h : x; return [pool.find(c => c.id === 'curse') || pool[0]]; } });
        for (const c of pick) { const z = P.hand.includes(c) ? P.hand : P.discard; z.splice(z.indexOf(c), 1); const to = await g.chooseOpp(p, 'Doom Bauble: give it to which opponent?'); g.S.pl[to].discard.push(c); g.log(`${g.nm(p)} moved a ${CARDS[c.id].n} to ${g.nm(to, 1, 1)} discard.`); g.ev('bauble', p, c.id); } }
      await g.draw(p, 2); } },
};

const WEATHER = {
  breeze: { n: 'Nice Breeze', calm: 1, each: { draw: 1, mana: 1, power: 1 } },
  strange: { n: 'Strange Weather', calm: 1, each: { draw: 2 }, once: async g => { const w = g.S.wdeck.pop(); if (w) { g.S.wdisc.push(w); g.log(`Strange Weather discards ${WEATHER[w].n} from the Weather Deck.`); } } },
  fearth: { n: 'Falling Earth', calm: 1, each: { draw: 1 }, rev: { el: 'E', power: 1 } },
  dust: { n: 'Dust Cloud', calm: 1, each: { draw: 1, power: 1 }, per: async (g, p) => { await g.randomDiscard(p, 1); } },
  heat: { n: 'Heatwave', calm: 1, each: { draw: 1 }, rev: { el: 'F', mana: 1 } },
  flurry: { n: 'Crystal Flurries', calm: 2, each: { draw: 1, mana: 1 }, rev: { el: 'W', mana: 1 } },
  fstar: { n: 'Falling Star', calm: 1, each: { draw: 1 }, per: async (g, p) => { await g.gainCard(p); } },
  soothe: { n: 'Soothing Rain', std: 2, each: { draw: 1 }, per: async (g, p) => {
    const P = g.S.pl[p]; const it = [...P.hand, ...P.discard].filter(c => CARDS[c.id].junk); if (!it.length) return;
    const pick = await g.decide(p, { k: 'pick', q: 'Soothing Rain: you may VOID an ASH, CURSE or ICE from your hand or discard pile.', items: it, min: 0, max: 1, cpu: x => [x.find(c => P.hand.includes(c)) || x[0]] });
    for (const c of pick) g.voidFrom(p, c, P.hand.includes(c) ? P.hand : P.discard); } },
  blizz: { n: 'Burning Blizzard', std: 1, each: { draw: 1 }, rev: { el: 'F', mana: 2 } },
  ewave: { n: 'Energy Wave', std: 2, each: { draw: 1 }, after: 1 },
  omen: { n: 'Gemlight Omen', std: 1, each: { draw: 1 }, per: async (g, p) => { const t = g.S.pl[p].tier; if (t === 2) await g.mana(p, 1); if (t === 1) await g.power(p, 3); } },
  glitter: { n: 'Glittering Dust', std: 1, each: { draw: 2 } },
  ionic: { n: 'Ionic Atmosphere', std: 2, each: { draw: 2, mana: 1 }, per: async (g, p) => { if (g.S.pl[p].tier >= 2) g.losePower(p, 2); } },
  lightning: { n: 'Lightning Strike!', std: 1, each: { draw: 1, mana: 1 }, per: async (g, p) => { if (g.S.pl[p].hp > 8) await g.damage(p, 1); } },
  warp: { n: 'Magnetic Warp', std: 2, each: { draw: 2 }, once: async g => { const S = g.S; for (let i = 0; i < 5; i++) { if (S.cloud[i]) S.void.push(S.cloud[i]); S.cloud[i] = null; } for (let i = 0; i < 5; i++) g.refill(i); g.log('The Storm Cloud is swept away and redrawn.'); await g.pause(2400); } },
  toads: { n: 'Rain of Toads', std: 1, each: { draw: 1 }, once: async g => { const h = g.S.init; g.loseInit(h); const n = g.S.init; g.log(`${g.nm(n)} ${n === 0 ? 'get' : 'gets'} the Initiative.`); await g.gainSpecial(n, 'curse'); await g.mana(n, 1); } },
  shoot: { n: 'Shooting Star', std: 1, each: { draw: 2, power: 2 } },
  tidal: { n: 'Tidal Wave', std: 1, each: { draw: 2, mana: 1 }, per: async (g, p) => { await g.randomDiscard(p, 2); } },
  wild: { n: 'Wildcolor Winds', std: 1, each: { draw: 1 }, per: async (g, p) => { const c = g.drawStorm(); if (c) { if (g.S.pl[p].rb) g.S.void.push(c); else g.S.pl[p].discard.push(c); g.log(`${g.nm(p)} ${p === 0 ? 'add' : 'adds'} ${CARDS[c.id].n} from the Storm Deck to ${g.nm(p, 1, 1)} discard.`); } } },
};
const WEATHER_TEXT = {
  breeze: 'Draw 1, gain 1 mana and 1 power.', strange: 'Draw 2. Discard the next Weather card.', fearth: 'Draw 1. If you reveal Earth this round, gain 1 power.',
  dust: 'Draw 1, gain 1 power. All players discard a random card.', heat: 'Draw 1. If you reveal Fire this round, gain 1 mana.', flurry: 'Draw 1, gain 1 mana. If you reveal Water this round, gain 1 mana.',
  fstar: 'Draw 1. All players may gain a card (Initiative first).', soothe: 'Draw 1. Each player may VOID an ASH, CURSE or ICE from hand or discard.', blizz: 'Draw 1. If you reveal Fire this round, gain 2 mana.',
  ewave: 'Draw 1. After cards resolve, players may use their Ultimate.', omen: 'Draw 1. Tier II: gain 1 mana. Tier I: gain 3 power.', glitter: 'Draw 2. Earth cards do nothing when resolved but Heal 2.',
  ionic: 'Draw 2, gain 1 mana. Tier II and III players lose 2 power.', lightning: 'Draw 1, gain 1 mana. Players above 8 health take 1 damage.', warp: 'Draw 2. VOID the Storm Cloud and draw 5 new cards.',
  toads: 'Draw 1. Initiative changes hands; whoever gets it gains a CURSE and 1 mana.', shoot: 'Draw 2, gain 2 power.', tidal: 'Draw 2, gain 1 mana. All players randomly discard 2 cards.',
  wild: 'Draw 1. All players put the top Storm Deck card into their discard.',
};

// ---------- setup ----------
function newState(humanWiz, cpuWiz) {
  if (!cpuWiz || cpuWiz === humanWiz) cpuWiz = humanWiz === 'derby' ? 'eve' : 'derby';
  const S = { uid: 0, pl: [], init: 0, cloud: [], sdeck: [], void: [], special: { ice: 6, ash: 6, curse: 6 }, dragons: [], wdeck: [], wdisc: [], wcur: null, wused: [],
    battle: 0, round: 0, rev: [null, null], slot: [null, null], revealed: false, phase: 'setup', over: null };
  const mk = id => ({ u: ++S.uid, id });
  for (const w of [humanWiz, cpuWiz]) {
    const W = WIZ[w]; const deck = ['dart', 'dart', 'block', 'block', 'pgem', 'pgem', ...W.spells].map(mk);
    S.pl.push({ wiz: w, hp: W.hp, max: W.hp, mana: 2, power: 0, tier: 1, shards: 0, hand: [], deck: shuffle(deck), discard: [], blastMod: 0,
      doom: 0, energy: w === 'may' ? 2 : 0, research: [0, 0, 0, 0, 0, 0, 0, 0], chem: { F: 3, E: 3, W: 3 }, trap: null, dodge: 0, potions: [] });
  }
  S.init = WIZ[humanWiz].ini <= WIZ[cpuWiz].ini ? 0 : 1;
  S.cloud = [mk('essF'), mk('essW'), mk('essE'), null, null];
  S.sdeck = shuffle(STORM_IDS.map(mk));
  S.cloud[3] = S.sdeck.pop(); S.cloud[4] = S.sdeck.pop();
  S.dragons = shuffle(DRAGON_IDS.map(mk));
  const calm = [], std = [];
  for (const [k, w] of Object.entries(WEATHER)) { for (let i = 0; i < (w.calm || 0); i++) calm.push(k); for (let i = 0; i < (w.std || 0); i++) std.push(k); }
  S.wdeck = [...shuffle(std), ...shuffle(calm)]; // top = end of array
  return S;
}

// ---------- engine ----------
class Game {
  constructor(S, io) { this.S = S; this.io = io; }
  log(m, c) { if (!this.io.sim) this.io.log(m, c); }
  async pause(ms) { if (!this.io.sim) { this.io.render(); await this.io.pause(ms); } }
  nm(p, obj, poss) { const w = WIZ[this.S.pl[p].wiz].short; if (p === 0) return poss ? 'your' : (obj ? 'you' : 'You'); return poss ? `${w}’s` : w; }
  decide(p, req) { return this.io.decide(this, p, req); }
  async yn(p, q, cpu) { return this.decide(p, { k: 'yn', q, cpu }); }
  async askPlayer(p, q, cpu) { return this.decide(p, { k: 'player', q, cpu }); }
  order() { return [this.S.init, 1 - this.S.init]; }
  hasInit(p) { return this.S.init === p; }
  gainInit(p) { if (this.S.init !== p) { this.S.init = p; this.log(`${this.nm(p)} ${p === 0 ? 'take' : 'takes'} the Initiative.`, 'ini'); } }
  loseInit(p) { if (this.S.init === p) { this.S.init = 1 - p; this.log(`${this.nm(p)} ${p === 0 ? 'lose' : 'loses'} the Initiative.`, 'ini'); } }
  reshuffle(p) { const P = this.S.pl[p]; if (!P.discard.length) return; P.deck = shuffle(P.discard.splice(0)); this.log(`${this.nm(p)} ${p === 0 ? 'reshuffle' : 'reshuffles'} ${this.nm(p, 1, 1)} discard pile.`); }
  async draw(p, n) { const P = this.S.pl[p]; let k = 0; for (let i = 0; i < n; i++) { if (!P.deck.length) this.reshuffle(p); if (!P.deck.length) break; P.hand.push(P.deck.pop()); k++; } return k; }
  async mana(p, n) { this.S.pl[p].mana += n; }
  async power(p, n) {
    const P = this.S.pl[p];
    for (let i = 0; i < n; i++) {
      if (P.power < 6) { P.power++; continue; }
      P.power = 0;
      if (P.tier < 3) { P.tier++; this.log(`${this.nm(p)} ${p === 0 ? 'reach' : 'reaches'} Tier ${'I'.repeat(P.tier)}!`, 'big'); await this.pause(500); }
      else await this.gainDragon(p);
    }
  }
  losePower(p, n) { const P = this.S.pl[p]; const k = Math.min(n, P.power); P.power -= k; if (k) this.log(`${this.nm(p)} ${p === 0 ? 'lose' : 'loses'} ${k} Power.`); }
  heal(p, n) { const P = this.S.pl[p]; const k = Math.min(n, P.max - P.hp); P.hp += k; if (k) this.log(`${this.nm(p)} ${p === 0 ? 'heal' : 'heals'} ${k}.`, 'heal'); }
  async damage(t, n) { if (n <= 0) return; const P = this.S.pl[t]; const k = Math.min(n, P.hp); P.hp -= k; this.log(`${this.nm(t)} ${t === 0 ? 'take' : 'takes'} ${n} damage.`, 'dmg'); if (!this.io.sim) this.io.fx && this.io.fx('hit', t); this.checkWin(); }
  async dmg(p, n) { await this.damage(1 - p, n); }
  async shards(p, n) { this.S.pl[p].shards += n; this.log(`${this.nm(p)} ${p === 0 ? 'gain' : 'gains'} ${n} Storm Shard${n > 1 ? 's' : ''}.`, 'shard'); this.checkWin(); }
  checkWin() {
    const S = this.S, pl = S.pl; const W8 = S.win || 8, cand = [0, 1].filter(i => pl[i].shards >= W8 || pl[1 - i].hp <= 0);
    if (!cand.length) return;
    let w, why;
    if (cand.length === 1) { w = cand[0]; why = pl[w].shards >= W8 ? 'shards' : 'health'; }
    else {
      const bothDead = pl[0].hp <= 0 && pl[1].hp <= 0;
      if (bothDead && pl[0].shards !== pl[1].shards) w = pl[0].shards > pl[1].shards ? 0 : 1;
      else if (!bothDead && pl[0].hp !== pl[1].hp) w = pl[0].hp > pl[1].hp ? 0 : 1;
      else w = S.init;
      why = 'tie';
    }
    S.over = { winner: w, why }; throw new GameOver(w, why);
  }
  async discardFrom(p, c, zone, o = {}) {
    const P = this.S.pl[p]; const z = P[zone]; const i = z.indexOf(c); if (i < 0) return; z.splice(i, 1); P.discard.push(c);
    const d = CARDS[c.id]; if (d.dfx && o.trigger !== false) { if (!o.quiet) this.log(`${this.nm(p)} ${p === 0 ? 'discard' : 'discards'} ${d.n} — its discard effect triggers.`); await d.dfx(this, p, o); }
  }
  async randomDiscard(p, n) { const P = this.S.pl[p]; for (let i = 0; i < n; i++) { if (!P.hand.length) return; const c = P.hand[Math.floor(Math.random() * P.hand.length)]; this.log(`${this.nm(p)} randomly ${p === 0 ? 'discard' : 'discards'} ${CARDS[c.id].n}.`); await this.discardFrom(p, c, 'hand', { quiet: 1 }); } }
  voidFrom(p, c, zone) {
    const d = CARDS[c.id]; if (d.wiz) return false; const i = zone.indexOf(c); if (i < 0) return false; zone.splice(i, 1);
    if (d.junk) this.S.special[c.id]++; else this.S.void.push(c);
    this.log(`${this.nm(p)} ${p === 0 ? 'VOID' : 'VOIDs'} ${d.n}.`); return true;
  }
  nofx(m) { this.log(m, 'nofx'); }   // a card's effect didn't happen: say why, briefly
  async voidOneHandOrDiscard(p, q, must) {
    const P = this.S.pl[p]; const it = [...P.hand, ...P.discard].filter(c => !CARDS[c.id].wiz); if (!it.length) { this.nofx(`${q.split(':')[0]}: no cards in hand or discard to VOID.`); return; }
    const pick = await this.decide(p, { k: 'pick', q, items: it, min: must ? 1 : 0, max: 1, cpu: x => { const j = x.filter(c => CARDS[c.id].junk); const jd = j.find(c => P.discard.includes(c)); return j.length ? [jd || j[0]] : (must ? [x.slice().sort((a, b) => CARDS[a.id].v - CARDS[b.id].v)[0]] : []); } });
    for (const c of pick) this.voidFrom(p, c, P.hand.includes(c) ? P.hand : P.discard);
  }
  drawStorm() { const S = this.S; if (!S.sdeck.length) { if (!S.void.length) return null; S.sdeck = shuffle(S.void.splice(0)); this.log('The VOID is reshuffled into the Spellstorm Deck.'); } return S.sdeck.pop(); }
  refill(i) { if (!this.S.cloud[i]) this.S.cloud[i] = this.drawStorm(); }
  async gainSpecial(p, type) {
    const S = this.S;
    if (S.special[type] > 0) { S.special[type]--; S.pl[p].discard.push({ u: ++S.uid, id: type }); this.log(`${this.nm(p)} ${p === 0 ? 'gain' : 'gains'} ${type === 'ice' || type === 'ash' ? 'an' : 'a'} ${CARDS[type].n}.`, 'junk'); }
    else { this.log(`No ${CARDS[type].n} left — the board effect applies to ${this.nm(p, 1)}.`); if (type === 'ice') await this.randomDiscard(p, 1); else if (type === 'ash') this.losePower(p, 1); else await this.damage(p, 1); }
  }
  async gainDragon(p) {
    const S = this.S;
    if (!S.dragons.length) { this.log('The Dragon deck is empty: deal 2 damage and gain 2 Storm Shards.'); await this.dmg(p, 2); await this.shards(p, 2); return; }
    const top = S.dragons[S.dragons.length - 1];
    if (await this.yn(p, `Your power overflows at Tier III. Gain ${CARDS[top.id].n}?`, true)) { S.dragons.pop(); S.pl[p].hand.push(top); markSeen(S, p, top); this.log(`${this.nm(p)} ${p === 0 ? 'gain' : 'gains'} ${CARDS[top.id].n}!`, 'big'); await this.pause(700); }
  }
  eligibleSlots(p, o = {}) {
    const S = this.S, P = S.pl[p];
    return S.cloud.map((c, i) => { if (!c) return -1; const d = CARDS[c.id]; if (o.el && d.el !== o.el) return -1; if (o.anyTier) { if (d.t > (o.maxTier || 9)) return -1; } else if (d.t > P.tier) return -1; return i; }).filter(i => i >= 0);
  }
  async gainCard(p, o = {}) {
    let slots = this.eligibleSlots(p, o), sp = o.el ? { F: ['curse'], W: ['ice'], E: ['ash'] }[o.el] : ['ice', 'ash', 'curse'];
    const tutLock = this.S.tutorial && p === 0 && this.S.battle === 1 && this.S.round === 1;          // tutorial: Derby has you gain the Diamond
    if (tutLock) { const d = slots.filter(i => this.S.cloud[i] && this.S.cloud[i].id === 'diamond'); if (d.length) { slots = d; sp = []; o = { ...o, must: true }; } }
    if (!slots.length && !sp.length) { this.nofx(`No ${o.el ? `Tier I or II ${ELN[o.el]} card` : 'card'} in the Storm Cloud to gain.`); return null; }
    const what = o.el ? `a Tier I or II ${ELN[o.el]} card` : 'a card';
    const i = await this.decide(p, { k: 'gain', q: o.must ? `You must gain ${what} from the Storm Cloud.` : `You may gain ${what} from the Storm Cloud.`, slots, optional: !o.must, verb: 'Gain', special: sp.length ? 1 : 0, specials: sp });
    if (typeof i === 'string') { const had = this.S.special[i] > 0; await this.gainSpecial(p, i); const D = this.S.pl[p].discard; return had ? D[D.length - 1] : null; }
    if (i < 0) return null;
    const S = this.S, c = S.cloud[i]; S.cloud[i] = null; this.refill(i); S.pl[p].hand.push(c); markSeen(S, p, c);
    this.log(`${this.nm(p)} ${p === 0 ? 'gain' : 'gains'} ${CARDS[c.id].n}.`, 'gain'); await this.pause(750); return c;
  }
  async offerUlt(p, free) {
    const P = this.S.pl[p], W = WIZ[P.wiz]; if (!free && P.mana < W.cost) return;
    const WT = (typeof wizInfo === 'function' ? wizInfo(P.wiz, this.S.ed) : W).ut;   // the text of the edition being played
    const ok = await this.decide(p, { k: 'yn', ult: 1, free: !!free, cpu: true, q: free ? `Use ${W.un} without paying mana? (${WT})` : `Use ${W.un} for ${W.cost} mana? (${WT})` });
    if (!ok) return; if (!free) P.mana -= W.cost;
    if (!this.io.sim && this.io.fx) { this.io.fx('ult', p); this.io.fx('ultcine', p, P.wiz); }   // the moment of drama first, so the log's pop-up doesn't sit on top of it
    this.log(`${this.nm(p)} ${p === 0 ? 'unleash' : 'unleashes'} ${W.un.replace(/!+$/, '')}!`, 'big'); await this.pause(!this.io.sim && this.io.fx ? 3000 : 500);   // a moment of drama: the Ultimate's art and name, then it resolves
    await W.ult(this, p);
  }
  async resolve(p, c, how) {
    const d = CARDS[c.id]; const x = { how, dest: null };
    if (d.drag && !this.io.sim && this.io.fx) { this.io.fx('dragon', p, c.id); await this.pause(3000); }   // the Dragon's card close up, its name and a roar, then it resolves
    if (d.junk) { this.log(`${d.n} can’t be played — nothing happens.`); return x; }
    if (this.S.wcur === 'glitter' && d.el === 'E') { this.log(`Glittering Dust: ${d.n} does nothing but heal 2.`); await this.heal(p, 2); return x; }
    await d.fx(this, p, x); if (d.ult) await this.offerUlt(p, false);
    return x;
  }
  place(p, c, dest) {
    const S = this.S; if (dest === 'void') { if (CARDS[c.id].wiz) S.pl[p].discard.push(c); else S.void.push(c); }
    else if (dest === 'hand') { S.pl[p].hand.push(c); markSeen(S, p, c); } else if (dest === 'opp' || (typeof dest === 'string' && dest.startsWith('to'))) { const T = S.pl[dest === 'opp' ? this.next(p) : +dest.slice(2)]; if (T.rb && !CARDS[c.id].junk) S.void.push(c); else T.discard.push(c); } else S.pl[p].discard.push(c);
  }
  async resolveFromHand(p, c) {
    const P = this.S.pl[p]; const i = P.hand.indexOf(c); if (i < 0) return; P.hand.splice(i, 1);
    this.log(`${this.nm(p)} ${p === 0 ? 'resolve' : 'resolves'} ${CARDS[c.id].n} from hand.`); const x = await this.resolve(p, c, 'hand'); this.place(p, c, x.dest);
  }
  // ----- flow -----
  async gameStart() {
    const S = this.S;
    await this.pause(1500);                      // let the Storm Cloud deal in
    for (const p of this.order()) {
      const w = S.pl[p].wiz;
      if (w === 'derby') { const i = S.cloud.findIndex(c => c && c.id === 'essE'); if (i >= 0) { const c = S.cloud[i]; S.cloud[i] = null; S.pl[p].discard.push(c); this.refill(i); this.log(`Distributor Connection: ${this.nm(p)} ${p === 0 ? 'gain' : 'gains'} Earth Essence into ${this.nm(p, 1, 1)} discard.`); } }
      if (w === 'eve') { this.log('Always Already: Eve gives all players an ICE.'); for (const q of this.order()) await this.gainSpecial(q, 'ice'); }
    }
  }
  async ensurePlayable(p) {
    const P = this.S.pl[p];
    for (let k = 0; k < 8; k++) {
      if (P.hand.some(c => !CARDS[c.id].junk)) return true;
      this.log(`${this.nm(p)} ${p === 0 ? 'have' : 'has'} an unplayable hand — discard it, take 1 damage and draw 4.`, 'warn');
      await this.pause(600);
      for (const c of P.hand.slice()) await this.discardFrom(p, c, 'hand');
      await this.damage(p, 1); await this.draw(p, 4);
    }
    return P.hand.some(c => !CARDS[c.id].junk);
  }
  async flipWeather() {
    const S = this.S; if (!S.wdeck.length) { S.wdeck = shuffle(S.wdisc.splice(0)); }
    const w = S.wdeck.pop(); S.wcur = w; S.wused.push(w); return w;
  }
  async weatherFx(w) {
    const W = WEATHER[w];
    for (const p of this.order()) { const e = W.each || {}; if (e.draw) await this.draw(p, e.draw); if (e.mana) await this.mana(p, e.mana); if (e.power) await this.power(p, e.power); }
    if (W.once) await W.once(this);
    if (W.per) for (const p of this.order()) await W.per(this, p);
  }
  async battle() {
    const S = this.S; S.battle++; S.phase = 'battle';
    for (const p of this.order()) await this.draw(p, 3 - S.pl[p].hand.length);
    for (let r = 1; r <= 4; r++) await this.round(r);
  }
  async round(r) {
    const S = this.S; S.round = r; S.rev = S.pl.map(() => null); S.slot = S.pl.map(() => null); S.revealed = false; S.phase = 'weather';
    if (S.cheater) for (const p of S.pl.keys()) if (p !== 0 && !S.pl[p].out) {          // Cheater difficulty: a free health and a free card every round
      const P = S.pl[p]; P.hp = Math.min(P.max, P.hp + 1); this.log(`${WIZ[P.wiz].short}: Got +1 health and drew +1 card from cheating.`, 'big'); await this.draw(p, 1); }
    const w = await this.flipWeather();
    this.log(`Battle ${S.battle}, round ${r}: ${WEATHER[w].n}.`, 'head'); await this.pause(900);
    await this.weatherFx(w); await this.pause(300);
    await this.playStep();
  }
  async playStep() {
    const S = this.S;
    S.phase = 'play';
    if (!this.io.sim && this.io.checkpoint) this.io.checkpoint();          // safe point: a saved match resumes here
    for (const p of this.order()) await this.ensurePlayable(p);
    for (const q of S.pl.keys()) { if (q === 0 || S.pl[q].out) continue;
      const cpuCard = S.pl[q].rb ? this.rbTop(q) : S.pl[q].hand.some(c => !CARDS[c.id].junk) ? await this.decide(q, { k: 'play' }) : null;
      if (cpuCard) { if (!S.pl[q].rb) S.pl[q].hand.splice(S.pl[q].hand.indexOf(cpuCard), 1); S.slot[q] = cpuCard; } }
    await this.pause(200);
    if (!this.io.sim && this.io.tut && S.tutorial) await this.io.tut('play');
    const myCard = !S.pl[0].out && S.pl[0].hand.some(c => !CARDS[c.id].junk) ? await this.decide(0, { k: 'play' }) : null;
    if (myCard) { S.pl[0].hand.splice(S.pl[0].hand.indexOf(myCard), 1); S.slot[0] = myCard; }
    await this.afterPlay();
    if (!this.io.sim && this.io.roundDone) this.io.roundDone();          // replays record each finished round
    if (!this.io.sim && this.io.tut && S.tutorial) await this.io.tut('done');
  }
  async afterPlay() {
    const S = this.S; S.phase = 'reveal'; S.revealed = true; S.rev = [S.slot[0], S.slot[1]];
    if (!this.io.sim) { this.log(`Reveal: you played ${S.slot[0] ? CARDS[S.slot[0].id].n : 'nothing'}; ${this.nm(1)} played ${S.slot[1] ? CARDS[S.slot[1].id].n : 'nothing'}.`); this.io.fx && this.io.fx('reveal'); await this.pause(900); }
    const [a, b] = S.rev;
    for (const p of this.order()) { const m = S.rev[p], t = S.rev[1 - p]; if (m && t && BEATS[CARDS[m.id].el] === CARDS[t.id].el) { this.log(`${this.nm(p)} COUNTERED ${this.nm(1 - p, 1)} and ${p === 0 ? 'draw' : 'draws'} a card.`, 'counter'); if (!this.io.sim && this.io.fx) this.io.fx('counter', p); await this.draw(p, 1); await this.pause(500); } }
    const W = WEATHER[S.wcur];
    if (W.rev) for (const p of this.order()) if (isEl(S.rev[p], W.rev.el)) { this.log(`${W.n}: ${this.nm(p)} revealed ${ELN[W.rev.el]}.`); if (W.rev.mana) await this.mana(p, W.rev.mana); if (W.rev.power) await this.power(p, W.rev.power); }
    S.phase = 'resolve'; const dest = [null, null];
    for (const p of this.order()) { const c = S.slot[p]; if (!c) continue; this.log(`${this.nm(p)} ${p === 0 ? 'resolve' : 'resolves'} ${CARDS[c.id].n}.`, 'res'); S.resolving = p; await this.pause(350); const x = await this.resolve(p, c, 'play'); dest[p] = x.dest; await this.pause(500); }
    S.resolving = null;
    if (W.after) for (const p of this.order()) await this.offerUlt(p, false);
    for (const p of [0, 1]) { const c = S.slot[p]; if (c) this.place(p, c, dest[p]); }
    S.slot = [null, null]; S.revealed = false;
  }
  async regroup() {
    const S = this.S; S.phase = 'regroup';
    this.log(`Regroup after battle ${S.battle}.`, 'head');
    S.wdisc.push(...S.wused); S.wused = []; S.wcur = null;
    for (const p of this.order()) { const P = S.pl[p]; P.blastMod = 0; for (const c of P.hand.filter(c => CARDS[c.id].disc)) await this.discardFrom(p, c, 'hand', { regroup: true }); }
    await this.pause(500);
    const sc = [0, 1].map(p => S.pl[p].hand.length + S.pl[p].blastMod);
    for (const p of [0, 1]) { const P = S.pl[p]; P.discard.push(...P.hand.splice(0)); }
    this.log(`Blast Scores — you: ${sc[0]}, ${this.nm(1)}: ${sc[1]}.`, 'head');
    S.lastBlast = sc; this.ev('blast', -1, sc);
    if (sc[0] === sc[1]) { S.pl[0].shards++; S.pl[1].shards++; this.log('Tied Blast Score — both gain 1 Storm Shard.', 'shard'); }
    else { const w = sc[0] > sc[1] ? 0 : 1; S.pl[w].shards += 2; this.log(`${this.nm(w)} ${w === 0 ? 'win' : 'wins'} the Blast and ${w === 0 ? 'gain' : 'gains'} 2 Storm Shards.`, 'shard'); }
    if (!this.io.sim && this.io.fx) this.io.fx('blast'); await this.pause(900);
    this.checkWin();
    S.phase = 'gain';
    for (const p of this.order()) {
      const slots = this.eligibleSlots(p);
      const i = await this.decide(p, { k: 'gain', q: 'Gain Spell: take one card from the Storm Cloud, or a free special card.', slots, optional: 0, special: 1, verb: 'Gain' });
      if (typeof i === 'string') { await this.gainSpecial(p, i); }
      else { const c = S.cloud[i]; S.cloud[i] = null; this.refill(i); S.pl[p].hand.push(c); markSeen(S, p, c); this.log(`${this.nm(p)} ${p === 0 ? 'gain' : 'gains'} ${CARDS[c.id].n}.`, 'gain'); this.ev('gain', p); }
      await this.pause(400);
    }
    for (const p of this.order()) await this.draw(p, 3 - S.pl[p].hand.length);
  }
  async resumeRun() {
    try { const S = this.S; await this.playStep(); for (let r = S.round + 1; r <= 4; r++) await this.round(r); await this.regroup(); for (;;) { await this.battle(); await this.regroup(); } }
    catch (e) { if (e instanceof GameOver) return e; throw e; }
  }
  async run() {
    try { await this.gameStart(); for (;;) { await this.battle(); await this.regroup(); } }
    catch (e) { if (e instanceof GameOver) return e; throw e; }
  }
}

// ---------- CPU ----------
function cardVal(id, P) { const d = CARDS[id]; return d.v + (WIZ[P.wiz].els.includes(d.el) ? 2 : 0); }
// Evaluation weights (tunable by SPSA self-play). EVW0 = the hand-set defaults; a player may carry its own set in S.evw[p].
const EVW0 = { shard: 14, hp: 4, low: 6, mana: 1.6, manaX: 0.4, tier: 16, power: 2.4, hand: 3, deck: 0.35, junk: 4, junkH: 2, init: 3, doom: 5, energy: 2, research: 7, trap: 4, chem: 0.4, blast: 14, blastE: 0.45, close: 9, low2: 7 };
function scoreP(S, i, w = EVW0) {
  const P = S.pl[i], W = WIZ[P.wiz];
  let s = P.shards * w.shard + P.hp * w.hp + (P.hp <= 5 ? -(6 - P.hp) * w.low : 0);
  s += Math.min(P.mana, W.cost) * w.mana + Math.max(0, P.mana - W.cost) * w.manaX;
  s += (P.tier - 1) * w.tier + P.power * w.power + P.hand.length * w.hand;
  let dv = 0, junk = 0; for (const c of [...P.hand, ...P.deck, ...P.discard]) { const d = CARDS[c.id]; if (d.junk) junk++; else dv += d.v; }
  s += dv * w.deck - junk * w.junk - P.hand.filter(c => CARDS[c.id].junk).length * w.junkH;
  if (S.init === i) s += w.init;
  s += P.doom * w.doom + P.energy * w.energy + P.research.filter(Boolean).length * w.research + (P.trap && !P.trap.used ? w.trap : 0) + (P.wiz === 'oren' ? (P.chem.F + P.chem.E + P.chem.W) * w.chem : 0);
  return s;
}
function evalState(S, p) { if (S.over) return S.over.winner === p ? 1e4 : -1e4; return scoreP(S, p) - scoreP(S, 1 - p); }

function cpuDecide(g, p, req) {
  const S = g.S, P = S.pl[p];
  switch (req.k) {
    case 'yn': if (req.ult && S.noUltSim) return false;   // two-turn search: simulated futures don't gamble on Ultimates
      return typeof req.cpu === 'function' ? req.cpu() : req.cpu !== false;
    case 'player': return req.cpu;
    case 'opt': { let k = req.cpu; if (req.dis && req.dis[k]) k = req.dis.findIndex(x => !x); return k; }
    case 'pick': {
      let r = (req.cpu ? req.cpu(req.items) : []).filter(Boolean);
      r = [...new Set(r)].filter(c => req.items.includes(c)).slice(0, req.max);
      if (r.length < req.min) for (const c of cheapest(req.items.filter(c => !r.includes(c)), req.min - r.length)) r.push(c);
      return r;
    }
    case 'gain': {
      const sl = req.slots;
      if (req.verb === 'VOID') { // deny the best one
        return sl.slice().sort((a, b) => CARDS[S.cloud[b].id].v - CARDS[S.cloud[a].id].v)[0];
      }
      if (!sl.length) { if (req.optional) return -1; const ok = req.specials || ['ice', 'ash', 'curse']; return [P.power <= 1 && S.special.ash ? 'ash' : null, S.special.ice ? 'ice' : null, S.special.ash ? 'ash' : null, 'curse'].find(x => x && ok.includes(x)) || ok[0]; }
      const bi = sl.slice().sort((a, b) => cardVal(S.cloud[b].id, P) - cardVal(S.cloud[a].id, P))[0];
      if (req.verb === 'Resolve' && req.optional && cardVal(S.cloud[bi].id, P) < 6) return -1;
      return bi;
    }
    case 'play': return null;
  }
}

// Cards that went into a hand in plain sight (gained from the Storm Cloud, returned from the discard, given, revealed) are
// public: S.kn[player][card uid] = 1. Expert (KNOWN, engine12.js) keeps those in the opponent's hand when it imagines the hidden cards.
function markSeen(S, q, c) { if (!c) return; const K = S.kn || (S.kn = {}); (K[q] || (K[q] = {}))[c.u] = 1; }
function determinize(S, p) {
  const o = 1 - p, O = S.pl[o], kn = typeof knownOn === 'function' && knownOn(S, p) && S.kn && S.kn[o];
  if (kn) { const keep = O.hand.filter(c => kn[c.u]), rest = O.hand.filter(c => !kn[c.u]), pool = shuffle([...rest, ...O.deck]);
    O.hand = [...keep, ...pool.slice(0, rest.length)]; O.deck = pool.slice(rest.length); }
  else { const pool = shuffle([...O.hand, ...O.deck]); const hn = O.hand.length;
  O.hand = pool.slice(0, hn); O.deck = pool.slice(hn); }
  shuffle(S.pl[p].deck); shuffle(S.sdeck);
  if (O.trap && !O.trap.used) O.trap.id = ['mud', 'dodge', 'ice'][Math.floor(Math.random() * 3)];
}
const SIM_IO = { sim: true, decide: (g, p, req) => Promise.resolve(cpuDecide(g, p, req)), log() { }, render() { }, pause() { return Promise.resolve(); } };

async function choosePlay(S0, p, samples = 14) {
  const hand = S0.pl[p].hand.filter(c => !CARDS[c.id].junk);
  if (hand.length <= 1) return hand[0] || null;
  let bestC = null, bestV = -Infinity;
  const seen = {};
  for (const c of hand) {
    if (seen[c.id]) continue; seen[c.id] = 1;
    let tot = 0;
    for (let k = 0; k < samples; k++) {
      const S = structuredClone(S0); determinize(S, p);
      const me = S.pl[p], op = S.pl[1 - p];
      const mc = me.hand.find(x => x.u === c.u);
      const opts = op.hand.filter(x => !CARDS[x.id].junk);
      const oc = opts.length ? opts[Math.floor(Math.random() * opts.length)] : null;
      me.hand.splice(me.hand.indexOf(mc), 1); S.slot[p] = mc;
      if (oc) { op.hand.splice(op.hand.indexOf(oc), 1); S.slot[1 - p] = oc; }
      const g = new Game(S, SIM_IO);
      try { await g.afterPlay(); } catch (e) { if (!(e instanceof GameOver)) throw e; }
      tot += evalState(S, p);
    }
    const v = tot / samples + Math.random() * 0.01;
    if (v > bestV) { bestV = v; bestC = c; }
  }
  return bestC;
}

