// Deterministic 2-player regression: seeded RNG, record every log line + final state for N games.
const fs=require('fs');const mode=process.argv[2]||'check';const N=+process.argv[3]||40;
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}
const E=require('./eng_all.js');const W=Object.keys(E.WIZ);
(async()=>{const out=[];
 for(let i=0;i<N;i++){Math.random=mulberry32(1000+i);
  const a=W[i%8],b=W[(i*3+1)%8]===a?W[(i+1)%8]:W[(i*3+1)%8];const S=E.newState(a,b);S.aiDiff={0:['easy','normal','hard'][i%3],1:['normal','hard','easy'][i%3]};
  const L=[];const io={sim:false,log(m,c){if(c!=='nofx')L.push(m)},render(){},pause(){return Promise.resolve()},fx(){},ev(){},
   decide:(g,p,req)=>req.k==='play'?E.aiChoosePlay(g.S,p):(req.k==='yn'&&req.ult?E.ultDecide(g.S,p,req.free):Promise.resolve(E.cpuDecideX(g,p,req)))};
  let r;try{r=await new E.Game(S,io).run();}catch(e){L.push('ERROR '+e.message);}
  out.push({i,a,b,winner:r&&r.winner,why:r&&r.why,battles:S.battle,hp:S.pl.map(p=>p.hp),sh:S.pl.map(p=>p.shards),log:L});}
 if(mode==='record'){fs.writeFileSync('baseline.json',JSON.stringify(out));console.log('recorded',out.length,'games,',out.reduce((s,g)=>s+g.log.length,0),'log lines');return;}
 const base=JSON.parse(fs.readFileSync('baseline.json'));let same=0,diff=[];
 for(let k=0;k<out.length;k++){const x=JSON.stringify(out[k]),y=JSON.stringify(base[k]);if(x===y)same++;else{const la=out[k].log,lb=base[k].log;let j=0;while(j<la.length&&la[j]===lb[j])j++;diff.push(`game ${k} (${out[k].a} v ${out[k].b}) diverges at log line ${j}: now "${la[j]}" / was "${lb[j]}"`);}}
 console.log(`identical: ${same}/${out.length}`);diff.slice(0,5).forEach(d=>console.log('  ',d));})();
