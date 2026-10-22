// Amplifiers and RF for a show: which d&b amp channel drives each speaker output, which Shure or Spectera
// channel carries each radio mic and IEM, a starting frequency plan, and the lines sent to the devices.
// Everything starts at its lowest gain or muted, for safety. Shared by the app, the demo and the tests.
import { danteChannel, isMonitor, portLabel } from './plan.js';

// ---- d&b amplifiers ----
// u: rack units. d&b amps are 2U, apart from the 5D (1U).
export const AMP_MODELS = {
  D80: { label: 'd&b D80', channels: 4, u: 2 },
  D40: { label: 'd&b D40', channels: 4, u: 2 },
  D20: { label: 'd&b D20', channels: 4, u: 2 },
  D90: { label: 'd&b D90', channels: 4, u: 2 },
  '40D': { label: 'd&b 40D', channels: 4, u: 2 },
  '30D': { label: 'd&b 30D', channels: 4, u: 2 },
  '10D': { label: 'd&b 10D', channels: 4, u: 2 },
  '5D': { label: 'd&b 5D', channels: 4, u: 1 },
  D12: { label: 'd&b D12', channels: 2, u: 2 },
  D6: { label: 'd&b D6', channels: 2, u: 2 },
};
// d&b DS10 audio network bridge: 1U, Dante in, 16 channels out as AES3 (two channels per AES out, so
// AES out 1 carries channels 1/2), with a 5-port network switch for the amps
export const DS10 = { label: 'd&b DS10', u: 1, aesOuts: 8, channels: 16 };
// How the amps get their signal: analogue XLR from the desk, Dante straight into the amps, or Dante to a
// DS10 and AES3 from it to the amps
export const AMP_FEEDS = { analog: 'Analogue', dante: 'Dante', ds10: 'DS10 (AES)' };
export const AMP_CHANNEL_NAMES = ['A', 'B', 'C', 'D'];
// Amp inputs: analogue A1-A4, AES D1-D4, and network audio where the amp has it
export const AMP_INPUTS = ['A1', 'A2', 'A3', 'A4', 'D1', 'D2', 'D3', 'D4', 'Network 1', 'Network 2', 'Network 3', 'Network 4'];
// Common d&b speaker setups, offered as suggestions; any name can be typed
export const SPEAKER_SETUPS = [
  'GSL8', 'GSL12', 'SL-SUB', 'KSL8', 'KSL12', 'SL-GSUB', 'V8', 'V12', 'V7P', 'V10P', 'V-SUB', 'V-GSUB', 'Y8', 'Y12', 'Y7P', 'Y10P', 'Y-SUB',
  'T10', 'Q7', 'Q10', 'Q-SUB', 'A-SUB', 'E4', 'E5', 'E6', 'E8', 'E12', '4S', '5S', '8S', '10S', '12S', '44S', '24S', 'B6-SUB', 'B22-SUB', 'M2', 'M4', 'MAX2',
];
const SETUP_GUESS = { main: 'Y10P', frontfill: '44S', delay: 'Y10P', ceiling: '5S', foldback: 'M4', sub: 'Y-SUB' };
// The sub that goes with a top, for an amp in sub/top mode
export function subSetupFor(top) {
  const t = String(top || '').toUpperCase();
  if (/^GSL|^KSL|^SL/.test(t)) return 'SL-SUB';
  if (/^V/.test(t)) return 'V-SUB';
  if (/^Y/.test(t)) return 'Y-SUB';
  if (/^Q|^T10/.test(t)) return 'Q-SUB';
  if (/^A/.test(t)) return 'A-SUB';
  return 'B6-SUB';
}
// Amp modes: each channel its own output, or channel pairs as top + sub fed from one input (d&b calls this
// Mix TOP/SUB): A and B take one output (A the top, B the sub), C and D the next.
export const AMP_MODES = { dual: 'Dual channel', subtop: 'Sub/Top' };

// Speaker outputs that need an amp channel: every output except IEMs and record feeds. A stereo output
// (Main L/R, stereo zones) takes one channel per side.
export function ampFeeds(plan) {
  const feeds = [];
  for (const o of plan.outputs) {
    if (o.zone.type === 'record' || o.zone.type === 'iemMono' || o.zone.type === 'iemStereo') continue;
    o.buses.forEach((bus, k) => {
      const side = o.buses.length === 2 ? (k ? 'R' : 'L') : '';
      const patch = o.patch && { bank: o.patch.bank, port: o.patch.port + k };
      feeds.push({
        key: `${o.zone.id}${side}`, zone: o.zone, side, bus,
        name: side ? `${o.zone.name} ${side}` : o.zone.name,
        deskOut: patch, deskOutLabel: portLabel(patch), dante: danteChannel(patch, plan.outBanks || []),
      });
    });
  }
  // Subs from main: a sub feed per side, from the same desk output as its top, after the tops
  const tops = feeds.filter((f) => f.zone.type === 'main' && f.zone.subs === 'main');
  feeds.splice(tops.length ? feeds.indexOf(tops.at(-1)) + 1 : 0, 0, ...tops.map((t) => ({ ...t, key: `${t.key}:sub`, name: `${t.name} sub`, subOf: t.key })));
  return feeds;
}

