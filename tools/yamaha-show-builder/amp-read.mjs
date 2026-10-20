// Reads a d&b (or any AES70) amplifier's control list and saves it to a file. Reading only: nothing on
// the amp is changed. Run: node amp-read.mjs 192.168.0.60   (add a port if it isn't 30013)
import { writeFileSync } from 'node:fs';
import { readDevice, summarise } from './oca-link.js';

const [host, port] = process.argv.slice(2);
if (!host) {
  console.error('Give the amp\'s IP: node amp-read.mjs 192.168.0.60');
  process.exit(1);
}
try {
  const dump = await readDevice(host, { port: Number(port) || undefined, onProgress: (n, total) => process.stdout.write(`\rReading ${n}/${total} controls`) });
  const s = summarise(dump);
  const file = `amp-${(s.model || 'device').replace(/[^\w.-]+/g, '-')}-${host}.json`;
  writeFileSync(file, JSON.stringify(dump, null, 2));
  console.log(`\n${s.model} "${s.name}": ${s.objects} objects, ${s.mutes} mutes, ${s.gains} gains, ${s.switches} switches. Saved ${file}`);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
