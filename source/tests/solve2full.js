// For each puzzle: which first moves can win, and how many of all lines win
const E=require('./eng_all.js');const PZ=require('../puzzles.json');
class Branch{constructor(o){this.o=o}};class Done{constructor(r){this.r=r}};
function options(S,req){const P=S.pl[0];switch(req.k){
  case 'play':{const seen={},o=[];for(const c of P.hand)if(!E.CARDS[c.id].junk&&!seen[c.id]){seen[c.id]=1;o.push(c.id);}return o.length?o:[null];}
  case 'gain':return [...req.slots.map(i=>'s'+i),...(req.special?(req.specials||[]):[]),...(req.optional?[-1]:[])];
  case 'yn':return [true,false];case 'opt':return req.opts.map((_,i)=>i).filter(i=>!(req.dis&&req.dis[i]));case 'player':return (req.opps||[0,1]).slice();
  case 'pick':{const it=req.items,mn=req.min||0,mx=Math.min(req.max??it.length,it.length),out=[];const rec=(st,acc)=>{if(acc.length>=mn&&acc.length<=mx)out.push(acc.slice());if(acc.length===mx)return;for(let i=st;i<it.length;i++){acc.push(i);rec(i+1,acc);acc.pop();}};rec(0,[]);return out.slice(0,40);}
  default:return [0];}}
function apply(S,req,o){switch(req.k){case 'play':return o?S.pl[0].hand.find(c=>c.id===o):null;case 'gain':return typeof o==='string'&&o[0]==='s'?+o.slice(1):o;case 'pick':return o.map(i=>req.items[i]);default:return o;}}
function label(S,req,o){if(req.k==='play')return o;if(req.k==='pick')return 'discard['+o.map(i=>req.items[i].id).join('+')+']';if(req.k==='yn')return o?'yes':'no';return req.k+':'+o;}
async function run(D,script){globalThis.RAW=[];E.seedRandom(1000+D.id);const S=E.puzzleState(D);let k=0;const tr=[];
  const judge=(ev,x)=>{const r=E.puzzleJudge(S,ev,x);if(r)throw new Done(r);};
  const io={sim:false,log(){},render(){},pause(){return Promise.resolve()},fx(){},checkpoint(){},roundDone(){judge('round');},ev(t,p,x){if(t==='blast')judge('blast',x);},
    decide:(g,p,req)=>{if(p!==0)return req.k==='play'?E.aiChoosePlay(g.S,p):(req.k==='yn'&&req.ult?Promise.resolve(true):Promise.resolve(E.cpuDecideX(g,p,req)));
      if(k<script.length){const o=script[k++];tr.push(label(g.S,req,o));(globalThis.RAW=globalThis.RAW||[]).push({k:req.k,o});return Promise.resolve(apply(g.S,req,o));}throw new Branch(options(g.S,req));}};
  try{await new E.Game(S,io).resumeRun();return {r:judge('over')||'fail',tr};}
  catch(e){if(e instanceof Done)return {r:e.r,tr,raw:globalThis.RAW.slice()};if(e instanceof Branch)return {branch:e.o};if(e&&e.constructor&&e.constructor.name==='GameOver'){try{judge('over');}catch(d){if(d instanceof Done)return {r:d.r,tr};}return {r:'fail',tr};}throw e;}
  finally{E.unseedRandom();}}
const LINES={};(async()=>{const only=process.argv[2]?+process.argv[2]:null;for(const D of PZ){if(only&&D.id!==only)continue;const first={},wins=[];let leaves=0;const stack=[[]];
  while(stack.length){const s=stack.pop();const res=await run(D,s);if(res.branch){for(const o of res.branch)stack.push([...s,o]);continue;}leaves++;
    const f=res.tr[0];first[f]=first[f]||[0,0];first[f][1]++;if(res.r==='win'){first[f][0]++;wins.push(res.tr.join(' → '));if(!LINES[D.id])LINES[D.id]=res.raw;}}
  const uniq=[...new Set(wins)];
  console.log(`#${D.id} ${D.title.padEnd(18)} ${uniq.length===1?'✓ exactly 1':'✗ '+uniq.length} winning sequence${uniq.length===1?'':'s'}: ${uniq.join('  |  ')||'none'}   (${leaves} lines tried)`);if(false)console.log(`#${D.id} ${D.title}: ${wins.length}/${leaves} lines win | by first play: ${Object.entries(first).map(([k,[w,n]])=>`${k} ${w}/${n}`).join(', ')}`);
}require('fs').writeFileSync('pz_lines.json',JSON.stringify(LINES));})();
