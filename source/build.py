#!/usr/bin/env python3
"""Build Spellstorm from source.

    python3 build.py

Produces:
  dist/spellstorm.html   the web version (one self-contained file; loads Atkinson Hyperlegible from Google Fonts as a fallback font)
  ../www/index.html      the app version used by the Android and Windows builds (all fonts embedded, Android hooks added)
  tests/eng_all.js       the rules engine as a Node module, for the automated tests
Needs only Python 3.9+ (no packages).
"""
import base64, datetime, json, os, re
from zoneinfo import ZoneInfo
H = os.path.dirname(os.path.abspath(__file__))
rd = lambda f: open(os.path.join(H, f), encoding='utf-8').read()
def wr(f, s):
    p = os.path.join(H, f); os.makedirs(os.path.dirname(p), exist_ok=True); open(p, 'w', encoding='utf-8').write(s)

def daily_and_puzzles():
    blocks, cur = [], {}
    for line in rd('daily_challenges.txt').splitlines():
        t = line.strip()
        if t == '---':
            if cur: blocks.append(cur)
            cur = {}; continue
        if not t or t.startswith('#') or ':' not in t: continue
        k, v = t.split(':', 1); cur[k.strip()] = v.strip()
    if cur: blocks.append(cur)
    return 'const DAILY = ' + json.dumps(blocks, ensure_ascii=False) + ';\nconst PUZZLES = ' + rd('puzzles.json') + ';\n'

e2 = rd('engine2.js'); e2 = e2[:e2.index('//EXPORTS')]          # engine2 ends with Node-only test exports
engine = '\n'.join([rd('engine.js'), e2, rd('engine3.js'), rd('engine4.js'), rd('engine5.js'), rd('engine6.js'), rd('engine7.js'), rd('engine8.js'), rd('engine9.js'), rd('engine10.js'), rd('engine11.js'), rd('engine12.js'), daily_and_puzzles()])
page = rd('template.html').replace('/*ENGINE*/', engine).replace('/*IMGS*/', rd('imgs.json')).replace('/*MANUAL*/', rd('manual.json')).replace('/*CORPORATA*/', rd('corporata.css')).replace('/*PAD*/', rd('pad.js'))

now = datetime.datetime.now(ZoneInfo('America/New_York'))
web = page.replace('__APP_VERSION__', 'web ' + now.strftime('%Y-%m-%d %H:%M ') + now.tzname())
wr('dist/spellstorm.html', web)

def ff(fam, path, w):
    b = base64.b64encode(open(os.path.join(H, path), 'rb').read()).decode()
    return f"@font-face{{font-family:'{fam}';font-style:normal;font-weight:{w};font-display:swap;src:url(data:font/woff2;base64,{b}) format('woff2')}}"
fonts = ff('Atkinson Hyperlegible', 'fonts/atkinson-hyperlegible-latin-400-normal.woff2', 400) + ff('Atkinson Hyperlegible', 'fonts/atkinson-hyperlegible-latin-700-normal.woff2', 700)
app = page.replace('__APP_VERSION__', '')                       # the apps fill in their own version number at runtime
app = re.sub(r'<link rel="preconnect"[^>]*>\s*', '', app)
app = re.sub(r'<link href="https://fonts.googleapis.com[^>]*>', f'<style>{fonts}</style>', app)
app = app.replace('</body>', rd('native_hooks.html') + '\n</body>', 1)
app = app.replace('</head>', '<script>window.SS_SYNC=true;</script>\n</head>', 1)   # account sync: apps, itch.io and your own site (not claude.ai)
assert 'fonts.googleapis' not in app and 'exitApp' in app
wr('../www/index.html', app)

# ---- web packages for itch.io / your own website (both: fonts embedded, nothing loaded from the internet, account sync on) ----
import zipfile
def webpkg(page, label, zipname):
    ver = os.environ.get('SPELLSTORM_VERSION')   # set by the release build: show the same version number as the apps
    page = page.replace('</body>', '<script>try{setVer(' + json.dumps('v' + ver if ver else label + ' ' + now.strftime('%Y-%m-%d %H:%M ') + now.tzname()) + ');}catch(e){}</script>\n</body>', 1)
    os.makedirs(os.path.join(H, 'dist'), exist_ok=True)
    with zipfile.ZipFile(os.path.join(H, 'dist', zipname), 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z: z.writestr('index.html', page)
    return page
DETECT = "const onlInApp=()=>!!window.Capacitor||/[?&]v=/.test(location.search);"
assert DETECT in app
itch = webpkg(app.replace(DETECT, "const onlInApp=()=>true;   /* offline web package: no online play */", 1), 'itch', 'spellstorm-itch.zip')
online = app.replace(DETECT, "const onlInApp=()=>false;", 1).replace('</head>', '<script>window.SS_P2P=true;</script><script>' + rd('vendor/peerjs.min.js') + '</script>\n</head>', 1)
online = webpkg(online, 'web', 'spellstorm-web-online.zip')
print(f'zip  dist/spellstorm-itch.zip, dist/spellstorm-web-online.zip')

wr('tests/eng_all.js', engine + '\nmodule.exports={WIZ,CARDS,Game,newState,newStateN,newStateRB,newStateCoop,newState2v2,cpuDecideX,aiChoosePlay,ultDecide,GameOver,RANK_ELO,eloDelta,matchRank,genUsername,pickOppWizard,BOTS,pickBot,botWizard,puzzleState,puzzleJudge,seedRandom,unseedRandom,MXMODE,matrixAnalyze,planScores,PLANS,botBaseElo,applyEdition,wizInfo,WIZ2,JOURNAL2,ED2,determinize,evalAI,SIM_IO,ROLL_IO,cardVal,EVW0,simDepth2,THREAT,THREAT_W,threatEval,threatPlan,roundsToKill,roundsToShards,rateOf,setThreat:v=>{THREAT_ON=v;},GAINRO,rolloutGain,fastPlay,seededRNG,BEATS,DRAFTV,draftVal,PLAYRO,ULTRO,MIDRO};\n')
print(f'web  dist/spellstorm.html  {len(web)/1e6:.2f} MB\napp  ../www/index.html      {len(app)/1e6:.2f} MB\ntest tests/eng_all.js')
