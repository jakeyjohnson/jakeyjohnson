// Offline licence keys: licence number + optional end day.
// Short: SB-XXXXX-XXXXX-XXXXX-XXXXX (default). Long: KK1-..., Ed25519 signed (--long).
import { createHmac, createPrivateKey, createPublicKey, sign, timingSafeEqual, verify } from 'node:crypto';

export const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA+tNlQN3GmMERzetmGdKhrZX7p6NiPJDomdXsp6iu40s=
-----END PUBLIC KEY-----
`;
export const PRODUCT = 'SB'; // Show Builder
export const SHORT_SECRET = Buffer.from('EYxDZDkN91gBY7OARYBQAJchs1QhyQSRrjPlN4Ng1mg=', 'base64');
const EPOCH = Date.UTC(2024, 0, 1);
const DAY = 86400000;
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford: no I, L, O or U to misread

function base32(bytes) {
  let bits = 0,
    value = 0,
    out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}
function unbase32(text) {
  const clean = text
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  let bits = 0,
    value = 0;
  const out = [];
  for (const ch of clean) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) return null;
    value = ((value << 5) | v) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
const toDay = (date) => (date ? Math.floor((new Date(date).getTime() - EPOCH) / DAY) : 0);
const fromDay = (n) => (n ? new Date(EPOCH + n * DAY).toISOString().slice(0, 10) : null);
export const licenceNumber = (serial) => `KK-${PRODUCT}-${String(serial).padStart(4, '0')}`;

// Long key: Ed25519 over the 9-byte payload, 120 chars since the sig alone is 64 bytes.
// Private key is kept out of this repo; issuing tool and tests only.
export function makeKey({ serial, issued = new Date(), expires = null }, privateKeyPem) {
  const payload = Buffer.alloc(9);
  payload.writeUInt8(1, 0);
  payload.write(PRODUCT, 1, 'ascii');
  payload.writeUInt16BE(serial, 3);
  payload.writeUInt16BE(toDay(issued), 5);
  payload.writeUInt16BE(toDay(expires), 7);
  const sig = sign(null, payload, createPrivateKey(privateKeyPem));
  const body = base32(Buffer.concat([payload, sig]));
  return `KK1-${body.match(/.{1,6}/g).join('-')}`;
}

// ---- Short keys: 100 bits = licence number (14) + end day (16, 0 = never) + check (70) ----
// Check is an HMAC with SHORT_SECRET, which ships in the app, so anyone who extracts it can mint keys.
// Keeps honest people honest.
const SHORT_LEN = 20;
const shortCheck = (payload, secret) => {
  const mac = createHmac('sha256', secret)
    .update(`${PRODUCT}:${payload.toString(16)}`)
    .digest();
  return BigInt(`0x${mac.subarray(0, 9).toString('hex')}`) >> 2n; // 72 bits down to 70
};
// Payload XORed with a mask from the check, so keys don't all start the same
const shortMask = (check, secret) =>
  BigInt(
    `0x${createHmac('sha256', secret)
      .update(`mask:${check.toString(16)}`)
      .digest()
      .subarray(0, 4)
      .toString('hex')}`,
  ) >> 2n; // 30 bits
export function makeShortKey({ serial, expires = null }, secret = SHORT_SECRET) {
  if (!(serial >= 1 && serial < 2 ** 14)) throw new Error('Licence numbers run from 1 to 16383');
  const payload = (BigInt(serial) << 16n) | BigInt(toDay(expires));
  const check = shortCheck(payload, secret);
  let value = ((payload ^ shortMask(check, secret)) << 70n) | check;
  let body = '';
  for (let i = 0; i < SHORT_LEN; i++) {
    body = ALPHABET[Number(value & 31n)] + body;
    value >>= 5n;
  }
  return `${PRODUCT}-${body.match(/.{5}/g).join('-')}`;
}
function checkShortKey(key, secret, today) {
  const body = normaliseKey(key)
    .slice(PRODUCT.length + 1)
    .replace(/-/g, '');
  if (body.length < SHORT_LEN)
    return { ok: false, error: 'That key is incomplete. It has 20 letters and numbers after SB.' };
  if (body.length > SHORT_LEN)
    return { ok: false, error: 'That key is too long. It has 20 letters and numbers after SB.' };
  let value = 0n;
  for (const ch of body) value = (value << 5n) | BigInt(ALPHABET.indexOf(ch));
  const check = value & ((1n << 70n) - 1n);
  const payload = (value >> 70n) ^ shortMask(check, secret);
  const want = Buffer.from(shortCheck(payload, secret).toString(16).padStart(18, '0'), 'hex');
  const got = Buffer.from(check.toString(16).padStart(18, '0'), 'hex');
  if (!timingSafeEqual(want, got))
    return { ok: false, error: "That key isn't valid. Check each letter and number." };
  const serial = Number(payload >> 16n);
  const expires = fromDay(Number(payload & 0xffffn));
  if (expires && new Date(`${expires}T23:59:59Z`) < today)
    return { ok: false, error: `That licence ended on ${expires}.` };
  return { ok: true, licence: licenceNumber(serial), serial, issued: null, expires };
}

// Short or long. { ok, licence, issued, expires } or { ok: false, error }
export function checkKey(key, publicKeyPem = PUBLIC_KEY, today = new Date(), secret = SHORT_SECRET) {
  const text = String(key || '').trim();
  if (/^SB[\s-]*[0-9A-Z]/i.test(text)) return checkShortKey(text, secret, today);
  if (!/^KK1/i.test(text)) return { ok: false, error: "That isn't a KobiKraken licence key. It starts SB-." };
  const bytes = unbase32(normaliseKey(key).slice(4));
  if (!bytes || bytes.length < 73)
    return { ok: false, error: 'That key is incomplete. Paste the whole thing.' };
  const payload = bytes.subarray(0, 9);
  const sig = bytes.subarray(9, 73);
  let good = false;
  try {
    good = verify(null, payload, createPublicKey(publicKeyPem), sig);
  } catch {
    good = false;
  }
  if (!good || payload.readUInt8(0) !== 1)
    return { ok: false, error: "That key isn't valid. Check it was pasted in full." };
  if (payload.toString('ascii', 1, 3) !== PRODUCT)
    return { ok: false, error: 'That key is for a different KobiKraken tool.' };
  const serial = payload.readUInt16BE(3);
  const expires = fromDay(payload.readUInt16BE(7));
  if (expires && new Date(`${expires}T23:59:59Z`) < today)
    return { ok: false, error: `That licence ended on ${expires}.` };
  return {
    ok: true,
    licence: licenceNumber(serial),
    serial,
    issued: fromDay(payload.readUInt16BE(5)),
    expires,
  };
}

// Ignore dashes, spaces and case; O reads as 0, I and L as 1
export const normaliseKey = (key) => {
  const text = String(key || '')
    .trim()
    .toUpperCase();
  if (/^SB[\s-]*[0-9A-Z]/.test(text)) {
    const body = text
      .replace(/^SB[\s-]*/, '')
      .replace(/[^0-9A-Z]/g, '')
      .replace(/O/g, '0')
      .replace(/[IL]/g, '1');
    return `${PRODUCT}-${(body.match(/.{1,5}/g) || []).join('-')}`;
  }
  const body = text.replace(/^KK1[\s-]*/, '').replace(/[^0-9A-Z]/g, '');
  return `KK1-${(body.match(/.{1,6}/g) || []).join('-')}`;
};
