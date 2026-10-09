/* ---------- Controller (gamepad) and keyboard navigation ----------
   Works the same in the browser, the Windows/Linux desktop app (Steam Deck) and the Android app.
   A highlight moves between everything you can click; A selects, B goes back, Y looks at a card,
   X asks for an Expert tip, LB/RB switch tabs, the right stick scrolls, Start opens the menu, View/Select opens the log.
   Sources: the browser Gamepad API, or (Android app) native key/stick events forwarded through SSPAD.nat*. */
(()=>{
const q=s=>document.querySelector(s);
const SEL='[data-a],button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])';
const IDX={A:0,B:1,X:2,Y:3,LB:4,RB:5,LT:6,RT:7,SELECT:8,START:9,UP:12,DOWN:13,LEFT:14,RIGHT:15};
const DIRS=new Set(['U','D','L','R']);
let coachSig='',endCache=null,on=false,cur=null,sidPrev='',reqPrev=null,glyph='xbox',glyphFixed=false,lastUp=0,hintSig='';
const mem={},prev={},rep={};
const nat={used:false,kb:[],hb:[],ax:[0,0,0,0]};

const shown=el=>!!el&&getComputedStyle(el).display!=='none';
const ovOn=()=>q('#ov').classList.contains('show');
const pend=()=>{try{return pending;}catch(e){return null;}};
const MODALS=['blast','potov','rpbar'];   // overlays that take the controller while they're up (the replay controls, during a replay)
function modal(){for(const id of MODALS){const e=q('#'+id);if(e&&e.classList.contains('show')&&cands(e).length)return e;}return null;}
function scopeEl(){if(ovOn())return q('#sheet');{const m=modal();if(m)return m;}const t=q('#title');if(shown(t))return t;const s=q('#start');if(shown(s))return s;return document.body;}
function scopeId(sc){if(sc.id==='sheet'){const h=sc.querySelector('h2,h3,.bigcard,.bigwiz,.bigw,.olslots');return 'sheet:'+(h?((h.textContent||'').trim()||h.className).slice(0,48):'');}return sc===document.body?'game':sc.id;}
function ok(el,sc){
  if(el.disabled||el.closest('[hidden],[inert]'))return false;
  if(sc===document.body&&el.closest('#ov,#title,#start,#padhint'))return false;
  const r=el.getBoundingClientRect();if(r.width<4||r.height<4)return false;
  const cs=getComputedStyle(el);if(cs.visibility==='hidden'||+cs.opacity===0)return false;
  return true;}
function cands(sc){const out=new Set();
  for(let el of sc.querySelectorAll(SEL)){
    if(el.matches('input,select,textarea')){const l=el.closest('label');if(l)el=l;}
    else if(el.parentElement&&el.parentElement.closest('button,label'))continue;
    else if(el.matches('.tc .zoom'))continue;   // a card's own Read button: Y does that
    if(ok(el,sc))out.add(el);}
  return [...out];}
const DK=['a','u','i','p','v','w','id','k','z','code'];
function key(el){const d=el.dataset||{};let k=el.tagName+'|'+(el.id||'')+'|'+DK.map(x=>d[x]||'').join('|');
  if(!d.a&&!el.id)k+='|'+(el.textContent||'').trim().slice(0,20);return k;}
function save(sid){if(!cur||!cur.isConnected)return;const sc=scopeEl(),k=key(cur),same=cands(sc).filter(e=>key(e)===k);mem[sid]={k,n:Math.max(0,same.indexOf(cur)),r:cur.getBoundingClientRect()};}
function nearest(L,r){const x=r.left+r.width/2,y=r.top+r.height/2;let b=null,bd=1e12;for(const e of L){const s=e.getBoundingClientRect(),d=(s.left+s.width/2-x)**2+(s.top+s.height/2-y)**2;if(d<bd){bd=d;b=e;}}return b;}
function gameDefault(L){const r=pend()&&pend().req,f=s=>L.find(e=>e.matches(s));
  if(r&&r.k==='play'){const lk=typeof tutLock==='function'&&tutLock();return (lk&&L.find(e=>e.matches('#hand .card')&&S.pl[0].hand.some(c=>String(c.u)===e.dataset.u&&c.id===lk)))||f('#hand .card.can')||f('#hand .card');}
  if(r&&r.k==='gain')return f('#cloud .card.elig')||f('#prompt [data-a]');
  return f('#coach [data-a]:not([data-a=tutskip])')||f('#prompt [data-a]')||f('#hand .card')||L[0];}
function defaultFor(sc,L){const f=s=>L.find(e=>e.matches(s));
  if(sc.id==='sheet')return f('[data-padfirst]')||f('[data-a=tog]')||f('.tabs .btn:not(.alt)')||f('.acts .btn:not(.alt)')||L[0];
  if(sc.id==='rpbar')return f('[data-v=next]:not([disabled])')||f('[data-v=auto]')||L[0];
  if(MODALS.includes(sc.id))return f('.btn:not(.alt)')||L[0];
  if(sc.id==='start')return f('[data-a=launch]')||L[0];
  if(sc.id==='title')return L[0];
  return gameDefault(L);}
function restore(sid,sc,L){if(!L.length)return null;const m=mem[sid];
  if(m){const same=L.filter(e=>key(e)===m.k);if(same.length)return same[Math.min(m.n,same.length-1)];if(sid==='game'||sid===sidPrev)return nearest(L,m.r);}
  return defaultFor(sc,L);}
function setCur(el,scroll=true){
  if(cur&&cur!==el)cur.classList.remove('padf');cur=el;if(!el){hint();return;}
  if(on){el.classList.add('padf');
    const ae=document.activeElement;
    if(el.matches('button,a[href],[tabindex],input:not([type=text]):not([type=email]):not([type=password])')){if(ae!==el)try{el.focus({preventScroll:true});}catch(e){}}
    else if(ae&&ae!==document.body&&!el.contains(ae)&&ae.blur)ae.blur();
    if(scroll)try{el.scrollIntoView({block:'nearest',inline:'nearest'});}catch(e){}}
  mem[sidPrev]={k:key(el),n:0,r:el.getBoundingClientRect()};
  {const sc=scopeEl(),k=key(el),same=cands(sc).filter(e=>key(e)===k);mem[sidPrev].n=Math.max(0,same.indexOf(el));}
  hint();}

/* keep the highlight on something sensible as screens open, close and re-render */
function upkeep(){const sc=scopeEl(),sid=scopeId(sc);
  if(sid!==sidPrev){if(sidPrev&&cur)save(sidPrev);
    if(sc.id==='sheet'&&sc.querySelector('[data-a=again],[data-a=restart],[data-a=pzgo],[data-a=rankagain]'))endCache={S:window.S||(typeof S!=='undefined'?S:null),html:sc.innerHTML};sidPrev=sid;if(sid==='game'||sid==='title'||sid==='start')reqPrev=undefined;const L=cands(sc);setCur(restore(sid,sc,L));}
  else if(!cur||!cur.isConnected||!sc.contains(cur)||!ok(cur,sc)){const L=cands(sc);setCur(restore(sid,sc,L),false);}
  if(sid==='game'){const co=q('#coach.show'),cs=co?co.textContent.slice(0,80):'';
    if(cs!==coachSig){coachSig=cs;const bs=co?[...co.querySelectorAll('[data-a]')].filter(e=>ok(e,document.body)):[],b=bs.find(e=>e.dataset.a!=='tutskip')||bs[0];if(b)setCur(b);}   // the tutorial coach speaks: put the highlight on its button
    const p=pend(),r=p&&p.req||null;
    if(r!==reqPrev){const first=reqPrev===undefined;reqPrev=r;if(r&&!first)forReq(r);}}
  if(on&&cur&&!cur.classList.contains('padf'))cur.classList.add('padf');}
function forReq(r){const L=cands(document.body),f=s=>L.find(e=>e.matches(s));let t=null;
  if(r.k==='play'){const lk=typeof tutLock==='function'&&tutLock();if(lk){t=gameDefault(L);}else{if(cur&&cur.closest('#hand'))return;t=f('#hand .card.can');}}
  else if(r.k==='gain'){if(cur&&cur.matches('#cloud .card.elig'))return;t=f('#cloud .card.elig')||f('#prompt [data-a]');}
  else{if(cur&&cur.closest('#prompt'))return;t=f('#prompt [data-a]');}
  if(t)setCur(t);}

function move(dx,dy){const sc=scopeEl(),L=cands(sc);if(!L.length)return;
  if(!cur||!L.includes(cur)){setCur(restore(scopeId(sc),sc,L));return;}
  if(dx&&cur.matches('input[type=range]')){const st=+cur.step||1,v=Math.max(+cur.min||0,Math.min(+cur.max||100,+cur.value+dx*st));if(v!==+cur.value){cur.value=v;cur.dispatchEvent(new Event('input',{bubbles:true}));cur.dispatchEvent(new Event('change',{bubbles:true}));}return;}
  const a=cur.getBoundingClientRect(),ax=a.left+a.width/2,ay=a.top+a.height/2;let best=null,bs=1e12;
  for(const e of L){if(e===cur||e.contains(cur)||cur.contains(e))continue;
    const r=e.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
    const p=dx?(cx-ax)*dx:(cy-ay)*dy;if(p<=Math.max(2,.35*(dx?Math.min(a.width,r.width):Math.min(a.height,r.height))))continue;   // must really be in that direction, not a neighbour on the same row
    const edge=dx?(dx>0?r.left-a.right:a.left-r.right):(dy>0?r.top-a.bottom:a.top-r.bottom);
    const og=dx?Math.max(0,r.top-a.bottom,a.top-r.bottom):Math.max(0,r.left-a.right,a.left-r.right);
    const oc=dx?Math.abs(cy-ay):Math.abs(cx-ax);
    const s=Math.max(0,edge)+p*.25+og*4+oc*.35;if(s<bs){bs=s;best=e;}}
  if(best){setCur(best);try{SFX.play('nav');}catch(e){}}}

function act(a,data){const b=document.createElement('button');b.dataset.a=a;Object.assign(b.dataset,data||{});b.style.display='none';document.body.appendChild(b);b.click();b.remove();}
function canPlay(el){const p=pend();if(!(p&&p.req.k==='play'&&S))return null;const c=S.pl[0].hand.find(x=>String(x.u)===el.dataset.u);if(!c||CARDS[c.id].junk)return null;return c;}
function canGain(el){const p=pend(),i=+el.dataset.i;return !!(p&&p.req.k==='gain'&&el.classList.contains('elig')&&p.req.slots.includes(i));}
function activate(el){if(!el)return;const a=el.dataset.a;
  if(a==='hand'){const c=canPlay(el);if(c){const lock=tutLock();if(lock&&c.id!==lock){toast('For this tutorial round, play Power Gem.');return;}SFX.play('card');answer(c);return;}}
  if(a==='cloud'&&canGain(el)){answer(+el.dataset.i);return;}
  const inp=el.matches('label')?el.querySelector('input,select,textarea'):el;
  if(inp&&inp.matches('input[type=text],input[type=email],input[type=password],input[type=number],input:not([type]),textarea,select')){inp.focus();try{inp.select&&inp.select();}catch(e){}if(window.SSNative&&SSNative.keyboard)try{SSNative.keyboard();}catch(e){}return;}
  if(inp&&inp.matches('input[type=range]'))return;
  el.click();}
function back(){
  if(ovOn()){if(typeof inLobby==='function'&&inLobby())return;const sh=q('#sheet');
    for(const a of ['libback','openpick','rpclose']){const b=[...sh.querySelectorAll(`[data-a="${a}"]`)].find(e=>ok(e,sh));if(b){b.click();return;}}
    {const b=[...sh.querySelectorAll('.acts .btn.alt')].filter(e=>ok(e,sh)).find(e=>/^(back|cancel)\b/i.test(e.textContent.trim()));if(b){b.click();return;}}
    for(const a of ['close','mmcancel','olexit']){const b=[...sh.querySelectorAll(`[data-a="${a}"]`)].find(e=>ok(e,sh));if(b){b.click();return;}}
    const alt=[...sh.querySelectorAll('.acts .btn.alt')].filter(e=>ok(e,sh)).pop();
    if(alt&&/^(close|back|cancel|keep|not now|no\b|done|ok\b)/i.test(alt.textContent.trim())){alt.click();return;}
    closeOv();return;}
  {const m=modal();if(m){if(m.id==='rpbar'){const x=m.querySelector('[data-a=rpexit]');if(x)x.click();}return;}}
  if(shown(q('#start'))){const b=q('#start [data-a=totitle]');if(b)b.click();else showTitle();return;}
  if(shown(q('#title')))return;
  if(S&&S.over&&endCache&&endCache.S===S){openOv(endCache.html);return;}   // the match is over: B brings the results back
  if(S)menu();}
function tabs(d){const sc=scopeEl();
  for(const a of ['libtab','stab','setmode','libed']){const g=[...sc.querySelectorAll(`[data-a="${a}"]`)].filter(e=>ok(e,sc));if(g.length<2)continue;
    let i=g.findIndex(e=>e.getAttribute('aria-pressed')==='true');if(i<0)i=g.findIndex(e=>e.classList.contains('btn')&&!e.classList.contains('alt'));if(i<0)i=0;
    const n=g[(i+d+g.length)%g.length],k=key(n);n.click();
    requestAnimationFrame(()=>{const L=cands(scopeEl()),m=L.find(e=>key(e)===k);if(m)setCur(m);});return true;}
  return false;}
function rpStep(d){if(ovOn()||typeof RPLAY==='undefined'||!RPLAY)return false;const b=q(`#rpbar [data-v=${d<0?'prev':'next'}]`);if(b&&!b.disabled)b.click();return true;}
function scroller(){let e=cur;while(e&&e!==document.body&&e!==document.documentElement){const cs=getComputedStyle(e);if(/(auto|scroll)/.test(cs.overflowY)&&e.scrollHeight>e.clientHeight+2)return e;e=e.parentElement;}
  if(ovOn()){for(const s of ['#sheet','#ov']){const x=q(s);if(x&&x.scrollHeight>x.clientHeight+2)return x;}}
  if(scopeEl()===document.body){const l=q('#logwrap .log')||q('#logwrap');if(l&&shown(q('#logwrap'))&&l.scrollHeight>l.clientHeight+2)return l;}
  return document.scrollingElement;}
function page(d){const s=scroller();if(s)s.scrollBy({top:d*s.clientHeight*.8,behavior:'smooth'});}
function lookY(){const z=cur&&cur.closest('.tc')&&cur.closest('.tc').querySelector('.zoom');if(z){z.click();return;}
  if(cur&&cur.matches('#hand .card,#cloud .card,.card[data-a]')){cur.click();return;}
  const k=q('#sheet [data-a=ikey]');if(ovOn()&&k&&ok(k,q('#sheet'))){k.click();return;}}
function tipX(){if(ovOn())return;const t=[...document.querySelectorAll('[data-a=tip]')].find(e=>ok(e,document.body));if(t)t.click();}
function startBtn(){if(ovOn()){back();return;}const t=q('#title');if(shown(t)){const L=cands(t);if(L[0])L[0].click();return;}
  const s=q('#start');if(shown(s)){const b=q('#start [data-a=launch]');if(b&&!b.disabled)b.click();return;}if(S)menu();}
function selBtn(){if(S&&!ovOn()&&!shown(q('#title'))&&!shown(q('#start')))act('log');}

function wake(){if(on)return;on=true;document.body.classList.add('pad');try{SFX.init();}catch(e){}if(cur&&cur.isConnected)cur.classList.add('padf');}
function sleep(){if(!on)return;on=false;document.body.classList.remove('pad');if(cur)cur.classList.remove('padf');hint();}
function press(k){const was=on,had=!!(cur&&cur.isConnected);wake();upkeep();
  if(!was&&(DIRS.has(k)||k==='A')){if(!had)setCur(restore(sidPrev,scopeEl(),cands(scopeEl())));hint();return;}   // the first touch only shows where the highlight is
  switch(k){case 'U':move(0,-1);break;case 'D':move(0,1);break;case 'L':move(-1,0);break;case 'R':move(1,0);break;
    case 'A':activate(cur);break;case 'B':back();break;case 'X':tipX();break;case 'Y':lookY();break;
    case 'LB':if(!rpStep(-1)&&!tabs(-1))page(-1);break;case 'RB':if(!rpStep(1)&&!tabs(1))page(1);break;case 'LT':page(-1);break;case 'RT':page(1);break;
    case 'START':startBtn();break;case 'SEL':selBtn();break;}
  setTimeout(()=>{upkeep();hint();},0);}

/* ---------- on-screen button prompts ---------- */
const GL={xbox:{A:'A',B:'B',X:'X',Y:'Y',LB:'LB',RB:'RB',SEL:'⧉',START:'☰'},ps:{A:'✕',B:'○',X:'□',Y:'△',LB:'L1',RB:'R1',SEL:'⧉',START:'☰'}};
function hint(){const el=q('#padhint');if(!el)return;if(!on){el.classList.remove('show');hintSig='';return;}
  const sc=scopeEl(),game=sc===document.body,items=[];let aL='Select';
  if(cur){if(cur.matches('#hand .card'))aL=canPlay(cur)?'Play':'Look';
    else if(cur.matches('#cloud .card'))aL=canGain(cur)?((pend().req.verb)||'Gain'):'Look';
    else if(cur.matches('label'))aL=cur.querySelector('input[type=checkbox],input[type=radio]')?'Toggle':'Type';
    else if(cur.matches('input[type=range]'))aL='';
    else if(cur.matches('input,textarea'))aL='Type';}
  if(cur&&cur.matches('input[type=range]'))items.push(['','◀ ▶ Adjust']);
  if(aL)items.push(['A',aL]);
  if(cur&&aL!=='Look'&&(cur.matches('#hand .card,#cloud .card')||(cur.closest('.tc')&&cur.closest('.tc').querySelector('.zoom'))))items.push(['Y','Look']);
  if(ovOn()&&q('#sheet [data-a=ikey]'))items.push(['Y',q('#sheet [data-a=ikey]').textContent.trim()]);
  if(game&&[...document.querySelectorAll('[data-a=tip]')].some(e=>ok(e,document.body)))items.push(['X','Tip']);
  const tabsOn=['libtab','stab','setmode','libed'].some(a=>[...sc.querySelectorAll(`[data-a="${a}"]`)].filter(e=>ok(e,sc)).length>1);
  if(sc.id==='rpbar')items.push(['LB','RB','Round']);
  else if(tabsOn)items.push(['LB','RB','Tabs']);
  if(sc.id==='rpbar')items.push(['B','Exit replay']);
  else if(ovOn())items.push(['B','Back']);else if(sc.id==='start')items.push(['B','Back'],['START','Start']);else if(game&&S){items.push(['B',S.over&&endCache&&endCache.S===S?'Results':'Menu'],['SEL','Log']);}
  const G=GL[glyph],sig=glyph+JSON.stringify(items);if(sig===hintSig){el.classList.add('show');return;}hintSig=sig;el.classList.remove('idle');clearTimeout(hint.t);hint.t=setTimeout(()=>el.classList.add('idle'),5000);   // fades back after a few seconds so it doesn't cover the table
  el.innerHTML=items.map(it=>{const lab=it[it.length-1],bs=it.slice(0,-1).filter(Boolean);return `<span class="ph">${bs.map(b=>`<b class="pg pg-${b.toLowerCase()} ${glyph}">${G[b]||b}</b>`).join('')}${lab}</span>`;}).join('');
  el.classList.add('show');}

/* ---------- input sources ---------- */
function readPad(){
  if(nat.used){const b=[];for(let i=0;i<17;i++)b[i]=!!(nat.kb[i]||nat.hb[i]);return {b,ax:nat.ax};}
  const gs=navigator.getGamepads?navigator.getGamepads():[];let b=[],ax=[0,0,0,0],any=false;
  for(const g of gs){if(!g||!g.connected)continue;any=true;
    g.buttons.forEach((x,i)=>{if(x&&(x.pressed||x.value>.5))b[i]=true;});
    g.axes.forEach((v,i)=>{if(i<4&&Math.abs(v)>Math.abs(ax[i]))ax[i]=v;});
    if(!glyphFixed)glyph=/054c|playstation|dualsense|dualshock|wireless controller/i.test(g.id)?'ps':'xbox';}
  return any?{b,ax}:null;}
let tick=0;
function frame(t){requestAnimationFrame(frame);const s=readPad();
  if(s){const v={A:s.b[0],B:s.b[1],X:s.b[2],Y:s.b[3],LB:s.b[4],RB:s.b[5],LT:s.b[6],RT:s.b[7],SEL:s.b[8],START:s.b[9],
      U:s.b[12]||s.ax[1]<-.55,D:s.b[13]||s.ax[1]>.55,L:s.b[14]||s.ax[0]<-.55,R:s.b[15]||s.ax[0]>.55};
    for(const k in v){const d=!!v[k];
      if(d&&!prev[k]){press(k);rep[k]=t+380;}
      else if(d&&DIRS.has(k)&&t>=rep[k]){press(k);rep[k]=t+115;}
      prev[k]=d;}
    const ry=s.ax[3]||0;if(Math.abs(ry)>.25){wake();const sc=scroller();if(sc)sc.scrollBy(0,Math.sign(ry)*ry*ry*24);}}
  if(on&&++tick%6===0){upkeep();hint();}}
requestAnimationFrame(frame);

document.addEventListener('keydown',e=>{
  const t=e.target,typing=t&&t.matches&&t.matches('input:not([type=range]):not([type=checkbox]):not([type=radio]),textarea,select');
  const K={ArrowUp:'U',ArrowDown:'D',ArrowLeft:'L',ArrowRight:'R'}[e.key];
  if(K){if(typing&&(K==='L'||K==='R'))return;e.preventDefault();e.stopPropagation();press(K);return;}
  if(e.key==='Enter'||e.key===' '){if(typing||!on||!cur)return;e.preventDefault();e.stopPropagation();press('A');return;}
  if(e.key==='Escape'){if(typing){t.blur();return;}e.preventDefault();e.stopPropagation();press('B');return;}
},true);
document.addEventListener('pointermove',e=>{if(on&&Math.abs(e.movementX)+Math.abs(e.movementY)>3)sleep();},{passive:true});
document.addEventListener('pointerdown',()=>sleep(),true);
document.addEventListener('wheel',()=>sleep(),{passive:true});

window.SSPAD={
  nat(k,d){nat.used=true;const i=IDX[k];if(i!=null)nat.kb[i]=!!d;},
  natAxes(lx,ly,rx,ry,hx,hy){nat.used=true;nat.ax=[+lx||0,+ly||0,+rx||0,+ry||0];nat.hb[14]=hx<-.5;nat.hb[15]=hx>.5;nat.hb[12]=hy<-.5;nat.hb[13]=hy>.5;},
  natName(n){glyphFixed=true;glyph=/sony|playstation|dualsense|dualshock|wireless controller/i.test(n||'')?'ps':'xbox';},
  state(){return {on,cur:cur&&cur.isConnected?key(cur):null,label:cur?((cur.getAttribute('aria-label')||cur.textContent||'').trim().slice(0,40)):'',scope:sidPrev,hint:(q('#padhint')||{}).textContent||''};},
  press,
  why(sel){const t=[...document.querySelectorAll(sel)].find(e=>e.getBoundingClientRect().width>3);if(!t)return 'no target';const sc=scopeEl(),r=t.getBoundingClientRect(),cs=getComputedStyle(t);return {scope:scopeId(sc),inScope:sc.contains(t),ok:ok(t,sc),inC:cands(sc).includes(t),dis:t.disabled,vis:cs.visibility,op:cs.opacity,r:[r.left,r.top,r.width,r.height].map(Math.round),cur:cur&&key(cur),curR:cur&&[...Object.values(cur.getBoundingClientRect().toJSON())].map(Math.round)};},
  debug(){const sc=scopeEl();return cands(sc).map(e=>{const r=e.getBoundingClientRect();return key(e).replace(/\|+/g,'|')+' @'+Math.round(r.left)+','+Math.round(r.top)+' '+Math.round(r.width)+'x'+Math.round(r.height);});},
};
})();
