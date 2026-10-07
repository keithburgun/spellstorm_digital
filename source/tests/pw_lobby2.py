import asyncio
from playwright.async_api import async_playwright
U='http://127.0.0.1:8123/index.html'
CFG="window.SS_PEER_CFG={host:'127.0.0.1',port:9000,path:'/ss',secure:false,config:{iceServers:[]}};"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch();errs=[]
        A=await (await b.new_context(viewport={'width':1200,'height':820})).new_page();await A.add_init_script(CFG);A.on('pageerror',lambda e:errs.append('host: '+str(e)))
        await A.goto(U);await A.evaluate("localStorage.clear();OPT.tutAsked=true;saveOpt();1");await A.reload()
        await A.evaluate("onlMenu();1");await A.wait_for_timeout(200)
        print('online menu: wizard tiles before connecting?',await A.locator('#sheet [data-a=olwiz]').count()>0)
        await A.click('#sheet [data-a=olhost]');await A.wait_for_timeout(1500);link=await A.evaluate("onlLink()")
        print('host lobby title:',await A.evaluate("document.querySelector('#sheet h2').innerText"),'| wizard tiles in the lobby:',await A.locator('#sheet [data-a=olwiz]').count())
        ctxB=await b.new_context(viewport={'width':1200,'height':820});B=await ctxB.new_page();await B.add_init_script(CFG);B.on('pageerror',lambda e:errs.append('guest: '+str(e)))
        await B.goto(link);await B.evaluate("OPT.tutAsked=true;saveOpt();1");await B.wait_for_timeout(3500)
        print('guest joined from the link:',await B.evaluate("ONL.on&&ONL.role==='guest'"),'| address now:',await B.evaluate("location.href"))
        await B.mouse.click(5,5);await B.keyboard.press('Escape');await B.wait_for_timeout(300)
        print('click outside + Esc → still in the lobby:',await B.evaluate("inLobby()"))
        await B.click('#sheet [data-a=olcancel]');await B.wait_for_timeout(1200)
        print('Leave lobby → connected:',await B.evaluate("ONL.on"),'| title screen:',await B.evaluate("getComputedStyle(document.getElementById('title')).display!=='none'"),'| host sees guest gone:',await A.evaluate("!ONL.guest"))
        await B.reload();await B.wait_for_timeout(2000)
        print('after refresh → rejoined online?',await B.evaluate("ONL.on"))
        await B.click('[data-a=t_play]');await B.evaluate("OPT.mode='duel';OPT.tour=false;saveOpt();drawSelect();1");await B.click('[data-a=launch]')
        k=None
        for i in range(120):
            k=await B.evaluate("pending&&pending.req&&pending.req.k")
            if k=='play':break
            if k:await B.evaluate("(()=>{const r=pending.req;answer(r.k==='gain'?(r.optional?-1:(r.slots[0]??'ice')):r.k==='pick'?r.items.slice(0,r.min):r.k==='yn'?false:0)})()")
            await B.wait_for_timeout(150)
        print('guest then plays a normal offline game vs the CPU:',k=='play','| opponent is CPU:',await B.evaluate("!S.online"))
        B2=await ctxB.new_page();await B2.add_init_script(CFG);await B2.goto(link);await B2.evaluate("OPT.tutAsked=true;saveOpt();1");await B2.wait_for_timeout(3500)
        await A.click('#sheet [data-a=olwiz][data-w=eve]');await B2.click('#sheet [data-a=olwiz][data-w=oren]');await A.click('#sheet [data-a=olready]');await B2.click('#sheet [data-a=olready]');await A.wait_for_timeout(3000)
        print('a guest rejoining by link can still start a match:',await A.evaluate("S&&S.pl.map(P=>P.wiz).join(' vs ')"),'| errors:',errs[:3]);await b.close()
asyncio.run(main())
