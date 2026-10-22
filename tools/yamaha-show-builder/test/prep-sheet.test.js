import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, defaultShow } from '../public/plan.js';
import { pickList, prepSheet } from '../public/prep.js';
import { defaultRf, makeAmp, makeRackItem, makeRfDevice, normalizeRacks } from '../public/rig.js';

const rigged = () => {
  const show = defaultShow();
  show.options.model = 'QL5';
  show.rios = [{ model: 'Rio3224-D2' }];
  show.amps = [{ ...makeAmp('D80', 1), mode: 'subtop', ip: '192.168.0.60' }, { ...makeAmp('D40', 2), ip: '192.168.0.61' }];
  show.rf = { ...defaultRf(), receivers: [{ ...makeRfDevice('rx', 'ULXD4Q', 1), ip: '192.168.0.50' }] };
  show.rackItems = [makeRackItem('power', 1)];
  normalizeRacks(show);
  return show;
};

test('the pick list counts what to pull: desk, racks, amps, speakers, RF, mics, DIs and cables', () => {
  const show = rigged();
  const list = Object.fromEntries(pickList(show, buildPlan(show)).map(({ group, rows }) => [group, rows]));
  assert.deepEqual(list['Desk and stage boxes'].map((r) => [r.qty, r.item]), [[1, 'Yamaha QL5'], [1, 'Yamaha Rio3224-D2']]);
  assert.deepEqual(list.Amplifiers.map((r) => [r.qty, r.item, r.note]), [[1, 'd&b D80', 'Sub/Top · Amp 1'], [1, 'd&b D40', 'Dual channel · Amp 2']]);
  assert.ok(list.Racks.some((r) => r.item === 'Power distro'));
  // Sub/top amp: Main L and R tops on Y10P, their subs on Y-SUB
  assert.match(list.Speakers.find((r) => r.item === 'Y-SUB').note, /Main LR L sub, Main LR R sub/);
  const rf = list['Radio mics and IEMs'];
  assert.deepEqual(rf.map((r) => [r.qty, r.item]), [[1, 'Shure ULXD4Q receiver'], [4, 'Handheld transmitter']]);
  assert.deepEqual(list['Mics and DIs'].map((r) => [r.qty, r.item]), [[2, 'Lectern mic'], [4, 'Stereo DI']]);
  const cables = Object.fromEntries(list.Cables.map((r) => [r.item, r.qty]));
  assert.equal(cables['XLR (mic and DI lines)'], 2 + 8); // 2 lecterns, 4 stereo playbacks; radio mics come from the receiver
  assert.equal(cables['Network cable (Cat)'], 1 + 1 + 2 + 1); // desk, Rio, two amps, receiver
});

test('the prep sheet has the pick list with tick boxes, each rack with IPs, and the patch', () => {
  const show = rigged();
  const { body, title } = prepSheet(show, buildPlan(show), { version: '9.9.9', licence: 'KK-SB-0001' });
  assert.equal(title, `${show.name} prep sheet`);
  for (const text of ['Pick list', 'Prepped by', 'Racks', '192.168.0.60', 'KobiKraken logo plate', 'Input patch', 'Output and amp patch', 'Main LR L sub', 'v9.9.9 · Licence KK-SB-0001']) {
    assert.ok(body.includes(text), `has ${text}`);
  }
  assert.ok(!/<script/i.test(body));
  show.name = '<b>Bad</b>';
  assert.ok(!prepSheet(show, buildPlan(show)).body.includes('<b>Bad</b>'));
});

test('your logo goes on the prep sheet and on racks set to it, and only a real picture gets in', async () => {
  const { safeLogo } = await import('../public/plan.js');
  const logo = 'data:image/png;base64,iVBORw0KGgo=';
  assert.equal(safeLogo(logo), logo);
  assert.equal(safeLogo('javascript:alert(1)'), '');
  assert.equal(safeLogo('data:image/png;base64,abc" onerror="x'), '');
  const show = rigged();
  show.racks[0].plate = 'company';
  const { body } = prepSheet(show, buildPlan(show), { company: 'Acme Audio', logo });
  assert.equal(body.split(logo).length - 1, 2); // the header and the rack plate
  assert.ok(body.includes('Acme Audio'));
  const plain = prepSheet(show, buildPlan(show), { company: 'Acme Audio' }).body;
  assert.ok(plain.includes('Acme Audio logo plate'));
});
