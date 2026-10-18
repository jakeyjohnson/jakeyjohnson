import { LICENCE, PRODUCT, VERSION } from './about.js';
import { rigPaperwork } from './rig.js';
import { mountRig } from './rig-ui.js';
import {
  applyTemplate, changedCommands, cueCommand, deskCaps, gainOf, makeTemplate, monitorShow, pairMonitors, paperwork, parseInputList, phantomOf,
  rememberPush, sceneStoreCommand,
} from './plan.js';
import { modelFromProduct, patchBanks, portLabel, emptyShow, sendOf, nextZoneName, COLORS, MODELS, PACKAGES, SOURCE_TYPES, ZONE_TYPES, addSources, applySuggestion, buildPlan, defaultShow, hpfOf, makeZone, normalizeColor, orderSources, packageSuggestion, parseRequest, patchSheetCsv } from './plan.js';

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
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k.includes('-') || k === 'list') node.setAttribute(k, v); // aria-* and list are attributes only
    else node[k] = v;
  }
  node.append(...children.filter((c) => c != null && c !== false));
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
  $('safeStart').checked = show.options.safeStart !== false;
  $('autoOrder').checked = show.options.autoOrder !== false;

  // Routing grid
  const busLabel = (zone) => {
    if (zone.type === 'main') return 'Stereo';
    const m = plan.mixes.find((x) => x.zone === zone);
    return m.stereo ? `Mix ${m.mix}/${m.mix + 1}` : `Mix ${m.mix}`;
  };
  const head = el('tr', {},
    el('th', { textContent: 'Ch' }), el('th', { textContent: 'Colour' }), el('th', { textContent: 'Name' }), el('th', { textContent: 'Type' }), el('th', { textContent: 'St' }), el('th', { textContent: 'HPF Hz' }), el('th', { textContent: 'Gain target dB', title: 'Safe start sends the lowest gain; bring it up to this at line check' }), el('th', { textContent: '48V' }), el('th', { className: 'zone all-col', textContent: 'All' }),
    ...show.zones.map((zone) => el('th', { className: 'zone' },
      el('input', { value: zone.name, onchange: (e) => update(() => { zone.name = e.target.value; }) }),
      el('small', {}, busLabel(zone), ' ', el('button', { className: 'remove', title: 'Remove zone', textContent: '×', onclick: () => update(() => removeZone(zone)) })),
      zone.type === 'main' ? el('small', { textContent: 'Post' }) : el('button', {
        className: `send-point ${sendOf(zone)}`, textContent: sendOf(zone) === 'pre' ? 'Pre' : 'Post',
        title: 'Click to switch every send to this output between pre and post fade.',
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
        type: 'checkbox', checked: source.stereo, title: 'Stereo: takes two channels, L and R',
        onchange: (e) => update(() => { source.stereo = e.target.checked; }),
      })),
      el('td', { className: 'hpf' }, el('input', {
        type: 'number', min: 0, max: 600, step: 10, value: hpfOf(source) || '', placeholder: 'off', title: 'High-pass filter in Hz. Leave it blank for off.',
        onchange: (e) => update(() => { source.hpf = Math.max(0, Math.round(Number(e.target.value) || 0)); }),
      })),
      el('td', { className: 'gain' }, el('input', {
        type: 'number', min: -6, max: 66, step: 1, value: gainOf(source), title: 'Head-amp gain in dB',
        onchange: (e) => update(() => { source.gain = Math.min(66, Math.max(-6, Math.round(Number(e.target.value) || 0))); }),
      })),
      el('td', { className: 'route' }, el('input', {
        type: 'checkbox', checked: phantomOf(source), title: '48V phantom power',
        onchange: (e) => update(() => { source.phantom = e.target.checked; }),
      })),
      el('td', { className: 'route all-col' }, el('input', {
        type: 'checkbox', checked: show.zones.length > 0 && show.zones.every((z) => source.zones.includes(z.id)),
        'aria-label': `${source.name} to every output`, title: 'Send to every output',
        onchange: (e) => update(() => { source.zones = e.target.checked ? show.zones.map((z) => z.id) : []; }),
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
  const empty = !show.sources.length && el('tr', {}, el('td', { colSpan: show.zones.length + 10, className: 'type', textContent: 'Nothing here yet. Add some inputs above.' }));
  $('grid').replaceChildren(el('thead', {}, head), el('tbody', {}, ...rows, empty || null));

  const of = (n) => (model.inputs ? ` of ${n}` : '');
  const spares = plan.spares.length ? `, ch ${plan.spares.join(', ')} left empty so stereo pairs start on an odd channel` : '';
  const totals = `${plan.channels.length}${of(model.inputs)} input channels, ${plan.mixes.length}${of(model.mixes)} mixes, ${plan.commands.length} commands${spares}`;
  $('warnings').replaceChildren(el('li', { style: 'color: var(--muted); list-style: none; margin-left: -18px', textContent: totals }),
    ...[...new Set(plan.warnings)].map((w) => el('li', { textContent: w })));

  if (showCommands) {
    $('log').hidden = false;
    $('log').textContent = plan.commands.join('\n');
  }
  renderPatch(plan, model);
  renderGroups(plan, model);
  renderSendOptions(plan, model);
  renderLineCheck(plan, model);
  rigUi.renderRios($('rioBox'));
  if (activeTab === 'amps') rigUi.renderAmps($('ampsMain'));
  if (activeTab === 'rf') rigUi.renderRf($('rfMain'));
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
  Object.assign(source, { type, stereo: t.stereo, color: t.color, hpf: t.hpf, gain: t.gain, phantom: t.phantom });
  source.zones = show.zones.filter((z) => ZONE_TYPES[z.type].takes.includes(t.category)).map((z) => z.id);
}

function addZone(type) {
  if (type === 'main' && show.zones.some((z) => z.type === 'main')) return alert("You've already got a Main L/R.");
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
// ---- Desk connection: the app server holds one live connection and reports every change ----
let link = { state: 'idle' };
function showLink(s) {
  const was = link.state;
  link = s;
  $('linkDot').className = `link-dot ${s.state}`;
  const text = {
    idle: s.error || 'Not connected',
    connecting: `Connecting to ${s.host}…`,
    connected: `Connected to ${s.product || 'the desk'} at ${s.host}`,
    lost: `${s.error} Check the cable, then reconnect.`,
  }[s.state];
  $('linkStatus').textContent = text;
  $('linkStatus').className = `status ${s.state === 'connected' ? 'ok' : s.error ? 'bad' : ''}`;
  const btn = $('connectBtn');
  btn.textContent = { idle: 'Connect', connecting: 'Connecting…', connected: 'Disconnect', lost: 'Reconnect' }[s.state];
  btn.className = s.state === 'connected' ? 'ghost' : 'primary';
  btn.disabled = s.state === 'connecting';
  $('host').disabled = $('port').disabled = s.state === 'connected' || s.state === 'connecting';
  if (s.state === 'connected' && was !== 'connected') matchModel(s.product);
  if (s.state !== was) render();
}
// Set the desk model from the name the desk reports, when it's one the app knows
function matchModel(product) {
  const id = modelFromProduct(product);
  if (id && id !== show.options.model) {
    update(() => { show.options.model = id; });
    setStatus(`Desk model set to ${MODELS[id].label} to match the desk.`, 'ok');
  } else if (/RIVAGE|PM\d/i.test(product || '')) {
    setStatus('RIVAGE desks vary by DSP engine: pick yours under Desk model.');
  }
}
async function connectDesk() {
  if (link.state === 'connected') {
    await fetch('/api/disconnect', { method: 'POST' });
    return;
  }
  const host = $('host').value.trim();
  if (!host) {
    showLink({ state: 'idle', error: 'Type the desk IP first.' });
    return $('host').focus();
  }
  try { localStorage.setItem(`${STORE}-host`, host); } catch { /* ignore */ }
  showLink({ state: 'connecting', host });
  try {
    const res = await fetch('/api/connect', { method: 'POST', body: JSON.stringify({ host, port: Number($('port').value) || 49280 }) });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    showLink(data);
  } catch (err) {
    showLink({ state: 'idle', host, error: err.message === 'Failed to fetch' ? 'The app server has stopped. Start it again with npm start.' : err.message });
  }
}
const events = new EventSource('/api/events');
events.onmessage = (e) => showLink(JSON.parse(e.data));
events.onerror = () => { if (link.state === 'connected') showLink({ state: 'lost', host: link.host, error: 'Lost touch with the app server.' }); };
$('connectBtn').onclick = connectDesk;
$('host').onkeydown = (e) => { if (e.key === 'Enter') connectDesk(); };

// ---- Find devices on the network ----
const KINDS = [['desk', 'Desks'], ['stagebox', 'Stage boxes'], ['radio', 'Radio mics'], ['amp', 'Amps'], ['playback', 'Playback'], ['other', 'Other']];
async function findDevices() {
  $('findPanel').hidden = false;
  const subnet = $('findSubnet').value.trim();
  $('findStatus').className = 'status';
  $('findStatus').textContent = subnet ? `Looking on ${subnet}.x…` : 'Looking on this network… (about 10 seconds)';
  $('findBtn').disabled = $('findAgain').disabled = true;
  try {
    const res = await fetch('/api/discover', { method: 'POST', body: JSON.stringify({ subnet }) });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    showDevices(data);
  } catch (err) {
    $('findStatus').className = 'status bad';
    $('findStatus').textContent = err.message === 'Failed to fetch' ? 'The app server has stopped. Start it again with npm start.' : err.message;
  } finally {
    $('findBtn').disabled = $('findAgain').disabled = false;
  }
}
function showDevices({ devices, subnets }) {
  const where = subnets.length ? subnets.join(', ') : 'this computer only (no network found)';
  $('findStatus').className = `status ${devices.length ? 'ok' : ''}`;
  $('findStatus').textContent = devices.length
    ? `Found ${devices.length} ${devices.length === 1 ? 'device' : 'devices'} on ${where}.`
    : `Nothing found on ${where}. Check the network cable, or try another network.`;
  const groups = KINDS.map(([kind, title]) => {
    const list = devices.filter((d) => d.kind === kind);
    if (!list.length) return null;
    const ul = el('ul');
    for (const d of list) {
      const who = el('span', { className: 'who' });
      who.append(el('b', { textContent: [d.make, d.model].filter(Boolean).join(' ') }),
        el('small', { textContent: [d.ip || 'no address sent', d.name && d.name !== d.model ? d.name : ''].filter(Boolean).join(' · ') }));
      who.title = `Found by: ${d.via.join(', ')}`;
      const li = el('li');
      li.append(who);
      if (d.make === 'Yamaha' && d.kind === 'desk' && d.ip) {
        const use = el('button', { className: 'primary', textContent: 'Use this desk' });
        use.onclick = async () => {
          if (link.state === 'connected') await fetch('/api/disconnect', { method: 'POST' });
          $('host').value = d.ip;
          $('port').value = d.port || 49280;
          link.state = 'idle';
          connectDesk();
        };
        li.append(use);
      } else if (d.ip && (d.kind === 'amp' || d.kind === 'radio')) {
        const targets = rigUi.ipTargets().filter((t) => t.kind === d.kind);
        li.append(el('select', {
          'aria-label': `Use ${d.ip} for`,
          onchange: (e) => { const t = targets[Number(e.target.value)]; if (t) { update(() => t.set(d.ip)); $('findStatus').textContent = `${d.ip} is now ${t.label}.`; } e.target.value = ''; },
        }, el('option', { value: '', textContent: 'Use for…' }), ...targets.map((t, i) => el('option', { value: String(i), textContent: t.label }))));
      }
      ul.append(li);
    }
    const g = el('div', { className: 'find-group' });
    g.append(el('h3', { textContent: title }), ul);
    return g;
  }).filter(Boolean);
  $('findList').replaceChildren(...groups);
}
$('findBtn').onclick = findDevices;
$('findAgain').onclick = findDevices;
$('findSubnet').onkeydown = (e) => { if (e.key === 'Enter') findDevices(); };
$('findClose').onclick = () => { $('findPanel').hidden = true; };

// ---- Desk / Amplifiers / RF tabs ----
const TAB_KEY = `${STORE}-tab`;
let activeTab = (() => { try { return localStorage.getItem(TAB_KEY) || 'desk'; } catch { return 'desk'; } })();
function showTab(tab) {
  activeTab = ['desk', 'amps', 'rf'].includes(tab) ? tab : 'desk';
  try { localStorage.setItem(TAB_KEY, activeTab); } catch { /* storage off */ }
  for (const t of ['desk', 'amps', 'rf']) {
    $(`tab-${t}`).hidden = t !== activeTab;
    $(`tabBtn-${t}`).setAttribute('aria-selected', String(t === activeTab));
  }
  render();
}
for (const t of ['desk', 'amps', 'rf']) $(`tabBtn-${t}`).onclick = () => showTab(t);

// How the Amplifiers and RF tabs reach the kit: through this app's server
const rigUi = mountRig({
  getShow: () => show,
  update,
  transport: {
    shure: async (host, lines, check, onLine) => {
      try { return await streamLines('/api/shure', { host, lines, check }, onLine); } catch (err) { return { error: err.message }; }
    },
    specteraDevices: async (host, password) => {
      const res = await fetch('/api/spectera/devices', { method: 'POST', body: JSON.stringify({ host, password }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data.devices;
    },
    specteraPush: async (host, password, writes) => {
      const res = await fetch('/api/spectera/push', { method: 'POST', body: JSON.stringify({ host, password, writes }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data.results;
    },
  },
});

// Streams one JSON line per command from the app server and hands each to onLine
async function streamLines(path, body, onLine) {
  const res = await fetch(path, { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json()).error);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  let summary = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines.filter(Boolean)) {
      const msg = JSON.parse(line);
      if (msg.error) throw new Error(msg.error);
      if (msg.done) summary = msg;
      else onLine(msg);
    }
  }
  return summary;
}
function startLog() {
  $('log').hidden = false;
  $('log').replaceChildren();
  $('progress').hidden = false;
  $('progress').value = 0;
}
function logLine(msg, okText, badText) {
  $('progress').value = (msg.i + 1) / msg.total;
  $('log').append(el('div', { className: msg.ok ? '' : 'bad', textContent: msg.ok ? okText(msg) : badText(msg) }));
}

async function pushDesk() {
  const plan = buildPlan(show);
  const model = MODELS[show.options.model] || MODELS.custom;
  if (!plan.commands.length) return setStatus('Add some inputs or outputs first.', 'bad');
  if (link.state !== 'connected') {
    setStatus('Connect to the desk first, at the top of the page.', 'bad');
    return $('host').focus();
  }
  const last = loadLast();
  const onlyChanges = Boolean(last) && show.options.onlyChanges !== false;
  const commands = onlyChanges ? changedCommands(plan.commands, last) : plan.commands;
  if (!commands.length) return setStatus('Nothing has changed since the last push.', 'ok');
  const caps = deskCaps(model);
  const backup = show.options.backup || {};
  const scene = backup.scene || caps?.sceneMax;
  const backupCmd = caps && backup.on !== false ? sceneStoreCommand(model, scene) : null;
  const what = onlyChanges ? `${commands.length} changed lines` : 'this show';
  const safety = backupCmd ? `First it stores the desk's current scene as scene ${scene}, overwriting what's there.` : 'It renames and re-routes the current scene, so store a backup scene first.';
  if (!confirm(`Send ${what} to ${link.product || 'the desk'} at ${link.host}?\n\n${safety}`)) return;

  startLog();
  $('pushDesk').disabled = true;
  const sent = [];
  try {
    if (backupCmd) {
      setStatus(`Backing up to scene ${scene}…`);
      const result = await streamLines('/api/push', { commands: [backupCmd] }, (msg) => logLine(msg, (m) => `${m.cmd}  (backup)`, (m) => `${m.cmd}\n  ↳ ${m.reply}`));
      if (result?.errors) return setStatus(`The desk refused the backup, so nothing else was sent. Store a scene by hand, or untick the backup.`, 'bad');
    }
    setStatus('Sending…');
    const result = await streamLines('/api/push', { commands }, (msg) => {
      if (msg.ok) sent.push(msg.cmd);
      logLine(msg, (m) => m.cmd, (m) => `${m.cmd}\n  ↳ ${m.reply}`);
    });
    const backedUp = backupCmd ? ` Your old scene is safe in scene ${scene}.` : '';
    setStatus(result.errors ? `Sent, but the desk refused ${result.errors} lines. They're in red in the log.${backedUp}` : `Sent. The desk took ${result.total === 1 ? 'the 1 line' : `all ${result.total} lines`}.${backedUp}`, result.errors ? 'bad' : 'ok');
  } catch (err) {
    setStatus(err.message, 'bad');
  } finally {
    if (sent.length) saveLast(rememberPush(last, sent));
    $('pushDesk').disabled = false;
    render();
  }
}

async function verifyDesk() {
  const plan = buildPlan(show);
  if (link.state !== 'connected') {
    setStatus('Connect to the desk first, at the top of the page.', 'bad');
    return $('host').focus();
  }
  startLog();
  $('verifyDesk').disabled = true;
  setStatus('Reading the desk back…');
  try {
    const result = await streamLines('/api/verify', { commands: plan.commands }, (msg) => {
      if (!msg.ok) logLine(msg, () => '', (m) => `${m.cmd}\n  ↳ the desk has: ${m.reply.replace(/^OK get \S+ \d+ \d+ /, '')}`);
      else $('progress').value = (msg.i + 1) / msg.total;
    });
    setStatus(result.wrong ? `${result.wrong} of ${result.total} settings don't match the show. They're in the log.` : `The desk matches the show. All ${result.total} settings checked.`, result.wrong ? 'bad' : 'ok');
    if (!result.wrong) $('log').hidden = true;
  } catch (err) {
    setStatus(err.message, 'bad');
  } finally {
    $('verifyDesk').disabled = false;
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
$('addButtons').children[0].after(el('div', { className: 'chip-group', id: 'tplGroup', hidden: true },
  el('span', { className: 'chip-label', textContent: 'Yours' }), el('div', { className: 'chips', id: 'tplChips' })));
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
$('safeStart').onchange = (e) => update(() => { show.options.safeStart = e.target.checked; });
// New show wipes the page back to empty; Example loads the conference example. Both ask first unless the page is already empty.
let pendingShow = null;
function resetPage() {
  $('typeText').value = '';
  $('pasteText').value = '';
  $('monStatus').textContent = '';
  $('tplBar').hidden = true;
  soloKey = null;
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
$('newShow').onclick = () => askToReplace(emptyShow(show.options.model), "Start again with an empty show? You'll lose everything on this page.");
$('exampleShow').onclick = () => askToReplace({ ...defaultShow(), options: { ...defaultShow().options, model: show.options.model } }, 'Load the example? It replaces everything on this page.');
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
  } catch (err) { alert(`Couldn't open that file: ${err.message}`); }
  e.target.value = '';
};
$('toggleCommands').onclick = () => {
  showCommands = !showCommands;
  $('toggleCommands').textContent = showCommands ? 'Hide commands' : 'Show commands';
  if (!showCommands) $('log').hidden = true;
  render();
};

// ---- Patch: inputs and outputs onto Analogue, Card and Dante ports ----
const range = (p, n) => (p ? (n > 1 ? `${portLabel(p)}–${p.port + n - 1}` : portLabel(p)) : 'unpatched');
function bankSelect(banks, value, autoText, onChange) {
  return el('select', { 'aria-label': 'Patch', onchange: (e) => onChange(e.target.value) },
    ...(autoText ? [el('option', { value: 'auto', textContent: autoText, selected: !value })] : []),
    ...banks.map((b) => el('option', { value: b.key, textContent: `${b.label} (${b.first || 1}–${(b.first || 1) + b.size - 1})`, selected: value === b.key })));
}
function patchControl(target, banks, autoText) {
  const fixed = target.patch;
  return el('div', { className: 'patch-cell' },
    bankSelect(banks, fixed?.bank, autoText, (bank) => update(() => { target.patch = bank === 'auto' ? undefined : { bank, port: fixed?.port || 1 }; })),
    fixed && el('input', {
      type: 'number', min: 1, value: fixed.port, className: 'port', 'aria-label': 'Port number',
      onchange: (e) => update(() => { target.patch = { bank: fixed.bank, port: Math.max(1, Math.round(Number(e.target.value) || 1)) }; }),
    }));
}
function startControl(id, banks, opt) {
  const current = show.options[opt] || { bank: banks[0]?.key, port: 1 };
  $(`${id}Bank`).replaceChildren(...bankSelect(banks, current.bank, null, () => {}).children);
  $(`${id}Bank`).value = current.bank;
  $(`${id}Bank`).onchange = (e) => update(() => { show.options[opt] = { bank: e.target.value, port: 1 }; });
  $(`${id}Port`).value = current.port || 1;
  $(`${id}Port`).onchange = (e) => update(() => { show.options[opt] = { bank: $(`${id}Bank`).value, port: Math.max(1, Math.round(Number(e.target.value) || 1)) }; });
}
function renderPatch(plan, model) {
  const inBanks = patchBanks(model, 'in', show.rios);
  const outBanks = patchBanks(model, 'out', show.rios);
  const sends = plan.patchOnDesk.outputs;
  $('patchNote').textContent = sends
    ? `The app patches your outputs on the ${model.label}. The desk won't let it touch the input patch, so plug inputs in from this list or the patch sheet.`
    : model.inputs
      ? `The ${model.label} won't take patch changes from the app. Patch it on the desk from this list or the patch sheet.`
      : 'Pick your desk at the top to see its real sockets.';
  $('sendPatchRow').hidden = !sends;
  $('sendPatch').checked = show.options.sendPatch !== false;
  startControl('inStart', inBanks, 'inPatch');
  startControl('outStart', outBanks, 'outPatch');

  const inRows = plan.channels.filter((c) => c.side !== 'R').map((c) => {
    const n = c.side ? 2 : 1;
    const last = c.ch + n - 1;
    return el('tr', {},
      el('td', { className: 'ch', textContent: n > 1 ? `${c.ch}–${last}` : c.ch }),
      el('td', { textContent: c.source.name }),
      el('td', {}, patchControl(c.source, inBanks, `Auto · ${range(c.patch, n)}`)));
  });
  $('patchIn').replaceChildren(
    el('thead', {}, el('tr', {}, el('th', { textContent: 'Ch' }), el('th', { textContent: 'Input' }), el('th', { textContent: 'Plugs into' }))),
    el('tbody', {}, ...inRows));
  const outRows = plan.outputs.map((o) => el('tr', {},
    el('td', { className: 'ch', textContent: o.zone.type === 'main' ? 'ST L/R' : o.buses.map((b) => b.replace('MIX', '')).join('/') }),
    el('td', { textContent: o.name }),
    el('td', {}, patchControl(o.zone, outBanks, `Auto · ${range(o.patch, o.ports)}`))));
  $('patchOut').replaceChildren(
    el('thead', {}, el('tr', {}, el('th', { textContent: 'Bus' }), el('th', { textContent: 'Output' }), el('th', { textContent: 'Comes out of' }))),
    el('tbody', {}, ...outRows));
}
$('sendPatch').onchange = (e) => update(() => { show.options.sendPatch = e.target.checked; });

// ---- Typed requests: trigger words turn plain text into inputs and zones, offline ----
let suggestion = null;
function typeStatus(text, kind = '') {
  $('typeStatus').textContent = text;
  $('typeStatus').className = `status ${kind}`;
}
function previewTyped() {
  const s = parseRequest($('typeText').value, show);
  const unknown = s.unknown.length ? `Not sure what these are: ${s.unknown.join(', ')}` : '';
  if (!s.sources.length && !s.zones.length) {
    $('typePreview').hidden = true;
    return typeStatus(unknown || 'Try something like "full band and 4 wedges".', 'bad');
  }
  pasteMode = false;
  typeStatus(unknown, unknown ? 'bad' : '');
  showPreview(s);
}
function showPreview(s) {
  suggestion = s;
  $('typeSummary').textContent = `This adds ${s.summary}`;
  $('typeList').replaceChildren(
    ...s.sources.map((x) => el('li', { className: 'pill', textContent: `${x.count > 1 ? `${x.count} × ` : ''}${x.name}${(x.stereo ?? SOURCE_TYPES[x.type].stereo) ? ' (L/R)' : ''}${x.note ? ` · ${x.note}` : ''}${x.phantom ? ' · 48V' : ''}` })),
    ...s.zones.map((z) => el('li', { className: 'pill zone-pill', textContent: `Output: ${z.name}` })));
  $('typePreview').hidden = false;
}
let pasteMode = false;
$('pasteGo').onclick = () => {
  const s = parseInputList($('pasteText').value);
  if (!s.sources.length) return typeStatus('Paste at least one line, like "1  Kick In  Beta 91".', 'bad');
  pasteMode = true;
  typeStatus('');
  showPreview(s);
};
$('typeGo').onclick = previewTyped;
$('typeText').onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); previewTyped(); } };
$('typeAdd').onclick = () => {
  const keepOrder = pasteMode && $('pasteKeepOrder').checked;
  update(() => {
    applySuggestion(show, suggestion);
    if (keepOrder) show.options.autoOrder = false;
  });
  $('typePreview').hidden = true;
  if (pasteMode) $('pasteText').value = '';
  else $('typeText').value = '';
  typeStatus(keepOrder ? 'Added. Auto order is off, so your list keeps its order.' : 'Added. Check the routing below.', 'ok');
};
$('typeDiscard').onclick = () => { $('typePreview').hidden = true; typeStatus(''); };
$('pushDesk').onclick = pushDesk;
try { $('host').value = localStorage.getItem(`${STORE}-host`) || ''; } catch { /* ignore */ }

// ---- Your templates: saved on this computer, shown as one-click chips next to the packages ----
const TPL_KEY = `${STORE}-templates`;
function loadTemplates() {
  try { return JSON.parse(localStorage.getItem(TPL_KEY)) || []; } catch { return []; }
}
function saveTemplates(list) {
  try { localStorage.setItem(TPL_KEY, JSON.stringify(list)); } catch { /* storage off */ }
}
function renderTemplates() {
  const list = loadTemplates();
  $('tplGroup').hidden = !list.length;
  $('tplChips').replaceChildren(...list.map((tpl, i) => el('span', { className: 'tpl-chip' },
    el('button', {
      className: 'chip', textContent: tpl.name, title: `${tpl.sources.length} inputs, ${tpl.zones.length} outputs`,
      onclick: () => { update(() => applyTemplate(show, tpl)); typeStatus(`Added the ${tpl.name} template.`, 'ok'); },
    }),
    el('button', { className: 'remove', textContent: '×', title: `Delete the ${tpl.name} template`, onclick: () => { saveTemplates(loadTemplates().filter((_, j) => j !== i)); renderTemplates(); } }))));
}
$('saveTemplate').onclick = () => {
  $('tplBar').hidden = false;
  $('tplName').value = show.name === 'New show' ? '' : show.name;
  $('tplName').focus();
};
$('tplSave').onclick = () => {
  if (!show.sources.length && !show.zones.length) return typeStatus('Add some inputs or outputs before saving a template.', 'bad');
  const tpl = makeTemplate(show, $('tplName').value);
  saveTemplates([...loadTemplates().filter((t) => t.name !== tpl.name), tpl]);
  renderTemplates();
  $('tplBar').hidden = true;
  typeStatus(`Saved "${tpl.name}". It's under Yours, next to the packages.`, 'ok');
};
$('tplCancel').onclick = () => { $('tplBar').hidden = true; };
$('tplName').onkeydown = (e) => { if (e.key === 'Enter') $('tplSave').click(); };

// ---- Monitors: pair singers with their own mix, and make a monitor-desk show ----
$('pairMon').onclick = () => {
  let pairs = [];
  update(() => { pairs = pairMonitors(show); });
  $('monStatus').textContent = pairs.length ? pairs.join(' · ') : 'Add some vocal mics and monitor outputs first.';
  $('monStatus').className = `status ${pairs.length ? 'ok' : 'bad'}`;
};
$('monitorShow').onclick = () => {
  const mon = monitorShow(show);
  download(`${fileBase()}-monitors.show.json`, JSON.stringify(mon, null, 2), 'application/json');
  $('monStatus').textContent = `Saved ${mon.name}. Open it with Open on the monitor desk's laptop.`;
  $('monStatus').className = 'status ok';
};

// ---- DCAs, mute groups, gain and push options ----
function renderGroups(plan, model) {
  const caps = deskCaps(model);
  $('autoGroups').checked = show.options.groups !== false;
  $('groupsList').replaceChildren(...plan.groups.map((g) => el('span', { className: 'group-pill', title: g.channels.map((c) => c.name).join(', ') },
    el('b', { textContent: g.number }), ` ${g.name} · ${g.channels.length}`)));
  $('groupsNote').textContent = show.options.groups === false || !plan.groups.length ? ''
    : !caps ? 'Pick your desk to send these.'
      : !caps.dcas ? `The ${model.label} won't take DCAs from the app.`
        : caps.dcaAssign ? `DCAs go to the desk, named and assigned.${caps.muteGroups ? ' Mute groups get their names; assign channels to them on the desk.' : ''}`
          : 'Names go to the desk. Assign channels to them on the desk.';
}
$('autoGroups').onchange = (e) => update(() => { show.options.groups = e.target.checked; });

const lastKey = () => `${STORE}-last-${link.host || 'none'}-${show.options.model}`;
function loadLast() {
  if (link.state !== 'connected') return null;
  try { return JSON.parse(localStorage.getItem(lastKey())); } catch { return null; }
}
function saveLast(value) {
  try { if (value) localStorage.setItem(lastKey(), JSON.stringify(value)); else localStorage.removeItem(lastKey()); } catch { /* storage off */ }
}
function renderSendOptions(plan, model) {
  const caps = deskCaps(model);
  $('setGain').checked = show.options.setGain !== false;
  $('gainNote').textContent = !caps ? '(pick your desk)' : !caps.gain ? '(this desk takes neither from the app)' : caps.phantom ? '' : '(gain only: switch 48V on at the desk)';
  const backup = show.options.backup || {};
  $('backupOn').disabled = !caps;
  $('backupOn').checked = Boolean(caps) && backup.on !== false;
  $('backupScene').value = backup.scene || caps?.sceneMax || 100;
  $('backupScene').disabled = !caps;
  $('backupNote').textContent = caps ? 'This overwrites that scene.' : 'Pick your desk to back up from here.';
  const last = loadLast();
  $('onlyChanges').disabled = !last;
  $('onlyChanges').checked = Boolean(last) && show.options.onlyChanges !== false;
  $('forgetPush').hidden = !last;
  $('changesNote').textContent = last
    ? `${changedCommands(plan.commands, last).length} of ${plan.commands.length} lines have changed since the last push to this desk.`
    : 'After your first push to a desk, later pushes can send only the changes.';
}
$('setGain').onchange = (e) => update(() => { show.options.setGain = e.target.checked; });
$('backupOn').onchange = (e) => update(() => { show.options.backup = { ...show.options.backup, on: e.target.checked }; });
$('backupScene').onchange = (e) => update(() => { show.options.backup = { ...show.options.backup, scene: Math.max(1, Math.round(Number(e.target.value) || 1)) }; });
$('onlyChanges').onchange = (e) => update(() => { show.options.onlyChanges = e.target.checked; });
$('forgetPush').onclick = () => { saveLast(null); render(); setStatus('The next push sends everything.'); };
$('verifyDesk').onclick = verifyDesk;

// ---- Line check: tick each channel off, soloing it on the desk where the desk allows ----
let soloKey = null;
const lcKey = (c) => `${c.source.id}:${c.side || ''}`;
function renderLineCheck(plan, model) {
  const caps = deskCaps(model);
  show.lineCheck ||= {};
  const done = plan.channels.filter((c) => show.lineCheck[lcKey(c)]).length;
  $('lcCount').textContent = plan.channels.length ? `${done} of ${plan.channels.length} checked` : '';
  $('lcCount').className = `status ${done && done === plan.channels.length ? 'ok' : ''}`;
  const canSolo = Boolean(caps?.cue) && link.state === 'connected';
  if (!canSolo) soloKey = null;
  $('lcNote').textContent = !caps?.cue
    ? (model.inputs ? `The ${model.label} won't take solo from the app, so solo on the desk as you go.` : 'Pick your desk to solo channels from here.')
    : canSolo ? 'Tap Solo to hear a channel on the desk, then tick it. Ticking a soloed channel moves the solo on to the next one.'
      : 'Connect to the desk to solo channels from here.';
  $('lcTable').replaceChildren(
    el('thead', {}, el('tr', {}, ...['✓', 'Ch', 'Name', 'Plugs into', 'Mic / note', '48V', 'Bring gain to', ''].map((t) => el('th', { textContent: t })))),
    el('tbody', {}, ...plan.channels.map((c) => {
      const key = lcKey(c);
      const ticked = Boolean(show.lineCheck[key]);
      return el('tr', { className: `${ticked ? 'lc-done' : ''} ${soloKey === key ? 'lc-solo' : ''}` },
        el('td', { className: 'lc-tick' }, el('input', { type: 'checkbox', checked: ticked, 'aria-label': `${c.name} checked`, onchange: (e) => tickLine(plan, c, e.target.checked) })),
        el('td', { className: 'ch', textContent: c.ch }),
        el('td', { textContent: c.name }),
        el('td', { textContent: portLabel(c.patch) }),
        el('td', { textContent: c.source.note || '' }),
        el('td', { textContent: phantomOf(c.source) ? '48V' : '' }),
        el('td', { textContent: `${gainOf(c.source)} dB` }),
        el('td', {}, canSolo && el('button', { className: `solo ${soloKey === key ? 'on' : ''}`, textContent: soloKey === key ? 'Soloed' : 'Solo', onclick: () => solo(plan, c) })));
    })));
}
async function sendCue(commands) {
  const res = await fetch('/api/cue', { method: 'POST', body: JSON.stringify({ commands }) });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
}
async function solo(plan, c) {
  const model = MODELS[show.options.model] || MODELS.custom;
  const key = lcKey(c);
  const prev = soloKey && plan.channels.find((x) => lcKey(x) === soloKey);
  const commands = [];
  if (prev) commands.push(cueCommand(model, prev.ch, false));
  if (soloKey !== key) commands.push(cueCommand(model, c.ch, true));
  try {
    await sendCue(commands);
    soloKey = soloKey === key ? null : key;
  } catch (err) {
    setStatus(err.message, 'bad');
  }
  render();
}
function tickLine(plan, c, ticked) {
  const key = lcKey(c);
  show.lineCheck[key] = ticked;
  if (ticked && soloKey === key) {
    const next = plan.channels.slice(plan.channels.indexOf(c) + 1).find((x) => !show.lineCheck[lcKey(x)]);
    if (next) return solo(plan, next);
    return solo(plan, c); // last one: solo off
  }
  render();
}
$('lcClear').onclick = () => update(() => { show.lineCheck = {}; });

// ---- Paperwork: input list, outputs, line check sheet, desk tape and stage-box labels, ready to print ----
$('paperworkBtn').onclick = () => {
  const plan = buildPlan(show);
  const p = paperwork(show, plan, { version: VERSION, licence: LICENCE, extra: rigPaperwork(show, plan) });
  const title = p.title.replace(/[<>&]/g, '');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>body{margin:24px;background:#fff}${p.css}@media print{.noprint{display:none}body{margin:0}}</style></head><body><p class="noprint"><button onclick="print()">Print</button></p>${p.body}</body></html>`;
  window.open(URL.createObjectURL(new Blob([html], { type: 'text/html' })), '_blank');
};

renderTemplates();

// Footer: version and licence number, from about.js
$('footProduct').textContent = `${PRODUCT} v${VERSION}`;
$('footLicence').textContent = `Licence ${LICENCE}`;

showTab(activeTab);
