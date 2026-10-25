# Fit card-play values to play-out win rates (play_gen.js output). python3 play_fit.py data.jsonl meta.json [lam] [out.json]
import json, sys, numpy as np
from collections import Counter
D = [json.loads(l) for l in open(sys.argv[1]) if l.strip()]
M = json.load(open(sys.argv[2])); C, WZ = M['C'], M['W']
lam = float(sys.argv[3]) if len(sys.argv) > 3 else 10.0
BEATS = {'F': 'E', 'E': 'W', 'W': 'F'}
IDS = sorted(k for k in C if not C[k]['junk']); IX = {k: i for i, k in enumerate(IDS)}
XN = ['beat', 'lose', 'beatXr4', 'idxLate', 'tier', 'hpLow', 'ohpLow']
NAMES = [f'id:{k}' for k in IDS] + [f'late:{k}' for k in IDS] + XN
def ctx(d):
    pool = [i for i in d['opool'] if not C[i]['junk']]; n = Counter(C[i]['el'] for i in pool); t = max(1, len(pool))
    return {e: n[e] / t for e in 'FEW'}
def feats(d, oid, cx):
    c = C[oid]; x = np.zeros(len(NAMES)); x[IX[oid]] = 1
    late = (d['round'] - 1) / 3; x[len(IDS) + IX[oid]] = late
    B = 2 * len(IDS); e = c['el']
    beat = cx[BEATS[e]]; lose = cx[[k for k in BEATS if BEATS[k] == e][0]]
    x[B + 0] = beat; x[B + 1] = lose; x[B + 2] = beat * late; x[B + 3] = 0; x[B + 4] = c['t'] - 1
    x[B + 5] = (c['v'] / 10) * (d['hp'] <= 4); x[B + 6] = (c['v'] / 10) * (d['ohp'] <= 4)
    return x
def domel(d):
    cx = ctx(d); return max('FEW', key=lambda e: cx[e])
def fastval(d, oid): c = C[oid]; return c['v'] + (3 if BEATS[c['el']] == domel(d) else 0)
X, Y, G = [], [], []
for gi, d in enumerate(D):
    cx = ctx(d); F = np.array([feats(d, o, cx) for o in d['opts']]); w = np.array(d['wr'])
    X.append(F - F.mean(0)); Y.append(w - w.mean()); G += [gi] * len(w)
X = np.vstack(X); Y = np.concatenate(Y); G = np.array(G)
test = np.array([D[g]['g'] for g in G]) % 5 == 0
def fit(m): A = X[m]; return np.linalg.solve(A.T @ A + lam * np.eye(A.shape[1]), A.T @ Y[m])
def regret(w, idx, pol):
    r = []
    for gi in idx:
        d = D[gi]; wr = np.array(d['wr']); cx = ctx(d)
        s = [feats(d, o, cx) @ w for o in d['opts']] if pol == 'm' else [fastval(d, o) for o in d['opts']]
        r.append(wr.max() - wr[int(np.argmax(s))])
    return np.mean(r)
w = fit(~test); tidx = sorted(set(G[test]))
print(f'decisions {len(D)} test {len(tidx)} | regret fastPlay %.4f | model %.4f | random %.4f' % (regret(w, tidx, 'f'), regret(w, tidx, 'm'), np.mean([max(D[g]['wr']) - np.mean(D[g]['wr']) for g in tidx])))
wa = fit(np.ones(len(Y), bool)); B = 2 * len(IDS)
o = np.argsort(-wa[:len(IDS)])
print('top:', ' '.join(f'{IDS[i]}{wa[i]*100:+.1f}' for i in o[:12])); print('bottom:', ' '.join(f'{IDS[i]}{wa[i]*100:+.1f}' for i in o[-12:]))
print('extras:', ' '.join(f'{n}={wa[B+i]*100:+.2f}' for i, n in enumerate(XN)))
if len(sys.argv) > 4: json.dump({'ids': {k: round(float(wa[IX[k]]) * 100, 2) for k in IDS}, 'late': {k: round(float(wa[len(IDS) + IX[k]]) * 100, 2) for k in IDS}, 'x': {n: round(float(wa[B + i]) * 100, 3) for i, n in enumerate(XN)}}, open(sys.argv[4], 'w'))
