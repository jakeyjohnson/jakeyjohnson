// System check: walk noise through every output, one speaker at a time, so each one can be heard and
// checked against its amp channel. Everything touched is read first and put back on Stop.
//
// The noise comes from one of two places (src):
// - { kind: 'channel', ch }: an input channel fed with pink noise. Only that channel's sends change, and
//   the output under test opens to 0 dB. The fader sets the channel's level.
// - { kind: 'osc', setup }: the desk's oscillator, assigned on the desk to every output. Every output
//   master closes except the one under test, and balance picks its side. The fader sets that master.
//   CL/QL, TF and DM don't offer the oscillator over the network, so it is switched on at the desk;
//   when the desk does offer it (setup: true, RIVAGE), it is switched on to pink noise from here too.
import { portLabel } from './plan.js';

const NEG_INF = -32768;
const PAN = { L: -63, R: 63 };
export const CHECK_LEVELS = { start: -4000, min: -6000, max: 0 }; // fader, 1/100 dB; below min is -inf
export const OSC_KEYS = ['Setup/Oscillator/On 0 0', 'Setup/Oscillator/Type 0 0'];

// One step per speaker: Main L, Main R, then each mix (both sides of a stereo mix).
// ampRows (from rig.js ampPlan) name the amp channel each one feeds.
export function checkSteps(plan, ampRows = []) {
  const steps = [];
  for (const o of plan.outputs) {
    const st = o.zone.type === 'main';
    o.buses.forEach((bus, k) => {
      const side = o.buses.length === 2 ? (k ? 'R' : 'L') : '';
      const amp = ampRows.find((r) => r.feed?.key === `${o.zone.id}${side}`);
      steps.push({
        key: `${o.zone.id}${side}`,
        name: side ? `${o.name} ${side}` : o.name,
        bus: st ? bus : bus.replace('MIX', 'Mix '),
        st, side,
        mixes: st ? [] : o.buses.map((b) => Number(b.slice(3)) - 1), // 0-based mix numbers of this output
        out: o.patch ? portLabel({ bank: o.patch.bank, port: o.patch.port + k }) : '',
        amp: amp ? amp.label : '',
      });
    });
  }
  return steps;
}

const mixBuses = (plan) => plan.outputs.filter((o) => o.zone.type !== 'main').map((o) => ({ stereo: o.buses.length === 2, mixes: o.buses.map((b) => Number(b.slice(3)) - 1) }));
const hasMain = (plan) => plan.outputs.some((o) => o.zone.type === 'main');

// Every desk setting the check can change, as "Addr x y" (the same keys readReplies gives).
// "Setup/..." keys live under MIXER:Setup, the rest under MIXER:Current.
export function checkKeys(plan, src) {
  if (src.kind === 'osc') {
    const keys = src.setup ? [...OSC_KEYS] : [];
    if (hasMain(plan)) keys.push('St/Fader/Level 0 0', 'St/Fader/On 0 0', 'St/Out/Balance 0 0');
    for (const { stereo, mixes } of mixBuses(plan)) {
      for (const m of mixes) keys.push(`Mix/Fader/Level ${m} 0`, `Mix/Fader/On ${m} 0`, ...(stereo ? [`Mix/Out/Balance ${m} 0`] : []));
    }
    return keys;
  }
  const i = src.ch - 1;
  const keys = [`InCh/Fader/On ${i} 0`, `InCh/Fader/Level ${i} 0`, `InCh/ToSt/On ${i} 0`, `InCh/ToSt/Pan ${i} 0`];
  if (hasMain(plan)) keys.push('St/Fader/On 0 0', 'St/Fader/Level 0 0');
  for (const { stereo, mixes } of mixBuses(plan)) {
    for (const m of mixes) {
      keys.push(`InCh/ToMix/On ${i} ${m}`, `InCh/ToMix/Level ${i} ${m}`, `Mix/Fader/On ${m} 0`, `Mix/Fader/Level ${m} 0`);
      if (stereo) keys.push(`InCh/ToMix/Pan ${i} ${m}`);
    }
  }
  return keys;
}
const address = (k) => (k.startsWith('Setup/') ? `MIXER:${k}` : `MIXER:Current/${k}`);
export const readLines = (keys) => keys.map((k) => `get ${address(k)}`);

