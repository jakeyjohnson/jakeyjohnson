// Fake AES70 amp: 4 channel blocks (name, mute, gain, input select). Made-up layout, not a real d&b tree.
// Run: node mock-amp.js   (OCA_PORT to change the port)
import net from 'node:net';
import { Reader, encodeString, frame, parseMessages } from './oca-link.js';

const u8 = (v) => Buffer.from([v]);
const u16 = (v) => {
  const b = Buffer.alloc(2);
  b.writeUInt16BE(v);
  return b;
};
const u32 = (v) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(v);
  return b;
};
const f32 = (v) => {
  const b = Buffer.alloc(4);
  b.writeFloatBE(v);
  return b;
};
const classId = (id) => {
  const parts = id.split('.').map(Number);
  return Buffer.concat([u16(parts.length), ...parts.map(u16)]);
};
const list = (items) => Buffer.concat([u16(items.length), ...items]);

export function mockAmp({ model = 'D80 (pretend)', channels = 4, recursive = true } = {}) {
  const objects = new Map();
  const add = (ono, cls, role, container, state = {}) =>
    objects.set(ono, { ono, cls, role, container, label: '', ...state });
  add(100, '1.1.3', 'Root', 0);
  for (let c = 0; c < channels; c++) {
    const base = 1000 + c * 100;
    const ch = 'ABCD'[c] || String(c + 1);
    add(base, '1.1.3', `Channel ${ch}`, 100);
    add(base + 1, '1.1.1.1.12', 'Name', base, { text: `Ch ${ch}` });
    add(base + 2, '1.1.1.2', 'Mute', base, { mute: 2 });
    add(base + 3, '1.1.1.5', 'Gain', base, { gain: 0 });
    add(base + 4, '1.1.1.4', 'Input', base, {
      position: c,
      names: ['A1', 'A2', 'A3', 'A4', 'D1', 'D2', 'D3', 'D4'],
    });
  }
  const members = (block, deep) =>
    [...objects.values()].filter((o) => (deep ? o.ono !== 100 : o.container === block));
  const handle = (ono, level, index) => {
    if (ono === 1) {
      if (level === 3 && index === 6)
        return [
          0,
          Buffer.concat([encodeString('d&b audiotechnik'), encodeString(model), encodeString('2.0.0')]),
        ];
      if (level === 3 && index === 3) return [0, encodeString('PRETEND-0001')];
      if (level === 3 && index === 4) return [0, encodeString('Amp on the bench')];
      if (level === 3 && index === 7) return [0, encodeString('Main L/R')];
      if (level === 3 && index === 1) return [0, u16(1)];
      return [8, null];
    }
    const o = objects.get(ono);
    if (!o) return [5, null]; // BadONo
    if (level === 1 && index === 5) return [0, encodeString(o.role)];
    if (level === 2 && index === 8) return [0, encodeString(o.label)];
    if (o.cls === '1.1.3' && level === 3 && (index === 5 || index === 6)) {
      if (index === 6 && !recursive) return [8, null];
      const items = members(ono, index === 6).map((m) =>
        Buffer.concat([u32(m.ono), classId(m.cls), u16(1), ...(index === 6 ? [u32(m.container)] : [])]),
      );
      return [0, list(items)];
    }
    if (o.cls === '1.1.1.2' && level === 4 && index === 1) return [0, u8(o.mute)];
    if (o.cls === '1.1.1.5' && level === 4 && index === 1)
      return [0, Buffer.concat([f32(o.gain), f32(-57.5), f32(6)])];
    if (o.cls === '1.1.1.4' && level === 4 && index === 1)
      return [0, Buffer.concat([u16(o.position), u16(0), u16(o.names.length - 1)])];
    if (o.cls === '1.1.1.4' && level === 4 && index === 5) return [0, list(o.names.map(encodeString))];
    if (o.cls === '1.1.1.1.12' && level === 5 && index === 1) return [0, encodeString(o.text)];
    return [8, null]; // NotImplemented
  };
  const server = net.createServer((socket) => {
    let buf = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      const { pdus, rest } = parseMessages(Buffer.concat([buf, chunk]));
      buf = Buffer.from(rest);
      for (const p of pdus) {
        if (p.type !== 1 && p.type !== 0) continue;
        const r = new Reader(p.body);
        r.u32();
        const h = r.u32();
        const ono = r.u32();
        const level = r.u16();
        const index = r.u16();
        const [status, params] = handle(ono, level, index);
        if (p.type === 0) continue;
        const head = Buffer.alloc(10);
        head.writeUInt32BE(10 + (params?.length || 0), 0);
        head.writeUInt32BE(h, 4);
        head.writeUInt8(status, 8);
        head.writeUInt8(params ? 1 : 0, 9);
        socket.write(frame(3, [Buffer.concat([head, params || Buffer.alloc(0)])]));
      }
    });
    socket.on('error', () => {});
  });
  return { server, objects };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.OCA_PORT || 30013);
  mockAmp().server.listen(port, '127.0.0.1', () => console.log(`Pretend AES70 amp on 127.0.0.1:${port}`));
}
