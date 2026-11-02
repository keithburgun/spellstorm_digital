// Random-human fuzzer: one seat answers every prompt with a random *legal* answer; checks invariants after each decision.
// node fuzz.js games [players=2] [edition=2]
const E=require('./eng_all.js');const W=['derby','eve','abragail','may','omar','bunny','oren','croh'];
const [NG,NP,ED]=[+(process.argv[2]||100),+(process.argv[3]||2),+(process.argv[4]||2)];
const issues={};const note=(k,m)=>{(issues[k]=issues[k]||[]).push(m);};
function zones(S){const z=[];S.pl.forEach((P,i)=>{z.push(['hand'+i,P.hand],['deck'+i,P.deck],['disc'+i,P.discard]);});z.push(['cloud',S.cloud],['sdeck',S.sdeck],['void',S.void],['dragons',S.dragons],['slot',S.slot],['rev',S.rev]);return z;}
function check(S,where){const seen=new Map();for(const [n,a] of zones(S)){if(!Array.isArray(a))continue;for(const c of a){if(!c||typeof c!=='object'||c.u==null)continue;if(n==='rev'&&seen.has(c.u))continue;if(seen.has(c.u)&&!(n==='rev'||seen.get(c.u)==='rev')&&!(n==='slot'||seen.get(c.u)==='slot'))note('dup',`${where}: ${E.CARDS[c.id]&&E.CARDS[c.id].n} in ${seen.get(c.u)} and ${n}`);seen.set(c.u,n);if(!E.CARDS[c.id])note('badid',`${where}: ${c.id} in ${n}`);}}
  S.pl.forEach((P,i)=>{for(const k of ['hp','mana','power','tier','shards','energy','doom'])if(P[k]!=null&&!Number.isFinite(P[k]))note('nan',`${where}: p${i}.${k}=${P[k]}`);if(P.mana<0)note('neg',`${where}: p${i} mana ${P.mana}`);if(P.power<0)note('neg',`${where}: p${i} power ${P.power}`);if(P.tier>3||P.tier<1)note('tier',`${where}: tier ${P.tier}`);});
  for(const k of ['ice','ash','curse'])if(S.special[k]<0)note('neg',`${where}: special ${k} ${S.special[k]}`);}
const R=n=>Math.floor(Math.random()*n);
function rnd(g,p,req){const S=g.S,P=S.pl[p];
  switch(req.k){
  case 'play':{const h=P.hand.filter(c=>!E.CARDS[c.id].junk);return h[R(h.length)];}
  case 'gain':{const sp=req.special?(req.specials||['ice','ash','curse']):[];const ch=[...(req.slots||[]),...sp];if(req.optional&&(R(4)===0||!ch.length))return -1;if(!ch.length){note('nochoice',`gain w/o choices: ${req.q}`);return -1;}return ch[R(ch.length)];}
  case 'yn':return R(2)===0;
  case 'pick':{const it=req.items||[];const mn=req.min??1,mx=Math.min(req.max??it.length,it.length);if(mn>it.length)note('pickmin',`${req.q}: min ${mn} > items ${it.length}`);const n=mn+R(Math.max(0,mx-mn)+1);const a=it.slice();for(let i=a.length-1;i>0;i--){const j=R(i+1);[a[i],a[j]]=[a[j],a[i]];}return a.slice(0,Math.min(n,a.length));}
  case 'opt':{const ok=req.opts.map((_,i)=>i).filter(i=>!(req.dis&&req.dis[i]));if(!ok.length){note('optall',`all options disabled: ${req.q}`);return 0;}return ok[R(ok.length)];}
  case 'player':{const o=req.opps||S.pl.map((_,i)=>i).filter(i=>i!==p&&!S.pl[i].out);return o[R(o.length)];}
  default:note('kind','unknown req '+req.k);return null;}}
(async()=>{let n=0,err=0,hang=0;const t0=Date.now();
 for(let i=0;i<NG;i++){const ws=[];const pool=W.slice();for(let k=0;k<NP;k++)ws.push(pool.splice(R(pool.length),1)[0]);
  E.seedRandom(9001+i);const S=NP===2?E.newState(ws[0],ws[1]):E.newStateN(ws);E.applyEdition(S,ED);S.aiDiff={};for(let k=0;k<NP;k++)S.aiDiff[k]=['easy','normal','hard'][(i+k)%3];
  const rseat=new Set(i%3===0?[...Array(NP).keys()]:[0]);let steps=0,last='';
  const io={sim:false,log(m){last=m;},render(){},pause(){return Promise.resolve()},fx(){},ev(){},
   decide:async(g,p,req)=>{if(++steps>4000)throw new Error('HANG');check(g.S,`before ${req.k} '${(req.q||'').slice(0,50)}'`);
     if(rseat.has(p))return rnd(g,p,req);
     return req.k==='play'?E.aiChoosePlay(g.S,p):(req.k==='yn'&&req.ult?E.ultDecide(g.S,p,req.free):E.cpuDecideX(g,p,req));}};
  try{await new E.Game(S,io).run();check(S,'end');}catch(e){if(e.message==='HANG')hang++;else{err++;note('error',`${ws} ed${ED}: ${e.message} | ${(e.stack||'').split('\n')[1]} | last log: ${last}`);}}
  E.unseedRandom();n++;}
 console.log(`games ${n} players ${NP} ed ${ED} errors ${err} hangs ${hang} ${((Date.now()-t0)/1000)|0}s`);
 for(const [k,v] of Object.entries(issues)){const u=[...new Set(v)];console.log(`-- ${k}: ${v.length} (${u.length} distinct)`);u.slice(0,8).forEach(x=>console.log('   ',x));}})();
