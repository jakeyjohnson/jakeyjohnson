// Rack order decides amp channel per output and RX channel per mic.
// Units remember the box they were racked as; reads/sends check it still answers at that IP.
import {
  AMP_CHANNEL_NAMES,
  AMP_MODELS,
  AMP_MODES,
  rowFeedName,
  IEM_MODELS,
  RACK_ITEMS,
  RACK_SIZES,
  RECEIVER_MODELS,
  ampModelFrom,
  identityOf,
  makeAmp,
  makeDs10,
  makeRack,
  makeRackItem,
  makeRfDevice,
  moveUnit,
  normalizeRacks,
  nudgeUnit,
  rackEntries,
  rackPresetFrom,
  racksOf,
  removeFromRack,
  removeRack,
  addRackPreset,
  sameDevice,
  shureModelFrom,
  unitHeight,
} from './rig.js';
import { el, info, ipField, segmented, tag, toast } from './ui.js';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const selectOf = (value, options, onchange, extra = {}) =>
  el(
    'select',
    { onchange: (e) => onchange(e.target.value), ...extra },
    ...options.map(([v, label]) => el('option', { value: v, textContent: label, selected: v === value })),
  );

export function makeRackUi({ show, update, transport, session, prefs = () => ({}), library = null }) {
  session.ident ||= {}; // unit id: { ok, who }, last check this session
  session.found ||= []; // the last Find devices scan
  let dragging = null; // { unit } or { found }
  let namingRack = null; // rack being saved as a preset

  const unitsOf = (kind) => {
    const s = show();
    return kind === 'amp'
      ? [...(s.amps || []), ...(s.ds10s || [])]
      : [...(s.rf?.receivers || []), ...(s.rf?.transmitters || [])];
  };
  const onlyOf = (kind) => new Set(unitsOf(kind).map((u) => u.id));
  const removeUnit = (s, u) => {
    removeFromRack(s, u.id); // leaves a space behind in a preset rack
    for (const list of [s.amps, s.ds10s, s.rf?.receivers, s.rf?.transmitters, s.rackItems]) {
      const i = list?.indexOf(u) ?? -1;
      if (i >= 0) list.splice(i, 1);
    }
  };
  const protocolOf = (kind) => (kind === 'amp' ? 'amp' : 'shure');
  const isTx = (u) => (show().rf?.transmitters || []).includes(u);
  const whoText = (found) =>
    [found.model, found.name, found.serial && `serial ${found.serial}`].filter(Boolean).join(' · ');

  // First check of a hand-typed unit learns who it is.
  async function confirmUnit(u, kind) {
    if (!u.ip) throw new Error(`${u.name} has no IP yet`);
    const found = await transport.identify(protocolOf(kind), u.ip);
    const res = sameDevice(u.ident, found);
    if (res.learn) u.ident = identityOf(found);
    session.ident[u.id] = res.ok ? { ok: true, who: whoText(found) } : { ok: false, who: res.who };
    if (!res.ok)
      throw Object.assign(
        new Error(`${u.name}: ${u.ip} answers as ${res.who}, not the unit racked here. Check the rack.`),
        { wrongUnit: true },
      );
    return found;
  }
  async function checkRack(kind, button) {
    const units = unitsOf(kind).filter((u) => u.ip);
    if (!units.length) return toast('Put IPs on the units first, or rack them from Find devices', 'bad');
    button.disabled = true;
    let bad = 0;
    for (const u of units) {
      try {
        await confirmUnit(u, kind);
      } catch (err) {
        bad++;
        if (!err.wrongUnit) session.ident[u.id] = { ok: false, missing: true, who: err.message };
      }
    }
    toast(
      bad
        ? `${plural(bad, 'unit')} not where the rack says. Marked red.`
        : `All ${plural(units.length, 'unit')} are where the rack says`,
      bad ? 'bad' : 'ok',
    );
    update(() => {});
  }
  async function flash(u, button) {
    if (!u.ip) return;
    button.disabled = true;
    try {
      await confirmUnit(u, 'rf');
      await transport.flash(u.ip);
      toast(`${u.name} is flashing`, 'ok');
    } catch (err) {
      toast(err.message, 'bad');
    }
    update(() => {});
  }

  async function addFound(d, rackId = null, beforeId = null) {
    const s = show();
    const kind = d.kind === 'amp' ? 'amp' : 'rf';
    normalizeRacks(s);
    const rack =
      s.racks.find((r) => r.id === rackId) ||
      racksOf(s, kind).at(-1) ||
      (s.racks.push(makeRack(kind, 1)), s.racks.at(-1));
    let unit;
    if (kind === 'amp') {
      let found = d;
      try {
        found = { ...d, ...(await transport.identify('amp', d.ip)) };
      } catch {
        /* keep what the scan said */
      }
      if (/DS10/i.test(found.model || '')) {
        s.ds10s ||= [];
        unit = makeDs10(s.ds10s.length + 1);
        s.ds10s.push(unit);
      } else {
        s.amps ||= [];
        unit = makeAmp(ampModelFrom(found.model) || 'D80', s.amps.length + 1);
        s.amps.push(unit);
      }
      Object.assign(unit, { ip: d.ip, name: found.name || unit.name, ident: identityOf(found) });
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
    update(() => {
      normalizeRacks(s);
      moveUnit(s, unit.id, rack.id, beforeId);
    });
    toast(`${unit.name} racked in ${rack.name}`, 'ok');
  }
  // rack it, or match to an existing unit
  function foundOptions(d) {
    const kind = d.kind === 'amp' ? 'amp' : d.make === 'Shure' ? 'rf' : null;
    if (!kind || !d.ip) return [];
    const s = show();
    const racks = racksOf(s, kind);
    return [
      ...(racks.length ? racks : [{ id: null, name: kind === 'amp' ? 'Amp rack 1' : 'RF rack 1' }]).map(
        (r) => ({ label: `Add to ${r.name}`, run: () => addFound(d, r.id) }),
      ),
      ...unitsOf(kind)
        .filter((u) => u.ip !== d.ip)
        .map((u) => ({
          label: `Is ${u.name}`,
          run: async () => {
            let found = d;
            if (kind === 'amp') {
              try {
                found = { ...d, ...(await transport.identify('amp', d.ip)) };
              } catch {
                /* keep the scan's answer */
              }
            }
            update(() => {
              u.ip = d.ip;
              u.ident = identityOf(found);
              delete session.ident[u.id];
            });
            toast(`${u.name} is at ${d.ip}`, 'ok');
          },
        })),
    ];
  }

  // onto a unit: goes above it; onto empty rack space: goes at the bottom
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
    ondragstart: (e) => {
      dragging = what;
      e.dataTransfer.setData('text/plain', what.unit || what.found.ip);
      e.dataTransfer.effectAllowed = 'copyMove';
      e.currentTarget.classList.add('dragging');
    },
    ondragend: (e) => {
      dragging = null;
      e.currentTarget.classList.remove('dragging');
    },
  });

  // feeds(unit) returns [[channel, what it carries]]
  function unitRow(kind, u, slot, rack, feeds, extra) {
    const st = session.ident[u.id];
    const models = kind === 'amp' ? AMP_MODELS : isTx(u) ? IEM_MODELS : RECEIVER_MODELS;
    const twin = u.ip && unitsOf(kind).find((x) => x !== u && x.ip === u.ip);
    const status = twin
      ? tag('Same IP', 'warn', `${twin.name} has ${u.ip} too. Each unit needs its own address.`)
      : st
        ? st.ok
          ? tag('Checked', 'on', `Answers as ${st.who}`)
          : st.missing
            ? tag('No answer', 'warn', st.who)
            : tag('Wrong unit', 'warn', `Answers as ${st.who}`)
        : u.ident
          ? tag('Racked', '', `Expects ${whoText(u.ident) || 'this unit'}. Check rack confirms it.`)
          : null;
    return el(
      'li',
      {
        className: `unit ${st && !st.ok ? 'wrong' : ''} ${u.fixed ? 'fixed' : ''}`,
        ...(u.fixed ? {} : dragFrom({ unit: u.id })),
        ...dropOn(rack.id, u.id),
      },
      el('span', { className: 'grip', 'aria-hidden': 'true', textContent: '⠿' }),
      el('span', { className: 'slot mono', textContent: String(slot).padStart(2, '0') }),
      el(
        'div',
        { className: 'unit-main' },
        el(
          'div',
          { className: 'unit-top' },
          el('input', {
            value: u.name,
            className: 'unit-name',
            'aria-label': 'Name',
            onchange: (e) =>
              update(() => {
                u.name = e.target.value.trim() || u.name;
              }),
          }),
          u.model === 'DS10'
            ? el('span', { className: 'unit-fixed', textContent: 'd&b DS10 · Dante to AES' })
            : selectOf(
                u.model,
                Object.entries(models).map(([k, m]) => [k, m.label]),
                (v) =>
                  update(() => {
                    u.model = v;
                  }),
                { 'aria-label': `${u.name} model`, disabled: u.fixed },
              ),
          kind === 'amp' && u.model !== 'DS10'
            ? selectOf(
                u.mode || 'dual',
                Object.entries(AMP_MODES),
                (v) =>
                  update(() => {
                    u.mode = v;
                  }),
                {
                  'aria-label': `${u.name} mode`,
                  title:
                    'Dual channel: every channel its own output. Sub/Top: A+B and C+D each take one output, the top on A (C) and its sub on B (D), from one input (d&b Mix TOP/SUB).',
                },
              )
            : null,
          ipField({
            value: u.ip,
            prefix: kind === 'amp' ? prefs().ampPrefix : prefs().rfPrefix,
            label: `${u.name} IP`,
            onchange: (ip) =>
              update(() => {
                u.ip = ip;
                delete u.ident;
                delete session.ident[u.id];
              }),
          }),
          status,
          u.fixed ? tag('Built in', '', 'Part of a preset rack: it stays where it is.') : null,
        ),
        el(
          'div',
          { className: 'unit-feeds' },
          ...feeds(u).map(([ch, what]) =>
            el(
              'span',
              { className: what ? 'feed' : 'feed spare' },
              el('b', { className: 'mono', textContent: ch }),
              what || 'spare',
            ),
          ),
        ),
      ),
      el('div', { className: 'unit-side' }, ...extra(u), ...(u.fixed ? [] : moveTools(u, onlyOf(kind)))),
    );
  }
  // up, down, remove: for anything not built into a preset rack
  const moveTools = (u, only) => [
    el('button', {
      className: 'icon',
      type: 'button',
      textContent: '↑',
      'aria-label': `Move ${u.name} up`,
      onclick: () => update(() => nudgeUnit(show(), u.id, -1, only)),
    }),
    el('button', {
      className: 'icon',
      type: 'button',
      textContent: '↓',
      'aria-label': `Move ${u.name} down`,
      onclick: () => update(() => nudgeUnit(show(), u.id, 1, only)),
    }),
    el('button', {
      className: 'remove',
      type: 'button',
      textContent: '×',
      title: `Remove ${u.name}`,
      onclick: () =>
        update(() => {
          const s = show();
          removeUnit(s, u);
          normalizeRacks(s);
        }),
    }),
  ];
  const spaceOf = (id) => (show().rackItems || []).find((x) => x.id === id && x.type === 'space');
  // an empty space in a rack: drop a unit on it to put it there
  const spaceRow = (rack, sp) =>
    el('li', { className: 'rack-space', ...dropOn(rack.id, sp.id) }, `${sp.u}U space`);

  // feeds and extra (per-unit buttons) come from the tab
  function racksView(kind, { feeds, extra = () => [] }) {
    const s = normalizeRacks(show());
    const racks = racksOf(s, kind);
    const byId = new Map(unitsOf(kind).map((u) => [u.id, u]));
    let slot = 0;
    const used = new Set(
      unitsOf(kind)
        .map((u) => u.ip)
        .filter(Boolean),
    );
    const tray = session.found.filter(
      (d) => d.ip && !used.has(d.ip) && (kind === 'amp' ? d.kind === 'amp' : d.make === 'Shure'),
    );
    return el(
      'div',
      { className: 'racks-wrap' },
      el(
        'div',
        { className: 'racks' },
        ...racks.map((rack) =>
          el(
            'section',
            { className: 'rack', 'aria-label': rack.name },
            el(
              'header',
              { className: 'rack-head' },
              el('input', {
                value: rack.name,
                className: 'rack-name',
                'aria-label': 'Rack name',
                onchange: (e) =>
                  update(() => {
                    rack.name = e.target.value.trim() || rack.name;
                  }),
              }),
              el('span', {
                className: 'panel-meta',
                textContent: rack.units.length ? plural(rack.units.length, 'unit') : '',
              }),
              racks.length > 1 && !rack.units.length
                ? el('button', {
                    className: 'remove',
                    type: 'button',
                    textContent: '×',
                    title: `Remove ${rack.name}`,
                    onclick: () =>
                      update(() => {
                        s.racks.splice(s.racks.indexOf(rack), 1);
                      }),
                  })
                : null,
            ),
            el(
              'ol',
              { className: 'rack-units', ...dropOn(rack.id, null) },
              plate(rack),
              ...rack.units.map((id) =>
                byId.get(id)
                  ? unitRow(kind, byId.get(id), ++slot, rack, feeds, extra)
                  : spaceOf(id)
                    ? spaceRow(rack, spaceOf(id))
                    : null,
              ),
              el('li', {
                className: 'rack-end',
                textContent: rack.units.length ? 'Drop here for the bottom of the rack' : 'Drag units here',
                ...dropOn(rack.id, null),
              }),
            ),
          ),
        ),
      ),
      tray.length
        ? el(
            'div',
            { className: 'tray' },
            el(
              'span',
              { className: 'chip-label' },
              'On the network',
              info(
                'Found by Find devices and not racked yet. Drag one into a rack at the height it sits, or Add puts it at the bottom.',
              ),
            ),
            el(
              'div',
              { className: 'chips' },
              ...tray.map((d) =>
                el(
                  'span',
                  { className: 'pill found', ...dragFrom({ found: d }) },
                  el('span', { className: 'grip', 'aria-hidden': 'true', textContent: '⠿' }),
                  el('b', { textContent: [d.model, d.name].filter(Boolean).join(' · ') }),
                  el('small', { className: 'mono', textContent: ` ${d.ip}` }),
                  el('button', {
                    className: 'ghost small',
                    type: 'button',
                    textContent: 'Add',
                    onclick: () => addFound(d),
                  }),
                ),
              ),
            ),
          )
        : null,
    );
  }
  // KobiKraken K + wordmark, just the K, or the company logo (name until a logo is set)
  function plate(rack) {
    if (rack.plate === 'none') return null;
    if (rack.plate === 'company') {
      const p = prefs();
      return el(
        'li',
        {
          className: `rack-plate plate-company ${p.logoWhite ? 'white' : ''}`,
          role: 'img',
          'aria-label': `${p.company || 'Company'} logo plate`,
        },
        p.companyLogo
          ? el('img', { src: p.companyLogo, alt: '' })
          : el('span', { className: 'plate-name', textContent: p.company || 'Add your logo in Preferences' }),
      );
    }
    const art = (selector, cls) => {
      const svg = document.querySelector(selector)?.cloneNode(true);
      if (!svg) return null;
      svg.setAttribute('class', cls);
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      svg.setAttribute('aria-hidden', 'true');
      return svg;
    };
    return el(
      'li',
      { className: `rack-plate plate-${rack.plate}`, role: 'img', 'aria-label': 'KobiKraken logo plate' },
      art('svg.brand-k', 'plate-k'),
      rack.plate === 'logo' ? art('svg.brand-word', 'plate-word') : null,
    );
  }

  // ---- Racks tab: true height, IP beside each unit ----
  const U_PX = 30;
  const PLATE_U = 2;
  function rackRoom(main, { feedsOf }) {
    const s = normalizeRacks(show());
    s.rackItems ||= [];
    const entries = new Map(rackEntries(s).map((e) => [e.unit.id, e]));
    let addType = 'blank';
    const usedIps = new Set(
      rackEntries(s)
        .map((e) => e.unit.ip)
        .filter(Boolean),
    );
    const tray = session.found.filter(
      (d) => d.ip && !usedIps.has(d.ip) && (d.kind === 'amp' || d.make === 'Shure'),
    );
    const face = (rack, e) => {
      const { unit: u, family } = e;
      const h = unitHeight(u, family);
      if (u.type === 'space')
        return el(
          'li',
          { className: 'rack-row space-row', style: `--u:${h}`, ...dropOn(rack.id, u.id) },
          el('div', { className: 'face' }, el('span', { textContent: `${h}U space` })),
          el(
            'div',
            { className: 'side' },
            rack.preset
              ? null
              : el(
                  'select',
                  {
                    className: 'side-u',
                    'aria-label': 'Space height',
                    onchange: (ev) => update(() => (u.u = Number(ev.target.value))),
                  },
                  ...[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) =>
                    el('option', { value: n, textContent: `${n}U`, selected: n === h }),
                  ),
                ),
            rack.preset
              ? null
              : el('button', {
                  className: 'remove',
                  type: 'button',
                  textContent: '×',
                  title: 'Remove space',
                  onclick: () => update(() => removeUnit(s, u)),
                }),
          ),
        );
      const st = session.ident[u.id];
      const twin =
        u.ip && family !== 'item' && rackEntries(s).some((x) => x.unit !== u && x.unit.ip === u.ip);
      const led = twin || (st && !st.ok) ? 'warn' : st?.ok ? 'ok' : '';
      const feeds = family === 'item' ? [] : feedsOf(family, u);
      return el(
        'li',
        {
          className: `rack-row fam-${family} type-${u.type || ''} ${u.fixed ? 'fixed' : ''}`,
          style: `--u:${h}`,
          ...(u.fixed ? {} : dragFrom({ unit: u.id })),
          ...dropOn(rack.id, u.id),
        },
        el(
          'div',
          { className: 'face' },
          el('span', {
            className: `led ${led}`,
            title: twin
              ? `Same IP as another unit`
              : st
                ? st.ok
                  ? `Checked: ${st.who}`
                  : st.who
                : 'Not checked yet',
          }),
          el('span', {
            className: 'face-model mono',
            textContent:
              family === 'item'
                ? ''
                : `${u.model}${family === 'amp' && u.mode === 'subtop' ? ' · SUB/TOP' : ''}`,
          }),
          u.fixed
            ? el('span', { className: 'lock', title: 'Built into this rack', 'aria-label': 'Built in' })
            : null,
          family === 'item' && !u.fixed
            ? el('input', {
                value: u.name,
                className: 'face-name',
                'aria-label': 'Name',
                onchange: (ev) =>
                  update(() => {
                    u.name = ev.target.value.trim() || u.name;
                  }),
              })
            : el('b', { className: 'face-name', textContent: u.name }),
          feeds.length
            ? el(
                'span',
                { className: 'face-feeds' },
                ...feeds.map(([ch, what]) =>
                  el('span', { className: what ? '' : 'spare' }, el('i', { textContent: ch }), what || '–'),
                ),
              )
            : el('span', { className: 'grow' }),
          u.fixed ? null : el('span', { className: 'face-tools' }, ...moveTools(u, null)),
        ),
        el(
          'div',
          { className: 'side' },
          family === 'item'
            ? el('span', { className: 'grow' })
            : el('span', { className: `side-ip mono ${u.ip ? '' : 'dim'}`, textContent: u.ip || 'no IP' }),
          family === 'item' && !u.fixed
            ? el(
                'select',
                {
                  className: 'side-u',
                  'aria-label': `${u.name} height`,
                  onchange: (ev) =>
                    update(() => {
                      u.u = Number(ev.target.value);
                    }),
                },
                ...[1, 2, 3, 4].map((n) =>
                  el('option', { value: n, textContent: `${n}U`, selected: n === h }),
                ),
              )
            : el('span', {
                className: 'side-u-fixed mono dim',
                textContent: `${h}U`,
                title: 'Set by the model',
              }),
        ),
      );
    };
    const namingForm = (rack, s) => {
      const name = el('input', {
        value: rack.name,
        'aria-label': 'Preset name',
        placeholder: '15U control rack',
      });
      const save = () => {
        const preset = { ...rackPresetFrom(s, rack), name: name.value.trim() || rack.name };
        library.add(preset);
        namingRack = null;
        update(() => {});
        toast(`${preset.name} saved. Add it to any show from Built racks.`, 'ok');
      };
      name.onkeydown = (ev) => ev.key === 'Enter' && save();
      setTimeout(() => name.focus());
      return el(
        'div',
        { className: 'inline-form preset-form' },
        el('span', { className: 'chip-label', textContent: 'Save as preset' }),
        name,
        el('button', {
          className: 'ghost',
          type: 'button',
          textContent: 'Cancel',
          onclick: () => {
            namingRack = null;
            update(() => {});
          },
        }),
        el('button', { className: 'primary', type: 'button', textContent: 'Save', onclick: save }),
      );
    };
    // your built racks, ready to drop into a show
    const presets = library ? library.list() : [];
    const presetRow = presets.length
      ? el(
          'div',
          { className: 'chip-group presets' },
          el(
            'span',
            { className: 'chip-label' },
            'Built racks',
            info(
              'Racks that live built in the warehouse. Click one to add it, kit and all; amps and RF you add go into its spaces. Save any rack as a preset with Save as preset.',
            ),
          ),
          el(
            'div',
            { className: 'chips' },
            ...presets.map((p) =>
              el(
                'span',
                { className: 'pill preset' },
                el('button', {
                  className: 'chip',
                  type: 'button',
                  textContent: `${p.name}${p.size ? ` · ${p.size}U` : ''}`,
                  title: `${p.slots.filter((x) => x.kind !== 'space').length} built-in units, ${p.slots.filter((x) => x.kind === 'space').reduce((n, x) => n + x.u, 0)}U of space`,
                  onclick: () => update(() => addRackPreset(s, p)),
                }),
                el('button', {
                  className: 'remove',
                  type: 'button',
                  textContent: '×',
                  title: `Delete the ${p.name} preset (racks already in shows stay)`,
                  onclick: (ev) => {
                    if (ev.currentTarget.dataset.armed !== '1') {
                      ev.currentTarget.dataset.armed = '1';
                      ev.currentTarget.textContent = 'Delete?';
                      return;
                    }
                    library.remove(p.id);
                    update(() => {});
                  },
                }),
              ),
            ),
          ),
        )
      : null;
    const cabinet = (rack) => {
      const rows = rack.units.map((id) => entries.get(id)).filter(Boolean);
      const used =
        rows.reduce((n, e) => n + unitHeight(e.unit, e.family), 0) + (rack.plate === 'none' ? 0 : PLATE_U);
      const free = rack.size ? Math.max(0, rack.size - used) : 0;
      return el(
        'section',
        { className: 'cabinet', 'aria-label': rack.name },
        el(
          'header',
          { className: 'rack-head' },
          el('input', {
            value: rack.name,
            className: 'rack-name',
            'aria-label': 'Rack name',
            onchange: (ev) =>
              update(() => {
                rack.name = ev.target.value.trim() || rack.name;
              }),
          }),
          el('span', {
            className: `panel-meta ${rack.size && used > rack.size ? 'over' : ''}`,
            textContent: rack.size ? `${used}/${rack.size}U` : `${used}U`,
          }),
          el('span', { className: 'grow' }),
          segmented(
            rack.plate,
            [
              ['logo', 'KobiKraken'],
              ['icon', 'K'],
              ['company', 'Your logo'],
              ['none', 'None'],
            ],
            (v) =>
              update(() => {
                rack.plate = v;
              }),
            `${rack.name} plate`,
          ),
          el(
            'select',
            {
              'aria-label': `${rack.name} size`,
              onchange: (ev) =>
                update(() => {
                  rack.size = Number(ev.target.value);
                }),
            },
            ...RACK_SIZES.map((n) =>
              el('option', { value: n, textContent: n ? `${n}U` : 'Fit', selected: n === rack.size }),
            ),
          ),
          rack.preset
            ? tag(
                'Built rack',
                'on',
                'From your rack presets. Built-in units stay put; load amps and RF into its spaces.',
              )
            : null,
          library && namingRack !== rack.id
            ? el('button', {
                className: 'ghost small',
                type: 'button',
                textContent: 'Save as preset',
                title: 'Keep this rack, as it is built, to add to any show',
                onclick: () => {
                  namingRack = rack.id;
                  update(() => {});
                },
              })
            : null,
          (s.racks.length > 1 && !rack.units.length) || rack.preset
            ? el('button', {
                className: 'remove',
                type: 'button',
                textContent: '×',
                title: `Remove ${rack.name}`,
                onclick: (ev) => {
                  // a built rack takes its kit with it, so ask twice
                  if (rack.preset && ev.currentTarget.dataset.armed !== '1') {
                    ev.currentTarget.dataset.armed = '1';
                    ev.currentTarget.textContent = 'Remove rack?';
                    return;
                  }
                  update(() =>
                    rack.preset ? removeRack(s, rack) : s.racks.splice(s.racks.indexOf(rack), 1),
                  );
                },
              })
            : null,
        ),
        namingRack === rack.id ? namingForm(rack, s) : null,
        el(
          'ol',
          { className: 'cab-rows', style: `--upx:${U_PX}px`, ...dropOn(rack.id, null) },
          rack.plate === 'none'
            ? null
            : el(
                'li',
                { className: 'rack-row plate-row', style: `--u:${PLATE_U}` },
                el('div', { className: 'face' }, plate(rack)),
                el('div', { className: 'side' }),
              ),
          ...rows.map((e) => face(rack, e)),
          el(
            'li',
            { className: 'rack-row free-row', style: `--u:${Math.max(1, free)}`, ...dropOn(rack.id, null) },
            el(
              'div',
              { className: 'face' },
              el('span', {
                textContent: free
                  ? `${free}U free`
                  : rows.length
                    ? 'Drop here for the bottom'
                    : 'Drag units here',
              }),
            ),
            el('div', { className: 'side' }),
          ),
        ),
      );
    };
    main.replaceChildren(
      el(
        'section',
        { className: 'panel' },
        el(
          'header',
          { className: 'panel-head' },
          el('span', { className: 'step', textContent: '01' }),
          el('h2', { textContent: 'Racks' }),
          el('span', {
            className: 'panel-meta',
            textContent: s.racks.length
              ? `${plural(s.racks.length, 'rack')} · ${plural(rackEntries(s).length, 'unit')}`
              : '',
          }),
          el(
            'div',
            { className: 'panel-tools' },
            el(
              'select',
              {
                'aria-label': 'Item to add',
                onchange: (ev) => {
                  addType = ev.target.value;
                },
              },
              ...Object.entries(RACK_ITEMS).map(([k, v]) =>
                el('option', { value: k, textContent: `${v.label} · ${v.u}U` }),
              ),
            ),
            el('button', {
              className: 'ghost',
              type: 'button',
              textContent: 'Add to rack',
              onclick: () =>
                update(() => {
                  s.rackItems.push(makeRackItem(addType, s.rackItems.length + 1));
                }),
            }),
            el('button', {
              className: 'ghost',
              type: 'button',
              textContent: 'Add rack',
              onclick: () =>
                update(() => {
                  s.racks.push(makeRack('', s.racks.length + 1));
                }),
            }),
            info(
              'Drag anything to where it sits; amps and RF units fill their channels in this order. Amps and receivers are added on their own tabs or from Find devices. The IP beside each unit is where the app reaches it.',
            ),
          ),
        ),
        el(
          'div',
          { className: 'panel-body' },
          presetRow,
          s.racks.length
            ? el('div', { className: 'cabinets' }, ...s.racks.map(cabinet))
            : el('div', {
                className: 'empty',
                textContent: 'No racks yet. Add amps or RF units, or Add rack.',
              }),
          tray.length
            ? el(
                'div',
                { className: 'tray' },
                el(
                  'span',
                  { className: 'chip-label' },
                  'On the network',
                  info(
                    'Found by Find devices and not racked yet. Drag one into a rack at the height it sits.',
                  ),
                ),
                el(
                  'div',
                  { className: 'chips' },
                  ...tray.map((d) =>
                    el(
                      'span',
                      { className: 'pill found', ...dragFrom({ found: d }) },
                      el('span', { className: 'grip', 'aria-hidden': 'true', textContent: '⠿' }),
                      el('b', { textContent: [d.model, d.name].filter(Boolean).join(' · ') }),
                      el('small', { className: 'mono', textContent: ` ${d.ip}` }),
                      el('button', {
                        className: 'ghost small',
                        type: 'button',
                        textContent: 'Add',
                        onclick: () => addFound(d),
                      }),
                    ),
                  ),
                ),
              )
            : null,
        ),
      ),
    );
  }

  const rackTools = (kind) => [
    el('button', {
      className: 'ghost',
      type: 'button',
      textContent: 'Add rack',
      onclick: () =>
        update(() => {
          const s = show();
          s.racks ||= [];
          s.racks.push(makeRack(kind, racksOf(s, kind).length + 1));
        }),
    }),
    el('button', {
      className: 'ghost',
      type: 'button',
      textContent: 'Check rack',
      title: 'Ask every unit who it is, to make sure each address is the unit racked there',
      onclick: (e) => checkRack(kind, e.currentTarget),
    }),
  ];
  const ampFeeds = (rows) => (u) =>
    rows
      .filter((r) => r.amp === u)
      .map((r) => [AMP_CHANNEL_NAMES[r.index] || String(r.index + 1), rowFeedName(r)]);
  return {
    racksView,
    rackRoom,
    rackTools,
    confirmUnit,
    foundOptions,
    addFound,
    flash,
    ampFeeds,
    setFound: (devices) => {
      session.found = devices || [];
    },
  };
}
