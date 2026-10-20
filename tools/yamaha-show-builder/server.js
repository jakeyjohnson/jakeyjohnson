// Serves the web app and relays commands to the desk over Yamaha's TCP remote protocol.
// Browsers cannot open raw TCP sockets, which is why this bridge exists.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LICENCE, PRODUCT, VERSION } from './public/about.js';
import { DeskLink } from './desk-link.js';
import { discover, localTargets } from './discover.js';
import { allowedShureLine, shureSession, specteraRequest } from './rf-link.js';
import { checkKey, normaliseKey } from './lock.js';
import { readDevice } from './oca-link.js';
import { shureMatches, shureReadback } from './public/rig.js';
import { matchesReadback, readbackCommand } from './public/plan.js';

const PORT = Number(process.env.PORT || 8080);
const PUBLIC = fileURLToPath(new URL('./public/', import.meta.url));
// Every copy needs a licence key. KK_UNLOCKED=1 skips it, for development only.
const LOCKED = process.env.KK_UNLOCKED !== '1';
const goodKeys = new Map(); // keys already checked, so each request isn't re-verified
function keyCheck(key) {
  const k = normaliseKey(key);
  if (!goodKeys.has(k)) {
    const result = checkKey(k);
    if (!result.ok) return result;
    goodKeys.set(k, result);
  }
  return goodKeys.get(k);
}
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain' };

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
let scanning = null;
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
  if (req.method === 'GET' && path === '/api/lock') return json(res, { locked: LOCKED, product: PRODUCT });
  if (req.method !== 'POST') return res.writeHead(404).end();
  const body = await readJson(req);

  // Unlock: the licence key is checked here; the page then sends it with every request
  if (path === '/api/unlock') {
    const result = keyCheck(body.key);
    if (result.ok) return json(res, { token: normaliseKey(body.key), licence: result.licence, expires: result.expires });
    await new Promise((r) => setTimeout(r, 500));
    return json(res, { error: result.error }, 401);
  }
  // Nothing reaches the kit without a valid licence key
  const licence = LOCKED ? keyCheck(req.headers['x-kk-key']) : { ok: true, licence: LICENCE };
  if (!licence.ok) return json(res, { error: 'Locked. Enter your licence key to use the app.' }, 401);
  if (path === '/api/check') return json(res, { ok: true, licence: licence.licence, expires: licence.expires });

  if (path === '/api/connect') {
    const { host, port } = target(body);
    return json(res, await link.connect(host, port));
  }

  if (path === '/api/discover') {
    // One scan at a time; a second page asking while one runs gets the same answer
    if (!scanning) {
      const subnet = String(body.subnet || '').trim().replace(/\.(0\/24|\*)?$/, '');
      let hosts;
      if (subnet) {
        if (!/^\d+\.\d+\.\d+$/.test(subnet) || !isLocalHost(`${subnet}.1`)) throw new Error('Type a local network, like 192.168.1.');
        hosts = Array.from({ length: 254 }, (_, i) => `${subnet}.${i + 1}`);
      } else {
        // This computer too, for a desk editor or test desk running here
        hosts = [...localTargets().hosts, '127.0.0.1'];
      }
      scanning = discover({ hosts }).then((r) => ({ ...r, subnets: subnet ? [`${subnet}.0/24`] : localTargets().subnets }))
        .finally(() => { scanning = null; });
    }
    return json(res, await scanning);
  }

  if (path === '/api/shure') {
    // One receiver: send its lines (or, to check, read each one back) and stream each reply
    const { host } = target(body);
    const sets = (Array.isArray(body.lines) ? body.lines : []).filter(allowedShureLine);
    const lines = body.check ? sets.map(shureReadback).filter(Boolean) : sets;
    res.writeHead(200, { 'content-type': 'application/x-ndjson' });
    let bad = 0;
    const { error } = await shureSession(host, lines, {
      onReply: (i, line, reply) => {
        const ok = body.check ? shureMatches(sets[i], reply) : /^<\s*REP/.test(reply);
        if (!ok) bad++;
        res.write(JSON.stringify({ i, total: lines.length, line, reply, ok }) + '\n');
      },
    });
    return res.end(JSON.stringify(error ? { error } : { done: true, total: lines.length, bad }) + '\n');
  }

  if (path === '/api/amp/read') {
    // Reads an AES70 amp's whole control list (reading only, nothing is changed on the amp)
    const { host } = target(body);
    return json(res, await readDevice(host, { port: Number(body.port) || undefined }));
  }

  if (path === '/api/spectera/devices') {
    const { host } = target(body);
    const devices = await specteraRequest(host, String(body.password || ''), 'GET', '/mts/paired/all');
    return json(res, { devices: Array.isArray(devices) ? devices : [] });
  }

  if (path === '/api/spectera/push') {
    const { host } = target(body);
    const results = [];
    for (const w of Array.isArray(body.writes) ? body.writes : []) {
      try {
        await specteraRequest(host, String(body.password || ''), 'PUT', String(w.path), w.body);
        results.push({ path: w.path, ok: true });
      } catch (err) {
        results.push({ path: w.path, ok: false, error: err.message });
      }
    }
    return json(res, { results });
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

async function handle(req, res) {
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
}

// Starts the app server. The Mac app calls this with host 127.0.0.1 so only this computer can use it;
// `npm start` listens on every interface so a tablet on the same network can open the page too.
export function startServer({ port = PORT, host } = {}) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handle);
    server.once('error', reject);
    server.listen(port, host, () => resolve({ server, port: server.address().port, close: () => { link.disconnect(); server.close(); } }));
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startServer().then(({ port }) => {
    console.log(`KobiKraken ${PRODUCT} v${VERSION} (licence ${LICENCE}) running: open http://localhost:${port}`);
    console.log('Other devices on this network can use http://<this computer\'s IP>:' + port);
  });
}
