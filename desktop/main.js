// Spellstorm desktop wrapper (Electron)
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

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
    webPreferences: { contextIsolation: true, sandbox: true }
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

// Only one copy of the game at a time
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
  app.whenReady().then(createWindow);
  app.on('window-all-closed', () => app.quit());
}
