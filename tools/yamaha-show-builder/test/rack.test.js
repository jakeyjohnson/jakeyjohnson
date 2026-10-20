import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, defaultShow } from '../public/plan.js';
import { addAmpsFor, ampModelFrom, ampPlan, defaultRf, makeAmp, makeRack, makeRackItem, makeRfDevice, moveUnit, normalizeRacks, nudgeUnit, racksOf, rfPlan, sameDevice, shureModelFrom, unitHeight } from '../public/rig.js';

test('units land in a rack, and the rack order is the fill order', () => {
  const show = defaultShow();
  addAmpsFor(show, buildPlan(show));
  normalizeRacks(show);
  const [rack] = racksOf(show, 'amp');
  assert.equal(rack.name, 'Amp rack 1');
  assert.deepEqual(rack.units, show.amps.map((a) => a.id));
  const [a1, a2] = show.amps;
  moveUnit(show, a2.id, rack.id, a1.id); // Amp 2 is physically on top
  assert.deepEqual(show.amps.map((a) => a.name), ['Amp 2', 'Amp 1']);
  const rows = ampPlan(show, buildPlan(show)).rows;
  assert.equal(rows[0].label, 'Amp 2 · Ch A');
  assert.equal(rows[0].feed.name, 'Main LR L');
});

test('moving between racks, and nudging over the end of a rack', () => {
  const show = defaultShow();
  show.amps = [makeAmp('D80', 1), makeAmp('D80', 2), makeAmp('D40', 3)];
  normalizeRacks(show);
  const second = makeRack('amp', 2);
  show.racks.push(second);
  moveUnit(show, show.amps[0].id, second.id);
  assert.deepEqual(show.amps.map((a) => a.name), ['Amp 2', 'Amp 3', 'Amp 1']);
  nudgeUnit(show, show.amps[2].id, -1); // top of rack 2, up: into the bottom of rack 1
  assert.equal(racksOf(show, 'amp')[0].units.length, 3);
  assert.deepEqual(show.amps.map((a) => a.name), ['Amp 2', 'Amp 3', 'Amp 1']);
  nudgeUnit(show, show.amps[2].id, -1);
  assert.deepEqual(show.amps.map((a) => a.name), ['Amp 2', 'Amp 1', 'Amp 3']);
  show.amps.splice(0, 1); // removed from the show: gone from its rack
  normalizeRacks(show);
  assert.equal(racksOf(show, 'amp').flatMap((r) => r.units).length, 2);
});

test('RF racks order receivers for the radio mics', () => {
  const show = defaultShow();
  const [rx1, rx2] = [makeRfDevice('rx', 'ULXD4D', 1), makeRfDevice('rx', 'ULXD4D', 2)];
  show.rf = { ...defaultRf(), receivers: [rx1, rx2], transmitters: [makeRfDevice('tx', 'P10T', 1)] };
  normalizeRacks(show);
  const rack = racksOf(show, 'rf')[0];
  assert.equal(rack.units.length, 3);
  moveUnit(show, rx2.id, rack.id, rx1.id);
  const mics = rfPlan(show, buildPlan(show)).mics;
  assert.equal(mics[0].label, 'RX 2 · Ch 1');
});

test('a unit only takes settings from the box it was racked as', () => {
  assert.deepEqual(sameDevice(null, { serial: '1' }), { ok: true, learn: true });
  assert.equal(sameDevice({ serial: 'A1' }, { serial: 'A1', name: 'renamed' }).ok, true);
  const wrong = sameDevice({ serial: 'A1', model: 'D80' }, { serial: 'B7', model: 'D80', name: 'SR' });
  assert.equal(wrong.ok, false);
  assert.equal(wrong.who, 'D80 · SR · serial B7');
  assert.equal(sameDevice({ model: 'ULXD4Q', name: 'RX1' }, { model: 'ULXD4Q', name: 'RX2' }).ok, false);
  assert.equal(sameDevice({ model: 'ULXD4Q', name: 'RX1' }, { model: 'ULXD4Q', name: 'RX1' }).ok, true);
  assert.equal(ampModelFrom('d&b audiotechnik D80'), 'D80');
  assert.equal(ampModelFrom('40D'), '40D');
  assert.deepEqual(shureModelFrom('ULXD4Q'), { kind: 'rx', model: 'ULXD4Q' });
  assert.deepEqual(shureModelFrom('ULXD4'), { kind: 'rx', model: 'ULXD4' });
  assert.deepEqual(shureModelFrom('P10T'), { kind: 'tx', model: 'P10T' });
});

test('one rack can hold amps, RF units and items, and each tab still fills in rack order', () => {
  const show = defaultShow();
  const rx = makeRfDevice('rx', 'ULXD4Q', 1);
  show.amps = [makeAmp('D80', 1), makeAmp('D80', 2)];
  show.rf = { ...defaultRf(), receivers: [rx] };
  show.rackItems = [makeRackItem('power', 1), makeRackItem('blank', 2)];
  normalizeRacks(show);
  const [rack] = show.racks;
  assert.equal(show.racks.length, 1);
  assert.equal(rack.units.length, 5);
  assert.deepEqual(racksOf(show, 'rf'), [rack]);
  const [power, blank] = show.rackItems;
  // Power at the top, then the receiver, a blank, Amp 2, Amp 1
  for (const id of [power.id, rx.id, blank.id, show.amps[1].id, show.amps[0].id]) moveUnit(show, id, rack.id);
  assert.deepEqual(show.amps.map((a) => a.name), ['Amp 2', 'Amp 1']);
  // The Amplifiers tab only shows amps: Amp 1 up goes above Amp 2, past nothing else
  nudgeUnit(show, show.amps[1].id, -1, new Set(show.amps.map((a) => a.id)));
  assert.deepEqual(rack.units, [power.id, rx.id, blank.id, show.amps[0].id, show.amps[1].id].map((id) => id));
  assert.deepEqual(show.amps.map((a) => a.name), ['Amp 1', 'Amp 2']);
  assert.deepEqual([unitHeight(show.amps[0], 'amp'), unitHeight(rx, 'rf'), unitHeight(makeRackItem('drawer'), 'item'), unitHeight({ ...rx, u: 2 }, 'rf')], [2, 1, 2, 2]);
  show.rackItems.splice(0, 1);
  normalizeRacks(show);
  assert.equal(rack.units.length, 4);
});
