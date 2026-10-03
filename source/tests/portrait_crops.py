import json,base64,io,sys
from PIL import Image, ImageDraw
imgs=json.load(open('/home/claude/imgs.json'))
# face centre (x, y as fractions of the art) and zoom (art width as a multiple of the circle's diameter)
F={'derby':(.63,.34,3.0),'eve':(.64,.315,3.0),'abragail':(.29,.37,3.2),'may':(.51,.31,4.2),'omar':(.735,.305,3.0),'bunny':(.45,.33,2.8),'oren':(.505,.25,3.9),'croh':(.55,.30,3.0),'robot':(.53,.235,3.0)}
AR=858/560
def pos(cx,cy,z):
    px=(.5-cx*z)/(1-z); dh=AR*z; py=(.5-cy*dh)/(1-dh); return px*100,py*100
def img(k):
    d=imgs[k]; return Image.open(io.BytesIO(base64.b64decode(d.split(',',1)[1]))).convert('RGB')
def circle(im,D,z,px,py):
    dw=z*D; dh=dw*AR; big=im.resize((round(dw),round(dh)))
    ox=(D-dw)*px/100; oy=(D-dh)*py/100; c=Image.new('RGB',(D,D),(230,230,240)); c.paste(big,(round(ox),round(oy)))
    m=Image.new('L',(D,D),0); ImageDraw.Draw(m).ellipse((0,0,D-1,D-1),fill=255); out=Image.new('RGB',(D,D),(255,255,255)); out.paste(c,(0,0),m); return out
if __name__=='__main__':
    sheet=Image.new('RGB',(9*120,150),'white'); d=ImageDraw.Draw(sheet)
    for i,(w,(cx,cy,z)) in enumerate(F.items()):
        px,py=pos(cx,cy,z); sheet.paste(circle(img('wz_'+w),100,z,px,py),(i*120+10,30)); d.text((i*120+10,8),w,fill=(0,0,0))
        print(f"{w:9s} background-size:{z*100:.0f}%; background-position:{px:.1f}% {py:.1f}%")
    sheet.save('/home/claude/faces_new.png')
