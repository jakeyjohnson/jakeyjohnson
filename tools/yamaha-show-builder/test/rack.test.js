import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, defaultShow, makeZone } from '../public/plan.js';
import {
  addAmpsFor,
  ampModelFrom,
  ampPlan,
  defaultRf,
  makeAmp,
  makeRack,
  makeRackItem,
  makeRfDevice,
  moveUnit,
  normalizeRacks,
  nudgeUnit,
  racksOf,
  rfPlan,
  rowFeedName,
  sameDevice,
  shureModelFrom,
  unitHeight,
} from '../public/rig.js';

test('units land in a rack, and the rack order is the fill order', () => {
  const show = defaultShow();
  addAmpsFor(show, buildPlan(show));
  normalizeRacks(show);
  const [rack] = racksOf(show, 'amp');
  assert.equal(rack.name, 'Amp rack 1');
  assert.deepEqual(
    rack.units,
    show.amps.map((a) => a.id),
  );
  const [a1, a2] = show.amps;
  moveUnit(show, a2.id, rack.id, a1.id); // Amp 2 is physically on top
  assert.deepEqual(
    show.amps.map((a) => a.name),
    ['Amp 2', 'Amp 1'],
  );
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
  assert.deepEqual(
    show.amps.map((a) => a.name),
    ['Amp 2', 'Amp 3', 'Amp 1'],
  );
  nudgeUnit(show, show.amps[2].id, -1); // top of rack 2, up: into the bottom of rack 1
  assert.equal(racksOf(show, 'amp')[0].units.length, 3);
  assert.deepEqual(
    show.amps.map((a) => a.name),
    ['Amp 2', 'Amp 3', 'Amp 1'],
  );
  nudgeUnit(show, show.amps[2].id, -1);
  assert.deepEqual(
    show.amps.map((a) => a.name),
    ['Amp 2', 'Amp 1', 'Amp 3'],
  );
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
  assert.deepEqual(
    show.amps.map((a) => a.name),
    ['Amp 2', 'Amp 1'],
  );
  // The Amplifiers tab only shows amps: Amp 1 up goes above Amp 2, past nothing else
  nudgeUnit(show, show.amps[1].id, -1, new Set(show.amps.map((a) => a.id)));
  assert.deepEqual(
    rack.units,
    [power.id, rx.id, blank.id, show.amps[0].id, show.amps[1].id].map((id) => id),
  );
  assert.deepEqual(
    show.amps.map((a) => a.name),
    ['Amp 1', 'Amp 2'],
  );
  // Heights come from the model: d&b amps 2U (the 5D 1U), every RF unit 1U, even if a size was saved
  assert.deepEqual(
    [
      unitHeight(show.amps[0], 'amp'),
      unitHeight(makeAmp('5D'), 'amp'),
      unitHeight({ ...makeAmp('D20'), u: 4 }, 'amp'),
      unitHeight(rx, 'rf'),
      unitHeight({ ...rx, u: 2 }, 'rf'),
      unitHeight(makeRackItem('drawer'), 'item'),
      unitHeight({ ...makeRackItem('other'), u: 3 }, 'item'),
    ],
    [2, 1, 2, 1, 1, 2, 3],
  );
  show.rackItems.splice(0, 1);
  normalizeRacks(show);
  assert.equal(rack.units.length, 4);
});

