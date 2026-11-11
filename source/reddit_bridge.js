/* Reddit version: saves go to the player's Reddit account through the app's own server (reddit/src/server).
   It reuses the Steam Cloud code path: the game sees a "cloud" with read/write, and merges it with this browser's copy.
   Logged-out viewers have no cloud: their progress stays in the browser. */
window.SS_REDDIT = true;
window.SSSteam = (function () {
  async function j(url, opt) {
    const r = await fetch(url, opt);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  return {
    info: async function () {
      let me = {};
      try { me = await j('api/me'); } catch (e) {}
      return { on: true, cloud: !!(me && me.userId), reddit: true, name: (me && me.username) || '' };
    },
    cloudRead: async function () { const r = await j('api/save'); return r.text || null; },
    cloudWrite: async function (_name, text) {
      await j('api/save/put', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: text }) });
      return true;
    },
    unlock: async function () { return true; },
    presence: async function () { return true; },
    keyboard: async function () { return true; }
  };
})();
