// Robot Boy vs every wizard (played by the Hard AI), all three Robot Boy levels
const E=require('./eng_all.js');const W=Object.keys(E.WIZ).filter(w=>w!=='robot');
(async()=>{const res={};let errs=0,ults=0,more=0,noTr=0,dragons=0;
 for(const lvl of ['easy','medium','hard']){res[lvl]={rb:0,n:0};
  for(let i=0;i<16;i++){const S=E.newStateRB(W[i%8],lvl);S.aiDiff={0:'hard'};
   const io={sim:false,log(m){if(/unleashes El3m/.test(m))ults++;if(/reveals more/.test(m))more++;if(/No Traction/.test(m))noTr++;if(/Robot Boy resolves .*Dragon/.test(m))dragons++;},render(){},pause(){return Promise.resolve()},fx(){},ev(){},
    decide:(g,p,req)=>req.k==='play'?E.aiChoosePlay(g.S,p):(req.k==='yn'&&req.ult?E.ultDecide(g.S,p,req.free):Promise.resolve(E.cpuDecideX(g,p,req)))};
   try{const r=await new E.Game(S,io).run();res[lvl].n++;if(r.winner===1)res[lvl].rb++;if(S.pl[1].blast>6||S.pl[1].hand.length)throw new Error('token/hand invariant broken');}
   catch(e){errs++;if(errs<4)console.log('ERR',lvl,W[i%8],e.stack.split('\n').slice(0,3).join(' | '));}}}
 for(const l in res)console.log(`Robot Boy ${l.padEnd(6)} beat the Hard AI in ${res[l].rb}/${res[l].n} games`);
 console.log(`errors ${errs} | Robot Boy Ultimates ${ults} | junk reveals (revealed more) ${more} | No Traction triggers ${noTr} | Dragons resolved ${dragons}`);})();
