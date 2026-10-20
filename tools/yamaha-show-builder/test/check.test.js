import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, defaultShow, makeZone } from '../public/plan.js';
import { checkKeys, checkState, checkSteps, noiseChannel, readLines, restoreLines, stateLines } from '../public/check.js';

const showWithIem = () => {
  const show = defaultShow();
  show.options.model = 'CL5';
  show.zones.push(makeZone('iemStereo', 'Vox IEM'));
  return show;
};
// What the desk held before the check: everything closed, the noise channel's sends at -inf
const blankSnapshot = (plan, ch) => new Map(checkKeys(plan, ch).map((k) => [k, /Level/.test(k) ? -32768 : 0]));
// Plays set lines onto a held state, like the desk
const apply = (held, lines) => { for (const l of lines) { const [, addr, x, y, v] = l.split(' '); held.set(`${addr.replace('MIXER:Current/', '')} ${x} ${y}`, Number(v)); } };

test('one step per speaker: Main L, Main R, each mix, both sides of a stereo mix', () => {
  const plan = buildPlan(showWithIem());
  const steps = checkSteps(plan);
  assert.deepEqual(steps.map((s) => s.name), ['Main LR L', 'Main LR R', 'FrntFil', 'Delay 1', 'Delay 2', 'Ceiling', 'Vox IEM L', 'Vox IEM R']);
  assert.deepEqual(steps.at(-1).mixes, [4, 5]);
  assert.deepEqual(steps.slice(-2).map((s) => s.bus), ['Mix 5', 'Mix 6']);
  const rows = [{ feed: { key: 'main' + 'L' }, label: 'Amp 1 · Ch A' }];
  assert.equal(checkSteps(plan, rows)[0].amp, 'Amp 1 · Ch A');
});

test('noise goes to the output under test only, at the chosen level, with that output open', () => {
  const plan = buildPlan(showWithIem());
  const ch = noiseChannel(plan);
  assert.equal(plan.channels.find((c) => c.ch === ch).source.type, 'playback');
  const i = ch - 1;
  const snap = blankSnapshot(plan, ch);
  const steps = checkSteps(plan);
  const mainR = checkState(plan, ch, steps[1], -4000, snap);
  assert.equal(mainR.get(`InCh/Fader/Level ${i} 0`), -4000);
  assert.equal(mainR.get(`InCh/ToSt/On ${i} 0`), 1);
  assert.equal(mainR.get(`InCh/ToSt/Pan ${i} 0`), 63);
  assert.equal(mainR.get('St/Fader/Level 0 0'), 0);
  assert.ok([...mainR].filter(([k]) => k.startsWith('InCh/ToMix/On')).every(([, v]) => v === 0));
  const iemL = checkState(plan, ch, steps[6], -4000, snap);
  assert.equal(iemL.get(`InCh/ToSt/On ${i} 0`), 0);
  assert.equal(iemL.get('St/Fader/Level 0 0'), -32768);
  assert.deepEqual([4, 5].map((m) => [iemL.get(`InCh/ToMix/On ${i} ${m}`), iemL.get(`InCh/ToMix/Pan ${i} ${m}`), iemL.get(`Mix/Fader/Level ${m} 0`)]), [[1, -63, 0], [1, -63, 0]]);
  assert.equal(iemL.get(`InCh/ToMix/On ${i} 0`), 0);
});

test('moving on closes the last output, and Stop puts every setting back as it was', () => {
  const plan = buildPlan(showWithIem());
  const ch = noiseChannel(plan);
  const snap = blankSnapshot(plan, ch);
  snap.set(`InCh/Fader/Level ${ch - 1} 0`, -1000); // the engineer had it up a bit
  const held = new Map(snap);
  assert.equal(readLines(checkKeys(plan, ch)).length, checkKeys(plan, ch).length);
  let last = new Map(snap);
  for (const step of checkSteps(plan)) {
    const next = checkState(plan, ch, step, -3000, snap);
    apply(held, stateLines(next, last));
    last = next;
    const open = [...held].filter(([k, v]) => /^(St|Mix)\/Fader\/Level/.test(k) && v === 0).map(([k]) => k);
    assert.equal(open.length, step.mixes.length || 1, `only ${step.name} is open`);
  }
  const back = restoreLines(plan, ch, snap);
  assert.match(back[0], /InCh\/Fader\/Level \d+ 0 -32768$/);
  assert.match(back.at(-1), /InCh\/Fader\/Level \d+ 0 -1000$/);
  apply(held, back);
  assert.deepEqual(held, snap);
});
