// Preferences: how this computer likes to work, kept on this computer (not in show files). IP presets
// let each IP box take just the last number; the rest are defaults for new shows, sending and checks.

export const DEFAULT_PREFS = {
  // Network: the start of each address, e.g. "192.168.1", so only the last number is typed
  deskPrefix: '', ampPrefix: '', rfPrefix: '', deskPort: 49280,
  // New shows and new kit
  deskModel: '', ampModel: 'D80', ampMode: 'dual', rxModel: 'ULXD4Q', txModel: 'P10T',
  micRange: [606.5, 613.5], iemRange: [470, 534], autoOrder: true, groups: true, maxNameLength: 8,
  // Sending to the desk
  backup: true, onlyChanges: true,
  // System check
  checkSource: 'channel', checkStart: -4000,
  // Your company: name and logo on paperwork, and the logo on rack plates
  company: '', preparedBy: '', companyLogo: '', logoWhite: true, defaultPlate: 'logo',
};

export function loadPrefs(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    return { ...DEFAULT_PREFS, ...(saved && typeof saved === 'object' ? saved : {}) };
  } catch { return { ...DEFAULT_PREFS }; }
}
export function savePrefs(key, prefs) {
  try { localStorage.setItem(key, JSON.stringify(prefs)); } catch { /* storage off: they last until the page closes */ }
}

// An IP prefix is one to three numbers 0-255 with dots between: "192.168.1", "10.0" or "10"
export function cleanPrefix(text) {
  const t = String(text || '').trim().replace(/\.+$/, '');
  if (!t) return '';
  const parts = t.split('.');
  return parts.length <= 3 && parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255) ? parts.map(Number).join('.') : null;
}
const isIp = (t) => /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(t) && t.split('.').every((p) => Number(p) <= 255);
// What was typed, made whole with the prefix: "60" with "192.168.1" is 192.168.1.60. A full address is
// kept as typed, so a device on another network can still be entered.
export function expandIp(text, prefix) {
  const t = String(text || '').trim().replace(/^\.+/, '');
  if (!t || isIp(t) || !prefix) return t;
  const whole = `${prefix}.${t}`;
  return isIp(whole) ? whole : t;
}
// The part to show in the box when the address starts with the prefix
export function ipTail(value, prefix) {
  const v = String(value || '');
  return prefix && v.startsWith(`${prefix}.`) ? v.slice(prefix.length + 1) : v;
}

// A logo file made ready to keep: SVGs as they are (up to 300 KB), pictures scaled to fit 800 × 240 as PNG.
// Resolves to a data: URL.
export function readLogo(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|svg\+xml|webp|gif)$/.test(file.type)) return reject(new Error('Use a PNG, JPG or SVG logo'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file"));
    if (file.type === 'image/svg+xml') {
      if (file.size > 300_000) return reject(new Error('That SVG is over 300 KB. Use a smaller one or a PNG.'));
      reader.onload = () => resolve(reader.result);
      return reader.readAsDataURL(file);
    }
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That picture didn't open"));
      img.onload = () => {
        const scale = Math.min(1, 800 / img.width, 240 / img.height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
