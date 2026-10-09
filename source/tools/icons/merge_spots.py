# Combine the two detectors' results (template matches win; add shape detections that don't overlap) -> icon_spots.json
import json
A=json.load(open('icon_spots_t.json'));B=json.load(open('icon_spots_s.json'))
def ov(p,q):
    ix=max(0,min(p[0]+p[2],q[0]+q[2])-max(p[0],q[0]));iy=max(0,min(p[1]+p[3],q[1]+q[3])-max(p[1],q[1]))
    return ix*iy>.3*min(p[2]*p[3],q[2]*q[3])
out={}
for k in set(A)|set(B):
    L=list(A.get(k,[]))
    for q in B.get(k,[]):
        if not any(ov(p,q) for p in L):L.append(q)
    out[k]=L
json.dump({k:v for k,v in out.items() if not k.startswith('journal')},open('icon_spots.json','w'))
