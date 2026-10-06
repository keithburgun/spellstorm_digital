const E=require('./eng_all.js');
function mk(ed,me='derby',op='eve'){const S=E.newState(me,op);E.applyEdition(S,ed);S.battle=1;S.round=1;const L=[];
  const io={sim:false,log(m){L.push(m)},render(){},pause(){return Promise.resolve()},fx(){},ev(){},decide:(g,p,req)=>{if(req.k==='pick')return Promise.resolve(req.items.slice(0,Math.max(1,req.min||0)));if(req.k==='player')return Promise.resolve((req.opps||[1])[0]);if(req.k==='gain')return Promise.resolve(req.slots&&req.slots.length?req.slots[0]:-1);return Promise.resolve(E.cpuDecideX(g,p,req));}};
  return {S,g:new E.Game(S,io),L};}
const ok=(t,c,x)=>console.log(`${c?'✓':'✗'} ${t}${x?'  — '+x:''}`);const cnt=(P,id)=>[...P.hand,...P.deck,...P.discard].filter(c=>c.id===id).length;
(async()=>{
 {const {S,g}=mk(2);S.rev=[{u:1,id:'lantern'},{u:2,id:'block'}];const pw=S.pl[0].power,m=S.pl[0].mana,h0=S.pl[0].hp,h1=S.pl[1].hp,c0=cnt(S.pl[0],'curse'),c1=cnt(S.pl[1],'curse');const x={how:'play'};await E.CARDS.lantern.fx(g,0,x);
  ok('Lantern: +1 Power +1 Mana; Water revealed → everyone takes 1 and gains a CURSE; not VOIDed',S.pl[0].power===pw+1&&S.pl[0].mana===m+1&&S.pl[0].hp===h0-1&&S.pl[1].hp===h1-1&&cnt(S.pl[0],'curse')===c0+1&&cnt(S.pl[1],'curse')===c1+1&&x.dest!=='void');}
 for(const ini of [0,1]){const {S,g}=mk(2);S.init=ini;const h=S.pl[1].hp,a=cnt(S.pl[0],'ash'),hand=S.pl[0].hand.length;const x={how:'play'};await E.CARDS.rapid.fx(g,0,x);
  ok(`Rapid Fire ${ini===0?'with':'without'} the Initiative`,ini===0?(S.pl[1].hp===h-2&&cnt(S.pl[0],'ash')===a+1&&x.dest==='hand'&&S.pl[0].hand.length===hand):(S.pl[1].hp===h&&x.dest!=='hand'&&S.pl[0].hand.length===hand),ini===0?'2 damage, +ASH, back to hand, no draw':'nothing, no draw');}
 {const {S,g}=mk(2);S.init=1;S.pl[0].hand=[{u:5,id:'pgem'}];S.pl[0].discard=[{u:6,id:'curse'}];const v=S.void.length;await E.CARDS.leap.fx(g,0);ok('Leap: gains the Initiative, VOIDs a card even with no Fire revealed',S.init===0&&S.void.length===v+1);}
 {const {S,g}=mk(2);S.pl[0].hand=[{u:7,id:'block'},{u:8,id:'dart'}];const m=S.pl[0].mana;await E.CARDS.manafont.fx(g,0);ok('Mana Font: discards a Water card from hand → +3 Mana',S.pl[0].mana===m+3&&!S.pl[0].hand.some(c=>c.id==='block'));
  const h=S.pl[0].hp,m2=S.pl[0].mana;await E.CARDS.manafont.dfx(g,0);ok('Mana Font discard effect: +1 Mana, no damage',S.pl[0].mana===m2+1&&S.pl[0].hp===h);}
 {const {S,g}=mk(2);S.pl[1].power=3;S.pl[1].mana=3;S.init=1;const h=S.pl[1].hp,hand=S.pl[1].hand.length;await E.CARDS.shock.fx(g,0);
  ok('Shockwave: 2 damage total, −2 Power, −2 Mana; no discard, Initiative kept',S.pl[1].hp===h-2&&S.pl[1].power===1&&S.pl[1].mana===1&&S.pl[1].hand.length===hand&&S.init===1);}
 {const {S,g}=mk(2);S.pl[0].tier=3;S.cloud=[{u:20,id:'twopow'},{u:21,id:'fb'},{u:22,id:'sift'},null,null];const pw=S.pl[0].power,before=S.pl[0].discard.length+S.pl[0].hand.length;await E.CARDS.amber.fx(g,0);
  const got=[...S.pl[0].discard,...S.pl[0].hand].filter(c=>c.u>=20&&c.u<=22).map(c=>E.CARDS[c.id].el);ok('Amber: no Power; gains up to 2 cards, Earth only',S.pl[0].power===pw&&got.length===2&&got.every(e=>e==='E'),'gained: '+got.join(','));}
 {const {S,g}=mk(2);S.pl[0].deck=['fb','dart','block'].map((id,i)=>({u:30+i,id}));const h=S.pl[1].hp;await E.CARDS.ruby.fx(g,0);ok('Ruby: 2 Fire cards among the top 3 → 2 damage, no VOID option',S.pl[1].hp===h-2);}
 {const {S,g}=mk(2);S.pl[1].hand=['fb','dart','block','pgem'].map((id,i)=>({u:40+i,id}));const h=S.pl[0].hp,ice=cnt(S.pl[1],'ice');await E.CARDS.arctite.fx(g,0);ok('Arctite: draw 2, opponent discards 2; no heal, no ICE',S.pl[1].hand.length===2&&cnt(S.pl[1],'ice')===ice);}
 {const {S,g}=mk(1);S.rev=[{u:1,id:'lantern'},{u:2,id:'block'}];const m=S.pl[0].mana;const x={how:'play'};await E.CARDS.lantern.fx(g,0,x);ok('First Edition Lantern unchanged: +2 Mana, VOIDed by a clockwise Water',S.pl[0].mana===m+2&&x.dest==='void');}
})();
