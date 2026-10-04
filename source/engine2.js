// ===== Spellstorm engine, part 2: the other six wizards =====
const TRAPS = {
  mud: { n: 'Mud Trap', img: 'trap_mud', trig: 'Reveal if you COUNTER with a Fire card.', eff: 'Deal 1 damage, gain 1 mana, gain Initiative.' },
  dodge: { n: 'Dodge!', img: 'trap_dodge', trig: 'Reveal when an opponent deals damage to you.', eff: 'The first 2 damage you take this round is negated.' },
  ice: { n: 'Ice Bomb', img: 'trap_ice', trig: 'Reveal if you COUNTER with a Water card.', eff: 'Give an ICE, gain 1 mana, then you may use your Ultimate.' },
};
const JOURNAL = ['+1 mana', '+1 mana', '+1 power', '+1 power', 'You may VOID a card from your hand', 'Move an ICE, ASH or CURSE from your discard to another discard', 'Gain a card', 'Draw a card'];
const POTIONS = {
  explo: { n: 'A Slight… Explosion', el: 'F', cost: 3, tox: 1, fx: async (g, p) => { await g.dmg(p, 1); const C = g.S.pl[p].chem; for (const k of 'FEW') C[k] = Math.min(6, C[k] + 1); } },
  haste: { n: 'Haste Potion', el: 'F', cost: 1, fx: async (g, p) => { if (g.hasInit(p)) await g.dmg(p, 1); else g.gainInit(p); } },
  purple: { n: 'I Call It… Purple Stuff', el: 'F', cost: 2, tox: 1, fx: async (g, p) => { await g.power(p, 1); await g.mana(p, 2); } },
  delixir: { n: 'Dragon Elixir', el: 'E', cost: 4, fx: async (g, p) => { const t = g.S.dragons[g.S.dragons.length - 1]; if (t) { g.log(`Oren resolves ${CARDS[t.id].n} from the Dragon deck!`, 'big'); await g.resolve(p, t, 'copy'); } } },
  devil: { n: 'Devil’s Breath', el: 'E', cost: 1, tox: 1, fx: async (g, p) => { await g.power(p, 1); await g.giveAll(p, 'ash'); } },
  gas: { n: 'I Think I Just Drank Gasoline', el: 'E', cost: 2, tox: 1, fx: async (g, p) => { await g.damage(p, 1); return 'twice'; } },
  frostb: { n: 'Frost Bomb', el: 'W', cost: 2, fx: async (g, p) => { for (const q of g.opps(p)) { const O = g.S.pl[q]; O.mana = Math.max(0, O.mana - 1); } await g.giveAll(p, 'ice'); } },
  soda: { n: 'Health Soda', el: 'W', cost: 4, tox: 1, fx: async (g, p) => { await g.heal(p, 2); } },
  storm: { n: 'Storm Juice', el: 'W', cost: 3, fx: async (g, p) => { await g.draw(p, 1); await g.power(p, 1); } },
};
const takeFromDiscard = async (g, p, q) => {
  const P = g.S.pl[p]; const [c] = await g.decide(p, { k: 'pick', q, items: P.discard.slice(), min: 1, max: 1, cpu: it => [best(it.filter(c => !CARDS[c.id].junk)) || it[0]] });
  P.discard.splice(P.discard.indexOf(c), 1); P.hand.push(c); g.log(`${g.nm(p)} ${p === 0 ? 'return' : 'returns'} ${CARDS[c.id].n} to hand.`);
};
const goodInDiscard = P => P.discard.some(c => CARDS[c.id].v >= 7);

