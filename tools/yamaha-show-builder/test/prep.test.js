import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applySuggestion,
  applyTemplate,
  buildPlan,
  changedCommands,
  commandKey,
  cueCommand,
  defaultShow,
  emptyShow,
  makeTemplate,
  matchesReadback,
  monitorShow,
  MODELS,
  packageSuggestion,
  pairMonitors,
  paperwork,
  parseInputList,
  parseRequest,
  patchSheetCsv,
  readbackCommand,
  rememberPush,
  sceneStoreCommand,
} from '../public/plan.js';

test('a pasted input list keeps its names, order, notes and 48V, and pairs L/R lines', () => {
  const pasted = [
    'Ch\tName\tMic',
    '1\tKick In\tBeta 91',
    '2\tKick Out\tD112',
    '3\tSnare Top\tSM57',
    '4\tOH L\tKM184\t48V',
    '5\tOH R\tKM184\t48V',
    '6\tBass DI\tactive DI, 48v',
    '7\tLead Vox\tBeta 58',
    '8\tSax\tMD421',
    '9\tKeys L',
    '10\tKeys R',
  ].join('\n');
  const s = parseInputList(pasted);
  assert.deepEqual(
    s.sources.map((x) => `${x.name}:${x.type}${x.stereo ? ':st' : ''}`),
    [
      'Kick In:kick',
      'Kick Out:kick',
      'Snare Top:snare',
      'OH:overhead:st',
      'Bass DI:bass',
      'Lead Vox:vocal',
      'Sax:instrument',
      'Keys:keys:st',
    ],
  );
  assert.equal(s.sources[0].note, 'Beta 91');
  assert.equal(s.sources[3].phantom, true);
  assert.equal(s.sources[4].phantom, true); // "48v" inside the note
  assert.equal(s.sources[5].phantom, undefined);

  const show = emptyShow();
  show.options.autoOrder = false;
  applySuggestion(show, s);
  assert.deepEqual(
    buildPlan(show)
      .channels.map((c) => c.name)
      .slice(0, 6),
    ['Kick In', 'Kick Out', 'Snare Top', 'OH L', 'OH R', 'Bass DI'],
  );
});

test('comma and dash separated lists work too', () => {
  const s = parseInputList('1. Lectern 1, gooseneck, 48V\n2 - Handheld 1\n3, Playback st');
  assert.deepEqual(
    s.sources.map((x) => `${x.name}:${x.type}${x.stereo ? ':st' : ''}${x.phantom ? ':48' : ''}`),
    ['Lectern 1:lectern:48', 'Handheld 1:handheld', 'Playback:playback:st'],
  );
});

test('a saved template brings back its inputs, outputs and routing', () => {
  const show = defaultShow();
  const lect = show.sources[0];
  lect.zones = lect.zones.filter((id) => id === 'main'); // Lect 1 to Main only
  lect.gain = 45;
  const tpl = makeTemplate(show, 'Corporate');
  const fresh = emptyShow();
  applyTemplate(fresh, tpl);
  assert.equal(fresh.sources.length, show.sources.length);
  assert.deepEqual(
    fresh.zones.map((z) => z.name),
    show.zones.map((z) => z.name),
  );
  const l = fresh.sources.find((x) => x.name === 'Lect 1');
  assert.deepEqual(
    l.zones.map((id) => fresh.zones.find((z) => z.id === id).name),
    ['Main LR'],
  );
  assert.equal(l.gain, 45);
  // applying again doesn't duplicate outputs
  applyTemplate(fresh, tpl);
  assert.equal(fresh.zones.length, show.zones.length);
});

test('scene backup and line-check solo commands follow each desk family', () => {
  assert.equal(sceneStoreCommand(MODELS.QL5, 300), 'ssupdate_ex MIXER:Lib/Scene 300');
  assert.equal(sceneStoreCommand(MODELS.TF5, 99), 'ssupdate_ex scene_a 99');
  assert.equal(sceneStoreCommand(MODELS.DM7, 5), 'ssupdatet_ex scene_a 5');
  assert.equal(sceneStoreCommand(MODELS.RX, 7), 'ssupdatet_ex MIXER:Lib/Scene 7');
  assert.equal(sceneStoreCommand(MODELS.custom, 1), null);
  assert.equal(cueCommand(MODELS.CL5, 3, true), 'set MIXER:Current/Cue/InCh/On 2 0 1');
  assert.equal(cueCommand(MODELS.TF5, 3, true), null);
});

