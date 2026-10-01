// Puzzle solver: tries every sequence of the player's choices (deterministic: seeded randomness, scripted opponent).
const E=require('./eng_all.js');const PZ=require('../puzzles.json');
class Branch{constructor(o){this.o=o}};class Done{constructor(r){this.r=r}};
function options(S,req){const P=S.pl[0];switch(req.k){
  case 'play':{const seen={},o=[];for(const c of P.hand)if(!E.CARDS[c.id].junk&&!seen[c.id]){seen[c.id]=1;o.push(c.id);}return o.length?o:[null];}
  case 'gain':return [...req.slots.map(i=>'s'+i),...(req.special?(req.specials||[]):[]),...(req.optional?[-1]:[])];
  case 'yn':return [true,false];
  case 'opt':return req.opts.map((_,i)=>i).filter(i=>!(req.dis&&req.dis[i]));
  case 'player':return (req.opps||[0,1]).slice();
  case 'pick':{const it=req.items,mn=req.min||0,mx=Math.min(req.max??it.length,it.length),out=[];const rec=(st,acc)=>{if(acc.length>=mn&&acc.length<=mx)out.push(acc.slice());if(acc.length===mx)return;for(let i=st;i<it.length;i++){acc.push(i);rec(i+1,acc);acc.pop();}};rec(0,[]);return out.slice(0,40);}
  default:return [0];}}
function apply(S,req,o){switch(req.k){case 'play':return o?S.pl[0].hand.find(c=>c.id===o):null;case 'gain':return typeof o==='string'&&o[0]==='s'?+o.slice(1):o;case 'pick':return o.map(i=>req.items[i]);default:return o;}}
async function run(D,script){E.seedRandom(1000+D.id);const S=E.puzzleState(D);let k=0;const trace=[];
  const judge=(ev,x)=>{const r=E.puzzleJudge(S,ev,x);if(r)throw new Done(r);};
  const io={sim:false,log(){},render(){},pause(){return Promise.resolve()},fx(){},checkpoint(){},roundDone(){judge('round');},
    ev(t,p,x){if(t==='blast')judge('blast',x);},
    decide:(g,p,req)=>{if(p!==0)return req.k==='play'?E.aiChoosePlay(g.S,p):(req.k==='yn'&&req.ult?Promise.resolve(true):Promise.resolve(E.cpuDecideX(g,p,req)));
      if(k<script.length){const o=script[k++];trace.push(req.k+':'+JSON.stringify(o));return Promise.resolve(apply(g.S,req,o));}throw new Branch(options(g.S,req));}};
  try{const g=new E.Game(S,io);await g.resumeRun();return {r:judge('over')||'fail',trace};}
  catch(e){if(e instanceof Done)return {r:e.r,trace};if(e instanceof Branch)return {branch:e.o};if(e&&e.constructor&&e.constructor.name==='GameOver'){try{judge('over');}catch(d){if(d instanceof Done)return {r:d.r,trace};}return {r:'fail',trace};}throw e;}
  finally{E.unseedRandom();}}
(async()=>{for(const D of PZ){let wins=0,leaves=0,first=null;const stack=[[]];let guard=0;
  while(stack.length&&guard++<4000){const s=stack.pop();const res=await run(D,s);
    if(res.branch){for(const o of res.branch)stack.push([...s,o]);continue;}leaves++;if(res.r==='win'){wins++;if(!first)first=res.trace;}}
  console.log(`#${D.id} ${D.title.padEnd(20)} winning lines ${String(wins).padStart(3)} of ${String(leaves).padStart(3)}${guard>=4000?' (capped)':''} | e.g. ${first?first.join(' → '):'NO SOLUTION'}`);}})();
