// LAN discovery, offline: TCP probe of known control ports across the local /24s, plus mDNS PTR queries.
// Private addresses only.
import dgram from 'node:dgram';
import net from 'node:net';
import os from 'node:os';

// Control port: probe type
export const PORTS = {
  49280: 'yamaha', // Yamaha remote control: CL/QL/TF/DM/RIVAGE desks, Rio/Tio stage boxes
  2202: 'shure', // Shure command strings: ULX-D, QLX-D, Axient Digital, SLX-D receivers
  53000: 'qlab', // QLab's OSC port
  30013: 'aes70', // AES70 (OCA), as used by d&b amps
};

// mDNS service types
export const SERVICES = {
  '_netaudio-arc._udp.local': 'dante',
  '_qlab._tcp.local': 'qlab',
  '_osc._udp.local': 'osc',
  '_oca._tcp.local': 'aes70',
  '_ssc._udp.local': 'ssc',
};

const KIND_ORDER = ['desk', 'stagebox', 'radio', 'amp', 'playback', 'other'];

// Dante only gives a name; guess the type from makers' default names
export function guessFromName(name) {
  const n = String(name).toUpperCase();
  if (/ULXD|ULX-D|QLXD|QLX-D|AD4|AXT|SLXD|SLX-D|EW-?DX|EWDX|EM ?\d|SK ?\d|SPEECHLINE|AXIENT|WIRELESS/.test(n))
    return 'radio';
  if (/\bRIO|TIO|RSIO|STAGEBOX|STAGE BOX|R\d{4}/.test(n)) return 'stagebox';
  if (/\bCL[135]\b|\bQL[15]\b|\bTF[135]?\b|\bDM[37]\b|RIVAGE|\bPM\d|DSP-R|CSD-R|CS-R/.test(n)) return 'desk';
  if (
    /LAB.?GRUPPEN|\bPLM|\bD\d{2,3}\b|\b\d{1,2}D\b|D80|D40|D20|\bLA\d|LA12X|LA4X|LA7|POWERSOFT|QUATTROCANALI|OTTOCANALI|X4|X8|\bPC-D|\bDI8|XMV|CXD|AMP/.test(
      n,
    )
  )
    return 'amp';
  if (/QLAB|DVS|VIRTUAL SOUNDCARD|MACBOOK|IMAC|MAC ?MINI|MAC ?STUDIO|LAPTOP|PLAYBACK|-PC\b|WINDOWS/.test(n))
    return 'playback';
  return 'other';
}

