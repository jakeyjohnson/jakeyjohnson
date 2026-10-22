import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { PUBLIC_KEY, checkKey, licenceNumber, makeKey, makeShortKey, normaliseKey } from '../lock.js';

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
  assert.match(checkKey('hello', pub).error, /starts SB-/);
  assert.match(checkKey(key, PUBLIC_KEY).error, /isn't valid/); // signed by someone else's private key
});

test('a key with an end date stops working after it', () => {
  const key = makeKey({ serial: 3, expires: '2027-06-30' }, priv);
  assert.equal(checkKey(key, pub, new Date('2027-06-30T12:00:00Z')).ok, true);
  assert.match(checkKey(key, pub, new Date('2027-07-01T00:00:01Z')).error, /ended on 2027-06-30/);
  assert.equal(licenceNumber(12), 'KK-SB-0012');
});

// A throwaway secret, so these don't depend on the one built into the app
const secret = Buffer.alloc(32, 7);
const today = new Date('2026-10-22');

test('short keys are 20 characters, check out however they are typed, and differ from each other', () => {
  const key = makeShortKey({ serial: 5 }, secret);
  assert.match(key, /^SB(-[0-9A-Z]{4}){5}$/);
  assert.ok(checkKey('SB-' + key.slice(3).replace(/-/g, '').match(/.{5}/g).join('-'), pub, today, secret).ok); // the old 5x4 grouping still reads
  assert.deepEqual(checkKey(key, pub, today, secret), {
    ok: true,
    licence: 'KK-SB-0005',
    serial: 5,
    issued: null,
    expires: null,
  });
  assert.ok(checkKey(` ${key.toLowerCase().replace(/-/g, ' ')} `, pub, today, secret).ok);
  assert.ok(checkKey(key.replace(/^SB-/, 'SB').replace(/0/g, 'O').replace(/1/g, 'I'), pub, today, secret).ok); // O for 0, I for 1
  assert.notEqual(makeShortKey({ serial: 6 }, secret).slice(0, 9), key.slice(0, 9));
  assert.equal(normaliseKey(key.replace(/-/g, '')), key);
});

test('a short key with a typo, missing a character or made elsewhere is turned down', () => {
  const key = makeShortKey({ serial: 9 }, secret);
  const typo = key.slice(0, 13) + (key[13] === 'A' ? 'B' : 'A') + key.slice(14);
  assert.match(checkKey(typo, pub, today, secret).error, /isn't valid/);
  assert.match(checkKey(key.slice(0, -1), pub, today, secret).error, /incomplete/);
  assert.match(checkKey(`${key}X`, pub, today, secret).error, /too long/);
  assert.match(
    checkKey(makeShortKey({ serial: 9 }, Buffer.alloc(32, 8)), pub, today, secret).error,
    /isn't valid/,
  );
});

test('a short key with an end date stops after it', () => {
  const key = makeShortKey({ serial: 12, expires: '2027-06-30' }, secret);
  assert.equal(checkKey(key, pub, new Date('2027-06-30T12:00:00Z'), secret).expires, '2027-06-30');
  assert.match(checkKey(key, pub, new Date('2027-07-01T00:00:01Z'), secret).error, /ended on 2027-06-30/);
  assert.throws(() => makeShortKey({ serial: 20000 }, secret), /1 to 16383/);
});
