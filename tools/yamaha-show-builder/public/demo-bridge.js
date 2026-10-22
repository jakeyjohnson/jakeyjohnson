// Demo mode: fake /api server (desk, Shure receivers, Spectera base) so the app runs with nothing
// installed. Draws the fake desk, then loads the real app.
import { el, panel, tag } from './ui.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const fast = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SWATCH = {
  Blue: '#4d7cff',
  Cyan: '#2fd6d6',
  SkyBlue: '#2fd6d6',
  Green: '#3fcf6e',
  Yellow: '#ffd23f',
  Orange: '#ff9234',
  Red: '#ff4d4d',
  Magenta: '#ff4fd8',
  Pink: '#ff4fd8',
  Purple: '#9b6bff',
};
const PRODUCT = {
  QL5: 'QL5',
  QL1: 'QL1',
  CL5: 'CL5',
  CL3: 'CL3',
  CL1: 'CL1',
  TF5: 'TF5',
  TF3: 'TF3',
  TF1: 'TF1',
  DM7: 'DM7',
  DM7C: 'DM7 Compact',
  DM3: 'DM3',
};

// ---- Pretend desk state (same lines a real desk gets) ----
let link = { state: 'idle' };
const listeners = new Set();
const setLink = (s) => {
  link = s;
  for (const l of listeners) l({ data: JSON.stringify(s) });
};
const held = new Map(); // "set X a b" -> full line, what the desk holds now
let desk;
function wipeDesk() {
  desk = { inCh: {}, mix: {}, st: { name: '', level: null }, sendPoint: {}, outPatch: {}, solo: null };
  held.clear();
}
wipeDesk();
function apply(line) {
  const key = line.split(' ').slice(0, 4).join(' ');
  if (line.startsWith('set ')) held.set(key, line);
  const m = /^set (?:MIXER|IO):Current\/(\w+)\/(.+?) (\d+) (\d+) (.+)$/.exec(line);
  if (!m) return null;
  const [, kind, param, xs, ys, raw] = m;
  const x = Number(xs),
    y = Number(ys);
  const v = raw.startsWith('"') ? raw.slice(1, -1) : isNaN(raw) ? raw : Number(raw);
  if (param === 'Patch') {
    const port =
      kind === 'OmniOutPort'
        ? `Omni ${x + 1}`
        : kind === 'DanteOutPort'
          ? `Dante ${x + 1}`
          : `Card ${kind.replace(/\D/g, '')}.${y + 1}`;
    (desk.outPatch[v] ||= []).push(port);
    return null;
  }
  if (kind === 'St') {
    if (param === 'Label/Name') desk.st.name = v;
    if (param === 'Fader/Level') desk.st.level = v;
    return null;
  }
  if (kind === 'Cue') {
    desk.solo = v ? x : desk.solo === x ? null : desk.solo;
    return x;
  }
  if (kind !== 'InCh' && kind !== 'Mix') return null;
  const bank = kind === 'InCh' ? desk.inCh : desk.mix;
  const c = (bank[x] ||= {
    name: '',
    color: null,
    level: null,
    toSt: 0,
    toMix: {},
    hpfOn: 0,
    hpf: 0,
    gain: null,
  });
  if (param === 'Label/Name') c.name = v;
  else if (param === 'Label/Color') c.color = v;
  else if (param === 'Fader/Level') c.level = v;
  else if (param === 'ToSt/On') c.toSt = v;
  else if (param === 'HPF/On') c.hpfOn = v;
  else if (param === 'HPF/Freq') c.hpf = v / 10;
  else if (param === 'Port/HA/Gain') c.gain = Math.abs(v) >= 100 ? v / 100 : v;
  else if (param === 'ToMix/On') c.toMix[y] = v;
  else if (param === 'ToMix/PrePost') desk.sendPoint[y] = v;
  return kind === 'InCh' ? x : null;
}

