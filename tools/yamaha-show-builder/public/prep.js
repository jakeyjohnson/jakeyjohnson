// Prep sheet: pick list with Out/Back ticks, racks with IPs, patch. Printed on white.
import { MODELS, SOURCE_TYPES, phantomOf, portLabel, safeLogo } from './plan.js';
import {
  AMP_MODELS,
  AMP_MODES,
  DS10,
  IEM_MODELS,
  RACK_ITEMS,
  RECEIVER_MODELS,
  ampPlan,
  ds10Plan,
  isRadio,
  rackEntries,
  rfPlan,
  rowFeedName,
  unitHeight,
} from './rig.js';

const esc = (v) =>
  String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// stereo ones get a stereo DI
const DI_TYPES = new Set(['keys', 'laptop', 'playback', 'bgm', 'bass']);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// keeps first-seen order
function tally(items, keyOf) {
  const m = new Map();
  for (const it of items) {
    const k = keyOf(it);
    if (k == null) continue;
    m.set(k, [...(m.get(k) || []), it]);
  }
  return [...m];
}

// [{ group, rows: [{ qty, item, note }] }]
export function pickList(show, plan) {
  const model = MODELS[show.options?.model];
  const amp = ampPlan(show, plan);
  const rig = rfPlan(show, plan);
  const groups = [];
  const add = (group, rows) => {
    if (rows.length) groups.push({ group, rows });
  };

  const network = [];
  add('Desk and stage boxes', [
    ...(model?.inputs ? [{ qty: 1, item: `Yamaha ${model.label}`, note: '' }] : []),
    ...tally(show.rios || [], (r) => r.model).map(([m, list]) => ({
      qty: list.length,
      item: `Yamaha ${m}`,
      note: 'Stage box',
    })),
  ]);
  if (model?.inputs) network.push('desk');
  network.push(...(show.rios || []).map(() => 'stage box'));

  const racks = show.racks || [];
  add('Racks', [
    ...racks.map((r) => ({
      qty: 1,
      item: r.name,
      note: [r.size ? `${r.size}U` : '', r.preset ? 'built rack: comes with its kit' : '']
        .filter(Boolean)
        .join(', '),
    })),
    ...tally(
      rackEntries(show).filter((e) => e.family === 'item' && e.unit.type !== 'space' && !e.unit.fixed),
      (e) => e.unit.name,
    ).map(([name, list]) => ({
      qty: list.length,
      item: name,
      note: RACK_ITEMS[list[0].unit.type]?.label !== name ? RACK_ITEMS[list[0].unit.type]?.label || '' : '',
    })),
  ]);

  add(
    'Amplifiers',
    tally(show.amps || [], (a) => `${a.model}|${a.mode || 'dual'}`)
      .map(([k, list]) => {
        const [m, mode] = k.split('|');
        network.push(...list.map(() => 'amp'));
        return {
          qty: list.length,
          item: AMP_MODELS[m]?.label || m,
          note: `${AMP_MODES[mode]} · ${list.map((a) => a.name).join(', ')}`,
        };
      })
      .concat(
        (show.ds10s || []).length
          ? [
              {
                qty: show.ds10s.length,
                item: DS10.label,
                note: `Dante to AES for the amps · ${show.ds10s.map((d) => d.name).join(', ')}`,
              },
            ]
          : [],
      ),
  );
  network.push(...(show.ds10s || []).map(() => 'DS10'));
  const used = amp.rows.filter((r) => r.feed);
  add(
    'Speakers',
    tally(used, (r) => r.setup || 'Speaker (setup not set)').map(([setup, rows]) => ({
      qty: '',
      item: setup,
      note: `${plural(rows.length, 'amp channel')}: ${rows.map(rowFeedName).join(', ')}. Count the boxes per channel.`,
    })),
  );

  const radioMics = rig.mics;
  const rfRows = [];
  if (rig.rf.mics === 'shure') {
    rfRows.push(
      ...tally(rig.rf.receivers, (d) => d.model).map(([m, list]) => ({
        qty: list.length,
        item: `Shure ${RECEIVER_MODELS[m]?.label.replace(/^Shure /, '') || m} receiver`,
        note: list.map((d) => d.name).join(', '),
      })),
    );
    network.push(...rig.rf.receivers.map(() => 'receiver'));
    const hh = radioMics.filter((m) => m.source.type === 'handheld').length;
    const packs = radioMics.length - hh;
    if (hh) rfRows.push({ qty: hh, item: 'Handheld transmitter', note: 'Matching the receivers' });
    if (packs)
      rfRows.push({
        qty: packs,
        item: 'Bodypack transmitter',
        note: `With ${plural(packs, 'headset or lapel mic', 'headset or lapel mics')}`,
      });
  } else if (radioMics.length) {
    const skm = radioMics.filter((m) => m.pack === 'SKM').length;
    if (skm) rfRows.push({ qty: skm, item: 'Sennheiser Spectera SKM handheld', note: '' });
    if (radioMics.length - skm)
      rfRows.push({
        qty: radioMics.length - skm,
        item: 'Sennheiser Spectera SEK bodypack',
        note: 'For mics',
      });
  }
  if (rig.rf.iems === 'shure') {
    rfRows.push(
      ...tally(rig.rf.transmitters, (d) => d.model).map(([m, list]) => ({
        qty: list.length,
        item: `Shure ${IEM_MODELS[m]?.label.replace(/^Shure /, '') || m} transmitter`,
        note: list.map((d) => d.name).join(', '),
      })),
    );
    network.push(...rig.rf.transmitters.map(() => 'IEM transmitter'));
    if (rig.iems.length)
      rfRows.push({
        qty: rig.iems.length,
        item: 'IEM bodypack',
        note: `One per mix: ${rig.iems.map((x) => x.name).join(', ')}. Plus earpieces.`,
      });
  } else if (rig.iems.length) {
    rfRows.push({
      qty: rig.iems.length,
      item: 'Sennheiser Spectera SEK bodypack',
      note: 'For IEMs. Plus earpieces.',
    });
  }
  if (rig.usesSpectera) {
    rfRows.push({ qty: 1, item: 'Sennheiser Spectera base station', note: '' });
    network.push('Spectera');
  }
  add('Radio mics and IEMs', rfRows);

  // one mic per mono channel by type, a DI per DI-type input (stereo DI for stereo)
  const wired = show.sources.filter((s) => !isRadio(s));
  const mics = wired.filter((s) => !DI_TYPES.has(s.type));
  const dis = wired.filter((s) => DI_TYPES.has(s.type));
  add('Mics and DIs', [
    ...tally(mics, (s) => SOURCE_TYPES[s.type].label).map(([label, list]) => ({
      qty: list.reduce((n, s) => n + (s.stereo ? 2 : 1), 0),
      item: label,
      note:
        [...new Set(list.map((s) => s.note).filter(Boolean))].join(', ') ||
        list.map((s) => s.name).join(', '),
    })),
    ...tally(dis, (s) => (s.stereo ? 'Stereo DI' : 'DI')).map(([kind, list]) => ({
      qty: list.length,
      item: kind,
      note: list.map((s) => s.name).join(', '),
    })),
  ]);

  const micLines = plan.channels.filter((c) => !isRadio(c.source)).length;
  const cables = [];
  if (micLines)
    cables.push({
      qty: micLines,
      item: 'XLR (mic and DI lines)',
      note: 'One per wired input channel, plus spares',
    });
  if (plan.channels.some((c) => isRadio(c.source)))
    cables.push({ qty: radioMics.length, item: 'XLR (receiver outs)', note: 'Or Dante from the receivers' });
  if (used.length)
    cables.push({
      qty: used.length,
      item: 'Speaker cable (NL4)',
      note: `One per amp channel used${used.some((r) => r.sub) ? '; sub/top pairs can share an NL8' : ''}`,
    });
  const analogOuts = plan.outputs
    .flatMap((o) => o.buses.map((_, k) => o.patch && { bank: o.patch.bank }))
    .filter((p) => p && p.bank !== 'dante').length;
  const ds = show.ampFeed === 'ds10' ? ds10Plan(show, plan, amp.rows) : null;
  if (ds?.cables.length)
    cables.push({
      qty: ds.cables.length,
      item: 'AES cable (110 Ω XLR)',
      note: 'DS10 AES outs to the amps, one per pair of amp inputs',
    });
  else if (show.ampFeed !== 'dante' && analogOuts)
    cables.push({ qty: analogOuts, item: 'XLR (desk outputs to amps)', note: '' });
  if (network.length)
    cables.push({
      qty: network.length,
      item: 'Network cable (Cat)',
      note: `One per ${[...new Set(network)].join(', ')}, plus a switch with that many ports`,
    });
  add('Cables', cables);
  return groups;
}

