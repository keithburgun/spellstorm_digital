// match two AI difficulties against each other; both players are AI
const E=require('./eng_all.js');const W=Object.keys(E.WIZ);const [A,B,N]=[process.argv[2],process.argv[3],+process.argv[4]||20];
(async()=>{let wB=0,n=0,errs=0,plans=0;const t0=Date.now();
 for(let i=0;i<N;i++){const a=W[i%8],b=W[(i*3+1)%8]===a?W[(i+1)%8]:W[(i*3+1)%8];const S=E.newState(a,b);const flip=i%2;S.aiDiff=flip?{0:B,1:A}:{0:A,1:B};
  const io={sim:false,log(m){if(/now aims/.test(m))plans++},render(){},pause(){return Promise.resolve()},fx(){},ev(){},
   decide:(g,p,req)=>req.k==='play'?E.aiChoosePlay(g.S,p):(req.k==='yn'&&req.ult?E.ultDecide(g.S,p,req.free):Promise.resolve(E.cpuDecideX(g,p,req)))};
  try{const r=await new E.Game(S,io).run();n++;if(S.aiDiff[r.winner]===B)wB++;}catch(e){errs++;if(errs<3)console.log(e.stack.split('\n').slice(0,4).join(' | '));}}
 console.log(`${B} vs ${A}: ${B} won ${wB}/${n} (${Math.round(100*wB/n)}%) | errors ${errs} | plan changes ${plans} | ${((Date.now()-t0)/1000).toFixed(0)}s`);})();
