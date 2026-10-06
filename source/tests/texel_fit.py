import json,numpy as np
from scipy.optimize import minimize
W0={"shard":14,"hp":4,"low":6,"mana":1.6,"manaX":0.4,"tier":16,"power":2.4,"hand":3,"deck":0.35,"junk":4,"junkH":2,"init":3,"doom":5,"energy":2,"research":7,"trap":4,"chem":0.4,"blast":14,"blastE":0.45,"close":9,"low2":7}
K=["shard","hp","low","mana","manaX","tier","power","hand","deck","junk","junkH","init","doom","energy","research","trap","chem","blastL","blastE","close","low2"]
w0=np.array([W0['blast'] if k=='blastL' else W0['blast']*W0['blastE'] if k=='blastE' else W0[k] for k in K])
G=[json.loads(l) for l in open('/home/claude/texel.jsonl')]
rng=np.random.default_rng(1);idx=rng.permutation(len(G));cut=int(.8*len(G));tr=set(idx[:cut].tolist())
def build(sel):
    X=[];Y=[]
    for gi,g in enumerate(G):
        if (gi in tr)!=sel:continue
        for f0,f1 in g['pos']:
            X.append([f0[k] for k in K]);Y.append(1.0 if g['w']==0 else 0.0)
            X.append([f1[k] for k in K]);Y.append(1.0 if g['w']==1 else 0.0)
    return np.array(X,float),np.array(Y,float)
Xtr,Ytr=build(True);Xte,Yte=build(False)
def ll(w,X,Y,s):z=np.clip(s*(X@w),-30,30);p=1/(1+np.exp(-z));p=np.clip(p,1e-9,1-1e-9);return -np.mean(Y*np.log(p)+(1-Y)*np.log(1-p))
r=minimize(lambda s:ll(w0,Xtr,Ytr,s[0]),[0.01],bounds=[(1e-5,1)]);sc=r.x[0]
sd=np.maximum(Xtr.std(0),1e-6)
lam=float(__import__('sys').argv[1]) if len(__import__('sys').argv)>1 else 0.002
obj=lambda w:ll(w,Xtr,Ytr,sc)+lam*np.sum(((w-w0)*sd*sc)**2)
res=minimize(obj,w0.copy(),method='L-BFGS-B',bounds=[(0,None)]*len(K))
w=res.x
print(f'samples: train {len(Ytr)}, held-out {len(Yte)} | scale {sc:.4f}')
print(f'prediction loss on HELD-OUT games: default {ll(w0,Xte,Yte,sc):.4f} → fitted {ll(w,Xte,Yte,sc):.4f}  (lower is better)')
print(f'prediction loss on training games: default {ll(w0,Xtr,Ytr,sc):.4f} → fitted {ll(w,Xtr,Ytr,sc):.4f}')
out=dict(W0);
for k,v in zip(K,w):
    if k=='blastL':out['blast']=float(v)
    elif k=='blastE':pass
    else:out[k]=float(v)
out['blastE']=float(w[K.index('blastE')]/max(1e-6,w[K.index('blastL')]))
print('weights (default → fitted):',', '.join(f"{k} {W0[k]}→{out[k]:.2f}" for k in W0))
json.dump(out,open('/home/claude/evw_texel.json','w'))