// ---- mDNS (minimal: PTR queries, parse answers) ----
export function encodeName(name) {
  const parts = name.replace(/\.$/, '').split('.');
  return Buffer.concat([
    ...parts.map((p) => Buffer.concat([Buffer.from([Buffer.byteLength(p)]), Buffer.from(p)])),
    Buffer.from([0]),
  ]);
}
export function mdnsQuery(names) {
  const header = Buffer.alloc(12);
  header.writeUInt16BE(names.length, 4);
  const questions = names.map((n) => Buffer.concat([encodeName(n), Buffer.from([0, 12, 0, 1])])); // PTR, IN
  return Buffer.concat([header, ...questions]);
}
function readName(buf, offset, depth = 0) {
  const labels = [];
  let pos = offset;
  let end = null;
  while (depth < 20) {
    const len = buf[pos];
    if (len === undefined) throw new Error('short packet');
    if (len === 0) {
      pos += 1;
      break;
    }
    if ((len & 0xc0) === 0xc0) {
      // compression pointer
      if (end === null) end = pos + 2;
      pos = ((len & 0x3f) << 8) | buf[pos + 1];
      depth++;
      continue;
    }
    labels.push(buf.toString('utf8', pos + 1, pos + 1 + len));
    pos += 1 + len;
  }
  return { name: labels.join('.'), next: end ?? pos };
}
// PTR, SRV, A and TXT only
export function parseMdns(buf) {
  const count = (i) => buf.readUInt16BE(i);
  const total = count(4) + count(6) + count(8) + count(10);
  let pos = 12;
  for (let q = 0; q < count(4); q++) pos = readName(buf, pos).next + 4;
  const records = [];
  for (let r = 0; r < total - count(4); r++) {
    const { name, next } = readName(buf, pos);
    const type = buf.readUInt16BE(next);
    const len = buf.readUInt16BE(next + 8);
    const data = next + 10;
    const rec = { name, type };
    if (type === 12) rec.ptr = readName(buf, data).name;
    else if (type === 33) {
      rec.port = buf.readUInt16BE(data + 4);
      rec.target = readName(buf, data + 6).name;
    } else if (type === 1 && len === 4) rec.ip = [...buf.subarray(data, data + 4)].join('.');
    else if (type === 16) {
      rec.txt = [];
      for (let p = data; p < data + len; ) {
        const l = buf[p];
        rec.txt.push(buf.toString('utf8', p + 1, p + 1 + l));
        p += 1 + l;
      }
    }
    records.push(rec);
    pos = data + len;
  }
  return records;
}
// PTR names an instance, its SRV gives the host, the host's A gives the IP
export function devicesFromRecords(records) {
  const srv = new Map(records.filter((r) => r.type === 33).map((r) => [r.name, r]));
  const addr = new Map(records.filter((r) => r.type === 1).map((r) => [r.name, r.ip]));
  const found = [];
  for (const r of records.filter((x) => x.type === 12 && SERVICES[x.name])) {
    const service = SERVICES[r.name];
    const instance = r.ptr.slice(0, r.ptr.length - r.name.length - 1) || r.ptr;
    const host = srv.get(r.ptr)?.target;
    const ip = host ? addr.get(host) : null;
    found.push({
      ...describeService(service, instance),
      name: instance,
      ip,
      via: `announces ${r.name.replace('.local', '')}`,
    });
  }
  return found;
}
function describeService(service, name) {
  switch (service) {
    case 'dante':
      return { kind: guessFromName(name), make: 'Dante', model: 'Dante device' };
    case 'qlab':
      return { kind: 'playback', make: 'Figure 53', model: 'QLab' };
    case 'osc':
      return { kind: 'playback', make: '', model: 'OSC device' };
    case 'aes70':
      return { kind: 'amp', make: '', model: 'AES70 device' };
    case 'ssc':
      return { kind: 'radio', make: 'Sennheiser', model: 'Sound Control device (Spectera, EW-DX)' };
    default:
      return { kind: 'other', make: '', model: service };
  }
}
function browseMdns(ms) {
  return new Promise((resolve) => {
    const records = [];
    let socket;
    try {
      socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    } catch {
      return resolve([]);
    }
    const finish = () => {
      try {
        socket.close();
      } catch {
        /* closed */
      }
      resolve(devicesFromRecords(records));
    };
    socket.on('error', finish);
    socket.on('message', (msg) => {
      try {
        records.push(...parseMdns(msg));
      } catch {
        /* not a packet we can read */
      }
    });
    // Query from a non-5353 port gets legacy unicast replies, no multicast join needed
    socket.bind(0, () => {
      socket.send(mdnsQuery(Object.keys(SERVICES)), 5353, '224.0.0.251', () => {});
      setTimeout(finish, ms);
    });
  });
}

