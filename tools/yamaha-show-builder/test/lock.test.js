import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPassword, makeLock, tokenFor, tokenMatches } from '../lock.js';

test('the password is checked against its hash, never stored', () => {
  const lock = makeLock('KRAKEN-TEST-1234', 'KK-SB-0001');
  assert.equal(lock.licence, 'KK-SB-0001');
  assert.ok(!JSON.stringify(lock).includes('KRAKEN'));
  assert.ok(checkPassword(lock, 'KRAKEN-TEST-1234'));
  assert.ok(!checkPassword(lock, 'kraken-test-1234'));
  assert.ok(!checkPassword(lock, ''));
  assert.ok(!checkPassword(lock, undefined));
});

test('the unlock key matches only its own password, and no lock means open', () => {
  const a = makeLock('first-password', 'KK-SB-0001');
  const b = makeLock('second-password', 'KK-SB-0001');
  assert.ok(tokenMatches(a, tokenFor(a)));
  assert.ok(!tokenMatches(a, tokenFor(b)));
  assert.ok(!tokenMatches(a, ''));
  assert.ok(!tokenMatches(a, undefined));
  assert.ok(tokenMatches(null, undefined));
  assert.ok(checkPassword(null, 'anything'));
});
