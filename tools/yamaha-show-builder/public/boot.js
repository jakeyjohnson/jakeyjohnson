// Starts the app: the lock screen first when this copy has a password, then either the real app
// (unlocked) or demo mode. With no app server behind the page (the web demo), it goes straight to demo mode.
const $ = (id) => document.getElementById(id);
const KEY = 'kk-unlock';
const MODE = 'kk-mode';
const store = {
  get: (k) => { try { return sessionStorage.getItem(k) || localStorage.getItem(k); } catch { return null; } },
  set: (k, v, remember) => { try { (remember ? localStorage : sessionStorage).setItem(k, v); } catch { /* storage off */ } },
  clear: (k) => { try { sessionStorage.removeItem(k); localStorage.removeItem(k); } catch { /* storage off */ } },
};
const reload = () => location.reload();

async function post(path, body, token) {
  const res = await fetch(path, { method: 'POST', headers: { 'x-kk-key': token || '' }, body: JSON.stringify(body || {}) });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

async function runApp(token) {
  window.kkHost = { ...(window.kkHost || {}), token, lock: token ? () => { store.clear(KEY); reload(); } : null };
  document.body.classList.remove('booting');
  await import('./app.js');
}
async function runDemo(canExit) {
  window.kkHost = { ...(window.kkHost || {}), exitDemo: canExit ? () => { store.clear(MODE); reload(); } : null };
  document.body.classList.remove('booting');
  await import('./demo-bridge.js');
}

function showLock(info) {
  $('lockLicence').textContent = `Licence ${info.licence}`;
  $('lockScreen').hidden = false;
  document.body.classList.remove('booting');
  document.body.classList.add('locked');
  $('lockPassword').focus();
  $('lockForm').onsubmit = async (e) => {
    e.preventDefault();
    $('lockGo').disabled = true;
    $('lockError').textContent = '';
    try {
      const { ok, data } = await post('/api/unlock', { password: $('lockPassword').value });
      if (!ok) throw new Error(data.error || "That password isn't right.");
      store.set(KEY, data.token, $('lockRemember').checked);
      $('lockScreen').hidden = true;
      document.body.classList.remove('locked');
      await runApp(data.token);
    } catch (err) {
      $('lockError').textContent = err.message === 'Failed to fetch' ? 'The app has stopped. Open it again.' : err.message;
      $('lockPassword').select();
    } finally {
      $('lockGo').disabled = false;
    }
  };
  $('lockDemo').onclick = () => { store.set(MODE, 'demo', false); reload(); };
}

let info = null;
try { info = await (await fetch('/api/lock')).json(); } catch { /* no app server */ }
if (!info) await runDemo(false);
else if (store.get(MODE) === 'demo') await runDemo(true);
else if (!info.locked) await runApp(null);
else {
  const saved = store.get(KEY);
  if (saved && (await post('/api/check', {}, saved).catch(() => ({}))).ok) await runApp(saved);
  else { store.clear(KEY); showLock(info); }
}
