// The Amplifiers and RF tabs, and the stage boxes on the Desk tab. Shared by the app and the demo: the
// page hands in how to reach the devices (the app through its bridge, the demo pretends).
import { RIO_MODELS, buildPlan } from './plan.js';
import {
  AMP_CHANNEL_NAMES, AMP_INPUTS, AMP_MODELS, AMP_MODES, rowFeedName, IEM_MODELS, RECEIVER_MODELS, SHURE_GAIN, SPEAKER_SETUPS, SPECTERA_LOWEST, addAmpsFor, ampPlan, ampReadSummary, applyShureReads, defaultRf,
  isRadio, makeAmp, makeRfDevice, parseShureReads, rfPlan, shureCommands, shureReadLines, specteraWrites,
} from './rig.js';
import { makeRackUi } from './rack-ui.js';
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
  const racks = makeRackUi({ show, update, transport, session });
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
    const setting = (row, key, value) => update(() => { s.ampSettings[row.settingsKey] = { ...(s.ampSettings[row.settingsKey] || {}), [key]: value }; });
    let addMode = s.amps.at(-1)?.mode || 'dual';
    let addModel = s.amps.at(-1)?.model || 'D80';
    const modelOptions = Object.entries(AMP_MODELS).map(([k, m]) => [k, m.label]);

    const chRows = amp.rows.map((r) => el('tr', { className: `${r.feed ? '' : 'spare'} ${r.sub ? 'sub-row' : ''}` },
      el('td', {}, el('b', { textContent: r.label }), r.sub ? el('small', { className: 'dim', textContent: ' sub' }) : null),
      el('td', { textContent: r.feed ? rowFeedName(r) : 'spare' }),
      el('td', { className: 'mono dim', textContent: r.feed && !r.sub ? r.feed.deskOutLabel : '' }),
      el('td', {}, r.feed && (r.sub ? el('span', { className: 'dim', textContent: `${r.input}, with Ch ${AMP_CHANNEL_NAMES[r.index - 1]}` })
        : select(r.input, AMP_INPUTS.map((x) => [x, x]), (v) => setting(r, 'input', v), { 'aria-label': 'Amp input' }))),
      el('td', {}, r.feed && el('input', { value: r.setup, className: 'setup', 'aria-label': 'Speaker setup', list: 'kkSetups', onchange: (e) => setting(r, 'setup', e.target.value.trim()) })),
      el('td', {}, r.feed && el('input', { type: 'number', step: '0.5', min: '-57.5', max: '6', value: r.target, className: 'port', 'aria-label': 'Target gain in dB', onchange: (e) => setting(r, 'target', Number(e.target.value) || 0) }), r.feed ? el('span', { className: 'dim', textContent: ' dB' }) : null)));

    main.replaceChildren(...[
      panel({
        step: '01', title: 'Amp racks', meta: s.amps.length ? `${plural(s.amps.length, 'amp')} · ${used}/${amp.rows.length} ch` : '',
        tools: [
          select(addModel, modelOptions, (v) => { addModel = v; }, { 'aria-label': 'Amp model to add' }),
          select(addMode, Object.entries(AMP_MODES), (v) => { addMode = v; }, { 'aria-label': 'Mode for amps added' }),
          el('button', { className: 'ghost', type: 'button', textContent: 'Add amp', onclick: () => update(() => s.amps.push({ ...makeAmp(addModel, s.amps.length + 1), mode: addMode })) }),
          el('button', { className: 'primary', type: 'button', textContent: 'Fill from outputs', title: 'Add amps until every speaker output has a channel', onclick: () => update(() => addAmpsFor(s, plan, addModel, addMode)) }),
          ...racks.rackTools('amp'),
        ],
      }, s.amps.length || session.found.some((d) => d.kind === 'amp') ? racks.racksView('amp', {
        feeds: racks.ampFeeds(amp.rows),
        extra: (a) => [el('button', {
          className: 'ghost small', type: 'button', textContent: 'Read', disabled: !a.ip, title: a.ip ? `${readText(s.ampReads?.[a.id]) || 'Read'}: reads ${a.name}'s control list and saves it to a file. Nothing on the amp changes.` : 'Put the amp\'s IP in first',
          onclick: (e) => readAmp(a, e.currentTarget),
        })],
      }) : empty('No amps yet. Fill from outputs adds enough for every speaker output, or rack the ones Find devices finds.')),
      panel({ step: '02', title: 'Amp patch', meta: amp.feeds.length ? plural(amp.feeds.length, 'feed') : '', tools: [tag('Starts muted, gain lowest', 'on')] },
        amp.rows.length ? table(['Amp channel', 'Feeds', 'From desk', 'Amp input', 'Speaker setup', 'Target'], chRows) : empty('Add an amp to see which output goes where.'),
        el('datalist', { id: 'kkSetups' }, ...SPEAKER_SETUPS.map((x) => el('option', { value: x }))),
        warnList(amp.warnings)),
      panel({ step: '03', title: 'Set up in R1', tools: [tag('Not sent from here yet', '', 'Live control comes once a real amp\'s control list has been read: press Read on an amp above and send the file it saves. Until then these settings go in R1; print them from Export → Paperwork.')] },
        el('ol', { className: 'steps' },
          el('li', { textContent: 'Fixed IP on each amp, racked above in the order they sit' }),
          el('li', { textContent: 'In R1: speaker setup and input per channel, from the patch' }),
          el('li', { textContent: 'Every channel muted, gain right down' }),
          el('li', { textContent: 'Unmute one at a time and bring up to target' }))),
      ampReadsPanel(s),
    ].filter(Boolean));
  }

  // Reads an amp's AES70 control list into the show, and saves the full list to a file so the amp's
  // controls can be mapped for live control
  const readText = (r) => (r ? `${[r.model, `${r.controls.length} controls`].filter(Boolean).join(' · ')} · read ${r.at.slice(11, 16)}` : '');
  async function readAmp(a, button) {
    button.disabled = true;
    button.textContent = 'Reading…';
    try {
      await racks.confirmUnit(a, 'amp');
      const dump = await transport.ampRead(a.ip);
      const count = (name) => dump.objects.filter((o) => o.className === name).length;
      show().ampReads = { ...(show().ampReads || {}), [a.id]: ampReadSummary(dump) };
      transport.save(`amp-${String(dump.device.model || a.model).replace(/[^\w.-]+/g, '-')}-${a.ip}.json`, JSON.stringify(dump, null, 2));
      toast(`${a.name}: ${dump.objects.length} controls, ${count('OcaMute')} mutes, ${count('OcaGain')} gains. Saved.`, 'ok');
    } catch (err) {
      toast(`${a.name}: ${err.message}`, 'bad');
    }
    update(() => {});
  }
  // What each amp held when it was last read
  function ampReadsPanel(s) {
    const reads = (s.amps || []).filter((a) => s.ampReads?.[a.id]);
    if (!reads.length) return null;
    return panel({ step: '04', title: 'From the amps', meta: plural(reads.length, 'amp') },
      ...reads.map((a) => {
        const r = s.ampReads[a.id];
        return el('details', { className: 'amp-read' },
          el('summary', {}, el('b', { textContent: a.name }), el('span', { className: 'dim', textContent: ` ${[r.model, r.name, r.serial && `#${r.serial}`].filter(Boolean).join(' · ')}` }), el('span', { className: 'mono dim', textContent: `  ${r.controls.length} controls · ${r.at.slice(0, 16).replace('T', ' ')}` })),
          table(['Control', 'Kind', 'Value'], r.controls.map((c) => el('tr', {},
            el('td', { textContent: c.path }), el('td', { className: 'dim', textContent: c.kind }), el('td', { className: 'mono', textContent: String(c.value ?? '') })))));
      }));
  }

  // Reads every amp and Shure receiver that has an IP (and Spectera, once its password is in) into the show
  async function readKit(onStep = () => {}) {
    const s = show();
    const r = rf();
    const out = { amps: 0, receivers: 0, mics: 0, packs: 0, errors: [] };
    for (const a of (s.amps || []).filter((x) => x.ip)) {
      onStep(a.name);
      try {
        await racks.confirmUnit(a, 'amp');
        s.ampReads = { ...(s.ampReads || {}), [a.id]: ampReadSummary(await transport.ampRead(a.ip)) };
        out.amps++;
      } catch (err) { out.errors.push(`${a.name}: ${err.message}`); }
    }
    if (r.mics === 'shure') {
      for (const d of r.receivers.filter((x) => x.ip)) {
        onStep(d.name);
        try { await racks.confirmUnit(d, 'rf'); } catch (err) { out.errors.push(err.message); continue; }
        const replies = [];
        const result = await transport.shure(d.ip, shureReadLines(d), false, (x) => replies.push(x.reply));
        if (result?.error) { out.errors.push(`${d.name}: ${result.error}`); continue; }
        out.mics += applyShureReads(s, buildPlan(s), d, parseShureReads(replies));
        out.receivers++;
      }
    }
    if (r.spectera.ip && session.password) {
      onStep('Spectera');
      try {
        session.packs = await transport.specteraDevices(r.spectera.ip, session.password);
        r.spectera = { ...r.spectera, packs: session.packs.map((p) => ({ type: p.type, name: p.name || '', serial: p.serial || '' })) };
        out.packs = session.packs.length;
      } catch (err) { out.errors.push(`Spectera: ${err.message}`); }
    }
    update(() => {});
    return out;
  }

  // ---- RF tab ----
  // Adding and filling Shure units for the RF racks: receivers for the radio mics, transmitters for IEMs
  function rfRackTools(r) {
    const kinds = [...(r.mics === 'shure' ? [['rx', RECEIVER_MODELS]] : []), ...(r.iems === 'shure' ? [['tx', IEM_MODELS]] : [])];
    let add = `${kinds[0][0]}:${kinds[0][0] === 'rx' ? (r.receivers.at(-1)?.model || 'ULXD4Q') : (r.transmitters.at(-1)?.model || 'P10T')}`;
    const listOf = (kind) => (kind === 'rx' ? rf().receivers : rf().transmitters);
    return [
      el('select', { 'aria-label': 'Unit to add', onchange: (e) => { add = e.target.value; } },
        ...kinds.map(([kind, models]) => el('optgroup', { label: kind === 'rx' ? 'Receivers' : 'IEM transmitters' },
          ...Object.entries(models).map(([k, m]) => el('option', { value: `${kind}:${k}`, textContent: m.label, selected: `${kind}:${k}` === add }))))),
      el('button', { className: 'ghost', type: 'button', textContent: 'Add', onclick: () => update(() => { const [kind, model] = add.split(':'); listOf(kind).push(makeRfDevice(kind, model, listOf(kind).length + 1)); }) }),
      el('button', {
        className: 'primary', type: 'button', textContent: 'Fill', title: 'Add units until every radio mic and IEM has a channel',
        onclick: () => update(() => {
          const rig = rfPlan(show(), buildPlan(show()));
          for (const [kind, models] of kinds) {
            const list = listOf(kind);
            const model = list.at(-1)?.model || (add.startsWith(`${kind}:`) ? add.split(':')[1] : Object.keys(models)[0]);
            const need = (kind === 'rx' ? rig.mics : rig.iems).filter((x) => !x.device).length;
            for (let room = 0; room < need; room += models[model].channels) list.push(makeRfDevice(kind, model, list.length + 1));
          }
        }),
      }),
      ...racks.rackTools('rf'),
    ];
  }
  // What each receiver or transmitter channel carries
  const rfFeeds = (rig) => (u) => {
    const tx = rf().transmitters.includes(u);
    const n = (tx ? IEM_MODELS : RECEIVER_MODELS)[u.model]?.channels || 0;
    return [...Array(n).keys()].map((k) => [String(k + 1), (tx ? rig.iems : rig.mics).find((x) => x.device === u && x.channel === k + 1)?.name || '']);
  };
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
      const unit = rf().receivers.find((d) => d.ip === job.host);
      try { if (unit) await racks.confirmUnit(unit, 'rf'); } catch (err) { bad++; out.log.textContent += `  ✗ ${err.message} Nothing sent.\n`; continue; }
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
    // What each receiver channel held when it was last read
    const anyRead = r.mics === 'shure' && Object.keys(r.read || {}).length > 0;
    const readCell = (m) => {
      const got = m?.device && r.read?.[m.device.id]?.channels.find((x) => x.ch === m.channel);
      return got ? [got.name, got.gain != null && `${got.gain > 0 ? '+' : ''}${got.gain} dB`].filter(Boolean).join(' · ') : '';
    };
    const micRows = plan.channels.filter((c) => c.side !== 'R' && MIC_TYPES.includes(c.source.type)).map((c) => {
      const m = rig.mics.find((x) => x.source === c.source);
      return el('tr', { className: m ? '' : 'spare' },
        el('td', { className: 'ch', textContent: c.ch }),
        el('td', { textContent: c.name }),
        el('td', {}, el('input', { type: 'checkbox', checked: Boolean(m), 'aria-label': `${c.name} is a radio mic`, onchange: (e) => update(() => { c.source.radio = e.target.checked; }) })),
        el('td', { className: m?.label ? '' : 'dim', textContent: m ? m.label || 'no receiver' : 'wired' }),
        el('td', {}, m && r.mics === 'shure' ? freqCell(m) : m ? el('span', { className: 'dim', textContent: 'Spectera' }) : null),
        el('td', { className: 'mono dim', textContent: m ? `${r.mics === 'shure' ? SHURE_GAIN.min : m.pack === 'SKM' ? SPECTERA_LOWEST.skmGain : SPECTERA_LOWEST.sekGain} dB` : '' }),
        anyRead ? el('td', { className: 'mono dim', textContent: readCell(m) }) : null);
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

    let step = 0;
    const next = () => String(++step).padStart(2, '0');
    const shureRack = r.mics === 'shure' || r.iems === 'shure';
    main.replaceChildren(...[
      shureRack ? panel({ step: next(), title: 'RF racks', meta: r.receivers.length + r.transmitters.length ? plural(r.receivers.length + r.transmitters.length, 'unit') : '', tools: rfRackTools(r) },
        r.receivers.length + r.transmitters.length || session.found.some((d) => d.make === 'Shure')
          ? racks.racksView('rf', {
            feeds: rfFeeds(rig),
            extra: (u) => [el('button', { className: 'ghost small', type: 'button', textContent: 'Flash', disabled: !u.ip, title: u.ip ? `Flash ${u.name}'s front panel to find it in the rack` : 'Put its IP in first', onclick: (e) => racks.flash(u, e.currentTarget) })],
          })
          : empty('No units yet. Fill adds enough for every radio mic and IEM, or rack the ones Find devices finds.')) : null,
      panel({ step: next(), title: 'Radio mics', meta: rig.mics.length ? plural(rig.mics.length, 'mic') : '',
        tools: [segmented(r.mics, [['shure', 'Shure'], ['spectera', 'Spectera']], (v) => update(() => { rf().mics = v; }), 'Radio mic system')] },
      micRows.length ? table(['Ch', 'Name', 'Radio', 'Channel', 'MHz', 'Start', ...(anyRead ? ['On receiver'] : [])], micRows) : empty('Add mics on the Desk tab first.')),
      panel({ step: next(), title: 'IEMs', meta: rig.iems.length ? plural(rig.iems.length, 'mix', 'mixes') : '',
        tools: [segmented(r.iems, [['shure', 'Shure PSM'], ['spectera', 'Spectera']], (v) => update(() => { rf().iems = v; }), 'IEM system')] },
      iemRows.length ? table(['Mix', 'Name', '', 'Channel', 'MHz', 'From desk'], iemRows) : empty('Add a mono or stereo IEM output on the Desk tab.')),
      panel({ step: next(), title: 'Frequencies', tools: [
        el('button', { className: 'ghost small', type: 'button', textContent: 'Clear fixed', title: 'Let the plan choose every frequency again', onclick: () => update(() => { rf().fixed = {}; }) }),
        info('A starting plan on a 25 kHz grid: mics 400 kHz apart, IEMs 600 kHz apart, clear of third-order intermod between every transmitter. Scan the room and check it in Wireless Workbench before the show.')] },
      el('div', { className: 'settings rows' },
        rangeRow('Radio mics', 'micRange'),
        rangeRow('IEMs', 'iemRange'),
        rig.usesSpectera ? el('div', { className: 'setting' }, el('span', { className: 'switch-label', textContent: 'Spectera RF channel' }), el('span', { className: 'grow' }),
          el('span', { className: 'range' }, el('input', { type: 'number', step: '0.025', value: r.spectera.frequency || '', className: 'freq', placeholder: 'centre', 'aria-label': 'Spectera centre frequency, MHz', onchange: (e) => update(() => { rf().spectera = { ...rf().spectera, frequency: Number(e.target.value) || 0 }; }) }), 'MHz'),
          select(String(r.spectera.bandwidth), [['6', '6 MHz'], ['8', '8 MHz'], ['10', '10 MHz']], (v) => update(() => { rf().spectera = { ...rf().spectera, bandwidth: Number(v) }; }), { 'aria-label': 'Spectera bandwidth' })) : null),
      warnList(rig.warnings)),
      panel({ step: next(), title: 'Send to RF' }, ...(sendBlocks.length ? sendBlocks : [empty('Nothing to send yet.')])),
    ].filter(Boolean));
  }

  // ---- Racks tab ----
  function renderRacks(main) {
    const s = show();
    const plan = buildPlan(s);
    const amps = racks.ampFeeds(ampPlan(s, plan).rows);
    const radios = rfFeeds(rfPlan(s, plan));
    racks.rackRoom(main, { feedsOf: (family, u) => (family === 'amp' ? amps(u) : radios(u)) });
  }

  // What Find devices can do with a device: rack an amp or Shure unit, or say which unit or base station it is
  function foundOptions(d) {
    if (d.kind === 'amp' || d.make === 'Shure') return racks.foundOptions(d);
    if (d.kind === 'radio' && d.ip) return [{ label: 'Is the Spectera base station', run: () => { update(() => { rf().spectera = { ...rf().spectera, ip: d.ip }; }); toast(`Spectera base station is at ${d.ip}`, 'ok'); } }];
    return [];
  }

  // Counts for the tab labels
  function counts() {
    const s = show();
    const plan = buildPlan(s);
    const rig = rfPlan(s, plan);
    return { amps: (s.amps || []).length, rf: rig.mics.length + rig.iems.length, racks: (s.racks || []).length };
  }

  return { renderRios, renderAmps, renderRf, renderRacks, foundOptions, setFound: racks.setFound, counts, isRadio, readKit };
}

function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
