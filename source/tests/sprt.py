import json,math,sys
f=sys.argv[1];elo0,elo1=0,float(sys.argv[2]) if len(sys.argv)>2 else 35
R=[json.loads(l) for l in open(f) if l.strip()];R=[r for r in R if r['cw'] is not None];w=sum(r['cw'] for r in R);n=len(R);l=n-w
p0=1/(1+10**(-elo0/400));p1=1/(1+10**(-elo1/400));llr=w*math.log(p1/p0)+l*math.log((1-p1)/(1-p0));A,B=math.log(.05/.95),math.log(.95/.05)
s=w/n if n else .5;se=math.sqrt(max(s*(1-s),1e-9)/max(n,1))
elo=lambda q:-400*math.log10(1/min(max(q,1e-6),1-1e-6)-1)
ms=sum(r['ms'] for r in R)/max(n,1)/1000
print(f"games {n}: candidate {w}-{l} ({100*s:.1f}%) | Elo {elo(s):+.0f} (95% CI {elo(s-1.96*se):+.0f} … {elo(s+1.96*se):+.0f}) | LLR {llr:+.2f} [{A:.2f}, {B:.2f}] → {'ACCEPT (gain)' if llr>=B else 'REJECT (no gain)' if llr<=A else 'continue'} | {ms:.1f}s/game | errors {sum(1 for r in R if r.get('err'))}")
