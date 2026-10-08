# Two devices, one account, against the local Supabase stand-in (tests/supa_mock.js on :9100).
import asyncio,json,urllib.request
from playwright.async_api import async_playwright
U='http://127.0.0.1:8124/index.html';M='http://127.0.0.1:9100'
CFG="window.SS_SUPA_CFG={url:'http://127.0.0.1:9100',key:'sb_publishable_test'};"
mock=lambda p:json.loads(urllib.request.urlopen(M+p).read() or b'null')
async def dev(b,name,errs):
    ctx=await b.new_context(viewport={'width':1200,'height':820});pg=await ctx.new_page();await pg.add_init_script(CFG)
    pg.on('pageerror',lambda e:errs.append(name+': '+str(e)));await pg.goto(U);await pg.evaluate("OPT.tutAsked=true;saveOpt();1");await pg.wait_for_timeout(300);return pg
async def signin(pg,em,pw,create=False,expect_ok=True):
    await pg.evaluate("closeOv();optionsSheet();1");await pg.click('#sheet [data-a=acct]');await pg.fill('#acem',em);await pg.fill('#acpw',pw)
    await pg.click('#sheet [data-a=acctnew]' if create else '#sheet [data-a=acctgo]');await pg.wait_for_timeout(1500)
    return await pg.evaluate("(document.querySelector('#sheet [role=alert]')||{}).innerText||(SYNC.S.ses?'signed in as '+SYNC.S.ses.email:'?')")
async def main():
    mock('/__reset')
    async with async_playwright() as p:
        b=await p.chromium.launch();errs=[]
        A=await dev(b,'A',errs)
        # A: some progress as a guest first
        await A.evaluate("const P=loadProf();P.games=5;P.wins=3;P.ach={first:111};P.hist=[{t:1000,won:true,me:'derby',rp:'REPLAY',rpx:{d:[1]}}];P.rkx={derby:{elo:950,g:5,w:3,peak:960,streak:1}};saveProf(P);OPT.diff='hard';OPT.vol=0.2;saveOpt();1")
        print('1 weak password →',await signin(A,'keith@example.com','123',True))
        print('2 create account →',await signin(A,'keith@example.com','secret99',True))
        await A.wait_for_timeout(500);row=mock('/__save')[0]['data']
        print('   cloud now: games',row['p']['games'],'| hist entries',len(row['p']['hist']),'| replay in cloud?','rp' in row['p']['hist'][0] or 'rpx' in row['p']['hist'][0],'| diff',row['o'].get('diff'),'| volume synced?','vol' in row['o'])
        print('   options screen:',await A.evaluate("document.getElementById('acctbox').innerText.replace(/\\n/g,' · ')"))
        B=await dev(b,'B',errs)
        print('3 wrong password on B →',await signin(B,'keith@example.com','nope'))
        print('4 sign in on B →',await signin(B,'keith@example.com','secret99'))
        await B.wait_for_timeout(800)
        print('   B received: games',await B.evaluate("loadProf().games"),'| Ranked Elo',await B.evaluate("loadProf().rkx.derby.elo"),'| achievement',await B.evaluate("JSON.stringify(loadProf().ach)"),'| difficulty',await B.evaluate("OPT.diff"),'| B kept its own volume',await B.evaluate("OPT.vol"))
        # 5: both devices play "offline" at the same time, then sync
        await A.evaluate("SYNC.S.quiet=true;const P=loadProf();P.games+=2;P.wins+=1;P.hist.push({t:2000,won:true,me:'eve'});P.ach.second=222;P.rkx.derby.elo=980;saveProf(P);1")
        await B.evaluate("SYNC.S.quiet=true;const P=loadProf();P.games+=4;P.wins+=2;P.hist.push({t:3000,won:false,me:'may'});P.ach.third=333;P.best=9;saveProf(P);1")
        await B.evaluate("SYNC.S.quiet=false;SYNC.run()");await B.wait_for_timeout(800);await A.evaluate("SYNC.S.quiet=false;SYNC.run()");await A.wait_for_timeout(800);await B.evaluate("SYNC.run()");await B.wait_for_timeout(800)
        for n,pg in [('A',A),('B',B)]:
            print(f'5 after both played offline — {n}: games',await pg.evaluate("loadProf().games"),'(5+2+4=11) | wins',await pg.evaluate("loadProf().wins"),'(3+1+2=6) | history',await pg.evaluate("loadProf().hist.map(h=>h.t).join(',')"),'| achievements',await pg.evaluate("Object.keys(loadProf().ach).sort().join(',')"),'| best',await pg.evaluate("loadProf().best"))
        print('   A still has its replay:',await A.evaluate("loadProf().hist[0].rp==='REPLAY'"))
        # 6: expired sign-in refreshes itself
        mock('/__expire');await A.evaluate("const P=loadProf();P.games+=1;saveProf(P);SYNC.run()");await A.wait_for_timeout(1200)
        print('6 after the sign-in token expired: synced games',mock('/__save')[0]['data']['p']['games'],'| still signed in',await A.evaluate("!!SYNC.S.ses"),'| error',await A.evaluate("SYNC.S.err||'none'"))
        # 7: sign out
        await A.evaluate("optionsSheet();1");await A.click('#sheet [data-a=acctout]');await A.click('#sheet [data-a=acctout2]');await A.wait_for_timeout(1200)
        print('7 sign out → A profile games',await A.evaluate("loadProf().games"),'| signed in',await A.evaluate("!!SYNC.S.ses"),'| cloud keeps games',mock('/__save')[0]['data']['p']['games'])
        print('8 sign back in →',await signin(A,'keith@example.com','secret99'));await A.wait_for_timeout(800);print('   A games',await A.evaluate("loadProf().games"),'(no double counting)')
        print('9 forgot password →',await A.evaluate("closeOv();acctSheet();document.getElementById('acem').value='keith@example.com';acctForgot();1") and await (lambda:A.wait_for_timeout(800))() or await A.evaluate("document.querySelector('#sheet [role=alert]').innerText"))
        print('errors:',errs[:3]);await b.close()
asyncio.run(main())
