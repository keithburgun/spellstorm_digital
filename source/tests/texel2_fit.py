import json,glob,numpy as np,sys
from scipy.optimize import minimize
G=[json.loads(l) for f in glob.glob('tx2_*.jsonl') for l in open(f) if l.strip()]
BASE=["shard","hp","low","mana","manaX","tier","power","hand","deck","junk","junkH","init","doom","energy","research","trap","chem","blastL","blastE","close","low2"]
NEW=[k for k in G[0]['pos'][0][0] if k not in BASE]
rng=np.random.default_rng(1);idx=rng.permutation(len(G));cut=int(.75*len(G));tr=set(idx[:cut].tolist())
def build(keys,sel,filt=None):
    X=[];Y=[]
    for gi,g in enumerate(G):
        if (gi in tr)!=sel:continue
        if filt and not filt(g):continue
        for f0,f1 in g['pos']:
            X.append([f0[k] for k in keys]);Y.append(1.0 if g['w']==0 else 0.0)
    return np.array(X,float),np.array(Y,float)
def fit(keys,filt=None):
    Xtr,Ytr=build(keys,True,filt);Xte,Yte=build(keys,False,filt);sd=np.maximum(Xtr.std(0),1e-6);Xs=Xtr/sd;Xts=Xte/sd
    def ll(w,X,Y):z=np.clip(X@w,-30,30);p=1/(1+np.exp(-z));p=np.clip(p,1e-9,1-1e-9);return -np.mean(Y*np.log(p)+(1-Y)*np.log(1-p))
    r=minimize(lambda w:ll(w,Xs,Ytr)+1e-3*np.sum(w*w),np.zeros(len(keys)),method='L-BFGS-B')
    return ll(r.x,Xts,Yte),dict(zip(keys,r.x/sd)),len(Ytr)
print('games',len(G))
b,_,n=fit(BASE);print(f'base features: held-out loss {b:.5f} (train positions {n})')
for k in NEW:
    l,w,_=fit(BASE+[k]);print(f'+ {k:8s}: {l:.5f}  ({(b-l)*1e4:+.1f} e-4)  weight {w[k]:+.4f} vs hp weight {w["hp"]:+.4f}')
l,w,_=fit(BASE+NEW);print(f'+ all new: {l:.5f} ({(b-l)*1e4:+.1f} e-4)');print({k:round(w[k],4) for k in NEW+['hp','shard','low','low2']})
for wz in ['bunny','croh','oren']:
    f=lambda g,wz=wz:wz in (g['a'],g['b'])
    b2,_,_=fit(BASE,f);l2,w2,_=fit(BASE+['dng2.5','race3'],f);print(f'{wz} games: base {b2:.5f} → +dng/race {l2:.5f} ({(b2-l2)*1e4:+.1f}e-4) w dng {w2["dng2.5"]:+.3f} race {w2["race3"]:+.3f}')
print('--- health as a fraction instead of raw points')
B2=[k for k in BASE if k!='hp']+['hpFrac']
l,w,_=fit(B2);b,wb,_=fit(BASE);print(f'base {b:.5f} → hpFrac instead of hp {l:.5f}; eval-units per full-health fraction ≈ {w["hpFrac"]/w["shard"]*14:.1f} (shard=14); low {w["low"]/w["shard"]*14:.1f} low2 {w["low2"]/w["shard"]*14:.1f}')
print('base model in eval units: hp per point',round(wb['hp']/wb['shard']*14,2),'low',round(wb['low']/wb['shard']*14,2))
