import { LICENCE, PRODUCT, VERSION } from './about.js';
import { CHECK_LEVELS, FADER_MARKS, OSC_KEYS, checkKeys, checkState, checkSteps, faderLevel, faderPos, levelText, noiseChannel, readLines, restoreLines, stateLines } from './check.js';
import { ampPlan, normalizeRacks, rigPaperwork } from './rig.js';
import { prepSheet } from './prep.js';
import { mountRig } from './rig-ui.js';
import { ask, el, info, segmented, tag, toast, toggle, vfader, wireMenus } from './ui.js';
import {
  applyTemplate, changedCommands, cueCommand, deskCaps, gainOf, makeTemplate, monitorShow, pairMonitors, paperwork, parseInputList, phantomOf,
  rememberPush, sceneStoreCommand,
} from './plan.js';
import { canLR, modelFromProduct, patchBanks, portLabel, emptyShow, sendOf, nextZoneName, COLORS, MODELS, PACKAGES, SOURCE_TYPES, ZONE_TYPES, addSources, applySuggestion, buildPlan, defaultShow, readDeskFirst, readDeskSecond, readReplies, showFromDesk, hpfOf, makeZone, normalizeColor, orderSources, packageSuggestion, parseRequest, patchSheetCsv } from './plan.js';

// The page can run inside the Mac app, a browser, or the demo. The demo hands in its own way to save
// files and show paperwork, since it can't download or open windows.
const host = window.kkHost || {};
const SWATCH = { Blue: '#4d7cff', Cyan: '#2fd6d6', Green: '#3fcf6e', Yellow: '#ffd23f', Orange: '#ff9234', Red: '#ff4d4d', Magenta: '#ff4fd8', Purple: '#9b6bff' };
const $ = (id) => document.getElementById(id);
const STORE = host.store || 'yamaha-show-builder'; // demo mode keeps its own shows
// Every request to the app's server carries the unlock key
const api = (path, opts = {}) => fetch(path, { ...opts, headers: { ...(opts.headers || {}), 'x-kk-key': host.token || '' } });
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

let show = load() || defaultShow();
let showCommands = false;

function load() {
  try { return JSON.parse(localStorage.getItem(STORE)); } catch { return null; }
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(show)); } catch { /* private mode: fine */ }
}
function colorSelect(color, onChange) {
  const value = normalizeColor(color);
  const sel = el('select', { className: 'color-sel', 'aria-label': 'Colour', onchange: (e) => onChange(e.target.value) },
    ...COLORS.map((c) => el('option', { value: c, textContent: c, selected: c === value })));
  sel.style.backgroundImage = `radial-gradient(circle, ${SWATCH[value]} 4.5px, transparent 5.5px), linear-gradient(45deg, transparent 50%, #8e949b 50%), linear-gradient(135deg, #8e949b 50%, transparent 50%)`;
  sel.style.backgroundSize = '12px 12px, 5px 5px, 5px 5px';
  sel.style.backgroundPosition = '8px 50%, calc(100% - 13px) 50%, calc(100% - 8px) 50%';
  return sel;
}

// A field that loses focus because a redraw removed it fires its change in the middle of that redraw;
// that change is applied, and the page redrawn again once this one finishes.
let rendering = false;
let renderAgain = false;
function render() {
  if (rendering) { renderAgain = true; return; }
  rendering = true;
  try { draw(); } finally { rendering = false; }
  if (renderAgain) { renderAgain = false; render(); }
}
function draw() {
  normalizeRacks(show); // amps and RF units in rack order, which is the order they fill in
  if (show.options.autoOrder !== false) show.sources = orderSources(show.sources);
  const plan = buildPlan(show);
  const model = MODELS[show.options.model] || MODELS.custom;
  $('showName').value = show.name;
  $('model').value = MODELS[show.options.model] ? show.options.model : 'custom';

  const of = (n) => (model.inputs ? `/${n}` : '');
  $('inMeta').textContent = plan.channels.length ? `${plan.channels.length}${of(model.inputs)} ch` : '';
  $('outMeta').textContent = show.zones.length ? plural(show.zones.length, 'output') : '';
  $('routeMeta').textContent = plan.channels.length ? `${plan.channels.length}${of(model.inputs)} ch · ${plan.mixes.length}${of(model.mixes)} mix` : '';
  $('countDesk').textContent = plan.channels.length ? `${plan.channels.length}` : '';

  renderGrid(plan);
  $('warnings').replaceChildren(...[...new Set(plan.warnings)].map((w) => el('li', { textContent: w })),
    ...(plan.spares.length ? [el('li', { className: 'note', textContent: `Ch ${plan.spares.join(', ')} left empty so stereo pairs start on an odd channel` })] : []));

  if (showCommands) {
    $('log').hidden = false;
    $('log').textContent = plan.commands.join('\n');
  }
  renderPatch(plan, model);
  renderGroups(plan, model);
  renderSendOptions(plan, model);
  renderLineCheck(plan, model);
  renderCheck(plan);
  rigUi.renderRios($('rioBox'));
  const counts = rigUi.counts();
  $('countAmps').textContent = counts.amps || '';
  $('countRf').textContent = counts.rf || '';
  if (activeTab === 'amps') rigUi.renderAmps($('ampsMain'));
  if (activeTab === 'rf') rigUi.renderRf($('rfMain'));
  if (activeTab === 'racks') rigUi.renderRacks($('racksMain'));
  $('countRacks').textContent = counts.racks || '';
  save();
  return plan;
}

function update(fn) { fn(); render(); }