export function prepSheet(
  show,
  plan,
  { version = '', licence = '', company = '', preparedBy = '', logo = '' } = {},
) {
  const logoSrc = safeLogo(logo);
  const model = MODELS[show.options?.model];
  const amp = ampPlan(show, plan);
  const rig = rfPlan(show, plan);
  const ds = show.ampFeed === 'ds10' ? ds10Plan(show, plan, amp.rows) : null;
  const dsOf = (r) => ds?.cables.find((c) => c.rows.includes(r));
  const today = new Date().toISOString().slice(0, 10);

  const picks = pickList(show, plan)
    .map(
      ({ group, rows }) =>
        `<tr class="grp"><th colspan="5">${esc(group)}</th></tr>${rows.map((r) => `<tr><td class="qty">${esc(r.qty)}</td><td><b>${esc(r.item)}</b></td><td class="note">${esc(r.note)}</td><td class="box"></td><td class="box"></td></tr>`).join('')}`,
    )
    .join('');

  const entries = new Map(rackEntries(show).map((e) => [e.unit.id, e]));
  const racks = (show.racks || [])
    .map((r) => {
      const rows = r.units.map((id) => entries.get(id)).filter(Boolean);
      let u = 1;
      const lines = [];
      if (r.plate !== 'none') {
        const what =
          r.plate === 'company'
            ? logoSrc
              ? `<img src="${logoSrc}" alt="${esc(company || 'Company')} logo">`
              : `${esc(company || 'Company')} logo plate`
            : 'KobiKraken logo plate';
        lines.push(
          `<tr class="plate ${r.plate === 'company' ? 'company' : ''}" style="height:${2 * 22}px"><td class="u">${u}–${u + 1}</td><td colspan="3">${what}</td></tr>`,
        );
        u += 2;
      }
      for (const { unit, family } of rows) {
        const h = unitHeight(unit, family);
        const kind =
          unit.model === 'DS10'
            ? DS10.label
            : family === 'amp'
              ? `${AMP_MODELS[unit.model]?.label || unit.model}${unit.mode === 'subtop' ? ' · Sub/Top' : ''}`
              : family === 'rf'
                ? (RECEIVER_MODELS[unit.model] || IEM_MODELS[unit.model])?.label || unit.model
                : RACK_ITEMS[unit.type]?.label || '';
        const feeds =
          unit.model === 'DS10'
            ? (ds?.cables || [])
                .filter((c) => c.ds10 === unit)
                .map((c) => `AES ${c.aesOut} → ${c.amp.name} ${c.ampIn}`)
                .join(' · ')
            : family === 'amp'
              ? amp.rows
                  .filter((x) => x.amp === unit && x.feed)
                  .map((x) => `${x.label.split('Ch ')[1]} ${rowFeedName(x)}`)
                  .join(' · ')
              : family === 'rf'
                ? [...rig.mics, ...rig.iems]
                    .filter((x) => x.device === unit)
                    .map((x) => `${x.channel} ${x.name}`)
                    .join(' · ')
                : '';
        lines.push(
          `<tr class="${family}" style="height:${h * 22}px"><td class="u">${h > 1 ? `${u}–${u + h - 1}` : u}</td><td><b>${esc(unit.name)}</b>${kind && kind !== unit.name ? `<br><small>${esc(kind)}</small>` : ''}</td><td class="note">${esc(feeds)}</td><td class="ip">${esc(unit.ip || '')}</td></tr>`,
        );
        u += h;
      }
      if (r.size && u <= r.size)
        lines.push(
          `<tr class="free" style="height:${Math.min(4, r.size - u + 1) * 22}px"><td class="u">${u}–${r.size}</td><td colspan="3">${r.size - u + 1}U free</td></tr>`,
        );
      return `<div class="rack"><h3>${esc(r.name)}${r.size ? ` · ${r.size}U` : ''}</h3><table><thead><tr><th class="u">U</th><th>Unit</th><th>Carries</th><th>IP</th></tr></thead><tbody>${lines.join('')}</tbody></table></div>`;
    })
    .join('');

  const radioOf = (c) => rig.mics.find((m) => m.source === c.source);
  const inputs = plan.channels
    .map((c) => {
      const r = radioOf(c);
      return `<tr><td class="box"></td><td>${c.ch}</td><td><b>${esc(c.name)}</b></td><td>${esc(portLabel(c.patch))}</td><td>${esc(r ? r.label || 'Radio' : DI_TYPES.has(c.source.type) ? 'DI' : c.source.note || SOURCE_TYPES[c.source.type].label)}</td><td>${phantomOf(c.source) && !r ? '48V' : ''}</td><td>${r?.freq ? `${r.freq.toFixed(3)}` : ''}</td></tr>`;
    })
    .join('');
  const outs = amp.rows
    .filter((r) => r.feed)
    .map(
      (r) =>
        `<tr><td class="box"></td><td><b>${esc(rowFeedName(r))}</b></td><td>${esc(r.sub ? '' : r.feed.bus)}</td><td>${esc(r.sub ? '' : dsOf(r) ? `${r.feed.dante ? `Dante ${r.feed.dante}` : r.feed.deskOutLabel} → ${dsOf(r).ds10?.name || 'DS10'} AES ${dsOf(r).aesOut}` : r.feed.deskOutLabel)}</td><td>${esc(r.label)}</td><td>${esc(r.input)}</td><td>${esc(r.setup)}</td><td class="ip">${esc(r.amp.ip)}</td></tr>`,
    )
    .join('');
  const otherOuts = plan.outputs
    .filter((o) => !amp.feeds.some((f) => f.zone === o.zone))
    .map(
      (o) =>
        `<tr><td class="box"></td><td><b>${esc(o.name)}</b></td><td>${esc(o.buses.join('/'))}</td><td>${o.patch ? esc(o.buses.map((_, k) => portLabel({ bank: o.patch.bank, port: o.patch.port + k })).join(' + ')) : 'unpatched'}</td><td colspan="4">${o.zone.type.startsWith('iem') ? 'IEM transmitter' : 'Feed'}</td></tr>`,
    )
    .join('');

  const css = `.kk-prep{font:11.5px/1.35 Inter,system-ui,sans-serif;color:#11151a;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.kk-prep h1{font-size:20px;margin:0}.kk-prep h2{font-size:14px;margin:20px 0 6px;padding-bottom:3px;border-bottom:2px solid #11151a;text-transform:uppercase;letter-spacing:.06em}
.kk-prep h3{font-size:12px;margin:0 0 4px}.kk-prep .meta{color:#5d6670;margin:2px 0 10px}
.kk-prep .sign{display:flex;gap:24px;margin:6px 0 4px}.kk-prep .sign span{flex:1;border-bottom:1px solid #11151a;padding-bottom:14px;color:#5d6670;font-size:10px}.kk-prep .sign b{display:block;color:#11151a;font-size:12px;margin-top:4px}
.kk-prep table{border-collapse:collapse;width:100%}.kk-prep th,.kk-prep td{border:1px solid #c8cdd3;padding:3px 6px;text-align:left;vertical-align:middle}
.kk-prep thead th{background:#eef0f2;font-size:10px;text-transform:uppercase;letter-spacing:.05em}.kk-prep tr.grp th{background:#11151a;color:#fff;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em}
.kk-prep td.qty{width:34px;text-align:center;font-weight:700;font-size:13px}.kk-prep td.box{width:30px}.kk-prep td.note{color:#3c444d}
.kk-prep td.ip,.kk-prep td.u{font-family:ui-monospace,Menlo,monospace;white-space:nowrap}.kk-prep td.u{width:34px;color:#5d6670;font-size:10px;text-align:center}
.kk-prep .racks{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px}.kk-prep .rack{break-inside:avoid}
.kk-prep tr.amp td{background:#f3f5f7}.kk-prep tr.rf td{background:#f7f8f9}.kk-prep tr.plate td{background:#11151a;color:#fff;font-weight:700;text-align:center}
.kk-prep tr.plate td.u{color:#c8cdd3}.kk-prep tr.free td{color:#8e949b;border-style:dashed;text-align:center}
.kk-prep img.logo{float:right;max-height:44px;max-width:200px}.kk-prep tr.plate.company td{background:#fff;color:#11151a;border-color:#11151a}.kk-prep tr.plate img{max-height:36px;max-width:240px;vertical-align:middle}
.kk-prep small{color:#5d6670}.kk-prep .page{page-break-before:always}.kk-prep footer{margin-top:18px;color:#5d6670;font-size:9.5px}
@media print{.kk-prep h2{break-after:avoid}.kk-prep tr{break-inside:avoid}}`;
  const body = `<div class="kk-prep">
${logoSrc ? `<img class="logo" src="${logoSrc}" alt="">` : ''}<h1>${esc(show.name)} · prep sheet</h1>
<p class="meta">${company ? `<b>${esc(company)}</b> · ` : ''}${esc(model?.inputs ? `Yamaha ${model.label}` : 'Desk not set')} · ${plural(plan.channels.length, 'channel')} · ${plural(plan.outputs.length, 'output')} · printed ${today}</p>
<div class="sign"><span>Job / date</span><span>Prepped by${preparedBy ? `<b>${esc(preparedBy)}</b>` : ''}</span><span>Checked by</span><span>Back in by</span></div>
<h2>Pick list</h2>
<table><thead><tr><th>Qty</th><th>Item</th><th>Notes</th><th>Out</th><th>Back</th></tr></thead><tbody>${picks || '<tr><td colspan="5">Nothing yet</td></tr>'}</tbody></table>
${racks ? `<h2 class="page">Racks</h2><p class="meta">Top to bottom, as they sit. Each unit's IP is on the right.</p><div class="racks">${racks}</div>` : ''}
<h2 class="page">Input patch</h2>
<table><thead><tr><th>✓</th><th>Ch</th><th>Name</th><th>Plugs into</th><th>Mic / DI / radio</th><th>48V</th><th>MHz</th></tr></thead><tbody>${inputs || '<tr><td colspan="7">No inputs</td></tr>'}</tbody></table>
<h2>Output and amp patch</h2>
<table><thead><tr><th>✓</th><th>Output</th><th>Bus</th><th>Desk out</th><th>Amp channel</th><th>Amp in</th><th>Speaker</th><th>Amp IP</th></tr></thead><tbody>${outs}${otherOuts || ''}${outs || otherOuts ? '' : '<tr><td colspan="8">No outputs</td></tr>'}</tbody></table>
<footer>KobiKraken · Show Builder${version ? ` v${esc(version)}` : ''}${licence ? ` · Licence ${esc(licence)}` : ''}</footer>
</div>`;
  return { title: `${show.name} prep sheet`, css, body };
}
