import os
import asyncio, json
from playwright.async_api import async_playwright
CHECK="""(()=>{const R=s=>{const els=[...document.querySelectorAll(s)].filter(e=>e.offsetParent);if(!els.length)return null;const rs=els.map(e=>e.getBoundingClientRect());
 return {l:Math.min(...rs.map(r=>r.left)),t:Math.min(...rs.map(r=>r.top)),r:Math.max(...rs.map(r=>r.right)),b:Math.max(...rs.map(r=>r.bottom))};};
 const reg={opp:R('#opp, #opp *'),cloud:R('#cloud > *'),arena:R('#arena > *'),prompt:R('#prompt'),me:R('#me, #me *'),hand:R('#hand .card')};
 const out=[],H=innerHeight,W=innerWidth,k=Object.keys(reg);
 for(let i=0;i<k.length;i++)for(let j=i+1;j<k.length;j++){const a=reg[k[i]],b=reg[k[j]];if(!a||!b)continue;const ox=Math.min(a.r,b.r)-Math.max(a.l,b.l),oy=Math.min(a.b,b.b)-Math.max(a.t,b.t);if(ox>2&&oy>2)out.push(k[i]+'×'+k[j]+' '+Math.round(oy)+'px');}
 for(const x of k){const a=reg[x];if(a&&(a.b>H+1||a.r>W+1))out.push(x+' off-screen');}
 const app=document.getElementById('app').getBoundingClientRect();
 for(const c of document.querySelectorAll('#app .card')){if(!c.offsetParent)continue;const r=c.getBoundingClientRect();if(r.width<2)continue;
   let clip=r.bottom>Math.min(H,app.bottom)+1||r.top<-1||r.right>W+1||r.left<-1;
   for(let a=c.parentElement;a&&a.id!=='app';a=a.parentElement){const cs=getComputedStyle(a);if(cs.overflow!=='visible'||cs.overflowY!=='visible'){const ar=a.getBoundingClientRect();if(r.bottom>ar.bottom+1||r.top<ar.top-1)clip=true;}}
   if(clip){out.push('card cut off: '+(c.dataset.cid||c.className.split(' ')[1]));break;}}
 const pe=document.getElementById('prompt');if(pe.scrollHeight>pe.clientHeight+1)out.push('prompt content hidden');
 return out;})()"""
STATES={
 'cards on table + Unstable Formula':"""S.slot=[S.pl[0].hand[0],S.pl[1].hand[0]];S.revealed=true;pending=null;setTimeout(()=>G.decide(0,{k:'opt',q:'Unstable Formula: lower one Element by 2 to raise another by 2. (Fire 3, Earth 3, Water 3)',opts:['Fire −2, Earth +2','Fire −2, Water +2','Earth −2, Fire +2','Earth −2, Water +2','Water −2, Fire +2','Water −2, Earth +2','No change'],dis:[0,0,0,0,0,0,0],cpu:6}),0);1""",
 'regroup gain prompt':"""S.slot=[null,null];S.revealed=false;S.phase='gain';closeOv();pending=null;setTimeout(()=>G.decide(0,{k:'gain',q:'Gain Spell: take one card from the Storm Cloud, or a free special card.',slots:[0,1,2],optional:0,special:1,verb:'Gain'}),0);1""",
 'long Ultimate question':"""S.phase='resolve';closeOv();pending=null;S.slot=[S.pl[0].hand[0],S.pl[1].hand[0]];S.revealed=true;setTimeout(()=>G.decide(0,{k:'yn',ult:1,q:'Use Bottoms up, I guess! for 5 mana? (Shuffle the Potion Deck and drink potions one at a time, paying their Element cost. A third TOXIC ends it with an ASH, CURSE and ICE. Elements reset to 3 after.)',cpu:true}),0);1""",
}
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); errs=[]; bad=0
        for (w,h) in [(390,844),(360,740),(460,888),(851,393),(813,480),(813,560),(1024,600),(1100,580),(1280,640),(1366,768)]:
            ctx=await b.new_context(viewport={'width':w,'height':h},is_mobile=w<900,has_touch=w<900); pg=await ctx.new_page(); pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'..','dist','spellstorm.html'))); await pg.evaluate("OPT.tutAsked=true;saveOpt();1"); await pg.click('[data-a=t_play]')
            await pg.click('[data-a=tile][data-r=me][data-w=oren]'); await pg.click('[data-a=tile][data-r=opp][data-w=may]'); await pg.click('[data-a=launch]')
            for i in range(300):
                k=await pg.evaluate("pending&&pending.req.k")
                if k=='play': break
                if k: await pg.evaluate("(()=>{const r=pending.req;answer(r.k==='gain'?(r.optional?-1:(r.slots[0]??'ice')):r.k==='pick'?r.items.slice(0,r.min):r.k==='yn'?false:0)})()")
                await pg.wait_for_timeout(200)
            await pg.evaluate("S.pl[0].hp=11;S.pl[1].hp=9;render();1")
            for name,js in STATES.items():
                await pg.evaluate(js); await pg.wait_for_timeout(350)
                if name.startswith('cards'): await pg.screenshot(path=f'cr_{w}x{h}_sheet.png'); await pg.evaluate("closeOv();render();1"); await pg.wait_for_timeout(200)
                r=await pg.evaluate(CHECK); bad+=len(r)
                print(f'{w}x{h} {name:34s}', 'OK' if not r else r)
                if (w,h)==(460,888) and name.startswith('cards'): await pg.screenshot(path='cr_460.png')
                if (w,h)==(360,740) and name.startswith('regroup'): await pg.screenshot(path='cr_360.png')
            await ctx.close()
        print('total problems:',bad,'| errors:',errs[:3]); await b.close()
asyncio.run(main())
