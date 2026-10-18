// Turns a show description into channel/mix allocations and Yamaha RCP commands.
// Shared by the browser UI and the Node tests, so keep it dependency free.

// Mono input channels and mix buses per model, from Yamaha's spec tables and reference manuals
// (checked October 2026). Stereo input channels and FX returns are not counted: stereo sources
// here use pairs of mono channels. stereoMixFrom: mixes from this number up are stereo pairs.
// RIVAGE capacity depends on the DSP engine, not the control surface, so it is listed by engine.
export const MODELS = {
  custom:  { label: 'Other / not sure', inputs: 0, mixes: 0 },
  TF1:     { label: 'TF1',            series: 'TF',     inputs: 32,  mixes: 20, stereoMixFrom: 9 }, // AUX 1-8 mono, 9/10-19/20 stereo
  TF3:     { label: 'TF3',            series: 'TF',     inputs: 40,  mixes: 20, stereoMixFrom: 9 },
  TF5:     { label: 'TF5',            series: 'TF',     inputs: 40,  mixes: 20, stereoMixFrom: 9 },
  DM3:     { label: 'DM3 / DM3 Standard', series: 'DM3', inputs: 16, mixes: 6 },
  QL1:     { label: 'QL1',            series: 'QL',     inputs: 32,  mixes: 16 },
  QL5:     { label: 'QL5',            series: 'QL',     inputs: 64,  mixes: 16 },
  CL1:     { label: 'CL1',            series: 'CL',     inputs: 48,  mixes: 24 },
  CL3:     { label: 'CL3',            series: 'CL',     inputs: 64,  mixes: 24 },
  CL5:     { label: 'CL5',            series: 'CL',     inputs: 72,  mixes: 24 },
  DM7C:    { label: 'DM7 Compact',    series: 'DM7',    inputs: 72,  mixes: 48 },
  DM7:     { label: 'DM7',            series: 'DM7',    inputs: 120, mixes: 48 },
  RX:      { label: 'PM10 / PM5 / PM3 with DSP-RX',    series: 'RIVAGE', inputs: 120, mixes: 48 },
  RXEX:    { label: 'PM10 / PM5 / PM3 with DSP-RX-EX', series: 'RIVAGE', inputs: 288, mixes: 72 },
  R10:     { label: 'PM10 with DSP-R10',               series: 'RIVAGE', inputs: 144, mixes: 72 },
  PM7:     { label: 'PM7 (CSD-R7)',                    series: 'RIVAGE', inputs: 144, mixes: 60 }, // sources disagree on inputs; check yours
};

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

export const ZONE_TYPES = {
  main:      { label: 'Main L/R',       short: 'Main LR', takes: ['speech', 'band', 'program'], color: 'Red' },
  frontfill: { label: 'Front fills',    short: 'FrntFil', takes: ['speech', 'band', 'program'], color: 'Magenta' },
  delay:     { label: 'Delay',          short: 'Delay',   takes: ['speech', 'band', 'program'], color: 'Purple' },
  ceiling:   { label: 'Ceiling',        short: 'Ceiling', takes: ['bgm'],                       color: 'Orange' },
  foldback:  { label: 'Foldback',       short: 'Fldbk',   takes: ['program'],                   color: 'Yellow' },
  record:    { label: 'Record/stream',  short: 'Record',  takes: ['speech', 'band', 'program'], color: 'Green' },
};

const NEG_INF = -32768; // RCP value for -inf; levels are in 1/100 dB

let nextId = 1;
const uid = (p) => `${p}${Date.now().toString(36)}${(nextId++).toString(36)}`;

export function makeZone(type, name) {
  const t = ZONE_TYPES[type];
  return { id: type === 'main' ? 'main' : uid('z'), type, name: name || t.short, color: t.color };
}

