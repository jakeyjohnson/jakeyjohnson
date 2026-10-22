// d&b amps and Shure/Spectera RF: channel allocation, frequency plan, device commands.
// Everything starts at lowest gain or muted.
import { danteChannel, isMonitor, portLabel } from './plan.js';

// ---- d&b amplifiers ----
// u: rack units. d&b amps are 2U, except the 5D (1U).
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
// DS10: 1U, Dante in, 16 ch out as AES3 (2 ch per AES out, out 1 = ch 1/2), 5-port switch for the amps
export const DS10 = { label: 'd&b DS10', u: 1, aesOuts: 8, channels: 16 };
// Analogue XLR from the desk, Dante direct, or Dante to a DS10 then AES3 to the amps
export const AMP_FEEDS = { analog: 'Analogue', dante: 'Dante', ds10: 'DS10 (AES)' };
export const AMP_CHANNEL_NAMES = ['A', 'B', 'C', 'D'];
// Analogue A1-A4, AES D1-D4, network where the amp has it
export const AMP_INPUTS = [
  'A1',
  'A2',
  'A3',
  'A4',
  'D1',
  'D2',
  'D3',
  'D4',
  'Network 1',
  'Network 2',
  'Network 3',
  'Network 4',
];
// Suggestions only, any name can be typed
export const SPEAKER_SETUPS = [
  'GSL8',
  'GSL12',
  'SL-SUB',
  'KSL8',
  'KSL12',
  'SL-GSUB',
  'V8',
  'V12',
  'V7P',
  'V10P',
  'V-SUB',
  'V-GSUB',
  'Y8',
  'Y12',
  'Y7P',
  'Y10P',
  'Y-SUB',
  'T10',
  'Q7',
  'Q10',
  'Q-SUB',
  'A-SUB',
  'E4',
  'E5',
  'E6',
  'E8',
  'E12',
  '4S',
  '5S',
  '8S',
  '10S',
  '12S',
  '44S',
  '24S',
  'B6-SUB',
  'B22-SUB',
  'M2',
  'M4',
  'MAX2',
];
const SETUP_GUESS = {
  main: 'Y10P',
  frontfill: '44S',
  delay: 'Y10P',
  ceiling: '5S',
  foldback: 'M4',
  sub: 'Y-SUB',
};
// Matching sub for a top, for sub/top mode
export function subSetupFor(top) {
  const t = String(top || '').toUpperCase();
  if (/^GSL|^KSL|^SL/.test(t)) return 'SL-SUB';
  if (/^V/.test(t)) return 'V-SUB';
  if (/^Y/.test(t)) return 'Y-SUB';
  if (/^Q|^T10/.test(t)) return 'Q-SUB';
  if (/^A/.test(t)) return 'A-SUB';
  return 'B6-SUB';
}
// dual: one output per channel. subtop: d&b Mix TOP/SUB, A/B share one input (A top, B sub), C/D likewise.
export const AMP_MODES = { dual: 'Dual channel', subtop: 'Sub/Top' };

// Every output except IEMs and record feeds. Stereo takes one channel per side.
export function ampFeeds(plan) {
  const feeds = [];
  for (const o of plan.outputs) {
    if (o.zone.type === 'record' || o.zone.type === 'iemMono' || o.zone.type === 'iemStereo') continue;
    o.buses.forEach((bus, k) => {
      const side = o.buses.length === 2 ? (k ? 'R' : 'L') : '';
      const patch = o.patch && { bank: o.patch.bank, port: o.patch.port + k };
      feeds.push({
        key: `${o.zone.id}${side}`,
        zone: o.zone,
        side,
        bus,
        name: side ? `${o.zone.name} ${side}` : o.zone.name,
        deskOut: patch,
        deskOutLabel: portLabel(patch),
        dante: danteChannel(patch, plan.outBanks || []),
      });
    });
  }
  // Subs from main: a sub per side, same desk output as its top, after the tops
  const tops = feeds.filter((f) => f.zone.type === 'main' && f.zone.subs === 'main');
  feeds.splice(
    tops.length ? feeds.indexOf(tops.at(-1)) + 1 : 0,
    0,
    ...tops.map((t) => ({ ...t, key: `${t.key}:sub`, name: `${t.name} sub`, subOf: t.key })),
  );
  return feeds;
}

