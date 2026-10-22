import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PREFS, cleanPrefix, expandIp, ipTail } from '../public/prefs.js';

test('an IP preset takes just the last number, and a full address still works', () => {
  assert.equal(expandIp('60', '192.168.1'), '192.168.1.60');
  assert.equal(expandIp(' 128 ', '192.168.0'), '192.168.0.128');
  assert.equal(expandIp('1.60', '10.0'), '10.0.1.60');
  assert.equal(expandIp('10.0.0.5', '192.168.1'), '10.0.0.5');
  assert.equal(expandIp('300', '192.168.1'), '300'); // not an address: left for the field to flag
  assert.equal(expandIp('60', ''), '60');
  assert.equal(ipTail('192.168.1.60', '192.168.1'), '60');
  assert.equal(ipTail('10.0.0.5', '192.168.1'), '10.0.0.5');
});

test('a preset is one to three numbers', () => {
  assert.equal(cleanPrefix('192.168.1.'), '192.168.1');
  assert.equal(cleanPrefix('10.0'), '10.0');
  assert.equal(cleanPrefix(''), '');
  assert.equal(cleanPrefix('192.168.1.60'), null);
  assert.equal(cleanPrefix('192.168.300'), null);
  assert.equal(cleanPrefix('abc'), null);
  assert.equal(DEFAULT_PREFS.deskPort, 49280);
});
