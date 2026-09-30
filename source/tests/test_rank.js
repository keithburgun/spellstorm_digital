// Ranked AI: every personality at several ranks plays cleanly; and a rank ladder check (higher rank should win more)
const E=require('./eng_all.js');const W=Object.keys(E.WIZ).filter(w=>w!=='robot');
const io={sim:false,log(){},render(){},pause(){return Promise.resolve()},fx(){},ev(){},decide:(g,p,req)=>req.k==='play'?E.aiChoosePlay(g.S,p):(req.k==='yn'&&req.ult?E.ultDecide(g.S,p,req.free):Promise.resolve(E.cpuDecideX(g,p,req)))};
(async()=>{let errs=0,n=0;const t0=Date.now();
 for(const pers of 'ABCDEFGHIJ')for(const rank of [1,5,8]){const S=E.newState(W[n%8],W[(n+3)%8]);S.aiProf={0:{rank:4,pers:'I'},1:{rank,pers}};n++;
   try{await new E.Game(S,io).run();}catch(e){errs++;console.log('ERR',pers,rank,e.stack.split('\n').slice(0,3).join(' | '));}}
 console.log(`all 10 personalities x ranks 1/5/8: ${n} games, errors ${errs}, ${((Date.now()-t0)/1000).toFixed(0)}s`);
 for(const [lo,hi,G] of [[2,6,16],[4,8,14]]){let hw=0;for(let i=0;i<G;i++){const S=E.newState(W[i%8],W[(i+3)%8]);const hs=i%2;S.aiProf={[hs]:{rank:hi,pers:'ABCDEFGHJ'[i%9]},[1-hs]:{rank:lo,pers:'ABCDEFGHJ'[(i+4)%9]}};
   const r=await new E.Game(S,io).run();if(r.winner===hs)hw++;}console.log(`rank ${hi} vs rank ${lo}: rank ${hi} won ${hw}/${G}`);}
 console.log('sample usernames:',Array.from({length:10},E.genUsername).join('  '));
 console.log('Elo: start 850 beating a rank-5 (1000) opponent:',E.eloDelta(850,1000,1,0),'| losing to a rank-1 (700):',E.eloDelta(850,700,0,0),'| matched ranks at 850:',Array.from({length:12},()=>E.matchRank(850)).join(','));})();
