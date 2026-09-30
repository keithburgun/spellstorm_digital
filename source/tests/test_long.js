const E=require('./eng_all.js');const W=Object.keys(E.WIZ).filter(w=>w!=='robot');
(async()=>{let n=0,bad=0,shardWins=0,hp=[];for(let i=0;i<12;i++){const S=E.newState(W[i%8],W[(i+3)%8]);S.win=12;for(const P of S.pl){P.max=Math.round(P.max*1.5);P.hp=P.max;}hp.push(S.pl[0].wiz+' '+S.pl[0].hp);S.aiDiff={0:'normal',1:'hard'};
  let earlyAt8=false;const io={sim:false,log(){},render(){},pause(){return Promise.resolve()},fx(){},ev(){},decide:(g,p,req)=>req.k==='play'?E.aiChoosePlay(g.S,p):(req.k==='yn'&&req.ult?E.ultDecide(g.S,p,req.free):Promise.resolve(E.cpuDecideX(g,p,req)))};
  const r=await new E.Game(S,io).run();n++;if(r.why==='shards'){shardWins++;if(S.pl[r.winner].shards<12)bad++;}}
 console.log(`Long Match: ${n} games | shard wins ${shardWins}, any won with fewer than 12 shards: ${bad} | starting health e.g. ${hp.slice(0,4).join(', ')}`);})();
