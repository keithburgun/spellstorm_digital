// Situation test suite: positions with a clearly better play. Scores each bot (pass rate over seeds).
//   node situations.js [N]        (run build.py first)
const E=require('./eng_all.js');const N=+process.argv[2]||12;
const fire=n=>Array.from({length:n},()=>'fb');
const CASES=[
 {t:'At 3 health vs Eve: heal (Moonstone) rather than attack',me:'derby',opp:'eve',set:S=>{S.pl[1].hp=3;},hand:['moon','fb'],want:'moon'},
 {t:'Bunny at 2 health: take the lethal Fireball',me:'derby',opp:'bunny',set:S=>{S.pl[0].hp=2;},hand:['fb','pgem'],want:'fb'},
 {t:'Croh at 18/20: build Power, don’t chip',me:'derby',opp:'croh',set:S=>{S.pl[0].hp=18;},hand:['fb','pgem'],want:'pgem'},
 {t:'Bunny at 5/8, early: race him with Fireball',me:'derby',opp:'bunny',set:S=>{S.pl[0].hp=5;},hand:['fb','pgem'],want:'fb'},
 {t:'6 health vs a Fire-heavy Derby: heal',me:'abragail',opp:'derby',set:S=>{S.pl[1].hp=6;S.pl[0].deck.push(...fire(6).map((id,i)=>({u:800+i,id})));S.pl[0].hand=fire(3).map((id,i)=>({u:820+i,id}));},hand:['heart','pgem'],want:'heart'},
 {t:'Full health: don’t waste a heal (Heart Gem vs Power Gem)',me:'derby',opp:'abragail',set:S=>{},hand:['heart','pgem'],want:'pgem'},
 {t:'6 health vs Fire-heavy Derby: Heart Gem over Fireball',me:'abragail',opp:'derby',set:S=>{S.pl[1].hp=6;S.pl[0].deck.push(...fire(6).map((id,i)=>({u:800+i,id})));},hand:['heart','fb'],want:'heart'},
 {t:'6 health vs Abragail (little damage): build, don’t heal',me:'derby',opp:'abragail',set:S=>{S.pl[1].hp=6;},hand:['heart','pgem'],want:'pgem'},
 {t:'Croh at 4/20 (can’t heal): press with Fireball',me:'derby',opp:'croh',set:S=>{S.pl[0].hp=4;},hand:['fb','pgem'],want:'fb'},
 {t:'Opponent at 1 health: any damage wins (Magic Dart vs Power Gem, with Power)',me:'derby',opp:'croh',set:S=>{S.pl[0].hp=1;S.pl[1].power=2;},hand:['dart','pgem'],want:'dart'},
];
async function run(ver){let pass=0,tot=0;const rows=[];
 for(const C of CASES){let ok=0;
  for(let k=0;k<N;k++){E.seedRandom(5000+k);const S=E.newState(C.opp,C.me);E.applyEdition(S,2);S.battle=2;S.round=2;S.wcur='breeze';S.aiDiff={0:'normal',1:'expert'};S.aiVer={1:ver};
   C.set(S);S.pl[1].hand=C.hand.map((id,i)=>({u:900+i,id}));const c=await E.aiChoosePlay(S,1);if(c&&c.id===C.want)ok++;E.unseedRandom();}
  rows.push(`${String(Math.round(100*ok/N)).padStart(4)}%  ${C.t}`);pass+=ok;tot+=N;}
 return {score:Math.round(100*pass/tot),rows};}
(async()=>{for(const [lab,ver] of [['Expert (current)','b'],['Expert + threat model','c']]){const r=await run(ver);console.log(`${lab}: ${r.score}%`);for(const x of r.rows)console.log('   '+x);}})();
