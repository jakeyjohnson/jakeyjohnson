import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { once } from 'node:events';
import { devicesFromRecords, discover, encodeName, guessFromName, mdnsQuery, mergeDevices, parseMdns } from '../discover.js';

// Builds an mDNS answer the way a Dante device would send it
function record(name, type, rdata) {
  const fixed = Buffer.alloc(10);
  fixed.writeUInt16BE(type, 0);
  fixed.writeUInt16BE(1, 2);
  fixed.writeUInt32BE(120, 4);
  fixed.writeUInt16BE(rdata.length, 8);
  return Buffer.concat([typeof name === 'string' ? encodeName(name) : name, fixed, rdata]);
}
function packet(answers, additional) {
  const header = Buffer.alloc(12);
  header.writeUInt16BE(0x8400, 2);
  header.writeUInt16BE(answers.length, 6);
  header.writeUInt16BE(additional.length, 10);
  return Buffer.concat([header, ...answers, ...additional]);
}

test('reads a Dante device announcement into a named radio mic receiver with its IP', () => {
  const service = '_netaudio-arc._udp.local';
  const instance = `ULXD4Q-1a2b3c.${service}`;
  const srv = Buffer.concat([Buffer.from([0, 0, 0, 0, 0x11, 0x58]), encodeName('ULXD4Q-1a2b3c.local')]);
  // the PTR's name points back at the question-free answer start (offset 12) to test name compression
  const ptrName = Buffer.from([0xc0, 12]);
  const first = record(service, 12, encodeName(instance));
  const msg = packet([first, record(ptrName, 12, encodeName(`DM7-0042.${service}`))], [
    record(instance, 33, srv),
    record('ULXD4Q-1a2b3c.local', 1, Buffer.from([192, 168, 0, 50])),
  ]);
  const records = parseMdns(msg);
  assert.equal(records[1].name, service); // the compressed name was followed
  const devices = devicesFromRecords(records);
  assert.deepEqual(devices[0], { kind: 'radio', make: 'Dante', model: 'Dante device', name: 'ULXD4Q-1a2b3c', ip: '192.168.0.50', via: 'announces _netaudio-arc._udp' });
  assert.equal(devices[1].kind, 'desk');
  assert.equal(devices[1].ip, null); // no address sent for that one
});

test('the mDNS question asks for every service', () => {
  const q = mdnsQuery(['_qlab._tcp.local', '_oca._tcp.local']);
  assert.equal(q.readUInt16BE(4), 2);
  assert.ok(q.includes(Buffer.from('qlab')));
});

test('Dante names are sorted into desks, stage boxes, radio mics, amps and playback', () => {
  const kinds = Object.fromEntries(['QL5-1', 'Rio3224-D2-AB', 'ULXD4D-3e', 'AD4Q-77', 'EW-DX-EM4', 'LabGruppen-D20', 'DS10-PLM', 'LA12X-1', 'QLab-Mac', 'MacBook-Pro-DVS', 'Mystery-Box']
    .map((n) => [n, guessFromName(n)]));
  assert.deepEqual(kinds, {
    'QL5-1': 'desk', 'Rio3224-D2-AB': 'stagebox', 'ULXD4D-3e': 'radio', 'AD4Q-77': 'radio', 'EW-DX-EM4': 'radio', 'LabGruppen-D20': 'amp',
    'DS10-PLM': 'amp', 'LA12X-1': 'amp', 'QLab-Mac': 'playback', 'MacBook-Pro-DVS': 'playback', 'Mystery-Box': 'other',
  });
});

async function fakeDevice(reply) {
  const server = net.createServer((socket) => socket.on('data', () => reply && socket.write(reply)));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { port: server.address().port, close: () => new Promise((r) => server.close(r)) };
}

test('finds a Yamaha desk, a Shure receiver and QLab by their control ports', async () => {
  const desk = await fakeDevice('OK devinfo productname "QL5"\n');
  const shure = await fakeDevice('< REP MODEL {ULXD4Q                          } >\r\n< REP DEVICE_ID {Rack 1    } >\r\n');
  const qlab = await fakeDevice(null);
  const { devices } = await discover({
    hosts: ['127.0.0.1'], mdns: false, timeoutMs: 300,
    ports: { [desk.port]: 'yamaha', [shure.port]: 'shure', [qlab.port]: 'qlab' },
  });
  // all three share 127.0.0.1 here, so they merge into one entry; check each probe's own answer instead
  assert.equal(devices.length, 1);
  assert.equal(devices[0].kind, 'desk');
  assert.equal(devices[0].model, 'QL5');
  assert.equal(devices[0].via.length, 3);
  for (const d of [desk, shure, qlab]) await d.close();

  const alone = await fakeDevice('< REP MODEL {ULXD4Q } >\r\n< REP DEVICE_ID {Rack 1} >\r\n');
  const r = await discover({ hosts: ['127.0.0.1'], mdns: false, timeoutMs: 300, ports: { [alone.port]: 'shure' } });
  assert.deepEqual([r.devices[0].kind, r.devices[0].make, r.devices[0].model, r.devices[0].name], ['radio', 'Shure', 'ULXD4Q', 'Rack 1']);
  await alone.close();
});

test('nothing listening means nothing found', async () => {
  const gone = await fakeDevice(null);
  const { port } = gone;
  await gone.close();
  const r = await discover({ hosts: ['127.0.0.1'], mdns: false, timeoutMs: 200, ports: { [port]: 'yamaha' } });
  assert.deepEqual(r.devices, []);
});

test('a desk found both ways is listed once, as the Yamaha desk', () => {
  const merged = mergeDevices([
    { ip: '192.168.0.10', kind: 'other', make: 'Dante', model: 'Dante device', name: 'Y001-Yamaha-QL5', via: 'announces _netaudio-arc._udp' },
    { ip: '192.168.0.10', kind: 'desk', make: 'Yamaha', model: 'QL5', name: 'QL5', via: 'port 49280', port: 49280 },
    { ip: '192.168.0.40', kind: 'amp', make: 'Dante', model: 'Dante device', name: 'D20', via: 'announces _netaudio-arc._udp' },
  ]);
  assert.equal(merged.length, 2);
  assert.deepEqual([merged[0].kind, merged[0].make, merged[0].model, merged[0].name], ['desk', 'Yamaha', 'QL5', 'Y001-Yamaha-QL5']);
  assert.equal(merged[0].via.length, 2);
});
