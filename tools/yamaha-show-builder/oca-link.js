// Minimal read-only AES70 client (OCP.1 over TCP), from the published standard. Used for d&b amps.
// Reads device info, the object tree (ONo, class, role, label) and values of common controls.
import net from 'node:net';

export const OCA_PORT = 30013;
const SYNC = 0x3b;
const PROTOCOL = 1; // OCP.1 as first published (2015); older amps need it, newer ones accept it
const TYPE = { command: 0, commandRrq: 1, notification: 2, response: 3, keepAlive: 4 };
export const STATUS = [
  'OK',
  'ProtocolVersionError',
  'DeviceError',
  'Locked',
  'BadFormat',
  'BadONo',
  'ParameterError',
  'ParameterOutOfRange',
  'NotImplemented',
  'InvalidRequest',
  'ProcessingFailed',
  'BadMethod',
  'PartiallySucceeded',
  'Timeout',
  'BufferOverflow',
];

// By class ID. read: [def level, method index, decoder]
export const CLASSES = {
  '1': { name: 'OcaRoot' },
  '1.1': { name: 'OcaWorker' },
  '1.1.1': { name: 'OcaActuator' },
  '1.1.1.1': { name: 'OcaBasicActuator' },
  '1.1.1.1.1': { name: 'OcaBooleanActuator', read: [5, 1, 'bool'] },
  '1.1.1.1.10': { name: 'OcaFloat32Actuator', read: [5, 1, 'float3'] },
  '1.1.1.1.12': { name: 'OcaStringActuator', read: [5, 1, 'string'] },
  '1.1.1.2': { name: 'OcaMute', read: [4, 1, 'mute'] },
  '1.1.1.3': { name: 'OcaPolarity', read: [4, 1, 'polarity'] },
  '1.1.1.4': { name: 'OcaSwitch', read: [4, 1, 'switch'], names: [4, 5] },
  '1.1.1.5': { name: 'OcaGain', read: [4, 1, 'float3'] },
  '1.1.1.7': { name: 'OcaDelay', read: [4, 1, 'float3'] },
  '1.1.2': { name: 'OcaSensor' },
  '1.1.3': { name: 'OcaBlock' },
  '1.2': { name: 'OcaAgent' },
  '1.3': { name: 'OcaManager' },
  '1.3.1': { name: 'OcaDeviceManager' },
};
export const classNameOf = (id) => {
  if (CLASSES[id]) return CLASSES[id].name;
  for (let parts = id.split('.'); parts.length; parts.pop())
    if (CLASSES[parts.join('.')]) return `${CLASSES[parts.join('.')].name} (extended)`;
  return 'unknown';
};

// ---- Encoding ----
export function encodeCommand(
  handle,
  ono,
  level,
  index,
  params = Buffer.alloc(0),
  paramCount = params.length ? 1 : 0,
) {
  const pdu = Buffer.alloc(17 + params.length);
  pdu.writeUInt32BE(pdu.length, 0);
  pdu.writeUInt32BE(handle, 4);
  pdu.writeUInt32BE(ono, 8);
  pdu.writeUInt16BE(level, 12);
  pdu.writeUInt16BE(index, 14);
  pdu.writeUInt8(paramCount, 16);
  params.copy(pdu, 17);
  return frame(TYPE.commandRrq, [pdu]);
}
export function frame(type, pdus) {
  const body = Buffer.concat(pdus);
  const head = Buffer.alloc(10);
  head.writeUInt8(SYNC, 0);
  head.writeUInt16BE(PROTOCOL, 1);
  head.writeUInt32BE(9 + body.length, 3); // size counts everything after the sync byte
  head.writeUInt8(type, 7);
  head.writeUInt16BE(pdus.length, 8);
  return Buffer.concat([head, body]);
}
export function encodeString(s) {
  const bytes = Buffer.from(String(s), 'utf8');
  const head = Buffer.alloc(2);
  head.writeUInt16BE([...String(s)].length, 0); // OCP.1 counts characters, not bytes
  return Buffer.concat([head, bytes]);
}

