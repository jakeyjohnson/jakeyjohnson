import test from 'node:test';
import assert from 'node:assert/strict';
import { addSources, applySuggestion, buildPlan, defaultShow, makeSource, normalizeSuggestion, patchSheetCsv } from '../public/plan.js';

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
  assert.match(csv[13], /"Ch 13","BGM L","Background music","off","Ceiling"/);
  assert.match(csv[1], /"Ch 1","Lect 1","Lectern mic","180 Hz",/);
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

test('vocal mics get an HPF at 180 Hz, playback has it off', () => {
  const plan = buildPlan(defaultShow());
  const has = (cmd) => plan.commands.includes(cmd);
  assert.ok(has('set MIXER:Current/InCh/HPF/On 0 0 1')); // Lect 1
  assert.ok(has('set MIXER:Current/InCh/HPF/Freq 0 0 1800'));
  assert.ok(has('set MIXER:Current/InCh/HPF/Freq 5 0 1800')); // HH 4
  assert.ok(has('set MIXER:Current/InCh/HPF/On 6 0 0')); // PB 1 L
  assert.ok(!plan.commands.some((c) => c.startsWith('set MIXER:Current/InCh/HPF/Freq 6 ')));
});

test('a show saved before HPF existed takes the type default', () => {
  const show = defaultShow();
  for (const s of show.sources) delete s.hpf;
  assert.ok(buildPlan(show).commands.includes('set MIXER:Current/InCh/HPF/Freq 0 0 1800'));
});

test('colours use each desk family\'s own names', () => {
  const show = defaultShow();
  show.options.model = 'TF5';
  let plan = buildPlan(show);
  assert.ok(plan.commands.includes('set MIXER:Current/InCh/Label/Color 2 0 SkyBlue')); // HH 1 on a TF
  assert.ok(plan.commands.includes('set MIXER:Current/Mix/Label/Color 0 0 Pink')); // front fills
  show.options.model = 'CL5';
  plan = buildPlan(show);
  assert.ok(plan.commands.includes('set MIXER:Current/InCh/Label/Color 2 0 Cyan'));
  show.sources[0].color = 'White'; // saved by an older version
  assert.ok(buildPlan(show).commands.includes('set MIXER:Current/InCh/Label/Color 0 0 Blue'));
});

test('an AI suggestion is checked before it touches the show', () => {
  const raw = {
    sources: [
      { type: 'kick', name: 'Kick', count: 1 },
      { type: 'tom', name: 'Tom', count: 3 },
      { type: 'overhead', name: 'OH', count: 1 },
      { type: 'vocal', name: 'Vox', count: 99 },
      { type: 'laser', name: 'Pew', count: 1 }, // unknown type: dropped
    ],
    zones: [{ type: 'foldback', name: 'Wedge 1' }, { type: 'main', name: 'Main 2' }],
    summary: 'Drum kit, vocals and a wedge.',
  };
  const s = normalizeSuggestion(raw);
  assert.deepEqual(s.sources.map((x) => `${x.type}x${x.count}`), ['kickx1', 'tomx3', 'overheadx1', 'vocalx32']);
  assert.deepEqual(s.zones.map((z) => z.name), ['Wedge 1']);

  const show = defaultShow();
  applySuggestion(show, { ...s, sources: s.sources.slice(0, 3) });
  const names = buildPlan(show).channels.map((c) => c.name);
  assert.deepEqual(names.slice(6, 12), ['Kick', 'Tom 1', 'Tom 2', 'Tom 3', 'OH L', 'OH R']); // band sits after the speech mics
  const kick = show.sources.find((x) => x.name === 'Kick');
  const wedge = show.zones.find((z) => z.name === 'Wedge 1');
  assert.equal(kick.hpf, 30);
  assert.ok(kick.zones.includes('main') && !kick.zones.includes(wedge.id));
  assert.equal(normalizeSuggestion(null).sources.length, 0);
});
