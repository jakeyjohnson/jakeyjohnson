import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { Reader, encodeCommand, encodeString, parseMessages, readDevice, summarise } from '../oca-link.js';
import { mockAmp } from '../mock-amp.js';

test('commands are framed as OCP.1 says: sync byte, header, then the command', () => {
  const msg = encodeCommand(7, 100, 3, 6);
  assert.equal(msg[0], 0x3b);
  assert.equal(msg.readUInt16BE(1), 1); // protocol version
  assert.equal(msg.readUInt32BE(3), msg.length - 1); // size counts everything after the sync byte
  assert.equal(msg.readUInt8(7), 1); // command, response required
  assert.equal(msg.readUInt16BE(8), 1);
  assert.deepEqual([msg.readUInt32BE(10), msg.readUInt32BE(14), msg.readUInt32BE(18), msg.readUInt16BE(22), msg.readUInt16BE(24), msg.readUInt8(26)], [17, 7, 100, 3, 6, 0]);
  const { pdus, rest } = parseMessages(Buffer.concat([msg, msg.subarray(0, 5)]));
  assert.equal(pdus.length, 1);
  assert.equal(rest.length, 5); // a half-received message waits for the rest
});

test('strings count characters, not bytes', () => {
  const s = encodeString('Bühne 1');
  assert.equal(s.readUInt16BE(0), 7);
  assert.equal(new Reader(s).string(), 'Bühne 1');
});

test('reading an amp lists every control with its role path and current value', async () => {
  for (const recursive of [true, false]) {
    const { server } = mockAmp({ recursive });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const dump = await readDevice('127.0.0.1', { port: server.address().port });
    server.close();
    assert.equal(dump.device.model, 'D80 (pretend)');
    assert.equal(dump.device.serial, 'PRETEND-0001');
    assert.equal(dump.device.treeMethod, recursive ? 'GetMembersRecursive' : 'GetMembers');
    const mute = dump.objects.find((o) => o.path === 'Channel B/Mute');
    assert.equal(mute.className, 'OcaMute');
    assert.equal(mute.value, 'unmuted');
    assert.deepEqual(dump.objects.find((o) => o.path === 'Channel A/Gain').value, { value: 0, min: -57.5, max: 6 });
    const input = dump.objects.find((o) => o.path === 'Channel C/Input');
    assert.equal(input.value.position, 2);
    assert.equal(input.positionNames[2], 'A3');
    assert.equal(dump.objects.find((o) => o.path === 'Channel D/Name').value, 'Ch D');
    assert.deepEqual(summarise(dump), { name: 'Amp on the bench', model: 'd&b audiotechnik D80 (pretend)', objects: 20, mutes: 4, gains: 4, switches: 4, names: 4 });
  }
});

test('an amp that is not there gives a plain error', async () => {
  const { server } = mockAmp();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  server.close();
  await assert.rejects(readDevice('127.0.0.1', { port }), /refused AES70/);
});
