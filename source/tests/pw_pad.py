# Controller support: drive the game with a simulated gamepad only (no mouse), at Steam Deck size (1280x800).
#   python3 tests/pw_pad.py [matches]       (serve ../www on :8124 first)
import asyncio,sys,json
from playwright.async_api import async_playwright
U='http://127.0.0.1:8124/index.html'
INIT="""window.__gp={b:Array(17).fill(0),ax:[0,0,0,0],id:'Xbox 360 Controller (XInput STANDARD GAMEPAD)'};
navigator.getGamepads=()=>[{id:__gp.id,index:0,connected:true,mapping:'standard',timestamp:performance.now(),buttons:__gp.b.map(v=>({pressed:!!v,value:v,touched:!!v})),axes:__gp.ax}];"""
B={'A':0,'B':1,'X':2,'Y':3,'LB':4,'RB':5,'LT':6,'RT':7,'SEL':8,'START':9,'U':12,'D':13,'L':14,'R':15}
class Pad:
    def __init__(s,pg):s.pg=pg
    async def press(s,k,hold=70):
        await s.pg.evaluate(f"__gp.b[{B[k]}]=1");await s.pg.wait_for_timeout(hold);await s.pg.evaluate(f"__gp.b[{B[k]}]=0");await s.pg.wait_for_timeout(70)
    async def st(s):return await s.pg.evaluate("SSPAD.state()")
    async def goto(s,sel,tries=30):
        """Move the highlight onto the element matching sel using only the D-pad. Returns True if reached."""
        last=None;stuck=0;path=[]
        for _ in range(tries):
            r=await s.pg.evaluate("""sel=>{const t=[...document.querySelectorAll(sel)].find(e=>{const r=e.getBoundingClientRect();return r.width>3&&r.height>3});const c=document.querySelector('.padf');
              if(!t)return {none:1};if(c&&(c===t||c.contains(t)||t.contains(c)||(t.closest('label')===c)))return {ok:1};if(!c)return {nocur:1};
              const a=c.getBoundingClientRect(),b=t.getBoundingClientRect();return {dx:(b.left+b.width/2)-(a.left+a.width/2),dy:(b.top+b.height/2)-(a.top+a.height/2),k:c.outerHTML.slice(0,60)+Math.round(a.left)+','+Math.round(a.top)}}""",sel)
            if r.get('ok'):return True
            if r.get('none'):return False
            if r.get('nocur'):await s.press('D');continue
            dx,dy=r['dx'],r['dy']
            if r['k']==last:stuck+=1
            else:stuck=0
            last=r['k'];path.append(r['k'][-12:]+('h' if abs(dx)>abs(dy) else 'v'))
            horiz=abs(dx)>abs(dy)
            if path.count(path[-1])>1:horiz=not horiz   # been here before: try the other axis
            if stuck==1:horiz=not horiz
            if stuck>=2:
                s.why=await s.pg.evaluate('SSPAD.why',sel)
                return False
            await s.press(('R' if dx>0 else 'L') if horiz else ('D' if dy>0 else 'U'))
        s.why=('tries',path,await s.pg.evaluate('SSPAD.why',sel))
        return False

STATE="""()=>{const ov=document.getElementById('ov').classList.contains('show'),sh=document.getElementById('sheet');let r=null;try{r=pending&&pending.req}catch(e){}
 const has=s=>!!document.querySelector(s);return {ov,again:ov&&has('#sheet [data-a=again],#sheet [data-a=restart],#sheet [data-a=pzgo]'),tog:ov&&has('#sheet [data-a=tog]'),
 k:r&&r.k,min:r&&r.min,over:!!(S&&S.over),prompt:[...document.querySelectorAll('#prompt [data-a]:not([disabled]):not([data-a=tip]),#coach [data-a]')].filter(e=>e.getBoundingClientRect().width>3).map(e=>e.dataset.a),
 modal:[...document.querySelectorAll('#blast.show [data-a],#potov.show [data-a]')].map(e=>e.dataset.a),sheetA:ov?[...sh.querySelectorAll('[data-a]:not([disabled])')].map(e=>e.dataset.a):[]}}"""
async def play_match(pg,P,log=print,maxsteps=900,shots=None):
    """Play one whole match with the controller only. Returns (result, steps, failures).
    A failure is a decision the D-pad could not reach the right button for, three tries running."""
    fails=[];steps=0;miss=0
    async def go(sel):
        nonlocal miss
        if await P.goto(sel):miss=0;await P.press('A');return True
        miss+=1;await pg.wait_for_timeout(300);return False
    while steps<maxsteps:
        steps+=1;s=await pg.evaluate(STATE)
        if steps%50==0:log('step',steps,s['k'],s['prompt'][:3],s['modal'],'ov' if s['ov'] else '',await pg.evaluate('S&&[S.battle,S.round]'))
        if s['again']:return 'over',steps,fails
        if s['ov']:
            if s['tog']:
                for i in range(max(1,s['min'] or 0)):
                    await go(f'#sheet [data-a=tog][data-i="{i}"]')
                await go('#sheet [data-a=pickok]:not([disabled])')
            elif any(a in s['sheetA'] for a in ('trappick','sp','ans')):
                a=next(a for a in ('trappick','sp','ans') if a in s['sheetA']);await go(f'#sheet [data-a={a}]:not([disabled])')
            else:await P.press('B')
        elif s['modal']:
            a=s['modal'][0];await go(f'#blast.show [data-a={a}],#potov.show [data-a={a}]')
        elif s['k']=='play':await go('#hand .card.can')
        elif s['k']=='gain' and await pg.evaluate("!!document.querySelector('#cloud .card.elig')"):await go('#cloud .card.elig')
        elif s['prompt']:
            a=s['prompt'][0];await go(f'#prompt [data-a={a}]:not([disabled]),#coach [data-a={a}]')
        else:await pg.wait_for_timeout(250)
        if miss>=3:
            fails.append((s,getattr(P,'why',None)));miss=0
            if shots:await pg.screenshot(path=f'{shots}/fail{len(fails)}.png')
            if len(fails)>5:return 'stuck',steps,fails
    return 'timeout',steps,fails

NB={'A':'A','B':'B','X':'X','Y':'Y','LB':'LB','RB':'RB','LT':'LT','RT':'RT','SEL':'SELECT','START':'START','U':'UP','D':'DOWN','L':'LEFT','R':'RIGHT'}
class NativePad(Pad):
    """The Android app's path: MainActivity forwards controller keys (and the D-pad as a hat axis) via SSPAD.nat*."""
    hat=True
    async def press(s,k,hold=70):
        if s.hat and k in 'UDLR' and len(k)==1:
            hx,hy={'U':(0,-1),'D':(0,1),'L':(-1,0),'R':(1,0)}[k]
            await s.pg.evaluate(f"SSPAD.natAxes(0,0,0,0,{hx},{hy})");await s.pg.wait_for_timeout(hold);await s.pg.evaluate("SSPAD.natAxes(0,0,0,0,0,0)")
        else:
            await s.pg.evaluate(f"SSPAD.nat('{NB[k]}',1)");await s.pg.wait_for_timeout(hold);await s.pg.evaluate(f"SSPAD.nat('{NB[k]}',0)")
        await s.pg.wait_for_timeout(70)
