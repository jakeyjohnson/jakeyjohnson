// The Amplifiers and RF tabs, and the stage boxes on the Desk tab. Shared by the app and the demo: the
// page hands in how to reach the devices (the app through its bridge, the demo pretends).
import { RIO_MODELS, buildPlan } from './plan.js';
import {
  AMP_INPUTS, AMP_MODELS, IEM_MODELS, RECEIVER_MODELS, SHURE_GAIN, SPEAKER_SETUPS, SPECTERA_LOWEST, addAmpsFor, ampPlan, defaultRf,
  isRadio, makeAmp, makeRfDevice, rfPlan, shureCommands, specteraWrites,
} from './rig.js';
import { el, info, panel, segmented, tag, toast } from './ui.js';

const MIC_TYPES = ['lectern', 'headset', 'handheld', 'vocal', 'talkback', 'instrument', 'acoustic'];
export const RANGES = [
  { label: 'UK ch 38 · 606.500–613.500', range: [606.5, 613.5] },
  { label: 'G50 / G51 · 470–534', range: [470, 534] },
  { label: 'H50 / H51 · 534–598', range: [534, 598] },
  { label: 'K51 · 606–670', range: [606, 670] },
  { label: 'PSM1000 G10 · 470–542', range: [470, 542] },
];

const select = (value, options, onchange, extra = {}) => el('select', { onchange: (e) => onchange(e.target.value), ...extra },
  ...options.map(([v, label]) => el('option', { value: v, textContent: label, selected: v === value })));
const table = (head, rows) => el('div', { className: 'table-wrap' }, el('table', {},
  el('thead', {}, el('tr', {}, ...head.map((h) => el('th', { textContent: h })))), el('tbody', {}, ...rows)));
const warnList = (list) => (list.length ? el('ul', { className: 'warnings' }, ...list.map((w) => el('li', { textContent: w }))) : null);
const empty = (text) => el('div', { className: 'empty', textContent: text });
const fmt = (f) => (f ? f.toFixed(3) : '');
const remove = (label, onclick) => el('button', { className: 'remove', type: 'button', textContent: '×', title: `Remove ${label}`, onclick });

