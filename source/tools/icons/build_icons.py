import json,base64,io,re
from PIL import Image
imgs=json.load(open('/home/claude/imgs.json'));S=json.load(open('/home/claude/icon_spots.json'));G=json.load(open('groups3.json'))
src=open('/home/claude/engine.js').read()+open('/home/claude/engine2.js').read()
def body(cid):
    m=re.search(r"\n  "+re.escape(cid)+r": \{([^\n]*(?:\n    [^\n]*)*)",src);return m.group(1) if m else ''
# one clean picture of each icon type, cropped from the card art
REP={'power':0,'mana':3,'gain':7,'draw':8,'ult':2,'disc':4,'init':16,'fire':11,'water':12,'earth':14,'wiz':5}
pics={}
for t,gi in REP.items():
    m=G[gi]['members'][len(G[gi]['members'])//2];b=m['box'];d=imgs[m['card']]
    im=Image.open(io.BytesIO(base64.b64decode(d.split(',',1)[1]))).convert('RGB').crop(tuple(b));im.thumbnail((44,44))
    o=io.BytesIO();im.save(o,'PNG',optimize=True);pics[t]='data:image/png;base64,'+base64.b64encode(o.getvalue()).decode()
# legend: detected icons + what the card's rules actually do
leg={}
for cid in set(S)|{k for k in imgs if not k.startswith(('tk_','wz_','w_','tier','derby_','scene','cover','logo','back','cwheel','rb_'))}:
    ts=[s[4] for s in S.get(cid,[])];b=body(cid)
    if re.search(r'Init\(|gainInit|\.init\b|initiative',b,re.I):ts.append('init')
    if re.search(r'\.mana\(|gainMana',b):ts.append('mana')
    if re.search(r'\.power\(|gainPower',b):ts.append('power')
    if re.search(r'gainCard\(',b):ts.append('gain')
    if re.search(r'\.draw\(',b):ts.append('draw')
    order=['power','mana','gain','draw','init','ult','disc','fire','water','earth'];u=[t for t in order if t in ts]
    if u:leg[cid]=u
out={'spots':S,'leg':leg,'pics':pics}
s=json.dumps(out,separators=(',',':'));open('/home/claude/icondata.json','w').write(s)
print('spots on',len(S),'cards | legends',len(leg),'| pictures',len(pics),'| data',round(len(s)/1024),'KB')
