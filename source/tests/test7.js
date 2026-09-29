// 1) normal games still run; 2) save at a checkpoint, JSON round-trip, resume from it and finish
const E=require('./eng_all.js');const W=Object.keys(E.WIZ);
const mkio=(extra={})=>Object.assign({sim:false,log(){},render(){},pause(){return Promise.resolve()},fx(){},ev(){},decide:(g,p,req)=>req.k==='play'?E.aiChoosePlay(g.S,p):Promise.resolve(E.cpuDecideX(g,p,req))},extra);
(async()=>{let ok=0,res=0,errs=0;
 for(let i=0;i<16;i++){const S=E.newState(W[i%8],W[(i+2)%8]);S.aiDiff={0:'normal',1:'normal'};let saved=null,cps=0;
  const io=mkio({checkpoint(){cps++;if(cps===7)saved=JSON.stringify(S);}});
  try{await new E.Game(S,io).run();ok++;}catch(e){errs++;console.log(e.stack.split('\n').slice(0,3).join(' | '));}
  if(saved){const S2=JSON.parse(saved);try{const r=await new E.Game(S2,mkio()).resumeRun();if(r&&S2.over)res++;}catch(e){errs++;console.log('resume',e.stack.split('\n').slice(0,3).join(' | '));}}}
 console.log('full games',ok,'| resumed-from-save games finished',res,'| errors',errs);})();
