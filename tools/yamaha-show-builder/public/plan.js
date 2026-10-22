// Turns a show description into channel/mix allocations and Yamaha RCP commands.
// Shared by the browser UI and the Node tests, so keep it dependency free.

// Mono input channels and mix buses per model, from Yamaha's spec tables and reference manuals
// (checked October 2026). Stereo input channels and FX returns are not counted: stereo sources
// here use pairs of mono channels. stereoMixFrom: mixes from this number up are stereo pairs.
// RIVAGE capacity depends on the DSP engine, not the control surface, so it is listed by engine.
// io: the desk's own sockets (analogue in/out; Omni on CL/QL), expansion card slots and their channel
// count, and Dante channels, for the patch. RIVAGE has no local sockets: its I/O lives in racks on the network.
export const MODELS = {
  custom:  { label: 'Other / not sure', inputs: 0, mixes: 0, io: { analogIn: 32, analogOut: 16, cards: 2, cardCh: 16, dante: 64 } },
  TF1:     { label: 'TF1',            series: 'TF',     inputs: 32,  mixes: 20, stereoMixFrom: 9, io: { analogIn: 16, analogOut: 8, cards: 1, cardCh: 32, dante: 0 } }, // AUX 1-8 mono, 9/10-19/20 stereo
  TF3:     { label: 'TF3',            series: 'TF',     inputs: 40,  mixes: 20, stereoMixFrom: 9, io: { analogIn: 24, analogOut: 16, cards: 1, cardCh: 32, dante: 0 } },
  TF5:     { label: 'TF5',            series: 'TF',     inputs: 40,  mixes: 20, stereoMixFrom: 9, io: { analogIn: 32, analogOut: 16, cards: 1, cardCh: 32, dante: 0 } },
  DM3S:    { label: 'DM3',            series: 'DM3',    inputs: 16,  mixes: 6,  io: { analogIn: 16, analogOut: 8, cards: 0, cardCh: 0, dante: 0 } }, // analogue only (sold as DM3 Standard)
  DM3:     { label: 'DM3 Dante',      series: 'DM3',    inputs: 16,  mixes: 6,  io: { analogIn: 16, analogOut: 8, cards: 0, cardCh: 0, dante: 16 } },
  QL1:     { label: 'QL1',            series: 'QL',     inputs: 32,  mixes: 16, io: { analogIn: 16, analogOut: 8, cards: 2, cardCh: 16, dante: 64 } },
  QL5:     { label: 'QL5',            series: 'QL',     inputs: 64,  mixes: 16, io: { analogIn: 32, analogOut: 16, cards: 2, cardCh: 16, dante: 64 } },
  CL1:     { label: 'CL1',            series: 'CL',     inputs: 48,  mixes: 24, io: { analogIn: 8, analogOut: 8, cards: 3, cardCh: 16, dante: 64 } },
  CL3:     { label: 'CL3',            series: 'CL',     inputs: 64,  mixes: 24, io: { analogIn: 8, analogOut: 8, cards: 3, cardCh: 16, dante: 64 } },
  CL5:     { label: 'CL5',            series: 'CL',     inputs: 72,  mixes: 24, io: { analogIn: 8, analogOut: 8, cards: 3, cardCh: 16, dante: 64 } },
  DM7C:    { label: 'DM7 Compact',    series: 'DM7',    inputs: 72,  mixes: 48, io: { analogIn: 16, analogOut: 16, cards: 0, cardCh: 0, dante: 144 } },
  DM7:     { label: 'DM7',            series: 'DM7',    inputs: 120, mixes: 48, io: { analogIn: 32, analogOut: 16, cards: 0, cardCh: 0, dante: 144 } },
  RX:      { label: 'PM10 / PM5 / PM3 with DSP-RX',    series: 'RIVAGE', inputs: 120, mixes: 48, io: { analogIn: 0, analogOut: 0, cards: 0, cardCh: 0, dante: 144 } },
  RXEX:    { label: 'PM10 / PM5 / PM3 with DSP-RX-EX', series: 'RIVAGE', inputs: 288, mixes: 72, io: { analogIn: 0, analogOut: 0, cards: 0, cardCh: 0, dante: 144 } },
  R10:     { label: 'PM10 with DSP-R10',               series: 'RIVAGE', inputs: 144, mixes: 72, io: { analogIn: 0, analogOut: 0, cards: 0, cardCh: 0, dante: 144 } },
  PM7:     { label: 'PM7 (CSD-R7)',                    series: 'RIVAGE', inputs: 144, mixes: 60, io: { analogIn: 0, analogOut: 0, cards: 0, cardCh: 0, dante: 144 } }, // sources disagree on inputs; check yours
};

// What each desk family accepts over the network, from the desks' own parameter lists (Companion
// Yamaha RCP module schemas). scene: the store command and its target. gain: how head-amp gain is sent
// ('centi' = 1/100 dB on the channel's port, 'db' = whole dB, 'io' = the DM3's own head amps).
const CAPS = {
  CL:     { scene: ['ssupdate_ex', 'MIXER:Lib/Scene'], sceneMax: 300, dcas: 16, dcaAssign: true, muteGroups: 8, cue: true, gain: 'centi' },
  QL:     { scene: ['ssupdate_ex', 'MIXER:Lib/Scene'], sceneMax: 300, dcas: 16, dcaAssign: true, muteGroups: 8, cue: true, gain: 'centi' },
  TF:     { scene: ['ssupdate_ex', 'scene_a'], sceneMax: 100, dcas: 8, dcaAssign: false, muteGroups: 6, cue: false, gain: null },
  DM3:    { scene: ['ssupdate_ex', 'scene_a'], sceneMax: 100, dcas: 0, dcaAssign: false, muteGroups: 0, cue: true, gain: 'io', phantom: true },
  DM7:    { scene: ['ssupdatet_ex', 'scene_a'], sceneMax: 100, dcas: 24, dcaAssign: true, muteGroups: 0, cue: true, gain: 'db' },
  RIVAGE: { scene: ['ssupdatet_ex', 'MIXER:Lib/Scene'], sceneMax: 100, dcas: 24, dcaAssign: true, muteGroups: 0, cue: true, gain: 'centi' },
};
export function deskCaps(model) {
  return CAPS[model?.series] || null;
}

// The command that stores the desk's current state as scene n (for a backup before a push)
export function sceneStoreCommand(model, n) {
  const caps = deskCaps(model);
  if (!caps) return null;
  return `${caps.scene[0]} ${caps.scene[1]} ${Math.max(1, Math.round(Number(n) || 1))}`;
}

// Solo (cue) one input channel on or off, for the line check
export function cueCommand(model, ch, on) {
  return deskCaps(model)?.cue ? `set MIXER:Current/Cue/InCh/On ${ch - 1} 0 ${on ? 1 : 0}` : null;
}

// Matches the name a desk reports ("QL5", "DM7 Compact"…) to a model above. RIVAGE returns null:
// its size depends on the DSP engine, so the engineer picks that by hand.
export function modelFromProduct(name) {
  const n = String(name || '').toUpperCase().replace(/[\s-]+/g, '');
  if (/DM7C/.test(n)) return 'DM7C';
  if (/DM3STANDARD|DM3S\b/.test(n)) return 'DM3S';
  return ['TF1', 'TF3', 'TF5', 'QL1', 'QL5', 'CL1', 'CL3', 'CL5', 'DM3', 'DM7'].find((id) => n.includes(id)) || null;
}

// ---- Patch: which socket feeds each channel, and which socket each output comes out of ----

// The banks of ports on a desk, in the order the auto patch fills them
// Yamaha stage boxes. They join the desk over Dante, so each one takes the next block of the desk's
// Dante channels; head-amp gain and 48V on their sockets are then set from the desk.
export const RIO_MODELS = {
  'Rio3224-D2': { ins: 32, outs: 16 },
  'Rio1608-D2': { ins: 16, outs: 8 },
  'Rio3224-D3': { ins: 32, outs: 16 },
  'Rio1608-D3': { ins: 16, outs: 8 },
  'Tio1608-D2': { ins: 16, outs: 8 },
};