// ---- Pretend RF kit ----
const shure = {};
const packs = [
  { mtUid: 1, type: 'SKM', name: 'SKM 1', serial: '1500321' },
  { mtUid: 2, type: 'SKM', name: 'SKM 2', serial: '1500322' },
  { mtUid: 3, type: 'SKM', name: 'SKM 3', serial: '1500323' },
  { mtUid: 4, type: 'SKM', name: 'SKM 4', serial: '1500324' },
  { mtUid: 5, type: 'SEK', name: 'SEK 1', serial: '1600411', headphoneVolumeMin: -100 },
  { mtUid: 6, type: 'SEK', name: 'SEK 2', serial: '1600412', headphoneVolumeMin: -100 },
];
const network = () => [
  {
    kind: 'desk',
    make: 'Yamaha',
    model: PRODUCT[currentModel()] || 'QL5',
    name: '',
    ip: '192.168.0.128',
    port: 49280,
    via: ['port 49280'],
  },
  {
    kind: 'stagebox',
    make: 'Yamaha',
    model: 'Rio3224-D2',
    name: '',
    ip: '192.168.0.130',
    via: ['port 49280'],
  },
  { kind: 'radio', make: 'Shure', model: 'ULXD4Q', name: 'RF SL 1', ip: '192.168.0.50', via: ['port 2202'] },
  { kind: 'radio', make: 'Shure', model: 'ULXD4Q', name: 'RF SL 2', ip: '192.168.0.51', via: ['port 2202'] },
  { kind: 'radio', make: 'Shure', model: 'P10T', name: 'IEM 1', ip: '192.168.0.52', via: ['port 2202'] },
  {
    kind: 'radio',
    make: 'Sennheiser',
    model: 'Spectera',
    name: 'Base station',
    ip: '192.168.0.55',
    via: ['announces _ssc._udp'],
  },
  {
    kind: 'amp',
    make: 'd&b',
    model: 'D80',
    name: 'Mains',
    ip: '192.168.0.60',
    serial: '10236',
    via: ['port 30013'],
  },
  {
    kind: 'amp',
    make: 'd&b',
    model: 'D80',
    name: 'Fills',
    ip: '192.168.0.61',
    serial: '10511',
    via: ['port 30013'],
  },
  {
    kind: 'amp',
    make: 'd&b',
    model: 'D40',
    name: 'Delays',
    ip: '192.168.0.62',
    serial: '20877',
    via: ['port 30013'],
  },
  {
    kind: 'playback',
    make: 'Figure 53',
    model: 'QLab',
    name: 'Show Mac',
    ip: '192.168.0.70',
    via: ['announces _qlab._tcp'],
  },
];
const STORE = 'kk-demo';
function currentModel() {
  try {
    return JSON.parse(localStorage.getItem(STORE))?.options?.model || 'QL5';
  } catch {
    return 'QL5';
  }
}

