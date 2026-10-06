const E=require('./eng_all.js');const W=['derby','eve','abragail','may','omar','bunny','oren'];
(async()=>{const maxes=[];let ultDraws=0,ultDrawCards=[],big=0;
 for(let k=0;k<70;k++){const opp=W[k%W.length],side=k%2;E.seedRandom(900+k);const S=E.newState(side?opp:'croh',side?'croh':opp);E.applyEdition(S,2);const c=side?1:0;S.aiDiff={0:'expert',1:'expert'};let mx=0;
  const io={sim:false,log(m){if(/entire discard \((\d+)/.test(m)){ultDraws++;ultDrawCards.push(+m.match(/entire discard \((\d+)/)[1]);}},render(){},pause(){return Promise.resolve()},fx(){},ev(){},
   decide:(g,p,req)=>{mx=Math.max(mx,g.S.pl[c].hand.length);return req.k==='play'?E.aiChoosePlay(g.S,p):(req.k==='yn'&&req.ult?E.ultDecide(g.S,p,req.free):Promise.resolve(E.cpuDecideX(g,p,req)));}};
  try{await new E.Game(S,io).run();}catch(e){}E.unseedRandom();maxes.push(mx);if(mx>=20)big++;}
 maxes.sort((a,b)=>a-b);console.log(`70 Expert games as 2E Croh: largest hand per game — median ${maxes[35]}, 90th percentile ${maxes[63]}, max ${maxes[69]} | games reaching 20+ cards: ${big}`);
 console.log(`DOOOOOOOM! drew the whole discard ${ultDraws} times; cards drawn each time: ${ultDrawCards.sort((a,b)=>a-b).join(',')}`);})();
