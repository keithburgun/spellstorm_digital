import asyncio
from playwright.async_api import async_playwright
U='file:///mnt/user-data/outputs/spellstorm.html'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':1200,'height':820}); errs=[]
        A=await ctx.new_page(); A.on('pageerror',lambda e:errs.append('host: '+str(e)))
        await A.goto(U); await A.evaluate("localStorage.clear();OPT.tutAsked=true;saveOpt();1"); await A.reload()
        await A.evaluate("onlMenu();1"); await A.click('#sheet [data-a=olhost]'); await A.wait_for_timeout(600)
        code=await A.evaluate("ONL.code"); link=await A.evaluate("onlLink()"); print('host created game',code,'| invite link:',link,'| Copy invite link button:',await A.locator('#sheet [data-a=olcopy]').count()==1)
        B=await ctx.new_page(); B.on('pageerror',lambda e:errs.append('guest: '+str(e)))
        await B.goto(U+'#join='+code); await B.wait_for_timeout(1800)
        print('guest opened the link → auto-joined:',await B.evaluate("ONL.on&&ONL.role==='guest'&&ONL.code"),'| host sees opponent:',await A.evaluate("!!ONL.guest"))
        await A.click('#sheet [data-a=olwiz][data-w=may]'); await B.click('#sheet [data-a=olwiz][data-w=croh]'); await A.wait_for_timeout(500)
        print('host sees opponent choosing:',await A.evaluate("ONL.guest&&ONL.guest.wiz"),'| guest sees host choosing:',await B.evaluate("ONL.host&&ONL.host.wiz"))
        await A.click('#sheet [data-a=olready]'); await A.wait_for_timeout(500)
        print('host ready, guest not → started?',await A.evaluate("!!ONL.started"),'| guest sees host ready:',await B.evaluate("!!(ONL.host&&ONL.host.ready)"))
        await B.click('#sheet [data-a=olready]'); await A.wait_for_timeout(2500)
        print('both ready → host started:',await A.evaluate("!!ONL.started"),'| match:',await A.evaluate("S&&S.pl.map(P=>P.wiz).join(' vs ')"),'| guest in the match:',await B.evaluate("!!(ONL.started&&S)"),await B.evaluate("S&&S.pl.map(P=>P.wiz).join(' vs ')"))
        await A.screenshot(path='onl_host.png'); print('errors:',errs[:3])
        # lobby banner, with a stand-in for claude.ai's lobby room and user profiles
        C=await (await b.new_context(viewport={'width':1200,'height':820})).new_page(); C.on('pageerror',lambda e:errs.append('banner: '+str(e)))
        await C.add_init_script("""window.claude={use:async n=>n==='room'?{onPeers:fn=>{setTimeout(()=>fn({peers:[{isMe:false,by:'u1',presence:{hosting:'abc234'}}]}),50);return()=>{}},presence:()=>Promise.resolve(),join:async()=>null}:n==='user'?{profiles:async ids=>({u1:{name:'Keith'}})}:null};""")
        await C.goto(U); await C.wait_for_timeout(1800)
        print('banner:',await C.evaluate("(()=>{const e=document.getElementById('lobbybanner');return e&&!e.hidden?e.innerText.replace(/\\n/g,' '):'hidden'})()"))
        r=await C.evaluate("(()=>{const e=document.getElementById('lobbybanner').getBoundingClientRect();return [e.left,e.top,e.width,e.height]})()")
        await C.screenshot(path='onl_banner.png',clip={'x':r[0]-10,'y':r[1]-10,'width':r[2]+20,'height':r[3]+20}); print('errors:',errs[:3]); await b.close()
asyncio.run(main())