// ---- The fake server ----
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
function stream(run) {
  const enc = new TextEncoder();
  return new Response(
    new ReadableStream({
      async start(ctrl) {
        await run((obj) => ctrl.enqueue(enc.encode(JSON.stringify(obj) + '\n')));
        ctrl.close();
      },
    }),
    { headers: { 'content-type': 'application/x-ndjson' } },
  );
}
const routes = {
  async '/api/connect'({ host }) {
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host || ''))
      return json({ error: "That isn't an IP address. Try 192.168.0.128." });
    setLink({ state: 'connecting', host });
    await wait(600);
    const s = { state: 'connected', host, product: PRODUCT[currentModel()] || 'QL5' };
    setLink(s);
    return json(s);
  },
  async '/api/disconnect'() {
    setLink({ state: 'idle' });
    return json(link);
  },
  async '/api/push'({ commands = [] }) {
    if (link.state !== 'connected') return json({ error: 'Connect the desk first' }, 400);
    return stream(async (send) => {
      for (const [i, cmd] of commands.entries()) {
        const strip = apply(cmd);
        send({ i, total: commands.length, cmd, reply: `OK ${cmd.replace(/^set /, 'set ')}`, ok: true });
        if (i % 6 === 0 || i === commands.length - 1) {
          drawDesk(strip);
          if (!fast) await wait(14);
        }
      }
      drawDesk();
      send({ done: true, total: commands.length, errors: 0 });
    });
  },
  async '/api/verify'({ commands = [] }) {
    return stream(async (send) => {
      for (const [i, cmd] of commands.entries()) {
        const key = cmd.split(' ').slice(0, 4).join(' ');
        const has = held.get(key);
        const ok = has === cmd;
        send({
          i,
          total: commands.length,
          cmd,
          reply: has ? `OK get ${has.slice(4)}` : 'OK get (default)',
          ok,
        });
      }
      send({
        done: true,
        total: commands.length,
        wrong: commands.filter((c) => held.get(c.split(' ').slice(0, 4).join(' ')) !== c).length,
      });
    });
  },
  async '/api/read'({ commands = [] }) {
    if (link.state !== 'connected') return json({ error: 'Connect the desk first' }, 400);
    // sent value, else fresh-desk default (default names, 0 otherwise)
    const fallback = (addr, x) =>
      addr.endsWith('InCh/Label/Name')
        ? `"ch ${+x + 1}"`
        : addr.endsWith('Mix/Label/Name')
          ? `"MX ${+x + 1}"`
          : addr.endsWith('St/Label/Name')
            ? '"ST L"'
            : '0';
    return stream(async (send) => {
      for (const [i, cmd] of commands.entries()) {
        const [, addr, x, y] = cmd.split(' ');
        const has = held.get(`set ${addr} ${x} ${y}`);
        // only RIVAGE exposes the oscillator over the network
        const reply =
          addr.startsWith('MIXER:Setup/') && !has && !/RIVAGE|PM/.test(link.product || '')
            ? `ERROR ${cmd} UnknownAddress`
            : `OK ${cmd} ${has ? has.split(' ').slice(4).join(' ') : fallback(addr, x)}`;
        send({ i, total: commands.length, reply });
        if (!fast && i % 200 === 0) await wait(10);
      }
      send({ done: true, total: commands.length });
    });
  },
  async '/api/cue'({ commands = [] }) {
    for (const c of commands) apply(c);
    drawDesk();
    return json({ replies: commands.map((c) => `OK ${c}`) });
  },
  async '/api/discover'() {
    await wait(fast ? 0 : 1100);
    return json({ subnets: ['192.168.0.0/24 (pretend)'], scanned: 254, devices: network() });
  },
  async '/api/shure'({ host, lines = [], check }) {
    return stream(async (send) => {
      const rx = (shure[host] ||= {});
      for (const [i, line] of lines.entries()) {
        await wait(fast ? 0 : 40);
        const [, verb, ch, param, value] = /^(SET|GET) (\d) (\w+) ?(.*)$/.exec(line) || [];
        if (verb === 'SET' && !check) rx[`${ch} ${param}`] = value;
        // unset receiver keeps its defaults
        const now =
          rx[`${ch} ${param}`] ??
          { CHAN_NAME: `{CH ${ch}}`, FREQUENCY: String(606600 + ch * 1150), AUDIO_GAIN: '018' }[param];
        send({
          i,
          total: lines.length,
          line: check ? `GET ${ch} ${param}` : line,
          reply: now == null ? 'TIMEOUT' : `< REP ${ch} ${param} ${now} >`,
          ok: check ? now === value : true,
        });
      }
      send({ done: true, total: lines.length });
    });
  },
  async '/api/identify'({ host, kind }) {
    await wait(fast ? 0 : 250);
    const d = network().find(
      (x) => x.ip === host && (kind === 'amp' ? x.kind === 'amp' : x.make === 'Shure'),
    );
    if (!d)
      return json({ error: `No answer from ${host}. Check its IP and that it's on this network.` }, 400);
    return json(
      kind === 'amp'
        ? { host, manufacturer: 'd&b audiotechnik', model: d.model, serial: d.serial, name: d.name }
        : { host, model: d.model, name: d.name },
    );
  },
  async '/api/flash'({ host }) {
    const d = network().find((x) => x.ip === host && x.make === 'Shure');
    if (!d) return json({ error: `No answer from ${host}.` }, 400);
    return json({ host, model: d.model, name: d.name, flashed: true });
  },
  async '/api/amp/read'({ host }) {
    await wait(fast ? 0 : 900);
    const objects = [];
    'ABCD'.split('').forEach((ch, c) => {
      const base = 1000 + c * 100;
      objects.push(
        {
          ono: base + 1,
          classId: '1.1.1.1.12',
          className: 'OcaStringActuator',
          container: base,
          role: 'Name',
          path: `Channel ${ch}/Name`,
          value: `Ch ${ch}`,
        },
        {
          ono: base + 2,
          classId: '1.1.1.2',
          className: 'OcaMute',
          container: base,
          role: 'Mute',
          path: `Channel ${ch}/Mute`,
          value: 'unmuted',
        },
        {
          ono: base + 3,
          classId: '1.1.1.5',
          className: 'OcaGain',
          container: base,
          role: 'Gain',
          path: `Channel ${ch}/Gain`,
          value: { value: 0, min: -57.5, max: 6 },
        },
        {
          ono: base + 4,
          classId: '1.1.1.4',
          className: 'OcaSwitch',
          container: base,
          role: 'Input',
          path: `Channel ${ch}/Input`,
          value: { position: c, min: 0, max: 7 },
          positionNames: ['A1', 'A2', 'A3', 'A4', 'D1', 'D2', 'D3', 'D4'],
        },
      );
    });
    const d = network().find((x) => x.ip === host && x.kind === 'amp');
    return json({
      readAt: new Date().toISOString(),
      pretend: true,
      device: {
        host,
        manufacturer: 'd&b audiotechnik',
        model: d?.model || 'D80',
        name: d?.name || 'Demo amp',
        serial: d?.serial || 'PRETEND',
      },
      objects,
    });
  },
  async '/api/spectera/devices'({ host }) {
    await wait(fast ? 0 : 400);
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host || ''))
      return json({ error: "Type the base station's IP first" });
    return json({ devices: packs.map((p) => ({ ...p })) });
  },
  async '/api/spectera/push'({ writes = [] }) {
    await wait(fast ? 0 : 400);
    for (const w of writes)
      Object.assign(packs.find((p) => `/mts/paired/all/${p.mtUid}` === w.path) || {}, w.body);
    return json({ results: writes.map((w) => ({ path: w.path, ok: true })) });
  },
};
const realFetch = window.fetch.bind(window);
window.fetch = async (url, opts = {}) => {
  const path = typeof url === 'string' ? url : url.url;
  const handler = routes[path];
  if (!handler) return realFetch(url, opts);
  let body = {};
  try {
    body = JSON.parse(opts.body || '{}');
  } catch {
    /* empty */
  }
  return handler(body);
};
window.EventSource = class {
  constructor() {
    this.onmessage = null;
    listeners.add((e) => this.onmessage?.(e));
    setTimeout(() => this.onmessage?.({ data: JSON.stringify(link) }), 0);
  }
  close() {}
};

