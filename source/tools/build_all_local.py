# Builds (1) the web artifact and (2) the app page (fonts embedded + Android hooks) from the template.
def daily_and_puzzles():
    import json as _j
    blocks=[];cur={}
    for line in open('daily_challenges.txt',encoding='utf-8'):
        s=line.strip()
        if s=='---':
            if cur: blocks.append(cur)
            cur={};continue
        if not s or s.startswith('#') or ':' not in s: continue
        k,v=s.split(':',1);cur[k.strip()]=v.strip()
    if cur: blocks.append(cur)
    return 'const DAILY = '+_j.dumps(blocks,ensure_ascii=False)+';\nconst PUZZLES = '+open('puzzles.json',encoding='utf-8').read()+';\n'
import json,base64,re,os
t=open('template.html').read(); e2=open('engine2.js').read(); i=e2.index('//EXPORTS')
eng=open('engine.js').read()+'\n'+e2[:i]+'\n'+open('engine3.js').read()+'\n'+open('engine4.js').read()+'\n'+open('engine5.js').read()+'\n'+open('engine6.js').read()+'\n'+open('engine7.js').read()+'\n'+open('engine8.js').read()+'\n'+open('engine9.js').read()+'\n'+open('engine10.js').read()+'\n'+daily_and_puzzles()
corp=open('corporata.css').read()
import datetime
from zoneinfo import ZoneInfo
now=datetime.datetime.now(ZoneInfo('America/New_York'))
stamp='web '+now.strftime('%Y-%m-%d %H:%M ')+now.tzname()
web=t.replace('/*ENGINE*/',eng).replace('/*IMGS*/',open('imgs.json').read()).replace('/*CORPORATA*/',corp)
app_base=web.replace('__APP_VERSION__','')
web=web.replace('__APP_VERSION__',stamp)
open('/mnt/user-data/outputs/spellstorm.html','w').write(web)
fs='apk/node_modules/@fontsource/'
def ff(fam,path,w): return f"@font-face{{font-family:'{fam}';font-style:normal;font-weight:{w};font-display:swap;src:url(data:font/woff2;base64,{base64.b64encode(open(path,'rb').read()).decode()}) format('woff2')}}"
fonts=ff('Atkinson Hyperlegible',fs+'atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff2',400)+ff('Atkinson Hyperlegible',fs+'atkinson-hyperlegible/files/atkinson-hyperlegible-latin-700-normal.woff2',700)
app=re.sub(r'<link rel="preconnect"[^>]*>\s*','',app_base)
app=re.sub(r'<link href="https://fonts.googleapis.com[^>]*>',f'<style>{fonts}</style>',app)
native=open('native_hooks.html').read()
app=app.replace('</body>',native+'\n</body>',1)
assert 'fonts.googleapis' not in app and 'exitApp' in app
open('pkg/www/index.html','w').write(app)
# (3) itch.io / any website: the app page (fonts embedded, no outside requests) with claude.ai-only online play switched off
itch=app.replace("onlInApp=()=>!!window.Capacitor||/[?&]v=/.test(location.search);","onlInApp=()=>true;   /* standalone web build: online play needs claude.ai */",1)
assert 'onlInApp=()=>true;' in itch
itch=itch.replace('</body>','<script>try{setVer("itch "+'+repr(stamp.replace('web ',''))+');}catch(e){}</script>\n</body>',1)
import os,zipfile
# (4) standalone web WITH online play: peer-to-peer (PeerJS embedded), invite links read from the page's own address
peerjs=open('p2p/node_modules/peerjs/dist/peerjs.min.js').read()
onl=app.replace("onlInApp=()=>!!window.Capacitor||/[?&]v=/.test(location.search);","onlInApp=()=>false;",1)
assert 'onlInApp=()=>false;' in onl
onl=onl.replace('</head>','<script>window.SS_P2P=true;</script><script>'+peerjs+'</script>\n</head>',1)
onl=onl.replace('</body>','<script>try{setVer("web "+'+repr(stamp.replace('web ',''))+');}catch(e){}</script>\n</body>',1)
os.makedirs('pkg_online',exist_ok=True);open('pkg_online/index.html','w').write(onl)
with zipfile.ZipFile('/mnt/user-data/outputs/spellstorm-web-online.zip','w',zipfile.ZIP_DEFLATED,compresslevel=9) as z: z.write('pkg_online/index.html','index.html')
os.makedirs('pkg_itch',exist_ok=True);open('pkg_itch/index.html','w').write(itch)
with zipfile.ZipFile('/mnt/user-data/outputs/spellstorm-itch.zip','w',zipfile.ZIP_DEFLATED,compresslevel=9) as z: z.write('pkg_itch/index.html','index.html')
for n,s in [('web',web),('app',app)]:
    open(f'chk_{n}.js','w').write(re.findall(r'<script>(.*?)</script>',s,re.S)[1])
print('web',round(len(web)/1e6,2),'MB | app',round(len(app)/1e6,2),'MB')
