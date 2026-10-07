import asyncio
from playwright.async_api import async_playwright
U='http://127.0.0.1:8123/index.html'
CFG="window.SS_PEER_CFG={host:'127.0.0.1',port:9000,path:'/ss',secure:false,config:{iceServers:[]}};"
LOOP="(()=>{if(!pending||!pending.req)return null;const r=pending.req;if(r.k==='play'){const c=(S.pl[0].hand.find(c=>!CARDS[c.id].junk)||S.pl[0].hand[0]);answer(c);return 'play';}answer(r.k==='gain'?(r.optional?-1:(r.slots&&r.slots.length?r.slots[0]:'ice')):r.k==='pick'?r.items.slice(0,r.min):r.k==='yn'?false:r.k==='player'?(r.opps||[1])[0]:0);return r.k;})()"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--allow-loopback-in-peer-connection']);errs=[]
        A=await (await b.new_context(viewport={'width':1200,'height':820})).new_page();await A.add_init_script(CFG);A.on('pageerror',lambda e:errs.append('host: '+str(e)))
        await A.goto(U);await A.evaluate("localStorage.clear();OPT.tutAsked=true;saveOpt();1");await A.reload()
        await A.evaluate("onlMenu();1");await A.click('#sheet [data-a=olhost]');await A.wait_for_timeout(1500)
        print('host: online via',await A.evaluate("ONL.net&&ONL.net.kind"),'| code',await A.evaluate("ONL.code"),'| invite link',await A.evaluate("onlLink()"))
        B=await (await b.new_context(viewport={'width':1200,'height':820})).new_page();await B.add_init_script(CFG);B.on('pageerror',lambda e:errs.append('guest: '+str(e)))
        await B.goto(await A.evaluate("onlLink()"));await B.evaluate("OPT.tutAsked=true;saveOpt();1");await B.wait_for_timeout(3500)
        print('guest opened the link → auto-joined:',await B.evaluate("ONL.on&&ONL.role==='guest'"),'| guest sees host:',await B.evaluate("!!ONL.host"),'| host sees guest:',await A.evaluate("!!ONL.guest"))
        await A.click('#sheet [data-a=olwiz][data-w=omar]');await B.click('#sheet [data-a=olwiz][data-w=bunny]');await A.wait_for_timeout(700)
        await A.click('#sheet [data-a=olready]');await B.click('#sheet [data-a=olready]');await A.wait_for_timeout(3000)
        print('both ready → match on host:',await A.evaluate("S&&S.pl.map(P=>P.wiz).join(' vs ')"),'| on guest:',await B.evaluate("S&&S.pl&&S.pl.map(P=>P.wiz).join(' vs ')"))
        moves={'host':0,'guest':0}
        for i in range(1400):
            if await A.evaluate("!!(S&&S.over)"):break
            if (await A.evaluate(LOOP)):moves['host']+=1
            if (await B.evaluate(LOOP)):moves['guest']+=1
            await A.wait_for_timeout(60)
            if await A.evaluate("S.battle>=4"):break
            if await A.evaluate("!!(S.blast&&S.blast.stage==='result')") and await A.locator('#blast [data-a=ack]').count():await A.click('#blast [data-a=ack]')
            if await B.locator('#blast [data-a=ack]').count():
                try:await B.click('#blast [data-a=ack]',timeout=500)
                except Exception:pass
        print('after play: battle',await A.evaluate("S.battle"),'round',await A.evaluate("S.round"),'| decisions made — host',moves['host'],'guest',moves['guest'])
        await A.wait_for_timeout(1500)
        print('guest view matches host (after 1.5 s):',await B.evaluate("JSON.stringify([S.battle,S.round,S.pl[0].hp,S.pl[1].hp])"),'vs host (mirrored)',await A.evaluate("JSON.stringify([S.battle,S.round,S.pl[1].hp,S.pl[0].hp])"))
        print('errors:',errs[:3]);await b.close()
asyncio.run(main())