// ---- Routing grid ----
function renderGrid(plan) {
  const busLabel = (zone) => {
    if (zone.type === 'main') return 'ST';
    const m = plan.mixes.find((x) => x.zone === zone);
    return m.stereo ? `MIX ${m.mix}/${m.mix + 1}` : `MIX ${m.mix}`;
  };
  $('routeTools').replaceChildren(
    toggle({ label: 'Auto order', checked: show.options.autoOrder !== false, onchange: (v) => update(() => { show.options.autoOrder = v; }), tip: 'Speech mics first, then band, playback, and background music last. Turn it off to order channels by hand.' }),
    toggle({ label: 'DCAs', checked: show.options.groups !== false, onchange: (v) => update(() => { show.options.groups = v; }), tip: 'DCAs and mute groups made from the input types: Speech, Drums, Band, Vox, Playback, BGM.' }));
  const head = el('tr', {},
    el('th', { textContent: 'Ch' }), el('th', { textContent: 'Colour' }),
    el('th', { textContent: 'Name', title: `The desk shows the first ${show.options.maxNameLength} letters` }),
    el('th', { textContent: 'Type' }), el('th', { textContent: 'St', title: 'Stereo: takes two channels, L and R' }),
    el('th', { textContent: 'HPF Hz' }), el('th', { textContent: 'Gain dB', title: 'Target gain. Safe start sends the lowest; bring it up to this at line check.' }),
    el('th', { textContent: '48V' }), el('th', { className: 'zone all-col', textContent: 'All' }),
    ...show.zones.map((zone) => el('th', { className: 'zone' },
      el('input', { value: zone.name, 'aria-label': 'Output name', onchange: (e) => update(() => { zone.name = e.target.value; }) }),
      el('div', { className: 'zone-sub' },
        el('span', { textContent: busLabel(zone) }),
        canLR(zone) ? el('button', {
          className: `send-point ${zone.lr ? 'pre' : 'post'}`, textContent: zone.lr ? 'L&R' : 'mono', type: 'button',
          title: 'Mono takes one mix; L&R takes an odd/even pair, one per side, with stereo inputs panned. Click to switch.',
          onclick: () => update(() => { zone.lr = !zone.lr; }),
        }) : null,
        zone.type === 'main' ? null : el('button', {
          className: `send-point ${sendOf(zone)}`, textContent: sendOf(zone), type: 'button',
          title: 'Sends to this output: pre or post fader. Click to switch.',
          onclick: () => update(() => { zone.send = sendOf(zone) === 'pre' ? 'post' : 'pre'; }),
        }),
        el('button', { className: 'remove', type: 'button', title: `Remove ${zone.name}`, textContent: '×', onclick: () => update(() => removeZone(zone)) })))),
    el('th'));

  const rows = show.sources.map((source) => {
    const chs = plan.channels.filter((c) => c.source === source).map((c) => c.ch);
    return el('tr', {},
      el('td', { className: 'ch', textContent: chs.length > 1 ? `${chs[0]}–${chs[1]}` : chs[0] }),
      el('td', {}, colorSelect(source.color, (v) => update(() => { source.color = v; }))),
      el('td', { className: 'name' }, el('input', { value: source.name, 'aria-label': 'Input name', onchange: (e) => update(() => { source.name = e.target.value; }) })),
      el('td', { className: 'type' }, el('select', { 'aria-label': 'Type', onchange: (e) => update(() => changeType(source, e.target.value)) },
        ...Object.entries(SOURCE_TYPES).map(([k, t]) => el('option', { value: k, textContent: t.label, selected: k === source.type })))),
      el('td', { className: 'route' }, el('input', { type: 'checkbox', checked: source.stereo, 'aria-label': `${source.name} stereo`, onchange: (e) => update(() => { source.stereo = e.target.checked; }) })),
      el('td', { className: 'hpf' }, el('input', {
        type: 'number', min: 0, max: 600, step: 10, value: hpfOf(source) || '', placeholder: 'off', 'aria-label': `${source.name} high-pass in Hz`,
        onchange: (e) => update(() => { source.hpf = Math.max(0, Math.round(Number(e.target.value) || 0)); }),
      })),
      el('td', { className: 'gain' }, el('input', {
        type: 'number', min: -6, max: 66, step: 1, value: gainOf(source), 'aria-label': `${source.name} target gain in dB`,
        onchange: (e) => update(() => { source.gain = Math.min(66, Math.max(-6, Math.round(Number(e.target.value) || 0))); }),
      })),
      el('td', { className: 'route' }, el('input', { type: 'checkbox', checked: phantomOf(source), 'aria-label': `${source.name} 48V`, onchange: (e) => update(() => { source.phantom = e.target.checked; }) })),
      el('td', { className: 'route all-col' }, el('input', {
        type: 'checkbox', checked: show.zones.length > 0 && show.zones.every((z) => source.zones.includes(z.id)), 'aria-label': `${source.name} to every output`,
        onchange: (e) => update(() => { source.zones = e.target.checked ? show.zones.map((z) => z.id) : []; }),
      })),
      ...show.zones.map((zone) => el('td', { className: 'route' }, el('input', {
        type: 'checkbox', checked: source.zones.includes(zone.id), 'aria-label': `${source.name} to ${zone.name}`,
        onchange: (e) => update(() => { source.zones = e.target.checked ? [...source.zones, zone.id] : source.zones.filter((z) => z !== zone.id); }),
      }))),
      el('td', {}, ...moveButtons(source),
        el('button', { className: 'remove', type: 'button', title: `Remove ${source.name}`, textContent: '×', onclick: () => update(() => { show.sources = show.sources.filter((s) => s !== source); }) })));
  });
  const empty = !show.sources.length && el('tr', {}, el('td', { colSpan: show.zones.length + 10, className: 'dim', textContent: 'No inputs yet' }));
  $('grid').replaceChildren(el('thead', {}, head), el('tbody', {}, ...rows, empty || null));
}

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
    el('button', { className: 'remove', type: 'button', title: 'Move up', textContent: '↑', onclick: () => move(-1) }),
    el('button', { className: 'remove', type: 'button', title: 'Move down', textContent: '↓', onclick: () => move(1) }),
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
  if (type === 'main' && show.zones.some((z) => z.type === 'main')) return toast('This show already has a Main L/R.');
  const zone = makeZone(type, nextZoneName(show, type));
  if (type === 'main') show.zones.unshift(zone); else show.zones.push(zone);
  // route existing inputs that this kind of output would normally take
  for (const s of show.sources) {
    if (ZONE_TYPES[type].takes.includes(SOURCE_TYPES[s.type].category)) s.zones.push(zone.id);
  }
}

function download(name, text, type) {
  if (host.download) return host.download(name, text, type);
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
  for (const dot of [$('linkDot')]) dot.className = `link-dot ${s.state}`;
  $('linkPill').className = `link-pill ${s.state}`;
  $('linkPillText').textContent = {
    idle: 'No desk', connecting: 'Connecting…', connected: `${s.product || 'Desk'} · ${s.host}`, lost: 'Desk lost',
  }[s.state];
  $('linkStatus').textContent = { idle: s.error || '', connecting: '', connected: 'Connected', lost: s.error || 'Lost the desk' }[s.state];
  $('linkStatus').className = `status ${s.state === 'connected' ? 'ok' : s.error || s.state === 'lost' ? 'bad' : ''}`;
  const btn = $('connectBtn');
  btn.textContent = { idle: 'Connect', connecting: 'Connecting…', connected: 'Disconnect', lost: 'Reconnect' }[s.state];
  btn.className = s.state === 'connected' ? 'ghost' : 'primary';
  btn.disabled = s.state === 'connecting';
  $('host').disabled = $('port').disabled = s.state === 'connected' || s.state === 'connecting';
  if (s.state === 'connected' && was !== 'connected') matchModel(s.product);
  if (s.state === 'lost' && was === 'connected') toast(`Lost ${s.product || 'the desk'}. Check the cable.`, 'bad');
  if (s.state !== was) render();
}
// Set the desk model from the name the desk reports, when it's one the app knows
function matchModel(product) {
  const id = modelFromProduct(product);
  if (id && id !== show.options.model) {
    update(() => { show.options.model = id; });
    toast(`Desk set to ${MODELS[id].label}`, 'ok');
  } else if (/RIVAGE|PM\d/i.test(product || '')) {
    toast('RIVAGE: pick your DSP engine under Desk.');
  }
}
async function connectDesk() {
  if (link.state === 'connected') {
    await api('/api/disconnect', { method: 'POST' });
    return;
  }
  const hostIp = $('host').value.trim();
  if (!hostIp) {
    showLink({ state: 'idle', error: 'Type the desk IP' });
    return $('host').focus();
  }
  try { localStorage.setItem(`${STORE}-host`, hostIp); } catch { /* ignore */ }
  showLink({ state: 'connecting', host: hostIp });
  try {
    const res = await api('/api/connect', { method: 'POST', body: JSON.stringify({ host: hostIp, port: Number($('port').value) || 49280 }) });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    showLink(data);
  } catch (err) {
    showLink({ state: 'idle', host: hostIp, error: err.message === 'Failed to fetch' ? 'The app has stopped. Open it again.' : err.message });
  }
}
const events = new EventSource('/api/events');
events.onmessage = (e) => showLink(JSON.parse(e.data));
events.onerror = () => { if (link.state === 'connected') showLink({ state: 'lost', host: link.host, error: 'Lost touch with the app' }); };
$('connectBtn').onclick = connectDesk;
$('host').onkeydown = (e) => { if (e.key === 'Enter') connectDesk(); };
if (host.lock) $('lockBtn').onclick = host.lock; else $('lockBtn').remove();
$('linkPill').onclick = () => { showTab('desk'); $('host').disabled ? $('connectBtn').focus() : $('host').focus(); };

