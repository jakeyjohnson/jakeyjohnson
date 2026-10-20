import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { PUBLIC_KEY, checkKey, licenceNumber, makeKey, normaliseKey } from '../lock.js';

// A throwaway key pair, so the tests never need KobiKraken's real private key
const pair = generateKeyPairSync('ed25519');
const priv = pair.privateKey.export({ type: 'pkcs8', format: 'pem' });
const pub = pair.publicKey.export({ type: 'spki', format: 'pem' });

test('a key made with the private key checks out, however it is typed', () => {
  const key = makeKey({ serial: 42, issued: '2026-10-20' }, priv);
  assert.match(key, /^KK1-[0-9A-Z]{6}(-[0-9A-Z]{1,6})+$/);
  const ok = checkKey(key, pub);
  assert.deepEqual(ok, { ok: true, licence: 'KK-SB-0042', serial: 42, issued: '2026-10-20', expires: null });
  assert.ok(checkKey(key.toLowerCase().replace(/-/g, ' '), pub).ok);
  assert.equal(normaliseKey(` ${key.replace(/-/g, '')} `), key);
});

test('a changed, cut-short or foreign key is turned down', () => {
  const key = makeKey({ serial: 7 }, priv);
  const flipped = key.slice(0, 10) + (key[10] === 'A' ? 'B' : 'A') + key.slice(11);
  assert.match(checkKey(flipped, pub).error, /isn't valid/);
  assert.match(checkKey(key.slice(0, 40), pub).error, /incomplete/);
  assert.match(checkKey('hello', pub).error, /starts KK1/);
  assert.match(checkKey(key, PUBLIC_KEY).error, /isn't valid/); // signed by someone else's private key
});

test('a key with an end date stops working after it', () => {
  const key = makeKey({ serial: 3, expires: '2027-06-30' }, priv);
  assert.equal(checkKey(key, pub, new Date('2027-06-30T12:00:00Z')).ok, true);
  assert.match(checkKey(key, pub, new Date('2027-07-01T00:00:01Z')).error, /ended on 2027-06-30/);
  assert.equal(licenceNumber(12), 'KK-SB-0012');
});