// The desk's sockets as banks. With stage boxes, each Rio is a bank of its own sockets, sitting on the
// first Dante channels in order; "Dante" is then whatever is left, numbered as the desk numbers it.
export function patchBanks(model, dir, rios = []) {
  const io = model.io || MODELS.custom.io;
  const banks = [{ key: 'analog', label: 'Analogue', size: dir === 'in' ? io.analogIn : io.analogOut }];
  for (let n = 1; n <= io.cards; n++) banks.push({ key: `card${n}`, label: `Card ${n}`, size: io.cardCh });
  let used = 0;
  (rios || []).forEach((rio, n) => {
    const sockets = RIO_MODELS[rio.model]?.[dir === 'in' ? 'ins' : 'outs'] || 0;
    const size = Math.min(sockets, io.dante - used);
    if (size > 0) banks.push({ key: `rio${n + 1}`, label: `Rio ${n + 1} (${rio.model})`, size, danteFrom: used + 1 });
    used += Math.max(0, size);
  });
  banks.push({ key: 'dante', label: 'Dante', size: io.dante - used, first: used + 1, danteFrom: used + 1 });
  return banks.filter((b) => b.size > 0);
}
export function portLabel(patch) {
  if (!patch) return 'unpatched';
  if (patch.bank.startsWith('rio')) return `Rio ${patch.bank.slice(3)} · ${patch.port}`;
  const name = patch.bank === 'analog' ? 'Analogue' : patch.bank === 'dante' ? 'Dante' : `Card ${patch.bank.slice(4)}`;
  return `${name} ${patch.port}`;
}
// The desk's Dante channel a patch lands on, for the Dante patch list (null when it isn't on Dante)
export function danteChannel(patch, banks) {
  const bank = patch && banks.find((b) => b.key === patch.bank);
  if (!bank || bank.danteFrom == null) return null;
  return bank.danteFrom + patch.port - (bank.first || 1);
}

// Gives each item (needing 1 or 2 consecutive ports) a port: fixed ones where the show says, the rest in order
// from `start`, moving to the next bank when one is full. Returns per-item patches and any warnings.
function allocatePorts(items, banks, start, what) {
  const warnings = [];
  const used = new Map();
  const first = (key) => banks.find((b) => b.key === key)?.first || 1;
  const last = (key) => first(key) + (banks.find((b) => b.key === key)?.size || 0) - 1;
  const take = (bank, port, item) => {
    for (let k = 0; k < item.ports; k++) {
      const id = `${bank}:${port + k}`;
      if (used.has(id)) warnings.push(`${item.name} and ${used.get(id)} are both on ${portLabel({ bank, port: port + k })}`);
      used.set(id, item.name);
    }
    return { bank, port };
  };
  const out = items.map((item) => {
    if (!item.fixed) return null;
    const { bank, port } = item.fixed;
    if (port < first(bank) || port + item.ports - 1 > last(bank)) warnings.push(`${item.name} is on ${portLabel(item.fixed)}, which this desk doesn't have`);
    return take(bank, port, item);
  });
  let b = Math.max(0, banks.findIndex((x) => x.key === start?.bank));
  let port = start?.bank && banks[b]?.key === start.bank ? Math.max(banks[b].first || 1, start.port || 1) : banks[b]?.first || 1;
  items.forEach((item, i) => {
    if (out[i]) return;
    for (;;) {
      const bank = banks[b];
      if (!bank) {
        warnings.push(`No ${what} sockets left for ${item.name}`);
        return;
      }
      const free = [...Array(item.ports).keys()].every((k) => !used.has(`${bank.key}:${port + k}`));
      if (port + item.ports - 1 <= last(bank.key) && free) {
        out[i] = take(bank.key, port, item);
        port += item.ports;
        return;
      }
      if (port + item.ports - 1 > last(bank.key)) { b++; port = banks[b]?.first || 1; } else port++;
    }
  });
  return { patches: out, warnings };
}

// Channel colours every desk has. CL/QL/DM/RIVAGE call two of them Cyan and Magenta; TF calls them
// SkyBlue and Pink (from the desks' own parameter lists). Shows store these names; deskColor() translates.
export const COLORS = ['Blue', 'Cyan', 'Green', 'Yellow', 'Orange', 'Red', 'Magenta', 'Purple'];
const TF_COLORS = { Cyan: 'SkyBlue', Magenta: 'Pink' };
const OLD_COLORS = { SkyBlue: 'Cyan', Pink: 'Magenta', White: 'Blue' }; // shows saved by earlier versions

export function normalizeColor(color) {
  return COLORS.includes(color) ? color : OLD_COLORS[color] || 'Blue';
}
function deskColor(model, color) {
  const c = normalizeColor(color);
  return model.series === 'TF' ? TF_COLORS[c] || c : c;
}

// category decides which zones a new source is routed to by default; hpf is the default
// high-pass filter in Hz (0 = off). The order here is the auto channel order: speech mics,
// then the band (drums, bass, guitars, keys, vocals), then program, BGM last.
export const SOURCE_TYPES = {
  lectern:  { label: 'Lectern mic',      short: 'Lect',  stereo: false, color: 'Blue',    category: 'speech',  hpf: 180, gain: 40, phantom: true },
  headset:  { label: 'Headset mic',      short: 'HS',    stereo: false, color: 'Cyan',    category: 'speech',  hpf: 180, gain: 10, phantom: false },
  handheld: { label: 'Handheld mic',     short: 'HH',    stereo: false, color: 'Cyan',    category: 'speech',  hpf: 180, gain: 10, phantom: false },
  kick:     { label: 'Kick drum',        short: 'Kick',  stereo: false, color: 'Red',     category: 'band',    hpf: 30, gain: 30, phantom: false },
  snare:    { label: 'Snare',            short: 'Snare', stereo: false, color: 'Red',     category: 'band',    hpf: 80, gain: 30, phantom: false },
  hihat:    { label: 'Hi-hat',           short: 'HiHat', stereo: false, color: 'Red',     category: 'band',    hpf: 200, gain: 30, phantom: true },
  tom:      { label: 'Tom',              short: 'Tom',   stereo: false, color: 'Red',     category: 'band',    hpf: 60, gain: 30, phantom: false },
  overhead: { label: 'Overheads',        short: 'OH',    stereo: true,  color: 'Red',     category: 'band',    hpf: 150, gain: 30, phantom: true },
  bass:     { label: 'Bass (DI or mic)', short: 'Bass',  stereo: false, color: 'Purple',  category: 'band',    hpf: 30, gain: 25, phantom: false },
  guitar:   { label: 'Electric guitar',  short: 'Gtr',   stereo: false, color: 'Orange',  category: 'band',    hpf: 100, gain: 35, phantom: false },
  acoustic: { label: 'Acoustic guitar',  short: 'AcGtr', stereo: false, color: 'Orange',  category: 'band',    hpf: 100, gain: 20, phantom: true },
  keys:     { label: 'Keys',             short: 'Keys',  stereo: true,  color: 'Yellow',  category: 'band',    hpf: 0, gain: 15, phantom: true },
  instrument: { label: 'Other instrument', short: 'Inst', stereo: false, color: 'Yellow', category: 'band',    hpf: 0, gain: 30, phantom: false },
  vocal:    { label: 'Vocal mic',        short: 'Vox',   stereo: false, color: 'Magenta', category: 'band',    hpf: 180, gain: 35, phantom: false },
  talkback: { label: 'Talkback mic',     short: 'TB',    stereo: false, color: 'Yellow',  category: 'talkback', hpf: 180, gain: 35, phantom: false },
  laptop:   { label: 'Laptop audio',     short: 'Lap',   stereo: true,  color: 'Green',   category: 'program', hpf: 0, gain: 0, phantom: false },
  playback: { label: 'Stereo playback',  short: 'PB',    stereo: true,  color: 'Green',   category: 'program', hpf: 0, gain: 0, phantom: false },
  bgm:      { label: 'Background music', short: 'BGM',   stereo: true,  color: 'Orange',  category: 'bgm',     hpf: 0, gain: 0, phantom: false },
};

// A source's HPF in Hz (0 = off), gain in dB and 48V. Shows saved before these existed take the type's default.
export function hpfOf(source) {
  return source.hpf ?? SOURCE_TYPES[source.type]?.hpf ?? 0;
}
export function gainOf(source) {
  return source.gain ?? SOURCE_TYPES[source.type]?.gain ?? 0;
}
export function phantomOf(source) {
  return source.phantom ?? SOURCE_TYPES[source.type]?.phantom ?? false;
}

