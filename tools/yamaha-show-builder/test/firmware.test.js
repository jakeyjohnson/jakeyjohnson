import test from 'node:test';
import assert from 'node:assert/strict';
import { badFirmwareLines, compareVersions, firmwareCheck, firmwareRules } from '../public/firmware.js';

test('versions compare number by number, whatever the maker writes round them', () => {
  assert.equal(compareVersions('V5.90', 'V5.81'), 1);
  assert.equal(compareVersions('2.7.6', '2.10.0'), -1);
  assert.equal(compareVersions('2.10', '2.10.0'), 0);
  assert.equal(compareVersions('V1.72', '1.72'), 0);
});

test('rules: model start and minimum, longest match wins', () => {
  const rules = firmwareRules('CL 5.90\nULXD 2.7.6  # matching PSM1000\nULXD4Q 2.8\n\nnonsense');
  assert.equal(rules.length, 3);
  assert.deepEqual(firmwareCheck('CL5', 'V5.81', rules), { ok: false, min: '5.90' });
  assert.deepEqual(firmwareCheck('CL5', 'V5.90', rules), { ok: true, min: '5.90' });
  assert.deepEqual(firmwareCheck('ULXD4D', '2.7.6', rules), { ok: true, min: '2.7.6' });
  assert.deepEqual(firmwareCheck('ULXD4Q', '2.7.6', rules), { ok: false, min: '2.8' });
  assert.equal(firmwareCheck('D80', '2.10.4', rules), null); // no rule
  assert.equal(firmwareCheck('CL5', '', rules), null); // not known
  assert.deepEqual(badFirmwareLines('CL 5.90\nnonsense\n# note'), ['nonsense']);
});

test('the prep sheet lists firmware and flags what needs updating', async () => {
  const { buildPlan, defaultShow } = await import('../public/plan.js');
  const { makeAmp } = await import('../public/rig.js');
  const { prepSheet } = await import('../public/prep.js');
  const show = defaultShow();
  show.amps = [
    { ...makeAmp('D80', 1), firmware: '2.10.4', ip: '10.0.0.60' },
    { ...makeAmp('D80', 2), firmware: '2.8.0' },
  ];
  const sheet = prepSheet(show, buildPlan(show), {
    firmwareMin: 'D80 2.10\nCL 5.90',
    desk: { product: 'CL5', firmware: 'V5.81' },
  });
  assert.match(sheet.body, /<h2>Firmware<\/h2>/);
  assert.equal((sheet.body.match(/<b>Update<\/b>/g) || []).length, 2); // CL5 and Amp 2
  assert.match(sheet.body, /2\.10\.4<\/td><td class="ip">2\.10<\/td><td>OK/);
  const none = prepSheet(defaultShow(), buildPlan(defaultShow()));
  assert.doesNotMatch(none.body, /Firmware/);
});