Object.assign(CARDS, {
  // Oren
  potiongun: { n: 'Potion Gun', el: 'F', t: 1, v: 7, wiz: 1, ult: 1, fx: async (g, p) => {
    await g.dmg(p, 1); const P = g.S.pl[p]; const it = P.hand.filter(c => !CARDS[c.id].wiz); if (!it.length) return;
    const pick = await g.decide(p, { k: 'pick', q: 'Potion Gun: you may give a non-Wizard card from your hand to your opponent’s hand, gaining 2 of its Element.', items: it, min: 0, max: 1, cpu: x => { const j = x.find(c => CARDS[c.id].junk); return j ? [j] : []; } });
    for (const c of pick) { const to = await g.chooseOpp(p, 'Potion Gun: which opponent?'); P.hand.splice(P.hand.indexOf(c), 1); if (g.S.pl[to].rb) { g.S.void.push(c); g.log(`${CARDS[c.id].n} is VOIDED — Robot Boy can’t keep it.`); } else g.S.pl[to].hand.push(c); const el = CARDS[c.id].el; P.chem[el] = Math.min(6, P.chem[el] + 2); g.log(`${g.nm(p)} ${p === 0 ? 'fire' : 'fires'} ${CARDS[c.id].n} into ${g.nm(to, 1, 1)} hand: +2 ${ELN[el]} Element.`); } } },
  unstable: { n: 'Unstable Formula', el: 'E', t: 1, v: 7, wiz: 1, ult: 1, fx: async (g, p) => {
    await g.power(p, 1); await g.mana(p, 1);
    // Elements belong to Oren: if someone else resolves this (e.g. through Buddy System), it works on Oren's Elements
    const oi = g.S.pl[p].wiz === 'oren' ? p : g.S.pl.findIndex(x => x.wiz === 'oren' && !x.out), o = oi >= 0 ? oi : p, P = g.S.pl[o];
    const pairs = [], opts = [], dis = [];
    for (const [b, a] of [['F', 'W'], ['F', 'E'], ['E', 'W'], ['E', 'F'], ['W', 'F'], ['W', 'E']]) { pairs.push([a, b]); opts.push(`{${b}} +2, {${a}} −2`); dis.push(P.chem[a] < 2 || P.chem[b] >= 6); }   // raise first, in the card's order; {X} = Element icon
    opts.push('No change'); dis.push(false);
    const k = await g.decide(p, { k: 'opt', q: `Unstable Formula: lower one of ${o === p || o === 0 ? 'your' : g.nm(o) + '’s'} Elements by 2 to raise another by 2. (Fire ${P.chem.F}, Earth ${P.chem.E}, Water ${P.chem.W})`, opts, dis, cpu: opts.length - 1 });
    if (k < pairs.length) { const [a, b] = pairs[k]; P.chem[a] -= 2; P.chem[b] = Math.min(6, P.chem[b] + 2); g.log(o === p ? `${g.nm(p)} shifted 2 ${ELN[a]} into ${ELN[b]}.` : `${g.nm(p)} shifted 2 of ${o === 0 ? 'your' : g.nm(o) + '’s'} ${ELN[a]} into ${ELN[b]}.`); }
    if (g.S.rev.some(c => isEl(c, 'W'))) { P.chem.E = Math.min(6, P.chem.E + 1); g.log(`${g.nm(o)} ${o === 0 ? 'gain' : 'gains'} +1 Earth Element.`); } } },
  // Omar
  beetle: { n: 'Beetle Buster', el: 'F', t: 1, v: 7, wiz: 1, ult: 1, fx: async (g, p) => {
    const P = g.S.pl[p]; const fs = P.hand.filter(c => isEl(c, 'F')); if (!fs.length) return;
    const pick = await g.decide(p, { k: 'pick', q: 'Beetle Buster: you may discard a Fire card from your hand to deal 2 damage.', items: fs, min: 0, max: 1, cpu: x => [worst(x)] });
    for (const c of pick) { await g.discardFrom(p, c, 'hand'); await g.dmg(p, 2); } } },
  shuriken: { n: 'Shuriken', el: 'W', t: 1, v: 7, wiz: 1, ult: 1, fx: async (g, p) => {
    const S = g.S, cands = g.opps(p).filter(q => S.slot[q] && S.phase === 'resolve' && S.cancel && !S.cancel[q] && !S.done[q]), can = cands.length > 0, oc0 = can ? S.slot[cands[0]] : null;
    const k = await g.decide(p, { k: 'opt', q: 'Shuriken: choose one.', opts: ['Gain Initiative and draw a card', cands.length > 1 ? 'Cancel an opponent’s revealed card — they discard it and draw' : `Cancel ${oc0 ? CARDS[oc0.id].n : 'their card'} — they discard it and draw`], dis: [false, !can], cpu: can && CARDS[oc0.id].v >= 6 ? 1 : 0 });
    if (k === 0) { g.gainInit(p); await g.draw(p, 1); }
    else { const o = cands.length > 1 ? await g.decide(p, { k: 'player', q: 'Shuriken: cancel whose card?', opps: cands, cpu: cands.slice().sort((a, b) => CARDS[S.slot[b].id].v - CARDS[S.slot[a].id].v)[0] }) : cands[0], oc = S.slot[o]; S.cancel[o] = true; g.log(`Shuriken! ${CARDS[oc.id].n} is discarded without resolving.`, 'big'); await g.draw(o, 1); } } },
  // Croh
  undertow: { n: 'Undertow', el: 'W', t: 1, v: 7, wiz: 1, ult: 1, fx: async (g, p) => {
    for (const q of g.opps(p)) await g.randomDiscard(q, 1); await g.draw(p, 1); if (g.opps(p).some(q => g.S.pl[p].hand.length >= handSize(g.S, q) + 3)) await g.gainDoom(p); } },
  sinking: { n: 'Sinking Strike', el: 'F', t: 1, v: 7, wiz: 1, ult: 1, fx: async (g, p) => {
    await g.mana(p, 2); const x = g.S.pl[p].doom; if (x) await g.dmg(p, x); else g.log('No DOOM Tokens — Sinking Strike deals no damage.'); if (!g.S.special.curse) await g.gainDoom(p); } },
  // Abragail
  deepgems: { n: 'Deep Gems', el: 'W', t: 1, v: 7, wiz: 1, ult: 1, fx: async (g, p) => {
    await g.draw(p, 1); await g.mana(p, 1); const S = g.S, P = S.pl[p];
    const ws = S.cloud.map((c, i) => isEl(c, 'W') ? i : -1).filter(i => i >= 0); if (!ws.length || !P.power) return;
    const bestW = Math.max(...ws.map(i => CARDS[S.cloud[i].id].v));
    if (!await g.yn(p, 'Deep Gems: lose 1 Power to resolve a Water card from the Storm Cloud, then VOID it?', bestW >= 6)) return;
    g.losePower(p, 1);
    const i = await g.decide(p, { k: 'gain', q: 'Deep Gems: choose a Water card in the Storm Cloud to resolve, then VOID.', slots: ws, optional: 0, verb: 'Resolve' });
    const c = S.cloud[i]; S.cloud[i] = null; g.refill(i); g.log(`${g.nm(p)} ${p === 0 ? 'resolve' : 'resolves'} ${CARDS[c.id].n} from the Storm Cloud.`); await g.resolve(p, c, 'cloud'); S.void.push(c); } },
  curriculum: { n: 'New Curriculum', el: 'E', t: 1, v: 7, wiz: 1, ult: 1, fx: async (g, p) => {
    const S = g.S, P = S.pl[p]; await g.power(p, P.tier);
    const it = S.cloud.filter(Boolean);
    if (it.length) { const pick = await g.decide(p, { k: 'pick', q: 'New Curriculum: you may VOID up to 2 cards in the Storm Cloud.', items: it, min: 0, max: 2, cpu: x => x.filter(c => CARDS[c.id].t > P.tier).slice(0, 2) });
      for (const c of pick) { const i = S.cloud.indexOf(c); S.cloud[i] = null; S.void.push(c); g.log(`${g.nm(p)} ${p === 0 ? 'VOID' : 'VOIDs'} ${CARDS[c.id].n} from the Storm Cloud.`); }
      for (let i = 0; i < 5; i++) g.refill(i); }
    await g.gainCard(p); } },
  // May
  starshot: { n: 'Star Shot', el: 'F', t: 1, v: 7, wiz: 1, ult: 1, fx: async (g, p) => {
    const P = g.S.pl[p];
    if (P.hand.length) { const [c] = await g.decide(p, { k: 'pick', q: 'Star Shot: discard a card to deal 1 damage (2 if it’s Tier II).', items: P.hand.slice(), min: 1, max: 1, cpu: x => { const t2 = x.filter(c => CARDS[c.id].t === 2 && CARDS[c.id].v <= 8); return [t2[0] || cheapest(x, 1)[0]]; } });
      const t2 = CARDS[c.id].t === 2; await g.discardFrom(p, c, 'hand'); await g.dmg(p, t2 ? 2 : 1); }
    if (P.energy) await g.mana(p, P.energy); const lost = Math.min(2, P.energy); P.energy -= lost; if (lost) g.log(`${g.nm(p)} ${p === 0 ? 'lose' : 'loses'} ${lost} Energy.`); } },
  databreach: { n: 'Data Breach', el: 'E', t: 1, v: 7, wiz: 1, ult: 1, fx: async (g, p) => {
    const o = await g.chooseOpp(p, 'Data Breach: which opponent?'), P = g.S.pl[p], O = g.S.pl[o]; const mx = Math.min(2, P.energy); let k = 0;
    if (mx) k = mx === 1 ? 1 : 1 + await g.decide(p, { k: 'opt', q: `Data Breach: lose 1 or 2 Energy to Power Up that many times. (You have ${P.energy}.)`, opts: ['Lose 1', 'Lose 2'], dis: [false, mx < 2], cpu: P.energy >= 3 ? 0 : 1 });   // the card says lose 1 or 2
    if (k) { P.energy -= k; await g.power(p, k); }
    if (P.energy >= 2 && O.rb) { if (O.blast) { O.blast--; g.log('Robot Boy loses a Blast Token.'); } } else if (P.energy >= 2 && O.hand.length) {
      g.log(`${g.nm(o)} ${o === 0 ? 'reveal' : 'reveals'} ${g.nm(o, 1, 1)} hand to ${g.nm(p, 1)}.`);
      const [c] = await g.decide(p, { k: 'pick', q: 'Data Breach: choose a card from your opponent’s hand for them to discard.', items: O.hand.slice(), min: 1, max: 1, cpu: x => [best(x.filter(c => !CARDS[c.id].junk)) || x[0]] });
      await g.discardFrom(o, c, 'hand');
    } } },
  // Bunny
  buddy: { n: 'Buddy System', el: 'E', t: 1, v: 7, wiz: 1, ult: 1, fx: async (g, p) => {
    for (const q of g.order()) if (g.S.pl[q].tier === 1) await g.power(q, 1);
    await g.power(p, 1); await g.mana(p, 1);
    const cands = [...g.S.pl.keys()].filter(q => q !== p).map(q => g.S.rev[q]).filter(c => isEl(c, 'E') && !CARDS[c.id].junk);
    if (cands.length === 1) { const oc = cands[0]; if (await g.yn(p, `Buddy System: resolve the revealed ${CARDS[oc.id].n} for yourself?`, CARDS[oc.id].v >= 4)) await g.resolve(p, oc, 'copy'); }
    else if (cands.length > 1) { const [oc] = await g.decide(p, { k: 'pick', q: 'Buddy System: you may resolve a different revealed Earth card for yourself.', items: cands, min: 0, max: 1, cpu: x => [best(x)] }); if (oc) await g.resolve(p, oc, 'copy'); } } },
  snowday: { n: 'Snow Day', el: 'W', t: 1, v: 7, wiz: 1, ult: 1, fx: async (g, p) => {
    await g.heal(p, 2); for (const q of g.opps(p)) if (!g.S.pl[q].discard.some(c => c.id === 'ice')) await g.gainSpecial(q, 'ice'); } },
});

