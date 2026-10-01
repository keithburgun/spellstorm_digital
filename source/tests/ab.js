// A/B: new chooser vs the old one, same difficulty, seats alternating
const E=require('./eng_all.js');const W=['derby','eve','abragail','may','omar','bunny','oren','croh'];
const io={sim:false,log(){},render(){},pause(){return Promise.resolve()},fx(){},ev(){},decide:(g,p,req)=>req.k==='play'?E.aiChoosePlay(g.S,p):(req.k==='yn'&&req.ult?E.ultDecide(g.S,p,req.free):Promise.resolve(E.cpuDecideX(g,p,req)))};
(async()=>{if(process.env.MX)E.MXMODE.v=process.env.MX;const d=process.argv[2],N=+process.argv[3]||20;let nw=0,t0=Date.now();
 for(let i=0;i<N;i++){const S=E.newState(W[i%8],W[(i*3+1)%8===i%8?(i+2)%8:(i*3+1)%8]);const np=i%2;S.aiDiff={0:d,1:d};S.aiOld={[1-np]:true};const r=await new E.Game(S,io).run();if(r.winner===np)nw++;}
 console.log(`[${E.MXMODE.v}] ${d}: NEW beat OLD in ${nw}/${N} games (${Math.round(100*nw/N)}%) — ${((Date.now()-t0)/1000).toFixed(0)}s`);})();
