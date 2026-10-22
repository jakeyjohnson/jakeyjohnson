import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applySuggestion,
  buildPlan,
  defaultShow,
  MODELS,
  packageSuggestion,
  parseRequest,
  patchBanks,
  portLabel,
} from '../public/plan.js';
import {
  addAmpsFor,
  ampPlan,
  planFrequencies,
  rfPlan,
  shureCommands,
  shureGainValue,
  shureMatches,
  shureReadback,
  specteraWrites,
} from '../public/rig.js';

test('a Rio takes the first Dante channels and its sockets become a bank of their own', () => {
  const banks = patchBanks(MODELS.QL5, 'in', [{ model: 'Rio3224-D2' }, { model: 'Rio1608-D2' }]);
  assert.deepEqual(
    banks.map((b) => `${b.key}:${b.size}:${b.danteFrom ?? ''}`),
    ['analog:32:', 'card1:16:', 'card2:16:', 'rio1:32:1', 'rio2:16:33', 'dante:16:49'],
  );
  const show = defaultShow();
  show.options.model = 'QL5';
  show.rios = [{ model: 'Rio1608-D2' }];
  show.options.inPatch = { bank: 'rio1', port: 1 };
  show.options.outPatch = { bank: 'dante', port: 17 };
  const plan = buildPlan(show);
  assert.equal(portLabel(plan.channels[0].patch), 'Rio 1 · 1');
  // stereo inputs past the Rio's 16 sockets move on to the desk's own Dante channels, numbered as the desk numbers them
  assert.equal(plan.outputs[0].patch.port, 17);
  assert.ok(plan.commands.includes('set MIXER:Current/DanteOutPort/Patch 16 0 "ST L"'));
});

test('every speaker output gets a d&b amp channel, a guessed setup and its desk socket; IEMs and record feeds do not', () => {
  const show = defaultShow();
  applySuggestion(show, parseRequest('2 wedges and a stereo iem', show));
  const plan = buildPlan(show);
  addAmpsFor(show, plan, 'D80');
  const amp = ampPlan(show, plan);
  const used = amp.rows.filter((r) => r.feed);
  assert.deepEqual(used.map((r) => `${r.label}=${r.feed.name}`).slice(0, 3), [
    'Amp 1 · Ch A=Main LR L',
    'Amp 1 · Ch B=Main LR R',
    'Amp 1 · Ch C=FrntFil',
  ]);
  assert.ok(!used.some((r) => /IEM|Record/.test(r.feed.name)));
  assert.equal(used[0].setup, 'Y10P');
  assert.equal(used.find((r) => r.feed.zone.type === 'foldback').setup, 'M4');
  assert.equal(used[0].input, 'A1');
  assert.equal(amp.warnings.length, 0);
  show.amps.pop();
  assert.match(ampPlan(show, plan).warnings[0], /No amp channel yet/);
});

test('radio mics fill Shure receiver channels and IEMs fill PSM transmitters, each with a clean frequency', () => {
  const show = defaultShow();
  applySuggestion(show, parseRequest('2 stereo iem', show));
  show.rf = {
    receivers: [{ id: 'r1', model: 'ULXD4Q', name: 'RX 1', ip: '192.168.0.50' }],
    transmitters: [{ id: 't1', model: 'P10T', name: 'IEM TX 1', ip: '' }],
  };
  const rig = rfPlan(show, buildPlan(show));
  assert.deepEqual(
    rig.mics.map((m) => `${m.name}@${m.label}`),
    ['HH 1@RX 1 · Ch 1', 'HH 2@RX 1 · Ch 2', 'HH 3@RX 1 · Ch 3', 'HH 4@RX 1 · Ch 4'],
  );
  assert.deepEqual(
    rig.iems.map((x) => x.label),
    ['IEM TX 1 · Ch 1', 'IEM TX 1 · Ch 2'],
  );
  assert.ok(rig.mics.every((m) => m.freq >= 606.5 && m.freq <= 613.5));
  assert.ok(rig.iems.every((x) => x.freq >= 470 && x.freq <= 534));
  assert.equal(rig.warnings.length, 0);

  const cmds = shureCommands(rig);
  assert.equal(cmds[0].host, '192.168.0.50');
  assert.deepEqual(cmds[0].lines.slice(0, 3), [
    'SET 1 CHAN_NAME {HH 1}',
    `SET 1 FREQUENCY ${Math.round(rig.mics[0].freq * 1000)}`,
    'SET 1 AUDIO_GAIN 0',
  ]);
  assert.equal(shureGainValue(0), 18);
});