test('Main L&R can have subs: on an aux, or from main on their own channels or the sub half of a sub/top pair', async () => {
  const { setMainSubs } = await import('../public/plan.js');
  const show = defaultShow();
  show.options.model = 'CL5';
  show.zones = show.zones.filter((z) => z.type === 'main' || z.type === 'frontfill');
  // On an aux: a Subs output appears, taking what the main takes apart from speech, and goes again after
  setMainSubs(show, 'aux');
  const subs = show.zones.find((z) => z.type === 'sub');
  assert.deepEqual(
    buildPlan(show).outputs.map((o) => [o.name, o.buses.join('/')]),
    [
      ['Main LR', 'ST L/ST R'],
      ['FrntFil', 'MIX1'],
      ['Subs', 'MIX2'],
    ],
  );
  const onSubs = show.sources.filter((x) => x.zones.includes(subs.id));
  assert.ok(onSubs.length && onSubs.every((x) => x.type === 'playback')); // the playbacks, not the speech mics
  setMainSubs(show, 'none');
  assert.ok(!show.zones.some((z) => z.type === 'sub'));
  // From main, dual-channel amp: L, R, then L sub and R sub off the same desk outputs
  setMainSubs(show, 'main');
  show.amps = [makeAmp('D80', 1), makeAmp('D80', 2)];
  let rows = ampPlan(show, buildPlan(show)).rows;
  assert.deepEqual(
    rows.map((r) => `${r.label.slice(-1)} ${rowFeedName(r) || 'spare'} ${r.setup}`.trim()),
    [
      'A Main LR L Y10P',
      'B Main LR R Y10P',
      'C Main LR L sub Y-SUB',
      'D Main LR R sub Y-SUB',
      'A FrntFil 44S',
      'B spare',
      'C spare',
      'D spare',
    ],
  );
  assert.equal(rows[2].feed.deskOutLabel, rows[0].feed.deskOutLabel);
  // From main, sub/top amp: the sub rides on the pair, so no extra sub channels
  show.amps = [{ ...makeAmp('D80', 1), mode: 'subtop' }, makeAmp('D80', 2)];
  rows = ampPlan(show, buildPlan(show)).rows;
  assert.deepEqual(
    rows.map((r) => `${r.label.slice(-1)} ${rowFeedName(r) || 'spare'} ${r.setup}`.trim()),
    [
      'A Main LR L Y10P',
      'B Main LR L sub Y-SUB',
      'C Main LR R Y10P',
      'D Main LR R sub Y-SUB',
      'A FrntFil 44S',
      'B spare',
      'C spare',
      'D spare',
    ],
  );
  assert.deepEqual(ampPlan(show, buildPlan(show)).warnings, []);
  // Fill from outputs knows the subs are covered
  show.amps = [];
  addAmpsFor(show, buildPlan(show), 'D80', 'subtop');
  assert.equal(show.amps.length, 2); // Main L+sub, Main R+sub on one; the fill on the next
});

test('amps fed from a DS10: AES inputs in order, one DS10 AES out per pair, Dante routes into it', async () => {
  const { ds10Plan, syncDs10s } = await import('../public/rig.js');
  const show = defaultShow();
  show.options.model = 'CL5';
  show.options.outPatch = { bank: 'dante', port: 1 };
  show.ampFeed = 'ds10';
  show.amps = [{ ...makeAmp('D80', 1), mode: 'subtop' }, makeAmp('D80', 2), makeAmp('D80', 3)];
  const plan = buildPlan(show);
  const rows = ampPlan(show, plan).rows;
  // Amp 1 sub/top: Main L on D1 (A + its sub B), Main R on D2 (C + D): one AES cable. Amp 2: four outputs, D1-D4: two cables
  assert.deepEqual(
    rows
      .filter((r) => r.feed)
      .slice(0, 8)
      .map((r) => `${r.label.slice(-4)} ${r.input}`),
    ['Ch A D1', 'Ch B D1', 'Ch C D2', 'Ch D D2', 'Ch A D1', 'Ch B D2', 'Ch C D3', 'Ch D D4'],
  );
  assert.ok(syncDs10s(show, plan));
  assert.equal(show.ds10s.length, 1);
  const ds = ds10Plan(show, plan);
  assert.deepEqual(
    ds.cables.map((c) => `${c.amp.name} ${c.ampIn} (${c.inputs}) ← DS10 AES out ${c.aesOut}`),
    [
      'Amp 1 AES in 1 (D1/D2) ← DS10 AES out 1',
      'Amp 2 AES in 1 (D1/D2) ← DS10 AES out 2',
      'Amp 2 AES in 2 (D3/D4) ← DS10 AES out 3',
    ],
  ); // six speaker outputs fill Amp 1 and Amp 2; Amp 3 is spare
  assert.deepEqual(
    ds.dante.slice(0, 3).map((d) => `${d.row.feed.name} desk Dante ${d.deskOut} → DS10 ch ${d.channel}`),
    [
      'Main LR L desk Dante 1 → DS10 ch 1',
      'Main LR R desk Dante 2 → DS10 ch 2',
      'FrntFil desk Dante 3 → DS10 ch 3',
    ],
  );
  assert.deepEqual(ds.warnings, []);
  // Back to analogue: the spare DS10 goes
  show.ampFeed = 'analog';
  syncDs10s(show, buildPlan(show));
  assert.equal(show.ds10s.length, 0);
});
