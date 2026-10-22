// The Preferences window: IP presets, defaults for new shows and kit, sending, system check and paperwork.
// Every change is saved straight away; Done closes it.
import { MODELS } from './plan.js';
import { AMP_MODELS, AMP_MODES, IEM_MODELS, RECEIVER_MODELS } from './rig.js';
import { RANGES } from './rig-ui.js';
import { DEFAULT_PREFS, cleanPrefix, readLogo } from './prefs.js';
import { el, info, segmented, toast, toggle } from './ui.js';

const options = (entries, value) => entries.map(([v, label]) => el('option', { value: v, textContent: label, selected: String(v) === String(value) }));

export function openPrefs({ prefs, save }) {
  document.getElementById('prefsDialog')?.remove();
  const set = (key, value) => { prefs[key] = value; save(); };
  const row = (label, control, tip) => el('div', { className: 'pref-row' }, el('span', { className: 'pref-label' }, label, tip ? info(tip) : null), control);
  const select = (key, entries, cast = String) => el('select', { 'aria-label': key, onchange: (e) => set(key, cast(e.target.value)) }, ...options(entries, prefs[key]));
  const prefix = (key, what) => {
    const input = el('input', {
      value: prefs[key], placeholder: 'e.g. 192.168.1', inputMode: 'decimal', className: 'ip', 'aria-label': `${what} IP start`,
      onchange: (e) => {
        const clean = cleanPrefix(e.target.value);
        if (clean === null) { input.classList.add('bad'); return toast(`${what}: type the start of the address, like 192.168.1`, 'bad'); }
        input.classList.remove('bad');
        input.value = clean;
        set(key, clean);
      },
    });
    return el('span', { className: 'pref-ip' }, input, el('span', { className: 'dim mono', textContent: '.__' }));
  };
  const range = (key) => {
    const [lo, hi] = prefs[key];
    const put = (i, v) => { const next = [...prefs[key]]; next[i] = Number(v) || next[i]; set(key, next); };
    return el('span', { className: 'range' },
      el('input', { type: 'number', step: '0.025', value: lo, className: 'freq', 'aria-label': `${key} from`, onchange: (e) => put(0, e.target.value) }), '–',
      el('input', { type: 'number', step: '0.025', value: hi, className: 'freq', 'aria-label': `${key} to`, onchange: (e) => put(1, e.target.value) }), 'MHz',
      el('select', { 'aria-label': `${key} preset`, onchange: (e) => { if (e.target.value) { set(key, [...RANGES[Number(e.target.value)].range]); render(); } } },
        el('option', { value: '', textContent: 'Preset' }), ...RANGES.map((r, i) => el('option', { value: i, textContent: r.label }))));
  };
  const section = (title, ...rows) => el('section', { className: 'pref-section' }, el('h3', { textContent: title }), ...rows);

  const body = el('div', { className: 'prefs-body' });
  function render() {
    body.replaceChildren(
      section('Network',
        row('Desks', prefix('deskPrefix', 'Desks'), 'The start of your desks\' addresses. The desk IP box then takes just the last number.'),
        row('Amps', prefix('ampPrefix', 'Amps')),
        row('Radio mics and IEMs', prefix('rfPrefix', 'RF'), 'For Shure receivers, IEM transmitters and the Spectera base station.'),
        row('Desk port', el('input', { type: 'number', min: 1, max: 65535, value: prefs.deskPort, className: 'port', 'aria-label': 'Desk port', onchange: (e) => set('deskPort', Math.round(Number(e.target.value)) || 49280) }))),
      section('New shows',
        row('Desk', select('deskModel', [['', 'Keep the current one'], ...Object.entries(MODELS).filter(([k]) => k !== 'custom').map(([k, m]) => [k, m.label])])),
        row('Auto channel order', toggle({ label: '', checked: prefs.autoOrder, onchange: (v) => set('autoOrder', v) })),
        row('DCAs and mute groups', toggle({ label: '', checked: prefs.groups, onchange: (v) => set('groups', v) })),
        row('Name length', select('maxNameLength', [[6, '6 letters'], [8, '8 letters'], [12, '12 letters'], [16, '16 letters']], Number), 'How many letters of each name the desk shows.')),
      section('Kit',
        row('Amps', el('span', { className: 'pref-pair' }, select('ampModel', Object.entries(AMP_MODELS).map(([k, m]) => [k, m.label])), select('ampMode', Object.entries(AMP_MODES)))),
        row('Receivers', select('rxModel', Object.entries(RECEIVER_MODELS).map(([k, m]) => [k, m.label]))),
        row('IEM transmitters', select('txModel', Object.entries(IEM_MODELS).map(([k, m]) => [k, m.label]))),
        row('Radio mic range', range('micRange')),
        row('IEM range', range('iemRange'))),
      section('Sending to the desk',
        row('Back up the desk first', toggle({ label: '', checked: prefs.backup, onchange: (v) => set('backup', v) }), 'Stores the desk\'s current scene before every send. A show can still turn it off.'),
        row('Only send what changed', toggle({ label: '', checked: prefs.onlyChanges, onchange: (v) => set('onlyChanges', v) }))),
      section('System check',
        row('Noise from', segmented(prefs.checkSource, [['channel', 'Input channel'], ['osc', 'Desk oscillator']], (v) => { set('checkSource', v); render(); }, 'Noise from')),
        row('Start at', select('checkStart', [[-5000, '−50 dB'], [-4000, '−40 dB'], [-3000, '−30 dB'], [-2000, '−20 dB']], Number))),
      section('Your company',
        row('Company', el('input', { value: prefs.company, placeholder: 'Your company', 'aria-label': 'Company', onchange: (e) => set('company', e.target.value.trim()) }), 'On the paperwork and prep sheet.'),
        row('Prepared by', el('input', { value: prefs.preparedBy, placeholder: 'Your name', 'aria-label': 'Prepared by', onchange: (e) => set('preparedBy', e.target.value.trim()) })),
        row('Logo', logoPicker(), 'PNG, JPG or SVG. It goes on rack plates you set to Company, and at the top of the paperwork and prep sheet.'),
        prefs.companyLogo ? row('White on rack plates', toggle({ label: '', checked: prefs.logoWhite, onchange: (v) => { set('logoWhite', v); render(); } }), 'Shows a dark logo in white on the dark plate. Paperwork prints it as it is.') : null,
        row('New racks get', segmented(prefs.defaultPlate, [['logo', 'KobiKraken'], ['company', 'Your logo']], (v) => { set('defaultPlate', v); render(); }, 'Plate for new racks'))));
  }
  function logoPicker() {
    const file = el('input', {
      type: 'file', accept: 'image/png,image/jpeg,image/svg+xml,image/webp', hidden: true,
      onchange: async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        try {
          set('companyLogo', await readLogo(f));
          if (prefs.defaultPlate === 'logo') set('defaultPlate', 'company');
          render();
          toast('Logo added. Set a rack\'s plate to Your logo on the Racks tab.', 'ok');
        } catch (err) { toast(err.message, 'bad'); }
      },
    });
    return el('span', { className: 'logo-pick' },
      prefs.companyLogo ? el('span', { className: `logo-preview ${prefs.logoWhite ? 'white' : ''}` }, el('img', { src: prefs.companyLogo, alt: 'Your logo' })) : null,
      el('label', { className: 'button ghost' }, prefs.companyLogo ? 'Change' : 'Choose logo…', file),
      prefs.companyLogo ? el('button', { className: 'ghost', type: 'button', textContent: 'Remove', onclick: () => { set('companyLogo', ''); if (prefs.defaultPlate === 'company') set('defaultPlate', 'logo'); render(); } }) : null);
  }
  render();
  const dialog = el('dialog', { id: 'prefsDialog', className: 'prefs', 'aria-label': 'Preferences' },
    el('header', { className: 'prefs-head' }, el('h2', { textContent: 'Preferences' }), el('span', { className: 'dim', textContent: 'Saved on this computer' })),
    body,
    el('footer', { className: 'prefs-foot' },
      el('button', { className: 'ghost', type: 'button', textContent: 'Reset all', onclick: () => { Object.assign(prefs, structuredClone(DEFAULT_PREFS)); save(); render(); toast('Preferences back to their defaults', 'ok'); } }),
      el('span', { className: 'grow' }),
      el('button', { className: 'primary', type: 'button', textContent: 'Done', onclick: () => dialog.close() })));
  dialog.addEventListener('close', () => dialog.remove());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  document.body.append(dialog);
  dialog.showModal();
}