export function makeSource(type, n, zones, name) {
  const t = SOURCE_TYPES[type];
  return {
    id: uid('s'),
    type,
    name: name || `${t.short} ${n}`,
    stereo: t.stereo,
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
    options: { model: 'custom', firstChannel: 1, firstMix: 1, maxNameLength: 8, setLevels: true, autoOrder: true },
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
    if (out !== String(name)) warnings.push(`"${name}" shortened to "${out}" (desk allows ${maxNameLength} characters)`);
    return out;
  };

  // Allocate zones: main is the stereo bus, every other zone gets a mix bus
  let mixNo = firstMix;
  for (const zone of show.zones) {
    if (zone.type === 'main') continue;
    mixes.push({ mix: mixNo++, zone });
  }

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

  const model = MODELS[show.options?.model] || MODELS.custom;
  const lastCh = ch - 1;
  const lastMix = mixNo - 1;
  if (model.inputs && lastCh > model.inputs) {
    warnings.push(`Needs channels up to ${lastCh} but the ${model.label} has ${model.inputs} mono inputs`);
  }
  if (model.mixes && lastMix > model.mixes) {
    warnings.push(`Needs mixes up to ${lastMix} but the ${model.label} has ${model.mixes}`);
  }
  if (model.stereoMixFrom) {
    const stereo = mixes.filter((m) => m.mix >= model.stereoMixFrom).map((m) => `${m.zone.name} (Mix ${m.mix})`);
    if (stereo.length) warnings.push(`On the ${model.label}, mixes ${model.stereoMixFrom} and up are stereo pairs: ${stereo.join(', ')}`);
  }

  if (show.sources.some((s) => s.zones.length === 0)) {
    warnings.push(`Not routed anywhere: ${show.sources.filter((s) => !s.zones.length).map((s) => s.name).join(', ')}`);
  }

  // Outputs first so the buses are named before anything is sent to them
  const main = show.zones.find((z) => z.type === 'main');
  if (main) {
    set('St/Label/Name', 0, 0, `"${label(main.name)}"`);
  }
  for (const { mix, zone } of mixes) {
    const i = mix - 1;
    set('Mix/Label/Name', i, 0, `"${label(zone.name)}"`);
    set('Mix/Label/Color', i, 0, deskColor(model, zone.color));
    set('Mix/ToSt/On', i, 0, 0); // zones never feed back into the main bus
    if (setLevels) {
      set('Mix/Fader/On', i, 0, 1);
      set('Mix/Fader/Level', i, 0, 0);
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
    for (const { mix, zone } of mixes) {
      const on = source.zones.includes(zone.id);
      set('InCh/ToMix/On', i, mix - 1, on ? 1 : 0);
      // a stereo pair summed into a mono zone is pulled down 3 dB per side
      set('InCh/ToMix/Level', i, mix - 1, on ? (c.side ? -300 : 0) : NEG_INF);
    }
  }

  return { channels, mixes, commands, warnings, spares };
}

// Patch sheet for the engineer: what plugs in where
export function patchSheetCsv(show, plan) {
  const zoneName = (id) => show.zones.find((z) => z.id === id)?.name ?? id;
  const rows = [['Kind', 'Number', 'Name', 'Type', 'HPF', 'Routed to']];
  for (const c of plan.channels) {
    const hpf = hpfOf(c.source);
    rows.push(['Input', `Ch ${c.ch}`, c.name, SOURCE_TYPES[c.source.type].label, hpf ? `${hpf} Hz` : 'off', c.source.zones.map(zoneName).join(' + ')]);
  }
  const main = show.zones.find((z) => z.type === 'main');
  if (main) rows.push(['Output', 'Stereo L/R', main.name, 'Main PA', '', '']);
  for (const m of plan.mixes) rows.push(['Output', `Mix ${m.mix}`, m.zone.name, ZONE_TYPES[m.zone.type].label, '', '']);
  return rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
}

// ---- AI builder: turns a plain-English request into inputs and zones to add ----
// The same prompt and validation serve the local app (Claude API) and the online demo.

export const AI_SCHEMA = {
  type: 'object',
  properties: {
    sources: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: Object.keys(SOURCE_TYPES) },
          name: { type: 'string' },
          count: { type: 'integer' },
        },
        required: ['type', 'name', 'count'],
        additionalProperties: false,
      },
    },
    zones: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: Object.keys(ZONE_TYPES).filter((t) => t !== 'main') },
          name: { type: 'string' },
        },
        required: ['type', 'name'],
        additionalProperties: false,
      },
    },
    summary: { type: 'string' },
  },
  required: ['sources', 'zones', 'summary'],
  additionalProperties: false,
};

