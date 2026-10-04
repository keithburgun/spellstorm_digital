import json,base64,io,numpy as np
from PIL import Image
from scipy.signal import fftconvolve
imgs=json.load(open('/home/claude/imgs.json'));G=json.load(open('groups3.json'))
SKIP=('tk_','wz_','w_','tier','derby_','scene','cover','logo','back','cwheel','rb_')
cards=[k for k in imgs if not k.startswith(SKIP)]
def load(k): d=imgs[k]; return np.asarray(Image.open(io.BytesIO(base64.b64decode(d.split(',',1)[1]))).convert('RGB')).astype(np.float32)/255
REF={0:'power',3:'mana',7:'gain',8:'draw',2:'ult',4:'disc',16:'init',22:'init',23:'init',24:'init',36:'init',43:'init',11:'fire',12:'water',14:'earth'}
# stencils: up to 4 clean examples per type (median-sized members)
T=[]
for gi,t in REF.items():
    ms=G[gi]['members'];ms=sorted(ms,key=lambda m:(m['box'][3]-m['box'][1]));mid=ms[len(ms)//4:len(ms)//4+4] or ms[:4]
    for m in mid:
        b=m['box'];a=load(m['card'])[b[1]:b[3],b[0]:b[2]]
        if a.shape[0]>=14 and a.shape[1]>=14:T.append((t,a))
print('stencils:',len(T))
def ncc(I,t):
    th,tw=t.shape[:2];out=np.zeros((I.shape[0]-th+1,I.shape[1]-tw+1),np.float32)
    for c in range(3):
        x=I[...,c];k=t[...,c]-t[...,c].mean();kn=np.sqrt((k**2).sum())+1e-6
        num=fftconvolve(x,k[::-1,::-1],mode='valid')
        s=fftconvolve(x,np.ones_like(k),mode='valid');s2=fftconvolve(x*x,np.ones_like(k),mode='valid')
        var=s2-s*s/k.size;flat=var<(0.035**2)*k.size;var=np.maximum(var,1e-6);v=num/(np.sqrt(var)*kn);v[flat]=0;out+=v   # flat areas can't match anything
    return out/3
H,W=672,480;spots={};stats={}
for k in cards:
    a=load(k);y0=int(H*.62);I=a[y0:,:]
    cand=[]
    for t,tp in T:
        if tp.shape[0]>I.shape[0] or tp.shape[1]>I.shape[1]:continue
        r=ncc(I,tp);th,tw=tp.shape[:2]
        thr={'init':.60,'fire':.72,'water':.76,'earth':.76}.get(t,.72)
        ys,xs=np.where(r>thr)
        for yy,xx in zip(ys,xs):cand.append((float(r[yy,xx]),t,xx,y0+yy,xx+tw,y0+yy+th))
    TB=a[int(H*.66):int(H*.95),int(W*.06):int(W*.94)].reshape(-1,3);bg=np.median(TB,axis=0)
    def on_cream(x0,y0_,x1,y1,pad=4):               # a rules-text icon sits on the cream text background
        X0,Y0,X1,Y1=max(0,x0-pad),max(0,y0_-pad),min(W,x1+pad),min(H,y1+pad);ring=np.concatenate([a[Y0:y0_,X0:X1].reshape(-1,3),a[y1:Y1,X0:X1].reshape(-1,3),a[Y0:Y1,X0:x0].reshape(-1,3),a[Y0:Y1,x1:X1].reshape(-1,3)])
        if not len(ring):return False
        return (np.abs(ring-bg).sum(1)<.18).mean()>.45
    cand=[c for c in cand if on_cream(c[2],c[3],c[4],c[5])]
    cand.sort(reverse=True);keep=[]
    for c in cand:
        s,t,x0,y0_,x1,y1=c
        if x0>W*.80 and y0_>H*.86:continue                       # the Tier / wizard corner has its own fixed spot
        ok=True
        for d in keep:
            ix=max(0,min(x1,d[4])-max(x0,d[2]));iy=max(0,min(y1,d[5])-max(y0_,d[3]))
            if ix*iy>.25*min((x1-x0)*(y1-y0_),(d[4]-d[2])*(d[5]-d[3])):ok=False;break
        if ok:keep.append(c)
    for s,t,x0,y0_,x1,y1 in keep:
        stats[t]=stats.get(t,0)+1;spots.setdefault(k,[]).append([round(x0/W*100,1),round(y0_/H*100,1),round((x1-x0)/W*100,1),round((y1-y0_)/H*100,1),t])
print('icons placed by type:',dict(sorted(stats.items(),key=lambda x:-x[1])),'| cards with icons:',len(spots),'| total',sum(stats.values()))
json.dump(spots,open('/home/claude/icon_spots_t.json','w'))