// What the desk should hold for one step, with the fader at `level`.
// Anything this step doesn't need goes back to how it was (snapshot).
export function checkState(plan, src, step, level, snapshot) {
  const state = new Map(checkKeys(plan, src).map((k) => [k, snapshot.get(k)]));
  if (src.kind === 'osc') {
    if (src.setup) { state.set(OSC_KEYS[0], 1); state.set(OSC_KEYS[1], 'PINK NOISE'); }
    for (const k of state.keys()) if (/^(St|Mix)\/Fader\/Level /.test(k)) state.set(k, NEG_INF);
    const buses = step.st ? ['St 0'] : step.mixes.map((m) => `Mix ${m}`);
    for (const b of buses) {
      const [kind, n] = b.split(' ');
      state.set(`${kind}/Fader/Level ${n} 0`, level);
      state.set(`${kind}/Fader/On ${n} 0`, 1);
      if (step.side) state.set(`${kind}/Out/Balance ${n} 0`, PAN[step.side]);
    }
    return state;
  }
  const i = src.ch - 1;
  state.set(`InCh/Fader/On ${i} 0`, 1);
  state.set(`InCh/Fader/Level ${i} 0`, level);
  state.set(`InCh/ToSt/On ${i} 0`, step.st ? 1 : 0);
  if (step.st) {
    state.set(`InCh/ToSt/Pan ${i} 0`, PAN[step.side]);
    state.set('St/Fader/On 0 0', 1);
    state.set('St/Fader/Level 0 0', 0);
  }
  for (const k of state.keys()) if (k.startsWith('InCh/ToMix/On ')) state.set(k, 0);
  for (const m of step.mixes) {
    // A stereo mix gets the noise on both buses, panned to the side under test
    state.set(`InCh/ToMix/On ${i} ${m}`, 1);
    state.set(`InCh/ToMix/Level ${i} ${m}`, 0);
    if (step.side) state.set(`InCh/ToMix/Pan ${i} ${m}`, PAN[step.side]);
    state.set(`Mix/Fader/On ${m} 0`, 1);
    state.set(`Mix/Fader/Level ${m} 0`, 0);
  }
  return state;
}

// The set lines that turn the desk from one state into another (all of `to` when `from` is empty)
const value = (v) => (typeof v === 'string' ? `"${v}"` : v);
export function stateLines(to, from = new Map()) {
  const lines = [];
  for (const [k, v] of to) if (v != null && from.get(k) !== v) lines.push(`set ${address(k)} ${value(v)}`);
  return lines;
}
// Put back. The noise stops first (noise fader closed, or the oscillator back as it was and the output
// masters down), then everything goes back as it was, the noise fader's own level last.
export function restoreLines(plan, src, snapshot) {
  const keys = checkKeys(plan, src);
  const back = (list) => stateLines(new Map(list.map((k) => [k, snapshot.get(k)])));
  if (src.kind === 'osc') {
    const levels = keys.filter((k) => /Fader\/Level/.test(k));
    return [...back(keys.filter((k) => k.startsWith('Setup/'))), ...back(levels), ...back(keys.filter((k) => !k.startsWith('Setup/') && !levels.includes(k)))];
  }
  const fader = `InCh/Fader/Level ${src.ch - 1} 0`;
  const lines = [`set ${address(fader)} ${NEG_INF}`, ...back(keys.filter((k) => k !== fader))];
  if (snapshot.get(fader) != null && snapshot.get(fader) !== NEG_INF) lines.push(`set ${address(fader)} ${snapshot.get(fader)}`);
  return lines;
}
// A good noise channel: playback or laptop first, else the last input
export function noiseChannel(plan) {
  const pb = plan.channels.find((c) => ['playback', 'laptop'].includes(c.source.type));
  return (pb || plan.channels[plan.channels.length - 1])?.ch || null;
}
export const levelText = (v) => (v <= NEG_INF ? '−∞' : v === 0 ? '0 dB' : `−${Math.abs(v / 100).toFixed(1).replace(/\.0$/, '')} dB`);
// The fader: below its lowest mark it is -inf
export const faderToLevel = (pos) => (pos < CHECK_LEVELS.min ? NEG_INF : pos);
