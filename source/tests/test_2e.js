const E=require('./eng_all.js');
function mk(a,b,ed=2){const S=E.newState(a,b);E.applyEdition(S,ed);S.battle=1;S.round=1;const L=[];
  const io={sim:false,log(m){L.push(m)},render(){},pause(){return Promise.resolve()},fx(){},ev(){},decide:(g,p,req)=>{if(req.k==='pick')return Promise.resolve(req.items.slice(0,Math.max(1,req.min||0)));if(req.k==='opt')return Promise.resolve(req.opts.findIndex((o,i)=>!(req.dis&&req.dis[i])));if(req.k==='yn')return Promise.resolve(true);if(req.k==='player')return Promise.resolve((req.opps||[1])[0]);return Promise.resolve(E.cpuDecideX(g,p,req));}};
  return {S,g:new E.Game(S,io),L};}
const show=(t,ok,x)=>console.log(`${ok?'✓':'✗'} ${t}${x?'  — '+x:''}`);
(async()=>{
 for(const ed of [1,2]){const {S}=mk('abragail','eve',ed);show(`Ed ${ed}: Abragail ${S.pl[0].hp}/${S.pl[0].max}, Eve ${S.pl[1].hp}/${S.pl[1].max}`,ed===2?S.pl[0].max===12&&S.pl[1].max===12:S.pl[0].max===16&&S.pl[1].max===14);}
 {const {S,g,L}=mk('omar','derby');S.pl[0].hand=[{u:901,id:'dart'}];const h=S.pl[1].hp;await E.CARDS.beetle.fx(g,0);show('Beetle Buster: discards a Fire card, chosen player takes 3',S.pl[1].hp===h-3&&!S.pl[0].hand.length,`Derby ${h} → ${S.pl[1].hp}`);}
 {const {S,g,L}=mk('may','derby');S.pl[0].energy=2;S.pl[0].hand=[{u:902,id:'fb'},{u:905,id:'block'}];const h=S.pl[1].hp;await E.CARDS.starshot.fx(g,0);
   show('Star Shot: 1 damage, then lose 2 Energy to resolve Fireball from hand',S.pl[0].energy===0&&S.pl[1].hp<=h-2&&!S.pl[0].hand.some(c=>c.id==='fb')&&S.pl[0].discard.some(c=>c.id==='fb'),`Derby ${h} → ${S.pl[1].hp}, Energy 2 → ${S.pl[0].energy}, hand ${S.pl[0].hand.map(c=>c.id)}`);}
 {const {S,g,L}=mk('may','derby');S.pl[0].energy=1;S.pl[0].hand=[{u:902,id:'fb'}];const h=S.pl[1].hp;await E.CARDS.starshot.fx(g,0);
   show('Star Shot with only 1 Energy: just the 1 damage',S.pl[0].energy===1&&S.pl[1].hp===h-1&&S.pl[0].hand.length===1,`Derby ${h} → ${S.pl[1].hp}`);}
 {const {S,g,L}=mk('may','derby');S.pl[0].energy=3;S.pl[0].hand=[{u:902,id:'curse'},{u:906,id:'block'}];const h=S.pl[1].hp;await E.CARDS.starshot.fx(g,0);
   show('Star Shot can’t resolve a CURSE (no Fire spell in hand): Energy kept',S.pl[0].energy===3&&S.pl[1].hp===h-1&&S.pl[0].hand.length===2);}
 {const {S,g,L}=mk('may','derby');S.pl[0].energy=2;S.rev=[{u:907,id:'block'},{u:908,id:'dart'}];const pw=S.pl[0].power+S.pl[0].tier*7;S.pl[1].hand=[{u:903,id:'fb'},{u:904,id:'block'}];await E.CARDS.databreach.fx(g,0);
   show('Data Breach with Water revealed: +1 Energy, Power +2, opponent discards a card',S.pl[0].energy===3&&S.pl[0].power+S.pl[0].tier*7===pw+2&&S.pl[1].hand.length===1,`Energy 2 → ${S.pl[0].energy}, opponent hand 2 → ${S.pl[1].hand.length}`);}
 {const {S,g,L}=mk('may','derby');S.pl[0].energy=2;S.rev=[{u:907,id:'dart'},{u:908,id:'fb'}];S.pl[1].hand=[{u:903,id:'fb'}];await E.CARDS.databreach.fx(g,0);
   show('Data Breach without Water: no Energy, still Power +2 and the discard',S.pl[0].energy===2&&S.pl[1].hand.length===0);}
 {const {S,g,L}=mk('may','derby');S.pl[0].energy=3;S.rev=[{u:907,id:'block'},null];S.pl[1].hand=[];await E.CARDS.databreach.fx(g,0);
   show('Data Breach at 3 Energy: stays at the maximum of 3',S.pl[0].energy===3);}
 {const {S,g,L}=mk('omar','derby');S.init=1;await E.WIZ.omar.ult(g,0);show('Hidden Movement: Omar gains the Initiative',S.init===0);}
 {const {S,g,L}=mk('omar','derby',1);S.init=1;await E.WIZ.omar.ult(g,0);show('Hidden Movement in First Edition: no Initiative',S.init===1);}
 {const {S,g,L}=mk('croh','derby');S.pl[0].doom=2;S.pl[0].discard=[{u:990,id:'fb'},{u:991,id:'dart'}];const hand=S.pl[0].hand.length,c=S.pl[1].discard.length;await E.WIZ.croh.ult(g,0);const took=S.pl[0].hand.length-hand;show('DOOOOOOOM! (2E): CURSE to the opponent; takes up to one discard card per DOOM (2 DOOM → at most 2)',S.pl[1].discard.length===c+1&&took>=1&&took<=2&&S.pl[0].discard.length===2-took,`hand ${hand} → ${S.pl[0].hand.length}`);}
 {const {S,g,L}=mk('croh','derby',1);S.pl[0].doom=0;const hand=S.pl[0].hand.length;await E.WIZ.croh.ult(g,0);show('DOOOOOOOM! in First Edition: only gains the token',S.pl[0].doom===1&&S.pl[0].hand.length===hand);}
 for(const ini of [0,1]){const {S,g,L}=mk('abragail','derby');S.init=ini;const pw=S.pl[0].power;await g.battleStart(0);show(`R&D ${ini===0?'with':'without'} the Initiative`,S.pl[0].power===pw+(ini===0?0:1),`Power ${pw} → ${S.pl[0].power}`);}
 {const {S,g,L}=mk('abragail','derby');S.init=0;S.pl[0].research=[0,0,0,0,0,0,1,1];S.pl[0].discard=[{u:905,id:'fb'},{u:906,id:'block'}];S.pl[0].tier=3;const hand=S.pl[0].hand.length;
   await g.battleStart(0);const got=S.pl[0].hand.slice(hand).map(c=>E.CARDS[c.id].n+' ('+E.CARDS[c.id].el+')');show('Journal: Fire card from discard + an Earth card gained',S.pl[0].hand.slice(hand).some(c=>c.id==='fb')&&S.pl[0].hand.slice(hand).filter(c=>c.id!=='fb').every(c=>E.CARDS[c.id].el==='E'),'added to hand: '+got.join(', '));}
})();
