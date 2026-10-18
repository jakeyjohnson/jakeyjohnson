// The Amplifiers and RF tabs, and the stage boxes on the Desk tab. Shared by the app and the demo: the
// page hands in how to reach the devices (the app through its bridge, the demo pretends).
import { RIO_MODELS, buildPlan } from './plan.js';
import {
  AMP_INPUTS, AMP_MODELS, IEM_MODELS, RECEIVER_MODELS, SHURE_GAIN, SPEAKER_SETUPS, SPECTERA_LOWEST, addAmpsFor, ampPlan, defaultRf,
  isRadio, makeAmp, makeRfDevice, rfPlan, shureCommands, specteraWrites,
} from './rig.js';

const MIC_TYPES = ['lectern', 'headset', 'handheld', 'vocal', 'talkback', 'instrument', 'acoustic'];
export const RANGES = [
  { label: 'UK channel 38 · 606.500–613.500', range: [606.5, 613.5] },
  { label: '470–534 (Shure G50 / G51)', range: [470, 534] },
  { label: '534–598 (Shure H50 / H51)', range: [534, 598] },
  { label: '606–670 (Shure K51)', range: [606, 670] },
  { label: '470–542 (PSM1000 G10)', range: [470, 542] },
];

// Props are set as properties, except attribute-only ones (aria-*, list)
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k.includes('-') || k === 'list') node.setAttribute(k, v);
    else node[k] = v;
  }
  node.append(...children.filter((c) => c != null && c !== false));
  return node;
}
const select = (value, options, onchange, extra = {}) => el('select', { onchange: (e) => onchange(e.target.value), ...extra },
  ...options.map(([v, label]) => el('option', { value: v, textContent: label, selected: v === value })));
const table = (head, rows) => el('div', { className: 'table-wrap' }, el('table', { className: 'patch-table' },
  el('thead', {}, el('tr', {}, ...head.map((h) => el('th', { textContent: h })))), el('tbody', {}, ...rows)));
const section = (n, title, ...body) => el('section', {}, el('h2', {}, el('span', { className: 'n', textContent: n }), title), ...body);
const hint = (text) => el('p', { className: 'hint', textContent: text });
const warnList = (list) => el('ul', { className: 'warnings' }, ...list.map((w) => el('li', { textContent: w })));
const statusLine = () => el('span', { className: 'status' });
const fmt = (f) => (f ? f.toFixed(3) : '');