Object.assign(WIZ, {
  abragail: { n: 'Abragail', short: 'Abragail', hp: 16, ini: 7, cost: 4, un: 'Level Up!', els: ['W', 'E'], spells: ['deepgems', 'curriculum'],
    start: 'Did Her Research: gains 1 Power at every battle start, plus any powers researched in her Journal.', ut: 'Add a Research Token to a space in Abragail’s Journal.',
    ult: async (g, p) => {
      const P = g.S.pl[p]; if (P.research.filter(Boolean).length >= 6) { g.log('All six Research Tokens are already placed.'); return; }
      const pref = [7, 6, 2, 0, 3, 1, 5, 4]; const cpu = pref.find(i => !P.research[i]);
      const k = await g.decide(p, { k: 'opt', q: 'Level Up! Place a Research Token. Researched powers activate at the start of every battle.', opts: JOURNAL, dis: P.research.map(Boolean), cpu });
      P.research[k] = 1; g.ev('research', p, P.research.filter(Boolean).length); g.log(`${g.nm(p)} researched: ${JOURNAL[k]}.`, 'big'); } },
  croh: { n: 'Croh Vosh', short: 'Croh', hp: 20, ini: 8, cost: 6, un: 'DOOOOOOOM!', els: ['F', 'W'], spells: ['undertow', 'sinking'],
    start: 'Accursed: can never heal. Whenever he would heal, he gives 1 CURSE instead.', ut: 'For each DOOM Token, take a card from your discard into your hand or draw. With no DOOM Tokens, gain one.',
    ult: async (g, p) => {
      const P = g.S.pl[p]; if (!P.doom) { await g.gainDoom(p); return; }
      for (let i = 0; i < P.doom; i++) {
        const can = P.discard.length > 0;
        const k = await g.decide(p, { k: 'opt', q: `DOOOOOOOM! (${i + 1} of ${P.doom}): take a card from your discard or draw?`, opts: ['Take from discard', 'Draw a card', 'Skip'], dis: [!can, false, false], cpu: can && goodInDiscard(P) ? 0 : 1 });
        if (k === 0) await takeFromDiscard(g, p, 'Choose a card to return to your hand.'); else if (k === 1) await g.draw(p, 1);
      } } },
  omar: { n: 'Omar Evans', short: 'Omar', hp: 10, ini: 1, cost: 4, un: 'Hidden Movement', els: ['F', 'W'], spells: ['beetle', 'shuriken'],
    start: 'Has 3 hidden Traps. His Ultimate sets one face-down.', ut: 'Return a card from your discard to your hand or draw. Set a Trap face-down (not the same one twice in a row).',
    ult: async (g, p) => {
      const P = g.S.pl[p]; const can = P.discard.length > 0;
      const k = await g.decide(p, { k: 'opt', q: 'Hidden Movement: return a card from your discard to your hand, or draw?', opts: ['Return from discard', 'Draw a card'], dis: [!can, false], cpu: can && goodInDiscard(P) ? 0 : 1 });
      if (k === 0) await takeFromDiscard(g, p, 'Choose a card to return to your hand.'); else await g.draw(p, 1);
      const ids = Object.keys(TRAPS); const dis = ids.map(id => !!(P.trap && P.trap.id === id));
      const fire = [...P.hand, ...P.deck, ...P.discard].filter(c => isEl(c, 'F') && !CARDS[c.id].junk).length, water = [...P.hand, ...P.deck, ...P.discard].filter(c => isEl(c, 'W') && !CARDS[c.id].junk).length;
      let want = P.hp <= 6 ? 'dodge' : (fire >= water ? 'mud' : 'ice'); if (P.trap && P.trap.id === want) want = ids.find(i => i !== want && i !== 'dodge') || 'dodge';
      const t = await g.decide(p, { k: 'opt', trap: 1, q: 'Set a Trap face-down. It replaces your current Trap.', opts: ids.map(i => `${TRAPS[i].n} — ${TRAPS[i].trig}`), dis, cpu: ids.indexOf(want) });
      P.trap = { id: ids[t], used: false }; g.log(p === 0 ? `You set ${TRAPS[ids[t]].n} face-down.` : 'Omar sets a Trap face-down.', 'big'); } },
  bunny: { n: 'Bunny Wizard', short: 'Bunny', hp: 8, ini: 2, cost: 5, un: 'Cast a Magic Trick!', els: ['W', 'E'], spells: ['buddy', 'snowday'],
    start: 'Double Stitch: can heal up to 10 health. Triple Stitch: healing at 10 draws a card per point instead.', ut: 'Reveal a non-Wizard card from your hand. Resolve it twice and VOID it. All players heal 1.',
    ult: async (g, p) => {
      const S = g.S, P = S.pl[p]; const it = P.hand.filter(c => !CARDS[c.id].wiz && !CARDS[c.id].junk);
      if (it.length) {
        const [c] = await g.decide(p, { k: 'pick', q: 'Cast a Magic Trick! Choose a non-Wizard card from your hand to resolve twice, then VOID.', items: it, min: 1, max: 1, cpu: x => [best(x)] });
        P.hand.splice(P.hand.indexOf(c), 1); g.log(`${g.nm(p)} ${p === 0 ? 'cast' : 'casts'} ${CARDS[c.id].n} twice!`, 'big');
        await g.resolve(p, c, 'copy'); await g.resolve(p, c, 'copy'); S.void.push(c);
      }
      for (const q of g.order()) await g.heal(q, 1); } },
  oren: { n: 'Oren Bark', short: 'Oren', hp: 16, ini: 6, cost: 5, un: 'Bottoms up, I guess!', els: ['F', 'E'], spells: ['potiongun', 'unstable'],
    start: 'Chemist: Fire, Earth and Water Elements start at 3 (max 6) and pay for potions.', ut: 'Shuffle the Potion Deck and drink potions one at a time, paying their Element cost. A third TOXIC ends it with an ASH, CURSE and ICE. Elements reset to 3 after.',
    ult: async (g, p) => {
      const S = g.S, P = S.pl[p]; const outer = S.potion, outerDeck = P.potions; P.potions = shuffle(Object.keys(POTIONS)); let tox = 0, twice = false, drinks = 0, bust = false;
      const s0 = S.pl.map((_, q) => snapP(S, q)); S.potion = { p, drawn: [], tox: 0, chem: { ...P.chem }, stage: 'drink', result: null, bust: false };
      await g.pause(900);
      while (P.potions.length) {
        const id = P.potions.pop(), d = POTIONS[id]; S.potionShow = id; drinks++; const ent = { id, paid: null, twice: false, t: Date.now() }; S.potion.drawn.push(ent);
        g.log(`${g.nm(p)} ${p === 0 ? 'drink' : 'drinks'} “${d.n}” (${ELN[d.el]} ${d.cost}${d.tox ? ', TOXIC' : ''}).`, 'res'); await g.pause(800);
        if (P.chem[d.el] >= d.cost) { P.chem[d.el] -= d.cost; ent.paid = true; S.potion.chem = { ...P.chem }; const reps = twice ? 2 : 1; ent.twice = twice; twice = false; await g.pause(500); for (let r = 0; r < reps; r++) { if ((await d.fx(g, p)) === 'twice') twice = true; } }
        else { ent.paid = false; g.log(`Not enough ${ELN[d.el]} Element — no effect.`); }
        if (d.tox) S.potion.tox = tox + 1; S.potion.chem = { ...P.chem }; await g.pause(700);
        if (d.tox && ++tox >= 3) { g.log('Third TOXIC potion! The Ultimate ends — gain an ASH, a CURSE and an ICE.', 'warn'); bust = true; S.potion.bust = true; for (const t of ['ash', 'curse', 'ice']) await g.gainSpecial(p, t); break; }
        if (!P.potions.length) break;
        if (!await g.decide(p, { k: 'yn', potion: 1, q: `Drink another potion? TOXIC so far: ${tox} of 3. Elements: Fire ${P.chem.F}, Earth ${P.chem.E}, Water ${P.chem.W}.`, cpu: tox < 2 })) break;
      }
      g.ev('potions', p, { n: drinks, bust }); P.chem = { F: 3, E: 3, W: 3 }; S.potionShow = null; S.potion.chem = { ...P.chem };
      S.potion.result = S.pl.map((_, q) => deltaList(s0[q], snapP(S, q), { hand: 1 })); S.potion.stage = 'done';
      g.log(`Oren drank ${drinks} potion${drinks > 1 ? 's' : ''}${bust ? ' and hit a third TOXIC' : ''}. Elements reset to 3.`);
      if (!g.io.sim && g.io.ack) await g.io.ack('potion'); else await g.pause(2600); S.potion = outer || null; if (outer) P.potions = outerDeck; } },
  may: { n: 'May Danaris', short: 'May', hp: 12, ini: 4, cost: 6, un: 'Void Traveler', els: ['F', 'E'], spells: ['starshot', 'databreach'],
    start: 'Energize: starts with 2 Energy (max 3). Dangerous Download: at round end, may spend 1 Energy and 1 mana to resolve the opponent’s revealed Tier II card.', ut: 'Gain 3 Energy. You may resolve a non-Wizard card from your hand or the VOID, then put it on the bottom of the Spellstorm Deck.',
    ult: async (g, p) => {
      const S = g.S, P = S.pl[p]; P.energy = 3; g.log(`${g.nm(p)} ${p === 0 ? 'charge' : 'charges'} to 3 Energy.`);
      const it = [...P.hand.filter(c => !CARDS[c.id].wiz && !CARDS[c.id].junk), ...S.void.filter(c => !CARDS[c.id].junk)]; if (!it.length) return;
      const pick = await g.decide(p, { k: 'pick', q: 'Void Traveler: you may resolve a card from your hand or the VOID, then put it on the bottom of the Spellstorm Deck.', items: it, owner: c => P.hand.includes(c) ? 'Your hand' : 'The VOID', min: 0, max: 1, cpu: x => { const b = best(x); return b && CARDS[b.id].v >= 6 ? [b] : []; } });
      for (const c of pick) { const z = P.hand.includes(c) ? P.hand : S.void; z.splice(z.indexOf(c), 1); g.log(`${g.nm(p)} ${p === 0 ? 'resolve' : 'resolves'} ${CARDS[c.id].n}.`); await g.resolve(p, c, 'copy'); S.sdeck.unshift(c); } } },
});