test('DCAs and mute groups are made from the input types', () => {
  const show = defaultShow();
  applySuggestion(show, packageSuggestion('band'));
  show.options.model = 'CL5';
  const plan = buildPlan(show);
  assert.deepEqual(
    plan.groups.map((g) => `${g.number}:${g.name}:${g.channels.length}`),
    ['1:Speech:6', '2:Drums:10', '3:Band:10', '4:Vox:3', '5:Playback:6', '6:BGM:2'],
  );
  const has = (cmd) => plan.commands.includes(cmd);
  assert.ok(has('set MIXER:Current/DCA/Label/Name 0 0 "Speech"'));
  assert.ok(has('set MIXER:Current/DCA/Label/Color 1 0 Red'));
  assert.ok(has('set MIXER:Current/InCh/DCA/Assign 0 0 1')); // Lect 1 on DCA 1
  assert.ok(has('set MIXER:Current/InCh/DCA/Assign 0 1 0'));
  assert.ok(has('set MIXER:Current/MuteMaster/Label/Name 3 0 "Vox"'));
  // MD TB (talkback) is in no group
  const tb = plan.channels.find((c) => c.name === 'MD TB').ch - 1;
  assert.ok([0, 1, 2, 3, 4, 5].every((d) => has(`set MIXER:Current/InCh/DCA/Assign ${tb} ${d} 0`)));
  // TF: names only, no assignment over the network
  show.options.model = 'TF5';
  const tf = buildPlan(show);
  assert.ok(tf.commands.includes('set MIXER:Current/DCA/Label/Name 0 0 "Speech"'));
  assert.ok(!tf.commands.some((c) => c.includes('DCA/Assign')));
  show.options.groups = false;
  assert.ok(!buildPlan(show).commands.some((c) => c.includes('DCA')));
});

test('safe start: every head-amp at its lowest and every output fader closed', () => {
  const show = defaultShow();
  show.options.model = 'QL5';
  let plan = buildPlan(show);
  const gains = plan.commands.filter((c) => c.includes('HA/Gain'));
  assert.ok(gains.length && gains.every((c) => c.endsWith(' -600')));
  assert.ok(plan.commands.includes('set MIXER:Current/St/Fader/Level 0 0 -32768'));
  assert.ok(plan.commands.filter((c) => c.includes('Mix/Fader/Level')).every((c) => c.endsWith(' -32768')));
  show.options.model = 'DM7';
  assert.ok(
    buildPlan(show)
      .commands.filter((c) => c.includes('HA/Gain'))
      .every((c) => c.endsWith(' -6')),
  );
  show.options.model = 'DM3';
  assert.ok(
    buildPlan(show)
      .commands.filter((c) => c.includes('HAGain'))
      .every((c) => c.endsWith(' 0')),
  );
  // the gain on each row stays as the line-check target
  assert.match(patchSheetCsv(show, buildPlan(show)).split('\n')[1], /"40 dB"/);
});

test("gain and 48V defaults go out in each desk family's format", () => {
  const show = defaultShow();
  applySuggestion(show, packageSuggestion('band'));
  show.options.safeStart = false;
  show.options.model = 'QL5';
  let plan = buildPlan(show);
  assert.ok(plan.commands.includes('set MIXER:Current/InCh/Port/HA/Gain 0 0 4000')); // lectern 40 dB
  assert.ok(plan.commands.includes('set MIXER:Current/InCh/Port/HA/Gain 2 0 1000')); // handheld receiver 10 dB
  show.options.model = 'DM3';
  plan = buildPlan(show);
  const bassDi = plan.channels.find((c) => c.name === 'Bass DI').ch - 1;
  assert.ok(plan.commands.includes(`set IO:Current/InCh/48VOn ${bassDi} 0 1`));
  assert.ok(plan.commands.includes('set IO:Current/InCh/48VOn 0 0 1')); // lectern gooseneck
  assert.ok(plan.commands.includes('set IO:Current/InCh/48VOn 2 0 0')); // radio mic receiver
  assert.ok(plan.commands.includes('set IO:Current/InCh/HAGain 0 0 40'));
  show.options.setGain = false;
  assert.ok(!buildPlan(show).commands.some((c) => c.includes('Gain') || c.includes('48V')));
});

