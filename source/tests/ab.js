// A/B match, Fishtest-style: candidate ('c') vs baseline ('b'), mirrored pairs (same deal, sides swapped). Usage: node ab.js <out> [maxPairs]
const fs=require('fs');const E=require('./eng_all.js');const W=['derby','eve','abragail','may','omar','bunny','oren','croh'];
const out=process.argv[2],MAX=+process.argv[3]||400;const done=new Set();
if(fs.existsSync(out))for(const l of fs.readFileSync(out,'utf8').split('\n').filter(Boolean)){const r=JSON.parse(l);done.add(r.i+'|'+r.side);}
const P=[];for(const a of W)for(const b of W)if(a!==b)P.push([a,b]);
(async()=>{for(let i=0;i<MAX;i++){const [a,b]=P[i%P.length];
  for(const side of [0,1]){if(done.has(i+'|'+side))continue;E.seedRandom(104729*i+17);const S=E.newState(a,b);E.applyEdition(S,2);S.aiDiff={0:'expert',1:'expert'};S.aiVer={[side]:'c',[1-side]:'b'};
    const io={sim:false,log(){},render(){},pause(){return Promise.resolve()},fx(){},ev(){},decide:(g,p,req)=>req.k==='play'?E.aiChoosePlay(g.S,p):(req.k==='yn'&&req.ult?E.ultDecide(g.S,p,req.free):Promise.resolve(E.cpuDecideX(g,p,req)))};
    const t0=Date.now();let r=null,err=null;try{r=await new E.Game(S,io).run();}catch(e){err=e.message;}E.unseedRandom();
    fs.appendFileSync(out,JSON.stringify({i,side,a,b,cw:r?(r.winner===side?1:0):null,ms:Date.now()-t0,err})+'\n');}}
 console.log('done');})();