// ---------- engine behaviour changes ----------
Game.prototype.gainDoom = async function (p) { const P = this.S.pl[p]; if (P.doom < 4) { P.doom++; this.ev('doom', p, P.doom); this.log(`${this.nm(p)} ${p === 0 ? 'gain' : 'gains'} a DOOM Token (${P.doom}/4).`, 'big'); } };
Game.prototype.heal = async function (p, n) {
  if (n <= 0) return; const P = this.S.pl[p];
  if (P.wiz === 'croh') { this.log('Accursed: Croh can’t heal — he gives a CURSE instead.'); await this.giveAll(p, 'curse'); return; }
  if (P.wiz === 'bunny') {
    const k = Math.min(n, Math.max(0, P.max + 2 - P.hp)), w = n - k; P.hp += k; if (k) { this.log(`${this.nm(p)} ${p === 0 ? 'heal' : 'heals'} ${k}.`, 'heal'); this.ev('heal', p, k); }
    if (w > 0) { this.log(`Triple Stitch: ${this.nm(p)} ${p === 0 ? 'draw' : 'draws'} ${w} for wasted healing.`); this.ev('stitch', p, w); await this.draw(p, w); }
    return;
  }
  const k = Math.min(n, P.max - P.hp); P.hp += k; if (k) { this.log(`${this.nm(p)} ${p === 0 ? 'heal' : 'heals'} ${k}.`, 'heal'); this.ev('heal', p, k); }
};
Game.prototype.damage = async function (t, n, src) {
  if (n <= 0) return; const P = this.S.pl[t];
  if (src !== undefined && src !== t && P.trap && !P.trap.used && P.trap.id === 'dodge' && await this.yn(t, `Reveal Dodge!? The first 2 damage you take this round is negated.`, true)) {
    P.trap.used = true; P.dodge = 2; this.ev('trap', t, 'dodge'); this.log(`${this.nm(t)} ${t === 0 ? 'reveal' : 'reveals'} Dodge!`, 'big');
  }
  if (P.dodge > 0) { const a = Math.min(P.dodge, n); P.dodge -= a; n -= a; this.log(`Dodge! negates ${a} damage.`); if (n <= 0) return; }
  const k = Math.min(n, P.hp); P.hp -= k; this.log(`${this.nm(t)} ${t === 0 ? 'take' : 'takes'} ${n} damage.`, 'dmg'); if (!this.io.sim && this.io.fx) this.io.fx('hit', t); this.checkWin();
};
Game.prototype.dmg = async function (p, n) { for (const q of this.opps(p)) await this.damage(q, n, p); };
const _round = Game.prototype.round;
Game.prototype.round = async function (r) { for (const P of this.S.pl) P.dodge = 0; return _round.call(this, r); };
Game.prototype.battle = async function () {
  const S = this.S; S.battle++; S.phase = 'battle';
  for (const p of this.order()) if (!S.pl[p].rb) await this.draw(p, 3 - S.pl[p].hand.length);
  for (const p of this.order()) await this.battleStart(p);
  for (let r = 1; r <= 4; r++) await this.round(r);
};
Game.prototype.battleStart = async function (p) {
  const S = this.S, P = S.pl[p]; if (P.wiz !== 'abragail') return;
  this.log(`Did Her Research: ${this.nm(p)} ${p === 0 ? 'gain' : 'gains'} 1 Power.`); await this.power(p, 1);
  const R = P.research; if (!R.some(Boolean)) return;
  const m = (R[0] ? 1 : 0) + (R[1] ? 1 : 0), pw = (R[2] ? 1 : 0) + (R[3] ? 1 : 0);
  if (m) await this.mana(p, m); if (pw) await this.power(p, pw); if (m || pw) this.log(`Journal: ${m ? `+${m} mana ` : ''}${pw ? `+${pw} power` : ''}`.trim());
  if (R[7]) await this.draw(p, 1);
  if (R[6]) await this.gainCard(p);
  if (R[4]) { const it = P.hand.filter(c => !CARDS[c.id].wiz); if (it.length) { const pick = await this.decide(p, { k: 'pick', q: 'Journal: you may VOID a card from your hand.', items: it, min: 0, max: 1, cpu: x => x.filter(c => CARDS[c.id].junk).slice(0, 1) }); for (const c of pick) this.voidFrom(p, c, P.hand); } }
  if (R[5]) { const it = P.discard.filter(c => CARDS[c.id].junk); if (it.length) { const pick = await this.decide(p, { k: 'pick', q: 'Journal: you may move an ICE, ASH or CURSE from your discard to your opponent’s discard.', items: it, min: 0, max: 1, cpu: x => [x[0]] });
    for (const c of pick) { const to = await this.chooseOpp(p, 'Journal: move it to which opponent?'); P.discard.splice(P.discard.indexOf(c), 1); S.pl[to].discard.push(c); this.log(`${this.nm(p)} ${p === 0 ? 'move' : 'moves'} a ${CARDS[c.id].n} to ${this.nm(to, 1, 1)} discard.`); } } }
};
Game.prototype.afterPlay = async function () {
  const S = this.S; S.phase = 'reveal'; S.revealed = true; S.rev = S.slot.slice(); S.cancel = S.slot.map(() => false); S.done = S.slot.map(() => false);
  if (!this.io.sim) { this.log(`Reveal: you played ${S.slot[0] ? CARDS[S.slot[0].id].n : 'nothing'}; ${this.nm(1)} played ${S.slot[1] ? CARDS[S.slot[1].id].n : 'nothing'}.`); this.io.fx && this.io.fx('reveal'); await this.pause(900); }
  for (const p of this.order()) {
    const nx = this.nextOpp(p), m = S.rev[p], t = S.rev[nx]; if (!(m && t && BEATS[CARDS[m.id].el] === CARDS[t.id].el)) continue;
    this.ev('counter', p); this.log(`${this.nm(p)} COUNTERED ${this.nm(nx, 1)} and ${S.pl[p].rb ? 'gains a Blast Token' : p === 0 ? 'draw' : 'draws'}${S.pl[p].rb ? '' : ' a card'}.`, 'counter'); if (!this.io.sim && this.io.fx) this.io.fx('counter', p);
    await this.draw(p, 1); await this.pause(500);
    const P = S.pl[p], el = CARDS[m.id].el;
    if (P.trap && !P.trap.used && ((P.trap.id === 'mud' && el === 'F') || (P.trap.id === 'ice' && el === 'W'))) {
      const T = TRAPS[P.trap.id];
      if (await this.yn(p, `Reveal ${T.n}? ${T.eff}`, true)) {
        P.trap.used = true; this.ev('trap', p, P.trap.id); this.log(`${this.nm(p)} ${p === 0 ? 'reveal' : 'reveals'} ${T.n}!`, 'big'); await this.pause(500);
        if (P.trap.id === 'mud') { await this.dmg(p, 1); await this.mana(p, 1); this.gainInit(p); }
        else { await this.giveAll(p, 'ice'); await this.mana(p, 1); await this.offerUlt(p, false); }
      }
    }
  }
  if (!this.io.sim && this.io.tut && S.tutorial) await this.io.tut('reveal');
  if (S.pl.some(P => P.rb)) this.rbRevealMore();
  const W = WEATHER[S.wcur];
  if (W.rev) for (const p of this.order()) if (isEl(S.rev[p], W.rev.el)) { this.log(`${W.n}: ${this.nm(p)} revealed ${ELN[W.rev.el]}.`); if (W.rev.mana) await this.mana(p, W.rev.mana); if (W.rev.power) await this.power(p, W.rev.power); }
  S.phase = 'resolve'; const dest = S.slot.map(() => null);
  let ord = this.order(); const sh = [...S.pl.keys()].find(p => S.slot[p] && S.slot[p].id === 'shuriken'); if (sh !== undefined) ord = [sh, ...ord.filter(q => q !== sh)];
  for (const p of ord) {
    const c = S.slot[p]; if (!c) continue;
    if (S.cancel[p]) { S.done[p] = true; continue; }
    this.log(`${this.nm(p)} ${p === 0 ? 'resolve' : 'resolves'} ${CARDS[c.id].n}.`, 'res'); S.resolving = p; await this.pause(350);
    const x = await this.resolve(p, c, 'play'); dest[p] = x.dest; if (S.pl[p].rb) { for (const e of (S.rbMore && S.rbMore[p]) || []) await this.resolve(p, e, 'play'); await this.rbEndTurn(p); } S.done[p] = true; await this.pause(500);
  }
  S.resolving = null;
  if (W.after) for (const p of this.order()) await this.offerUlt(p, false);
  for (const p of this.order()) {
    const P = S.pl[p], cands = [...S.pl.keys()].filter(q => q !== p).map(q => S.rev[q]).filter(c => c && CARDS[c.id].t === 2);
    if (P.wiz === 'may' && P.energy >= 1 && P.mana >= 1 && cands.length) {
      let oc = null;
      if (cands.length === 1) { if (await this.yn(p, `Dangerous Download: spend 1 Energy and 1 mana to resolve ${CARDS[cands[0].id].n} for yourself?`, CARDS[cands[0].id].v >= 7)) oc = cands[0]; }
      else [oc] = await this.decide(p, { k: 'pick', q: 'Dangerous Download: you may spend 1 Energy and 1 mana to resolve another player’s revealed Tier II card.', items: cands, min: 0, max: 1, cpu: x => { const b = best(x); return CARDS[b.id].v >= 7 ? [b] : []; } });
      if (oc) {
        P.energy--; P.mana--; this.ev('download', p); this.log(`${this.nm(p)} ${p === 0 ? 'download' : 'downloads'} ${CARDS[oc.id].n}!`, 'big'); await this.resolve(p, oc, 'copy');
      }
    }
  }
  for (const p of S.pl.keys()) { const c = S.slot[p]; if (c) this.place(p, c, S.cancel[p] ? null : dest[p]); if (S.rbMore && S.rbMore[p]) { S.pl[p].discard.push(...S.rbMore[p]); S.rbMore[p] = []; } }
  S.slot = [null, null]; S.revealed = false;
};

//EXPORTS
if (typeof module !== 'undefined') module.exports = { CARDS, WIZ, WEATHER, WEATHER_TEXT, ELN, BEATS, Game, GameOver, newState, cpuDecide, choosePlay, SIM_IO, evalState, TRAPS, JOURNAL, POTIONS };