test('each singer gets their own monitor mix, and a monitor-desk show is made from the same inputs', () => {
  const show = defaultShow();
  applySuggestion(show, packageSuggestion('band'));
  applySuggestion(show, parseRequest('3 wedges and a stereo iem', show));
  const pairs = pairMonitors(show);
  assert.deepEqual(pairs, ['Vox 1 → Wedge 1', 'Vox 2 → Wedge 2', 'Vox 3 → Wedge 3', 'Lect 1 → IEM 1']);
  const mon = monitorShow(show);
  assert.equal(mon.name, 'New show · Monitors');
  assert.deepEqual(
    mon.zones.map((z) => z.name),
    ['Wedge 1', 'Wedge 2', 'Wedge 3', 'IEM 1'],
  );
  assert.equal(mon.sources.length, show.sources.length);
  const plan = buildPlan(mon);
  assert.equal(
    plan.channels.find((c) => c.name === 'Kick In').patch.port,
    buildPlan(show).channels.find((c) => c.name === 'Kick In').patch.port,
  ); // same input patch
  assert.ok(!plan.outputs.some((o) => o.zone.type === 'main'));
});

test('a later push only sends what changed', () => {
  const show = defaultShow();
  const first = buildPlan(show).commands;
  const last = rememberPush(null, first);
  assert.equal(changedCommands(first, last).length, 0);
  show.sources[0].name = 'Podium';
  const changed = changedCommands(buildPlan(show).commands, last);
  assert.deepEqual(changed, ['set MIXER:Current/InCh/Label/Name 0 0 "Podium"']);
  assert.equal(
    commandKey('set MIXER:Current/InCh/Label/Name 0 0 "X"'),
    'set MIXER:Current/InCh/Label/Name 0 0',
  );
});

test('read-back checks compare the value the desk reports', () => {
  const cmd = 'set MIXER:Current/InCh/Label/Name 0 0 "Lect 1"';
  assert.equal(readbackCommand(cmd), 'get MIXER:Current/InCh/Label/Name 0 0');
  assert.ok(matchesReadback(cmd, 'OK get MIXER:Current/InCh/Label/Name 0 0 "Lect 1"'));
  assert.ok(!matchesReadback(cmd, 'OK get MIXER:Current/InCh/Label/Name 0 0 "ch 1"'));
  assert.ok(
    matchesReadback(
      'set MIXER:Current/InCh/Fader/Level 0 0 -32768',
      'OK get MIXER:Current/InCh/Fader/Level 0 0 -32768',
    ),
  );
  assert.ok(!matchesReadback(cmd, 'ERROR get UnknownAddress'));
});

test('the paperwork pack has every section and escapes names', () => {
  const show = defaultShow();
  show.sources[0].name = 'Lect <1>';
  const plan = buildPlan(show);
  const p = paperwork(show, plan, { version: '0.9.0', licence: 'KK-SB-0001' });
  for (const h of ['Input list', 'Outputs', 'Line check', 'Desk tape', 'Stage-box labels'])
    assert.ok(p.body.includes(h), h);
  assert.ok(p.body.includes('Lect &lt;1&gt;') && !p.body.includes('Lect <1>'));
  assert.ok(p.body.includes('Licence KK-SB-0001'));
});

test('the patch sheet carries gain, 48V, group and notes', () => {
  const show = defaultShow();
  show.sources[0].note = 'Gooseneck';
  const csv = patchSheetCsv(show, buildPlan(show)).split('\n');
  assert.match(csv[0], /"Gain","48V","Group","Note"$/);
  assert.match(csv[1], /"40 dB","On","Speech","Gooseneck"$/);
});

test('backing vocals are vocals', () => {
  const s = parseInputList('1 BVox\n2 BV 2\n3 Backing vocal\n4 Lead Vox');
  assert.deepEqual(
    s.sources.map((x) => x.type),
    ['vocal', 'vocal', 'vocal', 'vocal'],
  );
});

test('a template keeps a hand-made channel order when it starts a show', () => {
  const show = emptyShow();
  show.options.autoOrder = false;
  applySuggestion(show, parseInputList('Sax\nLectern\nKick In'));
  const tpl = makeTemplate(show, 'Odd order');
  const fresh = emptyShow();
  applyTemplate(fresh, tpl);
  assert.deepEqual(
    buildPlan(fresh).channels.map((c) => c.name),
    ['Sax', 'Lectern', 'Kick In'],
  );
});
