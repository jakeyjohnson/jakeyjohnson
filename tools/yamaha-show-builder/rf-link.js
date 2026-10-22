// Shure receivers (command strings, TCP 2202) and Sennheiser Spectera (HTTPS, SSCv2).
// Only the settings the app makes are allowed.
import https from 'node:https';
import net from 'node:net';

export const SHURE_PORT = Number(process.env.SHURE_PORT || 2202);
// Allowed Shure lines: channel name, frequency, gain, and their GETs
const SHURE_LINE = /^(SET \d \w+ (\{[^{}<>]{0,31}\}|\d{1,6})|GET \d \w+)$/;
const SHURE_PARAMS = /^(SET|GET) \d (CHAN_NAME|FREQUENCY|AUDIO_GAIN)\b/;
export function allowedShureLine(line) {
  return SHURE_LINE.test(line) && SHURE_PARAMS.test(line);
}

// Waits for the matching REP (channel + parameter) after each line
export function shureSession(host, lines, { port = SHURE_PORT, timeoutMs = 1500, onReply = () => {} } = {}) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let buffer = '';
    let waiting = null;
    const replies = [];
    const finish = (error) => {
      socket.destroy();
      resolve({ replies, error });
    };
    socket.setEncoding('utf8');
    socket.setTimeout(4000, () =>
      finish(`No answer from ${host}. Check its IP and that it's on this network.`),
    );
    socket.on('error', (err) =>
      finish(
        err.code === 'ECONNREFUSED'
          ? `${host} refused the connection on port ${port}.`
          : `Couldn't reach ${host} (${err.code || err.message}).`,
      ),
    );
    socket.on('data', (chunk) => {
      buffer += chunk;
      let m;
      while ((m = /<[^>]*>/.exec(buffer))) {
        const msg = m[0];
        buffer = buffer.slice(m.index + msg.length);
        if (waiting && waiting.match.test(msg)) waiting.done(msg);
      }
    });
    socket.on('connect', async () => {
      socket.setTimeout(0);
      for (const [i, line] of lines.entries()) {
        const [, ch, param] = /^(?:SET|GET) (\d) (\w+)/.exec(line);
        const reply = await new Promise((done) => {
          const timer = setTimeout(() => done('TIMEOUT'), timeoutMs);
          waiting = {
            match: new RegExp(`<\\s*REP\\s+${ch}\\s+${param}\\b`),
            done: (msg) => {
              clearTimeout(timer);
              done(msg);
            },
          };
          socket.write(`< ${line} >`);
        });
        waiting = null;
        replies.push(reply);
        onReply(i, line, reply);
      }
      finish();
    });
  });
}

// Spectera: user "controlSennheiser" + base station password. Self-signed cert accepted (local addresses only).
const SPECTERA_WRITE = /^\/mts\/paired\/all\/\d+$/;
export function specteraRequest(host, password, method, path, body) {
  if (method !== 'GET' && !SPECTERA_WRITE.test(path))
    return Promise.reject(new Error('Not a setting the app changes.'));
  const data = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host,
        port: 443,
        method,
        path: `/api${path}`,
        rejectUnauthorized: false,
        timeout: 8000,
        headers: {
          Authorization: `Basic ${Buffer.from(`controlSennheiser:${password}`).toString('base64')}`,
          Accept: 'application/json',
          ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => {
          text += c;
        });
        res.on('end', () => {
          if (res.statusCode === 401)
            return reject(
              new Error("Spectera turned down the password. Check it in the base station's web page."),
            );
          if (res.statusCode >= 400)
            return reject(new Error(`Spectera said ${res.statusCode}: ${text.slice(0, 200)}`));
          try {
            resolve(text ? JSON.parse(text) : {});
          } catch {
            resolve({});
          }
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error(`No answer from the Spectera base station at ${host}.`)));
    req.on('error', (err) =>
      reject(
        new Error(
          err.code === 'ECONNREFUSED'
            ? `Nothing on HTTPS at ${host}. Turn on third-party access on the base station.`
            : err.message,
        ),
      ),
    );
    if (data) req.write(data);
    req.end();
  });
}

// Shure model + device ID (front panel name). flash also blinks the front panel.
export function shureDevice(host, { port = SHURE_PORT, timeoutMs = 2500, flash = false } = {}) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const got = {};
    let buffer = '';
    const finish = () => {
      clearTimeout(timer);
      socket.destroy();
      resolve({ host, model: got.MODEL || '', name: got.DEVICE_ID || '', flashed: Boolean(got.FLASH) });
    };
    const timer = setTimeout(
      () =>
        got.MODEL || got.DEVICE_ID
          ? finish()
          : (socket.destroy(),
            reject(new Error(`No answer from ${host}. Check its IP and that it's on this network.`))),
      timeoutMs,
    );
    socket.setEncoding('utf8');
    socket.on('error', (err) => {
      clearTimeout(timer);
      reject(
        new Error(
          err.code === 'ECONNREFUSED'
            ? `${host} refused the connection on port ${port}.`
            : `Couldn't reach ${host} (${err.code || err.message}).`,
        ),
      );
    });
    socket.on('data', (chunk) => {
      buffer += chunk;
      let m;
      while ((m = /<\s*REP\s+(MODEL|DEVICE_ID|FLASH)\s*\{?([^}>]*)\}?\s*>/.exec(buffer))) {
        buffer = buffer.slice(m.index + m[0].length);
        got[m[1]] = m[2].trim() || true;
      }
      if (got.MODEL && got.DEVICE_ID && (!flash || got.FLASH)) finish();
    });
    socket.on('connect', () =>
      socket.write(`< GET MODEL >< GET DEVICE_ID >${flash ? '< SET FLASH ON >' : ''}`),
    );
  });
}
