// SPSA tuning of Expert's evaluation weights by self-play (theta+ vs theta-, mirrored pairs). State persists in spsa_state.json.
const fs=require('fs');const E=require('./eng_all.js');const W=['derby','eve','abragail','may','omar','bunny','oren','croh'];
const F='spsa_state.json',KEYS=Object.keys(E.EVW0),ETA=0.15,CREL=0.15,LIMIT=+(process.argv[2]||270)*1000,t0=Date.now();
let st=fs.existsSync(F)?JSON.parse(fs.readFileSync(F)):{k:0,theta:{...E.EVW0},hist:[],w:0,l:0,d:0};
const AD=k=>1/Math.pow(1+k/400,0.602), CD=k=>1/Math.pow(1+k/800,0.101);   // standard SPSA gain decay: steps shrink as evidence accumulates
const P=[];for(const a of W)for(const b of W)if(a!==b)P.push([a,b]);
async function game(seed,a,b,w0,w1){E.seedRandom(seed);const S=E.newState(a,b);E.applyEdition(S,2);S.aiDiff={0:'expert',1:'expert'};S.evw={0:w0,1:w1};
  const io={sim:false,log(){},render(){},pause(){return Promise.resolve()},fx(){},ev(){},decide:(g,p,req)=>req.k==='play'?E.aiChoosePlay(g.S,p):(req.k==='yn'&&req.ult?E.ultDecide(g.S,p,req.free):Promise.resolve(E.cpuDecideX(g,p,req)))};
  let r=null;try{r=await new E.Game(S,io).run();}catch(e){}E.unseedRandom();return r?r.winner:-1;}
(async()=>{while(Date.now()-t0<LIMIT){const k=st.k,[a,b]=P[k%P.length],seed=7777+k*131;
  const D={},plus={},minus={};for(const key of KEYS){const th=st.theta[key],c=Math.max(.05,Math.abs(th)*CREL*CD(st.k));D[key]=Math.random()<.5?-1:1;plus[key]=Math.max(0,th+c*D[key]);minus[key]=Math.max(0,th-c*D[key]);}
  const g1=await game(seed,a,b,plus,minus),g2=await game(seed,a,b,minus,plus);   // mirrored: same deal, sides swapped
  const pw=(g1===0)+(g2===1),mw=(g1===1)+(g2===0),r=(pw-mw)/2;st.w+=pw;st.l+=mw;
  if(r)for(const key of KEYS){const th=st.theta[key],c=Math.max(.05,Math.abs(th)*CREL*CD(st.k));st.theta[key]=Math.max(0,th+ETA*AD(st.k)*r*c*D[key]);}
  st.k++;if(st.k%20===0)st.hist.push({k:st.k,theta:{...st.theta}});fs.writeFileSync(F,JSON.stringify(st));}
 const d=Object.fromEntries(KEYS.map(k=>[k,+((st.theta[k]/E.EVW0[k]-1)*100).toFixed(0)]));console.log(`iterations ${st.k} | % change from defaults:`,JSON.stringify(d));})();