export function aiPrompt(request, show) {
  const max = show.options?.maxNameLength || 8;
  const types = Object.entries(SOURCE_TYPES).map(([k, t]) => `- ${k}: ${t.label}${t.stereo ? ' (stereo, uses 2 channels)' : ''}`).join('\n');
  const zoneTypes = Object.entries(ZONE_TYPES).filter(([k]) => k !== 'main').map(([k, t]) => `- ${k}: ${t.label}`).join('\n');
  const current = show.sources.map((s) => s.name).join(', ') || 'nothing yet';
  return `You are helping a live sound engineer set up a Yamaha digital mixing desk for an event.
They describe extra inputs (microphones, instruments, playback) and speaker zones to add to their show.
Turn the request into the inputs and zones to ADD, using only these input types:
${types}

and these zone types (each becomes a mix bus; Main L/R already exists):
${zoneTypes}

Rules:
- One entry per kind of input. "count" is how many; with a count above 1 they are numbered automatically, so "name" is the base name ("Tom" with count 3 gives Tom 1, Tom 2, Tom 3).
- Names are what the desk shows: at most ${max} characters including the number, and ${Math.max(2, max - 2)} for stereo inputs.
- Expand packages into a sensible, standard mic list. A "full band" or "drum kit" means real channels: kick, snare, hi-hat, toms, overheads and so on.
- Use "instrument" for anything without its own type and name it clearly.
- Add zones only if the request asks for speakers or monitor mixes. Use "foldback" for wedges and in-ear mixes.
- Do not repeat inputs the show already has unless the request asks for more.
- "summary" is one short sentence describing what you added, for the engineer.

The show already has: ${current}.

Request: ${request}

Reply with only JSON in this shape:
{"sources":[{"type":"kick","name":"Kick","count":1}],"zones":[{"type":"foldback","name":"Wedge 1"}],"summary":"..."}`;
}

// Checks a reply against the types this app knows and clamps counts, so a bad reply can't break the show
export function normalizeSuggestion(raw) {
  const sources = (Array.isArray(raw?.sources) ? raw.sources : [])
    .filter((s) => SOURCE_TYPES[s?.type])
    .map((s) => ({ type: s.type, name: String(s.name || SOURCE_TYPES[s.type].short).replace(/["\r\n]/g, '').trim().slice(0, 32), count: Math.min(32, Math.max(1, Math.round(Number(s.count) || 1))) }));
  const zones = (Array.isArray(raw?.zones) ? raw.zones : [])
    .filter((z) => ZONE_TYPES[z?.type] && z.type !== 'main')
    .map((z) => ({ type: z.type, name: String(z.name || ZONE_TYPES[z.type].short).replace(/["\r\n]/g, '').trim().slice(0, 32) }));
  return { sources, zones, summary: String(raw?.summary || '').slice(0, 300) };
}

// Adds a normalized suggestion to the show: zones first so the new inputs route to them
export function applySuggestion(show, suggestion) {
  for (const z of suggestion.zones) {
    const zone = makeZone(z.type, z.name);
    show.zones.push(zone);
    for (const s of show.sources) {
      if (ZONE_TYPES[z.type].takes.includes(SOURCE_TYPES[s.type].category)) s.zones.push(zone.id);
    }
  }
  for (const s of suggestion.sources) {
    for (let i = 1; i <= s.count; i++) {
      show.sources.push(makeSource(s.type, i, show.zones, s.count > 1 ? `${s.name} ${i}` : s.name));
    }
  }
  return show;
}