// ---- Saved files and paperwork shown in-page ----
function sheet(title, body, tools = []) {
  document.getElementById('demoSheet')?.remove();
  const close = el('button', {
    className: 'icon',
    type: 'button',
    'aria-label': 'Close',
    textContent: '×',
    onclick: () => box.remove(),
  });
  const box = el(
    'div',
    {
      id: 'demoSheet',
      className: 'sheet-wrap',
      onclick: (e) => {
        if (e.target === box) box.remove();
      },
    },
    el(
      'div',
      { className: 'sheet', role: 'dialog', 'aria-label': title },
      el(
        'header',
        { className: 'panel-head' },
        el('h2', { textContent: title }),
        el('div', { className: 'panel-tools' }, ...tools, close),
      ),
      body,
    ),
  );
  document.body.append(box);
  close.focus();
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') box.remove();
  });
}
window.kkHost = {
  ...(window.kkHost || {}),
  demo: true,
  store: STORE,
  download(name, text, type) {
    if (typeof text !== 'string') {
      // a .kk show: binary, so offer it rather than print it
      const url = URL.createObjectURL(new Blob([text], { type }));
      return sheet(
        name,
        el(
          'div',
          { className: 'panel-body' },
          el('p', {
            textContent: `KobiKraken show file, ${(text.length / 1024).toFixed(1)} KB: compressed, with a checksum so a damaged file is caught. Open it again with Open.`,
          }),
        ),
        [el('a', { className: 'button primary small', href: url, download: name, textContent: 'Download' })],
      );
    }
    const pre = el('pre', { className: 'log sheet-text', textContent: text });
    sheet(
      name,
      el(
        'div',
        { className: 'panel-body' },
        el('p', {
          className: 'muted',
          textContent: 'The app saves this as a file. Here in the demo it is shown instead.',
        }),
        pre,
      ),
      [
        el('button', {
          className: 'ghost small',
          type: 'button',
          textContent: 'Copy',
          onclick: async (e) => {
            try {
              await navigator.clipboard.writeText(text);
              e.target.textContent = 'Copied';
            } catch {
              getSelection().selectAllChildren(pre);
            }
          },
        }),
      ],
    );
  },
  paperwork(p) {
    // own frame so paperwork styles don't clash with the app's
    const frame = el('iframe', { className: 'paper', title: p.title });
    frame.srcdoc = `<!doctype html><meta charset="utf-8"><style>body{margin:24px;background:#fff}${p.css}</style>${p.body}`; // built by paperwork() from escaped show data
    sheet(p.title, frame);
  },
};

