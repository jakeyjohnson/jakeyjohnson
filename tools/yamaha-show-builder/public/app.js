import { emptyShow, sendOf, nextZoneName, COLORS, MODELS, PACKAGES, SOURCE_TYPES, ZONE_TYPES, addSources, applySuggestion, buildPlan, defaultShow, hpfOf, makeZone, normalizeColor, orderSources, packageSuggestion, parseRequest, patchSheetCsv } from './plan.js';

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
  const busLabel = (zone) => {
    if (zone.type === 'main') return 'Stereo';
    const m = plan.mixes.find((x) => x.zone === zone);
    return m.stereo ? `Mix ${m.mix}/${m.mix + 1}` : `Mix ${m.mix}`;
  };
  const head = el('tr', {},
    el('th', { textContent: 'Ch' }), el('th', { textContent: 'Colour' }), el('th', { textContent: 'Name' }), el('th', { textContent: 'Type' }), el('th', { textContent: 'St' }), el('th', { textContent: 'HPF Hz' }),
    ...show.zones.map((zone) => el('th', { className: 'zone' },
      el('input', { value: zone.name, onchange: (e) => update(() => { zone.name = e.target.value; }) }),
      el('small', {}, busLabel(zone), ' ', el('button', { className: 'remove', title: 'Remove zone', textContent: '×', onclick: () => update(() => removeZone(zone)) })),
      zone.type === 'main' ? el('small', { textContent: 'Post' }) : el('button', {
        className: `send-point ${sendOf(zone)}`, textContent: sendOf(zone) === 'pre' ? 'Pre' : 'Post',
        title: 'Send point for every input to this zone. Click to switch pre/post fade.',
        onclick: () => update(() => { zone.send = sendOf(zone) === 'pre' ? 'post' : 'pre'; }),
      }))),
    el('th'));

  const rows = show.sources.map((source) => {
    const chs = plan.channels.filter((c) => c.source === source).map((c) => c.ch);
    return el('tr', {},
      el('td', { className: 'ch', textContent: chs.length > 1 ? `${chs[0]}–${chs[1]}` : chs[0] }),
      el('td', {}, colorSelect(source.color, (v) => update(() => { source.color = v; }))),
      el('td', { className: 'name' }, el('input', { value: source.name, onchange: (e) => update(() => { source.name = e.target.value; }) })),
      el('td', { className: 'type' }, el('select', { onchange: (e) => update(() => changeType(source, e.target.value)) },
        ...Object.entries(SOURCE_TYPES).map(([k, t]) => el('option', { value: k, textContent: t.label + (t.stereo ? ' (st)' : ''), selected: k === source.type })))),
      el('td', { className: 'route' }, el('input', {
        type: 'checkbox', checked: source.stereo, title: 'Stereo: uses an L/R pair of channels',
        onchange: (e) => update(() => { source.stereo = e.target.checked; }),
      })),
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
  const empty = !show.sources.length && el('tr', {}, el('td', { colSpan: show.zones.length + 7, className: 'type', textContent: 'No inputs yet. Add some above.' }));
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
  const zone = makeZone(type, nextZoneName(show, type));
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
  if (!plan.commands.length) return setStatus('Nothing to send yet. Add some inputs or outputs first.', 'bad');
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
const GROUPS = { speech: 'Speech', band: 'Band', talkback: 'Band', program: 'Playback', bgm: 'Playback' };
const groups = { Packages: Object.entries(PACKAGES).map(([key, pkg]) => el('button', {
  className: 'chip', textContent: `${pkg.label} (${pkg.sources.reduce((n, s) => n + ((s.stereo ?? SOURCE_TYPES[s.type].stereo) ? 2 : 1), 0)} ch)`,
  onclick: () => update(() => applySuggestion(show, packageSuggestion(key))),
})) };
for (const [type, t] of Object.entries(SOURCE_TYPES)) {
  const chip = el('button', { className: 'chip', textContent: t.label, onclick: () => update(() => addSources(show, type, Math.max(1, Number($('addCount').value) || 1))) });
  (groups[GROUPS[t.category]] ||= []).push(chip);
}
for (const [name, chips] of Object.entries(groups)) {
  $('addButtons').append(el('div', { className: 'chip-group' }, el('span', { className: 'chip-label', textContent: name }), el('div', { className: 'chips' }, ...chips)));
}
const zoneGroups = { 'Speakers · post-fade': [], 'Monitors · pre-fade': [] };
for (const [type, t] of Object.entries(ZONE_TYPES)) {
  zoneGroups[t.monitor ? 'Monitors · pre-fade' : 'Speakers · post-fade'].push(el('button', { className: 'chip', textContent: t.label, onclick: () => update(() => addZone(type)) }));
}
for (const [name, chips] of Object.entries(zoneGroups)) {
  $('zoneButtons').append(el('div', { className: 'chip-group zone-group' }, el('span', { className: 'chip-label', textContent: name }), el('div', { className: 'chips' }, ...chips)));
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
// New show wipes the page back to empty; Example loads the conference example. Both ask first unless the page is already empty.
let pendingShow = null;
function resetPage() {
  $('typeText').value = '';
  $('typePreview').hidden = true;
  typeStatus('');
  $('addCount').value = 1;
  $('log').textContent = '';
  $('log').hidden = true;
  $('progress').hidden = true;
  showCommands = false;
  $('toggleCommands').textContent = 'Show commands';
  setStatus('');
}
function startShow(next) {
  update(() => { show = next; });
  resetPage();
}
function askToReplace(next, text) {
  if (!show.sources.length && !show.zones.length) return startShow(next);
  pendingShow = next;
  $('newText').textContent = text;
  $('newConfirm').hidden = false;
  $('newYes').focus();
}
$('newShow').onclick = () => askToReplace(emptyShow(show.options.model), 'Start a new, empty show? This clears every input, output and setting on the page.');
$('exampleShow').onclick = () => askToReplace({ ...defaultShow(), options: { ...defaultShow().options, model: show.options.model } }, 'Load the example show? This replaces everything on the page.');
$('newYes').onclick = () => { $('newConfirm').hidden = true; startShow(pendingShow); };
$('newNo').onclick = () => { $('newConfirm').hidden = true; pendingShow = null; };
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

// ---- Typed requests: trigger words turn plain text into inputs and zones, offline ----
let suggestion = null;
function typeStatus(text, kind = '') {
  $('typeStatus').textContent = text;
  $('typeStatus').className = `status ${kind}`;
}
function previewTyped() {
  const s = parseRequest($('typeText').value, show);
  const unknown = s.unknown.length ? `Didn't recognise: ${s.unknown.join(', ')}` : '';
  if (!s.sources.length && !s.zones.length) {
    $('typePreview').hidden = true;
    return typeStatus(unknown || 'Type what you need, e.g. "full band and 4 wedges".', 'bad');
  }
  suggestion = s;
  typeStatus(unknown, unknown ? 'bad' : '');
  $('typeSummary').textContent = `Adds: ${s.summary}`;
  $('typeList').replaceChildren(
    ...s.sources.map((x) => el('li', { className: 'pill', textContent: `${x.count > 1 ? `${x.count} × ` : ''}${x.name}${(x.stereo ?? SOURCE_TYPES[x.type].stereo) ? ' (L/R)' : ''}` })),
    ...s.zones.map((z) => el('li', { className: 'pill zone-pill', textContent: `Zone: ${z.name}` })));
  $('typePreview').hidden = false;
}
$('typeGo').onclick = previewTyped;
$('typeText').onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); previewTyped(); } };
$('typeAdd').onclick = () => {
  update(() => applySuggestion(show, suggestion));
  $('typePreview').hidden = true;
  $('typeText').value = '';
  typeStatus('Added. Check the routing grid below.', 'ok');
};
$('typeDiscard').onclick = () => { $('typePreview').hidden = true; typeStatus(''); };
$('testDesk').onclick = testDesk;
$('pushDesk').onclick = pushDesk;
try { $('host').value = localStorage.getItem(`${STORE}-host`) || ''; } catch { /* ignore */ }

render();