export function makeAmp(model = 'D80', n = 1) {
  return {
    id: `amp${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    model,
    name: `Amp ${n}`,
    ip: '',
  };
}
export function addAmpsFor(show, plan, model = 'D80', mode = 'dual') {
  show.amps ||= [];
  while (ampPlan(show, plan).warnings.length && show.amps.length < 64)
    show.amps.push({ ...makeAmp(model, show.amps.length + 1), mode });
  return show.amps;
}

function defaultInput(ampFeed, feed, k) {
  if (ampFeed === 'ds10') return null; // set below, in amp input order
  if (ampFeed === 'dante' || (!ampFeed && feed?.dante)) return `Network ${k + 1}`;
  return AMP_INPUTS[k];
}
// Outputs fill amp channels in output order, amps in rack order. Sub/top pair: top on first ch, sub on
// second, both from the first ch's input. Per-output settings keyed by output (+ ":sub") so they
// follow the output when the order changes.
export function ampPlan(show, plan) {
  const feeds = ampFeeds(plan);
  const settings = show.ampSettings || {};
  const rows = [];
  let next = 0;
  const covered = new Set(); // tops already paired with their sub
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
        amp,
        index: k,
        label: `${amp.name} · Ch ${AMP_CHANNEL_NAMES[k]}`,
        feed,
        sub,
        settingsKey: key,
        // subs output on a sub/top pair: just two sub channels
        setup: feed
          ? (set.setup ??
            (sub
              ? feed.zone.type === 'sub' || feed.subOf
                ? top.setup
                : subSetupFor(top.setup)
              : feed.subOf
                ? subSetupFor(SETUP_GUESS.main)
                : (SETUP_GUESS[feed.zone.type] ?? '')))
          : '',
        input: sub ? top.input : set.input || defaultInput(show.ampFeed, feed, k),
        target: set.target ?? 0,
      });
    }
  }
  // DS10 feed: AES inputs D1, D2, ... in channel order (one per sub/top pair)
  if (show.ampFeed === 'ds10') {
    for (const amp of show.amps || []) {
      let d = 0;
      for (const r of rows.filter((x) => x.amp === amp)) {
        if (!r.feed) continue;
        if (r.sub) {
          r.input = rows[rows.indexOf(r) - 1].input;
          continue;
        }
        r.input = (settings[r.settingsKey] || {}).input || `D${++d}`;
      }
    }
  }
  const warnings = [];
  const spare = feeds.slice(next).filter((f) => !(f.subOf && covered.has(f.subOf)));
  if (spare.length)
    warnings.push(`No amp channel yet for ${spare.map((f) => f.name).join(', ')}. Add an amp.`);
  return { rows, feeds, warnings };
}
// "Main LR L", "Main LR L sub"
export const rowFeedName = (r) =>
  r.feed ? `${r.feed.name}${r.sub && r.feed.zone.type !== 'sub' && !r.feed.subOf ? ' sub' : ''}` : '';

// ---- DS10 ----
export function makeDs10(n) {
  return {
    id: `ds${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    model: 'DS10',
    name: `DS10 ${n}`,
    ip: '',
  };
}
// One AES cable per pair of amp AES inputs (D1/D2 on AES in 1, D3/D4 on AES in 2), from the next
// DS10 AES out. Returns cables, Dante routes into the DS10s and DS10 count.
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
    for (const [pair, list] of [...pairs].sort((a, b) => a[0] - b[0]))
      cables.push({ amp, ampIn: `AES in ${pair}`, inputs: `D${pair * 2 - 1}/D${pair * 2}`, rows: list });
  }
  const units = show.ds10s || [];
  cables.forEach((c, i) => {
    c.ds10 = units[Math.floor(i / DS10.aesOuts)] || null;
    c.ds10Index = Math.floor(i / DS10.aesOuts);
    c.aesOut = (i % DS10.aesOuts) + 1;
    // AES out 3 carries ch 5 (first of the pair) and 6
    for (const r of c.rows) r.ds10Channel = (c.aesOut - 1) * 2 + (Number(r.input.slice(1)) % 2 === 1 ? 1 : 2);
  });
  const dante = cables.flatMap((c) =>
    c.rows.map((r) => ({
      ds10: c.ds10,
      ds10Index: c.ds10Index,
      channel: r.ds10Channel,
      row: r,
      deskOut: r.feed.dante,
    })),
  );
  const warnings = [];
  if (cables.length && !dante.some((d) => d.deskOut))
    warnings.push(
      'Patch the outputs to Dante (Patch, on the Desk tab) so the desk can send them to the DS10.',
    );
  return { cables, dante, needed: Math.ceil(cables.length / DS10.aesOuts), warnings };
}
// DS10 feed only: match DS10 count to the amps, drop spares with no IP. True if changed.
export function syncDs10s(show, plan) {
  show.ds10s ||= [];
  const need = show.ampFeed === 'ds10' ? ds10Plan(show, plan).needed : 0;
  let changed = false;
  while (show.ds10s.length < need) {
    show.ds10s.push(makeDs10(show.ds10s.length + 1));
    changed = true;
  }
  while (show.ds10s.length > need && !show.ds10s.at(-1).ip && !show.ds10s.at(-1).fixed) {
    show.ds10s.pop();
    changed = true;
  }
  return changed;
}

