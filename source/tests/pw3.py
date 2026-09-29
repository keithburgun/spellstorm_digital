import os
import asyncio
TO=4000
from playwright.async_api import async_playwright
async def drive(pg,steps,stop_battle=None):
    for i in range(steps):
        await pg.wait_for_timeout(90)
        if await pg.locator('#ov.show h2:has-text("win")').count(): return 'ended'
        if stop_battle and await pg.evaluate(f'S&&S.battle>={stop_battle}&&S.phase==="play"'): return 'stopped'
        if not await pg.locator('#prompt.ask').count(): continue
        k=await pg.evaluate('pending&&pending.req.k')
        try:
            if k=='play': await pg.locator('#hand .card.can').first.click(timeout=TO); await pg.locator('[data-a=play]').click(timeout=TO)
            elif k=='pick':
                if not await pg.locator('#ov.show [data-a=pickok]').count(): await pg.evaluate('openPick()')
                ok=pg.locator('#ov.show [data-a=pickok]')
                while await ok.is_disabled(): await pg.locator('#ov.show [data-a=tog]').first.click(timeout=TO)
                await ok.click(timeout=TO)
            elif await pg.locator('#cloud .card.elig').count(): await pg.locator('#cloud .card.elig').first.click(timeout=TO); await pg.locator('[data-a=take]').click(timeout=TO)
            elif await pg.locator('#prompt [data-a=ans]:not([disabled])').count(): await pg.locator('#prompt [data-a=ans]:not([disabled])').first.click(timeout=TO)
            elif await pg.locator('#prompt [data-a=sp]').count(): await pg.locator('#prompt [data-a=sp]').first.click(timeout=TO)
        except Exception as e: print('drive err',str(e)[:100])
    return 'steps'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); errs=[]
        from PIL import Image; shots=[]
        for me,op,vp in [('omar','abragail',{'width':1366,'height':768}),('oren','may',{'width':1366,'height':768}),('croh','bunny',{'width':1366,'height':768})]:
            pg=await b.new_page(viewport=vp); pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'..','dist','spellstorm.html')))
            await pg.click(f'[data-a=tile][data-r=me][data-w={me}]'); await pg.click(f'[data-a=tile][data-r=opp][data-w={op}]'); await pg.click('[data-a=launch]')
            await pg.evaluate('speed=0.02')
            r=await drive(pg,500,stop_battle=3)
            await pg.evaluate('speed=1'); await pg.wait_for_timeout(400)
            f=f'shot_{me}.png'; await pg.screenshot(path=f); shots.append(f)
            r2=await drive(pg,1500) if me=='croh' else ''
            print(me,op,r,r2)
        await b.close()
        ims=[Image.open(f) for f in shots[:2]]; W=Image.new('RGB',(ims[0].width,ims[0].height*2)); W.paste(ims[0],(0,0)); W.paste(ims[1],(0,ims[0].height)); W.save('combo2.png')
        print('errors',errs[:5])
asyncio.run(main())
