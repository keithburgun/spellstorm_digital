// Spellstorm desktop wrapper (Electron)
const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { spawn } = require('child_process');

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
    // Replace the running .exe in place (Windows lets a running program be renamed, not overwritten), so the player's
    // shortcuts keep working. If that isn't allowed, fall back to saving the new version next to it under its own name.
    const me = process.env.PORTABLE_EXECUTABLE_FILE, dir = path.dirname(me), part = me + '.download';
    await fetchTo(url, part, send);
    let target = me;
    try { try { fs.unlinkSync(me + '.old'); } catch (err) {} fs.renameSync(me, me + '.old'); fs.renameSync(part, me); }
    catch (err) {
      try { if (!fs.existsSync(me) && fs.existsSync(me + '.old')) fs.renameSync(me + '.old', me); } catch (e2) {}
      target = path.join(dir, path.basename(new URL(url).pathname)); try { fs.unlinkSync(target); } catch (e3) {} fs.renameSync(part, target);
    }
    app.releaseSingleInstanceLock();
    spawn(target, [], { detached: true, stdio: 'ignore', cwd: dir }).unref();
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
  const go = () => { const old = me + '.old'; if (!fs.existsSync(old)) return; try { fs.unlinkSync(old); } catch (err) { if (++tries < 6) setTimeout(go, 4000); } };
  setTimeout(go, 4000);
}

// Only one copy of the game at a time
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
  app.whenReady().then(() => { createWindow(); try { tidyOldExes(); } catch (err) {} });
  app.on('window-all-closed', () => app.quit());
}