export function mountRig({ getShow, update, transport, demo = false }) {
  const session = { password: '', packs: null, picks: {}, log: [] };
  const show = () => getShow();
  // The show's RF settings, with any missing ones filled in place so every caller edits the same object
  const rf = () => {
    const s = show();
    s.rf ||= {};
    for (const [k, v] of Object.entries(defaultRf())) if (s.rf[k] === undefined) s.rf[k] = v;
    return s.rf;
  };

  // ---- Desk tab: stage boxes ----
  function renderRios(box) {
    const s = show();
    s.rios ||= [];
    box.replaceChildren(
      el('div', { className: 'chip-group' }, el('span', { className: 'chip-label', textContent: 'Stage boxes' }),
        el('div', { className: 'chips' }, ...Object.keys(RIO_MODELS).map((m) => el('button', { className: 'chip', textContent: m, onclick: () => update(() => s.rios.push({ model: m })) })))),
      s.rios.length ? el('ul', { className: 'pills rio-list' }, ...s.rios.map((r, i) => el('li', { className: 'pill' },
        `Rio ${i + 1} · ${r.model} · ${RIO_MODELS[r.model].ins} in / ${RIO_MODELS[r.model].outs} out `,
        el('button', { className: 'remove', textContent: '×', title: `Remove Rio ${i + 1}`, onclick: () => update(() => s.rios.splice(i, 1)) })))) : null,
      s.rios.length ? hint('Each Rio sits on the next block of the desk\'s Dante channels, in this order. Set its UNIT ID to match, then subscribe it in Dante Controller or the desk\'s Dante patch (Paperwork has the list). Gain and 48V on its sockets come from the desk, so safe start covers them too.') : null,
    );
  }

  // ---- Amplifiers tab ----
  function renderAmps(main) {
    const s = show();
    s.amps ||= [];
    s.ampSettings ||= {};
    const plan = buildPlan(s);
    const amp = ampPlan(s, plan);
    const setting = (feed, key, value) => update(() => { s.ampSettings[feed.key] = { ...(s.ampSettings[feed.key] || {}), [key]: value }; });
    let addModel = s.amps.at(-1)?.model || 'D80';
    const ampRows = s.amps.map((a, i) => el('tr', {},
      el('td', {}, el('input', { value: a.name, 'aria-label': 'Amp name', onchange: (e) => update(() => { a.name = e.target.value.trim() || a.name; }) })),
      el('td', {}, select(a.model, Object.entries(AMP_MODELS).map(([k, m]) => [k, m.label]), (v) => update(() => { a.model = v; }))),
      el('td', {}, el('input', { value: a.ip, placeholder: 'IP', inputMode: 'decimal', className: 'ip', onchange: (e) => update(() => { a.ip = e.target.value.trim(); }) })),
      el('td', { className: 'ch', textContent: `${AMP_MODELS[a.model]?.channels || 0} ch` }),
      el('td', {}, el('button', { className: 'remove', textContent: '×', title: `Remove ${a.name}`, onclick: () => update(() => s.amps.splice(i, 1)) }))));
    const chRows = amp.rows.map((r) => el('tr', { className: r.feed ? '' : 'spare' },
      el('td', {}, el('b', { textContent: r.label }), ' ', el('small', { textContent: r.amp.model })),
      el('td', { textContent: r.feed ? r.feed.name : 'spare' }),
      el('td', { textContent: r.feed ? r.feed.deskOutLabel : '' }),
      el('td', {}, r.feed && select(r.input, AMP_INPUTS.map((x) => [x, x]), (v) => setting(r.feed, 'input', v), { 'aria-label': 'Amp input' })),
      el('td', {}, r.feed && el('input', { value: r.setup, className: 'setup', 'aria-label': 'Speaker setup', onchange: (e) => setting(r.feed, 'setup', e.target.value.trim()), list: 'kkSetups' })),
      el('td', { textContent: r.feed ? 'Muted, lowest' : '' }),
      el('td', {}, r.feed && el('input', { type: 'number', step: '0.5', min: '-57.5', max: '6', value: r.target, className: 'port', 'aria-label': 'Target gain in dB', onchange: (e) => setting(r.feed, 'target', Number(e.target.value) || 0) }), r.feed ? ' dB' : '')));
    const datalist = el('datalist', { id: 'kkSetups' }, ...SPEAKER_SETUPS.map((x) => el('option', { value: x })));
    const checklist = el('ol', { className: 'steps' },
      el('li', { textContent: 'Give each amp a fixed IP on the show network (front panel, or R1), and put it in the list above. Find devices picks up amps that answer on AES70.' }),
      el('li', { textContent: 'In R1, add the amps and set each channel\'s speaker setup and input from the table.' }),
      el('li', { textContent: 'Before the system is live, mute every channel and turn its gain right down. That\'s the "Start" column.' }),
      el('li', { textContent: 'Unmute one channel at a time and bring it up to its target while you check each speaker.' }));
    main.replaceChildren(
      section('1', 'Amplifiers',
        hint('d&b amps for every speaker output. Each side of a stereo output gets its own channel; IEMs and record feeds don\'t need one.'),
        el('div', { className: 'type-row' },
          select(addModel, Object.entries(AMP_MODELS).map(([k, m]) => [k, m.label]), (v) => { addModel = v; }, { 'aria-label': 'Amp model' }),
          el('button', { className: 'ghost', textContent: 'Add amp', onclick: () => update(() => s.amps.push(makeAmp(addModel, s.amps.length + 1))) }),
          el('button', { className: 'primary', textContent: 'Add amps for every speaker output', onclick: () => update(() => addAmpsFor(s, plan, addModel)) })),
        s.amps.length ? table(['Name', 'Model', 'IP', '', ''], ampRows) : null),
      section('2', 'Patch',
        amp.rows.length ? table(['Amp channel', 'Feeds', 'From the desk', 'Amp input', 'Speaker setup', 'Start', 'Target'], chRows) : hint('Add an amp to see which output goes where.'),
        datalist, warnList(amp.warnings)),
      section('3', 'Set up',
        checklist,
        hint('The app can\'t send settings to d&b amps yet: d&b doesn\'t publish the control list for its AES70 interface. Set them in R1 from this page, or print it from Paperwork.')),
    );
  }

  // ---- RF tab ----
  function deviceList(kind, devices, models) {
    let addModel = devices.at(-1)?.model || (kind === 'rx' ? 'ULXD4Q' : 'P10T');
    const rows = devices.map((d, i) => el('tr', {},
      el('td', {}, el('input', { value: d.name, 'aria-label': 'Name', onchange: (e) => update(() => { d.name = e.target.value.trim() || d.name; }) })),
      el('td', {}, select(d.model, Object.entries(models).map(([k, m]) => [k, m.label]), (v) => update(() => { d.model = v; }))),
      el('td', {}, el('input', { value: d.ip, placeholder: 'IP', inputMode: 'decimal', className: 'ip', onchange: (e) => update(() => { d.ip = e.target.value.trim(); }) })),
      el('td', { className: 'ch', textContent: `${models[d.model]?.channels || 0} ch` }),
      el('td', {}, el('button', { className: 'remove', textContent: '×', title: `Remove ${d.name}`, onclick: () => update(() => devices.splice(i, 1)) }))));
    return el('div', {},
      el('div', { className: 'type-row' },
        select(addModel, Object.entries(models).map(([k, m]) => [k, m.label]), (v) => { addModel = v; }, { 'aria-label': 'Model' }),
        el('button', { className: 'ghost', textContent: kind === 'rx' ? 'Add receiver' : 'Add transmitter', onclick: () => update(() => devices.push(makeRfDevice(kind, addModel, devices.length + 1))) }),
        el('button', {
          className: 'primary', textContent: kind === 'rx' ? 'Add receivers for every radio mic' : 'Add transmitters for every IEM',
          onclick: () => update(() => {
            const rig = rfPlan(show(), buildPlan(show()));
            const need = (kind === 'rx' ? rig.mics : rig.iems).filter((x) => !x.device).length;
            let room = 0;
            while (room < need) { devices.push(makeRfDevice(kind, addModel, devices.length + 1)); room += models[addModel].channels; }
          }),
        })),
      devices.length ? table(['Name', 'Model', 'IP', '', ''], rows) : null);
  }
  const freqCell = (item) => el('input', {
    value: fmt(item.freq), placeholder: 'auto', inputMode: 'decimal', className: `freq ${item.freqFixed ? 'fixed' : ''}`, 'aria-label': `${item.name} frequency in MHz`,
    title: item.freqFixed ? 'Set by hand. Clear it to let the plan pick.' : 'Picked by the plan. Type a frequency to fix it.',
    onchange: (e) => update(() => {
      const r = rf();
      const v = Number(e.target.value);
      if (e.target.value.trim() && v > 0) r.fixed = { ...r.fixed, [item.key]: Math.round(v * 40) / 40 };
      else { const { [item.key]: _, ...rest } = r.fixed || {}; r.fixed = rest; }
    }),
  });
  function rangeRow(label, key) {
    const r = rf();
    const [lo, hi] = r[key];
    const set = (i, v) => update(() => { const next = [...rf()[key]]; next[i] = Number(v) || next[i]; rf()[key] = next; });
    return el('div', { className: 'desk-row' },
      el('label', {}, label, el('span', { className: 'patch-cell' },
        el('input', { type: 'number', step: '0.025', value: lo, className: 'freq', 'aria-label': `${label} from MHz`, onchange: (e) => set(0, e.target.value) }), '–',
        el('input', { type: 'number', step: '0.025', value: hi, className: 'freq', 'aria-label': `${label} to MHz`, onchange: (e) => set(1, e.target.value) }), ' MHz')),
      el('label', {}, 'Preset', select('', [['', 'Pick a range…'], ...RANGES.map((x, i) => [String(i), x.label])], (v) => v && update(() => { rf()[key] = [...RANGES[Number(v)].range]; }))));
  }

  async function runShure(check, out) {
    const rig = rfPlan(show(), buildPlan(show()));
    const jobs = shureCommands(rig, { safe: true });
    if (!jobs.length) { out.status.textContent = 'Put an IP on at least one receiver first.'; out.status.className = 'status bad'; return; }
    out.log.hidden = false;
    out.log.textContent = '';
    let bad = 0;
    let total = 0;
    for (const job of jobs) {
      out.log.textContent += `${job.host}\n`;
      const result = await transport.shure(job.host, job.lines, check, (r) => {
        total++;
        if (!r.ok) bad++;
        out.log.textContent += `  ${r.ok ? '✓' : '✗'} ${r.line}  →  ${r.reply}\n`;
      });
      if (result?.error) { bad++; out.log.textContent += `  ✗ ${result.error}\n`; }
    }
    out.status.className = `status ${bad ? 'bad' : 'ok'}`;
    out.status.textContent = check
      ? (bad ? `${bad} of ${total} settings don't match. See the list.` : `All ${total} settings match.`)
      : (bad ? `${bad} lines didn't land. See the list.` : `Sent ${total} settings to ${jobs.length} ${jobs.length === 1 ? 'receiver' : 'receivers'}. Gains are at their lowest (${SHURE_GAIN.min} dB).`);
  }

  function renderRf(main) {
    const s = show();
    const r = rf();
    const plan = buildPlan(s);
    const rig = rfPlan(s, plan);
    const micRows = plan.channels.filter((c) => c.side !== 'R' && MIC_TYPES.includes(c.source.type)).map((c) => {
      const m = rig.mics.find((x) => x.source === c.source);
      return el('tr', { className: m ? '' : 'spare' },
        el('td', { className: 'ch', textContent: c.ch }),
        el('td', { textContent: c.name }),
        el('td', {}, el('input', { type: 'checkbox', checked: Boolean(m), 'aria-label': `${c.name} is a radio mic`, onchange: (e) => update(() => { c.source.radio = e.target.checked; }) })),
        el('td', { textContent: m ? m.label || 'no receiver yet' : 'wired' }),
        el('td', {}, m && r.mics === 'shure' ? freqCell(m) : m ? 'Spectera' : ''),
        el('td', { textContent: m ? (r.mics === 'shure' ? `${SHURE_GAIN.min} dB (lowest)` : `${m.pack === 'SKM' ? SPECTERA_LOWEST.skmGain : SPECTERA_LOWEST.sekGain} dB (lowest)`) : '' }));
    });
    const iemRows = rig.iems.map((x) => el('tr', {},
      el('td', { className: 'ch', textContent: x.buses.replace(/MIX/g, '') }),
      el('td', { textContent: x.name }),
      el('td', { textContent: x.stereo ? 'Stereo' : 'Mono' }),
      el('td', { textContent: x.label || 'no transmitter yet' }),
      el('td', {}, r.iems === 'shure' ? freqCell(x) : 'Spectera'),
      el('td', { textContent: x.deskOut }),
      el('td', { textContent: r.iems === 'shure' ? 'Lowest' : 'Headphones lowest' })));

    const shureOut = { status: statusLine(), log: el('pre', { className: 'log', hidden: true }) };
    const spec = { status: statusLine(), list: el('div') };
    const specItems = [...(r.mics === 'spectera' ? rig.mics : []), ...(r.iems === 'spectera' ? rig.iems : [])];
    const renderPicks = () => {
      if (!session.packs) return spec.list.replaceChildren();
      const options = [['', 'Pick a pack…'], ...session.packs.map((p) => [String(p.mtUid), `${p.type} · ${p.name || 'no name'}${p.serial ? ` · ${p.serial}` : ''}`])];
      spec.list.replaceChildren(table(['Name', 'Needs', 'Pack'], specItems.map((item) => el('tr', {},
        el('td', { textContent: item.name }), el('td', { textContent: item.pack }),
        el('td', {}, select(String(session.picks[item.key]?.mtUid ?? ''), options, (v) => { session.picks[item.key] = session.packs.find((p) => String(p.mtUid) === v) || null; }))))));
    };
    renderPicks();
    const spectera = el('div', { className: 'desk-row' },
      el('label', {}, 'Base station IP', el('input', { value: r.spectera.ip, inputMode: 'decimal', className: 'ip', onchange: (e) => update(() => { rf().spectera = { ...rf().spectera, ip: e.target.value.trim() }; }) })),
      el('label', {}, 'Password', el('input', { type: 'password', value: session.password, autocomplete: 'off', oninput: (e) => { session.password = e.target.value; } })),
      el('button', {
        className: 'ghost', textContent: 'Read the base station', onclick: async () => {
          spec.status.className = 'status';
          spec.status.textContent = 'Reading…';
          try {
            session.packs = await transport.specteraDevices(rf().spectera.ip, session.password);
            spec.status.textContent = `${session.packs.length} packs paired. Match each one below.`;
            spec.status.className = 'status ok';
            renderPicks();
          } catch (err) { spec.status.textContent = err.message; spec.status.className = 'status bad'; }
        },
      }),
      el('button', {
        className: 'primary', textContent: 'Send names and safe gains', onclick: async () => {
          const writes = specteraWrites(rfPlan(show(), buildPlan(show())), session.picks);
          if (!writes.length) { spec.status.textContent = 'Read the base station and match the packs first.'; spec.status.className = 'status bad'; return; }
          try {
            const results = await transport.specteraPush(rf().spectera.ip, session.password, writes);
            const bad = results.filter((x) => !x.ok);
            spec.status.className = `status ${bad.length ? 'bad' : 'ok'}`;
            spec.status.textContent = bad.length ? `${bad.length} packs didn't take it: ${bad[0].error}` : `Named ${results.length} packs, gains and headphone levels at their lowest.`;
          } catch (err) { spec.status.textContent = err.message; spec.status.className = 'status bad'; }
        },
      }),
      spec.status);

    main.replaceChildren(
      section('1', 'Radio mics',
        el('div', { className: 'desk-row' }, el('label', {}, 'System', select(r.mics, [['shure', 'Shure receivers'], ['spectera', 'Sennheiser Spectera']], (v) => update(() => { rf().mics = v; })))),
        r.mics === 'shure' ? deviceList('rx', r.receivers, RECEIVER_MODELS) : null,
        micRows.length ? table(['Ch', 'Name', 'Radio', 'Receiver', 'Frequency', 'Start gain'], micRows) : hint('Add some mics on the Desk tab first.')),
      section('2', 'IEMs',
        el('div', { className: 'desk-row' }, el('label', {}, 'System', select(r.iems, [['shure', 'Shure PSM'], ['spectera', 'Sennheiser Spectera']], (v) => update(() => { rf().iems = v; })))),
        r.iems === 'shure' ? deviceList('tx', r.transmitters, IEM_MODELS) : null,
        iemRows.length ? table(['Mix', 'Name', '', 'Transmitter', 'Frequency', 'From the desk', 'Start'], iemRows) : hint('Add a mono or stereo IEM output on the Desk tab.')),
      section('3', 'Frequencies',
        hint('A starting plan on a 25 kHz grid: mics 400 kHz apart, IEMs 600 kHz apart, and clear of the third-order intermod between every transmitter. Scan the room and check it in Wireless Workbench before the show.'),
        rangeRow('Radio mics', 'micRange'),
        rangeRow('IEMs', 'iemRange'),
        rig.usesSpectera ? el('div', { className: 'desk-row' },
          el('label', {}, 'Spectera RF channel centre', el('span', { className: 'patch-cell' }, el('input', { type: 'number', step: '0.025', value: r.spectera.frequency || '', className: 'freq', placeholder: 'MHz', onchange: (e) => update(() => { rf().spectera = { ...rf().spectera, frequency: Number(e.target.value) || 0 }; }) }), ' MHz')),
          el('label', {}, 'Bandwidth', select(String(r.spectera.bandwidth), [['6', '6 MHz'], ['8', '8 MHz'], ['10', '10 MHz']], (v) => update(() => { rf().spectera = { ...rf().spectera, bandwidth: Number(v) }; })))) : null,
        el('div', { className: 'type-row' }, el('button', { className: 'ghost', textContent: 'Clear hand-set frequencies', onclick: () => update(() => { rf().fixed = {}; }) })),
        warnList(rig.warnings)),
      section('4', 'Send to RF',
        r.mics === 'shure' ? el('div', {},
          hint(`Sends each receiver channel its name, frequency and gain at ${SHURE_GAIN.min} dB, its lowest, over the network (port 2202). Bring gains up at line check.`),
          el('div', { className: 'desk-row' },
            el('button', { className: 'primary', textContent: 'Send to receivers', onclick: () => runShure(false, shureOut) }),
            el('button', { className: 'ghost', textContent: 'Check receivers', onclick: () => runShure(true, shureOut) }),
            shureOut.status),
          shureOut.log) : null,
        r.iems === 'shure' && rig.iems.length ? hint('PSM transmitters aren\'t sent from here: Shure\'s PSM control strings aren\'t confirmed yet. Set names and frequencies in Wireless Workbench from this list, with the levels right down.') : null,
        specItems.length ? el('div', {},
          hint(`Spectera: names each pack and sets mic gain and headphone level to their lowest. Turn on third-party access on the base station first. The password is only kept until you close the page.${demo ? ' In the demo, any password works.' : ''}`),
          spectera, spec.list) : null),
    );
  }

  // Devices in the show that Find devices can hand an IP to
  function ipTargets() {
    const s = show();
    const r = rf();
    return [
      ...(s.amps || []).map((a) => ({ kind: 'amp', label: a.name, set: (ip) => { a.ip = ip; } })),
      ...r.receivers.map((d) => ({ kind: 'radio', label: d.name, set: (ip) => { d.ip = ip; } })),
      ...r.transmitters.map((d) => ({ kind: 'radio', label: d.name, set: (ip) => { d.ip = ip; } })),
      { kind: 'radio', label: 'Spectera base station', set: (ip) => { rf().spectera = { ...rf().spectera, ip }; } },
    ];
  }

  return { renderRios, renderAmps, renderRf, ipTargets, isRadio };
}
