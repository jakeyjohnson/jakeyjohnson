import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultShow } from '../public/plan.js';
import {
  addRackPreset,
  ampById,
  ampIdClashes,
  ampLabel,
  makeAmp,
  makeRack,
  makeSpace,
  moveAmpById,
  normalizeRacks,
  rackPresetFrom,
  sortByAmpId,
} from '../public/rig.js';

function rig(ids) {
  const show = defaultShow();
  show.amps = ids.map((id, i) => ({ ...makeAmp('D80', i + 1), ampId: id }));
  show.racks = [makeRack('amp', 1)];
  return normalizeRacks(show);
}
const order = (show) =>
  show.racks.flatMap((r) => r.units).map((id) => show.amps.find((a) => a.id === id)?.ampId);

test('amps found by ID, any case or spacing', () => {
  const show = rig(['1.01', 'B2']);
  assert.equal(ampById(show, ' b2 ').name, 'Amp 2');
  assert.equal(ampById(show, '9'), null);
  assert.equal(ampById(show, ''), null);
  assert.equal(ampLabel(show.amps[0]), 'Amp 1 (ID 1.01)');
  assert.equal(ampLabel(makeAmp('D80', 4)), 'Amp 4');
});

test('sort by ID reads numbers as numbers, unnumbered amps last', () => {
  const show = rig(['10', '', '2', '1']);
  sortByAmpId(show);
  assert.deepEqual(order(show), ['1', '2', '10', '']);
  // the amp list (channel fill order) follows the rack
  assert.deepEqual(
    show.amps.map((a) => a.ampId),
    ['1', '2', '10', ''],
  );
});

test('sort by ID runs down the racks and leaves built-in amps and spaces alone', () => {
  const show = rig(['4', '3', '2', '1']);
  const [r1] = show.racks;
  const r2 = makeRack('amp', 2);
  show.racks.push(r2);
  const fixed = show.amps[1];
  fixed.fixed = true;
  const space = makeSpace(2);
  show.rackItems = [space];
  r1.units.splice(1, 0, space.id);
  r2.units.push(r1.units.pop()); // ID 1 in rack 2
  normalizeRacks(show);
  sortByAmpId(show);
  assert.deepEqual(r1.units[1], space.id);
  assert.equal(r1.units[2], fixed.id);
  assert.deepEqual(order(show), ['1', undefined, '3', '2', '4']);
});

test('move by ID puts the amp above a unit, into a space or at the bottom', () => {
  const show = rig(['1', '2', '3']);
  const [rack] = show.racks;
  assert.equal(moveAmpById(show, '3', rack.id, ampById(show, '1').id), '');
  assert.deepEqual(order(show), ['3', '1', '2']);
  assert.equal(moveAmpById(show, '3', rack.id), '');
  assert.deepEqual(order(show), ['1', '2', '3']);
  assert.match(moveAmpById(show, '7', rack.id), /No amp has ID 7/);
  ampById(show, '2').fixed = true;
  assert.match(moveAmpById(show, '2', rack.id), /built into/);
});

test('same ID on two amps is flagged', () => {
  const show = rig(['5', '5', '6']);
  const clash = ampIdClashes(show);
  assert.deepEqual([...clash.keys()], ['5']);
  assert.equal(clash.get('5').length, 2);
});

test('built racks keep the IDs of their amps', () => {
  const show = rig(['21', '22']);
  const preset = rackPresetFrom(show, show.racks[0]);
  assert.deepEqual(
    preset.slots.map((x) => x.ampId),
    ['21', '22'],
  );
  const next = defaultShow();
  addRackPreset(next, preset);
  assert.deepEqual(
    next.amps.map((a) => a.ampId),
    ['21', '22'],
  );
});
