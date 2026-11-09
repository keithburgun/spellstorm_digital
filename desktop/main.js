// Spellstorm desktop wrapper (Electron)
const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { spawn } = require('child_process');

// ---------- Steam (only in the Steam build: CI puts steam.json next to this file) ----------
// Achievements, Steam Cloud, the overlay, the Steam Deck keyboard and Rich Presence. If Steam isn't running, or the
// library can't load, the game simply runs without them.
const STEAMCFG = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'steam.json'), 'utf8')); } catch (err) { return null; } })();
let STEAM = null;
if (STEAMCFG) {
  if (process.platform === 'linux') app.commandLine.appendSwitch('no-sandbox');   // Chromium's sandbox helper can't run inside Steam's Linux runtime
  try {
    const sw = require('steamworks.js');
    if (sw.restartAppIfNecessary(STEAMCFG.appId)) process.exit(0);   // started outside Steam: Steam relaunches it properly
    STEAM = sw.init(STEAMCFG.appId);
    sw.electronEnableSteamOverlay();
  } catch (err) { STEAM = null; console.error('Steam not available:', err && err.message); }
}
const steamTry = (f, dflt) => { if (!STEAM) return dflt; try { return f(STEAM); } catch (err) { return dflt; } };
ipcMain.handle('st:info', () => ({
  on: !!STEAM,
  deck: steamTry(s => s.utils.isSteamRunningOnSteamDeck(), false),
  cloud: steamTry(s => s.cloud.isEnabledForAccount() && s.cloud.isEnabledForApp(), false),
}));
ipcMain.handle('st:ach', (_e, name) => steamTry(s => { if (typeof name !== 'string' || !/^[A-Z0-9_]{1,64}$/.test(name)) return false;
  if (s.achievement.isActivated(name)) return true; const ok = s.achievement.activate(name); s.stats.store(); return ok; }, false));
ipcMain.handle('st:rp', (_e, kv) => steamTry(s => { if (!kv || typeof kv !== 'object') return false;
  for (const [k, v] of Object.entries(kv)) if (typeof k === 'string' && k.length <= 64) s.localplayer.setRichPresence(k, v == null ? undefined : String(v).slice(0, 256)); return true; }, false));
const CLOUDNAME = n => typeof n === 'string' && /^[a-z0-9_.-]{1,64}$/i.test(n);
ipcMain.handle('st:cread', (_e, name) => steamTry(s => CLOUDNAME(name) && s.cloud.fileExists(name) ? s.cloud.readFile(name) : null, null));
ipcMain.handle('st:cwrite', (_e, name, text) => steamTry(s => CLOUDNAME(name) && typeof text === 'string' && text.length < 8e6 ? s.cloud.writeFile(name, text) : false, false));
ipcMain.handle('st:kbd', (_e, r) => steamTry(s => { if (!r) return false; const n = v => Math.max(0, Math.round(+v || 0));
  return s.utils.showFloatingGamepadTextInput(+r.mode || 0, n(r.x), n(r.y), n(r.w), n(r.h)); }, false));

// Sounds can start from a controller press (browsers only count mouse/keyboard as "the player did something").
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// Steam Deck (Game Mode) and Steam Big Picture: start fullscreen. Anywhere else: --fullscreen does the same.
const FULLSCREEN = process.env.SteamDeck === '1' || process.env.SteamTenfoot === '1' || process.argv.includes('--fullscreen');

