# Play whole matches in every mode using only a (simulated) controller, at chosen screen sizes.
#   python3 tests/pw_pad_matches.py duel,tour,ranked,daily,ffa,coop,2v2,puzzle 1280x800,740x416 [native]
# Serve the app build first:  cd ../www && python3 -m http.server 8124
import asyncio,sys,os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from pw_pad import *
NATIVE=len(sys.argv)>3 and sys.argv[3]=='native'
async def one(b,mode,vw,vh):
    pg=await b.new_page(viewport={'width':vw,'height':vh});await pg.add_init_script("navigator.getGamepads=()=>[]" if NATIVE else INIT)
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto(U);await pg.evaluate("OPT.tutAsked=true;OPT.speed=0.15;OPT.tips=true;saveOpt();1");await pg.wait_for_timeout(600)
    P=NativePad(pg) if NATIVE else Pad(pg)
    await P.press('A');await P.press('A');await pg.wait_for_timeout(500)
    for _ in range(9):                                   # pick the mode with LB/RB
        if await pg.evaluate("OPT.tour?'tour':(OPT.mode||'duel')")==mode:break
        await P.press('RB');await pg.wait_for_timeout(250)
    if mode=='puzzle':await P.goto('#start [data-a=pzpick]');await P.press('A');await pg.wait_for_timeout(300)
    for _ in range(6):
        if await pg.evaluate("!!S"):break
        await P.press('START');await pg.wait_for_timeout(1500)
        if (await pg.evaluate(STATE))['ov']:await pg.wait_for_timeout(3000)   # e.g. Ranked matchmaking
    await pg.evaluate("speed=0.15")
    r=await play_match(pg,P,log=lambda *a:None)
    print(f'{mode:7s} {vw}x{vh}{" native" if NATIVE else ""}',r[0],r[1],'fails',len(r[2]),'errs',errs[:2],flush=True)
    for f in r[2][:2]:print('   ',str(f)[:600])
    await pg.close()
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    sz=[tuple(map(int,x.split('x'))) for x in (sys.argv[2] if len(sys.argv)>2 else '1280x800').split(',')]
    jobs=[(m,w,h) for m in sys.argv[1].split(',') for (w,h) in sz]
    for i in range(0,len(jobs),6):await asyncio.gather(*[one(b,*j) for j in jobs[i:i+6]])
asyncio.run(main())