// ---- RF: Shure, Spectera ----
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
// Shure RX gain -18 to +42 dB, sent as 0-60. Safe start: 0 (-18 dB).
export const SHURE_GAIN = { min: -18, max: 42 };
// Spectera SEK (bodypack) / SKM (handheld) lowest settings, per Sennheiser API
export const SPECTERA_LOWEST = { sekGain: -6, skmGain: -10, headphone: -100 };

const RADIO_TYPES = ['handheld', 'headset'];
// Flagged as radio, or handheld/headset type
export function isRadio(source) {
  return source.radio ?? RADIO_TYPES.includes(source.type);
}

export function makeRfDevice(kind, model, n) {
  return {
    id: `${kind}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    model,
    name: `${kind === 'rx' ? 'RX' : 'IEM TX'} ${n}`,
    ip: '',
  };
}
export function defaultRf() {
  return {
    mics: 'shure',
    iems: 'shure',
    receivers: [],
    transmitters: [],
    spectera: { ip: '', frequency: 0, bandwidth: 8 },
    micRange: [606.5, 613.5],
    iemRange: [470, 534],
    fixed: {},
  };
}

// Radio mics fill RX channels in desk channel order, IEMs fill TX channels in mix order.
// Spectera: mics are SKM or SEK, IEMs SEK.
export function rfPlan(show, plan) {
  const rf = { ...defaultRf(), ...(show.rf || {}) };
  const warnings = [];
  const mics = plan.channels
    .filter((c) => c.side !== 'R' && isRadio(c.source))
    .map((c) => ({
      key: `mic:${c.source.id}`,
      source: c.source,
      ch: c.ch,
      name: c.side ? c.source.name : c.name,
      deskIn: portLabel(c.patch),
      target: c.source.rfGain ?? 0,
    }));
  const iems = plan.outputs
    .filter((o) => o.zone.type === 'iemMono' || o.zone.type === 'iemStereo')
    .map((o) => ({
      key: `iem:${o.zone.id}`,
      zone: o.zone,
      name: o.zone.name,
      stereo: o.zone.type === 'iemStereo',
      deskOut: o.patch ? `${portLabel(o.patch)}${o.ports > 1 ? `–${o.patch.port + 1}` : ''}` : 'unpatched',
      buses: o.buses.join('/'),
    }));

  const fill = (items, devices, models, what) => {
    const slots = [];
    for (const d of devices)
      for (let k = 0; k < (models[d.model]?.channels || 0); k++) slots.push({ device: d, channel: k + 1 });
    items.forEach((item, i) => {
      Object.assign(
        item,
        slots[i]
          ? {
              device: slots[i].device,
              channel: slots[i].channel,
              label: `${slots[i].device.name} · Ch ${slots[i].channel}`,
            }
          : { label: '' },
      );
    });
    const left = items.filter((x) => !x.device);
    if (left.length) warnings.push(`No ${what} channel yet for ${left.map((x) => x.name).join(', ')}.`);
  };
  if (rf.mics === 'spectera')
    mics.forEach((m) => {
      m.label = m.source.type === 'handheld' ? 'Spectera SKM handheld' : 'Spectera SEK bodypack';
      m.pack = m.source.type === 'handheld' ? 'SKM' : 'SEK';
    });
  else fill(mics, rf.receivers, RECEIVER_MODELS, 'receiver');
  if (rf.iems === 'spectera')
    iems.forEach((x) => {
      x.label = 'Spectera SEK bodypack';
      x.pack = 'SEK';
    });
  else fill(iems, rf.transmitters, IEM_MODELS, 'IEM transmitter');

  // Shure: one frequency per channel. Spectera: one wideband RF channel for all.
  const shureMics = rf.mics === 'shure' ? mics : [];
  const shureIems = rf.iems === 'shure' ? iems : [];
  const usesSpectera = rf.mics === 'spectera' || rf.iems === 'spectera';
  const block =
    usesSpectera && rf.spectera?.frequency
      ? [rf.spectera.frequency - rf.spectera.bandwidth / 2, rf.spectera.frequency + rf.spectera.bandwidth / 2]
      : null;
  const freq = planFrequencies({
    groups: [
      { keys: shureMics.map((m) => m.key), range: rf.micRange, spacing: 0.4 },
      { keys: shureIems.map((x) => x.key), range: rf.iemRange, spacing: 0.6 },
    ],
    fixed: rf.fixed || {},
    exclude: block ? [block] : [],
  });
  for (const item of [...shureMics, ...shureIems]) {
    item.freq = freq.byKey[item.key] ?? null;
    item.freqFixed = rf.fixed?.[item.key] != null;
  }
  warnings.push(...freq.warnings);
  if (usesSpectera && !rf.spectera?.frequency)
    warnings.push('Set the Spectera RF channel so the Shure plan keeps clear of it.');
  return { rf, mics, iems, warnings, usesSpectera, block };
}

// ---- Frequency plan ----
// 25 kHz grid in each group's range, pairs kept apart by group spacing, clear of 3rd-order IMD (2A-B)
// across all transmitters. Starting point only: scan and check in WWB before the show.
const STEP = 0.025;
const IM_GUARD = 0.15;
const r3 = (f) => Math.round(f * 1000) / 1000;
export function planFrequencies({ groups, fixed = {}, exclude = [] }) {
  const chosen = []; // { f, spacing }
  const byKey = {};
  const warnings = [];
  for (const g of groups)
    for (const key of g.keys)
      if (fixed[key] != null) {
        byKey[key] = r3(Number(fixed[key]));
        chosen.push({ f: byKey[key], spacing: g.spacing });
      }
  const products = () => {
    const out = [];
    for (const a of chosen) for (const b of chosen) if (a !== b) out.push(2 * a.f - b.f);
    return out;
  };
  const clear = (f, spacing) => {
    if (exclude.some(([lo, hi]) => f > lo - spacing / 2 && f < hi + spacing / 2)) return false;
    if (chosen.some((c) => Math.abs(c.f - f) < Math.max(spacing, c.spacing) - 1e-9)) return false;
    if (products().some((p) => Math.abs(p - f) < IM_GUARD)) return false;
    // new IMD products must miss everything chosen, itself included
    for (const c of chosen) {
      for (const p of [2 * f - c.f, 2 * c.f - f])
        if (chosen.some((x) => Math.abs(x.f - p) < IM_GUARD)) return false;
    }
    return true;
  };
  for (const g of groups) {
    const [lo, hi] = g.range || [];
    let f = lo;
    for (const key of g.keys) {
      if (byKey[key] != null) continue;
      while (f != null && f <= hi + 1e-9 && !clear(r3(f), g.spacing)) f += STEP;
      if (f == null || !(f <= hi + 1e-9)) {
        warnings.push(
          `Ran out of clean frequencies between ${lo} and ${hi} MHz. Widen the range or drop a channel.`,
        );
        break;
      }
      byKey[key] = r3(f);
      chosen.push({ f: byKey[key], spacing: g.spacing });
      f += STEP;
    }
  }
  return { byKey, warnings };
}

// ---- Lines sent to the devices ----
const shureName = (name) =>
  String(name)
    .replace(/[{}<>]/g, '')
    .slice(0, 8);
export function shureGainValue(db) {
  return Math.round(Math.min(SHURE_GAIN.max, Math.max(SHURE_GAIN.min, db)) - SHURE_GAIN.min);
}
// Per receiver with an IP: name, freq (kHz), gain at lowest.
// Bridge wraps each in "< >" and sends to port 2202.
export function shureCommands(rig, { safe = true } = {}) {
  const byHost = new Map();
  for (const m of rig.mics) {
    if (!m.device?.ip) continue;
    const lines = byHost.get(m.device.ip) || [];
    lines.push(`SET ${m.channel} CHAN_NAME {${shureName(m.name)}}`);
    if (m.freq)
      lines.push(`SET ${m.channel} FREQUENCY ${String(Math.round(m.freq * 1000)).padStart(6, '0')}`);
    lines.push(`SET ${m.channel} AUDIO_GAIN ${shureGainValue(safe ? SHURE_GAIN.min : m.target)}`);
    byHost.set(m.device.ip, lines);
  }
  return [...byHost].map(([host, lines]) => ({ host, lines }));
}
// GET to read back a SET, and whether the REP matches
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

// Names and lowest gains for the SEK/SKM on each link
export function specteraWrites(rig, picks) {
  const writes = [];
  for (const item of [
    ...(rig.rf.mics === 'spectera' ? rig.mics : []),
    ...(rig.rf.iems === 'spectera' ? rig.iems : []),
  ]) {
    const pack = picks?.[item.key];
    if (!pack) continue;
    const body = { mtUid: pack.mtUid, type: pack.type, name: String(item.name).slice(0, 16) };
    if (item.key.startsWith('mic:'))
      body.micPreampGain = pack.type === 'SKM' ? SPECTERA_LOWEST.skmGain : SPECTERA_LOWEST.sekGain;
    else body.headphoneVolume = pack.headphoneVolumeMin ?? SPECTERA_LOWEST.headphone;
    const existing = writes.find((w) => w.body.mtUid === pack.mtUid);
    if (existing) Object.assign(existing.body, body, { name: existing.body.name });
    else writes.push({ path: `/mts/paired/all/${pack.mtUid}`, body });
  }
  return writes;
}

// ---- Paperwork: amp, RF and Dante pages ----
const esc = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
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
    if (n)
      dante.push(
        `<tr><td>${esc(portLabel(c.patch))}</td><td>Desk Dante in ${n}</td><td>Ch ${c.ch} ${esc(c.name)}</td></tr>`,
      );
  }
  for (const o of plan.outputs) {
    o.buses.forEach((bus, k) => {
      const p = o.patch && { bank: o.patch.bank, port: o.patch.port + k };
      const n = danteChannel(p, plan.outBanks || []);
      if (n)
        dante.push(
          `<tr><td>Desk Dante out ${n}</td><td>${esc(portLabel(p))}</td><td>${esc(o.name)} (${esc(bus)})</td></tr>`,
        );
    });
  }
  if (show.ampFeed === 'ds10') {
    const ds = ds10Plan(show, plan, amp.rows);
    for (const d of ds.dante)
      if (d.deskOut)
        dante.push(
          `<tr><td>Desk Dante out ${d.deskOut}</td><td>${esc(d.ds10?.name || 'DS10')} channel ${d.channel}</td><td>${esc(rowFeedName(d.row))} → ${esc(d.row.label)}</td></tr>`,
        );
    if (ds.cables.length)
      parts.push(
        `<h2>DS10 to the amps</h2><p class="meta">AES3 cables (110 Ω): each carries two channels.</p><table><thead><tr><th>DS10</th><th>AES out</th><th>To amp</th><th>Carries</th></tr></thead><tbody>${ds.cables.map((c) => `<tr><td>${esc(c.ds10?.name || 'DS10')}${c.ds10?.ip ? ` <small>${esc(c.ds10.ip)}</small>` : ''}</td><td>AES ${c.aesOut} (ch ${c.aesOut * 2 - 1}/${c.aesOut * 2})</td><td>${esc(c.amp.name)} · ${esc(c.ampIn)} (${esc(c.inputs)})</td><td>${c.rows.map((r) => `${esc(r.input)} ${esc(rowFeedName(r))}`).join(' · ')}</td></tr>`).join('')}</tbody></table>`,
      );
  }
  if (dante.length)
    parts.push(
      `<h2 class="page">Dante patch</h2><p class="meta">Subscribe these in Dante Controller or the desk's Dante patch.</p><table><thead><tr><th>From</th><th>To</th><th>Signal</th></tr></thead><tbody>${dante.join('')}</tbody></table>`,
    );
  return parts.join('\n');
}

