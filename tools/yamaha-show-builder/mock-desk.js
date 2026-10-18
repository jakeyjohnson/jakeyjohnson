// A pretend Yamaha desk for testing without hardware. Answers like the real remote protocol
// and prints every command it receives, then a summary of channel names on exit.
import net from 'node:net';

const PORT = Number(process.env.DESK_PORT || 49280);
const state = new Map();

net.createServer((socket) => {
  console.log('Client connected');
  let buffer = '';
  socket.setEncoding('utf8');
  socket.on('data', (chunk) => {
    buffer += chunk;
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      console.log('>', line);
      const [verb, addr, x, y, ...rest] = line.split(' ');
      if (verb === 'devinfo') socket.write(`OK devinfo ${addr} "MockDesk"\n`);
      else if (verb === 'set' && addr?.startsWith('MIXER:')) {
        state.set(`${addr} ${x} ${y}`, rest.join(' '));
        socket.write(`OK ${line}\n`);
      } else if (verb === 'get') socket.write(`OK ${line} ${state.get(`${addr} ${x} ${y}`) ?? 0}\n`);
      else socket.write(`ERROR ${verb} UnknownCommand\n`);
    }
  });
}).listen(PORT, () => console.log(`Mock desk listening on 127.0.0.1:${PORT}`));

process.on('SIGINT', () => {
  const names = [...state].filter(([k]) => k.includes('Label/Name'));
  console.log('\nNames on the mock desk:');
  for (const [k, v] of names) console.log(' ', k.replace('MIXER:Current/', ''), v);
  process.exit(0);
});
