import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mockShure } from '../mock-shure.js';
import { allowedShureLine, shureDevice, shureSession } from '../rf-link.js';
import { shureMatches, shureReadback } from '../public/rig.js';

test('the bridge only sends name, frequency and gain lines', () => {
  assert.ok(allowedShureLine('SET 1 CHAN_NAME {Lect 1}'));
  assert.ok(allowedShureLine('SET 4 FREQUENCY 606525'));
  assert.ok(allowedShureLine('GET 2 AUDIO_GAIN'));
  assert.ok(!allowedShureLine('SET 1 RF_TX_LVL HIGH'));
  assert.ok(!allowedShureLine('SET 1 CHAN_NAME {x} > < SET 1 AUDIO_MUTE ON'));
});

test('a receiver takes the lines and reads them back', async () => {
  const { server, state } = mockShure();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  const lines = ['SET 1 CHAN_NAME {HH 1}', 'SET 1 FREQUENCY 606500', 'SET 1 AUDIO_GAIN 0'];
  const sent = await shureSession('127.0.0.1', lines, { port });
  assert.equal(sent.error, undefined);
  assert.ok(sent.replies.every((r) => r.startsWith('< REP 1')));
  assert.equal(state[1].AUDIO_GAIN, '000');
  const check = await shureSession('127.0.0.1', lines.map(shureReadback), { port });
  assert.ok(lines.every((l, i) => shureMatches(l, check.replies[i])));
  server.close();
  const gone = await shureSession('127.0.0.1', lines, { port });
  assert.match(gone.error, /refused/);
});

test('a Shure unit says who it is, and flashes when asked', async () => {
  const { server, flashes } = mockShure({ deviceId: 'SR rack 1' });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  const who = await shureDevice('127.0.0.1', { port });
  assert.deepEqual([who.model, who.name, who.flashed], ['ULXD4Q', 'SR rack 1', false]);
  assert.equal((await shureDevice('127.0.0.1', { port, flash: true })).flashed, true);
  assert.equal(flashes.length, 1);
  server.close();
});
