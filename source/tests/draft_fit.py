# Fit a drafting value model to rollout win rates (draft_gen.js output). python3 draft_fit.py data.jsonl meta.json [lam] [out.json]
import json, sys, numpy as np
from collections import Counter
D = [json.loads(l) for l in open(sys.argv[1]) if l.strip()]
M = json.load(open(sys.argv[2])); C, WZ = M['C'], M['W']
lam = float(sys.argv[3]) if len(sys.argv) > 3 else 3.0
BEATS = {'F': 'E', 'E': 'W', 'W': 'F'}
IDS = sorted(k for k in C if not C[k]['junk']); IX = {k: i for i, k in enumerate(IDS)}
WIZS = sorted(WZ); NW = len(WIZS) * 3
def dom(ids):
    n = Counter(C[i]['el'] for i in ids if not C[i]['junk']); return max('FEW', key=lambda e: n[e])
NAMES = [f'id:{k}' for k in IDS] + [f'we:{w}:{e}' for w in WIZS for e in 'FEW'] + ['wizEl', 'counter', 'copies', 'sameElFrac', 'junkFrac', 'tierXbattle', 'valXbattle', 'deckSize']
def feats(d, oid):
    c = C[oid]; mine = d['mine']; nn = [i for i in mine if not C[i]['junk']]
    x = np.zeros(len(NAMES)); x[IX[oid]] = 1
    if WIZS.index(d['wiz']) < 99: x[len(IDS) + WIZS.index(d['wiz']) * 3 + 'FEW'.index(c['el'])] = 1
    b = d['battle'] or 1
    x[len(IDS)+NW+0] = c['el'] in WZ[d['wiz']]
    x[len(IDS)+NW+1] = BEATS[c['el']] == dom(d['theirs'])
    x[len(IDS)+NW+2] = mine.count(oid)
    x[len(IDS)+NW+3] = sum(C[i]['el'] == c['el'] for i in nn) / max(1, len(nn))
    x[len(IDS)+NW+4] = 0  # (same for every option; kept for shape)
    x[len(IDS)+NW+5] = (c['t'] - 1) * b
    x[len(IDS)+NW+6] = c['v'] * b / 10
    x[len(IDS)+NW+7] = 0
    return x
def cardval(d, oid): c = C[oid]; return c['v'] + (2 if c['el'] in WZ[d['wiz']] else 0)
X, Y, G = [], [], []
for gi, d in enumerate(D):
    F = np.array([feats(d, o) for o in d['opts']]); w = np.array(d['wr'])
    X.append(F - F.mean(0)); Y.append(w - w.mean()); G += [gi] * len(w)
X = np.vstack(X); Y = np.concatenate(Y); G = np.array(G)
games = np.array([D[g]['g'] for g in G]); test = games % 5 == 0
def fit(m):
    A = X[m]; return np.linalg.solve(A.T @ A + lam * np.eye(A.shape[1]), A.T @ Y[m])
def regret(w, idx, pol):
    r = []; agree = 0
    for gi in idx:
        d = D[gi]; wr = np.array(d['wr'])
        if pol == 'model': s = [feats(d, o) @ w for o in d['opts']]
        else: s = [cardval(d, o) for o in d['opts']]
        j = int(np.argmax(s)); r.append(wr.max() - wr[j]); agree += wr[j] == wr.max()
    return np.mean(r), agree / len(idx)
w = fit(~test); tidx = sorted(set(G[test]))
print(f'decisions {len(D)} test {len(tidx)} | regret cardVal %.4f agree %.2f | model %.4f agree %.2f' % (*regret(w, tidx, 'cv'), *regret(w, tidx, 'model')))
wa = fit(np.ones(len(Y), bool))
order = np.argsort(-wa[:len(IDS)])
print('top:', ' '.join(f'{IDS[i]}{wa[i]*100:+.1f}' for i in order[:15]))
print('bottom:', ' '.join(f'{IDS[i]}{wa[i]*100:+.1f}' for i in order[-15:]))
B = len(IDS) + NW
print('extras:', ' '.join(f'{n}={wa[B+i]*100:+.2f}' for i, n in enumerate(NAMES[B:])))
print('wiz x element:', ' '.join(f'{NAMES[len(IDS)+i][3:]}={wa[len(IDS)+i]*100:+.1f}' for i in range(NW)))
if len(sys.argv) > 4: json.dump({'ids': {k: round(float(wa[IX[k]]) * 100, 2) for k in IDS}, 'we': {NAMES[len(IDS)+i][3:]: round(float(wa[len(IDS)+i]) * 100, 2) for i in range(NW)}, 'x': {n: round(float(wa[B+i]) * 100, 3) for i, n in enumerate(NAMES[B:])}}, open(sys.argv[4], 'w'))
