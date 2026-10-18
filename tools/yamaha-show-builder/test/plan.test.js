import test from 'node:test';
import assert from 'node:assert/strict';
import { addSources, buildPlan, defaultShow, makeSource, patchSheetCsv } from '../public/plan.js';

test('default show matches the conference brief', () => {
  const show = defaultShow();
  const plan = buildPlan(show);
  // 2 lecterns + 4 handhelds + 4 stereo playbacks (8 channels)
  assert.equal(plan.channels.length, 14);
  assert.deepEqual(plan.mixes.map((m) => m.zone.name), ['FrntFil', 'Delay 1', 'Delay 2', 'Ceiling']);
  assert.deepEqual(plan.channels.slice(12, 14).map((c) => c.name), ['BGM L', 'BGM R']);
  assert.deepEqual(plan.warnings, []);
});

test('BGM goes to the ceiling only and speech stays out of the ceiling', () => {
  const plan = buildPlan(defaultShow());
  const has = (cmd) => plan.commands.includes(cmd);
  // auto order puts BGM last: ch 13 (index 12) is BGM L, ceiling is mix 4 (index 3)
  assert.ok(has('set MIXER:Current/InCh/ToSt/On 12 0 0'));
  assert.ok(has('set MIXER:Current/InCh/ToMix/On 12 3 1'));
  assert.ok(has('set MIXER:Current/InCh/ToMix/On 12 0 0'));
  assert.ok(has('set MIXER:Current/InCh/ToSt/Pan 12 0 -63'));
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
  assert.match(csv[13], /"Ch 13","BGM L","Background music","Ceiling"/);
});

test('model limits are checked', () => {
  const show = defaultShow();
  show.options.model = 'DM3';
  assert.deepEqual(buildPlan(show).warnings, []); // 14 channels, 4 mixes fits a DM3
  addSources(show, 'handheld', 4);
  assert.match(buildPlan(show).warnings.join('\n'), /up to 18 but the DM3 \/ DM3 Standard has 16/);

  show.options.model = 'TF5';
  show.options.firstMix = 7;
  assert.match(buildPlan(show).warnings.join('\n'), /mixes 9 and up are stereo pairs: Delay 2 \(Mix 9\), Ceiling \(Mix 10\)/);
});

test('auto order groups by type and starts stereo pairs on odd channels', () => {
  const show = defaultShow();
  show.sources.push(makeSource('lectern', 3, show.zones)); // added last, belongs with the lecterns
  const plan = buildPlan(show);
  const names = plan.channels.map((c) => `${c.ch}:${c.name}`);
  assert.deepEqual(names.slice(0, 7), ['1:Lect 1', '2:Lect 2', '3:Lect 3', '4:HH 1', '5:HH 2', '6:HH 3', '7:HH 4']);
  assert.deepEqual(plan.spares, [8]); // 7 mono mics, so PB 1 starts on 9
  assert.equal(names[7], '9:PB 1 L');
  assert.equal(names.at(-1), '16:BGM R');
});

test('auto order off keeps the hand-made order with no spares', () => {
  const show = defaultShow();
  show.options.autoOrder = false;
  show.sources.push(makeSource('lectern', 3, show.zones));
  const plan = buildPlan(show);
  assert.equal(plan.channels.at(-1).name, 'Lect 3');
  assert.deepEqual(plan.spares, []);
  assert.equal(plan.channels.find((c) => c.name === 'BGM L').ch, 11);
});
