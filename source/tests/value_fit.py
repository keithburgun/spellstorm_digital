# Fit the learned position score to Expert-vs-Expert outcomes (value_gen.js output).
# python3 value_fit.py data.jsonl [hidden=32] [out.json]   (hidden=0: logistic regression)
import json, sys, numpy as np
rows = [json.loads(l) for l in open(sys.argv[1]) if l.strip()]
H = int(sys.argv[2]) if len(sys.argv) > 2 else 32
X = np.array([r['f'] for r in rows], float); y = np.array([r['y'] for r in rows], float); E = np.array([r['e'] for r in rows], float)
g = np.array([r['g'] for r in rows]); te = g % 10 == 0; va = g % 10 == 5; tr = ~te & ~va
mu = X[tr].mean(0); sd = X[tr].std(0); sd[sd < 1e-6] = 1; Z = (X - mu) / sd
def ll(p, t): p = np.clip(p, 1e-6, 1 - 1e-6); return -np.mean(t * np.log(p) + (1 - t) * np.log(1 - p))
sig = lambda z: 1 / (1 + np.exp(-z))
# baseline: the current hand-set score, squashed by a fitted logistic
a, b = 0.01, 0.0
for it in range(3000):
    p = sig(a * E[tr] + b); ga = np.mean((p - y[tr]) * E[tr]); gb = np.mean(p - y[tr]); a -= 2e-5 * ga / max(1e-9, np.mean(E[tr] ** 2)) * 1e4 * 1e-4; b -= 0.5 * gb
# simple 1-D Newton for a, b
for it in range(50):
    p = sig(a * E[tr] + b); w = p * (1 - p); G = np.array([np.sum((p - y[tr]) * E[tr]), np.sum(p - y[tr])])
    Hm = np.array([[np.sum(w * E[tr] ** 2), np.sum(w * E[tr])], [np.sum(w * E[tr]), np.sum(w)]]) + 1e-6 * np.eye(2); d = np.linalg.solve(Hm, G); a -= d[0]; b -= d[1]
print(f'positions {len(y)} (train {tr.sum()}, val {va.sum()}, test {te.sum()}) | base rate {y.mean():.3f}')
print(f'current score : test log-loss {ll(sig(a*E[te]+b), y[te]):.4f}  acc {np.mean((a*E[te]+b>0)==(y[te]>.5)):.3f}')
rng = np.random.default_rng(1); n = Z.shape[1]
def train(H, l2=1e-4, epochs=60, lr=3e-3, bs=512):
    if H == 0: P = {'w2': np.zeros(n), 'b2': np.zeros(1)}
    else: P = {'W1': rng.normal(0, 1 / np.sqrt(n), (H, n)), 'b1': np.zeros(H), 'w2': rng.normal(0, 1 / np.sqrt(H), H), 'b2': np.zeros(1)}
    M = {k: np.zeros_like(v) for k, v in P.items()}; V = {k: np.zeros_like(v) for k, v in P.items()}; t = 0
    def fwd(Zb):
        if H == 0: return Zb @ P['w2'] + P['b2'][0], None
        h = np.tanh(Zb @ P['W1'].T + P['b1']); return h @ P['w2'] + P['b2'][0], h
    best = (9, None); idx = np.where(tr)[0]
    for ep in range(epochs):
        rng.shuffle(idx)
        for s in range(0, len(idx), bs):
            j = idx[s:s + bs]; Zb = Z[j]; out, h = fwd(Zb); d = (sig(out) - y[j]) / len(j); Gd = {}
            if H == 0: Gd['w2'] = Zb.T @ d + l2 * P['w2']; Gd['b2'] = np.array([d.sum()])
            else:
                Gd['w2'] = h.T @ d + l2 * P['w2']; Gd['b2'] = np.array([d.sum()]); dh = np.outer(d, P['w2']) * (1 - h ** 2)
                Gd['W1'] = dh.T @ Zb + l2 * P['W1']; Gd['b1'] = dh.sum(0)
            t += 1
            for k in P: M[k] = .9 * M[k] + .1 * Gd[k]; V[k] = .999 * V[k] + .001 * Gd[k] ** 2; P[k] -= lr * (M[k] / (1 - .9 ** t)) / (np.sqrt(V[k] / (1 - .999 ** t)) + 1e-8)
        vl = ll(sig(fwd(Z[va])[0]), y[va])
        if vl < best[0]: best = (vl, {k: v.copy() for k, v in P.items()})
    P = best[1]; out = fwd(Z[te])[0]
    return P, ll(sig(out), y[te]), np.mean((out > 0) == (y[te] > .5))
P, tl, acc = train(H)
print(f'learned (H={H}): test log-loss {tl:.4f}  acc {acc:.3f}')
if len(sys.argv) > 3:
    o = {'mu': mu.round(5).tolist(), 'sd': sd.round(5).tolist(), 'w2': P['w2'].round(5).tolist(), 'b2': round(float(P['b2'][0]), 5)}
    if H: o['W1'] = P['W1'].round(5).tolist(); o['b1'] = P['b1'].round(5).tolist()
    json.dump(o, open(sys.argv[3], 'w'))