test('the frequency plan keeps spacing and misses every third-order intermod product', () => {
  const keys = Array.from({ length: 10 }, (_, i) => `m${i}`);
  const { byKey, warnings } = planFrequencies({ groups: [{ keys, range: [470, 490], spacing: 0.4 }] });
  assert.equal(warnings.length, 0);
  const f = Object.values(byKey);
  for (const a of f)
    for (const b of f) {
      if (a === b) continue;
      assert.ok(Math.abs(a - b) >= 0.4 - 1e-9);
      for (const c of f) assert.ok(Math.abs(2 * a - b - c) >= 0.15 - 1e-9, `${a} ${b} hits ${c}`);
    }
  // a fixed frequency is kept and the rest plan around it; a Spectera block is kept clear
  const r = planFrequencies({
    groups: [{ keys: ['a', 'b'], range: [606.5, 613.5], spacing: 0.4 }],
    fixed: { a: 607 },
    exclude: [[608, 612]],
  });
  assert.equal(r.byKey.a, 607);
  assert.ok(r.byKey.b < 607.8 || r.byKey.b > 612.2);
  assert.match(
    planFrequencies({ groups: [{ keys, range: [470, 471], spacing: 0.4 }] }).warnings[0],
    /Ran out/,
  );
});

test("Shure read-back compares the receiver's reply", () => {
  assert.equal(shureReadback('SET 2 CHAN_NAME {Lect 1}'), 'GET 2 CHAN_NAME');
  assert.ok(
    shureMatches('SET 2 CHAN_NAME {Lect 1}', '< REP 2 CHAN_NAME {Lect 1                         } >'),
  );
  assert.ok(shureMatches('SET 1 AUDIO_GAIN 0', '< REP 1 AUDIO_GAIN 000 >')); // receivers pad numbers
  assert.ok(!shureMatches('SET 1 AUDIO_GAIN 0', '< REP 1 AUDIO_GAIN 018 >'));
  assert.ok(!shureMatches('SET 2 CHAN_NAME {Lect 1}', '< REP 3 CHAN_NAME {Lect 1} >'));
});

test('Spectera bodypacks get their names and lowest gains', () => {
  const show = defaultShow();
  applySuggestion(show, packageSuggestion('drums'));
  applySuggestion(show, parseRequest('a stereo iem', show));
  show.rf = { mics: 'spectera', iems: 'spectera' };
  const rig = rfPlan(show, buildPlan(show));
  assert.equal(rig.mics[0].pack, 'SKM');
  const picks = {
    [rig.mics[0].key]: { mtUid: 7, type: 'SKM' },
    [rig.iems[0].key]: { mtUid: 9, type: 'SEK', headphoneVolumeMin: -60 },
  };
  const writes = specteraWrites(rig, picks);
  assert.deepEqual(writes, [
    { path: '/mts/paired/all/7', body: { mtUid: 7, type: 'SKM', name: 'HH 1', micPreampGain: -10 } },
    { path: '/mts/paired/all/9', body: { mtUid: 9, type: 'SEK', name: 'IEM 1', headphoneVolume: -60 } },
  ]);
  assert.match(rig.warnings.join(' '), /Spectera RF channel/);
});
