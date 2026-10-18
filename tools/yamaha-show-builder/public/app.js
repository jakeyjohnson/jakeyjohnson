import { COLORS, MODELS, SOURCE_TYPES, ZONE_TYPES, addSources, applySuggestion, buildPlan, defaultShow, hpfOf, makeZone, normalizeColor, orderSources, patchSheetCsv } from './plan.js';

const SWATCH = { Blue: '#3d6dff', Cyan: '#2fd6d6', Green: '#3fcf6e', Yellow: '#ffd23f', Orange: '#ff9234', Red: '#ff4d4d', Magenta: '#ff4fd8', Purple: '#9b6bff' };
const $ = (id) => document.getElementById(id);
const STORE = 'yamaha-show-builder';

let show = load() || defaultShow();
let showCommands = false;

function load() {
  try { return JSON.parse(localStorage.getItem(STORE)); } catch { return null; }
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(show)); } catch { /* private mode: fine */ }
}
function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter((c) => c != null));
  return node;
}
function colorSelect(color, onChange) {
  const value = normalizeColor(color);
  const sel = el('select', { title: 'Colour', onchange: (e) => onChange(e.target.value) },
    ...COLORS.map((c) => el('option', { value: c, textContent: c, selected: c === value })));
  sel.style.borderLeft = `6px solid ${SWATCH[value]}`;
  return sel;
}

function render() {
  if (show.options.autoOrder !== false) show.sources = orderSources(show.sources);
  const plan = buildPlan(show);
  const model = MODELS[show.options.model] || MODELS.custom;
  $('showName').value = show.name;
  $('model').value = MODELS[show.options.model] ? show.options.model : 'custom';
  $('maxLen').textContent = show.options.maxNameLength;
  for (const k of ['firstChannel', 'firstMix', 'maxNameLength']) $(k).value = show.options[k];
  $('setLevels').checked = show.options.setLevels;
  $('autoOrder').checked = show.options.autoOrder !== false;

  // Routing grid
  const busLabel = (zone) => zone.type === 'main' ? 'Stereo' : `Mix ${plan.mixes.find((m) => m.zone === zone).mix}`;
  const head = el('tr', {},
    el('th', { textContent: 'Ch' }), el('th', { textContent: 'Colour' }), el('th', { textContent: 'Name' }), el('th', { textContent: 'Type' }), el('th', { textContent: 'HPF Hz' }),
    ...show.zones.map((zone) => el('th', { className: 'zone' },
      el('input', { value: zone.name, onchange: (e) => update(() => { zone.name = e.target.value; }) }),
      el('small', {}, busLabel(zone), ' ', el('button', { className: 'remove', title: 'Remove zone', textContent: '×', onclick: () => update(() => removeZone(zone)) })))),
    el('th'));

  const rows = show.sources.map((source) => {
    const chs = plan.channels.filter((c) => c.source === source).map((c) => c.ch);
    return el('tr', {},
      el('td', { className: 'ch', textContent: chs.length > 1 ? `${chs[0]}–${chs[1]}` : chs[0] }),
      el('td', {}, colorSelect(source.color, (v) => update(() => { source.color = v; }))),
      el('td', { className: 'name' }, el('input', { value: source.name, onchange: (e) => update(() => { source.name = e.target.value; }) })),
      el('td', { className: 'type' }, el('select', { onchange: (e) => update(() => changeType(source, e.target.value)) },
        ...Object.entries(SOURCE_TYPES).map(([k, t]) => el('option', { value: k, textContent: t.label + (t.stereo ? ' (st)' : ''), selected: k === source.type })))),
      el('td', { className: 'hpf' }, el('input', {
        type: 'number', min: 0, max: 600, step: 10, value: hpfOf(source) || '', placeholder: 'off', title: 'High-pass filter in Hz (blank = off)',
        onchange: (e) => update(() => { source.hpf = Math.max(0, Math.round(Number(e.target.value) || 0)); }),
      })),
      ...show.zones.map((zone) => el('td', { className: 'route' }, el('input', {
        type: 'checkbox', checked: source.zones.includes(zone.id), title: `${source.name} → ${zone.name}`,
        onchange: (e) => update(() => {
          source.zones = e.target.checked ? [...source.zones, zone.id] : source.zones.filter((z) => z !== zone.id);
        }),
      }))),
      el('td', {}, ...moveButtons(source),
        el('button', { className: 'remove', title: 'Remove input', textContent: '×', onclick: () => update(() => { show.sources = show.sources.filter((s) => s !== source); }) })));
  });
  const empty = !show.sources.length && el('tr', {}, el('td', { colSpan: show.zones.length + 6, className: 'type', textContent: 'No inputs yet. Add some above.' }));
  $('grid').replaceChildren(el('thead', {}, head), el('tbody', {}, ...rows, empty || null));

  const of = (n) => (model.inputs ? ` of ${n}` : '');
  const spares = plan.spares.length ? `, ch ${plan.spares.join(', ')} left spare so stereo pairs start on odd channels` : '';
  const totals = `${plan.channels.length}${of(model.inputs)} input channels, ${plan.mixes.length}${of(model.mixes)} mixes, ${plan.commands.length} commands${spares}`;
  $('warnings').replaceChildren(el('li', { style: 'color: var(--muted); list-style: none; margin-left: -18px', textContent: totals }),
    ...[...new Set(plan.warnings)].map((w) => el('li', { textContent: w })));

  if (showCommands) {
    $('log').hidden = false;
    $('log').textContent = plan.commands.join('\n');
  }
  save();
  return plan;
}

