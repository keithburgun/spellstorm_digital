// All-bot fuzzer across every mode and difficulty (including Expert): checks invariants after each decision and at the end.
// node fuzz_ai.js games mode   (mode: 2p | ffa3 | ffa4 | 2v2 | coop | rb | long | ranked | ed1)
const E=require('./eng_all.js');const W=['derby','eve','abragail','may','omar','bunny','oren','croh'];
const [NG,MODE]=[+(process.argv[2]||20),process.argv[3]||'2p'];
const issues={};const note=(k,m)=>{(issues[k]=issues[k]||[]).push(m);};
function zones(S){const z=[];S.pl.forEach((P,i)=>{z.push(['hand'+i,P.hand],['deck'+i,P.deck],['disc'+i,P.discard]);});z.push(['cloud',S.cloud],['sdeck',S.sdeck],['void',S.void],['dragons',S.dragons],['slot',S.slot],['rev',S.rev]);return z;}
function check(S,where){const seen=new Map();for(const [n,a] of zones(S)){if(!Array.isArray(a))continue;for(const c of a){if(!c||typeof c!=='object'||c.u==null)continue;if(n==='rev'&&seen.has(c.u))continue;if(seen.has(c.u)&&!(n==='rev'||seen.get(c.u)==='rev')&&!(n==='slot'||seen.get(c.u)==='slot'))note('dup',`${where}: ${E.CARDS[c.id]&&E.CARDS[c.id].n} in ${seen.get(c.u)} and ${n}`);seen.set(c.u,n);if(!E.CARDS[c.id])note('badid',`${where}: ${c.id} in ${n}`);}}
  S.pl.forEach((P,i)=>{for(const k of ['hp','mana','power','tier','shards','energy','doom'])if(P[k]!=null&&!Number.isFinite(P[k]))note('nan',`${where}: p${i}.${k}=${P[k]}`);if(P.mana<0)note('neg',`${where}: p${i} mana ${P.mana}`);if(P.power<0)note('neg',`${where}: p${i} power ${P.power}`);if(P.tier>3||P.tier<1)note('tier',`${where}: tier ${P.tier}`);});
  for(const k of ['ice','ash','curse'])if(S.special[k]<0)note('neg',`${where}: special ${k} ${S.special[k]}`);}

const R=n=>Math.floor(Math.random()*n);const DF=['easy','normal','hard','expert'];
function pickW(n){const pool=W.slice(),r=[];for(let k=0;k<n;k++)r.push(pool.splice(R(pool.length),1)[0]);return r;}
function setup(i){const d=k=>DF[(i+k)%4];let S;
  if(MODE==='ffa3'||MODE==='ffa4'){S=E.newStateN(pickW(MODE==='ffa3'?3:4));S.aiDiff={};S.pl.forEach((_,k)=>S.aiDiff[k]=d(k));}
  else if(MODE==='2v2'){const w=pickW(4);S=E.newState2v2(w[0],w[1],w[2],w[3],d(1));S.aiDiff={0:d(0),1:d(1),2:d(2),3:d(3)};}
  else if(MODE==='coop'){const w=pickW(1+(i%3));S=E.newStateCoop(w[0],w.slice(1).length?w.slice(1):[w[0]==='derby'?'eve':'derby'],['easy','medium','hard'][i%3],d(1));S.aiDiff[0]=d(0);}
  else if(MODE==='rb'){S=E.newStateRB(pickW(1)[0],['easy','medium','hard'][i%3]);S.aiDiff={0:d(0)};S.diff=['easy','medium','hard'][i%3];}
  else{const w=pickW(2);S=E.newState(w[0],w[1]);S.aiDiff={0:DF[i%3],1:i%2?'expert':DF[(i+1)%3]};
    if(MODE==='long'){S.win=12;for(const P of S.pl){P.max=Math.round(P.max*1.5);P.hp=P.max;}}
    if(MODE==='ranked'){S.aiProf={1:{rank:['Bronze','Silver','Gold','Platinum','Diamond'][i%5],pers:['aggro','control','balanced'][i%3]}};}}
  E.applyEdition(S,MODE==='ed1'?1:2);return S;}
