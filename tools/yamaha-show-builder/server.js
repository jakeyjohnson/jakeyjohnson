// Serves the web app and relays commands to the desk over Yamaha's TCP remote protocol.
// Browsers cannot open raw TCP sockets, which is why this bridge exists.
import http from 'node:http';
import net from 'node:net';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AI_SCHEMA, aiPrompt, normalizeSuggestion } from './public/plan.js';

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

// Asks Claude to turn a plain-English request ("full band with 4 vocals") into inputs and zones.
// The SDK loads on first use so the rest of the app runs without `npm install`.
async function suggest(body) {
  const request = String(body.request || '').trim().slice(0, 2000);
  if (!request) throw new Error('Describe what you want to add first.');
  let Anthropic, betaJSONSchemaOutputFormat;
  try {
    ({ default: Anthropic } = await import('@anthropic-ai/sdk'));
    ({ betaJSONSchemaOutputFormat } = await import('@anthropic-ai/sdk/helpers/beta/json-schema'));
  } catch {
    throw new Error('The AI builder needs the Anthropic SDK: run "npm install" in this folder, then restart.');
  }
  // Only names and the name length go to Claude, not the whole show
  const show = {
    options: { maxNameLength: Number(body.show?.options?.maxNameLength) || 8 },
    sources: (Array.isArray(body.show?.sources) ? body.show.sources : []).slice(0, 300).map((s) => ({ name: String(s?.name ?? '').slice(0, 32) })),
  };
  let message;
  try {
    const client = new Anthropic();
    message = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [{ role: 'user', content: aiPrompt(request, show) }],
      output_config: { format: betaJSONSchemaOutputFormat(AI_SCHEMA) },
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new Error('Claude rejected the API key. Check ANTHROPIC_API_KEY and restart.');
    if (err instanceof Anthropic.RateLimitError) throw new Error('Claude is busy or you hit your rate limit. Try again in a minute.');
    if (err instanceof Anthropic.APIConnectionError) throw new Error('Could not reach Claude. Check this computer has internet access.');
    if (err instanceof Anthropic.APIError) throw new Error(`Claude returned an error: ${err.message}`);
    if (/auth|api key|apiKey/i.test(String(err?.message))) {
      throw new Error('No Claude API key found. Start the app with ANTHROPIC_API_KEY=... npm start (see README).');
    }
    throw err;
  }
  if (message.stop_reason === 'refusal') throw new Error('Claude declined that request. Try describing the inputs differently.');
  if (!message.parsed_output) throw new Error('Claude did not return a usable list. Try again or reword the request.');
  return normalizeSuggestion(message.parsed_output);
}

async function handleApi(req, res, path) {
  const body = await readJson(req);

  if (path === '/api/suggest') {
    const suggestion = await suggest(body);
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify(suggestion));
  }

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
