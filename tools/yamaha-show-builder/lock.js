// Licence keys. Each customer gets their own key, signed with KobiKraken's private key (kept off this repo,
// by Jakey). The app holds only the public key below, so it can check a key offline but can't make one.
//
// A key carries: product, licence number, the day it was issued and (optionally) the day it ends,
// plus a 64-byte Ed25519 signature over those, written in Crockford base32 with dashes.
import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';

export const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA+tNlQN3GmMERzetmGdKhrZX7p6NiPJDomdXsp6iu40s=
-----END PUBLIC KEY-----
`;
export const PRODUCT = 'SB'; // Show Builder
const EPOCH = Date.UTC(2024, 0, 1);
const DAY = 86400000;
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford: no I, L, O or U to misread

function base32(bytes) {
  let bits = 0, value = 0, out = '';
  for (const b of bytes) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}
function unbase32(text) {
  const clean = text.toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  let bits = 0, value = 0;
  const out = [];
  for (const ch of clean) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) return null;
    value = ((value << 5) | v) & 0xffff; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}
const toDay = (date) => (date ? Math.floor((new Date(date).getTime() - EPOCH) / DAY) : 0);
const fromDay = (n) => (n ? new Date(EPOCH + n * DAY).toISOString().slice(0, 10) : null);
export const licenceNumber = (serial) => `KK-${PRODUCT}-${String(serial).padStart(4, '0')}`;

// Makes a key. Needs the private key, so only the issuing tool and the tests call this.
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

// Checks a key. Returns { ok, licence, issued, expires } or { ok: false, error } in plain words.
export function checkKey(key, publicKeyPem = PUBLIC_KEY, today = new Date()) {
  if (!/^\s*KK1/i.test(String(key || ''))) return { ok: false, error: "That isn't a KobiKraken licence key. It starts KK1-." };
  const bytes = unbase32(normaliseKey(key).slice(4));
  if (!bytes || bytes.length < 73) return { ok: false, error: 'That key is incomplete. Paste the whole thing.' };
  const payload = bytes.subarray(0, 9);
  const sig = bytes.subarray(9, 73);
  let good = false;
  try { good = verify(null, payload, createPublicKey(publicKeyPem), sig); } catch { good = false; }
  if (!good || payload.readUInt8(0) !== 1) return { ok: false, error: "That key isn't valid. Check it was pasted in full." };
  if (payload.toString('ascii', 1, 3) !== PRODUCT) return { ok: false, error: "That key is for a different KobiKraken tool." };
  const serial = payload.readUInt16BE(3);
  const expires = fromDay(payload.readUInt16BE(7));
  if (expires && new Date(`${expires}T23:59:59Z`) < today) return { ok: false, error: `That licence ended on ${expires}.` };
  return { ok: true, licence: licenceNumber(serial), serial, issued: fromDay(payload.readUInt16BE(5)), expires };
}

// The same key typed with or without dashes, spaces or lower case is the same key
export const normaliseKey = (key) => {
  const body = String(key || '').trim().replace(/^KK1[\s-]*/i, '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  return `KK1-${(body.match(/.{1,6}/g) || []).join('-')}`;
};