(async()=>{let n=0,err=0,hang=0;const t0=Date.now(),why={};
 for(let i=0;i<NG;i++){E.seedRandom(31337+i*7);let S;try{S=setup(i);}catch(e){note('setup',e.message);continue;}let steps=0,last='';
  const io={sim:false,log(m){last=m;},render(){},pause(){return Promise.resolve()},fx(){},ev(){},
   decide:async(g,p,req)=>{if(++steps>6000)throw new Error('HANG');check(g.S,`before ${req.k} '${(req.q||'').slice(0,50)}'`);
     const a=req.k==='play'?await E.aiChoosePlay(g.S,p):(req.k==='yn'&&req.ult?await E.ultDecide(g.S,p,req.free):await E.cpuDecideX(g,p,req));
     if(req.k==='play'&&(!a||!g.S.pl[p].hand.includes(a)))note('badplay',`p${p} played a card not in hand (${a&&a.id})`);
     if(req.k==='gain'&&typeof a==='number'&&a>=0&&!(req.slots||[]).includes(a))note('badgain',`p${p} gain slot ${a} not offered [${req.slots}] '${req.q}'`);
     if(req.k==='pick'&&Array.isArray(a)){const mn=req.min??1,mx=req.max??(req.items||[]).length;if(a.length<Math.min(mn,(req.items||[]).length)||a.length>mx)note('badpick',`p${p} picked ${a.length} (min ${mn} max ${mx}) '${(req.q||'').slice(0,60)}'`);if(a.some(x=>!(req.items||[]).includes(x)))note('badpick2',`p${p} picked an item not offered '${(req.q||'').slice(0,60)}'`);}
     if(req.k==='opt'&&(typeof a!=='number'||a<0||a>=req.opts.length||(req.dis&&req.dis[a])))note('badopt',`p${p} opt ${a} of ${req.opts.length} '${(req.q||'').slice(0,60)}'`);
     return a;}};
  let snap=null,cps=0;const stopAt=process.env.RES?1+R(40):-1;io.checkpoint=()=>{if(++cps===stopAt){snap=JSON.stringify(S);throw new Error('STOP');}};
  if(stopAt>0){try{const r0=await new E.Game(S,io).run();why[r0&&r0.why]=(why[r0&&r0.why]||0)+1;E.unseedRandom();n++;continue;}catch(e){if(e.message!=='STOP'){err++;note('error-pre',`${MODE} game ${i}: ${e.message} | ${(e.stack||'').split('\n').slice(1,3).join(' ')}`);E.unseedRandom();n++;continue;}}
    if(snap){S=JSON.parse(snap);io.checkpoint=()=>{};}}
  const tg=Date.now();try{const r=await (snap?new E.Game(S,io).resumeRun():new E.Game(S,io).run());if(process.env.V)console.log(i,JSON.stringify(S.aiDiff),S.pl.map(P=>P.wiz).join(),Date.now()-tg,"ms",steps,"decisions");check(S,'end');why[r&&r.why]=(why[r&&r.why]||0)+1;
    if(!r||r.winner==null)note('nowinner',`${MODE} game ${i}: result ${JSON.stringify(r)}`);
    S.pl.forEach((P,k)=>{if(P.hp>P.max+(P.wiz==='bunny'?2:0))note('hpmax',`p${k} hp ${P.hp}>${P.max}`);});}
  catch(e){if(e.message==='HANG')hang++;else{err++;note('error',`${MODE} game ${i}: ${e.message} | ${(e.stack||'').split('\n').slice(1,3).join(' ')} | last log: ${last}`);}}
  E.unseedRandom();n++;}
 console.log(`${MODE}: games ${n} errors ${err} hangs ${hang} ${((Date.now()-t0)/1000)|0}s endings ${JSON.stringify(why)}`);
 for(const [k,v] of Object.entries(issues)){const u=[...new Set(v)];console.log(`-- ${k}: ${v.length} (${u.length} distinct)`);u.slice(0,6).forEach(x=>console.log('   ',x));}})();