// ---- Decoding ----
export class Reader {
  constructor(buf) {
    this.buf = buf;
    this.pos = 0;
  }
  u8() {
    return this.buf.readUInt8(this.pos++);
  }
  u16() {
    const v = this.buf.readUInt16BE(this.pos);
    this.pos += 2;
    return v;
  }
  u32() {
    const v = this.buf.readUInt32BE(this.pos);
    this.pos += 4;
    return v;
  }
  f32() {
    const v = this.buf.readFloatBE(this.pos);
    this.pos += 4;
    return Math.round(v * 1000) / 1000;
  }
  string() {
    const chars = this.u16();
    let end = this.pos;
    for (let n = 0; n < chars; n++) {
      const b = this.buf[end];
      end += b < 0x80 ? 1 : b < 0xe0 ? 2 : b < 0xf0 ? 3 : 4;
    }
    const s = this.buf.toString('utf8', this.pos, end);
    this.pos = end;
    return s;
  }
  classId() {
    const n = this.u16();
    const parts = [];
    for (let i = 0; i < n; i++) parts.push(this.u16());
    return parts.join('.');
  }
  list(item) {
    const n = this.u16();
    const out = [];
    for (let i = 0; i < n; i++) out.push(item(this));
    return out;
  }
}
// Stream to messages to PDUs. Returns the PDUs plus leftover bytes.
export function parseMessages(buf) {
  const pdus = [];
  let pos = 0;
  while (buf.length - pos >= 10) {
    if (buf[pos] !== SYNC) {
      pos++;
      continue;
    }
    const size = buf.readUInt32BE(pos + 3);
    if (buf.length - pos < size + 1) break;
    const type = buf.readUInt8(pos + 7);
    const count = buf.readUInt16BE(pos + 8);
    let p = pos + 10;
    for (let i = 0; i < count && p < pos + 1 + size; i++) {
      if (type === TYPE.keepAlive) {
        pdus.push({ type });
        p = pos + 1 + size;
        break;
      }
      const len = buf.readUInt32BE(p);
      if (type === TYPE.response)
        pdus.push({
          type,
          handle: buf.readUInt32BE(p + 4),
          status: buf.readUInt8(p + 8),
          params: buf.subarray(p + 10, p + len),
        });
      else pdus.push({ type, handle: buf.readUInt32BE(p + 4), body: buf.subarray(p, p + len) });
      p += len;
    }
    pos += size + 1;
  }
  return { pdus, rest: buf.subarray(pos) };
}

// ---- Connection ----
export class OcaConnection {
  constructor(host, { port = OCA_PORT, timeoutMs = 2500 } = {}) {
    Object.assign(this, {
      host,
      port,
      timeoutMs,
      handle: 1,
      pending: new Map(),
      buf: Buffer.alloc(0),
      socket: null,
    });
  }
  connect() {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: this.host, port: this.port });
      const fail = (err) =>
        reject(
          new Error(
            err.code === 'ECONNREFUSED'
              ? `${this.host} refused AES70 on port ${this.port}. Is it a d&b amp with its network control on?`
              : `Couldn't reach ${this.host} (${err.code || err.message}).`,
          ),
        );
      socket.setTimeout(4000, () => {
        socket.destroy();
        reject(new Error(`No answer from ${this.host}.`));
      });
      socket.once('error', fail);
      socket.once('connect', () => {
        socket.setTimeout(0);
        socket.off('error', fail);
        socket.on('error', () => this.failAll('connection error'));
        socket.on('close', () => this.failAll('connection closed'));
        socket.on('data', (d) => this.onData(d));
        this.socket = socket;
        resolve(this);
      });
    });
  }
  onData(chunk) {
    const { pdus, rest } = parseMessages(Buffer.concat([this.buf, chunk]));
    this.buf = Buffer.from(rest);
    for (const p of pdus) {
      if (p.type !== TYPE.response) continue;
      const waiter = this.pending.get(p.handle);
      if (waiter) {
        this.pending.delete(p.handle);
        clearTimeout(waiter.timer);
        waiter.resolve(p);
      }
    }
  }
  failAll(why) {
    for (const [, w] of this.pending) {
      clearTimeout(w.timer);
      w.resolve({ status: -1, error: why });
    }
    this.pending.clear();
  }
  // Resolves { status, params }, status 0 = OK. Never rejects.
  call(ono, level, index, params, paramCount) {
    const handle = this.handle++;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(handle);
        resolve({ status: 13, error: 'timeout' });
      }, this.timeoutMs);
      this.pending.set(handle, { resolve, timer });
      this.socket.write(encodeCommand(handle, ono, level, index, params, paramCount));
    });
  }
  close() {
    this.socket?.destroy();
  }
}

// ---- Reading a whole device ----
const ROOT_BLOCK = 100;
const DEVICE_MANAGER = 1;
const ok = (r) => r.status === 0;
async function readString(conn, ono, level, index) {
  const r = await conn.call(ono, level, index);
  return ok(r) ? new Reader(r.params).string() : null;
}
function readValue(kind, params) {
  const r = new Reader(params);
  if (kind === 'bool') return Boolean(r.u8());
  if (kind === 'string') return r.string();
  if (kind === 'mute') return { 1: 'muted', 2: 'unmuted' }[r.u8()] || 'unknown';
  if (kind === 'polarity') return { 1: 'normal', 2: 'inverted' }[r.u8()] || 'unknown';
  if (kind === 'switch') return { position: r.u16(), min: r.u16(), max: r.u16() };
  if (kind === 'float3') return { value: r.f32(), min: r.f32(), max: r.f32() };
  return null;
}
// Limited concurrency, so a big tree doesn't flood the amp
async function inBatches(items, size, fn) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