// DCAs and mute groups, made automatically from the input types. Only groups with members are used.
export const GROUPS = [
  { key: 'speech', name: 'Speech', color: 'Blue', types: ['lectern', 'headset', 'handheld'] },
  { key: 'drums', name: 'Drums', color: 'Red', types: ['kick', 'snare', 'hihat', 'tom', 'overhead'] },
  { key: 'band', name: 'Band', color: 'Purple', types: ['bass', 'guitar', 'acoustic', 'keys', 'instrument'] },
  { key: 'vox', name: 'Vox', color: 'Magenta', types: ['vocal'] },
  { key: 'playback', name: 'Playback', color: 'Green', types: ['laptop', 'playback'] },
  { key: 'bgm', name: 'BGM', color: 'Orange', types: ['bgm'] },
];
const TYPE_RANK = Object.keys(SOURCE_TYPES);

// Groups sources by type in the order above, keeping their order within each type
export function orderSources(sources) {
  return [...sources].sort((a, b) => TYPE_RANK.indexOf(a.type) - TYPE_RANK.indexOf(b.type));
}

// monitor: a monitor output (pre-fade sends). numbered: always named "<short> 1", "<short> 2"…
// stereo: takes an odd/even pair of mixes (L, R).
export const ZONE_TYPES = {
  main:      { label: 'Main L/R',       short: 'Main LR', takes: ['speech', 'band', 'program'], color: 'Red' },
  frontfill: { label: 'Front fills',    short: 'FrntFil', takes: ['speech', 'band', 'program'], color: 'Magenta' },
  delay:     { label: 'Delay',          short: 'Delay',   takes: ['speech', 'band', 'program'], color: 'Purple', numbered: true },
  ceiling:   { label: 'Ceiling',        short: 'Ceiling', takes: ['bgm'],                       color: 'Orange' },
  sub:       { label: 'Subs',           short: 'Subs',    takes: ['band', 'program'],           color: 'Blue' },
  record:    { label: 'Record/stream',  short: 'Record',  takes: ['speech', 'band', 'program'], color: 'Green' },
  foldback:  { label: 'Foldback',       short: 'Wedge',   takes: ['program', 'talkback'],       color: 'Yellow', monitor: true, numbered: true },
  iemMono:   { label: 'Mono IEM',       short: 'IEM',     takes: ['program', 'talkback'],       color: 'Cyan',   monitor: true, numbered: true },
  iemStereo: { label: 'Stereo IEM',     short: 'IEM',     takes: ['program', 'talkback'],       color: 'Cyan',   monitor: true, numbered: true, stereo: true },
};

// Stereo zones (stereo IEMs) take an odd/even pair of mixes, one per side
export const zoneStereo = (zone) => Boolean(ZONE_TYPES[zone.type]?.stereo);

// Subs with the main PA: none, on an aux of their own (a Subs output), or fed from Main L and R alongside
// the tops (their own amp channels, or the sub half of a sub/top amp pair)
export const MAIN_SUBS = { none: 'No subs', aux: 'Subs on an aux', main: 'Subs from main' };
export function setMainSubs(show, mode) {
  const main = show.zones.find((z) => z.type === 'main');
  if (!main) return show;
  main.subs = mode;
  const auxSubs = show.zones.find((z) => z.type === 'sub' && z.forMain);
  if (mode === 'aux' && !show.zones.some((z) => z.type === 'sub')) {
    const zone = makeZone('sub', 'Subs');
    zone.forMain = true;
    show.zones.push(zone);
    // Subs take what the main takes, apart from speech
    for (const s of show.sources) if (s.zones.includes(main.id) && SOURCE_TYPES[s.type].category !== 'speech') s.zones.push(zone.id);
  }
  if (mode !== 'aux' && auxSubs) {
    show.zones = show.zones.filter((z) => z !== auxSubs);
    for (const s of show.sources) s.zones = s.zones.filter((id) => id !== auxSubs.id);
  }
  return show;
}

const NEG_INF = -32768; // RCP value for -inf; levels are in 1/100 dB

// Send point for InCh/ToMix/PrePost. The desks' parameter lists confirm the 0/1 switch on CL/QL, TF, DM3 and
// RIVAGE but not which value is which; this follows the parameter's name order (Pre, Post). Check one send
// on the desk after the first push, and swap these two if they come out reversed.
const SEND_POINT = { pre: 0, post: 1 };

// Default send level into monitor outputs, in 1/100 dB (-3 dB)
const MONITOR_SEND = -300;

// Monitor outputs (foldback, IEMs, or anything named "monitor") send pre-fade; every other output
// (Main L/R, fills, delays, ceiling…) post-fade. A zone's own `send` overrides this when set by hand.
export function isMonitor(zone) {
  return Boolean(ZONE_TYPES[zone.type]?.monitor) || /monitor/i.test(zone.name);
}
export function sendOf(zone) {
  if (zone.type === 'main') return 'post';
  return zone.send || (isMonitor(zone) ? 'pre' : 'post');
}

// Next free name for a new zone of this type: "Wedge 3", "IEM 2", or the plain name if it is the first
export function nextZoneName(show, type, taken = []) {
  const t = ZONE_TYPES[type];
  const names = [...show.zones.map((z) => z.name), ...taken];
  const n = names.filter((x) => x === t.short || x.startsWith(`${t.short} `)).length;
  return t.numbered || n ? `${t.short} ${n + 1}` : t.short;
}

let nextId = 1;
const uid = (p) => `${p}${Date.now().toString(36)}${(nextId++).toString(36)}`;

export function makeZone(type, name) {
  const t = ZONE_TYPES[type];
  return { id: type === 'main' ? 'main' : uid('z'), type, name: name || t.short, color: t.color };
}

export function makeSource(type, n, zones, name, stereo = SOURCE_TYPES[type].stereo) {
  const t = SOURCE_TYPES[type];
  return {
    id: uid('s'),
    type,
    name: name || `${t.short} ${n}`,
    stereo,
    color: t.color,
    hpf: t.hpf,
    gain: t.gain,
    phantom: t.phantom,
    zones: zones.filter((z) => ZONE_TYPES[z.type].takes.includes(t.category)).map((z) => z.id),
  };
}

// Appends `count` sources, numbering on from any of the same type already there
export function addSources(show, type, count) {
  const existing = show.sources.filter((s) => s.type === type).length;
  for (let i = 1; i <= count; i++) show.sources.push(makeSource(type, existing + i, show.zones));
  return show;
}

export const DEFAULT_OPTIONS = {
  model: 'custom', firstChannel: 1, firstMix: 1, maxNameLength: 8, setLevels: true, safeStart: true, autoOrder: true,
  inPatch: { bank: 'analog', port: 1 }, outPatch: { bank: 'analog', port: 1 }, sendPatch: true,
  groups: true, setGain: true,
};

// A blank show: no inputs, no outputs, default options. The desk model carries over, since it's the hardware.
export function emptyShow(model = 'custom') {
  return { name: 'New show', options: { ...DEFAULT_OPTIONS, model }, zones: [], sources: [] };
}

export function defaultShow() {
  const zones = [
    makeZone('main'),
    makeZone('frontfill', 'FrntFil'),
    makeZone('delay', 'Delay 1'),
    makeZone('delay', 'Delay 2'),
    makeZone('ceiling', 'Ceiling'),
  ];
  const show = {
    name: 'New show',
    options: { ...DEFAULT_OPTIONS },
    zones,
    sources: [],
  };
  addSources(show, 'lectern', 2);
  addSources(show, 'handheld', 4);
  addSources(show, 'playback', 4);
  // Playback 3 is the background music: ceiling only
  const pb3 = show.sources.find((s) => s.name === 'PB 3');
  const ceiling = zones.find((z) => z.type === 'ceiling');
  Object.assign(pb3, { name: 'BGM', type: 'bgm', color: 'Orange', zones: [ceiling.id] });
  return show;
}

