# Full Texel refit (eval units) with the new health-fraction and danger features added. Prints a JSON candidate.
import json,glob,numpy as np,sys
from scipy.optimize import minimize
G=[json.loads(l) for f in glob.glob('tx2_*.jsonl') for l in open(f) if l.strip()]
W0={"shard":14,"hp":4,"low":6,"mana":1.6,"manaX":0.4,"tier":16,"power":2.4,"hand":3,"deck":0.35,"junk":4,"junkH":2,"init":3,"doom":5,"energy":2,"research":7,"trap":4,"chem":0.4,"blast":14,"blastE":0.45,"close":9,"low2":7}
K=["shard","hp","low","mana","manaX","tier","power","hand","deck","junk","junkH","init","doom","energy","research","trap","chem","blastL","blastE","close","low2"]
NEW=sys.argv[2].split(',') if len(sys.argv)>2 else ['hpFrac','dng4']
w0=np.array([W0['blast'] if k=='blastL' else W0['blast']*W0['blastE'] if k=='blastE' else W0[k] for k in K]+[0.0]*len(NEW))
KK=K+NEW
rng=np.random.default_rng(2);idx=rng.permutation(len(G));cut=int(.8*len(G));tr=set(idx[:cut].tolist())
def build(sel):
    X=[];Y=[]
    for gi,g in enumerate(G):
        if (gi in tr)!=sel:continue
        for f0,f1 in g['pos']:
            X.append([f0[k] for k in KK]);Y.append(1.0 if g['w']==0 else 0.0)
    return np.array(X,float),np.array(Y,float)
Xtr,Ytr=build(True);Xte,Yte=build(False)
def ll(w,X,Y,s):z=np.clip(s*(X@w),-30,30);p=1/(1+np.exp(-z));p=np.clip(p,1e-9,1-1e-9);return -np.mean(Y*np.log(p)+(1-Y)*np.log(1-p))
sc=minimize(lambda s:ll(w0,Xtr,Ytr,s[0]),[0.01],bounds=[(1e-5,1)]).x[0]
sd=np.maximum(Xtr.std(0),1e-6);lam=float(sys.argv[1]) if len(sys.argv)>1 else 0.002
res=minimize(lambda w:ll(w,Xtr,Ytr,sc)+lam*np.sum(((w-w0)*sd*sc)**2),w0.copy(),method='L-BFGS-B',bounds=[(0,None) if k not in NEW else (None,None) for k in KK])
w=res.x
print(f'held-out loss: current {ll(w0,Xte,Yte,sc):.5f} → refit {ll(w,Xte,Yte,sc):.5f} | lam {lam}',file=sys.stderr)
ev={k:round(float(v),3) for k,v in zip(KK,w)}
evw=dict(W0)
for k in K:
    if k=='blastL':evw['blast']=ev[k]
    elif k=='blastE':pass
    else:evw[k]=ev[k]
evw['blastE']=round(ev['blastE']/max(ev['blastL'],1e-6),3)
print(json.dumps({'evw':evw,'new':{k:ev[k] for k in NEW}}))
