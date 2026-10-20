import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, defaultShow, makeZone, readReplies } from '../public/plan.js';
import { OSC_KEYS, checkKeys, checkState, checkSteps, faderToLevel, levelText, noiseChannel, readLines, restoreLines, stateLines } from '../public/check.js';

const showWithIem = () => {
  const show = defaultShow();
  show.options.model = 'CL5';
  show.zones.push(makeZone('iemStereo', 'Vox IEM'));
  return show;
};
// What the desk held before the check: everything closed, sends at -inf, balance centre
const blankSnapshot = (plan, src) => new Map(checkKeys(plan, src).map((k) => [k, k.includes('Type') ? 'SINE WAVE' : /Level/.test(k) ? -32768 : 0]));
// Plays set lines onto a held state, the way the desk would, through the same reply parser the app uses
const apply = (held, lines) => {
  for (const [k, v] of readReplies(lines.map((l) => l.replace(/^set /, 'OK get ')))) held.set(k, v);
};
const openOutputs = (held) => [...held].filter(([k, v]) => /^(St|Mix)\/Fader\/Level/.test(k) && v > -32768).map(([k]) => k);

test('one step per speaker: Main L, Main R, each mix, both sides of a stereo mix', () => {
  const plan = buildPlan(showWithIem());
  const steps = checkSteps(plan);
  assert.deepEqual(steps.map((s) => s.name), ['Main LR L', 'Main LR R', 'FrntFil', 'Delay 1', 'Delay 2', 'Ceiling', 'Vox IEM L', 'Vox IEM R']);
  assert.deepEqual(steps.at(-1).mixes, [4, 5]);
  assert.deepEqual(steps.slice(-2).map((s) => s.bus), ['Mix 5', 'Mix 6']);
  assert.equal(checkSteps(plan, [{ feed: { key: 'mainL' }, label: 'Amp 1 · Ch A' }])[0].amp, 'Amp 1 · Ch A');
});

test('channel noise goes to the output under test only, at the fader level, with that output open', () => {
  const plan = buildPlan(showWithIem());
  const src = { kind: 'channel', ch: noiseChannel(plan) };
  assert.equal(plan.channels.find((c) => c.ch === src.ch).source.type, 'playback');
  const i = src.ch - 1;
  const snap = blankSnapshot(plan, src);
  const steps = checkSteps(plan);
  const mainR = checkState(plan, src, steps[1], -4000, snap);
  assert.equal(mainR.get(`InCh/Fader/Level ${i} 0`), -4000);
  assert.equal(mainR.get(`InCh/ToSt/On ${i} 0`), 1);
  assert.equal(mainR.get(`InCh/ToSt/Pan ${i} 0`), 63);
  assert.equal(mainR.get('St/Fader/Level 0 0'), 0);
  assert.ok([...mainR].filter(([k]) => k.startsWith('InCh/ToMix/On')).every(([, v]) => v === 0));
  const iemL = checkState(plan, src, steps[6], -4000, snap);
  assert.equal(iemL.get(`InCh/ToSt/On ${i} 0`), 0);
  assert.deepEqual([4, 5].map((m) => [iemL.get(`InCh/ToMix/On ${i} ${m}`), iemL.get(`InCh/ToMix/Pan ${i} ${m}`), iemL.get(`Mix/Fader/Level ${m} 0`)]), [[1, -63, 0], [1, -63, 0]]);
  // Moving the fader changes one line
  assert.deepEqual(stateLines(checkState(plan, src, steps[6], -2550, snap), iemL), [`set MIXER:Current/InCh/Fader/Level ${i} 0 -2550`]);
});

test('oscillator: every output closed but the one under test, balance picks the side', () => {
  const plan = buildPlan(showWithIem());
  const steps = checkSteps(plan);
  const plain = { kind: 'osc', setup: false };
  assert.ok(!checkKeys(plan, plain).some((k) => k.startsWith('Setup/')));
  const src = { kind: 'osc', setup: true };
  const snap = blankSnapshot(plan, src);
  snap.set('Mix/Fader/Level 0 0', 0); // front fills were up
  const held = new Map(snap);
  let last = new Map(snap);
  for (const step of steps) {
    const next = checkState(plan, src, step, -2000, snap);
    apply(held, stateLines(next, last));
    last = next;
    assert.equal(held.get('Setup/Oscillator/Type 0 0'), 'PINK NOISE');
    assert.deepEqual(openOutputs(held).length, step.mixes.length || 1, `only ${step.name} is open`);
  }
  assert.equal(held.get('Mix/Out/Balance 5 0'), 63);
  assert.equal(held.get('Mix/Fader/Level 4 0'), -2000);
  const back = restoreLines(plan, src, snap);
  assert.deepEqual(back.slice(0, 2), ['set MIXER:Setup/Oscillator/On 0 0 0', 'set MIXER:Setup/Oscillator/Type 0 0 "SINE WAVE"']);
  apply(held, back);
  assert.deepEqual(held, snap);
});

test('Stop puts every setting back as it was, the noise fader last', () => {
  const plan = buildPlan(showWithIem());
  const src = { kind: 'channel', ch: noiseChannel(plan) };
  const snap = blankSnapshot(plan, src);
  snap.set(`InCh/Fader/Level ${src.ch - 1} 0`, -1000); // the engineer had it up a bit
  const held = new Map(snap);
  assert.equal(readLines(checkKeys(plan, src)).length, checkKeys(plan, src).length);
  let last = new Map(snap);
  for (const step of checkSteps(plan)) {
    const next = checkState(plan, src, step, -3000, snap);
    apply(held, stateLines(next, last));
    last = next;
  }
  const back = restoreLines(plan, src, snap);
  assert.match(back[0], /InCh\/Fader\/Level \d+ 0 -32768$/);
  assert.match(back.at(-1), /InCh\/Fader\/Level \d+ 0 -1000$/);
  apply(held, back);
  assert.deepEqual(held, snap);
});

test('the fader reads in dB, and its bottom is off', () => {
  assert.equal(faderToLevel(-6050), -32768);
  assert.equal(faderToLevel(-2550), -2550);
  assert.deepEqual([levelText(-32768), levelText(0), levelText(-2550), levelText(-4000)], ['−∞', '0 dB', '−25.5 dB', '−40 dB']);
  assert.deepEqual(OSC_KEYS, ['Setup/Oscillator/On 0 0', 'Setup/Oscillator/Type 0 0']);
});
