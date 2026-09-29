const E=require('./eng_all.js');const W=Object.keys(E.WIZ);const N=+process.argv[2]||3,G=+process.argv[3]||20;
(async()=>{let fin=0,errs=0,elims=0,why={},bat=[],wins={},samples=[],t0=Date.now();
 for(let i=0;i<G;i++){const ws=[];for(let k=0;k<N;k++)ws.push(W[(i*3+k*5)%8]);if(new Set(ws).size<N)for(let k=0;k<N;k++)ws[k]=W[(i+k)%8];
  const S=E.newStateN(ws);S.aiDiff={};for(let k=0;k<N;k++)S.aiDiff[k]=['easy','normal','hard'][(i+k)%3];
  const L=[];const io={sim:false,log(m){L.push(m);if(/eliminated/.test(m))elims++;},render(){},pause(){return Promise.resolve()},fx(){},ev(){},
   decide:(g,p,req)=>req.k==='play'?E.aiChoosePlay(g.S,p):(req.k==='yn'&&req.ult?E.ultDecide(g.S,p,req.free):Promise.resolve(E.cpuDecideX(g,p,req)))};
  try{const r=await new E.Game(S,io).run();fin++;why[r.why]=(why[r.why]||0)+1;bat.push(S.battle);const w=S.pl[r.winner].wiz;wins[w]=(wins[w]||0)+1;
   if(samples.length<4)samples.push(L.filter(m=>/Blast Scores|eliminated|Tied Blast|wins the Blast|COUNTERED/.test(m)).slice(0,3).join(' || '));}
  catch(e){errs++;if(errs<4)console.log('ERR',ws.join(','),e.stack.split('\n').slice(0,4).join(' | '));}}
 console.log(`${N}-player: finished ${fin}/${G} | errors ${errs} | eliminations ${elims} | endings ${JSON.stringify(why)} | avg battles ${(bat.reduce((a,b)=>a+b,0)/Math.max(1,bat.length)).toFixed(1)} | ${((Date.now()-t0)/1000).toFixed(0)}s`);
 samples.forEach(s=>console.log('   ',s.slice(0,230)));})();
