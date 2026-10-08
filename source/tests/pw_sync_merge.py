import asyncio,json,urllib.request
from playwright.async_api import async_playwright
U='http://127.0.0.1:8124/index.html';M='http://127.0.0.1:9100';CFG="window.SS_SUPA_CFG={url:'http://127.0.0.1:9100',key:'sb_publishable_test'};"
mock=lambda p:json.loads(urllib.request.urlopen(M+p).read() or b'null')
async def main():
    mock('/__reset')
    async with async_playwright() as p:
        b=await p.chromium.launch();errs=[]
        async def dev():
            pg=await (await b.new_context()).new_page();await pg.add_init_script(CFG);pg.on('pageerror',lambda e:errs.append(str(e)));await pg.goto(U);await pg.evaluate("OPT.tutAsked=true;saveOpt();1");return pg
        async def signin(pg,em,pw,create=False):
            await pg.evaluate("closeOv();optionsSheet();1");await pg.click('#sheet [data-a=acct]');await pg.fill('#acem',em);await pg.fill('#acpw',pw)
            await pg.click('#sheet [data-a=acctnew]' if create else '#sheet [data-a=acctgo]');await pg.wait_for_timeout(1500)
            return await pg.evaluate("(document.querySelector('#sheet [role=alert]')||{}).innerText||(SYNC.S.ses?'signed in':'?')")
        A=await dev();await A.evaluate("const P=loadProf();P.games=3;P.rkx={derby:{elo:950,g:3,w:2,peak:950,streak:2}};saveProf(P);1")
        await signin(A,'k@example.com','secret99',True)
        B=await dev()
        print('wrong password (full length) →',await signin(B,'k@example.com','wrongpass1'))
        print('email already used →',await signin(B,'k@example.com','another1',True))
        # B has its own guest progress before signing in → combined
        await B.evaluate("const P=loadProf();P.games=2;P.wins=1;saveProf(P);1")
        print('sign in on a device with guest progress →',await signin(B,'k@example.com','secret99'));await B.wait_for_timeout(800)
        print('   combined games',await B.evaluate("loadProf().games"),'(3+2=5) | toast:',await B.evaluate("document.getElementById('toast').textContent"))
        await A.evaluate("SYNC.run()");await A.wait_for_timeout(800)
        await A.evaluate("SYNC.S.quiet=true;const P=loadProf();P.rkx.derby.elo=990;P.rkx.derby.g+=1;P.rkx.derby.streak=3;saveProf(P);1")
        await B.evaluate("SYNC.S.quiet=true;const P=loadProf();P.games+=1;saveProf(P);1")
        await A.evaluate("SYNC.S.quiet=false;SYNC.run()");await A.wait_for_timeout(800);await B.evaluate("SYNC.S.quiet=false;SYNC.run()");await B.wait_for_timeout(800)
        print('Ranked after A played a Ranked game offline and B something else → B sees Elo',await B.evaluate("loadProf().rkx.derby.elo"),'(990) games',await B.evaluate("loadProf().rkx.derby.g"),'(4) streak',await B.evaluate("loadProf().rkx.derby.streak"),'(3) | total games',await B.evaluate("loadProf().games"),'(6)')
        print('errors:',errs[:3]);await b.close()
asyncio.run(main())