function update(fn) { fn(); render(); }

// Up/down arrows, only when channels are ordered by hand
function moveButtons(source) {
  if (show.options.autoOrder !== false) return [];
  const move = (step) => update(() => {
    const i = show.sources.indexOf(source);
    const j = i + step;
    if (j < 0 || j >= show.sources.length) return;
    [show.sources[i], show.sources[j]] = [show.sources[j], show.sources[i]];
  });
  return [
    el('button', { className: 'remove', title: 'Move up', textContent: '↑', onclick: () => move(-1) }),
    el('button', { className: 'remove', title: 'Move down', textContent: '↓', onclick: () => move(1) }),
  ];
}

function removeZone(zone) {
  show.zones = show.zones.filter((z) => z !== zone);
  for (const s of show.sources) s.zones = s.zones.filter((z) => z !== zone.id);
}

function changeType(source, type) {
  const t = SOURCE_TYPES[type];
  Object.assign(source, { type, stereo: t.stereo, color: t.color, hpf: t.hpf });
  source.zones = show.zones.filter((z) => ZONE_TYPES[z.type].takes.includes(t.category)).map((z) => z.id);
}

function addZone(type) {
  if (type === 'main' && show.zones.some((z) => z.type === 'main')) return alert('There is already a Main L/R zone.');
  const same = show.zones.filter((z) => z.type === type).length;
  const zone = makeZone(type, type === 'delay' ? `Delay ${same + 1}` : same ? `${ZONE_TYPES[type].short.slice(0, 6)} ${same + 1}` : undefined);
  if (type === 'main') show.zones.unshift(zone); else show.zones.push(zone);
  // route existing inputs that this kind of zone would normally take
  for (const s of show.sources) {
    if (ZONE_TYPES[type].takes.includes(SOURCE_TYPES[s.type].category)) s.zones.push(zone.id);
  }
}

function download(name, text, type) {
  const a = el('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  a.click();
  URL.revokeObjectURL(a.href);
}
const fileBase = () => show.name.replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '') || 'show';

function setStatus(text, kind = '') {
  $('status').textContent = text;
  $('status').className = `status ${kind}`;
}
function deskTarget() {
  const host = $('host').value.trim();
  try { localStorage.setItem(`${STORE}-host`, host); } catch { /* ignore */ }
  return { host, port: Number($('port').value) || 49280 };
}

async function testDesk() {
  setStatus('Connecting…');
  try {
    const res = await fetch('/api/test', { method: 'POST', body: JSON.stringify(deskTarget()) });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    setStatus(data.ok ? `Connected: ${data.reply.replace(/^OK devinfo productname\s*/, '')}` : `Desk replied: ${data.reply}`, data.ok ? 'ok' : 'bad');
  } catch (err) {
    setStatus(err.message, 'bad');
  }
}

async function pushDesk() {
  const plan = buildPlan(show);
  const target = deskTarget();
  if (!target.host) return setStatus('Enter the desk IP first', 'bad');
  if (!confirm(`Send ${plan.commands.length} commands to the desk at ${target.host}?\n\nThis renames and re-routes the current scene. Store a backup scene on the desk first.`)) return;

  const log = $('log');
  const progress = $('progress');
  log.hidden = false;
  log.replaceChildren();
  progress.hidden = false;
  progress.value = 0;
  $('pushDesk').disabled = true;
  setStatus('Sending…');
  try {
    const res = await fetch('/api/push', { method: 'POST', body: JSON.stringify({ ...target, commands: plan.commands }) });
    if (!res.ok) throw new Error((await res.json()).error);
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines.filter(Boolean)) {
        const msg = JSON.parse(line);
        if (msg.error) throw new Error(msg.error);
        if (msg.done) {
          setStatus(msg.errors ? `Done with ${msg.errors} rejected commands (see log)` : `Done: ${msg.total} commands accepted`, msg.errors ? 'bad' : 'ok');
          continue;
        }
        progress.value = (msg.i + 1) / msg.total;
        log.append(el('div', { className: msg.ok ? '' : 'bad', textContent: msg.ok ? msg.cmd : `${msg.cmd}\n  ↳ ${msg.reply}` }));
      }
    }
  } catch (err) {
    setStatus(err.message, 'bad');
  } finally {
    $('pushDesk').disabled = false;
  }
}

