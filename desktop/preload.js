// Spellstorm desktop: the small, fixed set of things the game page may ask of the app (in-app updates).
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('SSDesk', {
  platform: process.platform,
  canUpdate: () => ipcRenderer.invoke('upd:can'),
  update: url => ipcRenderer.invoke('upd:go', url),
  onProgress: cb => { ipcRenderer.removeAllListeners('upd:progress'); ipcRenderer.on('upd:progress', (_e, pct) => cb(pct)); },
});
// Steam (does nothing outside the Steam build): achievements, cloud save file, Rich Presence, Steam Deck keyboard.
contextBridge.exposeInMainWorld('SSSteam', {
  info: () => ipcRenderer.invoke('st:info'),
  unlock: name => ipcRenderer.invoke('st:ach', name),
  presence: kv => ipcRenderer.invoke('st:rp', kv),
  cloudRead: name => ipcRenderer.invoke('st:cread', name),
  cloudWrite: (name, text) => ipcRenderer.invoke('st:cwrite', name, text),
  keyboard: (mode, x, y, w, h) => ipcRenderer.invoke('st:kbd', { mode, x, y, w, h }),
});