// ---- The pretend desk, drawn under the line check ----
const dbText = (v) => (v == null ? '' : v <= -32768 ? '−∞' : `${(v / 100).toFixed(1)}`);
const capPos = (v) => (v == null ? 70 : v <= -32768 ? 0 : Math.max(0, Math.min(76, 58 + (v / 100) * 1.4)));
function lcd(name, color) {
  const d = el('div', { className: name ? 'lcd' : 'lcd blank', textContent: name || '—' });
  if (color) d.style.background = SWATCH[color] || '#50565e';
  return d;
}
let deskBox;
function drawDesk(flash) {
  if (!deskBox) return;
  const inCount = Math.max(16, ...Object.keys(desk.inCh).map((n) => Number(n) + 2));
  const mixes = Object.keys(desk.mix)
    .map(Number)
    .sort((a, b) => a - b);
  const strips = [];
  for (let i = 0; i < inCount; i++) {
    const c = desk.inCh[i] || {};
    const lamps = [
      el('span', { className: `lamp st${c.toSt ? ' on' : ''}`, textContent: 'ST' }),
      ...mixes.map((m) => el('span', { className: `lamp${c.toMix?.[m] ? ' on' : ''}`, textContent: m + 1 })),
    ];
    const cap = el('div', { className: 'cap' });
    cap.style.bottom = `${capPos(c.level)}px`;
    strips.push(
      el(
        'div',
        { className: `strip${flash === i ? ' flash' : ''}${desk.solo === i ? ' soloed' : ''}` },
        el('span', { className: 'num', textContent: i + 1 }),
        lcd(c.name, c.color),
        el('div', { className: 'lamps' }, ...lamps),
        el('span', {
          className: 'tagline',
          textContent: desk.solo === i ? 'SOLO' : c.gain != null ? `${c.gain} dB` : '',
        }),
        el('span', {
          className: `tagline ${c.hpfOn ? 'on' : ''}`,
          textContent: c.hpfOn ? `HPF ${c.hpf}` : '',
        }),
        el('div', { className: 'fader' }, cap),
        el('span', { className: 'db', textContent: dbText(c.level) }),
      ),
    );
  }
  const feeds = (test) => [
    ...new Set(
      Object.values(desk.inCh)
        .filter(test)
        .map((c) => c.name.replace(/ [LR]$/, ''))
        .filter(Boolean),
    ),
  ];
  const outStrip = (label, name, color, level, names, pre, patch) => {
    const cap = el('div', { className: 'cap' });
    cap.style.bottom = `${capPos(level)}px`;
    return el(
      'div',
      { className: 'strip out' },
      el('span', { className: 'num', textContent: label }),
      lcd(name, color),
      el('span', { className: `tagline ${pre ? 'on' : ''}`, textContent: pre ? 'PRE' : 'POST' }),
      el('span', { className: 'tagline', textContent: patch || '' }),
      el('div', { className: 'feeds', textContent: names.join(', ') }),
      el('div', { className: 'fader' }, cap),
      el('span', { className: 'db', textContent: dbText(level) }),
    );
  };
  const outs = [
    outStrip(
      'ST',
      desk.st.name,
      desk.st.name ? 'Red' : null,
      desk.st.level,
      feeds((c) => c.toSt),
      false,
      desk.outPatch['ST L']?.join(' '),
    ),
  ];
  for (const m of mixes)
    outs.push(
      outStrip(
        `MIX ${m + 1}`,
        desk.mix[m].name,
        desk.mix[m].color,
        desk.mix[m].level,
        feeds((c) => c.toMix?.[m]),
        desk.sendPoint[m] === 0,
        desk.outPatch[`MIX${m + 1}`]?.join(' '),
      ),
    );
  deskBox.replaceChildren(
    el('div', { className: 'bank-label', textContent: 'Inputs' }),
    el('div', { className: 'bank' }, ...strips),
    el('div', { className: 'bank-label', textContent: 'Outputs' }),
    el('div', { className: 'bank' }, ...outs),
  );
}

function mountDemo() {
  const tip =
    'Everything here is pretend: the desk, the network, the radio mics and amps. The real app talks to real kit.';
  const exit = window.kkHost.exitDemo;
  document.querySelector('.product-bar .product')?.after(
    exit
      ? el(
          'button',
          {
            className: 'tag on demo-exit',
            type: 'button',
            title: `${tip} Click to leave the demo.`,
            onclick: exit,
          },
          'Demo',
          el('span', { textContent: '· Exit' }),
        )
      : tag('Demo', 'on', tip),
  );
  document.getElementById('lockBtn')?.remove();
  const hostInput = document.getElementById('host');
  if (hostInput && !hostInput.value) hostInput.value = '192.168.0.128';
  deskBox = el('div', { className: 'surface' });
  document
    .getElementById('tab-desk')
    .append(panel({ step: '07', title: 'Pretend desk', tools: [tag('Demo only')] }, deskBox));
  drawDesk();
}

try {
  if (!localStorage.getItem(`${STORE}-host`)) localStorage.setItem(`${STORE}-host`, '192.168.0.128');
} catch {
  /* storage off */
}
document.head.append(el('link', { rel: 'stylesheet', href: 'demo.css' }));
document.body.classList.remove('booting', 'locked');
await import('./app.js');
mountDemo();
