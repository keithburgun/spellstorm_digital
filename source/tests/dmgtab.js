// Measure per-card average damage dealt (to opponents) and self-heal when a card is played and resolved,
// and per-wizard Ultimate damage/heal per use + uses per round. Usage: node dmgtab.js <edition> <games>
const E=require('./eng_all.js');const W=['derby','eve','abragail','may','omar','bunny','oren','croh'];
const ed=+process.argv[2]||2,G=+process.argv[3]||300;
const card={},ult={},rounds={};
(async()=>{let n=0;
 for(let k=0;n<G;k++)for(const a of W)for(const b of W){if(a===b||n>=G)continue;E.seedRandom(7919*n+ed);const S=E.newState(a,b);E.applyEdition(S,ed);S.aiDiff={0:'normal',1:'normal'};
  const io={sim:false,log(){},render(){},pause(){return Promise.resolve()},fx(){},ev(){},decide:(g,p,req)=>req.k==='play'?E.aiChoosePlay(g.S,p):(req.k==='yn'&&req.ult?E.ultDecide(g.S,p,req.free):Promise.resolve(E.cpuDecideX(g,p,req)))};
  const g=new E.Game(S,io);const hp=()=>g.S.pl.map(P=>P.hp);const st=[];
  const oR=g.resolve.bind(g),oU=g.offerUlt.bind(g),oRound=g.round.bind(g);
  g.round=async r=>{for(const P of g.S.pl){rounds[P.wiz]=(rounds[P.wiz]||0)+1;}return oRound(r);};
  g.resolve=async(p,c,how)=>{const f={h0:hp(),ud:0,uh:0};st.push(f);const x=await oR(p,c,how);st.pop();
    if(how==='play'){const h1=hp();let d=0;for(let q=0;q<h1.length;q++)if(q!==p)d+=Math.max(0,f.h0[q]-h1[q]);const hl=Math.max(0,h1[p]-f.h0[p]);
      const k=c.id,o=card[k]=card[k]||{n:0,d:0,h:0};o.n++;o.d+=d-f.ud;o.h+=hl-f.uh;}
    return x;};
  g.offerUlt=async(p,free)=>{const h0=hp(),m0=g.S.pl[p].mana;await oU(p,free);const h1=hp();if(g.S.pl[p].mana!==m0||free){let d=0;for(let q=0;q<h1.length;q++)if(q!==p)d+=Math.max(0,h0[q]-h1[q]);const hl=Math.max(0,h1[p]-h0[p]);
      const w=g.S.pl[p].wiz,o=ult[w]=ult[w]||{n:0,d:0,h:0};o.n++;o.d+=d;o.h+=hl;for(const f of st){f.ud+=d;f.uh+=hl;}}};
  try{await g.run();}catch(e){}E.unseedRandom();n++;}
 const r2=x=>Math.round(x*100)/100;
 const C={};for(const [k,o] of Object.entries(card))if(o.n>=8)C[k]=[r2(o.d/o.n),r2(o.h/o.n)];
 const U={};for(const [w,o] of Object.entries(ult))U[w]=[r2(o.d/o.n),r2(o.h/o.n),r2(o.n/rounds[w])];
 console.log(JSON.stringify({ed,games:n,card:C,ult:U}));
})();
