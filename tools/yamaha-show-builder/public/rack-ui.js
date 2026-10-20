// Racks on the Amplifiers and RF tabs: units drawn top to bottom the way they sit in the real rack,
// dragged (or nudged with the arrows) into order. That order decides which amp channel gets which output
// and which receiver channel gets which mic. Each unit remembers the box it was racked as, and every
// read or send first checks that the same box still answers at that address.
import {
  AMP_CHANNEL_NAMES, AMP_MODELS, IEM_MODELS, RECEIVER_MODELS, ampModelFrom, identityOf, makeAmp, makeRack, makeRfDevice,
  moveUnit, normalizeRacks, nudgeUnit, racksOf, sameDevice, shureModelFrom,
} from './rig.js';
import { el, info, tag, toast } from './ui.js';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const selectOf = (value, options, onchange, extra = {}) => el('select', { onchange: (e) => onchange(e.target.value), ...extra },
  ...options.map(([v, label]) => el('option', { value: v, textContent: label, selected: v === value })));

export function makeRackUi({ show, update, transport, session }) {
  session.ident ||= {}; // unit id -> { ok, who } from the last check this session
  session.found ||= []; // the last Find devices scan
  let dragging = null; // what's being dragged: { unit } or { found }

  const unitsOf = (kind) => {
    const s = show();
    return kind === 'amp' ? (s.amps || []) : [...(s.rf?.receivers || []), ...(s.rf?.transmitters || [])];
  };
  const protocolOf = (kind) => (kind === 'amp' ? 'amp' : 'shure');
  const isTx = (u) => (show().rf?.transmitters || []).includes(u);
  const whoText = (found) => [found.model, found.name, found.serial && `serial ${found.serial}`].filter(Boolean).join(' · ');

  // Checks that the box at the unit's address is the one racked here. The first check of a unit that
  // was typed in by hand learns who it is.
  async function confirmUnit(u, kind) {
    if (!u.ip) throw new Error(`${u.name} has no IP yet`);
    const found = await transport.identify(protocolOf(kind), u.ip);
    const res = sameDevice(u.ident, found);
    if (res.learn) u.ident = identityOf(found);
    session.ident[u.id] = res.ok ? { ok: true, who: whoText(found) } : { ok: false, who: res.who };
    if (!res.ok) throw Object.assign(new Error(`${u.name}: ${u.ip} answers as ${res.who}, not the unit racked here. Check the rack.`), { wrongUnit: true });
    return found;
  }
  async function checkRack(kind, button) {
    const units = unitsOf(kind).filter((u) => u.ip);
    if (!units.length) return toast('Put IPs on the units first, or rack them from Find devices', 'bad');
    button.disabled = true;
    let bad = 0;
    for (const u of units) {
      try { await confirmUnit(u, kind); } catch (err) { bad++; if (!err.wrongUnit) session.ident[u.id] = { ok: false, missing: true, who: err.message }; }
    }
    toast(bad ? `${plural(bad, 'unit')} not where the rack says. Marked red.` : `All ${plural(units.length, 'unit')} are where the rack says`, bad ? 'bad' : 'ok');
    update(() => {});
  }
  async function flash(u, button) {
    if (!u.ip) return;
    button.disabled = true;
    try {
      await confirmUnit(u, 'rf');
      await transport.flash(u.ip);
      toast(`${u.name} is flashing`, 'ok');
    } catch (err) { toast(err.message, 'bad'); }
    update(() => {});
  }

  // A device from Find devices becomes a unit in a rack
  async function addFound(d, rackId = null, beforeId = null) {
    const s = show();
    const kind = d.kind === 'amp' ? 'amp' : 'rf';
    normalizeRacks(s);
    const rack = racksOf(s, kind).find((r) => r.id === rackId) || racksOf(s, kind).at(-1) || (s.racks.push(makeRack(kind, 1)), s.racks.at(-1));
    let unit;
    if (kind === 'amp') {
      let found = d;
      try { found = { ...d, ...(await transport.identify('amp', d.ip)) }; } catch { /* keep what the scan said */ }
      s.amps ||= [];
      unit = makeAmp(ampModelFrom(found.model) || 'D80', s.amps.length + 1);
      Object.assign(unit, { ip: d.ip, name: found.name || unit.name, ident: identityOf(found) });
      s.amps.push(unit);
    } else {
      s.rf ||= {};
      s.rf.receivers ||= [];
      s.rf.transmitters ||= [];
      const m = shureModelFrom(d.model);
      if (!m) return toast(`${d.model || 'That device'} isn't a Shure unit this app sets up`, 'bad');
      const list = m.kind === 'rx' ? s.rf.receivers : s.rf.transmitters;
      unit = makeRfDevice(m.kind, m.model, list.length + 1);
      Object.assign(unit, { ip: d.ip, name: d.name || unit.name, ident: identityOf(d) });
      list.push(unit);
    }
    update(() => { normalizeRacks(s); moveUnit(s, unit.id, rack.id, beforeId); });
    toast(`${unit.name} racked in ${rack.name}`, 'ok');
  }
  // What Find devices offers for an amp or Shure unit: rack it, or say which existing unit it is
  function foundOptions(d) {
    const kind = d.kind === 'amp' ? 'amp' : d.make === 'Shure' ? 'rf' : null;
    if (!kind || !d.ip) return [];
    const s = show();
    const racks = racksOf(s, kind);
    return [
      ...(racks.length ? racks : [{ id: null, name: kind === 'amp' ? 'Amp rack 1' : 'RF rack 1' }]).map((r) => ({ label: `Add to ${r.name}`, run: () => addFound(d, r.id) })),
      ...unitsOf(kind).filter((u) => u.ip !== d.ip).map((u) => ({
        label: `Is ${u.name}`,
        run: async () => {
          let found = d;
          if (kind === 'amp') { try { found = { ...d, ...(await transport.identify('amp', d.ip)) }; } catch { /* keep the scan's answer */ } }
          update(() => { u.ip = d.ip; u.ident = identityOf(found); delete session.ident[u.id]; });
          toast(`${u.name} is at ${d.ip}`, 'ok');
        },
      })),
    ];
  }

  // Drag and drop: a unit onto another (goes above it) or onto a rack's empty space (goes at the bottom)
  function dropOn(rackId, beforeId) {
    return {
      ondragover: (e) => {
        if (!dragging) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = dragging.found ? 'copy' : 'move';
        e.currentTarget.classList.add('drop-here');
      },
      ondragleave: (e) => e.currentTarget.classList.remove('drop-here'),
      ondrop: (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('drop-here');
        const d = dragging;
        dragging = null;
        if (d?.unit && d.unit !== beforeId) update(() => moveUnit(show(), d.unit, rackId, beforeId));
        else if (d?.found) addFound(d.found, rackId, beforeId);
      },
    };
  }
  const dragFrom = (what) => ({
    draggable: true,
    ondragstart: (e) => { dragging = what; e.dataTransfer.setData('text/plain', what.unit || what.found.ip); e.dataTransfer.effectAllowed = 'copyMove'; e.currentTarget.classList.add('dragging'); },
    ondragend: (e) => { dragging = null; e.currentTarget.classList.remove('dragging'); },
  });

  // feeds(unit) -> [[channel, what it carries]] for the strip under each unit
  function unitRow(kind, u, slot, rack, feeds, extra) {
    const st = session.ident[u.id];
    const models = kind === 'amp' ? AMP_MODELS : isTx(u) ? IEM_MODELS : RECEIVER_MODELS;
    const twin = u.ip && unitsOf(kind).find((x) => x !== u && x.ip === u.ip);
    const status = twin ? tag('Same IP', 'warn', `${twin.name} has ${u.ip} too. Each unit needs its own address.`) : st ? (st.ok ? tag('Checked', 'on', `Answers as ${st.who}`) : st.missing ? tag('No answer', 'warn', st.who) : tag('Wrong unit', 'warn', `Answers as ${st.who}`))
      : u.ident ? tag('Racked', '', `Expects ${whoText(u.ident) || 'this unit'}. Check rack confirms it.`) : null;
    return el('li', { className: `unit ${st && !st.ok ? 'wrong' : ''}`, ...dragFrom({ unit: u.id }), ...dropOn(rack.id, u.id) },
      el('span', { className: 'grip', 'aria-hidden': 'true', textContent: '⠿' }),
      el('span', { className: 'slot mono', textContent: String(slot).padStart(2, '0') }),
      el('div', { className: 'unit-main' },
        el('div', { className: 'unit-top' },
          el('input', { value: u.name, className: 'unit-name', 'aria-label': 'Name', onchange: (e) => update(() => { u.name = e.target.value.trim() || u.name; }) }),
          selectOf(u.model, Object.entries(models).map(([k, m]) => [k, m.label]), (v) => update(() => { u.model = v; }), { 'aria-label': `${u.name} model` }),
          el('input', { value: u.ip, placeholder: 'IP', inputMode: 'decimal', className: 'ip', 'aria-label': `${u.name} IP`, onchange: (e) => update(() => { u.ip = e.target.value.trim(); delete u.ident; delete session.ident[u.id]; }) }),
          status),
        el('div', { className: 'unit-feeds' }, ...feeds(u).map(([ch, what]) => el('span', { className: what ? 'feed' : 'feed spare' }, el('b', { className: 'mono', textContent: ch }), what || 'spare')))),
      el('div', { className: 'unit-side' },
        ...extra(u),
        el('button', { className: 'icon', type: 'button', textContent: '↑', 'aria-label': `Move ${u.name} up`, onclick: () => update(() => nudgeUnit(show(), u.id, -1)) }),
        el('button', { className: 'icon', type: 'button', textContent: '↓', 'aria-label': `Move ${u.name} down`, onclick: () => update(() => nudgeUnit(show(), u.id, 1)) }),
        el('button', { className: 'remove', type: 'button', textContent: '×', title: `Remove ${u.name}`, onclick: () => update(() => {
          const s = show();
          for (const list of [s.amps, s.rf?.receivers, s.rf?.transmitters]) { const i = list?.indexOf(u) ?? -1; if (i >= 0) list.splice(i, 1); }
          normalizeRacks(s);
        }) })));
  }

  // The racks for one tab. feeds and extra (per-unit buttons) come from the tab.
  function racksView(kind, { feeds, extra = () => [] }) {
    const s = normalizeRacks(show());
    const racks = racksOf(s, kind);
    const byId = new Map(unitsOf(kind).map((u) => [u.id, u]));
    let slot = 0;
    const used = new Set(unitsOf(kind).map((u) => u.ip).filter(Boolean));
    const tray = session.found.filter((d) => d.ip && !used.has(d.ip) && (kind === 'amp' ? d.kind === 'amp' : d.make === 'Shure'));
    return el('div', { className: 'racks-wrap' },
      el('div', { className: 'racks' }, ...racks.map((rack) => el('section', { className: 'rack', 'aria-label': rack.name },
        el('header', { className: 'rack-head' },
          el('input', { value: rack.name, className: 'rack-name', 'aria-label': 'Rack name', onchange: (e) => update(() => { rack.name = e.target.value.trim() || rack.name; }) }),
          el('span', { className: 'panel-meta', textContent: rack.units.length ? plural(rack.units.length, 'unit') : '' }),
          racks.length > 1 && !rack.units.length ? el('button', { className: 'remove', type: 'button', textContent: '×', title: `Remove ${rack.name}`, onclick: () => update(() => { s.racks.splice(s.racks.indexOf(rack), 1); }) }) : null),
        el('ol', { className: 'rack-units', ...dropOn(rack.id, null) },
          ...rack.units.map((id) => byId.get(id)).filter(Boolean).map((u) => unitRow(kind, u, ++slot, rack, feeds, extra)),
          el('li', { className: 'rack-end', textContent: rack.units.length ? 'Drop here for the bottom of the rack' : 'Drag units here', ...dropOn(rack.id, null) }))))),
      tray.length ? el('div', { className: 'tray' },
        el('span', { className: 'chip-label' }, 'On the network', info('Found by Find devices and not racked yet. Drag one into a rack at the height it sits, or Add puts it at the bottom.')),
        el('div', { className: 'chips' }, ...tray.map((d) => el('span', { className: 'pill found', ...dragFrom({ found: d }) },
          el('span', { className: 'grip', 'aria-hidden': 'true', textContent: '⠿' }),
          el('b', { textContent: [d.model, d.name].filter(Boolean).join(' · ') }), el('small', { className: 'mono', textContent: ` ${d.ip}` }),
          el('button', { className: 'ghost small', type: 'button', textContent: 'Add', onclick: () => addFound(d) }))))) : null);
  }
  const rackTools = (kind) => [
    el('button', { className: 'ghost', type: 'button', textContent: 'Add rack', onclick: () => update(() => { const s = show(); s.racks ||= []; s.racks.push(makeRack(kind, racksOf(s, kind).length + 1)); }) }),
    el('button', { className: 'ghost', type: 'button', textContent: 'Check rack', title: 'Ask every unit who it is, to make sure each address is the unit racked there', onclick: (e) => checkRack(kind, e.currentTarget) }),
  ];
  const ampFeeds = (rows) => (u) => rows.filter((r) => r.amp === u).map((r) => [AMP_CHANNEL_NAMES[r.index] || String(r.index + 1), r.feed?.name || '']);
  return { racksView, rackTools, confirmUnit, foundOptions, addFound, flash, ampFeeds, setFound: (devices) => { session.found = devices || []; } };
}
