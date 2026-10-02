import asyncio, json
from playwright.async_api import async_playwright
LINES=json.load(open('pz_lines.json'))
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); errs=[]; pg=await b.new_page(viewport={'width':1366,'height':768}); pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('file://'+__import__('os').path.abspath(__import__('os').path.join(__import__('os').path.dirname(__file__),'..','dist','spellstorm.html'))); await pg.evaluate("OPT.tutAsked=true;saveOpt();1")
        allok=True
        for n in range(1,11):
            line=LINES[str(n)]
            await pg.evaluate(f"closeOv();const P=loadProf();P.pz={n-1};saveProf(P);puzzleLaunch({n});1"); await pg.wait_for_timeout(600); await pg.evaluate("closeOv();1")
            k=0; mismatch=None
            for i in range(400):
                if await pg.evaluate("PZEND"): break
                await pg.wait_for_timeout(100)
                kind=await pg.evaluate("pending&&pending.req.k")
                if not kind: continue
                if k>=len(line): mismatch='ran out of moves'; break
                d=line[k]; k+=1
                if d['k']!=kind: mismatch=f'expected {d["k"]}, game asked {kind}'; break
                o=json.dumps(d['o'])
                await pg.evaluate(f"""(()=>{{closeOv();const r=pending.req,o={o};
                  if(r.k==='play')answer(S.pl[0].hand.find(c=>c.id===o)||null);
                  else if(r.k==='gain')answer(typeof o==='string'&&o[0]==='s'?+o.slice(1):o);
                  else if(r.k==='pick')answer(o.map(i=>r.items[i]));
                  else answer(o);}})()""")
            await pg.wait_for_timeout(800)
            res=await pg.evaluate("(document.querySelector('#sheet h2')||{}).innerText||''")
            ok=res.startswith('Solved'); allok&=ok
            print(f'#{n:<2} {"✓" if ok else "✗"} {res}{" ("+mismatch+")" if mismatch else ""}')
        print('ALL TEN SOLVED IN THE BROWSER:',allok,'| errors:',errs[:3]); await b.close()
asyncio.run(main())
