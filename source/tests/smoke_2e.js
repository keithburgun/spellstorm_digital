const E=require('./eng_all.js');const W=['derby','eve','abragail','may','omar','bunny','oren','croh'];
(async()=>{let n=0,err=0,ends={};for(let k=0;k<3;k++)for(const a of W)for(const b of W){if(a===b)continue;E.seedRandom(31*n+k);const S=E.newState(a,b);E.applyEdition(S,2);S.aiDiff={0:'normal',1:'normal'};
  const io={sim:false,log(){},render(){},pause(){return Promise.resolve()},fx(){},ev(){},decide:(g,p,req)=>req.k==='play'?E.aiChoosePlay(g.S,p):(req.k==='yn'&&req.ult?E.ultDecide(g.S,p,req.free):Promise.resolve(E.cpuDecideX(g,p,req)))};
  try{const r=await new E.Game(S,io).run();ends[r.why]=(ends[r.why]||0)+1;}catch(e){err++;if(err<3)console.log('ERROR',a,b,e.message);}E.unseedRandom();n++;}
 console.log(`2nd Edition: ${n} games, errors ${err}, endings ${JSON.stringify(ends)}`);})();
