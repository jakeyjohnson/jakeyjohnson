import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { once } from 'node:events';
import { DeskLink } from '../desk-link.js';

// A tiny pretend desk on a random local port
async function fakeDesk({ product = 'QL5', speaks = true } = {}) {
  const sockets = new Set();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.setEncoding('utf8');
    socket.on('data', (chunk) => {
      for (const line of chunk.split('\n').filter(Boolean)) {
        if (!speaks) continue;
        if (line.startsWith('devinfo')) socket.write(`NOTIFY something\nOK devinfo productname "${product}"\n`);
        else socket.write(`OK ${line}\n`);
      }
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    port: server.address().port,
    dropAll: () => sockets.forEach((s) => s.destroy()),
    close: () => new Promise((r) => { sockets.forEach((s) => s.destroy()); server.close(r); }),
  };
}

test('connects, reads the desk name and sends commands', async () => {
  const desk = await fakeDesk({ product: 'QL5' });
  const link = new DeskLink();
  const states = [];
  link.on('status', (s) => states.push(s.state));
  const status = await link.connect('127.0.0.1', desk.port);
  assert.equal(status.state, 'connected');
  assert.equal(status.product, 'QL5');
  assert.equal(await link.send('set MIXER:Current/InCh/Fader/On 0 0 1'), 'OK set MIXER:Current/InCh/Fader/On 0 0 1');
  link.disconnect();
  assert.deepEqual(states, ['connecting', 'connected', 'idle']);
  assert.equal(await link.send('set x'), 'NOT CONNECTED');
  await desk.close();
});

test('notices when the desk goes away', async () => {
  const desk = await fakeDesk();
  const link = new DeskLink();
  await link.connect('127.0.0.1', desk.port);
  const lost = once(link, 'status');
  desk.dropAll();
  const [status] = await lost;
  assert.equal(status.state, 'lost');
  assert.match(status.error, /Lost the connection to 127\.0\.0\.1/);
  link.disconnect();
  await desk.close();
});

test('explains a refused connection', async () => {
  const desk = await fakeDesk();
  const { port } = desk;
  await desk.close(); // nothing listening there now
  const link = new DeskLink();
  await assert.rejects(link.connect('127.0.0.1', port), /refused the connection/);
  assert.equal(link.status().state, 'idle');
});

test('rejects a device that does not talk like a desk', async () => {
  const desk = await fakeDesk({ speaks: false });
  const link = new DeskLink();
  await assert.rejects(link.connect('127.0.0.1', desk.port), /isn't replying like a Yamaha desk/);
  assert.equal(link.status().state, 'idle');
  await desk.close();
});
