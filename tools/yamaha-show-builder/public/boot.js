import { logError } from './log.js';

// Lock screen, then the real app or demo. No app server (web demo) goes straight to demo.
const $ = (id) => document.getElementById(id);
const KEY = 'kk-licence';
const MODE = 'kk-mode';
const store = {
  get: (k) => {
    try {
      return sessionStorage.getItem(k) || localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v, remember) => {
    try {
      (remember ? localStorage : sessionStorage).setItem(k, v);
    } catch {
      /* storage off */
    }
  },
  clear: (k) => {
    try {
      sessionStorage.removeItem(k);
      localStorage.removeItem(k);
    } catch {
      /* storage off */
    }
  },
};
const reload = () => location.reload();

async function post(path, body, token) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'x-kk-key': token || '' },
    body: JSON.stringify(body || {}),
  });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

async function runApp(token, licence) {
  window.kkHost = {
    ...(window.kkHost || {}),
    token,
    licence,
    lock: token
      ? () => {
          store.clear(KEY);
          reload();
        }
      : null,
  };
  document.body.classList.remove('booting');
  await import('./app.js');
}
async function runDemo(canExit) {
  window.kkHost = {
    ...(window.kkHost || {}),
    exitDemo: canExit
      ? () => {
          store.clear(MODE);
          reload();
        }
      : null,
  };
  document.body.classList.remove('booting');
  await import('./demo-bridge.js');
}

// Five boxes of four after the fixed SB. Typing runs on to the next box, a pasted key spreads across
// all of them, backspace on an empty box goes back. An old KK1- key pasted anywhere is kept whole.
const boxes = () => [...document.querySelectorAll('.key-box')];
const clean = (s) => s.toUpperCase().replace(/[^0-9A-Z]/g, '');
let longKey = '';
function keyValue() {
  return (
    longKey ||
    `SB-${boxes()
      .map((b) => b.value)
      .join('-')}`
  );
}
function fillFrom(start, text) {
  const all = boxes();
  let rest = clean(text);
  for (let i = start; i < all.length && rest; i++) {
    all[i].value = rest.slice(0, 4);
    rest = rest.slice(4);
  }
  const next = all.find((b) => b.value.length < 4) || $('lockGo');
  next.focus();
}
function setLong(text) {
  longKey = text.trim();
  for (const b of boxes()) b.value = '';
  $('keyBoxes').classList.toggle('long', Boolean(longKey));
  $('lockLong').hidden = !longKey;
}
function wireKeyBoxes() {
  const all = boxes();
  all[0].focus();
  $('lockLongClear').onclick = () => {
    setLong('');
    all[0].focus();
  };
  all.forEach((box, i) => {
    box.addEventListener('paste', (e) => {
      const text = e.clipboardData.getData('text');
      e.preventDefault();
      if (/^\s*KK1/i.test(text)) return setLong(text);
      setLong('');
      const body = text.trim().replace(/^SB[\s-]*/i, '');
      fillFrom(clean(body).length > 4 ? 0 : i, body);
    });
    box.addEventListener('input', () => {
      const v = clean(box.value);
      if (v.length > 4) return fillFrom(i, v);
      box.value = v;
      if (v.length === 4) (all[i + 1] || $('lockGo')).focus();
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && i > 0) {
        e.preventDefault();
        all[i - 1].focus();
        all[i - 1].value = all[i - 1].value.slice(0, -1);
      } else if (e.key === 'ArrowLeft' && box.selectionStart === 0 && i > 0) all[i - 1].focus();
      else if (e.key === 'ArrowRight' && box.selectionStart === box.value.length && all[i + 1])
        all[i + 1].focus();
      else if (e.key === 'Enter') {
        e.preventDefault();
        $('lockForm').requestSubmit();
      }
    });
  });
}

function showLock(info) {
  $('lockLicence').textContent = 'Enter your licence key';
  $('lockScreen').hidden = false;
  document.body.classList.remove('booting');
  document.body.classList.add('locked');
  wireKeyBoxes();
  $('lockForm').onsubmit = async (e) => {
    e.preventDefault();
    $('lockGo').disabled = true;
    $('lockError').textContent = '';
    try {
      const { ok, data } = await post('/api/unlock', { key: keyValue() });
      if (!ok) throw new Error(data.error || "That key isn't valid.");
      store.set(KEY, data.token, $('lockRemember').checked);
      $('lockScreen').hidden = true;
      document.body.classList.remove('locked');
      await runApp(data.token, data.licence);
    } catch (err) {
      $('lockError').textContent =
        err.message === 'Failed to fetch' ? 'The app has stopped. Open it again.' : err.message;
      logError('unlock', err.message);
      document.querySelector('.key-box').focus();
    } finally {
      $('lockGo').disabled = false;
    }
  };
  $('lockDemo').onclick = () => {
    store.set(MODE, 'demo', false);
    reload();
  };
}

let info = null;
try {
  info = await (await fetch('/api/lock')).json();
} catch {
  /* no app server */
}
if (!info) await runDemo(false);
else if (store.get(MODE) === 'demo') await runDemo(true);
else if (!info.locked) await runApp(null, null);
else {
  const saved = store.get(KEY);
  const check = saved ? await post('/api/check', {}, saved).catch(() => ({})) : {};
  if (check.ok) await runApp(saved, check.data.licence);
  else {
    store.clear(KEY);
    showLock(info);
  }
}
