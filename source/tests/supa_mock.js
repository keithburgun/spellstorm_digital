// A local stand-in for the Supabase endpoints Spellstorm uses (GoTrue auth + PostgREST "saves" table with row-level security).
// Responses copy Supabase's shapes and error codes. Usage: PORT=9100 KEY=... TTL=3600 node supa_mock.js
const http = require('http'), crypto = require('crypto');
const PORT = +process.env.PORT || 9100, KEY = process.env.KEY || 'sb_publishable_test', TTL = +process.env.TTL || 3600, CONFIRM = process.env.CONFIRM === '1';
const users = new Map(), tokens = new Map(), refresh = new Map(), saves = new Map(); let calls = [];
const pgTime = d => d.toISOString().replace(/(\.\d{3})Z$/, (m, ms) => ms + '123+00:00');   // Postgres returns microseconds + "+00:00"
const send = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(body === undefined ? '' : JSON.stringify(body)); };
const session = u => { const at = crypto.randomBytes(16).toString('hex'), rt = crypto.randomBytes(12).toString('hex'), exp = Math.floor(Date.now() / 1000) + TTL;
  tokens.set(at, { uid: u.id, exp }); refresh.set(rt, u.id); return { access_token: at, token_type: 'bearer', expires_in: TTL, expires_at: exp, refresh_token: rt, user: { id: u.id, email: u.email, aud: 'authenticated', role: 'authenticated' } }; };
const who = req => { const m = /^Bearer (.+)$/.exec(req.headers.authorization || ''); if (!m) return null; const t = tokens.get(m[1]); if (!t) return { bad: 'invalid' }; if (t.exp * 1000 < Date.now()) return { bad: 'expired' }; return { uid: t.uid }; };
http.createServer((req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'apikey,authorization,content-type,prefer,x-client-info', 'Access-Control-Max-Age': '86400' }); return res.end(); }
  let raw = ''; req.on('data', c => raw += c); req.on('end', () => {
    const url = new URL(req.url, 'http://x'), p = url.pathname; let body = {}; try { body = raw ? JSON.parse(raw) : {}; } catch (e) { return send(res, 400, { message: 'bad json' }); }
    if (p === '/__calls') return send(res, 200, calls); if (p === '/__reset') { users.clear(); tokens.clear(); refresh.clear(); saves.clear(); calls = []; return send(res, 200, {}); }
    if (p === '/__expire') { for (const t of tokens.values()) t.exp = 1; return send(res, 200, {}); }
    if (p === '/__save') return send(res, 200, [...saves.values()]);
    calls.push(req.method + ' ' + p + url.search);
    if (req.headers.apikey !== KEY) return send(res, 401, { message: 'Invalid API key', hint: 'Double check your Supabase `anon` or `service_role` API key.' });
    // ---- auth ----
    if (p === '/auth/v1/signup' && req.method === 'POST') {
      const email = String(body.email || '').trim().toLowerCase(), pw = String(body.password || '');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return send(res, 400, { code: 400, error_code: 'validation_failed', msg: 'Unable to validate email address: invalid format' });
      if (pw.length < 6) return send(res, 422, { code: 422, error_code: 'weak_password', msg: 'Password should be at least 6 characters.', weak_password: { reasons: ['length'] } });
      if ([...users.values()].some(u => u.email === email)) return send(res, 422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' });
      const u = { id: crypto.randomUUID(), email, pw }; users.set(u.id, u);
      if (CONFIRM) return send(res, 200, { id: u.id, email, aud: 'authenticated', confirmation_sent_at: new Date().toISOString() });
      return send(res, 200, session(u));
    }
    if (p === '/auth/v1/token' && req.method === 'POST') {
      const gt = url.searchParams.get('grant_type');
      if (gt === 'password') { const u = [...users.values()].find(u => u.email === String(body.email || '').trim().toLowerCase());
        if (!u || u.pw !== body.password) return send(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }); return send(res, 200, session(u)); }
      if (gt === 'refresh_token') { const uid = refresh.get(body.refresh_token); if (!uid) return send(res, 400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' });
        refresh.delete(body.refresh_token); return send(res, 200, session(users.get(uid))); }
      return send(res, 400, { code: 400, error_code: 'validation_failed', msg: 'unsupported grant_type' });
    }
    if (p === '/auth/v1/recover' && req.method === 'POST') return send(res, 200, {});
    if (p === '/auth/v1/logout' && req.method === 'POST') { const w = who(req); if (w && w.uid) for (const [t, v] of tokens) if (v.uid === w.uid) tokens.delete(t); res.writeHead(204, { 'Access-Control-Allow-Origin': '*' }); return res.end(); }
    if (p === '/auth/v1/user' && req.method === 'PUT') { const w = who(req); if (!w || w.bad) return send(res, 401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' });
      const u = users.get(w.uid); if (String(body.password || '').length < 6) return send(res, 422, { code: 422, error_code: 'weak_password', msg: 'Password should be at least 6 characters.' });
      u.pw = body.password; return send(res, 200, { id: u.id, email: u.email }); }
    // ---- REST: public.saves with RLS (auth.uid() = user_id) ----
    if (p === '/rest/v1/saves') {
      const w = who(req); if (w && w.bad === 'expired') return send(res, 401, { code: 'PGRST301', details: null, hint: null, message: 'JWT expired' });
      if (w && w.bad) return send(res, 401, { code: 'PGRST301', message: 'JWSError JWSInvalidSignature' });
      const uid = w && w.uid, eq = k => { const v = url.searchParams.get(k); return v && v.startsWith('eq.') ? v.slice(3) : null; };
      const visible = r => uid && r.user_id === uid;   // RLS
      if (req.method === 'GET') { const f = eq('user_id'); return send(res, 200, [...saves.values()].filter(r => visible(r) && (!f || r.user_id === f)).map(r => ({ data: r.data, updated_at: r.updated_at }))); }
      if (req.method === 'POST') { if (!uid || body.user_id !== uid) return send(res, 403, { code: '42501', message: 'new row violates row-level security policy for table "saves"' });
        if (saves.has(uid)) return send(res, 409, { code: '23505', message: 'duplicate key value violates unique constraint "saves_pkey"' });
        const row = { user_id: uid, data: body.data, updated_at: pgTime(new Date(body.updated_at || Date.now())) }; saves.set(uid, row); return send(res, 201, [row]); }
      if (req.method === 'PATCH') { const f = eq('user_id'), t = eq('updated_at'); const out = [];
        for (const r of saves.values()) if (visible(r) && (!f || r.user_id === f) && (!t || r.updated_at === t)) { if (body.data !== undefined) r.data = body.data; if (body.updated_at) r.updated_at = pgTime(new Date(body.updated_at)); out.push(r); }
        return send(res, 200, out); }
    }
    send(res, 404, { message: 'not found' });
  });
}).listen(PORT, '127.0.0.1', () => console.log('supabase stand-in on 127.0.0.1:' + PORT));