// ---- Read back from the kit ----
export function shureReadLines(device) {
  const lines = [];
  for (let ch = 1; ch <= (RECEIVER_MODELS[device.model]?.channels || 0); ch++)
    lines.push(`GET ${ch} CHAN_NAME`, `GET ${ch} FREQUENCY`, `GET ${ch} AUDIO_GAIN`);
  return lines;
}
// { ch, name, freq (MHz), gain (dB) } per channel
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
// Match channels to mics by name, else by plan position. Freq gets fixed in the plan, gain goes to the mic.
export function applyShureReads(show, plan, device, reads) {
  show.rf ||= defaultRf();
  show.rf.read = { ...(show.rf.read || {}), [device.id]: { at: new Date().toISOString(), channels: reads } };
  const rig = rfPlan(show, plan);
  // by name first, then position, each mic once
  const pairs = new Map();
  for (const r of reads) {
    const mic =
      r.name &&
      rig.mics.find((m) => !pairs.has(m) && shureName(m.name).toLowerCase() === r.name.toLowerCase());
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
// Last AES70 read: identity and current control values
export function ampReadSummary(dump) {
  const value = (o) => {
    const v = o.value;
    if (v && typeof v === 'object' && 'position' in v) return o.positionNames?.[v.position] ?? v.position;
    if (v && typeof v === 'object' && 'value' in v) return Math.round(v.value * 10) / 10;
    return v;
  };
  return {
    at: dump.readAt || new Date().toISOString(),
    model: dump.device?.model || '',
    name: dump.device?.name || '',
    serial: dump.device?.serial || '',
    controls: (dump.objects || [])
      .filter((o) => o.value !== undefined)
      .map((o) => ({ path: o.path, kind: String(o.className || '').replace(/^Oca/, ''), value: value(o) })),
  };
}

// ---- Racks ----
// Top-to-bottom order is fill order: first amp takes the first outputs, first receiver the first mics.
// Families: 'amp' (show.amps), 'rf' (Shure RX/TX), 'item' (show.rackItems: blanks, power, switch)
export const RACK_ITEMS = {
  blank: { label: 'Blank panel', u: 1 },
  vent: { label: 'Vent panel', u: 1 },
  power: { label: 'Power distro', u: 1 },
  switch: { label: 'Network switch', u: 1 },
  patch: { label: 'Patch panel', u: 1 },
  shelf: { label: 'Shelf', u: 1 },
  drawer: { label: 'Drawer', u: 2 },
  other: { label: 'Other', u: 1 },
  space: { label: 'Space', u: 1 },
};
export const PLATE_U = 2;
export const RACK_SIZES = [0, ...Array.from({ length: 48 }, (_, i) => i + 1)]; // 0: as tall as what's in it
const familyLists = (show, family) =>
  family === 'amp'
    ? [show.amps || [], show.ds10s || []]
    : family === 'rf'
      ? [show.rf?.receivers || [], show.rf?.transmitters || []]
      : [show.rackItems || []];
const FAMILIES = ['amp', 'rf', 'item'];
// 'logo' (KobiKraken), or 'company' once a logo is set in Preferences
export const RACK_DEFAULTS = { plate: 'logo' };
export function makeRack(kind, n) {
  return {
    id: `rack${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    kind,
    name: `${{ amp: 'Amp rack', rf: 'RF rack' }[kind] || 'Rack'} ${n}`,
    units: [],
    size: 0,
    plate: RACK_DEFAULTS.plate,
  };
}
export function makeRackItem(type, n) {
  return {
    id: `item${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    type,
    name: RACK_ITEMS[type]?.label || 'Other',
    u: RACK_ITEMS[type]?.u || 1,
    n,
  };
}
export function rackEntries(show) {
  return FAMILIES.flatMap((family) =>
    familyLists(show, family)
      .flat()
      .map((unit) => ({ unit, family })),
  );
}
// d&b by model (2U, 5D 1U), DS10 and RF 1U, items as set
export function unitHeight(unit, family) {
  if (family === 'item') return unit.u || RACK_ITEMS[unit.type]?.u || 1;
  if (unit.model === 'DS10') return DS10.u;
  if (family === 'amp') return AMP_MODELS[unit.model]?.u || 2;
  return 1; // all Shure RX/TX are 1U
}
// Holding that family, or made on that tab and still empty
export const racksOf = (show, kind) => {
  const ids = new Set(
    familyLists(show, kind)
      .flat()
      .map((u) => u.id),
  );
  return (show.racks || []).filter(
    (r) => r.units.some((id) => ids.has(id)) || (r.kind === kind && !r.units.length),
  );
};
// Each unit in exactly one rack (new ones at the bottom of the last rack of their family), gone ones
// dropped, amp and RF lists reordered to match
const isSpace = (unit) => unit?.type === 'space';
export const makeSpace = (u = 1) => ({ ...makeRackItem('space'), name: 'Space', u });
const entryOf = (show, id) => rackEntries(show).find((e) => e.unit.id === id);
const heightOf = (show, id) => {
  const e = entryOf(show, id);
  return e ? unitHeight(e.unit, e.family) : 1;
};
// A space shrinks by what goes into it, and goes when used up
function useSpace(show, space, h) {
  space.u -= h;
  if (space.u <= 0) show.rackItems = show.rackItems.filter((x) => x !== space);
}
// Taking a loose unit out of a preset rack leaves a space of its height behind
function vacate(show, unitId) {
  const rack = (show.racks || []).find((r) => r.units.includes(unitId));
  if (!rack) return;
  const e = entryOf(show, unitId);
  const i = rack.units.indexOf(unitId);
  if (rack.preset && e && !e.unit.fixed && !isSpace(e.unit)) {
    const space = makeSpace(unitHeight(e.unit, e.family));
    show.rackItems = [...(show.rackItems || []), space];
    rack.units.splice(i, 1, space.id);
  } else rack.units.splice(i, 1);
}
export function removeFromRack(show, unitId) {
  vacate(show, unitId);
}

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
  const byId = new Map(entries.map((e) => [e.unit.id, e]));
  // spaces next to each other become one
  for (const r of show.racks) {
    for (let i = r.units.length - 1; i > 0; i--) {
      const a = byId.get(r.units[i - 1])?.unit;
      const b = byId.get(r.units[i])?.unit;
      if (isSpace(a) && isSpace(b)) {
        a.u += b.u;
        show.rackItems = show.rackItems.filter((x) => x !== b);
        r.units.splice(i, 1);
      }
    }
  }
  for (const { unit, family } of entries) {
    if (seen.has(unit.id)) continue;
    // first space it fits, racks holding its own kind first; else the bottom of the last such rack
    const h = unitHeight(unit, family);
    const order = [...racksOf(show, family), ...show.racks.filter((r) => !racksOf(show, family).includes(r))];
    let placed = false;
    for (const r of order) {
      const space = r.units.map((id) => byId.get(id)?.unit).find((u) => isSpace(u) && u.u >= h);
      if (space && family !== 'item') {
        r.units.splice(r.units.indexOf(space.id), 0, unit.id);
        useSpace(show, space, h);
        placed = true;
        break;
      }
    }
    if (!placed) {
      const home =
        [...racksOf(show, family)].pop() ||
        show.racks.at(-1) ||
        (show.racks.push(makeRack(family, 1)), show.racks.at(-1));
      home.units.push(unit.id);
    }
    seen.add(unit.id);
  }
  const live = new Set(rackEntries(show).map((e) => e.unit.id));
  for (const r of show.racks) r.units = r.units.filter((id) => live.has(id));
  const pos = new Map(show.racks.flatMap((r) => r.units).map((id, i) => [id, i]));
  for (const family of FAMILIES)
    for (const list of familyLists(show, family)) list.sort((a, b) => pos.get(a.id) - pos.get(b.id));
  return show;
}
// Above `beforeId`, or at the bottom. Dropped on a space, it goes into the space.
export function moveUnit(show, unitId, rackId, beforeId = null) {
  if (beforeId === unitId) return show;
  const h = heightOf(show, unitId);
  vacate(show, unitId);
  const rack = show.racks.find((r) => r.id === rackId);
  const at = beforeId ? rack.units.indexOf(beforeId) : -1;
  rack.units.splice(at < 0 ? rack.units.length : at, 0, unitId);
  const before = beforeId && entryOf(show, beforeId);
  if (before && isSpace(before.unit) && !isSpace(entryOf(show, unitId)?.unit)) useSpace(show, before.unit, h);
  return normalizeRacks(show);
}

// ---- Rack presets: racks that stay built in the warehouse. Everything in one is fixed apart from its
// spaces, which take whatever amps and RF the show needs. ----
export function rackPresetFrom(show, rack) {
  const tx = new Set((show.rf?.transmitters || []).map((u) => u.id));
  const slots = rack.units
    .map((id) => entryOf(show, id))
    .filter(Boolean)
    .map(({ unit, family }) => {
      if (isSpace(unit)) return { kind: 'space', u: unit.u };
      // units loaded into the rack for this show (not built in) become spaces in the preset
      if (rack.preset && !unit.fixed) return { kind: 'space', u: unitHeight(unit, family) };
      if (family === 'item') return { kind: 'item', type: unit.type, name: unit.name, u: unit.u };
      if (unit.model === 'DS10') return { kind: 'ds10', name: unit.name, ip: unit.ip || '' };
      if (family === 'amp')
        return {
          kind: 'amp',
          model: unit.model,
          mode: unit.mode || 'dual',
          name: unit.name,
          ip: unit.ip || '',
        };
      return { kind: tx.has(unit.id) ? 'tx' : 'rx', model: unit.model, name: unit.name, ip: unit.ip || '' };
    });
  const used =
    slots.reduce(
      (n, x) =>
        n +
        (x.kind === 'space' || x.kind === 'item' ? x.u : x.kind === 'amp' ? AMP_MODELS[x.model]?.u || 2 : 1),
      0,
    ) + (rack.plate === 'none' ? 0 : PLATE_U);
  if (rack.size > used) slots.push({ kind: 'space', u: rack.size - used });
  return {
    id: `preset${Date.now().toString(36)}`,
    name: rack.name,
    size: rack.size,
    plate: rack.plate,
    slots,
  };
}
export function addRackPreset(show, preset) {
  show.rackItems ||= [];
  show.amps ||= [];
  show.ds10s ||= [];
  show.rf ||= defaultRf();
  show.racks ||= [];
  const taken = show.racks.filter(
    (r) => r.name === preset.name || r.name.startsWith(`${preset.name} `),
  ).length;
  const rack = {
    ...makeRack('', 1),
    name: taken ? `${preset.name} ${taken + 1}` : preset.name,
    size: preset.size || 0,
    plate: preset.plate || 'logo',
    preset: preset.id,
  };
  for (const slot of preset.slots) {
    let unit;
    if (slot.kind === 'space') {
      unit = makeSpace(slot.u);
      show.rackItems.push(unit);
    } else if (slot.kind === 'item') {
      unit = { ...makeRackItem(slot.type), name: slot.name, u: slot.u, fixed: true };
      show.rackItems.push(unit);
    } else if (slot.kind === 'amp') {
      unit = {
        ...makeAmp(slot.model, show.amps.length + 1),
        mode: slot.mode,
        name: slot.name,
        ip: slot.ip,
        fixed: true,
      };
      show.amps.push(unit);
    } else if (slot.kind === 'ds10') {
      unit = { ...makeDs10(show.ds10s.length + 1), name: slot.name, ip: slot.ip, fixed: true };
      show.ds10s.push(unit);
    } else {
      const list = slot.kind === 'tx' ? show.rf.transmitters : show.rf.receivers;
      unit = {
        ...makeRfDevice(slot.kind, slot.model, list.length + 1),
        name: slot.name,
        ip: slot.ip,
        fixed: true,
      };
      list.push(unit);
    }
    rack.units.push(unit.id);
  }
  show.racks.push(rack);
  normalizeRacks(show);
  return rack;
}
// Taking a preset rack out of the show: its built-in units go with it, anything loaded into it moves on
export function removeRack(show, rack) {
  const ids = new Set(rack.units);
  const drop = (list) => (list || []).filter((u) => !(ids.has(u.id) && (u.fixed || isSpace(u))));
  show.amps = drop(show.amps);
  show.ds10s = drop(show.ds10s);
  show.rackItems = drop(show.rackItems);
  if (show.rf) {
    show.rf.receivers = drop(show.rf.receivers);
    show.rf.transmitters = drop(show.rf.transmitters);
  }
  show.racks = show.racks.filter((r) => r !== rack);
  return normalizeRacks(show);
}

// Crosses into the next rack at the ends. `only`: skip units not in it (amps tab steps past the next amp).
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

// ---- Identity: a unit keeps who it was when racked (amp serial, Shure model + device ID);
// anything sent to that address checks who answers first. ----
export function identityOf(found) {
  return {
    model: String(found.model || '').trim(),
    serial: String(found.serial || '').trim(),
    name: String(found.name || '').trim(),
  };
}
export function sameDevice(expected, found) {
  if (!expected) return { ok: true, learn: true };
  const got = identityOf(found);
  const who =
    [got.model, got.name, got.serial && `serial ${got.serial}`].filter(Boolean).join(' · ') ||
    'something else';
  if (expected.serial && got.serial)
    return expected.serial === got.serial ? { ok: true } : { ok: false, who };
  if (expected.name && got.name && expected.name !== got.name) return { ok: false, who };
  if (expected.model && got.model && expected.model !== got.model) return { ok: false, who };
  return { ok: true };
}
// Find devices / identify result to a model choice
export function ampModelFrom(text) {
  const t = String(text || '')
    .toUpperCase()
    .replace(/\s+/g, '');
  return Object.keys(AMP_MODELS).find((k) => t.includes(k.toUpperCase())) || null;
}
export function shureModelFrom(text) {
  const t = String(text || '')
    .toUpperCase()
    .replace(/[\s-]+/g, '');
  const rx = Object.keys(RECEIVER_MODELS)
    .sort((a, b) => b.length - a.length)
    .find((k) => t.includes(k));
  if (rx) return { kind: 'rx', model: rx };
  const tx = Object.keys(IEM_MODELS).find((k) => t.includes(k));
  return tx ? { kind: 'tx', model: tx } : null;
}