// ---- Find devices on the network ----
const KINDS = [['desk', 'Desks'], ['stagebox', 'Stage boxes'], ['radio', 'Radio'], ['amp', 'Amps'], ['playback', 'Playback'], ['other', 'Other']];
async function findDevices() {
  $('findPanel').hidden = false;
  const subnet = $('findSubnet').value.trim();
  $('findStatus').textContent = 'Scanning…';
  $('findList').replaceChildren();
  $('findBtn').disabled = $('findAgain').disabled = true;
  try {
    const res = await api('/api/discover', { method: 'POST', body: JSON.stringify({ subnet }) });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    showDevices(data);
  } catch (err) {
    $('findStatus').textContent = '';
    toast(err.message === 'Failed to fetch' ? 'The app has stopped. Open it again.' : err.message, 'bad');
  } finally {
    $('findBtn').disabled = $('findAgain').disabled = false;
  }
}
function showDevices({ devices, subnets }) {
  rigUi.setFound(devices);
  render();
  $('findStatus').textContent = `${plural(devices.length, 'device')} · ${subnets.length ? subnets.join(', ') : 'this computer'}`;
  if (!devices.length) {
    $('findList').replaceChildren(el('div', { className: 'empty' }, 'Nothing answered. Check the network cable, or scan another range.'));
    return;
  }
  const groups = KINDS.map(([kind, title]) => {
    const list = devices.filter((d) => d.kind === kind);
    if (!list.length) return null;
    return el('div', { className: 'find-group' }, el('h3', { textContent: title }), el('ul', {}, ...list.map((d) => {
      const li = el('li', {}, el('span', { className: 'who', title: `Found by ${d.via.join(', ')}` },
        el('b', { textContent: [d.make, d.model].filter(Boolean).join(' ') }),
        el('small', { textContent: [d.ip || 'no address', d.name && d.name !== d.model ? d.name : ''].filter(Boolean).join(' · ') })));
      if (d.make === 'Yamaha' && d.kind === 'desk' && d.ip) {
        li.append(el('button', {
          className: 'primary small', type: 'button', textContent: 'Connect',
          onclick: async () => {
            if (link.state === 'connected') await api('/api/disconnect', { method: 'POST' });
            $('host').value = d.ip;
            $('port').value = d.port || 49280;
            link.state = 'idle';
            showTab('desk');
            connectDesk();
          },
        }));
      } else {
        const options = rigUi.foundOptions(d);
        if (options.length) {
          li.append(el('select', {
            'aria-label': `Use ${d.ip}`,
            onchange: (e) => { options[Number(e.target.value)]?.run(); e.target.value = ''; },
          }, el('option', { value: '', textContent: d.kind === 'amp' || d.make === 'Shure' ? 'Rack it…' : 'Use for…' }), ...options.map((o, i) => el('option', { value: String(i), textContent: o.label }))));
        }
      }
      return li;
    })));
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
const TABS = ['desk', 'amps', 'rf', 'racks'];
function showTab(tab) {
  activeTab = TABS.includes(tab) ? tab : 'desk';
  try { localStorage.setItem(TAB_KEY, activeTab); } catch { /* storage off */ }
  for (const t of TABS) {
    $(`tab-${t}`).hidden = t !== activeTab;
    $(`tabBtn-${t}`).setAttribute('aria-selected', String(t === activeTab));
  }
  render();
}
for (const t of TABS) $(`tabBtn-${t}`).onclick = () => showTab(t);

// How the Amplifiers and RF tabs reach the kit: through this app's server
const rigUi = mountRig({
  getShow: () => show,
  update,
  demo: Boolean(host.demo),
  transport: {
    shure: async (ip, lines, check, onLine) => {
      try { return await streamLines('/api/shure', { host: ip, lines, check }, onLine); } catch (err) { return { error: err.message }; }
    },
    identify: async (kind, ip) => {
      const res = await api('/api/identify', { method: 'POST', body: JSON.stringify({ kind, host: ip }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data;
    },
    flash: async (ip) => {
      const res = await api('/api/flash', { method: 'POST', body: JSON.stringify({ host: ip }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data;
    },
    ampRead: async (ip) => {
      const res = await api('/api/amp/read', { method: 'POST', body: JSON.stringify({ host: ip }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data;
    },
    save: (name, text) => download(name, text, 'application/json'),
    specteraDevices: async (ip, password) => {
      const res = await api('/api/spectera/devices', { method: 'POST', body: JSON.stringify({ host: ip, password }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data.devices;
    },
    specteraPush: async (ip, password, writes) => {
      const res = await api('/api/spectera/push', { method: 'POST', body: JSON.stringify({ host: ip, password, writes }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data.results;
    },
  },
});

// Streams one JSON line per command from the app server and hands each to onLine
async function streamLines(path, body, onLine) {
  const res = await api(path, { method: 'POST', body: JSON.stringify(body) });
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
function needDesk() {
  if (link.state === 'connected') return false;
  setStatus('Connect the desk first', 'bad');
  showTab('desk');
  $('host').focus();
  return true;
}

async function pushDesk() {
  const plan = buildPlan(show);
  const model = MODELS[show.options.model] || MODELS.custom;
  if (!plan.commands.length) return setStatus('Add inputs or outputs first', 'bad');
  if (needDesk()) return;
  const last = loadLast();
  const onlyChanges = Boolean(last) && show.options.onlyChanges !== false;
  const commands = onlyChanges ? changedCommands(plan.commands, last) : plan.commands;
  if (!commands.length) return setStatus('Nothing has changed since the last send', 'ok');
  const caps = deskCaps(model);
  const backup = show.options.backup || {};
  const scene = backup.scene || caps?.sceneMax;
  const backupCmd = caps && backup.on !== false ? sceneStoreCommand(model, scene) : null;
  const what = onlyChanges ? plural(commands.length, 'changed line') : `${commands.length} lines`;
  const ok = await ask($('pushAsk'), {
    text: backupCmd
      ? `Send ${what} to ${link.product || 'the desk'}? The current scene is stored to scene ${scene} first, overwriting it.`
      : `Send ${what} to ${link.product || 'the desk'}? This desk can't back up from here, so store a scene first.`,
    yes: 'Send', danger: !backupCmd,
  });
  if (!ok) return;

  startLog();
  $('pushDesk').disabled = true;
  const sent = [];
  try {
    if (backupCmd) {
      setStatus(`Backing up to scene ${scene}…`);
      const result = await streamLines('/api/push', { commands: [backupCmd] }, (msg) => logLine(msg, (m) => `${m.cmd}  (backup)`, (m) => `${m.cmd}\n  ↳ ${m.reply}`));
      if (result?.errors) return setStatus('The desk refused the backup, so nothing was sent', 'bad');
    }
    setStatus('Sending…');
    const result = await streamLines('/api/push', { commands }, (msg) => {
      if (msg.ok) sent.push(msg.cmd);
      logLine(msg, (m) => m.cmd, (m) => `${m.cmd}\n  ↳ ${m.reply}`);
    });
    if (result.errors) setStatus(`${result.errors} of ${result.total} lines refused, marked red below`, 'bad');
    else {
      setStatus(`Sent ${result.total} lines${backupCmd ? ` · old scene in ${scene}` : ''}`, 'ok');
      toast(`Show sent to ${link.product || 'the desk'}`, 'ok');
    }
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
  if (needDesk()) return;
  startLog();
  $('verifyDesk').disabled = true;
  setStatus('Reading the desk…');
  try {
    const result = await streamLines('/api/verify', { commands: plan.commands }, (msg) => {
      if (!msg.ok) logLine(msg, () => '', (m) => `${m.cmd}\n  ↳ desk has ${m.reply.replace(/^OK get \S+ \d+ \d+ /, '')}`);
      else $('progress').value = (msg.i + 1) / msg.total;
    });
    if (result.wrong) setStatus(`${result.wrong} of ${result.total} settings differ, listed below`, 'bad');
    else {
      setStatus(`All ${result.total} settings match`, 'ok');
      $('log').hidden = true;
      $('progress').hidden = true;
    }
  } catch (err) {
    setStatus(err.message, 'bad');
  } finally {
    $('verifyDesk').disabled = false;
  }
}

// Reads names, colours, high-pass and routing off the connected desk into a new show. The amps, radio
// mics and stage boxes stay, since they describe the kit. With everything, the amps and receivers that
// have an IP are read too (without a desk connected, just those, into this show).
const RIG_KEYS = ['amps', 'rf', 'rios', 'ampReads'];
async function readDesk({ everything = false } = {}) {
  const deskToo = !everything || link.state === 'connected';
  if (deskToo && needDesk()) return;
  const modelId = modelFromProduct(link.product) || show.options.model;
  const model = MODELS[modelId];
  if (deskToo && !model?.inputs) return setStatus('Pick the desk model first', 'bad');
  if (deskToo && (show.sources.length || show.zones.length)) {
    const what = everything ? `${link.product || 'the desk'}, the amps and the radio mics` : `the show off ${link.product || 'the desk'}`;
    if (!await ask($('askHost'), { text: `Read ${what}? It replaces this show. Nothing on the kit changes.`, yes: 'Read', danger: true })) return;
  }
  try {
    let next = null;
    if (deskToo) {
      $('progress').hidden = false;
      $('progress').value = 0;
      setStatus('Reading the desk…');
      const replies = [];
      const pass = async (commands, from, share) => {
        await streamLines('/api/read', { commands }, (msg) => { replies.push(msg.reply); $('progress').value = from + share * (msg.i + 1) / msg.total; });
      };
      await pass(readDeskFirst(model), 0, 0.6);
      const second = readDeskSecond(model, readReplies(replies));
      if (second.length) await pass(second, 0.6, 0.4);
      next = showFromDesk(modelId, readReplies(replies), `${link.product || model.label} show`);
      for (const k of RIG_KEYS) if (show[k]) next[k] = show[k];
      startShow(next);
    }
    const desk = next ? `${plural(next.sources.length, 'input')} and ${plural(next.zones.length, 'output')}` : '';
    if (!everything) {
      if (!next.sources.length && !next.zones.length) setStatus('Nothing named on the desk yet, so the show is empty', 'bad');
      else toast(`Read ${desk} from ${link.product || 'the desk'}`, 'ok');
      return;
    }
    const kit = await rigUi.readKit((name) => setStatus(`Reading ${name}…`));
    setStatus('');
    const got = [desk, kit.amps && plural(kit.amps, 'amp'), kit.receivers && `${plural(kit.receivers, 'receiver')} (${plural(kit.mics, 'mic')})`, kit.packs && plural(kit.packs, 'Spectera pack')].filter(Boolean);
    if (kit.errors.length) toast(`Read ${got.join(', ') || 'nothing'}. Not read: ${kit.errors.join('; ')}`, 'bad');
    else if (!got.length) toast('Nothing to read. Connect the desk, or put IPs on the amps and receivers.', 'bad');
    else toast(`Read ${got.join(', ')}. Save keeps it all in one file.`, 'ok');
  } catch (err) {
    setStatus(err.message, 'bad');
    $('progress').hidden = true;
  }
}

// ---- Static controls: add buttons, desk list, file actions ----
const GROUP_OF = { speech: 'Speech', band: 'Band', talkback: 'Band', program: 'Playback', bgm: 'Playback' };
const chipGroups = { Packages: Object.entries(PACKAGES).map(([key, pkg]) => el('button', {
  className: 'chip', type: 'button', textContent: `${pkg.label} · ${pkg.sources.reduce((n, s) => n + ((s.stereo ?? SOURCE_TYPES[s.type].stereo) ? 2 : 1), 0)}`,
  onclick: () => { update(() => applySuggestion(show, packageSuggestion(key))); toast(`${pkg.label} added`, 'ok'); },
})) };
for (const [type, t] of Object.entries(SOURCE_TYPES)) {
  const chip = el('button', { className: 'chip', type: 'button', textContent: t.label, onclick: () => update(() => addSources(show, type, Math.max(1, Number($('addCount').value) || 1))) });
  (chipGroups[GROUP_OF[t.category]] ||= []).push(chip);
}
for (const [name, chips] of Object.entries(chipGroups)) {
  $('addButtons').append(el('div', { className: 'chip-group' }, el('span', { className: 'chip-label', textContent: name }), el('div', { className: 'chips' }, ...chips)));
}
$('addButtons').children[0].after(el('div', { className: 'chip-group', id: 'tplGroup', hidden: true },
  el('span', { className: 'chip-label', textContent: 'Yours' }), el('div', { className: 'chips', id: 'tplChips' })));
const zoneGroups = { Speakers: [], Monitors: [] };
for (const [type, t] of Object.entries(ZONE_TYPES)) {
  zoneGroups[t.monitor ? 'Monitors' : 'Speakers'].push(el('button', { className: 'chip', type: 'button', textContent: t.label, onclick: () => update(() => addZone(type)) }));
}
for (const [name, chips] of Object.entries(zoneGroups)) {
  $('zoneButtons').append(el('div', { className: 'chip-group' },
    el('span', { className: 'chip-label' }, name, el('small', { textContent: name === 'Monitors' ? 'pre fade' : 'post fade' })),
    el('div', { className: 'chips' }, ...chips)));
}
const series = {};
const MENU_GROUP = { DM3: 'DM', DM7: 'DM' }; // one heading in the list; the desks still behave as their own families
for (const [id, m] of Object.entries(MODELS)) (series[MENU_GROUP[m.series] || m.series || ''] ||= []).push(el('option', { value: id, textContent: m.label }));
for (const [name, options] of Object.entries(series)) {
  $('model').append(name ? el('optgroup', { label: name === 'RIVAGE' ? 'RIVAGE PM' : `${name} series` }, ...options) : options[0]);
}
$('model').onchange = (e) => update(() => { show.options.model = e.target.value; });
$('showName').onchange = (e) => update(() => { show.name = e.target.value.trim() || 'New show'; });

// New show wipes the page back to empty; the example loads the conference show. Both ask first unless the page is empty.
function resetPage() {
  $('typeText').value = '';
  $('pasteText').value = '';
  $('tplBar').hidden = true;
  soloKey = null;
  $('typePreview').hidden = true;
  $('addCount').value = 1;
  $('log').textContent = '';
  $('log').hidden = true;
  $('progress').hidden = true;
  showCommands = false;
  $('toggleCommands').textContent = 'Commands';
  setStatus('');
}
function startShow(next) {
  update(() => { show = next; });
  resetPage();
}
async function askToReplace(next, text, yes) {
  if (show.sources.length || show.zones.length) {
    if (!await ask($('askHost'), { text, yes, danger: true })) return;
  }
  startShow(next);
}
$('newShow').onclick = () => askToReplace(emptyShow(show.options.model), 'Start an empty show? Everything on this page goes.', 'Start empty');
$('exampleShow').onclick = () => askToReplace({ ...defaultShow(), options: { ...defaultShow().options, model: show.options.model } }, 'Load the conference example? It replaces this show.', 'Load example');
$('readShow').onclick = () => readDesk();
$('readAll').onclick = () => readDesk({ everything: true });
$('saveShow').onclick = () => download(`${fileBase()}.show.json`, JSON.stringify(show, null, 2), 'application/json');
$('exportCsv').onclick = () => download(`${fileBase()}-patch.csv`, patchSheetCsv(show, buildPlan(show)), 'text/csv');
$('openFile').onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.sources) || !Array.isArray(data.zones)) throw new Error('not a show file');
    update(() => { show = data; });
    toast(`Opened ${show.name}`, 'ok');
  } catch (err) { toast(`Couldn't open that file: ${err.message}`, 'bad'); }
  e.target.value = '';
};
$('toggleCommands').onclick = () => {
  showCommands = !showCommands;
  $('toggleCommands').textContent = showCommands ? 'Hide commands' : 'Commands';
  if (!showCommands) $('log').hidden = true;
  render();
};

// ---- Patch: inputs and outputs onto Analogue, Card, Rio and Dante sockets ----
const range = (p, n) => (p ? (n > 1 ? `${portLabel(p)}–${p.port + n - 1}` : portLabel(p)) : 'unpatched');
function bankSelect(banks, value, autoText, onChange) {
  return el('select', { 'aria-label': 'Socket bank', onchange: (e) => onChange(e.target.value) },
    ...(autoText ? [el('option', { value: 'auto', textContent: autoText, selected: !value })] : []),
    ...banks.map((b) => el('option', { value: b.key, textContent: `${b.label} ${b.first || 1}–${(b.first || 1) + b.size - 1}`, selected: value === b.key })));
}
function patchControl(target, banks, autoText) {
  const fixed = target.patch;
  return el('div', { className: 'patch-cell' },
    bankSelect(banks, fixed?.bank, autoText, (bank) => update(() => { target.patch = bank === 'auto' ? undefined : { bank, port: fixed?.port || 1 }; })),
    fixed && el('input', {
      type: 'number', min: 1, value: fixed.port, className: 'port', 'aria-label': 'Socket',
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
  $('patchMeta').replaceChildren(!model.inputs ? tag('Pick a desk')
    : sends ? tag('Outputs from app', 'on', `The app patches outputs on the ${model.label}. Inputs are patched by hand: the desk won't take input patch over the network.`)
      : tag('Patch by hand', '', `The ${model.label} doesn't take patch changes over the network. Patch it from this list or the patch sheet.`));
  $('sendPatchRow').replaceChildren(sends ? toggle({ label: 'Send output patch', checked: show.options.sendPatch !== false, onchange: (v) => update(() => { show.options.sendPatch = v; }) }) : '');
  startControl('inStart', inBanks, 'inPatch');
  startControl('outStart', outBanks, 'outPatch');

  const inRows = plan.channels.filter((c) => c.side !== 'R').map((c) => {
    const n = c.side ? 2 : 1;
    return el('tr', {},
      el('td', { className: 'ch', textContent: n > 1 ? `${c.ch}–${c.ch + 1}` : c.ch }),
      el('td', { textContent: c.source.name }),
      el('td', {}, patchControl(c.source, inBanks, `Auto · ${range(c.patch, n)}`)));
  });
  $('patchIn').replaceChildren(
    el('thead', {}, el('tr', {}, el('th', { textContent: 'Ch' }), el('th', { textContent: 'Input' }), el('th', { textContent: 'Plugs into' }))),
    el('tbody', {}, ...inRows));
  const outRows = plan.outputs.map((o) => el('tr', {},
    el('td', { className: 'ch', textContent: o.zone.type === 'main' ? 'ST' : o.buses.map((b) => b.replace('MIX', '')).join('/') }),
    el('td', { textContent: o.name }),
    el('td', {}, patchControl(o.zone, outBanks, `Auto · ${range(o.patch, o.ports)}`))));
  $('patchOut').replaceChildren(
    el('thead', {}, el('tr', {}, el('th', { textContent: 'Bus' }), el('th', { textContent: 'Output' }), el('th', { textContent: 'Comes out of' }))),
    el('tbody', {}, ...outRows));
}

// ---- Typed requests and pasted lists: trigger words turn plain text into inputs and outputs, offline ----
let suggestion = null;
let pasteMode = false;
let keepOrder = true;
function previewTyped() {
  const s = parseRequest($('typeText').value, show);
  if (!s.sources.length && !s.zones.length) {
    $('typePreview').hidden = true;
    return toast(s.unknown.length ? `Didn't recognise ${s.unknown.join(', ')}` : 'Try "full band and 4 wedges"', 'bad');
  }
  pasteMode = false;
  showPreview(s, s.unknown.length ? `Skipped ${s.unknown.join(', ')}` : '');
}
function showPreview(s, note = '') {
  suggestion = s;
  $('typeSummary').textContent = note;
  $('typeList').replaceChildren(
    ...s.sources.map((x) => el('li', { className: 'pill', textContent: `${x.count > 1 ? `${x.count} × ` : ''}${x.name}${(x.stereo ?? SOURCE_TYPES[x.type].stereo) ? ' L/R' : ''}${x.note ? ` · ${x.note}` : ''}${x.phantom ? ' · 48V' : ''}` })),
    ...s.zones.map((z) => el('li', { className: 'pill out', textContent: z.name })));
  $('typePreview').hidden = false;
}
$('wordsTip').replaceWith(info('Words it knows: full band, drum kit, lectern, headset, handheld, kick, snare, hi hat, tom, overhead, bass, guitar, acoustic, keys, vocal, BV, talkback, laptop, playback, BGM, main, PA, wedge, mono IEM, stereo IEM, delay, front fill, ceiling, record. Numbers work as digits or words.'));
$('pasteToggle').onclick = () => {
  const open = $('pasteBox').hidden;
  $('pasteBox').hidden = !open;
  $('pasteToggle').setAttribute('aria-expanded', String(open));
  if (open) $('pasteText').focus();
};
$('pasteOrder').replaceWith(toggle({ label: "Keep the list's order", checked: true, onchange: (v) => { keepOrder = v; }, tip: 'Paste from a rider, spreadsheet or email, one line per channel. 48V and mic models are picked up, and "Keys L" / "Keys R" become one stereo input.' }));
$('pasteGo').onclick = () => {
  const s = parseInputList($('pasteText').value);
  if (!s.sources.length) return toast('Paste at least one line, like "1  Kick In  Beta 91"', 'bad');
  pasteMode = true;
  showPreview(s, plural(s.sources.length, 'input'));
};
$('typeGo').onclick = previewTyped;
$('typeText').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); previewTyped(); } };
$('typeAdd').onclick = () => {
  const ordered = pasteMode && keepOrder;
  update(() => {
    applySuggestion(show, suggestion);
    if (ordered) show.options.autoOrder = false;
  });
  $('typePreview').hidden = true;
  if (pasteMode) { $('pasteText').value = ''; $('pasteBox').hidden = true; } else $('typeText').value = '';
  toast(ordered ? 'Added in your order' : 'Added', 'ok');
};
$('typeDiscard').onclick = () => { $('typePreview').hidden = true; };
$('pushDesk').onclick = pushDesk;
try { $('host').value = localStorage.getItem(`${STORE}-host`) || ''; } catch { /* ignore */ }

// ---- Your templates: saved on this computer, shown as chips next to the packages ----
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
      className: 'chip mine', type: 'button', textContent: tpl.name, title: `${plural(tpl.sources.length, 'input')}, ${plural(tpl.zones.length, 'output')}`,
      onclick: () => { update(() => applyTemplate(show, tpl)); toast(`${tpl.name} added`, 'ok'); },
    }),
    el('button', { className: 'remove', type: 'button', textContent: '×', title: `Delete ${tpl.name}`, onclick: () => { saveTemplates(loadTemplates().filter((_, j) => j !== i)); renderTemplates(); } }))));
}
$('saveTemplate').onclick = () => {
  $('tplBar').hidden = false;
  $('tplName').value = show.name === 'New show' ? '' : show.name;
  $('tplName').focus();
};
$('tplSave').onclick = () => {
  if (!show.sources.length && !show.zones.length) return toast('Add inputs or outputs first', 'bad');
  const tpl = makeTemplate(show, $('tplName').value);
  saveTemplates([...loadTemplates().filter((t) => t.name !== tpl.name), tpl]);
  renderTemplates();
  $('tplBar').hidden = true;
  toast(`Template saved: ${tpl.name}`, 'ok');
};
$('tplCancel').onclick = () => { $('tplBar').hidden = true; };
$('tplName').onkeydown = (e) => { if (e.key === 'Enter') $('tplSave').click(); if (e.key === 'Escape') $('tplBar').hidden = true; };

// ---- Monitors: pair singers with their own mix, and make a monitor-desk show ----
$('pairMon').onclick = () => {
  let pairs = [];
  update(() => { pairs = pairMonitors(show); });
  toast(pairs.length ? pairs.join(' · ') : 'Add vocal mics and monitor outputs first', pairs.length ? 'ok' : 'bad');
};
$('monitorShow').onclick = () => {
  const mon = monitorShow(show);
  download(`${fileBase()}-monitors.show.json`, JSON.stringify(mon, null, 2), 'application/json');
  toast(`Saved ${mon.name}. Open it on the monitor desk's laptop.`, 'ok');
};

// ---- DCAs and mute groups ----
function renderGroups(plan, model) {
  const caps = deskCaps(model);
  const on = show.options.groups !== false && plan.groups.length;
  const where = !on ? null
    : !caps ? tag('Pick a desk') : !caps.dcas ? tag('Not on this desk') : caps.dcaAssign ? tag('Sent to desk', 'on', caps.muteGroups ? 'DCAs are named and assigned. Mute groups get their names; assign channels to them on the desk.' : 'DCAs are named and assigned.') : tag('Names only', '', 'Names go to the desk. Assign channels on the desk.');
  $('groupsList').replaceChildren(...(on ? [el('span', { className: 'chip-label', textContent: 'DCA' }), ...plan.groups.map((g) => el('span', { className: 'group-pill', title: g.channels.map((c) => c.name).join(', ') },
    el('b', { textContent: g.number }), g.name, el('span', { className: 'dim', textContent: g.channels.length }))), where] : []));
}

// ---- Send options ----
const lastKey = () => `${STORE}-last-${link.host || 'none'}-${show.options.model}`;
function loadLast() {
  if (link.state !== 'connected') return null;
  try { return JSON.parse(localStorage.getItem(lastKey())); } catch { return null; }
}
function saveLast(value) {
  try { if (value) localStorage.setItem(lastKey(), JSON.stringify(value)); else localStorage.removeItem(lastKey()); } catch { /* storage off */ }
}
function setting(control, ...right) {
  return el('div', { className: 'setting' }, control, el('span', { className: 'grow' }), ...right);
}
function numberSetting(label, key, min, max) {
  return setting(el('span', { className: 'switch-label', textContent: label }),
    el('input', { type: 'number', min, max, value: show.options[key], 'aria-label': label, onchange: (e) => update(() => { show.options[key] = Math.min(max, Math.max(min, Number(e.target.value) || min)); }) }));
}
function renderSendOptions(plan, model) {
  const caps = deskCaps(model);
  const backup = show.options.backup || {};
  const last = loadLast();
  const changed = last ? changedCommands(plan.commands, last).length : 0;
  $('sendMeta').textContent = plan.commands.length ? `${plan.commands.length} lines` : '';
  $('sendSettings').replaceChildren(
    setting(toggle({ label: 'Safe start', checked: show.options.safeStart !== false, onchange: (v) => update(() => { show.options.safeStart = v; }), tip: 'Every head-amp at its lowest (-6 dB) and every fader at -∞: inputs, outputs and Main L/R. Bring them up at line check.' })),
    setting(toggle({ label: 'Reset faders', checked: show.options.setLevels, onchange: (v) => update(() => { show.options.setLevels = v; }), tip: 'Inputs to -∞, outputs to -∞ with safe start (0 dB without). Off leaves the desk\'s levels alone.' })),
    setting(toggle({ label: 'Gain and 48V', checked: show.options.setGain !== false, disabled: !caps?.gain, onchange: (v) => update(() => { show.options.setGain = v; }) }),
      el('span', { className: 'value', textContent: !caps ? 'pick a desk' : !caps.gain ? 'not on this desk' : caps.phantom ? '' : 'gain only' })),
    setting(toggle({ label: 'Back up scene first', checked: Boolean(caps) && backup.on !== false, disabled: !caps, onchange: (v) => update(() => { show.options.backup = { ...show.options.backup, on: v }; }) }),
      el('input', { type: 'number', min: 1, value: backup.scene || caps?.sceneMax || 100, disabled: !caps, 'aria-label': 'Backup scene number', onchange: (e) => update(() => { show.options.backup = { ...show.options.backup, scene: Math.max(1, Math.round(Number(e.target.value) || 1)) }; }) })),
    setting(toggle({ label: 'Only changes', checked: Boolean(last) && show.options.onlyChanges !== false, disabled: !last, onchange: (v) => update(() => { show.options.onlyChanges = v; }), tip: 'After the first send to a desk, later sends only include what changed.' }),
      last ? el('span', { className: 'value', textContent: `${changed} changed` }) : null,
      last ? el('button', { className: 'link', type: 'button', textContent: 'Reset', title: 'Send everything next time', onclick: () => { saveLast(null); render(); toast('Next send includes everything'); } }) : null),
    numberSetting('First channel', 'firstChannel', 1, 288),
    numberSetting('First mix', 'firstMix', 1, 72),
    numberSetting('Name length', 'maxNameLength', 4, 32));
}
$('verifyDesk').onclick = verifyDesk;

// ---- Line check: tick each channel off, soloing it on the desk where the desk allows ----
let soloKey = null;
const lcKey = (c) => `${c.source.id}:${c.side || ''}`;
function renderLineCheck(plan, model) {
  const caps = deskCaps(model);
  show.lineCheck ||= {};
  const done = plan.channels.filter((c) => show.lineCheck[lcKey(c)]).length;
  $('lcCount').textContent = plan.channels.length ? `${done}/${plan.channels.length}` : '';
  const canSolo = Boolean(caps?.cue) && link.state === 'connected';
  if (!canSolo) soloKey = null;
  $('lcNote').replaceChildren(!model.inputs ? '' : !caps?.cue ? tag('Solo on the desk') : canSolo
    ? tag('Solo from here', 'on', 'Ticking a soloed channel moves the solo on to the next one.') : tag('Connect to solo'));
  $('lcTable').replaceChildren(
    el('thead', {}, el('tr', {}, ...['', 'Ch', 'Name', 'Plugs into', 'Mic', '48V', 'Gain', ''].map((t) => el('th', { textContent: t })))),
    el('tbody', {}, ...plan.channels.map((c) => {
      const key = lcKey(c);
      const ticked = Boolean(show.lineCheck[key]);
      return el('tr', { className: `${ticked ? 'lc-done' : ''} ${soloKey === key ? 'lc-solo' : ''}` },
        el('td', { className: 'ch' }, el('input', { type: 'checkbox', checked: ticked, 'aria-label': `${c.name} checked`, onchange: (e) => tickLine(plan, c, e.target.checked) })),
        el('td', { className: 'ch', textContent: c.ch }),
        el('td', { textContent: c.name }),
        el('td', { className: 'mono dim', textContent: portLabel(c.patch) }),
        el('td', { className: 'dim', textContent: c.source.note || '' }),
        el('td', { className: 'mono', textContent: phantomOf(c.source) ? '48V' : '' }),
        el('td', { className: 'mono', textContent: `${gainOf(c.source)} dB` }),
        el('td', {}, canSolo && el('button', { className: `solo ${soloKey === key ? 'on' : ''}`, type: 'button', textContent: 'Solo', 'aria-pressed': String(soloKey === key), onclick: () => solo(plan, c) })));
    }),
    !plan.channels.length ? el('tr', {}, el('td', { colSpan: 8, className: 'dim', textContent: 'No inputs yet' })) : null));
}
// ---- System check: noise through each output in turn, everything put back on Stop ----
let check = null; // { plan, src, steps, i, level, snapshot, last } while running
const checkPick = { kind: 'channel', ch: null };
let checkBusy = false;
let deskQueue = Promise.resolve(); // check changes go to the desk one batch at a time, in order
const CHECK_KEY = `${STORE}-check`; // what to put back, kept until Stop in case the page closes mid-check
const leftover = () => { try { return JSON.parse(localStorage.getItem(CHECK_KEY)); } catch { return null; } };
async function sendLines(commands) {
  if (!commands.length) return;
  const result = await streamLines('/api/push', { commands }, () => {});
  if (result?.errors) throw new Error(`The desk refused ${plural(result.errors, 'line')}`);
}
const queued = (work) => (deskQueue = deskQueue.then(work, work));
async function checkDo(work) {
  if (checkBusy) return;
  checkBusy = true;
  try { await queued(work); } catch (err) { toast(err.message, 'bad'); }
  checkBusy = false;
  render();
}
// Sends the desk from where it is to this step at this level
async function checkTo(i, level = check.level) {
  const next = checkState(check.plan, check.src, check.steps[i], level, check.snapshot);
  await sendLines(stateLines(next, check.last));
  Object.assign(check, { i, level, last: next });
}
function startCheck(plan) {
  return checkDo(async () => {
    if (needDesk()) return;
    const src = checkPick.kind === 'osc' ? { kind: 'osc', setup: true } : { kind: 'channel', ch: checkPick.ch || noiseChannel(plan) };
    const keys = checkKeys(plan, src);
    const replies = [];
    await streamLines('/api/read', { commands: readLines(keys) }, (msg) => replies.push(msg.reply));
    const snapshot = readReplies(replies);
    if (src.kind === 'osc') src.setup = OSC_KEYS.every((k) => snapshot.has(k)); // only RIVAGE offers it
    const missing = checkKeys(plan, src).filter((k) => snapshot.get(k) == null);
    if (missing.length) throw new Error(`The desk didn't answer for ${plural(missing.length, 'setting')}, so nothing was changed`);
    try { localStorage.setItem(CHECK_KEY, JSON.stringify(restoreLines(plan, src, snapshot))); } catch { /* storage off */ }
    check = { plan, src, steps: checkSteps(plan, ampPlan(show, plan).rows), i: 0, level: CHECK_LEVELS.start, snapshot, last: snapshot };
    await checkTo(0);
  });
}
function stopCheck() {
  return checkDo(async () => {
    const lines = check ? restoreLines(check.plan, check.src, check.snapshot) : leftover();
    check = null;
    await sendLines(lines || []);
    try { localStorage.removeItem(CHECK_KEY); } catch { /* storage off */ }
    toast('Desk put back as it was', 'ok');
  });
}
// The fader sends as it moves, skipping to the latest position whenever the desk is behind
let faderSending = false;
function moveFader(level, readout) {
  check.want = level;
  readout.textContent = levelText(level);
  if (faderSending) return;
  faderSending = true;
  queued(async () => {
    try {
      while (check && check.want != null && check.want !== check.level) await checkTo(check.i, check.want);
    } catch (err) { toast(err.message, 'bad'); }
    faderSending = false;
  });
}
function fader(label) {
  const readout = el('output', { className: 'fader-value mono', textContent: levelText(check.level) });
  return el('div', { className: 'check-fader' },
    vfader({
      pos: faderPos(check.level), label, disabled: link.state !== 'connected',
      valueText: (p) => levelText(faderLevel(p)),
      marks: [...FADER_MARKS.map((m) => [faderPos(m), m ? String(m / 100).replace('-', '−') : '0']), [0, '−∞']],
      onmove: (p) => moveFader(faderLevel(p), readout),
    }),
    el('div', { className: 'fader-head' }, readout, el('span', { textContent: label })));
}
function renderCheck(plan) {
  const steps = check ? check.steps : checkSteps(plan, ampPlan(show, plan).rows);
  $('checkMeta').textContent = steps.length ? plural(steps.length, 'speaker') : '';
  const connected = link.state === 'connected';
  if (!checkPick.ch || !plan.channels.some((c) => c.ch === checkPick.ch)) checkPick.ch = noiseChannel(plan);
  const left = !check && leftover();
  const busy = checkBusy || !connected;
  $('checkTools').replaceChildren(check ? tag('Running', 'on') : connected ? '' : tag('Connect to run'));
  const ready = steps.length && (checkPick.kind === 'osc' || plan.channels.length);
  const src = check?.src || checkPick;
  const source = el('div', { className: 'check-source' },
    check ? null : segmented(checkPick.kind, [['channel', 'Input channel'], ['osc', 'Desk oscillator']], (v) => { checkPick.kind = v; render(); }, 'Noise from'),
    src.kind === 'channel'
      ? el('label', { className: 'mini' }, check ? 'Noise on' : null,
        el('select', { 'aria-label': 'Noise channel', disabled: Boolean(check), onchange: (e) => { checkPick.ch = Number(e.target.value); } },
          ...plan.channels.map((c) => el('option', { value: c.ch, textContent: `${c.ch} ${c.name}`, selected: c.ch === (check?.src.ch ?? checkPick.ch) }))),
        info('Feed pink noise into this channel. Its sends go to one speaker at a time with that output at 0 dB. Stop puts the desk back.'))
      : el('span', { className: 'mini' }, check ? 'Desk oscillator' : null,
        info(check?.src.setup ? 'The oscillator is on, pink noise. Each output opens in turn; the rest stay down. Stop puts the desk back.'
          : 'On the desk: oscillator on, pink noise, assigned to every output. Each output opens in turn and the rest stay down. RIVAGE switches it on from here. Stop puts the desk back.')));
  const now = check && check.steps[check.i];
  $('checkBody').replaceChildren(...[
    !steps.length ? el('p', { className: 'dim', textContent: 'Add outputs first' }) : null,
    left ? el('div', { className: 'ask danger' }, el('span', { textContent: 'The desk was left mid-check.' }),
      el('button', { className: 'primary', type: 'button', textContent: 'Put it back', disabled: busy, onclick: stopCheck })) : null,
    ready ? el('div', { className: 'actionbar' }, source,
      check ? el('button', { className: 'ghost', type: 'button', textContent: 'Stop', disabled: checkBusy, onclick: stopCheck })
        : el('button', { className: 'primary', type: 'button', textContent: 'Start', disabled: busy || Boolean(left), onclick: () => startCheck(plan) })) : null,
    now ? el('div', { className: 'check-now' },
      el('div', { className: 'check-info' },
        el('div', { className: 'check-name' }, el('span', { className: 'step', textContent: `${check.i + 1}/${check.steps.length}` }), el('strong', { textContent: now.name })),
        el('div', { className: 'mono dim', textContent: [now.bus, now.out, now.amp].filter(Boolean).join(' · ') }),
        el('div', { className: 'check-nav' },
        el('button', { className: 'ghost', type: 'button', textContent: 'Back', disabled: busy || check.i === 0, onclick: () => checkDo(() => checkTo(check.i - 1)) }),
          el('button', { className: 'primary big', type: 'button', textContent: check.i === check.steps.length - 1 ? 'Last one' : 'Next', disabled: busy || check.i === check.steps.length - 1, onclick: () => checkDo(() => checkTo(check.i + 1)) }))),
      fader(check.src.kind === 'osc' ? `${now.st ? 'ST' : now.bus} master` : 'Noise')) : null,
    ready ? el('ol', { className: 'check-steps' }, ...steps.map((st, k) => el('li', {},
      el('button', { type: 'button', className: check?.i === k ? 'on' : '', 'aria-current': check?.i === k ? 'step' : null, disabled: !check || busy, onclick: () => checkDo(() => checkTo(k)) },
        el('span', { textContent: st.name }), el('small', { className: 'mono', textContent: [st.bus, st.amp].filter(Boolean).join(' · ') }))))) : null,
  ].filter(Boolean));
}
async function sendCue(commands) {
  const res = await api('/api/cue', { method: 'POST', body: JSON.stringify({ commands }) });
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
    toast(err.message, 'bad');
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

// ---- Paperwork: input list, outputs, line check, desk tape, labels, amps, RF and Dante, ready to print ----
// Paperwork and the prep sheet open as their own printable page (in the Mac app, their own window)
function openDoc(p) {
  if (host.paperwork) return host.paperwork(p);
  const title = p.title.replace(/[<>&]/g, '');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>body{margin:24px;background:#fff}${p.css}@media print{.noprint{display:none}body{margin:0}}</style></head><body><p class="noprint"><button onclick="print()">Print</button></p>${p.body}</body></html>`;
  window.open(URL.createObjectURL(new Blob([html], { type: 'text/html' })), '_blank');
}
const licenceText = () => (host.demo ? '' : host.licence || LICENCE);
$('paperworkBtn').onclick = () => {
  const plan = buildPlan(show);
  openDoc(paperwork(show, plan, { version: VERSION, licence: licenceText(), extra: rigPaperwork(show, plan) }));
};
$('prepBtn').onclick = () => openDoc(prepSheet(show, buildPlan(show), { version: VERSION, licence: licenceText() }));

wireMenus();
renderTemplates();
$('footProduct').textContent = `${PRODUCT} v${VERSION}`;
$('footLicence').textContent = host.demo ? 'Demo' : `Licence ${host.licence || LICENCE}`;
showLink(link);
showTab(activeTab);
