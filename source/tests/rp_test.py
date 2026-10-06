import asyncio, json, time
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); errs=[]; pg=await b.new_page(viewport={'width':1366,'height':800}); pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('file:///mnt/user-data/outputs/spellstorm.html'); await pg.evaluate("localStorage.clear();OPT.tutAsked=true;OPT.mode='duel';saveOpt();1"); await pg.reload()
        await pg.click('[data-a=t_play]'); await pg.evaluate("pickSel.me='derby';pickSel.opp='croh';rnd.me=false;rnd.opp=false;drawSelect();1"); await pg.click('[data-a=launch]'); await pg.evaluate("speed=0.03;window._voids=0;const ov=window.voidFx;window.voidFx=function(...a){_voids++;return ov(...a);};1")
        for i in range(1200):
            if await pg.evaluate("!!(S&&S.over)"): break
            if await pg.evaluate("!!(S&&S.blast&&S.blast.stage==='result')") and await pg.locator('#blast [data-a=ack]').count(): await pg.click('#blast [data-a=ack]')
            k=await pg.evaluate("pending&&pending.req.k")
            if k: await pg.evaluate("(()=>{const r=pending.req;answer(r.k==='play'?S.pl[0].hand.find(c=>!CARDS[c.id].junk)||S.pl[0].hand[0]:r.k==='gain'?(r.optional?-1:(r.slots[0]??'ice')):r.k==='pick'?r.items.slice(0,Math.max(r.min||0,1)):r.k==='yn'?true:r.k==='player'?(r.opps||[1])[0]:0)})()")
            await pg.wait_for_timeout(35)
        final=await pg.evaluate("JSON.stringify({w:S.over&&S.over.winner,why:S.over&&S.over.why,b:S.battle,pl:S.pl.map(P=>[P.hp,P.shards,P.hand.length])})")
        print('match finished:',final,'| VOID effects played during the match:',await pg.evaluate("_voids"))
        await pg.evaluate("speed=1;closeOv();showTitle();1"); await pg.click('[data-a=t_stats]'); await pg.click('#ov [data-a=stab][data-v=hist]'); await pg.click('#ov [data-a=hrow][data-i="0"]'); await pg.click('#ov [data-a=rpplay]'); await pg.wait_for_timeout(1500)
        await pg.click('#rpbar [data-v=end]'); await pg.wait_for_function("RPLAY&&RPLAY.done",timeout=60000); await pg.wait_for_timeout(300)
        end=await pg.evaluate("JSON.stringify({w:S.over&&S.over.winner,why:S.over&&S.over.why,b:S.battle,pl:S.pl.map(P=>[P.hp,P.shards,P.hand.length])})")
        print('replay End:',end,'| identical to the real match:',end==final,'| out of sync:',await pg.evaluate("!!RPLAY.desync"),'| animations restored (speed, sound):',await pg.evaluate("speed===1&&!SFX.mute"))
        await pg.click('#rpbar [data-v=prev]'); await pg.wait_for_timeout(2500); print('Previous from the end → turn',await pg.evaluate("RPLAY.turn"),'| paused',await pg.evaluate("RPLAY.paused"),'| errors',errs[:2])
        t0=time.time(); await pg.click('#rpbar [data-v=start]'); await pg.wait_for_timeout(2500)
        t0=time.time(); await pg.click('#rpbar [data-v=next]'); await pg.wait_for_function("RPLAY.paused&&RPLAY.turn===1&&!RPLAY.ff",timeout=20000); print(f'Next → turn 1 in {time.time()-t0:.2f}s (instant)')
        mine=await pg.evaluate("[...document.querySelectorAll('#hand .card')].map(e=>e.dataset.cid).join(',')"); await pg.click('#rpbar [data-v=view]'); await pg.wait_for_timeout(400)
        theirs=await pg.evaluate("[...document.querySelectorAll('#hand .card')].map(e=>e.dataset.cid).join(',')")
        print('Switch player: bottom hand was',mine,'→ now',theirs,'| Croh’s real hand:',await pg.evaluate("S.pl[1].hand.map(c=>c.id).join(',')"),'| bottom panel name:',await pg.evaluate("document.querySelector('#me .pname').innerText.split('\\n')[0]"))
        await pg.click('#rpbar [data-v=export]'); await pg.wait_for_function("document.querySelector('#ov.show [data-a=mexcopy]')",timeout=60000)
        d=json.loads(await pg.evaluate("EXPORTTXT"))
        print('Export:',round(len(json.dumps(d))/1024),'KB | turns',len(d['turns']),'| log lines',len(d['log']),'| decisions',len(d['replay']['decisions']),'| edition',d['edition'],'| max Croh hand in any turn',max(t['players'][1]['hand'].__len__() for t in d['turns']))
        print('errors:',errs[:3]); await b.close()
asyncio.run(main())