const clean = (s, max) => String(s).replace(/["\r\n]/g, '').slice(0, max);

export function buildPlan(show) {
  const { firstChannel = 1, firstMix = 1, maxNameLength = 8, setLevels = true, autoOrder = true } = show.options || {};
  const spares = [];
  const warnings = [];
  const channels = [];
  const mixes = [];
  const commands = [];
  const set = (addr, x, y, v) => commands.push(`set MIXER:Current/${addr} ${x} ${y} ${v}`);
  const label = (name) => {
    const out = clean(name, maxNameLength);
    if (out !== String(name)) warnings.push(`"${name}" is too long for the desk. It'll show as "${out}".`);
    return out;
  };

  // Allocate zones: main is the stereo bus, every other zone gets a mix bus, stereo zones an odd/even pair.
  // On desks with fixed stereo mixes (TF: 9/10 up) stereo zones start there and mono zones fill the mono mixes.
  const model = MODELS[show.options?.model] || MODELS.custom;
  const used = new Set();
  const take = (start, stereo) => {
    let m = start;
    while ((stereo && m % 2 === 0) || used.has(m) || (stereo && used.has(m + 1))) m++;
    used.add(m);
    if (stereo) used.add(m + 1);
    return m;
  };
  // Outputs with a fixed mix (read off a desk) take theirs first; the rest fill in around them
  const fixedFirst = [...show.zones.filter((z) => z.mix > 0), ...show.zones.filter((z) => !(z.mix > 0))];
  for (const zone of fixedFirst) {
    if (zone.type === 'main') continue;
    const stereo = zoneStereo(zone);
    const start = zone.mix > 0 ? zone.mix : stereo && model.stereoMixFrom ? Math.max(firstMix, model.stereoMixFrom) : firstMix;
    mixes.push({ mix: take(start, stereo), zone, stereo });
  }
  mixes.sort((a, b) => a.mix - b.mix);

  // Allocate input channels: stereo sources take an L/R pair of mono channels.
  // With auto order on, pairs start on an odd channel so they line up with the desk's channel pairing.
  let ch = firstChannel;
  for (const source of autoOrder ? orderSources(show.sources) : show.sources) {
    if (autoOrder && source.stereo && ch % 2 === 0) spares.push(ch++);
    if (!autoOrder && source.deskCh > ch) ch = source.deskCh; // a show read from a desk keeps its channel numbers
    const sides = source.stereo ? ['L', 'R'] : [null];
    for (const side of sides) {
      const name = side ? `${clean(source.name, maxNameLength - 2)} ${side}` : source.name;
      channels.push({ ch: ch++, name, side, source });
    }
  }

  const lastCh = ch - 1;
  const lastMix = Math.max(0, ...used);
  if (model.inputs && lastCh > model.inputs) {
    warnings.push(`This show needs ${lastCh} channels. The ${model.label} has ${model.inputs}.`);
  }
  if (model.mixes && lastMix > model.mixes) {
    warnings.push(`This show needs ${lastMix} mixes. The ${model.label} has ${model.mixes}.`);
  }
  if (model.stereoMixFrom) {
    const stereo = mixes.filter((m) => !m.stereo && m.mix >= model.stereoMixFrom).map((m) => `${m.zone.name} (Mix ${m.mix})`);
    if (stereo.length) warnings.push(`On the ${model.label}, mixes ${model.stereoMixFrom} and up are stereo, so these mono outputs land on stereo mixes: ${stereo.join(', ')}`);
  } else {
    for (const m of mixes.filter((x) => x.stereo)) warnings.push(`For ${m.zone.name}, pair Mix ${m.mix}/${m.mix + 1} as stereo in the desk's Bus Setup`);
  }

  // Patch: inputs in channel order (a stereo source takes two ports), outputs Main L/R first then each mix
  const inBanks = patchBanks(model, 'in', show.rios);
  const outBanks = patchBanks(model, 'out', show.rios);
  const inItems = [];
  for (const c of channels) {
    if (c.side === 'R') continue;
    inItems.push({ name: c.side ? c.source.name : c.name, ports: c.side ? 2 : 1, fixed: c.source.patch, chans: channels.filter((x) => x.source === c.source) });
  }
  const inAlloc = allocatePorts(inItems, inBanks, show.options?.inPatch || DEFAULT_OPTIONS.inPatch, 'input');
  inItems.forEach((item, i) => item.chans.forEach((c, k) => { c.patch = inAlloc.patches[i] && { bank: inAlloc.patches[i].bank, port: inAlloc.patches[i].port + k }; }));

  const outputs = [];
  const mainZone = show.zones.find((z) => z.type === 'main');
  if (mainZone) outputs.push({ name: mainZone.name, zone: mainZone, ports: 2, buses: ['ST L', 'ST R'], fixed: mainZone.patch });
  for (const m of mixes) outputs.push({ name: m.zone.name, zone: m.zone, ports: m.stereo ? 2 : 1, buses: m.stereo ? [`MIX${m.mix}`, `MIX${m.mix + 1}`] : [`MIX${m.mix}`], fixed: m.zone.patch });
  const outAlloc = allocatePorts(outputs, outBanks, show.options?.outPatch || DEFAULT_OPTIONS.outPatch, 'output');
  outputs.forEach((o, i) => { o.patch = outAlloc.patches[i]; });
  warnings.push(...new Set([...inAlloc.warnings, ...outAlloc.warnings]));

  if (show.sources.some((s) => s.zones.length === 0)) {
    warnings.push(`These don't go anywhere yet: ${show.sources.filter((s) => !s.zones.length).map((s) => s.name).join(', ')}`);
  }

  // Outputs first so the buses are named before anything is sent to them
  const main = show.zones.find((z) => z.type === 'main');
  const safe = show.options?.safeStart !== false;
  if (main) {
    set('St/Label/Name', 0, 0, `"${label(main.name)}"`);
    if (setLevels && safe) {
      set('St/Fader/On', 0, 0, 1);
      set('St/Fader/Level', 0, 0, NEG_INF);
    }
  }
  const busIndexes = ({ mix, stereo }) => (stereo ? [mix - 1, mix] : [mix - 1]);
  for (const m of mixes) {
    for (const i of busIndexes(m)) {
      set('Mix/Label/Name', i, 0, `"${label(m.zone.name)}"`);
      set('Mix/Label/Color', i, 0, deskColor(model, m.zone.color));
      set('Mix/ToSt/On', i, 0, 0); // zones never feed back into the main bus
      if (setLevels) {
        set('Mix/Fader/On', i, 0, 1);
        set('Mix/Fader/Level', i, 0, safe ? NEG_INF : 0); // safe start: every output closed until you open it
      }
    }
  }

  for (const c of channels) {
    const i = c.ch - 1;
    const { source } = c;
    set('InCh/Label/Name', i, 0, `"${label(c.name)}"`);
    set('InCh/Label/Color', i, 0, deskColor(model, source.color));
    // HPF frequency is sent in tenths of a hertz (180 Hz = 1800)
    const hpf = hpfOf(source);
    set('InCh/HPF/On', i, 0, hpf ? 1 : 0);
    if (hpf) set('InCh/HPF/Freq', i, 0, Math.round(Math.min(2000, Math.max(20, hpf)) * 10));
    if (setLevels) {
      set('InCh/Fader/On', i, 0, 1);
      set('InCh/Fader/Level', i, 0, NEG_INF); // always start inputs closed
    }
    set('InCh/ToSt/On', i, 0, main && source.zones.includes(main.id) ? 1 : 0);
    set('InCh/ToSt/Pan', i, 0, c.side === 'L' ? -63 : c.side === 'R' ? 63 : 0);
    for (const m of mixes) {
      const on = source.zones.includes(m.zone.id);
      for (const bus of busIndexes(m)) {
        set('InCh/ToMix/On', i, bus, on ? 1 : 0);
        set('InCh/ToMix/PrePost', i, bus, SEND_POINT[sendOf(m.zone)]);
        // monitor sends start at -3 dB, speaker sends at 0 dB; a stereo pair summed into a mono zone
        // drops a further 3 dB per side, into a stereo zone it is panned instead
        const base = isMonitor(m.zone) ? MONITOR_SEND : 0;
        set('InCh/ToMix/Level', i, bus, on ? base + (c.side && !m.stereo ? -300 : 0) : NEG_INF);
        if (m.stereo) set('InCh/ToMix/Pan', i, bus, c.side === 'L' ? -63 : c.side === 'R' ? 63 : 0);
      }
    }
  }

  // Output patch: only CL/QL accept it over the network (Omni, Dante, slot 1-2 outputs). Input patch is
  // read-only there, and the other desks don't list patch parameters, so those go on the patch sheet.
  const canPatch = model.series === 'CL' || model.series === 'QL';
  const caps = deskCaps(model);

  // DCAs and mute groups: one per input group that has members
  const groups = show.options?.groups === false ? [] : GROUPS
    .map((g) => ({ ...g, channels: channels.filter((c) => g.types.includes(c.source.type)) }))
    .filter((g) => g.channels.length)
    .map((g, i) => ({ ...g, number: i + 1 }));
  if (caps && groups.length) {
    if (caps.dcas) {
      if (groups.length > caps.dcas) warnings.push(`The ${model.label} has ${caps.dcas} DCAs, so ${groups.slice(caps.dcas).map((g) => g.name).join(', ')} won't get one.`);
      for (const g of groups.slice(0, caps.dcas)) {
        set('DCA/Label/Name', g.number - 1, 0, `"${label(g.name)}"`);
        set('DCA/Label/Color', g.number - 1, 0, deskColor(model, g.color));
      }
      if (caps.dcaAssign) {
        for (const c of channels) {
          for (const g of groups.slice(0, caps.dcas)) set('InCh/DCA/Assign', c.ch - 1, g.number - 1, g.channels.includes(c) ? 1 : 0);
        }
      }
    }
    for (const g of groups.slice(0, caps.muteGroups)) set('MuteMaster/Label/Name', g.number - 1, 0, `"${label(g.name)}"`);
  }

  // Head-amp gain and 48V where the desk takes them. Safe start sends the lowest gain the desk has
  // (-6 dB); the gain on each row is then the target to bring it up to at line check.
  if (caps && show.options?.setGain !== false) {
    for (const c of channels) {
      const i = c.ch - 1;
      const gain = safe ? -6 : Math.round(gainOf(c.source));
      if (caps.gain === 'centi') set('InCh/Port/HA/Gain', i, 0, Math.min(66, Math.max(-6, gain)) * 100);
      else if (caps.gain === 'db') set('InCh/Port/HA/Gain', i, 0, Math.min(66, Math.max(-6, gain)));
      else if (caps.gain === 'io') commands.push(`set IO:Current/InCh/HAGain ${i} 0 ${safe ? 0 : Math.min(64, Math.max(0, gain))}`);
      if (caps.phantom) commands.push(`set IO:Current/InCh/48VOn ${i} 0 ${phantomOf(c.source) ? 1 : 0}`);
    }
  }
  if (canPatch && show.options?.sendPatch !== false) {
    for (const o of outputs) {
      if (!o.patch) continue;
      o.buses.forEach((bus, k) => {
        const port = o.patch.port + k - 1;
        const dante = danteChannel({ bank: o.patch.bank, port: o.patch.port + k }, outBanks);
        if (o.patch.bank === 'analog') set('OmniOutPort/Patch', port, 0, `"${bus}"`);
        else if (dante) set('DanteOutPort/Patch', dante - 1, 0, `"${bus}"`);
        else if (o.patch.bank === 'card1' || o.patch.bank === 'card2') set(`SlotOut${o.patch.bank.slice(4)}Port/Patch`, 0, port, `"${bus}"`);
      });
    }
  }
  const patchOnDesk = { outputs: canPatch, inputs: false };
  const onDesk = {
    dcas: Boolean(caps?.dcas), dcaAssign: Boolean(caps?.dcaAssign), muteGroups: Boolean(caps?.muteGroups),
    gain: Boolean(caps?.gain), phantom: Boolean(caps?.phantom), cue: Boolean(caps?.cue), scene: Boolean(caps),
  };

  return { channels, mixes, commands, warnings, spares, outputs, patchOnDesk, groups, onDesk, inBanks, outBanks };
}

// Patch sheet for the engineer: what plugs in where
export function patchSheetCsv(show, plan) {
  const zoneName = (id) => show.zones.find((z) => z.id === id)?.name ?? id;
  const rows = [['Kind', 'Number', 'Name', 'Patch', 'Type', 'HPF', 'Routed to', 'Gain', '48V', 'Group', 'Note']];
  const groupOf = (c) => plan.groups?.find((g) => g.channels.includes(c))?.name || '';
  for (const c of plan.channels) {
    const hpf = hpfOf(c.source);
    rows.push(['Input', `Ch ${c.ch}`, c.name, portLabel(c.patch), SOURCE_TYPES[c.source.type].label, hpf ? `${hpf} Hz` : 'off', c.source.zones.map(zoneName).join(' + '),
      `${gainOf(c.source)} dB`, phantomOf(c.source) ? 'On' : 'Off', groupOf(c), c.source.note || '']);
  }
  for (const o of plan.outputs) {
    const ports = o.patch ? o.buses.map((_, k) => portLabel({ bank: o.patch.bank, port: o.patch.port + k })).join(' + ') : 'unpatched';
    const bus = o.zone.type === 'main' ? 'Stereo L/R' : o.buses.map((b) => b.replace('MIX', 'Mix ')).join('/');
    const type = o.zone.type === 'main' ? 'Main PA' : ZONE_TYPES[o.zone.type].label;
    rows.push(['Output', bus, o.name, ports, type, '', sendOf(o.zone) === 'pre' ? 'Pre-fade sends' : 'Post-fade sends', '', '', '', '']);
  }
  return rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
}

// ---- Packages and trigger words: build inputs from plain text, entirely offline ----

// A stereo entry takes two channels named "<name> L" and "<name> R"
export const PACKAGES = {
  band: {
    label: 'Full band',
    sources: [
      { type: 'kick', name: 'Kick In' }, { type: 'kick', name: 'Kick Out' },
      { type: 'snare', name: 'Snare T' }, { type: 'snare', name: 'Snare B' },
      { type: 'hihat', name: 'Hi Hat' },
      { type: 'tom', name: 'R Tom 1' }, { type: 'tom', name: 'R Tom 2' }, { type: 'tom', name: 'F Tom' },
      { type: 'overhead', name: 'OH' },
      { type: 'bass', name: 'Bass DI', phantom: true, gain: 20 }, { type: 'bass', name: 'Bass Mic' },
      { type: 'guitar', name: 'Gtr 1', stereo: true }, { type: 'guitar', name: 'Gtr 2', stereo: true },
      { type: 'keys', name: 'Keys 1' }, { type: 'keys', name: 'Keys 2' },
      { type: 'vocal', name: 'Vox 1' }, { type: 'vocal', name: 'Vox 2' }, { type: 'vocal', name: 'Vox 3' },
      { type: 'talkback', name: 'MD TB' },
    ],
  },
  drums: {
    label: 'Drum kit',
    sources: [
      { type: 'kick', name: 'Kick In' }, { type: 'kick', name: 'Kick Out' },
      { type: 'snare', name: 'Snare T' }, { type: 'snare', name: 'Snare B' },
      { type: 'hihat', name: 'Hi Hat' },
      { type: 'tom', name: 'R Tom 1' }, { type: 'tom', name: 'R Tom 2' }, { type: 'tom', name: 'F Tom' },
      { type: 'overhead', name: 'OH' },
    ],
  },
};

export function packageSuggestion(key) {
  const pkg = PACKAGES[key];
  return { sources: pkg.sources.map((s) => ({ ...s, count: 1 })), zones: [], summary: `${pkg.label} package` };
}

// Words people type, mapped to packages, input types or zones. Longer phrases are matched first,
// so "acoustic guitar" wins over "guitar" and "full band" over "band".
export const TRIGGERS = [
  { words: ['full band', 'band package', 'band'], package: 'band' },
  { words: ['drum kit', 'drums'], package: 'drums' },
  { words: ['lectern', 'podium'], source: 'lectern' },
  { words: ['headset', 'lapel', 'lav', 'lavalier'], source: 'headset' },
  { words: ['handheld', 'radio mic', 'hh'], source: 'handheld' },
  { words: ['kick'], source: 'kick' },
  { words: ['snare'], source: 'snare' },
  { words: ['hi hat', 'hihat', 'hi-hat'], source: 'hihat' },
  { words: ['tom'], source: 'tom' },
  { words: ['overhead', 'oh'], source: 'overhead' },
  { words: ['bass'], source: 'bass' },
  { words: ['acoustic guitar', 'acoustic'], source: 'acoustic' },
  { words: ['electric guitar', 'guitar', 'gtr'], source: 'guitar' },
  { words: ['keys', 'keyboard', 'piano', 'synth'], source: 'keys' },
  { words: ['backing vocal', 'lead vocal', 'vocal', 'bvox', 'vox', 'bv', 'singer'], source: 'vocal' },
  { words: ['talkback', 'tb'], source: 'talkback' },
  { words: ['instrument'], source: 'instrument' },
  { words: ['laptop'], source: 'laptop' },
  { words: ['playback', 'pb'], source: 'playback' },
  { words: ['background music', 'bgm'], source: 'bgm' },
  { words: ['main l/r', 'main lr', 'main pa', 'mains', 'main', 'pa'], zone: 'main' },
  { words: ['front fill'], zone: 'frontfill' },
  { words: ['delay'], zone: 'delay' },
  { words: ['ceiling'], zone: 'ceiling' },
  { words: ['wedge', 'monitor', 'foldback'], zone: 'foldback' },
  { words: ['mono iem', 'mono in-ear', 'mono in ear'], zone: 'iemMono' },
  { words: ['stereo iem', 'stereo in-ear', 'stereo in ear', 'iem', 'in-ear', 'in ear'], zone: 'iemStereo' },
  { words: ['record', 'stream'], zone: 'record' },
  { words: ['subwoofer', 'subs', 'sub'], zone: 'sub' },
];

const NUMBER_WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const IGNORED = new Set(['and', 'with', 'plus', 'the', 'some', 'of', 'mic', 'mics', 'for', 'x', 'package', 'channel', 'channels', 'please', 'add', 'also', 'more', 'extra', 'pair', 'stereo', 'mono', 'set', 'up']);
const escape = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[ -]/g, '[ -]?');

// Reads text like "full band, 4 wedges and 2 handhelds" into a suggestion for applySuggestion
export function parseRequest(text, show) {
  let rest = ` ${String(text).toLowerCase()} `;
  const sources = [];
  const zones = [];
  const summary = [];

  const entries = TRIGGERS.flatMap((t) => t.words.map((w) => ({ ...t, word: w }))).sort((a, b) => b.word.length - a.word.length);
  for (const t of entries) {
    const re = new RegExp(`(?:\\b(\\d+|${Object.keys(NUMBER_WORDS).join('|')})\\s*(?:x\\s*)?)?\\b${escape(t.word)}(?:e?s)?\\b`, 'g');
    rest = rest.replace(re, (match, n, at) => {
      const pos = at;
      const count = Math.min(32, Math.max(1, n ? Number(n) || NUMBER_WORDS[n] : 1));
      if (t.package) {
        for (let i = 0; i < count; i++) sources.push(...packageSuggestion(t.package).sources.map((x) => ({ ...x, pos })));
        summary.push(PACKAGES[t.package].label + ' package');
      } else if (t.source) {
        sources.push({ type: t.source, name: SOURCE_TYPES[t.source].short, count, pos });
        summary.push(`${count} × ${SOURCE_TYPES[t.source].label}`);
      } else {
        if (t.zone === 'main') {
          if (!show.zones.some((z) => z.type === 'main') && !zones.some((z) => z.type === 'main')) zones.push({ type: 'main', name: ZONE_TYPES.main.short, pos });
          summary.push(ZONE_TYPES.main.label);
          return ' '.repeat(match.length);
        }
        for (let i = 1; i <= count; i++) {
          const taken = zones.map((z) => z.name);
          let name = nextZoneName(show, t.zone, taken);
          if (count > 1 && name === ZONE_TYPES[t.zone].short) name = `${name} 1`;
          zones.push({ type: t.zone, name, pos });
        }
        summary.push(`${count} × ${ZONE_TYPES[t.zone].label}`);
      }
      return ' '.repeat(match.length); // same length, so later matches keep their place in the text
    });
  }
  // Keep things in the order they were typed, and number repeated outputs in that order too
  const byPos = (a, b) => a.pos - b.pos;
  sources.sort(byPos).forEach((x) => delete x.pos);
  zones.sort(byPos);
  const counts = {};
  for (const z of zones) {
    const base = ZONE_TYPES[z.type].short;
    if (z.name.startsWith(`${base} `)) {
      const first = Number(nextZoneName(show, z.type).slice(base.length + 1)) || 1;
      counts[base] ??= first;
      z.name = `${base} ${counts[base]++}`;
    }
    delete z.pos;
  }
  const unknown = rest.split(/[^a-z0-9-]+/).filter((w) => w && !IGNORED.has(w) && !(w in NUMBER_WORDS) && !/^\d+$/.test(w));
  return { sources, zones, summary: summary.join(', '), unknown };
}

// Adds a suggestion to the show: zones first so the new inputs route to them.
// Sources with a count above 1 are numbered on from any of the same name already in the show.
export function applySuggestion(show, suggestion) {
  for (const z of suggestion.zones) {
    if (z.type === 'main' && show.zones.some((x) => x.type === 'main')) continue;
    const zone = makeZone(z.type, z.name);
    if (z.type === 'main') show.zones.unshift(zone); else show.zones.push(zone);
    for (const s of show.sources) {
      if (ZONE_TYPES[z.type].takes.includes(SOURCE_TYPES[s.type].category)) s.zones.push(zone.id);
    }
  }
  for (const s of suggestion.sources) {
    const stereo = s.stereo ?? SOURCE_TYPES[s.type].stereo;
    const numbered = s.count > 1 || show.sources.some((x) => x.name === s.name || x.name.startsWith(`${s.name} `));
    const already = show.sources.filter((x) => x.name.startsWith(`${s.name} `) || x.name === s.name).length;
    for (let i = 1; i <= s.count; i++) {
      const name = numbered && !PACKAGE_NAMES.has(s.name) ? `${s.name} ${already + i}` : s.name;
      const source = makeSource(s.type, i, show.zones, name, stereo);
      for (const k of ['phantom', 'gain', 'hpf', 'note', 'color']) if (s[k] !== undefined) source[k] = s[k];
      show.sources.push(source);
    }
  }
  return show;
}
const PACKAGE_NAMES = new Set(Object.values(PACKAGES).flatMap((p) => p.sources.map((s) => s.name)));

// ---- Pasted input lists: one line per channel, from a rider, spreadsheet or email ----
// Each line's name is kept as written; the type comes from the trigger words in it. "X L" and "X R" on
// neighbouring lines become one stereo input. Channel numbers, "48V" and mic models are recognised.
const SOURCE_WORDS = TRIGGERS.filter((t) => t.source).flatMap((t) => t.words.map((w) => ({ word: w, type: t.source })))
  .sort((a, b) => b.word.length - a.word.length);
export function parseInputList(text) {
  const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows = [];
  for (const line of lines) {
    let fields = line.split(/\t|\s*[,;|]\s*|\s{2,}/).map((f) => f.trim()).filter(Boolean);
    if (/^(ch|chan|channel|#|no\.?)$/i.test(fields[0]) && fields.length > 1 && /^(name|input|source|instrument)$/i.test(fields[1])) continue; // a header row
    const phantom = /\b(48\s?v|phantom)\b/i.test(line);
    fields = fields.filter((f) => !/^\d+[.)]?$/.test(f) && !/^(48\s?v|phantom)$/i.test(f));
    if (!fields.length) continue;
    const name = fields[0].replace(/^\d+[.)\s-]+/, '').replace(/["\r\n]/g, '').trim().slice(0, 32);
    if (!name) continue;
    const note = fields.slice(1).join(', ').slice(0, 60);
    const lower = ` ${name.toLowerCase()} `;
    const match = SOURCE_WORDS.find(({ word }) => new RegExp(`\\b${escape(word)}(?:e?s)?\\b`).test(lower));
    rows.push({ name, type: match?.type || 'instrument', note, phantom: phantom || undefined, stereoHint: /\b(st|stereo|l\/r)\b/i.test(line) });
  }
  // Pair "Keys 1 L" + "Keys 1 R" into one stereo input
  const sources = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const next = rows[i + 1];
    const base = r.name.replace(/\s+(L|Left)$/i, '');
    if (base !== r.name && next && next.name.replace(/\s+(R|Right)$/i, '') === base && next.name !== next.name.replace(/\s+(R|Right)$/i, '')) {
      sources.push({ type: r.type, name: base, count: 1, stereo: true, note: r.note || next.note || undefined, phantom: r.phantom || next.phantom });
      i++;
    } else {
      const stereo = r.stereoHint || SOURCE_TYPES[r.type].stereo;
      sources.push({ type: r.type, name: r.name.replace(/\s+\b(st|stereo|l\/r)\b/i, '').trim() || r.name, count: 1, stereo, note: r.note || undefined, phantom: r.phantom });
    }
  }
  for (const src of sources) for (const k of Object.keys(src)) if (src[k] === undefined) delete src[k];
  return { sources, zones: [], summary: `${sources.length} input${sources.length === 1 ? '' : 's'} from your list`, unknown: [] };
}

// ---- Your own templates: any show saved as a one-click package, routing kept ----
export function makeTemplate(show, name) {
  const zoneName = (id) => show.zones.find((z) => z.id === id)?.name;
  return {
    name: String(name).trim().slice(0, 40) || 'My template',
    autoOrder: show.options?.autoOrder !== false,
    zones: show.zones.map((z) => ({ type: z.type, name: z.name, color: z.color, send: z.send })),
    sources: show.sources.map((s) => ({
      type: s.type, name: s.name, stereo: s.stereo, color: s.color, hpf: s.hpf, gain: s.gain, phantom: s.phantom, note: s.note,
      zones: s.zones.map(zoneName).filter(Boolean),
    })),
  };
}
// Adds a template's outputs (unless the show already has one of that name) and inputs, with its routing
export function applyTemplate(show, tpl) {
  if (!show.sources.length && tpl.autoOrder === false) show.options.autoOrder = false; // keep a hand-made order
  for (const z of tpl.zones || []) {
    if (!ZONE_TYPES[z.type] || show.zones.some((x) => x.name === z.name || (z.type === 'main' && x.type === 'main'))) continue;
    const zone = makeZone(z.type, z.name);
    if (z.color) zone.color = z.color;
    if (z.send) zone.send = z.send;
    if (z.type === 'main') show.zones.unshift(zone); else show.zones.push(zone);
  }
  for (const t of tpl.sources || []) {
    if (!SOURCE_TYPES[t.type]) continue;
    const source = makeSource(t.type, 1, show.zones, t.name, Boolean(t.stereo));
    for (const k of ['color', 'hpf', 'gain', 'phantom', 'note']) if (t[k] !== undefined) source[k] = t[k];
    source.zones = show.zones.filter((z) => (t.zones || []).includes(z.name)).map((z) => z.id);
    show.sources.push(source);
  }
  return show;
}

// ---- Monitor mixes: each singer starts with themselves in their own wedge or IEM ----
// Pairs the n-th vocal mic (then speech mics) with the n-th monitor output, at the monitor default level.
export function pairMonitors(show) {
  const monitors = show.zones.filter(isMonitor);
  const singers = [...show.sources.filter((s) => s.type === 'vocal'), ...show.sources.filter((s) => ['headset', 'handheld', 'lectern'].includes(s.type))];
  const pairs = [];
  monitors.forEach((zone, i) => {
    const s = singers[i];
    if (!s) return;
    if (!s.zones.includes(zone.id)) s.zones.push(zone.id);
    pairs.push(`${s.name} → ${zone.name}`);
  });
  return pairs;
}

// A monitor-desk show from the same inputs: same channels and input patch, only the monitor outputs
export function monitorShow(show) {
  const copy = JSON.parse(JSON.stringify(show));
  copy.name = `${show.name} · Monitors`;
  copy.zones = copy.zones.filter(isMonitor);
  if (!copy.zones.length) for (let i = 1; i <= 4; i++) copy.zones.push(makeZone('foldback', `Wedge ${i}`));
  const keep = new Set(copy.zones.map((z) => z.id));
  for (const s of copy.sources) s.zones = s.zones.filter((id) => keep.has(id));
  copy.options = { ...copy.options, outPatch: { bank: 'analog', port: 1 } };
  for (const z of copy.zones) delete z.patch;
  pairMonitors(copy);
  return copy;
}

// ---- Pushing only what changed since the last push ----
// A command's key is everything before its value, so a new value for the same parameter replaces the old one
export function commandKey(cmd) {
  const m = /^(set \S+ \d+ \d+) /.exec(cmd);
  return m ? m[1] : cmd;
}
export function changedCommands(commands, last) {
  if (!last) return commands;
  return commands.filter((c) => last[commandKey(c)] !== c);
}
export function rememberPush(last, sent) {
  const next = { ...(last || {}) };
  for (const c of sent) if (/^set /.test(c)) next[commandKey(c)] = c;
  return next;
}

// ---- Checking the desk after a push ----
export function readbackCommand(cmd) {
  const m = /^set (\S+ \d+ \d+) /.exec(cmd);
  return m ? `get ${m[1]}` : null;
}
// True when the desk's reply to the read-back holds the value the push set
export function matchesReadback(cmd, reply) {
  const want = /^set \S+ \d+ \d+ (.*)$/.exec(cmd)?.[1];
  const m = /^OK get \S+ \d+ \d+ (.*)$/.exec(String(reply).trim());
  if (want === undefined || !m) return false;
  const norm = (v) => v.trim().replace(/^"(.*)"$/, '$1');
  return norm(m[1]) === norm(want);
}

// ---- Paperwork pack: input list, outputs, line check, stage-box and desk labels ----
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function paperwork(show, plan, { version = '', licence = '', company = '', preparedBy = '', extra = '' } = {}) {
  const model = MODELS[show.options?.model] || MODELS.custom;
  const zoneName = (id) => show.zones.find((z) => z.id === id)?.name ?? '';
  const groupOf = (c) => plan.groups?.find((g) => g.channels.includes(c))?.name || '';
  const inputs = plan.channels.map((c) => `<tr><td>${c.ch}</td><td><b>${esc(c.name)}</b></td><td>${esc(portLabel(c.patch))}</td><td>${esc(SOURCE_TYPES[c.source.type].label)}</td><td>${esc(c.source.note || '')}</td><td>${phantomOf(c.source) ? '48V' : ''}</td><td>${hpfOf(c.source) || ''}</td><td>${esc(groupOf(c))}</td><td>${esc(c.source.zones.map(zoneName).join(', '))}</td></tr>`).join('');
  const outputs = plan.outputs.map((o) => `<tr><td>${o.zone.type === 'main' ? 'ST L/R' : esc(o.buses.join('/').replace(/MIX/g, ''))}</td><td><b>${esc(o.name)}</b></td><td>${o.patch ? esc(o.buses.map((_, k) => portLabel({ bank: o.patch.bank, port: o.patch.port + k })).join(' + ')) : 'unpatched'}</td><td>${sendOf(o.zone) === 'pre' ? 'Pre' : 'Post'}</td></tr>`).join('');
  const check = plan.channels.map((c) => `<tr><td class="box"></td><td>${c.ch}</td><td><b>${esc(c.name)}</b></td><td>${esc(portLabel(c.patch))}</td><td>${esc(c.source.note || '')}</td><td></td></tr>`).join('');
  const strips = plan.channels.map((c) => `<span class="strip"><small>${c.ch}</small>${esc(c.name)}</span>`).join('');
  const boxes = plan.channels.filter((c) => c.patch).map((c) => `<span class="lbl"><small>${esc(portLabel(c.patch))}</small>${esc(c.name)}</span>`).join('');
  const css = `.kk-paper{font:12px/1.4 Inter,system-ui,sans-serif;color:#11151a;background:#fff}
.kk-paper h1{font-size:20px;margin:0 0 2px}.kk-paper h2{font-size:15px;margin:22px 0 6px;border-bottom:2px solid #11151a;padding-bottom:3px}
.kk-paper .meta{color:#5d6670;margin:0 0 8px}.kk-paper table{border-collapse:collapse;width:100%}
.kk-paper th,.kk-paper td{border:1px solid #c8cdd3;padding:4px 6px;text-align:left;vertical-align:top}.kk-paper th{background:#eef0f2}
.kk-paper td.box{width:18px}.kk-paper .row{display:flex;flex-wrap:wrap;gap:4px}
.kk-paper .strip{display:inline-flex;flex-direction:column;justify-content:center;width:62px;height:30px;border:1px solid #11151a;padding:2px 4px;font:700 11px/1.1 'Arial Narrow',sans-serif;overflow:hidden}
.kk-paper .lbl{display:inline-flex;flex-direction:column;width:110px;border:1px dashed #5d6670;padding:4px 6px;font-weight:700}
.kk-paper small{font-weight:400;color:#5d6670}.kk-paper .page{page-break-before:always}
.kk-paper footer{margin-top:24px;color:#5d6670;font-size:10px}`;
  const body = `<div class="kk-paper">
<h1>${esc(show.name)}</h1><p class="meta">${company ? `${esc(company)} · ` : ''}${esc(model.inputs ? model.label : 'Desk not set')} · ${plan.channels.length} channels · ${plan.outputs.length} outputs${preparedBy ? ` · prepared by ${esc(preparedBy)}` : ''}</p>
<h2>Input list</h2><table><thead><tr><th>Ch</th><th>Name</th><th>Plugs into</th><th>Type</th><th>Mic / note</th><th>48V</th><th>HPF</th><th>Group</th><th>Goes to</th></tr></thead><tbody>${inputs}</tbody></table>
<h2>Outputs</h2><table><thead><tr><th>Bus</th><th>Output</th><th>Comes out of</th><th>Sends</th></tr></thead><tbody>${outputs}</tbody></table>
<h2 class="page">Line check</h2><table><thead><tr><th>✓</th><th>Ch</th><th>Name</th><th>Plugs into</th><th>Mic / note</th><th>Notes</th></tr></thead><tbody>${check}</tbody></table>
<h2 class="page">Desk tape</h2><p class="meta">Cut along the lines and stick above the faders.</p><div class="row">${strips}</div>
<h2>Stage-box labels</h2><div class="row">${boxes}</div>
${extra}
<footer>KobiKraken · Show Builder ${esc(version ? 'v' + version : '')}${licence ? ' · Licence ' + esc(licence) : ''}</footer>
</div>`;
  return { title: `${show.name} paperwork`, css, body };
}

// ---- Read a desk into a show ----
// Two passes, so big desks stay quick: first every channel's and mix's name, colour and HPF, then the
// routing of only the channels and mixes that have been named.
const g = (addr, x, y = 0) => `get MIXER:Current/${addr} ${x} ${y}`;
const isDefaultChannel = (n) => !n || /^(ch|ch\.|channel)\s*\d+$/i.test(n.trim());
const isDefaultMix = (n) => !n || /^(mx|mix|aux|mtx)\s*\d+$/i.test(n.trim());
export function readDeskFirst(model) {
  const lines = [g('St/Label/Name', 0)];
  for (let i = 0; i < model.inputs; i++) lines.push(g('InCh/Label/Name', i), g('InCh/Label/Color', i), g('InCh/HPF/On', i), g('InCh/HPF/Freq', i), g('InCh/ToSt/On', i));
  for (let m = 0; m < model.mixes; m++) lines.push(g('Mix/Label/Name', m), g('Mix/Label/Color', m));
  return lines;
}
// The reply value for "addr x y" from the desk's "OK get addr x y value" lines
export function readReplies(replies) {
  const values = new Map();
  for (const line of replies) {
    // MIXER:Current/... keys go in without the prefix, MIXER:Setup/... ones as "Setup/..."
    const m = /^OK get MIXER:(Current\/|Setup\/)(\S+) (\d+) (\d+) (.*)$/.exec(String(line).trim());
    if (m) values.set(`${m[1] === 'Setup/' ? 'Setup/' : ''}${m[2]} ${m[3]} ${m[4]}`, m[5].startsWith('"') ? m[5].slice(1, -1) : Number.isNaN(Number(m[5])) ? m[5] : Number(m[5]));
  }
  return values;
}
const namedChannels = (model, v) => [...Array(model.inputs).keys()].filter((i) => !isDefaultChannel(String(v.get(`InCh/Label/Name ${i} 0`) ?? '')));
const namedMixes = (model, v) => [...Array(model.mixes).keys()].filter((m) => !isDefaultMix(String(v.get(`Mix/Label/Name ${m} 0`) ?? '')));
export function readDeskSecond(model, values) {
  const lines = [];
  const mixes = namedMixes(model, values);
  for (const m of mixes) lines.push(g('InCh/ToMix/PrePost', 0, m));
  for (const i of namedChannels(model, values)) for (const m of mixes) lines.push(g('InCh/ToMix/On', i, m));
  return lines;
}
export function typeFromName(name) {
  const lower = ` ${String(name).toLowerCase()} `;
  const byWord = SOURCE_WORDS.find(({ word }) => new RegExp(`\\b${escape(word)}(?:e?s)?\\b`).test(lower))?.type;
  // Desk names are short, so also know this app's own short names (Lect 1, AcGtr, Lap)
  const first = lower.trim().split(/[\s\d]+/)[0];
  return byWord || Object.keys(SOURCE_TYPES).find((t) => SOURCE_TYPES[t].short.toLowerCase() === first) || 'instrument';
}
function zoneTypeFromName(name, pre) {
  const n = String(name).toLowerCase();
  if (/\biem|\bear/.test(n)) return 'iemMono';
  if (/wedge|wdg|\bmon|foldback|\bfb\b|side ?fill|drum ?fill/.test(n)) return 'foldback';
  if (/\bsubs?\b|subwoofer|\bsw\b|\blfe\b/.test(n)) return 'sub';
  if (/front ?fill|\bff\b|lip|\bfill/.test(n)) return 'frontfill';
  if (/delay|\bdly/.test(n)) return 'delay';
  if (/ceil|bgm|foyer|lobby|zone|bar\b/.test(n)) return 'ceiling';
  if (/rec|stream|broadcast|\bbc\b|\bob\b|press|camera|video/.test(n)) return 'record';
  return pre ? 'foldback' : 'frontfill';
}
// Builds a show from everything read. Keeps the desk's channel order and mix numbers.
export function showFromDesk(modelId, values, name = 'Read from desk') {
  const model = MODELS[modelId] || MODELS.custom;
  const show = emptyShow(modelId);
  show.name = name;
  show.options.autoOrder = false;
  const v = (k) => values.get(k);
  const zones = [];
  const chs = namedChannels(model, values);
  const st = String(v('St/Label/Name 0 0') ?? '');
  if (chs.some((i) => v(`InCh/ToSt/On ${i} 0`) === 1) || (st && !/^st\s*[lr]?$/i.test(st))) {
    const main = makeZone('main', st && !/^st\s*[lr]?$/i.test(st) ? st : 'Main LR');
    zones.push({ zone: main, mix: null });
  }
  const mixList = namedMixes(model, values);
  const sideless = (n) => n.replace(/\s*(L|R|Left|Right)$/i, '').trim();
  for (let k = 0; k < mixList.length; k++) {
    const m = mixList[k];
    let mixName = String(v(`Mix/Label/Name ${m} 0`)).trim();
    let type = zoneTypeFromName(mixName, v(`InCh/ToMix/PrePost 0 ${m}`) === 0);
    // An IEM on an odd/even pair named "Gtr IEM L" / "Gtr IEM R" (or the same name twice) is one stereo IEM
    const pair = mixList[k + 1] === m + 1 && m % 2 === 0 ? String(v(`Mix/Label/Name ${m + 1} 0`)).trim() : null;
    if (type === 'iemMono' && pair && sideless(pair) === sideless(mixName) && (pair === mixName || pair !== sideless(pair))) {
      type = 'iemStereo';
      mixName = sideless(mixName);
      k++;
    }
    const zone = makeZone(type, mixName);
    zone.mix = m + 1;
    const color = v(`Mix/Label/Color ${m} 0`);
    if (color) zone.color = normalizeColor(String(color));
    zone.send = v(`InCh/ToMix/PrePost 0 ${m}`) === 0 ? 'pre' : 'post';
    zones.push({ zone, mix: m });
  }
  show.zones = zones.map((z) => z.zone);
  const routeOf = (i) => zones.filter(({ zone, mix }) => (zone.type === 'main' ? v(`InCh/ToSt/On ${i} 0`) === 1 : v(`InCh/ToMix/On ${i} ${mix}`) === 1)).map((z) => z.zone.id);
  for (let k = 0; k < chs.length; k++) {
    const i = chs[k];
    const nameL = String(v(`InCh/Label/Name ${i} 0`)).trim();
    const next = chs[k + 1] === i + 1 ? String(v(`InCh/Label/Name ${i + 1} 0`)).trim() : null;
    const base = nameL.replace(/\s*(L|Left)$/i, '');
    const stereo = base !== nameL && next && next.replace(/\s*(R|Right)$/i, '') === base && next !== next.replace(/\s*(R|Right)$/i, '');
    const type = typeFromName(stereo ? base : nameL);
    const src = makeSource(type, 1, [], stereo ? base.trim() : nameL, Boolean(stereo));
    const color = v(`InCh/Label/Color ${i} 0`);
    if (color) src.color = normalizeColor(String(color));
    src.hpf = v(`InCh/HPF/On ${i} 0`) === 1 ? Math.round(Number(v(`InCh/HPF/Freq ${i} 0`)) / 10) || SOURCE_TYPES[type].hpf : 0;
    src.zones = routeOf(i);
    src.patch = undefined;
    src.deskCh = i + 1;
    show.sources.push(src);
    if (stereo) k++;
  }
  const first = chs[0];
  if (first > 0) show.options.firstChannel = first + 1;
  return show;
}
