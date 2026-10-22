import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultShow } from '../public/plan.js';
import { crc32, isKk, peekKk, readKk, readShowFile, writeKk } from '../public/kkfile.js';

test('a show saved as .kk opens again exactly as it was', async () => {
  const show = defaultShow();
  show.name = 'Annual Conference';
  const bytes = await writeKk(show, { version: '3.5.0', desk: 'QL5' });
  assert.deepEqual([...bytes.subarray(0, 4)], [0x4b, 0x4b, 0x53, 0x42]);
  assert.ok(isKk(bytes));
  const { header, show: back } = await readKk(bytes);
  assert.deepEqual(back, JSON.parse(JSON.stringify(show)));
  assert.equal(header.name, 'Annual Conference');
  assert.equal(header.desk, 'QL5');
  assert.equal(peekKk(bytes).version, '3.5.0');
  assert.ok(bytes.length < JSON.stringify(show).length / 2, 'smaller than the JSON');
});

test('a damaged, cut-short or foreign file is turned down, and old JSON still opens', async () => {
  const show = defaultShow();
  const bytes = await writeKk(show);
  const damaged = bytes.slice();
  damaged[40] ^= 0xff;
  await assert.rejects(readKk(damaged), /damaged/);
  await assert.rejects(readKk(bytes.slice(0, bytes.length - 10)), /damaged/);
  const newer = bytes.slice();
  newer[4] = 9;
  await assert.rejects(readKk(newer), /newer Show Builder/);
  await assert.rejects(readShowFile(new TextEncoder().encode('hello')), /isn't a Show Builder file/);
  const old = await readShowFile(new TextEncoder().encode(JSON.stringify(show)));
  assert.equal(old.header, null);
  assert.equal(old.show.name, show.name);
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926); // the standard CRC-32 check value
});
