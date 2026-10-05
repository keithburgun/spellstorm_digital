import json,math,sys
R=[json.loads(l) for l in open(sys.argv[1]) if l.strip()];R=[r for r in R if r['cw'] is not None];w=sum(r['cw'] for r in R);n=len(R);l=n-w
p0=1/(1+10**(20/400));p1=1/(1+10**(-10/400));llr=w*math.log(p1/p0)+l*math.log((1-p1)/(1-p0))
s=w/n;se=math.sqrt(s*(1-s)/n);elo=lambda q:-400*math.log10(1/q-1)
print(f"{n} games: {w}-{l} ({100*s:.1f}%) | Elo {elo(s):+.0f} (95% CI {elo(s-1.96*se):+.0f} … {elo(s+1.96*se):+.0f}) | non-regression LLR {llr:+.2f} [-2.94, +2.94] →",'PASS' if llr>=2.94 else 'FAIL' if llr<=-2.94 else 'continue')
