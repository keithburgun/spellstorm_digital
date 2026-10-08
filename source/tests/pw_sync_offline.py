import asyncio,json,urllib.request,subprocess,time
from playwright.async_api import async_playwright
U='http://127.0.0.1:8124/index.html';M='http://127.0.0.1:9100';CFG="window.SS_SUPA_CFG={url:'http://127.0.0.1:9100',key:'sb_publishable_test'};"
mock=lambda p:json.loads(urllib.request.urlopen(M+p).read() or b'null')
async def main():
    mock('/__reset')
    async with async_playwright() as p:
        b=await p.chromium.launch();errs=[]
        ctx=await b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);pg=await ctx.new_page();await pg.add_init_script(CFG);pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(U);await pg.evaluate("OPT.tutAsked=true;saveOpt();optionsSheet();1");await pg.wait_for_timeout(300)
        await pg.click('#sheet [data-a=acct]');await pg.wait_for_timeout(200)
        r=await pg.evaluate("(()=>{const e=document.getElementById('sheet').getBoundingClientRect();const f=[...document.querySelectorAll('#sheet input,#sheet .acts .btn')].map(x=>x.getBoundingClientRect());return {fits:f.every(x=>x.left>=e.left-1&&x.right<=e.right+1),sheet:[e.left,e.top,e.width,Math.min(e.height,innerHeight-e.top)]}})()")
        print('phone: account form fits on screen',r['fits']);s=r['sheet'];await pg.screenshot(path='/tmp/claude-0/acct_phone.png',clip={'x':s[0],'y':s[1],'width':s[2],'height':s[3]})
        await pg.fill('#acem','phone@example.com');await pg.fill('#acpw','secret99');await pg.click('#sheet [data-a=acctnew]');await pg.wait_for_timeout(1500)
        r=await pg.evaluate("(()=>{const e=document.getElementById('sheet').getBoundingClientRect();return [e.left,e.top,e.width,Math.min(e.height,innerHeight-e.top)]})()")
        await pg.evaluate("document.getElementById('acctbox').scrollIntoView();1");await pg.wait_for_timeout(200)
        bx=await pg.evaluate("(()=>{const e=document.getElementById('acctbox').getBoundingClientRect();return [e.left-8,e.top-8,e.width+16,e.height+16]})()")
        await pg.screenshot(path='/tmp/claude-0/acct_signedin.png',clip={'x':bx[0],'y':bx[1],'width':bx[2],'height':bx[3]})
        # offline: the stand-in goes down
        subprocess.run(["kill",open("/tmp/claude-0/mock.pid").read().strip()]);time.sleep(.5)
        await pg.evaluate("const P=loadProf();P.games=7;saveProf(P);SYNC.run()");await pg.wait_for_timeout(1500)
        print('offline: game still works, profile saved locally',await pg.evaluate("loadProf().games"),'| status shown:',await pg.evaluate("SYNC.status()"),'| still signed in',await pg.evaluate("!!SYNC.S.ses"))
        open("/tmp/claude-0/mock.pid","w").write(str(subprocess.Popen(["node","supa_mock.js"],cwd="/home/claude/spellstorm_digital/source/tests",env={**__import__("os").environ,"PORT":"9100","KEY":"sb_publishable_test"},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).pid));time.sleep(1)
        print('NOTE: the stand-in restarted empty, as a fresh server would be')
        print('errors:',errs[:3]);await b.close()
asyncio.run(main())
