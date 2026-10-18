import test from 'node:test';
import assert from 'node:assert/strict';
import { sendOf, addSources, applySuggestion, buildPlan, defaultShow, makeSource, packageSuggestion, parseRequest, patchSheetCsv } from '../public/plan.js';

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

test('full band package gives the exact mic list in order', () => {
  const show = defaultShow();
  show.sources = [];
  applySuggestion(show, packageSuggestion('band'));
  const plan = buildPlan(show);
  assert.deepEqual(plan.channels.map((c) => c.name), [
    'Kick In', 'Kick Out', 'Snare T', 'Snare B', 'Hi Hat', 'R Tom 1', 'R Tom 2', 'F Tom', 'OH L', 'OH R',
    'Bass DI', 'Bass Mic', 'Gtr 1 L', 'Gtr 1 R', 'Gtr 2 L', 'Gtr 2 R', 'Keys 1 L', 'Keys 1 R', 'Keys 2 L', 'Keys 2 R',
    'Vox 1', 'Vox 2', 'Vox 3', 'MD TB',
  ]);
  assert.deepEqual(plan.spares, []);
  // talkback stays out of the PA
  const tb = show.sources.find((s) => s.name === 'MD TB');
  assert.equal(tb.zones.length, 0);
  assert.ok(plan.commands.includes('set MIXER:Current/InCh/HPF/Freq 23 0 1800')); // MD TB
  assert.ok(plan.commands.includes('set MIXER:Current/InCh/HPF/Freq 20 0 1800')); // Vox 1
});

test('full band after the conference mics sits after them', () => {
  const show = defaultShow();
  applySuggestion(show, packageSuggestion('band'));
  const names = buildPlan(show).channels.map((c) => `${c.ch}:${c.name}`);
  assert.deepEqual(names.slice(5, 8), ['6:HH 4', '7:Kick In', '8:Kick Out']);
  assert.equal(names.find((n) => n.endsWith('MD TB')), '30:MD TB');
});

test('trigger words: packages, counts, number words and zones', () => {
  const show = defaultShow();
  const s = parseRequest('Full band, 4 wedges, two handhelds, an acoustic guitar and 2 IEMs', show);
  assert.equal(s.sources.filter((x) => x.type === 'kick').length, 2);
  assert.deepEqual(s.sources.filter((x) => x.type === 'handheld' || x.type === 'acoustic').map((x) => `${x.type}x${x.count}`), ['acousticx1', 'handheldx2']);
  assert.ok(!s.sources.some((x) => x.type === 'guitar' && x.name === 'Gtr')); // "acoustic guitar" is not also a guitar
  assert.deepEqual(s.zones.map((z) => z.name), ['Wedge 1', 'Wedge 2', 'Wedge 3', 'Wedge 4', 'IEM 1', 'IEM 2']);
  assert.deepEqual(s.unknown, []);

  applySuggestion(show, s);
  const names = show.sources.map((x) => x.name);
  assert.ok(names.includes('HH 5') && names.includes('HH 6')); // numbering carries on
  assert.ok(names.includes('AcGtr'));
  const tb = show.sources.find((x) => x.name === 'MD TB');
  assert.equal(tb.zones.length, 6); // talkback goes to every wedge and IEM
});

test('trigger words report what they did not understand', () => {
  const s = parseRequest('3 vox and a theremin', defaultShow());
  assert.deepEqual(s.sources, [{ type: 'vocal', name: 'Vox', count: 3 }]);
  assert.deepEqual(s.unknown, ['theremin']);
});

test('speaker zones are post-fade, monitor zones pre-fade', () => {
  const show = defaultShow();
  applySuggestion(show, parseRequest('2 wedges', show));
  const plan = buildPlan(show);
  const has = (cmd) => plan.commands.includes(cmd);
  // mixes 1-4 are fills, delays and ceiling (post = 1); 5-6 are wedges (pre = 0)
  for (const m of [0, 1, 2, 3]) assert.ok(has(`set MIXER:Current/InCh/ToMix/PrePost 0 ${m} 1`));
  for (const m of [4, 5]) assert.ok(has(`set MIXER:Current/InCh/ToMix/PrePost 0 ${m} 0`));
  // a zone can be switched by hand, and shows saved before this take the default
  const fills = show.zones.find((z) => z.type === 'frontfill');
  fills.send = 'pre';
  assert.ok(buildPlan(show).commands.includes('set MIXER:Current/InCh/ToMix/PrePost 0 0 0'));
  delete fills.send;
  assert.equal(sendOf(fills), 'post');
});
