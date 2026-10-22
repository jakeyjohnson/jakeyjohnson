import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, defaultShow } from '../public/plan.js';
import {
  ampReadSummary,
  applyShureReads,
  defaultRf,
  makeRfDevice,
  parseShureReads,
  rfPlan,
  shureReadLines,
} from '../public/rig.js';

test('a receiver is read channel by channel: name, frequency, gain', () => {
  const rx = makeRfDevice('rx', 'ULXD4D', 1);
  assert.deepEqual(shureReadLines(rx), [
    'GET 1 CHAN_NAME',
    'GET 1 FREQUENCY',
    'GET 1 AUDIO_GAIN',
    'GET 2 CHAN_NAME',
    'GET 2 FREQUENCY',
    'GET 2 AUDIO_GAIN',
  ]);
  const reads = parseShureReads([
    '< REP 1 CHAN_NAME {HH 2                           } >',
    '< REP 1 FREQUENCY 0607250 >',
    '< REP 1 AUDIO_GAIN 030 >',
    'TIMEOUT',
    '< REP 2 CHAN_NAME {Spare} >',
  ]);
  assert.deepEqual(reads, [
    { ch: 1, name: 'HH 2', freq: 607.25, gain: 12 },
    { ch: 2, name: 'Spare' },
  ]);
});

test('receiver reads land on the mic with that name, else the mic on that channel', () => {
  const show = defaultShow();
  const rx = makeRfDevice('rx', 'ULXD4Q', 1);
  show.rf = { ...defaultRf(), receivers: [rx] };
  const plan = buildPlan(show);
  const matched = applyShureReads(show, plan, rx, [
    { ch: 1, name: 'HH 2', freq: 607.25, gain: 12 },
    { ch: 2, name: 'Odd name', freq: 608.5, gain: 3 },
    { ch: 3, name: '', freq: 609.75, gain: 0 },
  ]);
  const rig = rfPlan(show, buildPlan(show));
  const hh2 = rig.mics.find((m) => m.name === 'HH 2');
  assert.equal(hh2.freq, 607.25);
  assert.equal(hh2.source.rfGain, 12);
  // "Odd name" is on channel 2, but HH 2 is already taken by name, so it goes nowhere
  assert.equal(matched, 2);
  assert.equal(rig.mics.find((m) => m.channel === 3).freq, 609.75);
  assert.equal(show.rf.read[rx.id].channels.length, 3);
});

test('an amp read keeps every control with a plain value', () => {
  const s = ampReadSummary({
    readAt: '2026-10-20T10:00:00Z',
    device: { model: 'D80', name: 'Stage left', serial: '123' },
    objects: [
      { path: 'Channel A/Mute', className: 'OcaMute', value: 'muted' },
      { path: 'Channel A/Gain', className: 'OcaGain', value: { value: -3.26, min: -57.5, max: 6 } },
      {
        path: 'Channel A/Input',
        className: 'OcaSwitch',
        value: { position: 4, min: 0, max: 7 },
        positionNames: ['A1', 'A2', 'A3', 'A4', 'D1'],
      },
      { path: 'Channel A', className: 'OcaBlock' },
    ],
  });
  assert.deepEqual(s.controls, [
    { path: 'Channel A/Mute', kind: 'Mute', value: 'muted' },
    { path: 'Channel A/Gain', kind: 'Gain', value: -3.3 },
    { path: 'Channel A/Input', kind: 'Switch', value: 'D1' },
  ]);
  assert.equal(s.model, 'D80');
});
