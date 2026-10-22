// Error log, kept in localStorage so it survives a reload. Downloadable from Preferences.
const KEY = 'kk-log';
const MAX = 400;

export function readLog() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

export function logError(source, message, detail = '') {
  const entries = readLog();
  entries.push({
    t: new Date().toISOString(),
    source,
    message: String(message || ''),
    detail: String(detail || ''),
  });
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX)));
  } catch {
    /* storage full or off */
  }
}

export function clearLog() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage off */
  }
}

window.addEventListener('error', (e) =>
  logError('page', e.message, e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : ''),
);
window.addEventListener('unhandledrejection', (e) =>
  logError('page', e.reason?.message || String(e.reason), e.reason?.stack || ''),
);

// header: [label, value] pairs. server: entries from GET /api/log, if the app server is running.
export function logText({ header = [], server = [] }) {
  const pad = (s, n) => String(s).padEnd(n);
  const lines = ['KobiKraken Show Builder error log', ''];
  for (const [k, v] of header) lines.push(`${pad(`${k}:`, 14)}${v}`);
  const all = [
    ...readLog().map((e) => ({ ...e, from: e.source })),
    ...server.map((e) => ({ t: e.t, from: 'server', message: `${e.where}: ${e.message}`, detail: '' })),
  ].sort((a, b) => a.t.localeCompare(b.t));
  lines.push('', `${all.length} entries, oldest first`, '');
  for (const e of all) {
    lines.push(`${e.t}  ${pad(e.from, 7)} ${e.message}`);
    if (e.detail) lines.push(...e.detail.split('\n').map((l) => `    ${l}`));
  }
  return `${lines.join('\n')}\n`;
}
