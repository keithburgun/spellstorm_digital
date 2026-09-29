const E=require('./eng_all.js');const W=Object.keys(E.WIZ).filter(w=>w!=='robot');
const io=()=>({sim:false,L:[],log(m){this.L.push(m)},render(){},pause(){return Promise.resolve()},fx(){},ev(){},
 decide:(g,p,req)=>req.k==='play'?E.aiChoosePlay(g.S,p):(req.k==='yn'&&req.ult?E.ultDecide(g.S,p,req.free):Promise.resolve(E.cpuDecideX(g,p,req)))});
(async()=>{let r={coop:{w:0,n:0,e:0},tvt:{w:0,n:0,e:0}},allyHeals=0,rbHit=0,friendly=0;
 for(let i=0;i<18;i++){const lvl=['easy','medium','hard'][i%3],np=2+(i%3);const allies=[];for(let k=0;k<np-1;k++)allies.push(W[(i+3*k+1)%8]);
  const S=E.newStateCoop(W[i%8],allies,lvl,'normal');S.aiDiff[0]='normal';const I=io();
  try{const res=await new E.Game(S,I).run();r.coop.n++;if(S.team[res.winner]===0)r.coop.w++;allyHeals+=I.L.filter(m=>/an ally instead/.test(m)).length;
   // damage must never land on an ally from an ally's "deal damage"
   }catch(e){r.coop.e++;console.log('COOP ERR',e.stack.split('\n').slice(0,3).join(' | '));}}
 for(let i=0;i<16;i++){const S=E.newState2v2(W[i%8],W[(i+2)%8],W[(i+4)%8],W[(i+6)%8],'normal');S.aiDiff={0:'normal',1:'normal',2:'normal',3:'normal'};const I=io();
  try{const res=await new E.Game(S,I).run();r.tvt.n++;if(S.team[res.winner]===0)r.tvt.w++;allyHeals+=I.L.filter(m=>/an ally instead/.test(m)).length;}
  catch(e){r.tvt.e++;console.log('2V2 ERR',e.stack.split('\n').slice(0,3).join(' | '));}}
 console.log(`Co-op vs Robot Boy: finished ${r.coop.n}/18, team won ${r.coop.w}, errors ${r.coop.e}`);
 console.log(`Two-on-Two: finished ${r.tvt.n}/16, team A won ${r.tvt.w}, errors ${r.tvt.e} | heals redirected to allies: ${allyHeals}`);
 // targeting sanity: in a 2v2 state, opponents of each seat must be the other team, and next opponent must be the next enemy clockwise
 const S=E.newState2v2('derby','eve','may','omar');console.log('2v2 opponents of each seat:',[0,1,2,3].map(p=>[p,JSON.stringify((function(){const g=new E.Game(S,io());return [g.opps(p),g.nextOpp(p)]})())].join(':')).join('  '));
 const C=E.newStateCoop('derby',['eve','may'],'medium');const g=new E.Game(C,io());console.log('co-op seats:',C.pl.map(P=>P.wiz).join(','),'| opponents of you:',g.opps(0),'| Robot Boy counters seat',g.nextOpp(3),'| init:',C.init);})();
