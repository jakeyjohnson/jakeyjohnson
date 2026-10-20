// A pretend Shure receiver for testing without hardware: answers SET and GET for name, frequency and gain,
// its model and device ID, and flashes on request.
// Run with: node mock-shure.js   (SHURE_PORT to change the port, SHURE_MODEL for the model it reports)
import net from 'node:net';

export function mockShure({ model = process.env.SHURE_MODEL || 'ULXD4Q', channels = 4, deviceId = process.env.SHURE_ID || 'RX1' } = {}) {
  const flashes = [];
  const state = {};
  for (let ch = 1; ch <= channels; ch++) state[ch] = { CHAN_NAME: `{${`CH${ch}`.padEnd(31)}}`, FREQUENCY: '470000', AUDIO_GAIN: '018' };
  const server = net.createServer((socket) => {
    let buf = '';
    socket.setEncoding('utf8');
    socket.on('data', (chunk) => {
      buf += chunk;
      let m;
      while ((m = /<\s*(GET|SET)\s+([^>]*?)\s*>/.exec(buf))) {
        buf = buf.slice(m.index + m[0].length);
        const [verb, rest] = [m[1], m[2]];
        if (/^MODEL$/.test(rest)) { socket.write(`< REP MODEL {${model.padEnd(32)}} >`); continue; }
        if (/^DEVICE_ID$/.test(rest)) { socket.write(`< REP DEVICE_ID {${deviceId.padEnd(31)}} >`); continue; }
        if (/^FLASH ON$/.test(rest) && verb === 'SET') { flashes.push(Date.now()); socket.write('< REP FLASH ON >'); continue; }
        const p = /^(\d)\s+(\w+)\s*(.*)$/.exec(rest);
        if (!p || !state[p[1]] || !(p[2] in state[p[1]])) { socket.write(`< REP ERR >`); continue; }
        const [, ch, param, value] = p;
        if (verb === 'SET') {
          state[ch][param] = param === 'CHAN_NAME' ? `{${value.replace(/[{}]/g, '').padEnd(31)}}` : param === 'AUDIO_GAIN' ? value.padStart(3, '0') : value.padStart(6, '0');
        }
        socket.write(`< REP ${ch} ${param} ${state[ch][param]} >`);
      }
    });
  });
  return { server, state, flashes };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.SHURE_PORT || 2202);
  mockShure().server.listen(port, '127.0.0.1', () => console.log(`Pretend Shure receiver on 127.0.0.1:${port}`));
}
