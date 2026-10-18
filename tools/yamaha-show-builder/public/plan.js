// Turns a show description into channel/mix allocations and Yamaha RCP commands.
// Shared by the browser UI and the Node tests, so keep it dependency free.

export const COLORS = ['Blue', 'SkyBlue', 'Cyan', 'Green', 'Yellow', 'Orange', 'Red', 'Magenta', 'Purple', 'White'];

// category decides which zones a new source is routed to by default
export const SOURCE_TYPES = {
  lectern:  { label: 'Lectern mic',      short: 'Lect',  stereo: false, color: 'Blue',    category: 'speech' },
  handheld: { label: 'Handheld mic',     short: 'HH',    stereo: false, color: 'SkyBlue', category: 'speech' },
  headset:  { label: 'Headset mic',      short: 'HS',    stereo: false, color: 'Cyan',    category: 'speech' },
  playback: { label: 'Stereo playback',  short: 'PB',    stereo: true,  color: 'Green',   category: 'program' },
  laptop:   { label: 'Laptop audio',     short: 'Lap',   stereo: true,  color: 'Yellow',  category: 'program' },
  bgm:      { label: 'Background music', short: 'BGM',   stereo: true,  color: 'Orange',  category: 'bgm' },
};

export const ZONE_TYPES = {
  main:      { label: 'Main L/R',       short: 'Main LR', takes: ['speech', 'program'], color: 'Red' },
  frontfill: { label: 'Front fills',    short: 'FrntFil', takes: ['speech', 'program'], color: 'Magenta' },
  delay:     { label: 'Delay',          short: 'Delay',   takes: ['speech', 'program'], color: 'Purple' },
  ceiling:   { label: 'Ceiling',        short: 'Ceiling', takes: ['bgm'],               color: 'Orange' },
  foldback:  { label: 'Foldback',       short: 'Fldbk',   takes: ['program'],           color: 'Yellow' },
  record:    { label: 'Record/stream',  short: 'Record',  takes: ['speech', 'program'], color: 'White' },
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
    options: { firstChannel: 1, firstMix: 1, maxNameLength: 8, setLevels: true },
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
  const { firstChannel = 1, firstMix = 1, maxNameLength = 8, setLevels = true } = show.options || {};
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

  // Allocate input channels: stereo sources take an L/R pair of mono channels
  let ch = firstChannel;
  for (const source of show.sources) {
    const sides = source.stereo ? ['L', 'R'] : [null];
    for (const side of sides) {
      const name = side ? `${clean(source.name, maxNameLength - 2)} ${side}` : source.name;
      channels.push({ ch: ch++, name, side, source });
    }
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
    set('Mix/Label/Color', i, 0, zone.color);
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
    set('InCh/Label/Color', i, 0, source.color);
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

  return { channels, mixes, commands, warnings };
}

// Patch sheet for the engineer: what plugs in where
export function patchSheetCsv(show, plan) {
  const zoneName = (id) => show.zones.find((z) => z.id === id)?.name ?? id;
  const rows = [['Kind', 'Number', 'Name', 'Type', 'Routed to']];
  for (const c of plan.channels) {
    rows.push(['Input', `Ch ${c.ch}`, c.name, SOURCE_TYPES[c.source.type].label, c.source.zones.map(zoneName).join(' + ')]);
  }
  const main = show.zones.find((z) => z.type === 'main');
  if (main) rows.push(['Output', 'Stereo L/R', main.name, 'Main PA', '']);
  for (const m of plan.mixes) rows.push(['Output', `Mix ${m.mix}`, m.zone.name, ZONE_TYPES[m.zone.type].label, '']);
  return rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
}