// Static controls
const GROUPS = { speech: 'Speech', band: 'Band', program: 'Playback', bgm: 'Playback' };
const groups = {};
for (const [type, t] of Object.entries(SOURCE_TYPES)) {
  const chip = el('button', { className: 'chip', textContent: t.label, onclick: () => update(() => addSources(show, type, Math.max(1, Number($('addCount').value) || 1))) });
  (groups[GROUPS[t.category]] ||= []).push(chip);
}
for (const [name, chips] of Object.entries(groups)) {
  $('addButtons').append(el('div', { className: 'chip-group' }, el('span', { className: 'chip-label', textContent: name }), el('div', { className: 'chips' }, ...chips)));
}
for (const [type, t] of Object.entries(ZONE_TYPES)) {
  $('zoneButtons').append(el('button', { className: 'chip', textContent: t.label, onclick: () => update(() => addZone(type)) }));
}
const series = {};
for (const [id, m] of Object.entries(MODELS)) (series[m.series || ''] ||= []).push(el('option', { value: id, textContent: m.label }));
for (const [name, options] of Object.entries(series)) {
  $('model').append(name ? el('optgroup', { label: name === 'RIVAGE' ? 'RIVAGE PM' : `${name} series` }, ...options) : options[0]);
}
$('model').onchange = (e) => update(() => { show.options.model = e.target.value; });
$('showName').onchange =(e) => update(() => { show.name = e.target.value; });
for (const k of ['firstChannel', 'firstMix', 'maxNameLength']) {
  $(k).onchange = (e) => update(() => { show.options[k] = Math.max(1, Number(e.target.value) || 1); });
}
$('autoOrder').onchange = (e) => update(() => { show.options.autoOrder = e.target.checked; });
$('setLevels').onchange = (e) => update(() => { show.options.setLevels = e.target.checked; });
$('newShow').onclick = () => confirm('Start a new show? Unsaved changes are lost.') && update(() => { show = defaultShow(); });
$('saveShow').onclick = () => download(`${fileBase()}.show.json`, JSON.stringify(show, null, 2), 'application/json');
$('exportCsv').onclick = () => download(`${fileBase()}-patch.csv`, patchSheetCsv(show, buildPlan(show)), 'text/csv');
$('openFile').onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.sources) || !Array.isArray(data.zones)) throw new Error('Not a show file');
    update(() => { show = data; });
  } catch (err) { alert(`Could not open: ${err.message}`); }
  e.target.value = '';
};
$('toggleCommands').onclick = () => {
  showCommands = !showCommands;
  $('toggleCommands').textContent = showCommands ? 'Hide commands' : 'Show commands';
  if (!showCommands) $('log').hidden = true;
  render();
};

// ---- AI builder ----
let suggestion = null;
function aiStatus(text, kind = '') {
  $('aiStatus').textContent = text;
  $('aiStatus').className = `status ${kind}`;
}
function showSuggestion(s) {
  suggestion = s;
  if (!s.sources.length && !s.zones.length) return aiStatus('Claude found nothing to add. Try naming the instruments or mics.', 'bad');
  aiStatus('');
  $('aiSummary').textContent = s.summary;
  $('aiList').replaceChildren(
    ...s.sources.map((x) => el('li', { className: 'pill', textContent: `${x.count > 1 ? `${x.count} × ` : ''}${x.name} · ${SOURCE_TYPES[x.type].label}` })),
    ...s.zones.map((z) => el('li', { className: 'pill zone-pill', textContent: `Zone: ${z.name}` })));
  $('aiPreview').hidden = false;
}
$('aiAdd').onclick = () => {
  update(() => applySuggestion(show, suggestion));
  $('aiPreview').hidden = true;
  $('aiText').value = '';
  aiStatus('Added. Check the routing grid below.', 'ok');
};
$('aiDiscard').onclick = () => { $('aiPreview').hidden = true; aiStatus(''); };
$('aiGo').onclick = async () => {
  const request = $('aiText').value.trim();
  if (!request) return aiStatus('Describe what you want to add first.', 'bad');
  $('aiGo').disabled = true;
  $('aiPreview').hidden = true;
  aiStatus('Asking Claude… this can take up to a minute.');
  try {
    const res = await fetch('/api/suggest', { method: 'POST', body: JSON.stringify({ request, show }) });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    showSuggestion(data);
  } catch (err) {
    aiStatus(err.message, 'bad');
  } finally {
    $('aiGo').disabled = false;
  }
};
$('testDesk').onclick = testDesk;
$('pushDesk').onclick = pushDesk;
try { $('host').value = localStorage.getItem(`${STORE}-host`) || ''; } catch { /* ignore */ }

render();
