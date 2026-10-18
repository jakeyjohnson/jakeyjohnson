import test from 'node:test';
import assert from 'node:assert/strict';
import { addSources, buildPlan, defaultShow, patchSheetCsv } from '../public/plan.js';

test('default show matches the conference brief', () => {
  const show = defaultShow();
  const plan = buildPlan(show);
  // 2 lecterns + 4 handhelds + 4 stereo playbacks (8 channels)
  assert.equal(plan.channels.length, 14);
  assert.deepEqual(plan.mixes.map((m) => m.zone.name), ['FrntFil', 'Delay 1', 'Delay 2', 'Ceiling']);
  assert.deepEqual(plan.channels.slice(10, 12).map((c) => c.name), ['BGM L', 'BGM R']);
  assert.deepEqual(plan.warnings, []);
});

test('BGM goes to the ceiling only and speech stays out of the ceiling', () => {
  const plan = buildPlan(defaultShow());
  const has = (cmd) => plan.commands.includes(cmd);
  // ch 11 (index 10) is BGM L, ceiling is mix 4 (index 3)
  assert.ok(has('set MIXER:Current/InCh/ToSt/On 10 0 0'));
  assert.ok(has('set MIXER:Current/InCh/ToMix/On 10 3 1'));
  assert.ok(has('set MIXER:Current/InCh/ToMix/On 10 0 0'));
  assert.ok(has('set MIXER:Current/InCh/ToSt/Pan 10 0 -63'));
  // lectern 1 feeds main, fills and delays but not the ceiling
  assert.ok(has('set MIXER:Current/InCh/ToSt/On 0 0 1'));
  assert.ok(has('set MIXER:Current/InCh/ToMix/On 0 0 1'));
  assert.ok(has('set MIXER:Current/InCh/ToMix/On 0 3 0'));
  assert.ok(has('set MIXER:Current/InCh/Fader/Level 0 0 -32768'));
});

test('offsets and long names', () => {
  const show = defaultShow();
  show.options.firstChannel = 17;
  show.options.firstMix = 9;
  show.sources[0].name = 'Lectern "Left" mic';
  const plan = buildPlan(show);
  assert.ok(plan.commands.includes('set MIXER:Current/InCh/Label/Name 16 0 "Lectern "'));
  assert.ok(plan.commands.includes('set MIXER:Current/Mix/Label/Name 8 0 "FrntFil"'));
  assert.equal(plan.warnings.length, 1);
});

test('adding more of a type keeps numbering going', () => {
  const show = defaultShow();
  addSources(show, 'handheld', 2);
  assert.deepEqual(show.sources.filter((s) => s.type === 'handheld').map((s) => s.name), ['HH 1', 'HH 2', 'HH 3', 'HH 4', 'HH 5', 'HH 6']);
});

test('patch sheet lists every channel and output', () => {
  const show = defaultShow();
  const csv = patchSheetCsv(show, buildPlan(show)).split('\n');
  assert.equal(csv.length, 1 + 14 + 1 + 4);
  assert.match(csv[11], /"Ch 11","BGM L","Background music","Ceiling"/);
});
