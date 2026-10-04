import json,base64,io,numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
imgs=json.load(open('/home/claude/imgs.json'))
SKIP=('tk_','wz_','w_','tier','derby_','scene','cover','logo','back','cwheel')
cards=[k for k in imgs if not k.startswith(SKIP) and not k.startswith('rb_')]
def load(k): d=imgs[k]; return np.asarray(Image.open(io.BytesIO(base64.b64decode(d.split(',',1)[1]))).convert('RGB')).astype(np.int16)
found=[]
for k in cards:
    a=load(k);H,W,_=a.shape
    y0,y1,x0,x1=int(H*.635),int(H*.985),int(W*.03),int(W*.985);T=a[y0:y1,x0:x1]
    bg=np.median(T.reshape(-1,3),axis=0);dist=np.abs(T-bg).sum(2);mx=T.max(2);mn=T.min(2);sat=(mx-mn)/np.maximum(mx,1)
    core=(dist>60)&(sat>.32)&(mx>110);core=ndi.binary_opening(core,iterations=1);core=ndi.binary_dilation(core,iterations=2)
    body=(dist>40)&(mx>62)                                   # the icon including its gray / outlined parts, but not black text
    lab,n=ndi.label(core)
    for i,sl in enumerate(ndi.find_objects(lab),1):
        ys,xs=sl;h=ys.stop-ys.start;w=xs.stop-xs.start
        if h<10 or w<10:continue
        Y0,Y1,X0,X1=max(0,ys.start-6),min(T.shape[0],ys.stop+6),max(0,xs.start-6),min(T.shape[1],xs.stop+6)
        bl,bn=ndi.label(body[Y0:Y1,X0:X1]|(lab[Y0:Y1,X0:X1]==i));keep=np.unique(bl[(lab[Y0:Y1,X0:X1]==i)]);keep=keep[keep>0]
        m=np.isin(bl,keep);yy,xx=np.where(m)
        if not len(yy):continue
        by0,by1,bx0,bx1=Y0+yy.min(),Y0+yy.max()+1,X0+xx.min(),X0+xx.max()+1;h=by1-by0;w=bx1-bx0
        if not(16<=h<=72 and 16<=w<=320 and w/h>=.45):continue
        parts=max(1,round((w/h)/1.05)) if w/h>1.55 else 1            # icons standing side by side: split into icon-sized pieces
        for q in range(parts):
            px0=bx0+round(q*w/parts);px1=bx0+round((q+1)*w/parts);pw=px1-px0
            bx=(x0+px0,y0+by0,x0+px1,y0+by1)
            g=Image.fromarray(a[bx[1]:bx[3],bx[0]:bx[2]].astype(np.uint8)).resize((16,16))
            f=np.asarray(g,dtype=np.float32).ravel()/255;f=(f-f.mean())/(f.std()+1e-6)
            found.append({'card':k,'box':bx,'f':f,'ar':pw/h})
# merge duplicates (overlapping boxes on the same card)
found.sort(key=lambda f:(f['card'],f['box']))
ded=[]
for f in found:
    if ded and ded[-1]['card']==f['card']:
        a_,b_=ded[-1]['box'],f['box']
        if not(b_[0]>=a_[2] or b_[2]<=a_[0] or b_[1]>=a_[3] or b_[3]<=a_[1]):continue
    ded.append(f)
found=ded
clusters=[]
for f in found:
    best=None
    for c in clusters:
        if abs(c['ar']-f['ar'])>.35:continue
        d=np.linalg.norm(c['c']-f['f'])/np.sqrt(len(f['f']))
        if d<.62 and (best is None or d<best[0]):best=(d,c)
    if best:c=best[1];c['m'].append(f);c['c']=np.mean([m['f'] for m in c['m']],axis=0)
    else:clusters.append({'c':f['f'],'m':[f],'ar':f['ar']})
clusters.sort(key=lambda c:-len(c['m']))
print('icons found',len(found),'groups',len(clusters))
cols=9;cell=60;sheet=Image.new('RGB',(cols*cell+64,len(clusters)*cell),'white');d=ImageDraw.Draw(sheet)
for r,c in enumerate(clusters):
    d.text((3,r*cell+22),f'#{r} x{len(c["m"])}',fill=(0,0,0))
    for j,m in enumerate(c['m'][:cols]):
        a=load(m['card']);bx=m['box'];im=Image.fromarray(a[bx[1]:bx[3],bx[0]:bx[2]].astype(np.uint8));im.thumbnail((cell-6,cell-6));sheet.paste(im,(64+j*cell+3,r*cell+3))
sheet.save('groups3.png');print('sheet',sheet.size)
json.dump([{'members':[{'card':m['card'],'box':[int(v) for v in m['box']]} for m in c['m']]} for c in clusters],open('groups3.json','w'))