export function makeAmp(model = 'D80', n = 1) {
  return { id: `amp${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, model, name: `Amp ${n}`, ip: '' };
}
// Adds amps of one model until every speaker output has a channel
export function addAmpsFor(show, plan, model = 'D80', mode = 'dual') {
  show.amps ||= [];
  while (ampPlan(show, plan).warnings.length && show.amps.length < 64) show.amps.push({ ...makeAmp(model, show.amps.length + 1), mode });
  return show.amps;
}

function defaultInput(ampFeed, feed, k) {
  if (ampFeed === 'ds10') return null; // set below, in order of the amp's inputs used
  if (ampFeed === 'dante' || (!ampFeed && feed?.dante)) return `Network ${k + 1}`;
  return AMP_INPUTS[k];
}
// Speaker outputs fill amp channels in output order, amp by amp in rack order. An amp in sub/top mode
// takes one output per channel pair: the top on the first channel, its sub on the second, both from the
// first channel's input. Per-output settings (speaker setup, amp input, target gain) are kept by output
// (and ":sub" for its sub channel), so they follow it when the order changes.
export function ampPlan(show, plan) {
  const feeds = ampFeeds(plan);
  const settings = show.ampSettings || {};
  const rows = [];
  let next = 0;
  const covered = new Set(); // tops whose sub already rides on a sub/top pair
  const take = () => {
    while (next < feeds.length && feeds[next].subOf && covered.has(feeds[next].subOf)) next++;
    return feeds[next++] || null;
  };
  for (const amp of show.amps || []) {
    const n = AMP_MODELS[amp.model]?.channels || 0;
    const subtop = amp.mode === 'subtop';
    for (let k = 0; k < n; k++) {
      const sub = subtop && k % 2 === 1;
      const feed = sub ? rows.at(-1).feed : take();
      if (sub && feed) covered.add(feed.key);
      const key = feed && (sub ? `${feed.key}:sub` : feed.key);
      const set = (key && settings[key]) || {};
      const top = sub ? rows.at(-1) : null;
      rows.push({
        amp, index: k, label: `${amp.name} · Ch ${AMP_CHANNEL_NAMES[k]}`, feed, sub, settingsKey: key,
        // a subs output on a sub/top pair is just two sub channels
        setup: feed ? set.setup ?? (sub ? (feed.zone.type === 'sub' || feed.subOf ? top.setup : subSetupFor(top.setup)) : feed.subOf ? subSetupFor(SETUP_GUESS.main) : SETUP_GUESS[feed.zone.type] ?? '') : '',
        input: sub ? top.input : set.input || defaultInput(show.ampFeed, feed, k),
        target: set.target ?? 0,
      });
    }
  }
  // From a DS10, each amp takes AES inputs D1, D2… in channel order (a sub/top pair needs one)
  if (show.ampFeed === 'ds10') {
    for (const amp of show.amps || []) {
      let d = 0;
      for (const r of rows.filter((x) => x.amp === amp)) {
        if (!r.feed) continue;
        if (r.sub) { r.input = rows[rows.indexOf(r) - 1].input; continue; }
        r.input = (settings[r.settingsKey] || {}).input || `D${++d}`;
      }
    }
  }
  const warnings = [];
  const spare = feeds.slice(next).filter((f) => !(f.subOf && covered.has(f.subOf)));
  if (spare.length) warnings.push(`No amp channel yet for ${spare.map((f) => f.name).join(', ')}. Add an amp.`);
  return { rows, feeds, warnings };
}
// What a row carries, for lists: "Main LR L", or "Main LR L sub"
export const rowFeedName = (r) => (r.feed ? `${r.feed.name}${r.sub && r.feed.zone.type !== 'sub' && !r.feed.subOf ? ' sub' : ''}` : '');

// ---- DS10: Dante to AES3 for the amps ----
export function makeDs10(n) {
  return { id: `ds${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, model: 'DS10', name: `DS10 ${n}`, ip: '' };
}
// One AES cable per pair of AES inputs an amp uses (D1/D2 on its AES in 1, D3/D4 on AES in 2), each from
// the next DS10 AES out. Returns the cables, the Dante routes into the DS10s and how many DS10s it takes.
export function ds10Plan(show, plan, rows = ampPlan(show, plan).rows) {
  const cables = [];
  for (const amp of show.amps || []) {
    const ins = rows.filter((r) => r.amp === amp && r.feed && !r.sub && /^D\d$/.test(r.input));
    const pairs = new Map();
    for (const r of ins) {
      const n = Number(r.input.slice(1));
      const pair = Math.ceil(n / 2);
      pairs.set(pair, [...(pairs.get(pair) || []), r]);
    }
    for (const [pair, list] of [...pairs].sort((a, b) => a[0] - b[0])) cables.push({ amp, ampIn: `AES in ${pair}`, inputs: `D${pair * 2 - 1}/D${pair * 2}`, rows: list });
  }
  const units = show.ds10s || [];
  cables.forEach((c, i) => {
    c.ds10 = units[Math.floor(i / DS10.aesOuts)] || null;
    c.ds10Index = Math.floor(i / DS10.aesOuts);
    c.aesOut = (i % DS10.aesOuts) + 1;
    // each amp input's channel on the DS10: AES out 3 carries 5 (first input of the pair) and 6
    for (const r of c.rows) r.ds10Channel = (c.aesOut - 1) * 2 + (Number(r.input.slice(1)) % 2 === 1 ? 1 : 2);
  });
  const dante = cables.flatMap((c) => c.rows.map((r) => ({ ds10: c.ds10, ds10Index: c.ds10Index, channel: r.ds10Channel, row: r, deskOut: r.feed.dante })));
  const warnings = [];
  if (cables.length && !dante.some((d) => d.deskOut)) warnings.push('Patch the outputs to Dante (Patch, on the Desk tab) so the desk can send them to the DS10.');
  return { cables, dante, needed: Math.ceil(cables.length / DS10.aesOuts), warnings };
}
// Keeps the number of DS10s in the show to what the amps need (only when the amps are fed from a DS10);
// spare ones with no IP go. Returns true if it changed anything.
export function syncDs10s(show, plan) {
  show.ds10s ||= [];
  const need = show.ampFeed === 'ds10' ? ds10Plan(show, plan).needed : 0;
  let changed = false;
  while (show.ds10s.length < need) { show.ds10s.push(makeDs10(show.ds10s.length + 1)); changed = true; }
  while (show.ds10s.length > need && !show.ds10s.at(-1).ip) { show.ds10s.pop(); changed = true; }
  return changed;
}

// ---- RF: Shure receivers and IEM transmitters, Sennheiser Spectera ----
export const RECEIVER_MODELS = {
  ULXD4: { label: 'Shure ULXD4', family: 'ulx', channels: 1 },
  ULXD4D: { label: 'Shure ULXD4D', family: 'ulx', channels: 2 },
  ULXD4Q: { label: 'Shure ULXD4Q', family: 'ulx', channels: 4 },
  QLXD4: { label: 'Shure QLXD4', family: 'qlx', channels: 1 },
  AD4D: { label: 'Shure AD4D', family: 'ad', channels: 2 },
  AD4Q: { label: 'Shure AD4Q', family: 'ad', channels: 4 },
  SLXD4: { label: 'Shure SLXD4', family: 'slx', channels: 1 },
  SLXD4D: { label: 'Shure SLXD4D', family: 'slx', channels: 2 },
};
export const IEM_MODELS = {
  P10T: { label: 'Shure PSM1000 P10T', channels: 2 },
  P9T: { label: 'Shure PSM900 P9T', channels: 1 },
};
// Shure receiver gain runs -18 to +42 dB, sent as 0-60. Safe start sends 0 (-18 dB).
export const SHURE_GAIN = { min: -18, max: 42 };
// Spectera bodypack (SEK) and handheld (SKM) lowest settings, from Sennheiser's API
export const SPECTERA_LOWEST = { sekGain: -6, skmGain: -10, headphone: -100 };

const RADIO_TYPES = ['handheld', 'headset'];
// A source is a radio mic when it says so, or by type (handhelds and headsets)
export function isRadio(source) {
  return source.radio ?? RADIO_TYPES.includes(source.type);
}

export function makeRfDevice(kind, model, n) {
  return { id: `${kind}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, model, name: `${kind === 'rx' ? 'RX' : 'IEM TX'} ${n}`, ip: '' };
}
export function defaultRf() {
  return { mics: 'shure', iems: 'shure', receivers: [], transmitters: [], spectera: { ip: '', frequency: 0, bandwidth: 8 }, micRange: [606.5, 613.5], iemRange: [470, 534], fixed: {} };
}

// Radio mics fill receiver channels in desk channel order, IEM outputs fill transmitter channels in mix
// order. With Spectera, each radio mic is a handheld (SKM) or bodypack (SEK) and each IEM a bodypack.
export function rfPlan(show, plan) {
  const rf = { ...defaultRf(), ...(show.rf || {}) };
  const warnings = [];
  const mics = plan.channels.filter((c) => c.side !== 'R' && isRadio(c.source)).map((c) => ({
    key: `mic:${c.source.id}`, source: c.source, ch: c.ch, name: c.side ? c.source.name : c.name, deskIn: portLabel(c.patch), target: c.source.rfGain ?? 0,
  }));
  const iems = plan.outputs.filter((o) => o.zone.type === 'iemMono' || o.zone.type === 'iemStereo').map((o) => ({
    key: `iem:${o.zone.id}`, zone: o.zone, name: o.zone.name, stereo: o.zone.type === 'iemStereo', deskOut: o.patch ? `${portLabel(o.patch)}${o.ports > 1 ? `–${o.patch.port + 1}` : ''}` : 'unpatched',
    buses: o.buses.join('/'),
  }));

  const fill = (items, devices, models, what) => {
    const slots = [];
    for (const d of devices) for (let k = 0; k < (models[d.model]?.channels || 0); k++) slots.push({ device: d, channel: k + 1 });
    items.forEach((item, i) => { Object.assign(item, slots[i] ? { device: slots[i].device, channel: slots[i].channel, label: `${slots[i].device.name} · Ch ${slots[i].channel}` } : { label: '' }); });
    const left = items.filter((x) => !x.device);
    if (left.length) warnings.push(`No ${what} channel yet for ${left.map((x) => x.name).join(', ')}.`);
  };
  if (rf.mics === 'spectera') mics.forEach((m) => { m.label = m.source.type === 'handheld' ? 'Spectera SKM handheld' : 'Spectera SEK bodypack'; m.pack = m.source.type === 'handheld' ? 'SKM' : 'SEK'; });
  else fill(mics, rf.receivers, RECEIVER_MODELS, 'receiver');
  if (rf.iems === 'spectera') iems.forEach((x) => { x.label = 'Spectera SEK bodypack'; x.pack = 'SEK'; });
  else fill(iems, rf.transmitters, IEM_MODELS, 'IEM transmitter');

  // Frequencies: Shure channels each need one; Spectera uses one wideband RF channel for everything
  const shureMics = rf.mics === 'shure' ? mics : [];
  const shureIems = rf.iems === 'shure' ? iems : [];
  const usesSpectera = rf.mics === 'spectera' || rf.iems === 'spectera';
  const block = usesSpectera && rf.spectera?.frequency ? [rf.spectera.frequency - rf.spectera.bandwidth / 2, rf.spectera.frequency + rf.spectera.bandwidth / 2] : null;
  const freq = planFrequencies({
    groups: [
      { keys: shureMics.map((m) => m.key), range: rf.micRange, spacing: 0.4 },
      { keys: shureIems.map((x) => x.key), range: rf.iemRange, spacing: 0.6 },
    ],
    fixed: rf.fixed || {},
    exclude: block ? [block] : [],
  });
  for (const item of [...shureMics, ...shureIems]) { item.freq = freq.byKey[item.key] ?? null; item.freqFixed = rf.fixed?.[item.key] != null; }
  warnings.push(...freq.warnings);
  if (usesSpectera && !rf.spectera?.frequency) warnings.push('Set the Spectera RF channel so the Shure plan keeps clear of it.');
  return { rf, mics, iems, warnings, usesSpectera, block };
}

// ---- Frequency plan ----
// Picks frequencies on a 25 kHz grid inside each group's range, keeping every pair apart by the group's
// spacing and keeping clear of the third-order intermod products (2A-B) of every transmitter together.
// A starting plan only: scan the room and check it in Wireless Workbench before the show.
const STEP = 0.025;
const IM_GUARD = 0.15;
const r3 = (f) => Math.round(f * 1000) / 1000;
export function planFrequencies({ groups, fixed = {}, exclude = [] }) {
  const chosen = []; // { f, spacing }
  const byKey = {};
  const warnings = [];
  for (const g of groups) for (const key of g.keys) if (fixed[key] != null) { byKey[key] = r3(Number(fixed[key])); chosen.push({ f: byKey[key], spacing: g.spacing }); }
  const products = () => {
    const out = [];
    for (const a of chosen) for (const b of chosen) if (a !== b) out.push(2 * a.f - b.f);
    return out;
  };
  const clear = (f, spacing) => {
    if (exclude.some(([lo, hi]) => f > lo - spacing / 2 && f < hi + spacing / 2)) return false;
    if (chosen.some((c) => Math.abs(c.f - f) < Math.max(spacing, c.spacing) - 1e-9)) return false;
    if (products().some((p) => Math.abs(p - f) < IM_GUARD)) return false;
    // products the new one would make must miss everything already chosen (and itself)
    for (const c of chosen) {
      for (const p of [2 * f - c.f, 2 * c.f - f]) if (chosen.some((x) => Math.abs(x.f - p) < IM_GUARD)) return false;
    }
    return true;
  };
  for (const g of groups) {
    const [lo, hi] = g.range || [];
    let f = lo;
    for (const key of g.keys) {
      if (byKey[key] != null) continue;
      while (f != null && f <= hi + 1e-9 && !clear(r3(f), g.spacing)) f += STEP;
      if (f == null || !(f <= hi + 1e-9)) { warnings.push(`Ran out of clean frequencies between ${lo} and ${hi} MHz. Widen the range or drop a channel.`); break; }
      byKey[key] = r3(f);
      chosen.push({ f: byKey[key], spacing: g.spacing });
      f += STEP;
    }
  }
  return { byKey, warnings };
}

// ---- Lines sent to the devices ----
const shureName = (name) => String(name).replace(/[{}<>]/g, '').slice(0, 8);
export function shureGainValue(db) {
  return Math.round(Math.min(SHURE_GAIN.max, Math.max(SHURE_GAIN.min, db)) - SHURE_GAIN.min);
}
// Shure command strings for each receiver with an IP: name, frequency (in kHz) and gain at its lowest.
// The bridge wraps each line in "< >" and sends it to port 2202.
export function shureCommands(rig, { safe = true } = {}) {
  const byHost = new Map();
  for (const m of rig.mics) {
    if (!m.device?.ip) continue;
    const lines = byHost.get(m.device.ip) || [];
    lines.push(`SET ${m.channel} CHAN_NAME {${shureName(m.name)}}`);
    if (m.freq) lines.push(`SET ${m.channel} FREQUENCY ${String(Math.round(m.freq * 1000)).padStart(6, '0')}`);
    lines.push(`SET ${m.channel} AUDIO_GAIN ${shureGainValue(safe ? SHURE_GAIN.min : m.target)}`);
    byHost.set(m.device.ip, lines);
  }
  return [...byHost].map(([host, lines]) => ({ host, lines }));
}
// The GET that reads back a SET, and whether the receiver's REP matches what was sent
export function shureReadback(line) {
  const m = /^SET (\d+) (\w+) /.exec(line);
  return m ? `GET ${m[1]} ${m[2]}` : null;
}
export function shureMatches(line, reply) {
  const sent = /^SET (\d+) (\w+) (.*)$/.exec(line);
  const got = /<\s*REP\s+(\d+)\s+(\w+)\s+(.*?)\s*>/.exec(reply || '');
  if (!sent || !got || sent[1] !== got[1] || sent[2] !== got[2]) return false;
  const clean = (v) => v.replace(/^\{|\}$/g, '').trim();
  const [a, b] = [clean(sent[3]), clean(got[3])];
  return /^\d+$/.test(a) && /^\d+$/.test(b) ? Number(a) === Number(b) : a === b; // receivers pad numbers
}

// Spectera: names and lowest gains for the bodypacks and handhelds picked for each link
export function specteraWrites(rig, picks) {
  const writes = [];
  for (const item of [...(rig.rf.mics === 'spectera' ? rig.mics : []), ...(rig.rf.iems === 'spectera' ? rig.iems : [])]) {
    const pack = picks?.[item.key];
    if (!pack) continue;
    const body = { mtUid: pack.mtUid, type: pack.type, name: String(item.name).slice(0, 16) };
    if (item.key.startsWith('mic:')) body.micPreampGain = pack.type === 'SKM' ? SPECTERA_LOWEST.skmGain : SPECTERA_LOWEST.sekGain;
    else body.headphoneVolume = pack.headphoneVolumeMin ?? SPECTERA_LOWEST.headphone;
    const existing = writes.find((w) => w.body.mtUid === pack.mtUid);
    if (existing) Object.assign(existing.body, body, { name: existing.body.name });
    else writes.push({ path: `/mts/paired/all/${pack.mtUid}`, body });
  }
  return writes;
}

// ---- Paperwork: amp, RF and Dante pages for the paperwork pack ----
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function rigPaperwork(show, plan) {
  const amp = ampPlan(show, plan);
  const rig = rfPlan(show, plan);
  const parts = [];
  const used = amp.rows.filter((r) => r.feed);
  if (used.length) {
    parts.push(`<h2 class="page">Amplifiers</h2><p class="meta">Every channel starts muted with its gain at the lowest. Unmute and bring up one at a time.</p>
<table><thead><tr><th>Amp channel</th><th>IP</th><th>Feeds</th><th>From the desk</th><th>Amp input</th><th>Speaker setup</th><th>Start</th><th>Target</th></tr></thead><tbody>${used.map((r) => `<tr><td><b>${esc(r.label)}</b> <small>${esc(r.amp.model)}${r.amp.mode === 'subtop' ? ' · Sub/Top' : ''}</small></td><td>${esc(r.amp.ip)}</td><td>${esc(rowFeedName(r))}</td><td>${esc(r.feed.deskOutLabel)}</td><td>${esc(r.input)}</td><td>${esc(r.setup)}</td><td>Muted, lowest</td><td>${esc(r.target)} dB</td></tr>`).join('')}</tbody></table>`);
  }
  const rfRows = [...rig.mics.map((m) => ['Mic', m]), ...rig.iems.map((x) => ['IEM', x])];
  if (rfRows.length) {
    parts.push(`<h2 class="page">RF</h2><p class="meta">Frequencies are a starting plan. Scan the room and check them in Wireless Workbench before the show. Every gain starts at its lowest.</p>
<table><thead><tr><th>What</th><th>Name</th><th>Device</th><th>Frequency</th><th>Desk</th><th>Start</th></tr></thead><tbody>${rfRows.map(([kind, x]) => `<tr><td>${kind}</td><td><b>${esc(x.name)}</b></td><td>${esc(x.label)}${x.device?.ip ? ` <small>${esc(x.device.ip)}</small>` : ''}</td><td>${x.freq ? `${x.freq.toFixed(3)} MHz` : rig.usesSpectera && x.pack ? 'Spectera RF channel' : ''}</td><td>${kind === 'Mic' ? `Ch ${x.ch} · ${esc(x.deskIn)}` : `${esc(x.buses)} · ${esc(x.deskOut)}`}</td><td>${kind === 'Mic' ? 'Gain lowest' : 'Level lowest'}</td></tr>`).join('')}</tbody></table>`);
  }
  const dante = [];
  for (const c of plan.channels) {
    const n = danteChannel(c.patch, plan.inBanks || []);
    if (n) dante.push(`<tr><td>${esc(portLabel(c.patch))}</td><td>Desk Dante in ${n}</td><td>Ch ${c.ch} ${esc(c.name)}</td></tr>`);
  }
  for (const o of plan.outputs) {
    o.buses.forEach((bus, k) => {
      const p = o.patch && { bank: o.patch.bank, port: o.patch.port + k };
      const n = danteChannel(p, plan.outBanks || []);
      if (n) dante.push(`<tr><td>Desk Dante out ${n}</td><td>${esc(portLabel(p))}</td><td>${esc(o.name)} (${esc(bus)})</td></tr>`);
    });
  }
  if (show.ampFeed === 'ds10') {
    const ds = ds10Plan(show, plan, amp.rows);
    for (const d of ds.dante) if (d.deskOut) dante.push(`<tr><td>Desk Dante out ${d.deskOut}</td><td>${esc(d.ds10?.name || 'DS10')} channel ${d.channel}</td><td>${esc(rowFeedName(d.row))} → ${esc(d.row.label)}</td></tr>`);
    if (ds.cables.length) parts.push(`<h2>DS10 to the amps</h2><p class="meta">AES3 cables (110 Ω): each carries two channels.</p><table><thead><tr><th>DS10</th><th>AES out</th><th>To amp</th><th>Carries</th></tr></thead><tbody>${ds.cables.map((c) => `<tr><td>${esc(c.ds10?.name || 'DS10')}${c.ds10?.ip ? ` <small>${esc(c.ds10.ip)}</small>` : ''}</td><td>AES ${c.aesOut} (ch ${c.aesOut * 2 - 1}/${c.aesOut * 2})</td><td>${esc(c.amp.name)} · ${esc(c.ampIn)} (${esc(c.inputs)})</td><td>${c.rows.map((r) => `${esc(r.input)} ${esc(rowFeedName(r))}`).join(' · ')}</td></tr>`).join('')}</tbody></table>`);
  }
  if (dante.length) parts.push(`<h2 class="page">Dante patch</h2><p class="meta">Subscribe these in Dante Controller or the desk's Dante patch.</p><table><thead><tr><th>From</th><th>To</th><th>Signal</th></tr></thead><tbody>${dante.join('')}</tbody></table>`);
  return parts.join('\n');
}

// ---- Reading the kit back into the show ----
// Every receiver channel's name, frequency and gain
export function shureReadLines(device) {
  const lines = [];
  for (let ch = 1; ch <= (RECEIVER_MODELS[device.model]?.channels || 0); ch++) lines.push(`GET ${ch} CHAN_NAME`, `GET ${ch} FREQUENCY`, `GET ${ch} AUDIO_GAIN`);
  return lines;
}
// REP lines into one entry per channel: { ch, name, freq (MHz), gain (dB) }
export function parseShureReads(replies) {
  const byCh = new Map();
  for (const reply of replies) {
    const m = /<\s*REP\s+(\d+)\s+(CHAN_NAME|FREQUENCY|AUDIO_GAIN)\s+(.*?)\s*>/.exec(reply || '');
    if (!m) continue;
    const entry = byCh.get(m[1]) || { ch: Number(m[1]) };
    if (m[2] === 'CHAN_NAME') entry.name = m[3].replace(/^\{|\}$/g, '').trim();
    if (m[2] === 'FREQUENCY' && /^\d+$/.test(m[3])) entry.freq = Number(m[3]) / 1000; // sent and read in kHz
    if (m[2] === 'AUDIO_GAIN' && /^\d+$/.test(m[3])) entry.gain = Number(m[3]) + SHURE_GAIN.min;
    byCh.set(m[1], entry);
  }
  return [...byCh.values()].sort((a, b) => a.ch - b.ch);
}
// Puts what a receiver holds into the show: each channel goes to the mic with its name, else the mic the
// plan gives that channel. Its frequency is fixed in the plan and its gain becomes the mic's gain.
export function applyShureReads(show, plan, device, reads) {
  show.rf ||= defaultRf();
  show.rf.read = { ...(show.rf.read || {}), [device.id]: { at: new Date().toISOString(), channels: reads } };
  const rig = rfPlan(show, plan);
  // Names first, then channel position for the rest, each mic taken once
  const pairs = new Map();
  for (const r of reads) {
    const mic = r.name && rig.mics.find((m) => !pairs.has(m) && shureName(m.name).toLowerCase() === r.name.toLowerCase());
    if (mic) pairs.set(mic, r);
  }
  const used = new Set(pairs.values());
  for (const r of reads.filter((x) => !used.has(x))) {
    const mic = rig.mics.find((m) => !pairs.has(m) && m.device?.id === device.id && m.channel === r.ch);
    if (mic) pairs.set(mic, r);
  }
  for (const [mic, r] of pairs) {
    if (r.freq) show.rf.fixed = { ...show.rf.fixed, [mic.key]: r.freq };
    if (r.gain != null) mic.source.rfGain = r.gain;
  }
  const matched = pairs.size;
  return matched;
}
// An amp's AES70 read, kept with the show: who it is and every control's current value
export function ampReadSummary(dump) {
  const value = (o) => {
    const v = o.value;
    if (v && typeof v === 'object' && 'position' in v) return o.positionNames?.[v.position] ?? v.position;
    if (v && typeof v === 'object' && 'value' in v) return Math.round(v.value * 10) / 10;
    return v;
  };
  return {
    at: dump.readAt || new Date().toISOString(),
    model: dump.device?.model || '', name: dump.device?.name || '', serial: dump.device?.serial || '',
    controls: (dump.objects || []).filter((o) => o.value !== undefined).map((o) => ({ path: o.path, kind: String(o.className || '').replace(/^Oca/, ''), value: value(o) })),
  };
}

// ---- Racks: the order units sit in, top to bottom. That order is the fill order, so the first amp in
// the first rack takes the first speaker outputs, and the first receiver the first radio mics. A rack can
// hold amps, Shure units and anything else that's in it (blanks, power, a switch). ----
// Families: 'amp' (show.amps), 'rf' (Shure receivers and transmitters), 'item' (show.rackItems)
export const RACK_ITEMS = {
  blank: { label: 'Blank panel', u: 1 },
  vent: { label: 'Vent panel', u: 1 },
  power: { label: 'Power distro', u: 1 },
  switch: { label: 'Network switch', u: 1 },
  patch: { label: 'Patch panel', u: 1 },
  shelf: { label: 'Shelf', u: 1 },
  drawer: { label: 'Drawer', u: 2 },
  other: { label: 'Other', u: 1 },
};
export const RACK_SIZES = [0, 4, 6, 8, 10, 12, 14, 16, 20, 24, 30, 42]; // 0: as tall as what's in it
const familyLists = (show, family) => (family === 'amp' ? [show.amps || [], show.ds10s || []] : family === 'rf' ? [show.rf?.receivers || [], show.rf?.transmitters || []] : [show.rackItems || []]);
const FAMILIES = ['amp', 'rf', 'item'];
// The plate new racks get: 'logo' (KobiKraken), or 'company' once a logo is set in Preferences
export const RACK_DEFAULTS = { plate: 'logo' };
export function makeRack(kind, n) {
  return { id: `rack${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, kind, name: `${{ amp: 'Amp rack', rf: 'RF rack' }[kind] || 'Rack'} ${n}`, units: [], size: 0, plate: RACK_DEFAULTS.plate };
}
export function makeRackItem(type, n) {
  return { id: `item${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, type, name: RACK_ITEMS[type]?.label || 'Other', u: RACK_ITEMS[type]?.u || 1, n };
}
// Every racked thing, with its family: { unit, family }
export function rackEntries(show) {
  return FAMILIES.flatMap((family) => familyLists(show, family).flat().map((unit) => ({ unit, family })));
}
// How many rack units tall: d&b amps by model (2U, the 5D 1U), the DS10 and every RF unit 1U, items as set
export function unitHeight(unit, family) {
  if (family === 'item') return unit.u || RACK_ITEMS[unit.type]?.u || 1;
  if (unit.model === 'DS10') return DS10.u;
  if (family === 'amp') return AMP_MODELS[unit.model]?.u || 2;
  return 1; // every Shure receiver and IEM transmitter is 1U
}
// Racks a tab shows: ones holding that family, or made on that tab and still empty
export const racksOf = (show, kind) => {
  const ids = new Set(familyLists(show, kind).flat().map((u) => u.id));
  return (show.racks || []).filter((r) => r.units.some((id) => ids.has(id)) || (r.kind === kind && !r.units.length));
};
// Every unit in exactly one rack (a new one goes at the bottom of the last rack holding its family), gone
// ones dropped, and the amp and RF lists put in rack order
export function normalizeRacks(show) {
  show.racks ||= [];
  const entries = rackEntries(show);
  if (!entries.length && !show.racks.length) return show;
  const ids = new Set(entries.map((e) => e.unit.id));
  const seen = new Set();
  for (const r of show.racks) {
    r.units = r.units.filter((id) => ids.has(id) && !seen.has(id) && seen.add(id));
    r.size ??= 0;
    r.plate ||= 'logo';
  }
  for (const { unit, family } of entries) {
    if (seen.has(unit.id)) continue;
    const home = [...racksOf(show, family)].pop() || show.racks.at(-1) || (show.racks.push(makeRack(family, 1)), show.racks.at(-1));
    home.units.push(unit.id);
    seen.add(unit.id);
  }
  const pos = new Map(show.racks.flatMap((r) => r.units).map((id, i) => [id, i]));
  for (const family of FAMILIES) for (const list of familyLists(show, family)) list.sort((a, b) => pos.get(a.id) - pos.get(b.id));
  return show;
}
// Moves a unit to a rack, above `beforeId` (or at the bottom)
export function moveUnit(show, unitId, rackId, beforeId = null) {
  for (const r of show.racks || []) r.units = r.units.filter((id) => id !== unitId);
  const rack = show.racks.find((r) => r.id === rackId);
  const at = beforeId ? rack.units.indexOf(beforeId) : -1;
  rack.units.splice(at < 0 ? rack.units.length : at, 0, unitId);
  return normalizeRacks(show);
}
// Moves a unit one place up or down, across into the next rack at the ends. With `only`, it steps past
// units that aren't in that list (a tab that shows only amps moves an amp past the next amp).
export function nudgeUnit(show, unitId, dir, only = null) {
  const rack = show.racks.find((r) => r.units.includes(unitId));
  const visible = (id) => !only || only.has(id);
  const order = rack.units.filter((id) => id === unitId || visible(id));
  const j = order.indexOf(unitId) + dir;
  if (j >= 0 && j < order.length) {
    const target = order[j];
    rack.units.splice(rack.units.indexOf(unitId), 1);
    const at = rack.units.indexOf(target) + (dir > 0 ? 1 : 0);
    rack.units.splice(at, 0, unitId);
    return normalizeRacks(show);
  }
  const racks = show.racks;
  const next = racks[racks.indexOf(rack) + dir];
  if (!next) return show;
  return moveUnit(show, unitId, next.id, dir > 0 ? next.units[0] || null : null);
}

// ---- Is it the same box? A unit remembers who it was when it was racked (an amp's serial number, a
// Shure unit's model and device ID). Anything sent to that address first checks who answers now. ----
export function identityOf(found) {
  return { model: String(found.model || '').trim(), serial: String(found.serial || '').trim(), name: String(found.name || '').trim() };
}
export function sameDevice(expected, found) {
  if (!expected) return { ok: true, learn: true };
  const got = identityOf(found);
  const who = [got.model, got.name, got.serial && `serial ${got.serial}`].filter(Boolean).join(' · ') || 'something else';
  if (expected.serial && got.serial) return expected.serial === got.serial ? { ok: true } : { ok: false, who };
  if (expected.name && got.name && expected.name !== got.name) return { ok: false, who };
  if (expected.model && got.model && expected.model !== got.model) return { ok: false, who };
  return { ok: true };
}
// Turns what Find devices or an identify call says into a unit's model choice
export function ampModelFrom(text) {
  const t = String(text || '').toUpperCase().replace(/\s+/g, '');
  return Object.keys(AMP_MODELS).find((k) => t.includes(k.toUpperCase())) || null;
}
export function shureModelFrom(text) {
  const t = String(text || '').toUpperCase().replace(/[\s-]+/g, '');
  const rx = Object.keys(RECEIVER_MODELS).sort((a, b) => b.length - a.length).find((k) => t.includes(k));
  if (rx) return { kind: 'rx', model: rx };
  const tx = Object.keys(IEM_MODELS).find((k) => t.includes(k));
  return tx ? { kind: 'tx', model: tx } : null;
}
