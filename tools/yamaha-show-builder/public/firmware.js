// Firmware versions as the kit reports them: Yamaha "V5.90", Shure "2.7.6", d&b "2.10.4".
// Compared number by number, so type minimums the way the maker writes them.
export const versionParts = (v) => (String(v || '').match(/\d+/g) || []).map(Number);

export function compareVersions(a, b) {
  const x = versionParts(a);
  const y = versionParts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

const squash = (s) =>
  String(s || '')
    .toUpperCase()
    .replace(/[\s_-]+/g, '');

// One rule a line: the model (or the start of it) and the oldest firmware you'll take.
//   CL 5.90      ULXD 2.7.6      D80 2.10.4      # comments are fine
export function firmwareRules(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.replace(/#.*/, '').trim())
    .map((line) => /^(.+?)\s+(v?\d[\w.]*)$/i.exec(line))
    .filter(Boolean)
    .map(([, model, min]) => ({ model: model.trim(), min }));
}
export function badFirmwareLines(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.replace(/#.*/, '').trim())
    .filter((line) => line && !/^(.+?)\s+(v?\d[\w.]*)$/i.test(line));
}

// null when no rule covers the model or the firmware isn't known; the longest matching rule wins
export function firmwareCheck(model, firmware, rules) {
  if (!firmware) return null;
  const m = squash(model);
  const rule = rules
    .filter((r) => squash(r.model) && m.startsWith(squash(r.model)))
    .sort((a, b) => squash(b.model).length - squash(a.model).length)[0];
  if (!rule) return null;
  return { ok: compareVersions(firmware, rule.min) >= 0, min: rule.min };
}
