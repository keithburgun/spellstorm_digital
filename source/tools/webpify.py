# Re-encode each image as WebP at the smallest quality that still looks the same (SSIM >= 0.985 vs the current image).
import json,base64,io,sys
import numpy as np
from PIL import Image
from skimage.metrics import structural_similarity as ssim
src=json.load(open('/home/claude/imgs.json'));out={};rep=[];TH=0.985
def dec(v):return Image.open(io.BytesIO(base64.b64decode(v.split(',',1)[1])))
for k,v in src.items():
    if not v.startswith('data:image/jpeg') and not v.startswith('data:image/png'):out[k]=v;continue
    im=dec(v);alpha=im.mode in('RGBA','LA') or (im.mode=='P' and 'transparency' in im.info)
    im=im.convert('RGBA' if alpha else 'RGB');ref=np.asarray(im.convert('RGB'),dtype=np.uint8)
    best=None
    for q in (72,78,82,86,90,94):
        b=io.BytesIO();im.save(b,'WEBP',quality=q,method=6);w=Image.open(io.BytesIO(b.getvalue())).convert('RGB')
        s=ssim(ref,np.asarray(w,dtype=np.uint8),channel_axis=2,data_range=255)
        if alpha:
            a0=np.asarray(im)[:,:,3];a1=np.asarray(Image.open(io.BytesIO(b.getvalue())).convert('RGBA'))[:,:,3];s=min(s,1-np.abs(a0.astype(int)-a1).mean()/255)
        if s>=TH:best=(q,s,b.getvalue());break
    nv='data:image/webp;base64,'+base64.b64encode(best[2]).decode() if best else None
    if nv and len(nv)<len(v):out[k]=nv;rep.append((k,len(v),len(nv),best[0],best[1]))
    else:out[k]=v;rep.append((k,len(v),len(v),None,1.0))
json.dump(out,open('/home/claude/imgs_webp.json','w'))
o=sum(r[1] for r in rep);n=sum(r[2] for r in rep);conv=[r for r in rep if r[3]]
print(f'{len(conv)} of {len(rep)} images converted | {o/1e6:.2f} MB → {n/1e6:.2f} MB ({100*(1-n/o):.0f}% smaller)')
print('lowest similarity of any converted image: %.4f | quality settings used: %s'%(min(r[4] for r in conv),sorted({r[3] for r in conv})))
print('largest savings:',', '.join(f'{k} {a//1024}→{b//1024} KB' for k,a,b,q,s in sorted(rep,key=lambda r:r[2]-r[1])[:5]))
