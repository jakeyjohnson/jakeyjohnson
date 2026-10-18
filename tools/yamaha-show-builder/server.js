// Serves the web app and relays commands to the desk over Yamaha's TCP remote protocol.
// Browsers cannot open raw TCP sockets, which is why this bridge exists.
import http from 'node:http';
import net from 'node:net';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT || 8080);
const PUBLIC = fileURLToPath(new URL('./public/', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const REPLY_TIMEOUT_MS = 3000;

// Only talk to devices on the local network, so the bridge can't be used as an open proxy
function isLocalHost(host) {
  if (host === 'localhost') return true;
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254);
}

// Opens a connection and returns send(cmd) -> Promise<reply line>. NOTIFY lines from the desk are ignored.
function connect(host, port) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port, timeout: 4000 });
    let buffer = '';
    let waiting = null;
    socket.setEncoding('utf8');
    socket.on('data', (chunk) => {
      buffer += chunk;
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (waiting && /^(OK|OKm|ERROR)\b/.test(line)) {
          const w = waiting;
          waiting = null;
          w(line);
        }
      }
    });
    socket.once('connect', () => {
      socket.setTimeout(0);
      resolve({
        send(cmd) {
          return new Promise((done) => {
            const timer = setTimeout(() => { waiting = null; done('TIMEOUT'); }, REPLY_TIMEOUT_MS);
            waiting = (line) => { clearTimeout(timer); done(line); };
            socket.write(cmd + '\n');
          });
        },
        close: () => socket.end(),
      });
    });
    socket.once('timeout', () => { socket.destroy(); reject(new Error(`No answer from ${host}:${port}`)); });
    socket.once('error', reject);
  });
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  return JSON.parse(body || '{}');
}

function target(body) {
  const host = String(body.host || '').trim();
  const port = Number(body.port || 49280);
  if (!isLocalHost(host)) throw new Error('Desk address must be a local network IP, e.g. 192.168.0.128');
  return { host, port };
}

async function handleApi(req, res, path) {
  const body = await readJson(req);
  const { host, port } = target(body);

  if (path === '/api/test') {
    const desk = await connect(host, port);
    const reply = await desk.send('devinfo productname');
    desk.close();
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: !reply.startsWith('ERROR') && reply !== 'TIMEOUT', reply }));
  }

  if (path === '/api/push') {
    const commands = Array.isArray(body.commands) ? body.commands.filter((c) => /^set MIXER:Current\//.test(c)) : [];
    const desk = await connect(host, port);
    // Stream one JSON line per command so the UI can show progress
    res.writeHead(200, { 'content-type': 'application/x-ndjson' });
    let errors = 0;
    for (const [i, cmd] of commands.entries()) {
      const reply = await desk.send(cmd);
      const ok = reply.startsWith('OK');
      if (!ok) errors++;
      res.write(JSON.stringify({ i, total: commands.length, cmd, reply, ok }) + '\n');
    }
    desk.close();
    return res.end(JSON.stringify({ done: true, total: commands.length, errors }) + '\n');
  }

  res.writeHead(404).end();
}

http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  try {
    if (req.method === 'POST' && path.startsWith('/api/')) return await handleApi(req, res, path);
    const file = normalize(join(PUBLIC, path === '/' ? 'index.html' : path));
    if (!file.startsWith(PUBLIC)) return res.writeHead(403).end();
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch (err) {
    if (res.headersSent) return res.end(JSON.stringify({ error: err.message }) + '\n');
    const status = err.code === 'ENOENT' ? 404 : 400;
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}).listen(PORT, () => {
  console.log(`Show builder running: open http://localhost:${PORT}`);
  console.log('Other devices on this network can use http://<this computer\'s IP>:' + PORT);
});
