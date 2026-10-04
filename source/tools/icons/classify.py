import json,numpy as np
exec(open('detect3.py').read().split('# merge duplicates')[0])   # reuse the detector (fills `found`)
found.sort(key=lambda f:(f['card'],f['box']))
ded=[]
for f in found:
    if ded and ded[-1]['card']==f['card']:
        a_,b_=ded[-1]['box'],f['box']
        if not(b_[0]>=a_[2] or b_[2]<=a_[0] or b_[1]>=a_[3] or b_[3]<=a_[1]):continue
    ded.append(f)
found=ded
G=json.load(open('groups3.json'))
# reference icons: the groups identified by eye (group index -> type)
REF={0:'power',13:'power',3:'mana',7:'gain',8:'draw',18:'draw',2:'ult',4:'disc',16:'init',22:'init',23:'init',24:'init',11:'fire',12:'water',14:'earth'}
key=lambda m:(m['card'],tuple(m['box']))
feat={key(f):f for f in found}
refs=[]
for gi,t in REF.items():
    for m in G[gi]['members']:
        f=feat.get((m['card'],tuple(m['box'])))
        if f is not None: refs.append((t,f['f'],f['ar']))
print('reference examples:',len(refs))
H,W=672,480
spots={};stats={}
for f in found:
    x0,y0,x1,y1=f['box']
    if x0>W*.80 and y0>H*.86: continue                              # the Tier / wizard corner has its own fixed spot
    best=min(((np.linalg.norm(rf-f['f'])/np.sqrt(len(rf)),t) for t,rf,ar in refs if abs(ar-f['ar'])<.45),default=(9,None))
    if best[0]>.60: continue
    t=best[1];stats[t]=stats.get(t,0)+1
    spots.setdefault(f['card'],[]).append([round(x0/W*100,1),round(y0/H*100,1),round((x1-x0)/W*100,1),round((y1-y0)/H*100,1),t])
print('icons placed by type:',dict(sorted(stats.items(),key=lambda x:-x[1])),'| cards with icons:',len(spots))
json.dump(spots,open('/home/claude/icon_spots_s.json','w'))