// ---- Port checks ----
function talk(host, port, hello, ms) {
  return new Promise((resolve) => {
    let data = '';
    let open = false;
    const socket = net.createConnection({ host, port });
    const done = () => {
      socket.destroy();
      resolve(open ? data : null);
    };
    const timer = setTimeout(done, ms);
    socket.setEncoding('utf8');
    socket.on('connect', () => {
      open = true;
      if (hello) socket.write(hello);
      else {
        clearTimeout(timer);
        done();
      }
    });
    socket.on('data', (chunk) => {
      data += chunk;
    });
    socket.on('error', () => {
      clearTimeout(timer);
      done();
    });
  });
}
async function probe(host, port, protocol, ms) {
  if (protocol === 'yamaha') {
    const reply = await talk(host, port, 'devinfo productname\n', ms * 2);
    if (reply === null) return null;
    const model = /OK devinfo productname "([^"]*)"/.exec(reply)?.[1];
    const kind = /RIO|TIO|RSIO/i.test(model || '') ? 'stagebox' : 'desk';
    return {
      ip: host,
      kind,
      make: 'Yamaha',
      model: model || 'Yamaha device',
      name: model || '',
      via: `port ${port}`,
      port,
    };
  }
  if (protocol === 'shure') {
    const reply = await talk(host, port, '< GET MODEL >\r\n< GET DEVICE_ID >\r\n', ms * 2);
    if (reply === null) return null;
    const model = /<\s*REP\s+(?:\d+\s+)?MODEL\s*\{([^}]*)\}/i.exec(reply)?.[1]?.trim();
    const id = /<\s*REP\s+(?:\d+\s+)?DEVICE_ID\s*\{([^}]*)\}/i.exec(reply)?.[1]?.trim();
    return {
      ip: host,
      kind: 'radio',
      make: 'Shure',
      model: model || 'Shure receiver',
      name: id || '',
      via: `port ${port}`,
      port,
    };
  }
  const open = await talk(host, port, null, ms);
  if (open === null) return null;
  if (protocol === 'qlab')
    return {
      ip: host,
      kind: 'playback',
      make: 'Figure 53',
      model: 'QLab (probably)',
      name: '',
      via: `port ${port}`,
      port,
    };
  return {
    ip: host,
    kind: 'amp',
    make: '',
    model: 'AES70 device (d&b and others)',
    name: '',
    via: `port ${port}`,
    port,
  };
}

// The /24 around each local private IPv4 address
export function localTargets() {
  const out = new Set();
  const subnets = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      const [x, y, z] = a.address.split('.').map(Number);
      const isPrivate =
        x === 10 || (x === 172 && y >= 16 && y <= 31) || (x === 192 && y === 168) || (x === 169 && y === 254);
      if (!isPrivate) continue;
      subnets.push(`${x}.${y}.${z}.0/24`);
      for (let h = 1; h < 255; h++) out.add(`${x}.${y}.${z}.${h}`);
    }
  }
  return { hosts: [...out], subnets: [...new Set(subnets)] };
}

async function pool(items, size, fn) {
  const results = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const item = items[next++];
        results.push(await fn(item));
      }
    }),
  );
  return results;
}

// Merge both methods: one entry per IP, most specific description wins
export function mergeDevices(found) {
  const byIp = new Map();
  const loose = [];
  for (const d of found.filter(Boolean)) {
    if (!d.ip) {
      loose.push({ ...d, via: [d.via] });
      continue;
    }
    const had = byIp.get(d.ip);
    if (!had) {
      byIp.set(d.ip, { ...d, via: [d.via] });
      continue;
    }
    had.via.push(d.via);
    if (!had.name && d.name) had.name = d.name;
    const better =
      KIND_ORDER.indexOf(d.kind) < KIND_ORDER.indexOf(had.kind) ||
      (had.make === 'Dante' && d.make && d.make !== 'Dante');
    if (better) Object.assign(had, { kind: d.kind, make: d.make, model: d.model, port: d.port ?? had.port });
  }
  const ipNum = (ip) => ip.split('.').reduce((n, x) => n * 256 + Number(x), 0);
  return [...byIp.values(), ...loose].sort(
    (a, b) =>
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
      (a.ip && b.ip ? ipNum(a.ip) - ipNum(b.ip) : 0),
  );
}

export async function discover({ hosts, ports = PORTS, timeoutMs = 400, mdnsMs = 2500, mdns = true } = {}) {
  const targets = hosts ? { hosts, subnets: [] } : localTargets();
  const jobs = targets.hosts.flatMap((h) =>
    Object.entries(ports).map(([port, protocol]) => [h, Number(port), protocol]),
  );
  const [scanned, announced] = await Promise.all([
    pool(jobs, 128, ([h, port, protocol]) => probe(h, port, protocol, timeoutMs)),
    mdns ? browseMdns(mdnsMs) : Promise.resolve([]),
  ]);
  return {
    subnets: targets.subnets,
    scanned: targets.hosts.length,
    devices: mergeDevices([...scanned, ...announced]),
  };
}
