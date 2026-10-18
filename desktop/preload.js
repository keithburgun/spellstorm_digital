// Spellstorm desktop: the small, fixed set of things the game page may ask of the app (in-app updates).
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('SSDesk', {
  platform: process.platform,
  canUpdate: () => ipcRenderer.invoke('upd:can'),
  update: url => ipcRenderer.invoke('upd:go', url),
  onProgress: cb => { ipcRenderer.removeAllListeners('upd:progress'); ipcRenderer.on('upd:progress', (_e, pct) => cb(pct)); },
});