// Identity only (maker, model, serial, name). Serial ties a rack position to the same amp.
export async function identifyDevice(host, { port, timeoutMs } = {}) {
  const conn = await new OcaConnection(host, { port, timeoutMs }).connect();
  try {
    const device = { host };
    const model = await conn.call(DEVICE_MANAGER, 3, 6);
    if (ok(model)) {
      const r = new Reader(model.params);
      Object.assign(device, { manufacturer: r.string(), model: r.string() });
    }
    device.serial = await readString(conn, DEVICE_MANAGER, 3, 3);
    device.name = await readString(conn, DEVICE_MANAGER, 3, 4);
    return device;
  } finally {
    conn.close();
  }
}

export async function readDevice(host, { port, timeoutMs, onProgress = () => {} } = {}) {
  const conn = await new OcaConnection(host, { port, timeoutMs }).connect();
  try {
    const device = { host };
    const model = await conn.call(DEVICE_MANAGER, 3, 6);
    if (ok(model)) {
      const r = new Reader(model.params);
      Object.assign(device, { manufacturer: r.string(), model: r.string(), version: r.string() });
    }
    device.serial = await readString(conn, DEVICE_MANAGER, 3, 3);
    device.name = await readString(conn, DEVICE_MANAGER, 3, 4);
    device.role = await readString(conn, DEVICE_MANAGER, 3, 7);
    const oca = await conn.call(DEVICE_MANAGER, 3, 1);
    if (ok(oca)) device.ocaVersion = new Reader(oca.params).u16();

    // Try the recursive member list first, else walk block by block
    let members = [];
    const rec = await conn.call(ROOT_BLOCK, 3, 6);
    if (ok(rec)) {
      members = new Reader(rec.params).list((r) => ({
        ono: r.u32(),
        classId: r.classId(),
        classVersion: r.u16(),
        container: r.u32(),
      }));
    } else {
      const walk = async (block) => {
        const res = await conn.call(block, 3, 5);
        if (!ok(res)) return;
        const kids = new Reader(res.params).list((r) => ({
          ono: r.u32(),
          classId: r.classId(),
          classVersion: r.u16(),
          container: block,
        }));
        members.push(...kids);
        for (const k of kids) if (k.classId.startsWith('1.1.3')) await walk(k.ono);
      };
      await walk(ROOT_BLOCK);
    }
    device.treeMethod = ok(rec) ? 'GetMembersRecursive' : 'GetMembers';

    let done = 0;
    await inBatches(members, 16, async (m) => {
      m.className = classNameOf(m.classId);
      m.role = await readString(conn, m.ono, 1, 5);
      if (m.classId.startsWith('1.1')) m.label = await readString(conn, m.ono, 2, 8);
      const known = CLASSES[m.classId];
      if (known?.read) {
        const [level, index, kind] = known.read;
        const res = await conn.call(m.ono, level, index);
        m.value = ok(res) ? readValue(kind, res.params) : { error: STATUS[res.status] || res.error };
      }
      if (known?.names) {
        const res = await conn.call(m.ono, ...known.names);
        if (ok(res)) m.positionNames = new Reader(res.params).list((r) => r.string());
      }
      onProgress(++done, members.length);
    });

    // Role paths from each object's container
    const byOno = new Map(members.map((m) => [m.ono, m]));
    for (const m of members) {
      const path = [m.role || `#${m.ono}`];
      for (let c = byOno.get(m.container), guard = 0; c && guard < 32; c = byOno.get(c.container), guard++)
        path.unshift(c.role || `#${c.ono}`);
      m.path = path.join('/');
    }
    return {
      readAt: new Date().toISOString(),
      device,
      objects: members.sort((a, b) => a.path.localeCompare(b.path)),
    };
  } finally {
    conn.close();
  }
}

// Control counts per class, for the UI
export function summarise(dump) {
  const count = (name) => dump.objects.filter((o) => o.className === name).length;
  return {
    name: dump.device.name || dump.device.model || dump.device.host,
    model: [dump.device.manufacturer, dump.device.model].filter(Boolean).join(' '),
    objects: dump.objects.length,
    mutes: count('OcaMute'),
    gains: count('OcaGain'),
    switches: count('OcaSwitch'),
    names: count('OcaStringActuator'),
  };
}