export function mountRig({ getShow, update, transport, demo = false }) {
  const session = { password: '', packs: null, picks: {} };
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
      el('div', { className: 'chip-group' },
        el('span', { className: 'chip-label' }, 'Stage boxes', el('small', { textContent: 'on Dante' })),
        el('div', { className: 'chips' },
          ...s.rios.map((r, i) => el('span', { className: 'pill' }, el('b', { textContent: `Rio ${i + 1}` }), ` ${r.model} · ${RIO_MODELS[r.model].ins}/${RIO_MODELS[r.model].outs}`,
            remove(`Rio ${i + 1}`, () => update(() => s.rios.splice(i, 1))))),
          ...Object.keys(RIO_MODELS).map((m) => el('button', { className: 'chip', type: 'button', textContent: m, onclick: () => update(() => s.rios.push({ model: m })) })),
          info('Each Rio takes the next block of the desk\'s Dante channels, in this order. Set its UNIT ID to match and subscribe it in Dante Controller or on the desk; Paperwork lists every route. Gain and 48V on its sockets come from the desk, so safe start covers them.'))));
  }

  // ---- Amplifiers tab ----
  function renderAmps(main) {
    const s = show();
    s.amps ||= [];
    s.ampSettings ||= {};
    const plan = buildPlan(s);
    const amp = ampPlan(s, plan);
    const used = amp.rows.filter((r) => r.feed).length;
    const setting = (feed, key, value) => update(() => { s.ampSettings[feed.key] = { ...(s.ampSettings[feed.key] || {}), [key]: value }; });
    let addModel = s.amps.at(-1)?.model || 'D80';
    const modelOptions = Object.entries(AMP_MODELS).map(([k, m]) => [k, m.label]);

    const ampRows = s.amps.map((a, i) => el('tr', {},
      el('td', { className: 'name' }, el('input', { value: a.name, 'aria-label': 'Amp name', onchange: (e) => update(() => { a.name = e.target.value.trim() || a.name; }) })),
      el('td', {}, select(a.model, modelOptions, (v) => update(() => { a.model = v; }), { 'aria-label': 'Model' })),
      el('td', {}, el('input', { value: a.ip, placeholder: 'IP', inputMode: 'decimal', className: 'ip', 'aria-label': `${a.name} IP`, onchange: (e) => update(() => { a.ip = e.target.value.trim(); }) })),
      el('td', { className: 'ch', textContent: `${AMP_MODELS[a.model]?.channels || 0} ch` }),
      el('td', {}, remove(a.name, () => update(() => s.amps.splice(i, 1))))));
    const chRows = amp.rows.map((r) => el('tr', { className: r.feed ? '' : 'spare' },
      el('td', {}, el('b', { textContent: r.label })),
      el('td', { textContent: r.feed ? r.feed.name : 'spare' }),
      el('td', { className: 'mono dim', textContent: r.feed ? r.feed.deskOutLabel : '' }),
      el('td', {}, r.feed && select(r.input, AMP_INPUTS.map((x) => [x, x]), (v) => setting(r.feed, 'input', v), { 'aria-label': 'Amp input' })),
      el('td', {}, r.feed && el('input', { value: r.setup, className: 'setup', 'aria-label': 'Speaker setup', list: 'kkSetups', onchange: (e) => setting(r.feed, 'setup', e.target.value.trim()) })),
      el('td', {}, r.feed && el('input', { type: 'number', step: '0.5', min: '-57.5', max: '6', value: r.target, className: 'port', 'aria-label': 'Target gain in dB', onchange: (e) => setting(r.feed, 'target', Number(e.target.value) || 0) }), r.feed ? el('span', { className: 'dim', textContent: ' dB' }) : null)));

    main.replaceChildren(
      panel({
        step: '01', title: 'Amplifiers', meta: s.amps.length ? `${plural(s.amps.length, 'amp')} · ${used}/${amp.rows.length} ch` : '',
        tools: [
          select(addModel, modelOptions, (v) => { addModel = v; }, { 'aria-label': 'Amp model to add' }),
          el('button', { className: 'ghost', type: 'button', textContent: 'Add amp', onclick: () => update(() => s.amps.push(makeAmp(addModel, s.amps.length + 1))) }),
          el('button', { className: 'primary', type: 'button', textContent: 'Fill from outputs', title: 'Add amps until every speaker output has a channel', onclick: () => update(() => addAmpsFor(s, plan, addModel)) }),
        ],
      }, s.amps.length ? table(['Name', 'Model', 'IP', '', ''], ampRows) : empty('No amps yet. Fill from outputs adds enough for every speaker output.')),
      panel({ step: '02', title: 'Amp patch', meta: amp.feeds.length ? plural(amp.feeds.length, 'feed') : '', tools: [tag('Starts muted, gain lowest', 'on')] },
        amp.rows.length ? table(['Amp channel', 'Feeds', 'From desk', 'Amp input', 'Speaker setup', 'Target'], chRows) : empty('Add an amp to see which output goes where.'),
        el('datalist', { id: 'kkSetups' }, ...SPEAKER_SETUPS.map((x) => el('option', { value: x }))),
        warnList(amp.warnings)),
      panel({ step: '03', title: 'Set up in R1', tools: [tag('Not sent from here', '', 'd&b doesn\'t publish the control list for its AES70 interface, so these settings go in R1. Print them from Export → Paperwork.')] },
        el('ol', { className: 'steps' },
          el('li', { textContent: 'Fixed IP on each amp, entered above' }),
          el('li', { textContent: 'In R1: speaker setup and input per channel, from the patch' }),
          el('li', { textContent: 'Every channel muted, gain right down' }),
          el('li', { textContent: 'Unmute one at a time and bring up to target' }))),
    );
  }

  // ---- RF tab ----
  function deviceTable(kind, devices, models) {
    const rows = devices.map((d, i) => el('tr', {},
      el('td', { className: 'name' }, el('input', { value: d.name, 'aria-label': 'Name', onchange: (e) => update(() => { d.name = e.target.value.trim() || d.name; }) })),
      el('td', {}, select(d.model, Object.entries(models).map(([k, m]) => [k, m.label]), (v) => update(() => { d.model = v; }), { 'aria-label': 'Model' })),
      el('td', {}, el('input', { value: d.ip, placeholder: 'IP', inputMode: 'decimal', className: 'ip', 'aria-label': `${d.name} IP`, onchange: (e) => update(() => { d.ip = e.target.value.trim(); }) })),
      el('td', { className: 'ch', textContent: `${models[d.model]?.channels || 0} ch` }),
      el('td', {}, remove(d.name, () => update(() => devices.splice(i, 1))))));
    return devices.length ? table(['Name', 'Model', 'IP', '', ''], rows) : null;
  }
  function deviceTools(kind, devices, models) {
    let addModel = devices.at(-1)?.model || (kind === 'rx' ? 'ULXD4Q' : 'P10T');
    return [
      select(addModel, Object.entries(models).map(([k, m]) => [k, m.label]), (v) => { addModel = v; }, { 'aria-label': 'Model to add' }),
      el('button', { className: 'ghost', type: 'button', textContent: 'Add', onclick: () => update(() => devices.push(makeRfDevice(kind, addModel, devices.length + 1))) }),
      el('button', {
        className: 'primary', type: 'button', textContent: 'Fill', title: kind === 'rx' ? 'Add receivers until every radio mic has a channel' : 'Add transmitters until every IEM has a channel',
        onclick: () => update(() => {
          const rig = rfPlan(show(), buildPlan(show()));
          const need = (kind === 'rx' ? rig.mics : rig.iems).filter((x) => !x.device).length;
          let room = 0;
          while (room < need) { devices.push(makeRfDevice(kind, addModel, devices.length + 1)); room += models[addModel].channels; }
        }),
      }),
    ];
  }
  const freqCell = (item) => el('input', {
    value: fmt(item.freq), placeholder: 'auto', inputMode: 'decimal', className: `freq ${item.freqFixed ? 'fixed' : ''}`, 'aria-label': `${item.name} frequency in MHz`,
    title: item.freqFixed ? 'Set by hand. Clear it to let the plan choose.' : 'Chosen by the plan. Type a frequency to fix it.',
    onchange: (e) => update(() => {
      const r = rf();
      const v = Number(e.target.value);
      if (e.target.value.trim() && v > 0) r.fixed = { ...r.fixed, [item.key]: Math.round(v * 40) / 40 };
      else { const { [item.key]: _, ...rest } = r.fixed || {}; r.fixed = rest; }
    }),
  });
  function rangeRow(label, key) {
    const [lo, hi] = rf()[key];
    const set = (i, v) => update(() => { const next = [...rf()[key]]; next[i] = Number(v) || next[i]; rf()[key] = next; });
    return el('div', { className: 'setting' },
      el('span', { className: 'switch-label', textContent: label }), el('span', { className: 'grow' }),
      el('span', { className: 'range' },
        el('input', { type: 'number', step: '0.025', value: lo, className: 'freq', 'aria-label': `${label} from, MHz`, onchange: (e) => set(0, e.target.value) }), '–',
        el('input', { type: 'number', step: '0.025', value: hi, className: 'freq', 'aria-label': `${label} to, MHz`, onchange: (e) => set(1, e.target.value) }), 'MHz'),
      select('', [['', 'Preset'], ...RANGES.map((x, i) => [String(i), x.label])], (v) => v && update(() => { rf()[key] = [...RANGES[Number(v)].range]; }), { 'aria-label': `${label} preset range` }));
  }

  async function runShure(check, out) {
    const rig = rfPlan(show(), buildPlan(show()));
    const jobs = shureCommands(rig, { safe: true });
    if (!jobs.length) return toast('Put an IP on a receiver first', 'bad');
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
      ? (bad ? `${bad} of ${total} differ` : `All ${total} match`)
      : (bad ? `${bad} didn't land` : `Sent ${total} settings · gain ${SHURE_GAIN.min} dB`);
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
        el('td', { className: m?.label ? '' : 'dim', textContent: m ? m.label || 'no receiver' : 'wired' }),
        el('td', {}, m && r.mics === 'shure' ? freqCell(m) : m ? el('span', { className: 'dim', textContent: 'Spectera' }) : null),
        el('td', { className: 'mono dim', textContent: m ? `${r.mics === 'shure' ? SHURE_GAIN.min : m.pack === 'SKM' ? SPECTERA_LOWEST.skmGain : SPECTERA_LOWEST.sekGain} dB` : '' }));
    });
    const iemRows = rig.iems.map((x) => el('tr', {},
      el('td', { className: 'ch', textContent: x.buses.replace(/MIX/g, '') }),
      el('td', { textContent: x.name }),
      el('td', { className: 'dim', textContent: x.stereo ? 'Stereo' : 'Mono' }),
      el('td', { className: x.label ? '' : 'dim', textContent: x.label || 'no transmitter' }),
      el('td', {}, r.iems === 'shure' ? freqCell(x) : el('span', { className: 'dim', textContent: 'Spectera' })),
      el('td', { className: 'mono dim', textContent: x.deskOut })));

    const shureOut = { status: el('span', { className: 'status', role: 'status' }), log: el('pre', { className: 'log', hidden: true }) };
    const spec = { status: el('span', { className: 'status', role: 'status' }), list: el('div') };
    const specItems = [...(r.mics === 'spectera' ? rig.mics : []), ...(r.iems === 'spectera' ? rig.iems : [])];
    const renderPicks = () => {
      if (!session.packs) return spec.list.replaceChildren();
      const options = [['', 'Pick a pack'], ...session.packs.map((p) => [String(p.mtUid), `${p.type} · ${p.name || 'unnamed'}${p.serial ? ` · ${p.serial}` : ''}`])];
      spec.list.replaceChildren(table(['Name', 'Needs', 'Pack'], specItems.map((item) => el('tr', {},
        el('td', { textContent: item.name }), el('td', { className: 'mono dim', textContent: item.pack }),
        el('td', {}, select(String(session.picks[item.key]?.mtUid ?? ''), options, (v) => { session.picks[item.key] = session.packs.find((p) => String(p.mtUid) === v) || null; }, { 'aria-label': `Pack for ${item.name}` }))))));
    };
    renderPicks();

    const sendBlocks = [];
    if (r.mics === 'shure') {
      sendBlocks.push(el('div', { className: 'subhead' }, el('span', { className: 'chip-label', textContent: 'Shure receivers' }),
        info(`Name, frequency and gain at ${SHURE_GAIN.min} dB (the lowest) to every receiver channel with an IP, over port 2202. Bring gains up at line check.`)),
      el('div', { className: 'actionbar' },
        el('button', { className: 'primary', type: 'button', textContent: 'Send to receivers', onclick: () => runShure(false, shureOut) }),
        el('button', { className: 'ghost', type: 'button', textContent: 'Check', onclick: () => runShure(true, shureOut) }),
        shureOut.status),
      shureOut.log);
    }
    if (r.iems === 'shure' && rig.iems.length) {
      sendBlocks.push(el('div', { className: 'subhead' }, el('span', { className: 'chip-label', textContent: 'PSM transmitters' }),
        tag('Set in Wireless Workbench', '', 'Shure\'s PSM control strings aren\'t confirmed yet, so set names and frequencies in Wireless Workbench from this page, with levels right down.')));
    }
    if (specItems.length) {
      sendBlocks.push(el('div', { className: 'subhead' }, el('span', { className: 'chip-label', textContent: 'Spectera' }),
        info(`Names each pack and sets mic gain and headphone level to their lowest. Turn on third-party access on the base station first. The password is kept only until the page closes.${demo ? ' In the demo any password works.' : ''}`)),
      el('div', { className: 'actionbar' },
        el('input', { value: r.spectera.ip, inputMode: 'decimal', className: 'ip', placeholder: 'Base station IP', 'aria-label': 'Base station IP', onchange: (e) => update(() => { rf().spectera = { ...rf().spectera, ip: e.target.value.trim() }; }) }),
        el('input', { type: 'password', value: session.password, autocomplete: 'off', placeholder: 'Password', 'aria-label': 'Base station password', oninput: (e) => { session.password = e.target.value; } }),
        el('button', {
          className: 'ghost', type: 'button', textContent: 'Read packs', onclick: async () => {
            spec.status.className = 'status';
            spec.status.textContent = 'Reading…';
            try {
              session.packs = await transport.specteraDevices(rf().spectera.ip, session.password);
              spec.status.textContent = `${plural(session.packs.length, 'pack')} paired`;
              spec.status.className = 'status ok';
              renderPicks();
            } catch (err) { spec.status.textContent = err.message; spec.status.className = 'status bad'; }
          },
        }),
        el('button', {
          className: 'primary', type: 'button', textContent: 'Send names and safe gains', onclick: async () => {
            const writes = specteraWrites(rfPlan(show(), buildPlan(show())), session.picks);
            if (!writes.length) return toast('Read the packs and match them first', 'bad');
            try {
              const results = await transport.specteraPush(rf().spectera.ip, session.password, writes);
              const bad = results.filter((x) => !x.ok);
              spec.status.className = `status ${bad.length ? 'bad' : 'ok'}`;
              spec.status.textContent = bad.length ? `${bad.length} didn't take it: ${bad[0].error}` : `${plural(results.length, 'pack')} named · gains lowest`;
            } catch (err) { spec.status.textContent = err.message; spec.status.className = 'status bad'; }
          },
        }),
        spec.status),
      spec.list);
    }

    main.replaceChildren(
      panel({ step: '01', title: 'Radio mics', meta: rig.mics.length ? plural(rig.mics.length, 'mic') : '',
        tools: [segmented(r.mics, [['shure', 'Shure'], ['spectera', 'Spectera']], (v) => update(() => { rf().mics = v; }), 'Radio mic system'), ...(r.mics === 'shure' ? deviceTools('rx', r.receivers, RECEIVER_MODELS) : [])] },
      r.mics === 'shure' ? deviceTable('rx', r.receivers, RECEIVER_MODELS) : null,
      micRows.length ? table(['Ch', 'Name', 'Radio', 'Channel', 'MHz', 'Start'], micRows) : empty('Add mics on the Desk tab first.')),
      panel({ step: '02', title: 'IEMs', meta: rig.iems.length ? plural(rig.iems.length, 'mix', 'mixes') : '',
        tools: [segmented(r.iems, [['shure', 'Shure PSM'], ['spectera', 'Spectera']], (v) => update(() => { rf().iems = v; }), 'IEM system'), ...(r.iems === 'shure' ? deviceTools('tx', r.transmitters, IEM_MODELS) : [])] },
      r.iems === 'shure' ? deviceTable('tx', r.transmitters, IEM_MODELS) : null,
      iemRows.length ? table(['Mix', 'Name', '', 'Channel', 'MHz', 'From desk'], iemRows) : empty('Add a mono or stereo IEM output on the Desk tab.')),
      panel({ step: '03', title: 'Frequencies', tools: [
        el('button', { className: 'ghost small', type: 'button', textContent: 'Clear fixed', title: 'Let the plan choose every frequency again', onclick: () => update(() => { rf().fixed = {}; }) }),
        info('A starting plan on a 25 kHz grid: mics 400 kHz apart, IEMs 600 kHz apart, clear of third-order intermod between every transmitter. Scan the room and check it in Wireless Workbench before the show.')] },
      el('div', { className: 'settings rows' },
        rangeRow('Radio mics', 'micRange'),
        rangeRow('IEMs', 'iemRange'),
        rig.usesSpectera ? el('div', { className: 'setting' }, el('span', { className: 'switch-label', textContent: 'Spectera RF channel' }), el('span', { className: 'grow' }),
          el('span', { className: 'range' }, el('input', { type: 'number', step: '0.025', value: r.spectera.frequency || '', className: 'freq', placeholder: 'centre', 'aria-label': 'Spectera centre frequency, MHz', onchange: (e) => update(() => { rf().spectera = { ...rf().spectera, frequency: Number(e.target.value) || 0 }; }) }), 'MHz'),
          select(String(r.spectera.bandwidth), [['6', '6 MHz'], ['8', '8 MHz'], ['10', '10 MHz']], (v) => update(() => { rf().spectera = { ...rf().spectera, bandwidth: Number(v) }; }), { 'aria-label': 'Spectera bandwidth' })) : null),
      warnList(rig.warnings)),
      panel({ step: '04', title: 'Send to RF' }, ...(sendBlocks.length ? sendBlocks : [empty('Nothing to send yet.')])),
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

  // Counts for the tab labels
  function counts() {
    const s = show();
    const plan = buildPlan(s);
    const rig = rfPlan(s, plan);
    return { amps: (s.amps || []).length, rf: rig.mics.length + rig.iems.length };
  }

  return { renderRios, renderAmps, renderRf, ipTargets, counts, isRadio };
}

function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
