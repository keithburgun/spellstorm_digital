// SPRT: Expert with tuned weights (averaged SPSA iterations) vs Expert with default weights. Mirrored pairs.
const fs=require('fs');const E=require('./eng_all.js');const W=['derby','eve','abragail','may','omar','bunny','oren','croh'];
const st=JSON.parse(fs.readFileSync('spsa_state.json')),H=st.hist.filter(h=>h.k>=+(process.env.FROM||200)),KEYS=Object.keys(E.EVW0);
const TUNED=process.env.WFILE?JSON.parse(fs.readFileSync(process.env.WFILE)):Object.fromEntries(KEYS.map(k=>[k,H.reduce((a,h)=>a+h.theta[k],0)/H.length]));if(!process.env.WFILE)fs.writeFileSync('evw_tuned.json',JSON.stringify(TUNED));
const out=process.argv[2],MAX=+process.argv[3]||400,done=new Set();if(fs.existsSync(out))for(const l of fs.readFileSync(out,'utf8').split('\n').filter(Boolean)){const r=JSON.parse(l);done.add(r.i+'|'+r.side);}
const P=[];for(const a of W)for(const b of W)if(a!==b)P.push([a,b]);
(async()=>{for(let i=0;i<MAX;i++){const [a,b]=P[i%P.length];for(const side of [0,1]){if(done.has(i+'|'+side))continue;E.seedRandom((+process.env.SEEDBASE||31337)*i+5);const S=E.newState(a,b);E.applyEdition(S,2);S.aiDiff={0:'expert',1:'expert'};S.evw={[side]:TUNED};
  const io={sim:false,log(){},render(){},pause(){return Promise.resolve()},fx(){},ev(){},decide:(g,p,req)=>req.k==='play'?E.aiChoosePlay(g.S,p):(req.k==='yn'&&req.ult?E.ultDecide(g.S,p,req.free):Promise.resolve(E.cpuDecideX(g,p,req)))};
  const t0=Date.now();let r=null,err=null;try{r=await new E.Game(S,io).run();}catch(e){err=e.message;}E.unseedRandom();fs.appendFileSync(out,JSON.stringify({i,side,cw:r?(r.winner===side?1:0):null,ms:Date.now()-t0,err})+'\n');}}console.log('done');})();
