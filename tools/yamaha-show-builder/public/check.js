// System check: walk noise from one input channel through every output, one side at a time, so each
// speaker can be heard and checked against its amp channel. Only the noise channel's sends and the
// output under test change. Everything touched is read first and put back on Stop.
import { portLabel } from './plan.js';

const NEG_INF = -32768;
const PAN = { L: -63, R: 63 };
export const CHECK_LEVELS = { start: -4000, min: -6000, max: 0, step: 300 }; // noise fader, 1/100 dB

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

// Every desk setting the check can change, as "Addr x y" (the same keys readReplies gives)
export function checkKeys(plan, ch) {
  const i = ch - 1;
  const keys = [`InCh/Fader/On ${i} 0`, `InCh/Fader/Level ${i} 0`, `InCh/ToSt/On ${i} 0`, `InCh/ToSt/Pan ${i} 0`];
  if (plan.outputs.some((o) => o.zone.type === 'main')) keys.push('St/Fader/On 0 0', 'St/Fader/Level 0 0');
  for (const o of plan.outputs) {
    if (o.zone.type === 'main') continue;
    for (const b of o.buses) {
      const m = Number(b.slice(3)) - 1;
      keys.push(`InCh/ToMix/On ${i} ${m}`, `InCh/ToMix/Level ${i} ${m}`, `Mix/Fader/On ${m} 0`, `Mix/Fader/Level ${m} 0`);
      if (o.buses.length === 2) keys.push(`InCh/ToMix/Pan ${i} ${m}`);
    }
  }
  return keys;
}
export const readLines = (keys) => keys.map((k) => `get MIXER:Current/${k}`);

// What the desk should hold for one step: noise at `level` into this output only, its master at 0 dB.
// Anything this step doesn't need goes back to how it was (snapshot).
export function checkState(plan, ch, step, level, snapshot) {
  const i = ch - 1;
  const state = new Map(checkKeys(plan, ch).map((k) => [k, snapshot.get(k)]));
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
export function stateLines(to, from = new Map()) {
  const lines = [];
  for (const [k, v] of to) if (v != null && from.get(k) !== v) lines.push(`set MIXER:Current/${k} ${v}`);
  return lines;
}
// Put back: noise fader closed first, then everything as it was, the noise fader's own level last
export function restoreLines(plan, ch, snapshot) {
  const fader = `InCh/Fader/Level ${ch - 1} 0`;
  const keys = checkKeys(plan, ch).filter((k) => k !== fader);
  const lines = [`set MIXER:Current/${fader} ${NEG_INF}`, ...stateLines(new Map(keys.map((k) => [k, snapshot.get(k)])))];
  if (snapshot.get(fader) != null && snapshot.get(fader) !== NEG_INF) lines.push(`set MIXER:Current/${fader} ${snapshot.get(fader)}`);
  return lines;
}
// A good noise channel: playback or laptop first, else the last input
export function noiseChannel(plan) {
  const pb = plan.channels.find((c) => ['playback', 'laptop'].includes(c.source.type));
  return (pb || plan.channels[plan.channels.length - 1])?.ch || null;
}
export const levelText = (v) => (v <= NEG_INF ? '−∞ dB' : `${v < 0 ? '−' : ''}${Math.abs(v / 100).toFixed(0)} dB`);
