// Per-computer prefs, not stored in show files.

export const DEFAULT_PREFS = {
  // IP prefixes, e.g. "192.168.1"
  deskPrefix: '',
  ampPrefix: '',
  rfPrefix: '',
  deskPort: 49280,
  // new shows and kit
  deskModel: '',
  ampModel: 'D80',
  ampMode: 'dual',
  rxModel: 'ULXD4Q',
  txModel: 'P10T',
  micRange: [606.5, 613.5],
  iemRange: [470, 534],
  autoOrder: true,
  groups: true,
  maxNameLength: 8,
  // sending
  backup: true,
  onlyChanges: true,
  // system check
  checkSource: 'channel',
  checkStart: -4000,
  // paperwork; logo also on rack plates
  company: '',
  preparedBy: '',
  companyLogo: '',
  logoWhite: true,
  defaultPlate: 'logo',
};

export function loadPrefs(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    return { ...DEFAULT_PREFS, ...(saved && typeof saved === 'object' ? saved : {}) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}
export function savePrefs(key, prefs) {
  try {
    localStorage.setItem(key, JSON.stringify(prefs));
  } catch {
    /* storage off: lasts until the page closes */
  }
}

// 1-3 octets: "192.168.1", "10.0", "10"
export function cleanPrefix(text) {
  const t = String(text || '')
    .trim()
    .replace(/\.+$/, '');
  if (!t) return '';
  const parts = t.split('.');
  return parts.length <= 3 && parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255)
    ? parts.map(Number).join('.')
    : null;
}
const isIp = (t) =>
  /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(t) && t.split('.').every((p) => Number(p) <= 255);
// "60" + "192.168.1" = 192.168.1.60. Full address kept as typed (other networks).
export function expandIp(text, prefix) {
  const t = String(text || '')
    .trim()
    .replace(/^\.+/, '');
  if (!t || isIp(t) || !prefix) return t;
  const whole = `${prefix}.${t}`;
  return isIp(whole) ? whole : t;
}
export function ipTail(value, prefix) {
  const v = String(value || '');
  return prefix && v.startsWith(`${prefix}.`) ? v.slice(prefix.length + 1) : v;
}

// SVG as-is (max 300 KB), images scaled into 800x240 PNG. Resolves to a data: URL.
export function readLogo(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|svg\+xml|webp|gif)$/.test(file.type))
      return reject(new Error('Use a PNG, JPG or SVG logo'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file"));
    if (file.type === 'image/svg+xml') {
      if (file.size > 300_000)
        return reject(new Error('That SVG is over 300 KB. Use a smaller one or a PNG.'));
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
