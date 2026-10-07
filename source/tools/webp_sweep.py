import json,base64,io
import numpy as np
from PIL import Image
from skimage.metrics import structural_similarity as ssim
src=json.load(open('/home/claude/imgs.json'))
def dec(v):return Image.open(io.BytesIO(base64.b64decode(v.split(',',1)[1])))
keys=[k for k,v in src.items() if v.startswith('data:image/jpeg')];orig=sum(len(src[k]) for k in keys)
res={}
for q in (80,85,90):
    tot=0;ss=[]
    for k in keys:
        im=dec(src[k]).convert('RGB');ref=np.asarray(im);b=io.BytesIO();im.save(b,'WEBP',quality=q,method=6)
        tot+=len(base64.b64encode(b.getvalue()))+23;ss.append((ssim(ref,np.asarray(Image.open(io.BytesIO(b.getvalue())).convert('RGB')),channel_axis=2,data_range=255),k))
    ss.sort();res[q]=ss
    print(f'WebP quality {q}: {orig/1e6:.2f} → {tot/1e6:.2f} MB ({100*(1-tot/orig):.0f}% smaller) | similarity median {ss[len(ss)//2][0]:.4f}, worst {ss[0][0]:.4f} ({ss[0][1]})')
json.dump({q:[(s,k) for s,k in v[:3]] for q,v in res.items()},open('/home/claude/webp_worst.json','w'))
