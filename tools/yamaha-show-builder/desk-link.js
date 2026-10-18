// One live connection to a desk over Yamaha's remote protocol (TCP, port 49280 by default).
// Commands go one at a time and wait for the desk's OK or ERROR line; NOTIFY lines from the desk are
// ignored. Every change of state is emitted as a 'status' event so the page can show it.
import net from 'node:net';
import { EventEmitter } from 'node:events';

const CONNECT_TIMEOUT_MS = 4000;
const REPLY_TIMEOUT_MS = 3000;
const CHECK_EVERY_MS = 5000;

function friendlyError(err, host, port) {
  switch (err.code) {
    case 'ECONNREFUSED': return `${host} refused the connection on port ${port}. Check it's a Yamaha desk and the port is right.`;
    case 'EHOSTUNREACH':
    case 'ENETUNREACH': return `Can't reach ${host}. Check this computer is on the same network as the desk.`;
    case 'ETIMEDOUT': return `No answer from ${host}. Check the IP and that the desk is switched on.`;
    default: return err.message;
  }
}

export class DeskLink extends EventEmitter {
  state = 'idle'; // idle | connecting | connected | lost
  host = null;
  port = null;
  product = null;
  error = null;
  #socket = null;
  #buffer = '';
  #waiting = null;
  #queue = Promise.resolve();
  #checker = null;

  status() {
    return { state: this.state, host: this.host, port: this.port, product: this.product, error: this.error };
  }

  #set(patch) {
    Object.assign(this, patch);
    this.emit('status', this.status());
  }

  async connect(host, port = 49280) {
    this.disconnect({ quiet: true });
    this.#set({ state: 'connecting', host, port, product: null, error: null });
    const socket = net.createConnection({ host, port });
    this.#socket = socket;
    socket.setEncoding('utf8');
    socket.setNoDelay(true);
    socket.setKeepAlive(true, CHECK_EVERY_MS);
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })), CONNECT_TIMEOUT_MS);
        socket.once('connect', () => { clearTimeout(timer); resolve(); });
        socket.once('error', (err) => { clearTimeout(timer); reject(err); });
      });
    } catch (err) {
      socket.destroy();
      if (this.#socket === socket) {
        this.#socket = null;
        this.#set({ state: 'idle', error: friendlyError(err, host, port) });
      }
      throw new Error(friendlyError(err, host, port));
    }

    socket.on('data', (chunk) => this.#onData(chunk));
    socket.on('error', () => {}); // a 'close' always follows
    socket.on('close', () => {
      if (this.#socket !== socket) return; // closed on purpose
      this.#socket = null;
      this.#lost(`Lost the connection to ${host}.`);
    });

    // Ask the desk what it is. A device that accepts the connection but doesn't speak the protocol isn't a desk.
    const reply = await this.send('devinfo productname');
    if (!reply.startsWith('OK')) {
      this.disconnect({ quiet: true });
      const error = `Something answered at ${host}, but it isn't replying like a Yamaha desk.`;
      this.#set({ state: 'idle', error });
      throw new Error(error);
    }
    this.#set({ state: 'connected', product: /"([^"]*)"/.exec(reply)?.[1] || null });
    // A quiet check every few seconds, so a pulled cable shows up even when nothing is being sent
    this.#checker = setInterval(async () => {
      if ((await this.send('devinfo productname')) === 'TIMEOUT') this.#socket?.destroy();
    }, CHECK_EVERY_MS);
    return this.status();
  }

  disconnect({ quiet = false } = {}) {
    clearInterval(this.#checker);
    const socket = this.#socket;
    this.#socket = null;
    socket?.end();
    socket?.destroy();
    this.#release('NOT CONNECTED');
    if (!quiet) this.#set({ state: 'idle', error: null });
  }

  // Sends one command and resolves with the desk's reply line, 'TIMEOUT', or 'NOT CONNECTED'
  send(cmd) {
    const run = () => new Promise((done) => {
      if (!this.#socket) return done('NOT CONNECTED');
      const timer = setTimeout(() => { this.#waiting = null; done('TIMEOUT'); }, REPLY_TIMEOUT_MS);
      this.#waiting = (line) => { clearTimeout(timer); done(line); };
      this.#socket.write(cmd + '\n');
    });
    const reply = this.#queue.then(run);
    this.#queue = reply.catch(() => {});
    return reply;
  }

  #onData(chunk) {
    this.#buffer += chunk;
    let nl;
    while ((nl = this.#buffer.indexOf('\n')) >= 0) {
      const line = this.#buffer.slice(0, nl).trim();
      this.#buffer = this.#buffer.slice(nl + 1);
      if (/^(OK|OKm|ERROR)\b/.test(line)) this.#release(line);
    }
  }

  #release(line) {
    const waiting = this.#waiting;
    this.#waiting = null;
    waiting?.(line);
  }

  #lost(error) {
    clearInterval(this.#checker);
    this.#release('NOT CONNECTED');
    this.#set({ state: 'lost', error });
  }
}
