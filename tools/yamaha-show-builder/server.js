// Serves the web app and relays commands to the desk over Yamaha's TCP remote protocol.
// Browsers cannot open raw TCP sockets, which is why this bridge exists.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LICENCE, PRODUCT, VERSION } from './public/about.js';
import { DeskLink } from './desk-link.js';
import { matchesReadback, readbackCommand } from './public/plan.js';

const PORT = Number(process.env.PORT || 8080);
const PUBLIC = fileURLToPath(new URL('./public/', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

// Only talk to devices on the local network, so the bridge can't be used as an open proxy
function isLocalHost(host) {
  if (host === 'localhost') return true;
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254);
}

// The one desk this app is connected to. Every open page hears its status over /api/events.
const link = new DeskLink();
const listeners = new Set();
link.on('status', (status) => {
  for (const res of listeners) res.write(`data: ${JSON.stringify(status)}\n\n`);
});

async function readJson(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  return JSON.parse(body || '{}');
}

function target(body) {
  const host = String(body.host || '').trim();
  const port = Number(body.port || 49280);
  if (!isLocalHost(host)) throw new Error("That isn't a local network address. Use the desk's IP, like 192.168.0.128.");
  return { host, port };
}

const json = (res, data, status = 200) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(data));
};

async function handleApi(req, res, path) {
  if (req.method === 'GET' && path === '/api/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify(link.status())}\n\n`);
    listeners.add(res);
    req.on('close', () => listeners.delete(res));
    return;
  }
  if (req.method !== 'POST') return res.writeHead(404).end();
  const body = await readJson(req);

  if (path === '/api/connect') {
    const { host, port } = target(body);
    return json(res, await link.connect(host, port));
  }

  if (path === '/api/disconnect') {
    link.disconnect();
    return json(res, link.status());
  }

  if (path === '/api/push') {
    if (link.state !== 'connected') throw new Error('Connect to the desk first, at the top of the page.');
    // Settings and the scene backup only: nothing that could recall or delete anything on the desk
    const commands = Array.isArray(body.commands) ? body.commands.filter((c) => /^(set (MIXER|IO):Current\/|ssupdatet?_ex )/.test(c)) : [];
    // Stream one JSON line per command so the page can show progress
    res.writeHead(200, { 'content-type': 'application/x-ndjson' });
    let errors = 0;
    for (const [i, cmd] of commands.entries()) {
      const reply = await link.send(cmd);
      if (reply === 'NOT CONNECTED') {
        return res.end(JSON.stringify({ error: `Lost the desk after ${i} of ${commands.length} lines. Reconnect and push again.` }) + '\n');
      }
      const ok = reply.startsWith('OK');
      if (!ok) errors++;
      res.write(JSON.stringify({ i, total: commands.length, cmd, reply, ok }) + '\n');
    }
    return res.end(JSON.stringify({ done: true, total: commands.length, errors }) + '\n');
  }

  if (path === '/api/verify') {
    if (link.state !== 'connected') throw new Error('Connect to the desk first, at the top of the page.');
    const commands = Array.isArray(body.commands) ? body.commands.filter((c) => readbackCommand(c)) : [];
    // Read every setting back and report the ones the desk doesn't hold
    res.writeHead(200, { 'content-type': 'application/x-ndjson' });
    let wrong = 0;
    for (const [i, cmd] of commands.entries()) {
      const reply = await link.send(readbackCommand(cmd));
      if (reply === 'NOT CONNECTED') return res.end(JSON.stringify({ error: 'Lost the desk while checking. Reconnect and check again.' }) + '\n');
      const ok = matchesReadback(cmd, reply);
      if (!ok) wrong++;
      res.write(JSON.stringify({ i, total: commands.length, cmd, reply, ok }) + '\n');
    }
    return res.end(JSON.stringify({ done: true, total: commands.length, wrong }) + '\n');
  }

  if (path === '/api/cue') {
    if (link.state !== 'connected') throw new Error('Connect to the desk first, at the top of the page.');
    const commands = Array.isArray(body.commands) ? body.commands.filter((c) => /^set MIXER:Current\/Cue\/InCh\/On \d+ \d+ [01]$/.test(c)).slice(0, 4) : [];
    const replies = [];
    for (const cmd of commands) replies.push(await link.send(cmd));
    return json(res, { replies });
  }

  res.writeHead(404).end();
}

http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  try {
    if (path.startsWith('/api/')) return await handleApi(req, res, path);
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
  console.log(`KobiKlang ${PRODUCT} v${VERSION} (licence ${LICENCE}) running: open http://localhost:${PORT}`);
  console.log('Other devices on this network can use http://<this computer\'s IP>:' + PORT);
});
