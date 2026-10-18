// Texel data + threat features. node texel2_gen.js <out> <seconds> <shard>
const fs=require('fs');const E=require('./eng_all.js');const W=['derby','eve','abragail','may','omar','bunny','oren','croh'];
const out=process.argv[2],LIMIT=+process.argv[3]*1000,SH=+process.argv[4]||0,t0=Date.now();
function pf(S,i){const P=S.pl[i],Wz=E.WIZ[P.wiz];let dv=0,junk=0;for(const c of [...P.hand,...P.deck,...P.discard]){const d=E.CARDS[c.id];if(d.junk)junk++;else dv+=d.v;}
  return{shard:P.shards,hp:P.hp,low:P.hp<=5?-(6-P.hp):0,mana:Math.min(P.mana,Wz.cost),manaX:Math.max(0,P.mana-Wz.cost),tier:P.tier-1,power:P.power,hand:P.hand.length,deck:dv,junk:-junk,junkH:-P.hand.filter(c=>E.CARDS[c.id].junk).length,
    init:S.init===i?1:0,doom:P.doom||0,energy:P.energy||0,research:(P.research||[]).filter(Boolean).length,trap:P.trap&&!P.trap.used?1:0,chem:P.wiz==='oren'?(P.chem.F+P.chem.E+P.chem.W):0};}
const hb=P=>P.hand.filter(c=>!E.CARDS[c.id].junk&&!E.CARDS[c.id].disc).length;
function feats(S,p){const op=1-p,a=pf(S,p),b=pf(S,op),f={};for(const key in a)f[key]=a[key]-b[key];
  const d=hb(S.pl[p])-hb(S.pl[op]),sg=d>0?1:d<0?-1:0;f.blastL=S.round>=3?sg:0;f.blastE=S.round>=3?0:sg;
  const W8=S.win||8;let close=0,low2=0;for(const [i,s] of [[p,1],[op,-1]]){const P=S.pl[i];if(P.shards>=W8-3)close+=s*(P.shards-(W8-4));if(P.hp<=5)low2-=s*(6-P.hp);}f.close=close;f.low2=low2;
  const tMe=E.roundsToKill(S,op,p),tOp=E.roundsToKill(S,p,op),sMe=E.roundsToShards(S,p,op),sOp=E.roundsToShards(S,op,p);
  for(const tau of [1.5,2.5,4,7])f['dng'+tau]=Math.exp(-tOp/tau)-Math.exp(-tMe/tau);
  for(const sc of [2,3,6])f['race'+sc]=Math.tanh((Math.min(tMe,sOp)-Math.min(tOp,sMe))/sc);
  f.killR=Math.tanh((tMe-tOp)/6);f.hpFrac=S.pl[p].hp/S.pl[p].max-S.pl[op].hp/S.pl[op].max;
  return f;}
(async()=>{let k=SH;while(Date.now()-t0<LIMIT){const a=W[k%8],b=W[(k*3+1)%8]===a?W[(k*3+2)%8]:W[(k*3+1)%8];E.seedRandom(314159+k*17);const S=E.newState(a,b);E.applyEdition(S,2);S.aiDiff={0:'expert',1:'expert'};
  const pos=[];let lastR=null;
  const io={sim:false,log(){},render(){},pause(){return Promise.resolve()},fx(){},ev(){},decide:(g,p,req)=>{if(req.k==='play'&&p===0){const key=g.S.battle+'.'+g.S.round;if(key!==lastR){lastR=key;pos.push([feats(g.S,0),feats(g.S,1)]);}}
    return req.k==='play'?E.aiChoosePlay(g.S,p):(req.k==='yn'&&req.ult?E.ultDecide(g.S,p,req.free):Promise.resolve(E.cpuDecideX(g,p,req)));}};
  let r=null;try{r=await new E.Game(S,io).run();}catch(e){}E.unseedRandom();
  if(r&&(r.winner===0||r.winner===1))fs.appendFileSync(out,JSON.stringify({w:r.winner,a,b,pos})+'\n');k+=2;}})();
