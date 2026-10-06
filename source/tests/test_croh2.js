const E=require('./eng_all.js');
function mk(ed){const S=E.newState('croh','derby');E.applyEdition(S,ed);S.battle=1;S.round=1;const L=[];
  const io={sim:false,log(m){L.push(m)},render(){},pause(){return Promise.resolve()},fx(){},ev(){},decide:(g,p,req)=>req.k==='player'?Promise.resolve((req.opps||[1])[0]):Promise.resolve(E.cpuDecideX(g,p,req))};return {S,g:new E.Game(S,io),L};}
const ok=(t,c,x)=>console.log(`${c?'✓':'✗'} ${t}${x?'  — '+x:''}`);
(async()=>{
 {const {S,g}=mk(2);S.pl[1].hand=['fb','dart','block','pgem'].map((id,i)=>({u:900+i,id}));S.rev=[{u:950,id:'undertow'},{u:951,id:'fb'}];const d=S.pl[0].doom,h=S.pl[0].hand.length;await E.CARDS.undertow.fx(g,0);
  ok('Undertow, countered (Water beats Fire): Croh draws 1, Derby discards 2, Croh gains DOOM',S.pl[1].hand.length===2&&S.pl[0].doom===d+1&&S.pl[0].hand.length===h+1,`Derby hand 4 → ${S.pl[1].hand.length}, DOOM ${d} → ${S.pl[0].doom}, Croh hand ${h} → ${S.pl[0].hand.length}`);}
 {const {S,g}=mk(2);S.pl[1].hand=['fb','dart','block','pgem'].map((id,i)=>({u:900+i,id}));S.rev=[{u:950,id:'undertow'},{u:951,id:'pgem'}];const d=S.pl[0].doom;await E.CARDS.undertow.fx(g,0);
  ok('Undertow, not countered (Earth beats Water): no DOOM',S.pl[0].doom===d,`DOOM ${d} → ${S.pl[0].doom}`);}
 {const {S,g}=mk(2);S.pl[0].doom=2;S.pl[0].discard=['fb','dart','curse','block'].map((id,i)=>({u:960+i,id}));const h=S.pl[0].hand.length,c=S.pl[1].discard.filter(x=>x.id==='curse').length;await E.WIZ.croh.ult(g,0);
  ok('DOOOOOOOM! with 2 DOOM: opponent gets a CURSE, Croh draws up to 2 cards from his discard',S.pl[1].discard.filter(x=>x.id==='curse').length===c+1&&S.pl[0].hand.length===h+2&&S.pl[0].discard.length===2,`Derby CURSEs +${S.pl[1].discard.filter(x=>x.id==='curse').length-c}, Croh hand ${h} → ${S.pl[0].hand.length}, discard → ${S.pl[0].discard.length}`);}
 {const {S,g}=mk(2);S.pl[0].doom=1;S.pl[0].discard=['fb','dart'].map((id,i)=>({u:970+i,id}));const h=S.pl[0].hand.length;await E.WIZ.croh.ult(g,0);
  ok('DOOOOOOOM! with 1 DOOM: CURSE, and up to 1 card from the discard',S.pl[0].hand.length===h+1&&S.pl[0].discard.length===1);}
 {const {S,g}=mk(1);S.pl[1].hand=['fb','dart','block','pgem'].map((id,i)=>({u:900+i,id}));S.rev=[{u:950,id:'undertow'},{u:951,id:'fb'}];const h=S.pl[0].hand.length;await E.CARDS.undertow.fx(g,0);
  ok('First Edition Undertow unchanged: 1 discard and a draw',S.pl[1].hand.length===3&&S.pl[0].hand.length===h+1);}
})();