function createWindow() {
  const win = new BrowserWindow({
    width: 1366, height: 820, minWidth: 900, minHeight: 600,
    backgroundColor: '#120b20',
    title: 'Spellstorm',
    icon: path.join(__dirname, process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    fullscreen: FULLSCREEN,
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true, preload: path.join(__dirname, 'preload.js') }
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'app', 'index.html'), { query: { v: app.getVersion() } });
  win.once('ready-to-show', () => win.show());
  // F11 toggles fullscreen
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  // Any external link opens in the normal browser
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

// ---------- in-app updates ----------
// Windows: the portable .exe is replaced in place (same file name, so shortcuts keep working), restarted, and the old copy deleted.
// Linux / Steam Deck: the AppImage is replaced in place (same file name, so a Steam shortcut keeps working) and restarted.
const ALLOWED = process.env.SPELLSTORM_UPDATE_TEST_PREFIX || 'https://github.com/keithburgun/spellstorm_digital/releases/download/';   // (the variable is only for automated tests)
const updKind = () => process.platform === 'win32' && process.env.PORTABLE_EXECUTABLE_FILE ? 'win' : process.platform === 'linux' && process.env.APPIMAGE ? 'linux' : null;
function fetchTo(url, file, onPct, hops = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Spellstorm-Desktop' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && hops < 5) {
        res.resume(); const next = new URL(res.headers.location, url);
        if (next.protocol !== 'https:') return reject(new Error('insecure redirect'));
        return fetchTo(next.href, file, onPct, hops + 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('server said ' + res.statusCode)); }
      const total = +res.headers['content-length'] || 0; let got = 0, last = -1;
      const out = fs.createWriteStream(file);
      res.on('data', d => { got += d.length; if (total) { const p = Math.floor(got * 100 / total); if (p !== last) { last = p; onPct(p); } } });
      res.pipe(out);
      out.on('finish', () => out.close(() => (total && got !== total) ? reject(new Error('the download was cut off')) : resolve()));
      res.on('error', reject); out.on('error', reject);
    });
    req.on('error', reject); req.setTimeout(30000, () => req.destroy(new Error('timed out')));
  });
}
ipcMain.handle('upd:can', () => ({ kind: updKind(), version: app.getVersion() }));
ipcMain.handle('upd:go', async (e, url) => {
  const kind = updKind();
  if (!kind) throw new Error('This copy of Spellstorm can’t update itself.');
  if (typeof url !== 'string' || !url.startsWith(ALLOWED) || !url.endsWith(kind === 'win' ? '.exe' : '.AppImage')) throw new Error('That isn’t a Spellstorm update.');
  const send = p => { if (!e.sender.isDestroyed()) e.sender.send('upd:progress', p); };
  if (kind === 'win') {
    // Replace the player's own Spellstorm .exe in place: same file, same name, same folder, so shortcuts keep working.
    // Never leave a second copy next to it. Steps:
    //  1. download into the temp folder, not next to the game (a synced Desktop/OneDrive or a virus scan can hold a fresh file there for minutes);
    //  2. a small helper script waits until this game (and its portable launcher) has really exited;
    //  3. it moves the download over the old .exe; if overwriting is refused, it renames the old one to .old and moves the new one in
    //     (Windows often allows a rename when it refuses an overwrite);
    //  4. it starts the game again. If the swap is still refused after ~3 minutes, it starts the old version unchanged (the update
    //     will simply be offered again) — it no longer saves the new version under another name.
    // Every step is written to %TEMP%\spellstorm-update.log, so a failure can be diagnosed.
    const os = require('os'), tmp = os.tmpdir(), stamp = Date.now();
    const me = process.env.PORTABLE_EXECUTABLE_FILE, old = me + '.old', part = path.join(tmp, 'spellstorm-update-' + stamp + '.exe');
    await fetchTo(url, part, send);
    try { fs.unlinkSync(old); } catch (err) {}
    const log = path.join(tmp, 'spellstorm-update.log'), bat = path.join(tmp, 'spellstorm-update-' + stamp + '.cmd');
    const pids = [process.pid, process.ppid].filter(n => Number.isInteger(n) && n > 4);
    const L = m => `echo [%date% %time%] ${m}>>"%LOG%"`;
    fs.writeFileSync(bat, [
      '@echo off', 'chcp 65001 >nul', 'setlocal',
      `set "ME=${me}"`, `set "OLD=${old}"`, `set "OLDN=${path.basename(old)}"`, `set "PART=${part}"`, `set "LOG=${log}"`,
      L(`update to ${path.basename(new URL(url).pathname)}: waiting for Spellstorm (pids ${pids.join(' ')}) to close`),
      'set n=0',
      ':wait', 'set busy=',
      ...pids.map(id => `tasklist /FI "PID eq ${id}" /NH 2>nul | find " ${id} " >nul && set busy=1`),
      'if not defined busy goto swap', 'set /a n+=1', 'if %n% geq 90 goto swap', 'ping -n 2 127.0.0.1 >nul', 'goto wait',
      ':swap', L('game closed after %n% s; replacing the game file'), 'set n=0',
      ':loop',
      'move /Y "%PART%" "%ME%" >nul 2>&1 && goto done',
      'if %n% geq 10 if not exist "%OLD%" ren "%ME%" "%OLDN%" >nul 2>&1',
      'if not exist "%ME%" move /Y "%PART%" "%ME%" >nul 2>&1 && goto done',
      'if not exist "%ME%" if exist "%OLD%" move /Y "%OLD%" "%ME%" >nul 2>&1',   // (the new one wouldn't go in: put the old one back and try again)
      'set /a n+=1', 'if %n% geq 180 goto fail', 'ping -n 2 127.0.0.1 >nul', 'goto loop',
      ':done', L('replaced OK after %n% tries'), 'start "" "%ME%"', 'goto end',
      ':fail', L('FAILED: the game file stayed locked; starting the old version (the update will be offered again)'),
      'del "%PART%" >nul 2>&1', 'if not exist "%ME%" if exist "%OLD%" move /Y "%OLD%" "%ME%" >nul 2>&1', 'start "" "%ME%"',
      ':end', '(goto) 2>nul & del "%~f0"', ''].join('\r\n'));
    app.releaseSingleInstanceLock();
    spawn('cmd.exe', ['/d', '/c', bat], { detached: true, stdio: 'ignore', windowsHide: true, cwd: tmp }).unref();
  } else {
    const img = process.env.APPIMAGE, part = img + '.download';
    await fetchTo(url, part, send);
    fs.chmodSync(part, 0o755);
    fs.renameSync(part, img);                  // the running copy keeps working from its own (now unlinked) file
    app.releaseSingleInstanceLock();
    spawn(img, process.argv.slice(1).filter(a => !a.startsWith('--type=')), { detached: true, stdio: 'ignore' }).unref();
  }
  setTimeout(() => app.quit(), 400);
  return true;
});
// After a Windows update: remove the previous version (Spellstorm.exe.old) once it has closed.
function tidyOldExes() {
  const me = process.env.PORTABLE_EXECUTABLE_FILE; if (!me) return;
  let tries = 0;
  // (also a Spellstorm.exe.download left beside the game by the older updater)
  const go = () => { let left = 0; for (const f of [me + '.old', me + '.download']) { if (!fs.existsSync(f)) continue; try { fs.unlinkSync(f); } catch (err) { left++; } } if (left && ++tries < 6) setTimeout(go, 4000); };
  setTimeout(go, 4000);
}

// Only one copy of the game at a time
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
  app.whenReady().then(() => { createWindow(); try { tidyOldExes(); } catch (err) {} });
  app.on('window-all-closed', () => app.quit());
}
