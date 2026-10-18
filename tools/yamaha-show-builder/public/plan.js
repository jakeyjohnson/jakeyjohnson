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
  DM3:     { label: 'DM3 / DM3 Standard', series: 'DM3', inputs: 16, mixes: 6, io: { analogIn: 16, analogOut: 8, cards: 0, cardCh: 0, dante: 16 } },
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

// ---- Patch: which socket feeds each channel, and which socket each output comes out of ----

// The banks of ports on a desk, in the order the auto patch fills them
export function patchBanks(model, dir) {
  const io = model.io || MODELS.custom.io;
  const banks = [{ key: 'analog', label: 'Analogue', size: dir === 'in' ? io.analogIn : io.analogOut }];
  for (let n = 1; n <= io.cards; n++) banks.push({ key: `card${n}`, label: `Card ${n}`, size: io.cardCh });
  banks.push({ key: 'dante', label: 'Dante', size: io.dante });
  return banks.filter((b) => b.size > 0);
}
export function portLabel(patch) {
  if (!patch) return 'unpatched';
  const name = patch.bank === 'analog' ? 'Analogue' : patch.bank === 'dante' ? 'Dante' : `Card ${patch.bank.slice(4)}`;
  return `${name} ${patch.port}`;
}

// Gives each item (needing 1 or 2 consecutive ports) a port: fixed ones where the show says, the rest in order
// from `start`, moving to the next bank when one is full. Returns per-item patches and any warnings.
function allocatePorts(items, banks, start, what) {
  const warnings = [];
  const used = new Map();
  const size = (key) => banks.find((b) => b.key === key)?.size || 0;
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
    if (port < 1 || port + item.ports - 1 > size(bank)) warnings.push(`${item.name} is on ${portLabel(item.fixed)}, which this desk doesn't have`);
    return take(bank, port, item);
  });
  let b = Math.max(0, banks.findIndex((x) => x.key === start?.bank));
  let port = start?.bank && banks[b]?.key === start.bank ? Math.max(1, start.port || 1) : 1;
  items.forEach((item, i) => {
    if (out[i]) return;
    for (;;) {
      const bank = banks[b];
      if (!bank) {
        warnings.push(`No ${what} sockets left for ${item.name}`);
        return;
      }
      const free = [...Array(item.ports).keys()].every((k) => !used.has(`${bank.key}:${port + k}`));
      if (port + item.ports - 1 <= bank.size && free) {
        out[i] = take(bank.key, port, item);
        port += item.ports;
        return;
      }
      if (port + item.ports - 1 > bank.size) { b++; port = 1; } else port++;
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
  lectern:  { label: 'Lectern mic',      short: 'Lect',  stereo: false, color: 'Blue',    category: 'speech',  hpf: 180 },
  headset:  { label: 'Headset mic',      short: 'HS',    stereo: false, color: 'Cyan',    category: 'speech',  hpf: 180 },
  handheld: { label: 'Handheld mic',     short: 'HH',    stereo: false, color: 'Cyan',    category: 'speech',  hpf: 180 },
  kick:     { label: 'Kick drum',        short: 'Kick',  stereo: false, color: 'Red',     category: 'band',    hpf: 30 },
  snare:    { label: 'Snare',            short: 'Snare', stereo: false, color: 'Red',     category: 'band',    hpf: 80 },
  hihat:    { label: 'Hi-hat',           short: 'HiHat', stereo: false, color: 'Red',     category: 'band',    hpf: 200 },
  tom:      { label: 'Tom',              short: 'Tom',   stereo: false, color: 'Red',     category: 'band',    hpf: 60 },
  overhead: { label: 'Overheads',        short: 'OH',    stereo: true,  color: 'Red',     category: 'band',    hpf: 150 },
  bass:     { label: 'Bass (DI or mic)', short: 'Bass',  stereo: false, color: 'Purple',  category: 'band',    hpf: 30 },
  guitar:   { label: 'Electric guitar',  short: 'Gtr',   stereo: false, color: 'Orange',  category: 'band',    hpf: 100 },
  acoustic: { label: 'Acoustic guitar',  short: 'AcGtr', stereo: false, color: 'Orange',  category: 'band',    hpf: 100 },
  keys:     { label: 'Keys',             short: 'Keys',  stereo: true,  color: 'Yellow',  category: 'band',    hpf: 0 },
  instrument: { label: 'Other instrument', short: 'Inst', stereo: false, color: 'Yellow', category: 'band',    hpf: 0 },
  vocal:    { label: 'Vocal mic',        short: 'Vox',   stereo: false, color: 'Magenta', category: 'band',    hpf: 180 },
  talkback: { label: 'Talkback mic',     short: 'TB',    stereo: false, color: 'Yellow',  category: 'talkback', hpf: 180 },
  laptop:   { label: 'Laptop audio',     short: 'Lap',   stereo: true,  color: 'Green',   category: 'program', hpf: 0 },
  playback: { label: 'Stereo playback',  short: 'PB',    stereo: true,  color: 'Green',   category: 'program', hpf: 0 },
  bgm:      { label: 'Background music', short: 'BGM',   stereo: true,  color: 'Orange',  category: 'bgm',     hpf: 0 },
};

// A source's HPF in Hz, 0 when off. Shows saved before HPF existed take the type's default.
export function hpfOf(source) {
  return source.hpf ?? SOURCE_TYPES[source.type]?.hpf ?? 0;
}
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
  record:    { label: 'Record/stream',  short: 'Record',  takes: ['speech', 'band', 'program'], color: 'Green' },
  foldback:  { label: 'Foldback',       short: 'Wedge',   takes: ['program', 'talkback'],       color: 'Yellow', monitor: true, numbered: true },
  iemMono:   { label: 'Mono IEM',       short: 'IEM',     takes: ['program', 'talkback'],       color: 'Cyan',   monitor: true, numbered: true },
  iemStereo: { label: 'Stereo IEM',     short: 'IEM',     takes: ['program', 'talkback'],       color: 'Cyan',   monitor: true, numbered: true, stereo: true },
};

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
  model: 'custom', firstChannel: 1, firstMix: 1, maxNameLength: 8, setLevels: true, autoOrder: true,
  inPatch: { bank: 'analog', port: 1 }, outPatch: { bank: 'analog', port: 1 }, sendPatch: true,
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
  for (const zone of show.zones) {
    if (zone.type === 'main') continue;
    const stereo = Boolean(ZONE_TYPES[zone.type].stereo);
    const start = stereo && model.stereoMixFrom ? Math.max(firstMix, model.stereoMixFrom) : firstMix;
    mixes.push({ mix: take(start, stereo), zone, stereo });
  }
  mixes.sort((a, b) => a.mix - b.mix);

  // Allocate input channels: stereo sources take an L/R pair of mono channels.
  // With auto order on, pairs start on an odd channel so they line up with the desk's channel pairing.
  let ch = firstChannel;
  for (const source of autoOrder ? orderSources(show.sources) : show.sources) {
    if (autoOrder && source.stereo && ch % 2 === 0) spares.push(ch++);
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
  const inBanks = patchBanks(model, 'in');
  const outBanks = patchBanks(model, 'out');
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
  if (main) {
    set('St/Label/Name', 0, 0, `"${label(main.name)}"`);
  }
  const busIndexes = ({ mix, stereo }) => (stereo ? [mix - 1, mix] : [mix - 1]);
  for (const m of mixes) {
    for (const i of busIndexes(m)) {
      set('Mix/Label/Name', i, 0, `"${label(m.zone.name)}"`);
      set('Mix/Label/Color', i, 0, deskColor(model, m.zone.color));
      set('Mix/ToSt/On', i, 0, 0); // zones never feed back into the main bus
      if (setLevels) {
        set('Mix/Fader/On', i, 0, 1);
        set('Mix/Fader/Level', i, 0, 0);
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
  if (canPatch && show.options?.sendPatch !== false) {
    for (const o of outputs) {
      if (!o.patch) continue;
      o.buses.forEach((bus, k) => {
        const port = o.patch.port + k - 1;
        if (o.patch.bank === 'analog') set('OmniOutPort/Patch', port, 0, `"${bus}"`);
        else if (o.patch.bank === 'dante') set('DanteOutPort/Patch', port, 0, `"${bus}"`);
        else if (o.patch.bank === 'card1' || o.patch.bank === 'card2') set(`SlotOut${o.patch.bank.slice(4)}Port/Patch`, 0, port, `"${bus}"`);
      });
    }
  }
  const patchOnDesk = { outputs: canPatch, inputs: false };

  return { channels, mixes, commands, warnings, spares, outputs, patchOnDesk };
}

// Patch sheet for the engineer: what plugs in where
export function patchSheetCsv(show, plan) {
  const zoneName = (id) => show.zones.find((z) => z.id === id)?.name ?? id;
  const rows = [['Kind', 'Number', 'Name', 'Patch', 'Type', 'HPF', 'Routed to']];
  for (const c of plan.channels) {
    const hpf = hpfOf(c.source);
    rows.push(['Input', `Ch ${c.ch}`, c.name, portLabel(c.patch), SOURCE_TYPES[c.source.type].label, hpf ? `${hpf} Hz` : 'off', c.source.zones.map(zoneName).join(' + ')]);
  }
  for (const o of plan.outputs) {
    const ports = o.patch ? o.buses.map((_, k) => portLabel({ bank: o.patch.bank, port: o.patch.port + k })).join(' + ') : 'unpatched';
    const bus = o.zone.type === 'main' ? 'Stereo L/R' : o.buses.map((b) => b.replace('MIX', 'Mix ')).join('/');
    const type = o.zone.type === 'main' ? 'Main PA' : ZONE_TYPES[o.zone.type].label;
    rows.push(['Output', bus, o.name, ports, type, '', sendOf(o.zone) === 'pre' ? 'Pre-fade sends' : 'Post-fade sends']);
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
      { type: 'bass', name: 'Bass DI' }, { type: 'bass', name: 'Bass Mic' },
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
  { words: ['vocal', 'vox', 'singer'], source: 'vocal' },
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
    rest = rest.replace(re, (match, n) => {
      const count = Math.min(32, Math.max(1, n ? Number(n) || NUMBER_WORDS[n] : 1));
      if (t.package) {
        for (let i = 0; i < count; i++) sources.push(...packageSuggestion(t.package).sources);
        summary.push(PACKAGES[t.package].label + ' package');
      } else if (t.source) {
        sources.push({ type: t.source, name: SOURCE_TYPES[t.source].short, count });
        summary.push(`${count} × ${SOURCE_TYPES[t.source].label}`);
      } else {
        if (t.zone === 'main') {
          if (!show.zones.some((z) => z.type === 'main') && !zones.some((z) => z.type === 'main')) zones.push({ type: 'main', name: ZONE_TYPES.main.short });
          summary.push(ZONE_TYPES.main.label);
          return ' ';
        }
        for (let i = 1; i <= count; i++) {
          const taken = zones.map((z) => z.name);
          let name = nextZoneName(show, t.zone, taken);
          if (count > 1 && name === ZONE_TYPES[t.zone].short) name = `${name} 1`;
          zones.push({ type: t.zone, name });
        }
        summary.push(`${count} × ${ZONE_TYPES[t.zone].label}`);
      }
      return ' ';
    });
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
      show.sources.push(makeSource(s.type, i, show.zones, name, stereo));
    }
  }
  return show;
}
const PACKAGE_NAMES = new Set(Object.values(PACKAGES).flatMap((p) => p.sources.map((s) => s.name)));
