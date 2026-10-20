import test from 'node:test';
import assert from 'node:assert/strict';
import { MODELS, buildPlan, defaultShow, makeZone, readDeskFirst, readDeskSecond, readReplies, showFromDesk, typeFromName } from '../public/plan.js';

// A desk that holds whatever was set, and answers anything else with the desk's own defaults
function pretendDesk() {
  const held = new Map();
  const fallback = (addr, x) => (addr.endsWith('InCh/Label/Name') ? `"ch ${+x + 1}"` : addr.endsWith('Mix/Label/Name') ? `"MX ${+x + 1}"` : addr.endsWith('St/Label/Name') ? '"ST L"' : '0');
  return {
    run(lines) {
      return lines.map((line) => {
        const [verb, addr, x, y, ...rest] = line.split(' ');
        if (verb === 'set') { held.set(`${addr} ${x} ${y}`, rest.join(' ')); return `OK ${line}`; }
        return `OK ${line} ${held.get(`${addr} ${x} ${y}`) ?? fallback(addr, x)}`;
      });
    },
  };
}
const read = (desk, modelId) => {
  const model = MODELS[modelId];
  const first = readReplies(desk.run(readDeskFirst(model)));
  const second = readReplies(desk.run(readDeskSecond(model, first)));
  return new Map([...first, ...second]);
};

test('replies are read into values: names without quotes, numbers as numbers', () => {
  const v = readReplies(['OK get MIXER:Current/InCh/Label/Name 3 0 "Lect 1"', 'OK get MIXER:Current/InCh/HPF/Freq 3 0 1800', 'ERROR get Nope', 'OK get MIXER:Current/InCh/Label/Color 3 0 Blue']);
  assert.equal(v.get('InCh/Label/Name 3 0'), 'Lect 1');
  assert.equal(v.get('InCh/HPF/Freq 3 0'), 1800);
  assert.equal(v.get('InCh/Label/Color 3 0'), 'Blue');
  assert.equal(v.size, 3);
});

test('a blank desk reads as an empty show, and only asks about named channels the second time', () => {
  const desk = pretendDesk();
  const first = readReplies(desk.run(readDeskFirst(MODELS.CL5)));
  assert.deepEqual(readDeskSecond(MODELS.CL5, first), []);
  const show = showFromDesk('CL5', first);
  assert.equal(show.sources.length, 0);
  assert.equal(show.zones.length, 0);
});

test('a show pushed to a desk reads back the same', () => {
  const show = defaultShow();
  show.options.model = 'CL5';
  const desk = pretendDesk();
  desk.run(buildPlan(show).commands.filter((c) => c.startsWith('set ')));
  const back = showFromDesk('CL5', read(desk, 'CL5'));
  assert.deepEqual(back.zones.map((z) => [z.type, z.name, z.color]), show.zones.map((z) => [z.type, z.name, z.color]));
  const bySource = (sh) => sh.sources.map((s) => [s.name, s.type, s.stereo, s.color, s.hpf]).sort((a, b) => a[0].localeCompare(b[0]));
  assert.deepEqual(bySource(back), bySource(show));
  // Routing comes back by zone, and the read show pushes the same names to the same channels
  const zoneName = (sh, id) => sh.zones.find((z) => z.id === id).name;
  const routes = (sh) => sh.sources.map((s) => `${s.name}: ${s.zones.map((id) => zoneName(sh, id)).sort()}`).sort();
  assert.deepEqual(routes(back), routes(show));
  const names = (plan) => plan.channels.map((c) => `${c.ch} ${c.name}`);
  assert.deepEqual(names(buildPlan(back)), names(buildPlan(show)));
});

test('reading keeps the desk channel and mix numbers, gaps and all', () => {
  const desk = pretendDesk();
  desk.run([
    'set MIXER:Current/InCh/Label/Name 4 0 "Kick"', 'set MIXER:Current/InCh/ToMix/On 4 2 1',
    'set MIXER:Current/InCh/Label/Name 10 0 "Keys L"', 'set MIXER:Current/InCh/Label/Name 11 0 "Keys R"',
    'set MIXER:Current/Mix/Label/Name 2 0 "Drum Wdg"', 'set MIXER:Current/InCh/ToMix/PrePost 0 2 0',
    'set MIXER:Current/Mix/Label/Name 6 0 "Gtr IEM L"', 'set MIXER:Current/Mix/Label/Name 7 0 "Gtr IEM R"',
  ]);
  const show = showFromDesk('QL5', read(desk, 'QL5'));
  assert.deepEqual(show.sources.map((s) => [s.name, s.type, s.stereo, s.deskCh]), [['Kick', 'kick', false, 5], ['Keys', 'keys', true, 11]]);
  assert.deepEqual(show.zones.map((z) => [z.type, z.name, z.mix, z.send]), [['foldback', 'Drum Wdg', 3, 'pre'], ['iemStereo', 'Gtr IEM', 7, 'pre']]);
  assert.deepEqual(show.sources[0].zones, [show.zones[0].id]);
  const plan = buildPlan(show);
  assert.deepEqual(plan.channels.map((c) => `${c.ch} ${c.name}`), ['5 Kick', '11 Keys L', '12 Keys R']);
  assert.deepEqual(plan.mixes.map((m) => [m.zone.name, m.mix]), [['Drum Wdg', 3], ['Gtr IEM', 7]]);
});

test('names tell the source type', () => {
  assert.equal(typeFromName('Lect 1'), 'lectern');
  assert.equal(typeFromName('Kick In'), 'kick');
  assert.equal(typeFromName('AcGtr 2'), 'acoustic');
  assert.equal(typeFromName('Something'), 'instrument');
  assert.ok(makeZone('main').id === 'main');
});
