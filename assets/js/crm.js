/* crm.html: leads, pipeline, mailers & SMS for Party Padel.
   Reads/writes the crm_* tables from supabase/crm.sql with the admin's
   own login (row-level security keeps everything private to that
   login). Anything that actually sends an email or SMS goes through
   the crm-send Edge Function, which holds the provider keys, so none
   of them are ever in this file or in the browser. */
(function(window, document){
  'use strict';

  var db = window.PartyPadelDB;

  /* ===================== Constants ===================== */

  var STAGES = [
    { key: 'new',        label: 'New' },
    { key: 'contacted',  label: 'Contacted' },
    { key: 'interested', label: 'Interested' },
    { key: 'registered', label: 'Registered' },
    { key: 'attended',   label: 'Attended' },
    { key: 'lost',       label: 'Lost' }
  ];
  var TYPES = [
    { key: 'player',    label: 'Player' },
    { key: 'spectator', label: 'Spectator' },
    { key: 'partner',   label: 'Partner / sponsor' },
    { key: 'venue',     label: 'Venue' },
    { key: 'other',     label: 'Other' }
  ];
  var SOURCES = [
    { key: 'manual',       label: 'Added by hand' },
    { key: 'invitational', label: 'Invitational form' },
    { key: 'website',      label: 'Website' },
    { key: 'import',       label: 'Import' },
    { key: 'event',        label: 'At an event' },
    { key: 'referral',     label: 'Referral' },
    { key: 'social',       label: 'Social' },
    { key: 'partner',      label: 'Partner' }
  ];
  var MERGE_TAGS = ['first_name', 'last_name', 'full_name', 'city', 'event_city', 'event_date', 'event_venue', 'event_link'];
  var KIND_LABELS = {
    note: 'Note', call: 'Call', stage: 'Stage', email: 'Email', sms: 'SMS', sms_in: 'Reply',
    signup: 'Sign-up', 'import': 'Import', unsubscribe: 'Opt-out'
  };

  function labelOf(list, key){
    for (var i = 0; i < list.length; i++) if (list[i].key === key) return list[i].label;
    return key || '';
  }

  /* ===================== Helpers ===================== */

  function $(id){ return document.getElementById(id); }

  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(c){
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtDate(iso){
    if (!iso) return '';
    var d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function relTime(iso){
    var s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 86400 * 7) return Math.floor(s / 86400) + 'd ago';
    return fmtDate(iso);
  }

  // Same rules as crm_normalise_phone() in supabase/crm.sql.
  function normPhone(p){
    if (!p) return null;
    var v = String(p).replace(/[^0-9+]/g, '');
    if (!v) return null;
    if (v.indexOf('00') === 0) v = '+' + v.slice(2);
    if (v.indexOf('+440') === 0) v = '+44' + v.slice(4); // "+44 (0)7700..."
    if (v.charAt(0) === '+') return v;
    if (v.indexOf('44') === 0) return '+' + v;
    if (v.charAt(0) === '0') return '+44' + v.slice(1);
    return '+' + v;
  }

  function normEmail(e){
    e = String(e || '').trim().toLowerCase();
    return e || null;
  }

  function parseTags(str){
    var seen = {};
    return String(str || '').split(/[,;]/).map(function(t){ return t.trim().toLowerCase(); })
      .filter(function(t){ if (!t || seen[t]) return false; seen[t] = true; return true; });
  }

  function fullName(l){
    var n = [l.first_name, l.last_name].filter(Boolean).join(' ');
    return n || l.email || l.phone || 'Unnamed';
  }

  function eventLabel(ev){
    if (!ev) return '';
    var d = new Date(ev.event_date + 'T12:00:00');
    return ev.city + ' · ' + d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  // Keep in step with renderTemplate() in supabase/functions/_shared/messaging.ts.
  function renderTemplate(template, vars){
    return String(template || '').replace(/\{\{\s*([a-z_]+)\s*(?:\|([^}]*))?\}\}/gi, function(_m, key, fallback){
      var v = vars[key.toLowerCase()];
      return v && String(v).trim() !== '' ? v : (fallback || '').trim();
    });
  }

  function mergeVarsFor(lead, ev){
    var site = location.origin;
    return {
      first_name: lead.first_name || '',
      last_name: lead.last_name || '',
      full_name: [lead.first_name, lead.last_name].filter(Boolean).join(' '),
      city: lead.city || '',
      company: lead.company || '',
      event_city: ev ? ev.city : '',
      event_venue: ev ? ev.venue : '',
      event_date: ev ? new Date(ev.event_date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' }) : '',
      event_time: ev ? ev.event_time : '',
      event_link: ev ? site + '/event.html?slug=' + encodeURIComponent(ev.slug) : site + '/events.html',
      unsubscribe_link: site + '/unsubscribe.html'
    };
  }

  // Mirrors smsBody() on the server: an opt-out line is always added.
  function withStopLine(text){
    var t = String(text || '').trim();
    return /\bstop\b/i.test(t) ? t : t + '\nReply STOP to opt out';
  }

  var GSM = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
  var GSM_EXT = '^{}\\[~]|€';
  function smsSegments(text){
    var units = 0, gsm = true;
    for (var ch of text){
      if (GSM.indexOf(ch) !== -1) units += 1;
      else if (GSM_EXT.indexOf(ch) !== -1) units += 2;
      else { gsm = false; break; }
    }
    if (!gsm){
      var len = Array.from(text).length;
      return { encoding: 'Unicode', chars: len, segments: len <= 70 ? 1 : Math.ceil(len / 67) };
    }
    return { encoding: 'GSM', chars: units, segments: units <= 160 ? 1 : Math.ceil(units / 153) };
  }

  // RFC 4180-ish: quoted fields, escaped quotes, commas/newlines inside quotes.
  function parseCSV(text){
    var rows = [], row = [], field = '', q = false;
    text = text.replace(/^﻿/, '');
    for (var i = 0; i < text.length; i++){
      var c = text[i];
      if (q){
        if (c === '"'){ if (text[i + 1] === '"'){ field += '"'; i++; } else q = false; }
        else field += c;
      } else if (c === '"') q = true;
      else if (c === ','){ row.push(field); field = ''; }
      else if (c === '\n' || c === '\r'){
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += c;
    }
    if (field !== '' || row.length){ row.push(field); rows.push(row); }
    return rows.filter(function(r){ return r.some(function(v){ return v.trim() !== ''; }); });
  }

  function csvCell(v){
    v = v == null ? '' : String(v);
    // Leading = + - @ would run as a formula when opened in Excel/Sheets.
    if (/^[=+\-@]/.test(v)) v = "'" + v;
    return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }

  var toastTimer;
  function toast(msg, isError){
    var el = $('toast');
    // An open <dialog> sits in the top layer, above anything in the page,
    // so the toast has to move inside it to be seen.
    var host = document.querySelector('dialog[open]') || document.body;
    if (el.parentNode !== host) host.appendChild(el);
    el.textContent = msg;
    el.className = 'crm-toast' + (isError ? ' error' : '');
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ el.hidden = true; }, isError ? 6000 : 3000);
  }

  function debounce(fn, ms){
    var t;
    return function(){ var a = arguments, self = this; clearTimeout(t); t = setTimeout(function(){ fn.apply(self, a); }, ms); };
  }

  function fillSelect(sel, list, keepFirst){
    var first = keepFirst ? sel.options[0].outerHTML : '';
    sel.innerHTML = first + list.map(function(o){ return '<option value="' + esc(o.key) + '">' + esc(o.label) + '</option>'; }).join('');
  }

  // Edge Function errors arrive as a generic "non-2xx" error; the
  // useful message is in the response body.
  function invokeSend(body){
    return db.functions.invoke('crm-send', { body: body }).then(function(res){
      if (!res.error) return res.data;
      var ctx = res.error.context;
      if (ctx && typeof ctx.json === 'function'){
        return ctx.json().then(function(j){ throw new Error(j.error || res.error.message); }, function(){ throw res.error; });
      }
      if (/Failed to send a request|FunctionsFetchError/i.test(res.error.message || res.error.name)){
        throw new Error('The crm-send function isn\'t deployed yet. See README, CRM section.');
      }
      throw res.error;
    });
  }

  /* ===================== State ===================== */

  var state = {
    user: null,
    leads: [],
    leadById: {},
    events: [],
    eventById: {},
    campaigns: [],
    selected: {},
    tab: 'dashboard',
    loaded: false
  };

  function indexLeads(){
    state.leadById = {};
    state.leads.forEach(function(l){ state.leadById[l.id] = l; });
    $('leadsTabCount').textContent = state.leads.length ? state.leads.length : '';
    var tags = {};
    state.leads.forEach(function(l){ (l.tags || []).forEach(function(t){ tags[t] = (tags[t] || 0) + 1; }); });
    var tagList = Object.keys(tags).sort();
    $('tagOptions').innerHTML = tagList.map(function(t){ return '<option value="' + esc(t) + '">'; }).join('');
    var ft = $('filterTag'), cur = ft.value;
    ft.innerHTML = '<option value="">All tags</option>' + tagList.map(function(t){
      return '<option value="' + esc(t) + '">' + esc(t) + ' (' + tags[t] + ')</option>';
    }).join('');
    ft.value = tagList.indexOf(cur) !== -1 ? cur : '';
  }

  function loadLeads(){
    var all = [];
    function page(from){
      return db.from('crm_leads').select('*').order('created_at', { ascending: false }).range(from, from + 999).then(function(res){
        if (res.error) throw res.error;
        all = all.concat(res.data);
        return res.data.length === 1000 ? page(from + 1000) : all;
      });
    }
    return page(0).then(function(rows){ state.leads = rows; indexLeads(); });
  }

  function loadEvents(){
    return db.from('events').select('id, slug, city, venue, event_date, event_time').order('event_date', { ascending: true }).then(function(res){
      if (res.error) throw res.error;
      state.events = res.data;
      state.eventById = {};
      res.data.forEach(function(ev){ state.eventById[ev.id] = ev; });
      var opts = res.data.map(function(ev){ return '<option value="' + esc(ev.id) + '">' + esc(eventLabel(ev)) + '</option>'; }).join('');
      ['filterEvent', 'pipeEvent', 'audEvent', 'lEvent', 'importEvent'].forEach(function(id){
        var sel = $(id);
        sel.innerHTML = sel.options[0].outerHTML + opts;
      });
    });
  }

  function loadCampaigns(){
    return db.from('crm_campaigns').select('*').order('created_at', { ascending: false }).then(function(res){
      if (res.error) throw res.error;
      state.campaigns = res.data;
    });
  }

  function loadAll(){
    return Promise.all([loadLeads(), loadEvents(), loadCampaigns()]).then(function(){
      state.loaded = true;
      renderCurrentTab();
    }).catch(function(err){
      var missing = err && (err.code === '42P01' || err.code === 'PGRST205' || /crm_leads|crm_campaigns/.test(err.message || ''));
      toast(missing ? 'CRM tables not found. Run supabase/crm.sql in the Supabase SQL Editor first.' : ('Couldn\'t load CRM: ' + (err.message || err)), true);
    });
  }

  /* ===================== Auth & shell ===================== */

  if (!db){
    $('configMissingView').hidden = false;
    return;
  }

  function showSignedOut(){
    state.user = null;
    $('loginView').hidden = false;
    $('appView').hidden = true;
    $('signedInBar').hidden = true;
  }

  function showSignedIn(session){
    var first = !state.user;
    state.user = session.user;
    $('loginView').hidden = true;
    $('appView').hidden = false;
    $('signedInBar').hidden = false;
    $('adminUserEmail').textContent = session.user.email;
    if (first){ switchTab(tabFromHash(), true); loadAll(); }
  }

  db.auth.getSession().then(function(res){
    var session = res.data && res.data.session;
    if (session) showSignedIn(session); else showSignedOut();
  });
  db.auth.onAuthStateChange(function(_event, session){
    if (session) showSignedIn(session); else showSignedOut();
  });

  $('loginForm').addEventListener('submit', function(e){
    e.preventDefault();
    var btn = $('loginSubmit'), err = $('loginError');
    err.hidden = true;
    btn.disabled = true;
    db.auth.signInWithPassword({ email: $('loginEmail').value.trim(), password: $('loginPassword').value }).then(function(res){
      btn.disabled = false;
      if (res.error){
        err.hidden = false;
        err.textContent = res.error.message === 'Invalid login credentials' ? 'Incorrect email or password.' : res.error.message;
        return;
      }
      $('loginPassword').value = '';
    });
  });

  $('signOutBtn').addEventListener('click', function(){ db.auth.signOut(); });

  var TAB_TITLES = { dashboard: 'Dashboard', leads: 'Leads', pipeline: 'Pipeline', campaigns: 'Mailers & SMS' };

  function tabFromHash(){
    var h = location.hash.replace('#', '');
    return TAB_TITLES[h] ? h : 'dashboard';
  }

  function switchTab(tab, noHash){
    state.tab = tab;
    document.querySelectorAll('.crm-tab').forEach(function(b){
      var on = b.getAttribute('data-tab') === tab;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    Object.keys(TAB_TITLES).forEach(function(t){ $('tab-' + t).hidden = t !== tab; });
    $('crmHeading').textContent = TAB_TITLES[tab];
    if (!noHash && location.hash !== '#' + tab) history.replaceState(null, '', '#' + tab);
    renderCurrentTab();
  }

  function renderCurrentTab(){
    if (!state.loaded) return;
    if (state.tab === 'dashboard') renderDashboard();
    else if (state.tab === 'leads') renderLeads();
    else if (state.tab === 'pipeline') renderBoard();
    else if (state.tab === 'campaigns' && $('campaignEditView').hidden) renderCampaignList();
  }

  document.querySelectorAll('.crm-tab').forEach(function(btn){
    btn.addEventListener('click', function(){ switchTab(btn.getAttribute('data-tab')); });
    btn.addEventListener('keydown', function(e){
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var tabs = Array.prototype.slice.call(document.querySelectorAll('.crm-tab'));
      var i = tabs.indexOf(btn) + (e.key === 'ArrowRight' ? 1 : -1);
      var next = tabs[(i + tabs.length) % tabs.length];
      next.focus(); next.click();
    });
  });
  window.addEventListener('hashchange', function(){ if (state.user) switchTab(tabFromHash(), true); });

  $('headerAddLeadBtn').addEventListener('click', function(){ openLead(null); });
  $('headerImportBtn').addEventListener('click', openImport);

  document.querySelectorAll('dialog [data-close]').forEach(function(b){
    b.addEventListener('click', function(){ b.closest('dialog').close(); });
  });
  document.querySelectorAll('dialog').forEach(function(d){
    d.addEventListener('click', function(e){ if (e.target === d) d.close(); });
  });

  /* ===================== Dashboard ===================== */

  function barsHTML(rows){
    var max = Math.max.apply(null, rows.map(function(r){ return r.value; }).concat([1]));
    var total = rows.reduce(function(s, r){ return s + r.value; }, 0) || 1;
    return rows.map(function(r){
      var pct = Math.round(r.value / total * 100);
      return '<div class="crm-bar" title="' + esc(r.label) + ': ' + r.value + ' (' + pct + '%)">' +
        '<span class="crm-bar-label">' + esc(r.label) + '</span>' +
        '<span class="crm-bar-track"><span class="crm-bar-fill" style="width:' + (r.value / max * 100) + '%"></span></span>' +
        '<span class="crm-bar-value">' + r.value + '</span></div>';
    }).join('');
  }

  function renderDashboard(){
    var leads = state.leads;
    var weekAgo = Date.now() - 7 * 86400000;
    var newThisWeek = leads.filter(function(l){ return new Date(l.created_at).getTime() > weekAgo; }).length;
    var canEmail = leads.filter(function(l){ return l.email_opt_in && l.email; }).length;
    var canSms = leads.filter(function(l){ return l.sms_opt_in && l.phone; }).length;
    var won = leads.filter(function(l){ return l.stage === 'registered' || l.stage === 'attended'; }).length;

    function tile(label, value, note){
      return '<div class="crm-panel crm-stat"><span class="crm-stat-label">' + label + '</span>' +
        '<span class="crm-stat-value">' + value + '</span><span class="crm-stat-note">' + note + '</span></div>';
    }
    $('dashStats').innerHTML =
      tile('Leads', leads.length, newThisWeek + ' new in the last 7 days') +
      tile('Converted', leads.length ? Math.round(won / leads.length * 100) + '%' : '–', won + ' registered or attended') +
      tile('Email audience', canEmail, 'opted in, with an address') +
      tile('SMS audience', canSms, 'opted in, with a mobile');

    $('dashPipeline').innerHTML = barsHTML(STAGES.map(function(s){
      return { label: s.label, value: leads.filter(function(l){ return l.stage === s.key; }).length };
    }));
    $('dashSources').innerHTML = barsHTML(SOURCES.map(function(s){
      return { label: s.label, value: leads.filter(function(l){ return l.source === s.key; }).length };
    }).filter(function(r){ return r.value > 0; }).sort(function(a, b){ return b.value - a.value; })) ||
      '<p class="empty-note">No leads yet.</p>';

    var camps = state.campaigns.slice(0, 6);
    $('dashCampaigns').innerHTML = camps.length ? camps.map(function(c){
      return '<li><span class="crm-feed-kind">' + (c.channel === 'email' ? 'Mailer' : 'SMS') + '</span>' +
        '<span class="crm-feed-body"><button type="button" class="crm-link" data-open-campaign="' + c.id + '">' + esc(c.name) + '</button> ' +
        (c.status === 'draft' ? '· draft' : '· ' + c.sent_count + ' sent' + (c.failed_count ? ', ' + c.failed_count + ' failed' : '')) + '</span>' +
        '<span class="crm-feed-time">' + relTime(c.sent_at || c.updated_at) + '</span></li>';
    }).join('') : '<li>Nothing sent yet.</li>';
    $('dashCampaigns').querySelectorAll('[data-open-campaign]').forEach(function(b){
      b.addEventListener('click', function(){ switchTab('campaigns'); openCampaign(b.getAttribute('data-open-campaign')); });
    });

    db.from('crm_activities').select('*').order('created_at', { ascending: false }).limit(12).then(function(res){
      var el = $('dashActivity');
      if (res.error){ el.innerHTML = '<li>Couldn\'t load activity.</li>'; return; }
      el.innerHTML = res.data.length ? res.data.map(function(a){
        var l = state.leadById[a.lead_id];
        return '<li><span class="crm-feed-kind">' + esc(KIND_LABELS[a.kind] || a.kind) + '</span>' +
          '<span class="crm-feed-body">' + (l ? '<button type="button" class="crm-link" data-open-lead="' + l.id + '">' + esc(fullName(l)) + '</button> ' : '') +
          esc(a.body) + '</span><span class="crm-feed-time">' + relTime(a.created_at) + '</span></li>';
      }).join('') : '<li>No activity yet.</li>';
      el.querySelectorAll('[data-open-lead]').forEach(function(b){
        b.addEventListener('click', function(){ openLead(b.getAttribute('data-open-lead')); });
      });
    });
  }

  /* ===================== Leads table ===================== */

  fillSelect($('filterStage'), STAGES, true);
  fillSelect($('filterType'), TYPES, true);
  fillSelect($('filterSource'), SOURCES, true);
  fillSelect($('bulkStage'), STAGES, true);
  fillSelect($('pipeType'), TYPES, true);

  function filteredLeads(){
    var q = $('leadSearch').value.trim().toLowerCase();
    var stage = $('filterStage').value, type = $('filterType').value, source = $('filterSource').value;
    var ev = $('filterEvent').value, tag = $('filterTag').value, consent = $('filterConsent').value;
    var qPhone = q.replace(/[^0-9]/g, '');
    return state.leads.filter(function(l){
      if (stage && l.stage !== stage) return false;
      if (type && l.lead_type !== type) return false;
      if (source && l.source !== source) return false;
      if (ev && l.event_id !== ev) return false;
      if (tag && (l.tags || []).indexOf(tag) === -1) return false;
      if (consent === 'email' && !(l.email_opt_in && l.email)) return false;
      if (consent === 'sms' && !(l.sms_opt_in && l.phone)) return false;
      if (consent === 'none' && (l.email_opt_in || l.sms_opt_in)) return false;
      if (q){
        var hay = [l.first_name, l.last_name, l.email, l.company, l.city, (l.tags || []).join(' ')].join(' ').toLowerCase();
        var phoneHit = qPhone.length >= 4 && (l.phone || '').replace(/[^0-9]/g, '').indexOf(qPhone.replace(/^0/, '')) !== -1;
        if (hay.indexOf(q) === -1 && !phoneHit) return false;
      }
      return true;
    });
  }

  var MAX_ROWS = 500;

  function consentHTML(l){
    return '<span class="crm-consent"><span class="' + (l.email_opt_in && l.email ? 'on' : '') + '" title="Email ' + (l.email_opt_in ? 'opted in' : 'not opted in') + '">EMAIL</span>' +
      '<span class="' + (l.sms_opt_in && l.phone ? 'on' : '') + '" title="SMS ' + (l.sms_opt_in ? 'opted in' : 'not opted in') + '">SMS</span></span>';
  }

  function renderLeads(){
    var rows = filteredLeads();
    var shown = rows.slice(0, MAX_ROWS);
    $('leadCount').textContent = rows.length === state.leads.length
      ? state.leads.length + ' leads'
      : rows.length + ' of ' + state.leads.length + ' leads match' + (rows.length > MAX_ROWS ? ' (showing first ' + MAX_ROWS + ', narrow the filters to see the rest)' : '');
    $('leadRows').innerHTML = shown.map(function(l){
      var ev = state.eventById[l.event_id];
      return '<tr data-id="' + l.id + '">' +
        '<td class="crm-col-check"><input type="checkbox" data-select="' + l.id + '"' + (state.selected[l.id] ? ' checked' : '') + ' aria-label="Select ' + esc(fullName(l)) + '"></td>' +
        '<td><span class="crm-name">' + esc(fullName(l)) + '</span><span class="crm-sub">' + esc(l.email || l.phone || '') + (l.company ? ' · ' + esc(l.company) : '') + '</span></td>' +
        '<td><span class="crm-pill crm-pill-' + l.stage + '">' + esc(labelOf(STAGES, l.stage)) + '</span></td>' +
        '<td class="crm-hide-sm">' + esc(labelOf(TYPES, l.lead_type)) + '</td>' +
        '<td class="crm-hide-sm">' + esc(eventLabel(ev)) + '</td>' +
        '<td class="crm-hide-sm"><span class="crm-tags">' + (l.tags || []).map(function(t){ return '<span class="crm-tag">' + esc(t) + '</span>'; }).join('') + '</span></td>' +
        '<td>' + consentHTML(l) + '</td>' +
        '<td class="crm-hide-sm">' + esc(labelOf(SOURCES, l.source)) + '</td>' +
        '<td class="crm-hide-sm">' + fmtDate(l.created_at) + '</td></tr>';
    }).join('');
    var empty = $('leadEmpty');
    empty.hidden = rows.length > 0;
    empty.textContent = state.leads.length ? 'No leads match these filters.' : 'No leads yet. Add one, import a CSV, or wait for Invitational sign-ups to arrive.';
    $('selectAll').checked = shown.length > 0 && shown.every(function(l){ return state.selected[l.id]; });
    updateBulkBar();
  }

  ['leadSearch'].forEach(function(id){ $(id).addEventListener('input', debounce(renderLeads, 150)); });
  ['filterStage', 'filterType', 'filterSource', 'filterEvent', 'filterTag', 'filterConsent'].forEach(function(id){
    $(id).addEventListener('change', renderLeads);
  });

  $('leadRows').addEventListener('click', function(e){
    var cb = e.target.closest('[data-select]');
    if (cb){
      var id = cb.getAttribute('data-select');
      if (cb.checked) state.selected[id] = true; else delete state.selected[id];
      updateBulkBar();
      return;
    }
    var tr = e.target.closest('tr[data-id]');
    if (tr) openLead(tr.getAttribute('data-id'));
  });

  $('selectAll').addEventListener('change', function(){
    var on = this.checked;
    filteredLeads().slice(0, MAX_ROWS).forEach(function(l){ if (on) state.selected[l.id] = true; else delete state.selected[l.id]; });
    renderLeads();
  });

  function selectedIds(){ return Object.keys(state.selected).filter(function(id){ return state.leadById[id]; }); }

  function updateBulkBar(){
    var n = selectedIds().length;
    $('bulkBar').hidden = n === 0;
    $('bulkCount').textContent = n + ' selected';
  }

  $('bulkClearBtn').addEventListener('click', function(){ state.selected = {}; renderLeads(); });

  $('bulkStage').addEventListener('change', function(){
    var stage = this.value, ids = selectedIds();
    this.value = '';
    if (!stage || !ids.length) return;
    db.from('crm_leads').update({ stage: stage }).in('id', ids).select().then(function(res){
      if (res.error) return toast(res.error.message, true);
      mergeLeads(res.data);
      toast(ids.length + ' moved to ' + labelOf(STAGES, stage));
      renderLeads();
    });
  });

  $('bulkTagBtn').addEventListener('click', function(){
    var tags = parseTags($('bulkTag').value), ids = selectedIds();
    if (!tags.length || !ids.length) return;
    Promise.all(ids.map(function(id){
      var l = state.leadById[id];
      return db.from('crm_leads').update({ tags: (l.tags || []).concat(tags) }).eq('id', id).select().single();
    })).then(function(results){
      var failed = results.filter(function(r){ return r.error; });
      mergeLeads(results.filter(function(r){ return !r.error; }).map(function(r){ return r.data; }));
      $('bulkTag').value = '';
      toast(failed.length ? failed.length + ' couldn\'t be tagged' : 'Tagged ' + ids.length, !!failed.length);
      renderLeads();
    });
  });

  $('bulkDeleteBtn').addEventListener('click', function(){
    var ids = selectedIds();
    if (!ids.length || !confirm('Delete ' + ids.length + ' lead' + (ids.length === 1 ? '' : 's') + ' and their history? This can\'t be undone.')) return;
    db.from('crm_leads').delete().in('id', ids).then(function(res){
      if (res.error) return toast(res.error.message, true);
      state.leads = state.leads.filter(function(l){ return ids.indexOf(l.id) === -1; });
      state.selected = {};
      indexLeads();
      toast('Deleted ' + ids.length);
      renderLeads();
    });
  });

  function mergeLeads(rows){
    rows.forEach(function(row){
      var i = state.leads.findIndex(function(l){ return l.id === row.id; });
      if (i === -1) state.leads.unshift(row); else state.leads[i] = row;
    });
    indexLeads();
  }

  $('exportBtn').addEventListener('click', function(){
    var cols = ['first_name', 'last_name', 'email', 'phone', 'city', 'company', 'lead_type', 'stage', 'source', 'event', 'tags', 'email_opt_in', 'sms_opt_in', 'notes', 'created_at', 'last_contacted_at'];
    var lines = [cols.join(',')].concat(filteredLeads().map(function(l){
      return cols.map(function(c){
        if (c === 'event') return csvCell(eventLabel(state.eventById[l.event_id]));
        if (c === 'tags') return csvCell((l.tags || []).join('; '));
        return csvCell(l[c]);
      }).join(',');
    }));
    var blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'party-padel-leads-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
  });

  /* ===================== Lead drawer ===================== */

  fillSelect($('lStage'), STAGES);
  fillSelect($('lType'), TYPES);
  fillSelect($('lSource'), SOURCES);

  var currentLead = null;
  var msgChannel = 'email';

  function openLead(id){
    currentLead = id ? state.leadById[id] : null;
    var l = currentLead || { stage: 'new', lead_type: 'player', source: 'manual', tags: [] };
    $('leadDialogTitle').textContent = currentLead ? fullName(l) : 'New Lead';
    $('leadDialogEyebrow').textContent = currentLead ? 'Lead · added ' + fmtDate(l.created_at) : 'Lead';
    $('lFirst').value = l.first_name || '';
    $('lLast').value = l.last_name || '';
    $('lEmail').value = l.email || '';
    $('lPhone').value = l.phone || '';
    $('lStage').value = l.stage;
    $('lType').value = l.lead_type;
    $('lSource').value = l.source;
    $('lEvent').value = l.event_id || '';
    $('lCity').value = l.city || '';
    $('lCompany').value = l.company || '';
    $('lTags').value = (l.tags || []).join(', ');
    $('lNotes').value = l.notes || '';
    $('lEmailOptIn').checked = !!l.email_opt_in;
    $('lSmsOptIn').checked = !!l.sms_opt_in;
    $('leadFormError').hidden = true;
    $('deleteLeadBtn').hidden = !currentLead;
    $('leadExtras').hidden = !currentLead;
    if (currentLead){
      $('msgBody').value = ''; $('msgSubject').value = ''; $('noteBody').value = '';
      setMsgChannel(l.email ? 'email' : 'sms');
      loadTimeline();
    }
    var dlg = $('leadDialog');
    if (!dlg.open) dlg.showModal();
    (currentLead ? $('leadDialogTitle') : $('lFirst')).focus();
  }

  $('leadForm').addEventListener('submit', function(e){
    e.preventDefault();
    var err = $('leadFormError');
    err.hidden = true;
    var email = normEmail($('lEmail').value);
    var phone = normPhone($('lPhone').value);
    if (!email && !phone){ err.hidden = false; err.textContent = 'Add an email address or a mobile number.'; return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ err.hidden = false; err.textContent = 'That email address doesn\'t look right.'; return; }
    if (phone && phone.replace(/\D/g, '').length < 10){ err.hidden = false; err.textContent = 'That mobile number looks too short.'; return; }
    var clash = state.leads.find(function(o){
      return (!currentLead || o.id !== currentLead.id) && ((email && o.email === email) || (phone && o.phone === phone));
    });
    if (clash){
      err.hidden = false;
      err.innerHTML = 'Already in the CRM as <button type="button" class="crm-link" id="openClash">' + esc(fullName(clash)) + '</button>.';
      $('openClash').addEventListener('click', function(){ openLead(clash.id); });
      return;
    }
    var row = {
      first_name: $('lFirst').value.trim(),
      last_name: $('lLast').value.trim(),
      email: email, phone: phone,
      stage: $('lStage').value, lead_type: $('lType').value, source: $('lSource').value,
      event_id: $('lEvent').value || null,
      city: $('lCity').value.trim(), company: $('lCompany').value.trim(),
      tags: parseTags($('lTags').value), notes: $('lNotes').value,
      email_opt_in: $('lEmailOptIn').checked, sms_opt_in: $('lSmsOptIn').checked
    };
    var btn = $('saveLeadBtn');
    btn.disabled = true;
    var q = currentLead ? db.from('crm_leads').update(row).eq('id', currentLead.id) : db.from('crm_leads').insert(row);
    q.select().single().then(function(res){
      btn.disabled = false;
      if (res.error){ err.hidden = false; err.textContent = res.error.message; return; }
      var isNew = !currentLead;
      mergeLeads([res.data]);
      toast(isNew ? 'Lead added' : 'Saved');
      renderCurrentTab();
      if (isNew) openLead(res.data.id);
      else { currentLead = res.data; $('leadDialogTitle').textContent = fullName(res.data); loadTimeline(); }
    });
  });

  $('deleteLeadBtn').addEventListener('click', function(){
    if (!currentLead || !confirm('Delete ' + fullName(currentLead) + ' and their history? This can\'t be undone.')) return;
    var id = currentLead.id;
    db.from('crm_leads').delete().eq('id', id).then(function(res){
      if (res.error) return toast(res.error.message, true);
      state.leads = state.leads.filter(function(l){ return l.id !== id; });
      delete state.selected[id];
      indexLeads();
      $('leadDialog').close();
      toast('Lead deleted');
      renderCurrentTab();
    });
  });

  function loadTimeline(){
    var el = $('leadTimeline');
    var leadId = currentLead.id;
    el.innerHTML = '<li>Loading…</li>';
    db.from('crm_activities').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(100).then(function(res){
      if (!currentLead || currentLead.id !== leadId) return;
      if (res.error){ el.innerHTML = '<li>Couldn\'t load timeline.</li>'; return; }
      el.innerHTML = res.data.length ? res.data.map(function(a){
        return '<li><span class="crm-feed-kind">' + esc(KIND_LABELS[a.kind] || a.kind) + '</span>' +
          '<span class="crm-feed-body">' + esc(a.body).replace(/\n/g, '<br>') + (a.created_by ? ' <span class="crm-sub">' + esc(a.created_by) + '</span>' : '') + '</span>' +
          '<span class="crm-feed-time" title="' + esc(new Date(a.created_at).toLocaleString('en-GB')) + '">' + relTime(a.created_at) + '</span></li>';
      }).join('') : '<li>Nothing yet.</li>';
    });
  }

  $('addNoteBtn').addEventListener('click', function(){
    var body = $('noteBody').value.trim();
    if (!body || !currentLead) return;
    var kind = $('noteKind').value;
    db.from('crm_activities').insert({ lead_id: currentLead.id, kind: kind, body: body, created_by: state.user.email }).then(function(res){
      if (res.error) return toast(res.error.message, true);
      $('noteBody').value = '';
      if (kind === 'call'){
        var patch = { last_contacted_at: new Date().toISOString() };
        if (currentLead.stage === 'new') patch.stage = 'contacted';
        db.from('crm_leads').update(patch).eq('id', currentLead.id).select().single().then(function(r){
          if (!r.error){ mergeLeads([r.data]); currentLead = r.data; $('lStage').value = r.data.stage; renderCurrentTab(); }
          loadTimeline();
        });
      } else loadTimeline();
    });
  });

  function setMsgChannel(ch){
    msgChannel = ch;
    document.querySelectorAll('[data-msg-channel]').forEach(function(b){
      b.setAttribute('aria-pressed', b.getAttribute('data-msg-channel') === ch ? 'true' : 'false');
    });
    $('msgSubjectRow').hidden = ch !== 'email';
    updateMsgNote();
  }
  document.querySelectorAll('[data-msg-channel]').forEach(function(b){
    b.addEventListener('click', function(){ setMsgChannel(b.getAttribute('data-msg-channel')); });
  });

  function updateMsgNote(){
    if (!currentLead) return;
    var l = currentLead, note = '';
    if (msgChannel === 'email'){
      note = !l.email ? 'No email address on file.' : 'To ' + l.email + (l.email_opt_in ? '' : '. Not opted in to marketing: only send a direct reply to something they asked about.');
    } else {
      var seg = smsSegments(withStopLine(renderTemplate($('msgBody').value, mergeVarsFor(l, state.eventById[l.event_id]))));
      note = !l.phone ? 'No mobile number on file.' : 'To ' + l.phone + ' · ' + seg.chars + ' chars, ' + seg.segments + ' SMS' + (l.sms_opt_in ? '' : '. Not opted in to marketing SMS: only send a direct reply.');
    }
    $('msgNote').textContent = note;
  }
  $('msgBody').addEventListener('input', debounce(updateMsgNote, 120));

  $('msgSendBtn').addEventListener('click', function(){
    var l = currentLead;
    if (!l) return;
    var body = $('msgBody').value, subject = $('msgSubject').value;
    if (!body.trim()) return toast('Write a message first', true);
    if (msgChannel === 'email' && !subject.trim()) return toast('Add a subject', true);
    var optedIn = msgChannel === 'email' ? l.email_opt_in : l.sms_opt_in;
    if (!optedIn && !confirm(fullName(l) + ' hasn\'t opted in to marketing ' + (msgChannel === 'email' ? 'email' : 'SMS') + '. Only send this if it\'s a direct reply to them. Send anyway?')) return;
    var btn = this;
    btn.disabled = true;
    invokeSend({ lead_id: l.id, channel: msgChannel, subject: subject, body: body }).then(function(){
      btn.disabled = false;
      $('msgBody').value = ''; $('msgSubject').value = '';
      toast(msgChannel === 'email' ? 'Email sent' : 'SMS sent');
      loadTimeline();
    }, function(err){
      btn.disabled = false;
      toast(err.message, true);
    });
  });

  /* ===================== Pipeline board ===================== */

  var CARDS_PER_COLUMN = 100;

  function renderBoard(){
    var ev = $('pipeEvent').value, type = $('pipeType').value;
    var leads = state.leads.filter(function(l){ return (!ev || l.event_id === ev) && (!type || l.lead_type === type); });
    var stageOpts = STAGES.map(function(s){ return '<option value="' + s.key + '">' + s.label + '</option>'; }).join('');
    $('board').innerHTML = STAGES.map(function(s){
      var inStage = leads.filter(function(l){ return l.stage === s.key; });
      return '<section class="crm-col" data-stage="' + s.key + '" aria-label="' + s.label + '">' +
        '<div class="crm-col-head"><span>' + s.label + '</span><span class="crm-col-count">' + inStage.length + '</span></div>' +
        '<div class="crm-col-body">' + inStage.slice(0, CARDS_PER_COLUMN).map(function(l){
          var e = state.eventById[l.event_id];
          return '<article class="crm-card" draggable="true" data-id="' + l.id + '">' +
            '<h4><button type="button" class="crm-link" data-open-lead="' + l.id + '">' + esc(fullName(l)) + '</button></h4>' +
            '<p>' + esc([labelOf(TYPES, l.lead_type), eventLabel(e) || l.company].filter(Boolean).join(' · ')) + '</p>' +
            '<div class="crm-card-foot">' + consentHTML(l) +
            '<select data-stage-for="' + l.id + '" aria-label="Stage for ' + esc(fullName(l)) + '">' + stageOpts.replace('value="' + s.key + '"', 'value="' + s.key + '" selected') + '</select></div>' +
            '</article>';
        }).join('') + (inStage.length > CARDS_PER_COLUMN ? '<p class="crm-col-more">+' + (inStage.length - CARDS_PER_COLUMN) + ' more. Filter by event to narrow down.</p>' : '') +
        '</div></section>';
    }).join('');
  }

  function moveStage(id, stage){
    var l = state.leadById[id];
    if (!l || l.stage === stage) return;
    var prev = l.stage;
    l.stage = stage;
    renderBoard();
    db.from('crm_leads').update({ stage: stage }).eq('id', id).select().single().then(function(res){
      if (res.error){ l.stage = prev; renderBoard(); return toast(res.error.message, true); }
      mergeLeads([res.data]);
      toast(fullName(res.data) + ' → ' + labelOf(STAGES, stage));
    });
  }

  $('pipeEvent').addEventListener('change', renderBoard);
  $('pipeType').addEventListener('change', renderBoard);

  var board = $('board');
  board.addEventListener('click', function(e){
    var b = e.target.closest('[data-open-lead]');
    if (b) openLead(b.getAttribute('data-open-lead'));
  });
  board.addEventListener('change', function(e){
    var sel = e.target.closest('[data-stage-for]');
    if (sel) moveStage(sel.getAttribute('data-stage-for'), sel.value);
  });
  board.addEventListener('dragstart', function(e){
    var card = e.target.closest('.crm-card');
    if (!card) return;
    e.dataTransfer.setData('text/plain', card.getAttribute('data-id'));
    e.dataTransfer.effectAllowed = 'move';
    card.classList.add('dragging');
  });
  board.addEventListener('dragend', function(e){
    var card = e.target.closest('.crm-card');
    if (card) card.classList.remove('dragging');
    board.querySelectorAll('.drag-over').forEach(function(c){ c.classList.remove('drag-over'); });
  });
  board.addEventListener('dragover', function(e){
    var col = e.target.closest('.crm-col');
    if (!col) return;
    e.preventDefault();
    board.querySelectorAll('.drag-over').forEach(function(c){ if (c !== col) c.classList.remove('drag-over'); });
    col.classList.add('drag-over');
  });
  board.addEventListener('drop', function(e){
    var col = e.target.closest('.crm-col');
    if (!col) return;
    e.preventDefault();
    col.classList.remove('drag-over');
    moveStage(e.dataTransfer.getData('text/plain'), col.getAttribute('data-stage'));
  });

  /* ===================== Campaigns ===================== */

  var editing = null;   // campaign row being edited (or a new unsaved one)
  var pollTimer = null;

  function statusPill(c){
    var label = { draft: 'Draft', sending: 'Sending', sent: 'Sent', failed: 'Failed' }[c.status];
    return '<span class="crm-pill crm-pill-' + c.status + '">' + label + '</span>';
  }

  function renderCampaignList(){
    var list = $('campaignList');
    if (!state.campaigns.length){
      list.innerHTML = '<p class="empty-note">No mailers or SMS yet. Start one with the buttons above.</p>';
      return;
    }
    list.innerHTML = state.campaigns.map(function(c){
      var stats = c.status === 'draft' ? 'Last edited ' + relTime(c.updated_at)
        : c.sent_count + ' of ' + c.recipients_count + ' sent' + (c.failed_count ? ' · ' + c.failed_count + ' failed' : '') + (c.sent_at ? ' · ' + fmtDate(c.sent_at) : '');
      return '<div class="admin-row"><div class="admin-row-main">' + statusPill(c) +
        '<div><h3>' + esc(c.name) + '</h3><p>' + (c.channel === 'email' ? 'Email' : 'SMS') + ' · ' + esc(stats) + '</p></div></div>' +
        '<div class="admin-row-actions">' +
        '<button type="button" class="btn btn-outline btn-small" data-camp-open="' + c.id + '">' + (c.status === 'draft' || c.status === 'failed' ? 'Edit' : 'View') + '</button>' +
        '<button type="button" class="btn btn-outline btn-small" data-camp-dup="' + c.id + '">Duplicate</button>' +
        (c.status === 'sending' ? '' : '<button type="button" class="btn btn-outline btn-small" data-camp-del="' + c.id + '">Delete</button>') +
        '</div></div>';
    }).join('');
  }

  $('campaignList').addEventListener('click', function(e){
    var b;
    if ((b = e.target.closest('[data-camp-open]'))) openCampaign(b.getAttribute('data-camp-open'));
    else if ((b = e.target.closest('[data-camp-dup]'))){
      var src = state.campaigns.find(function(c){ return c.id === b.getAttribute('data-camp-dup'); });
      editing = { name: src.name + ' (copy)', channel: src.channel, subject: src.subject, body: src.body, audience: src.audience, status: 'draft' };
      showEditor();
    } else if ((b = e.target.closest('[data-camp-del]'))){
      var id = b.getAttribute('data-camp-del');
      var c = state.campaigns.find(function(x){ return x.id === id; });
      if (!confirm('Delete "' + c.name + '"' + (c.status === 'sent' ? ' and its send log? Leads\' timelines keep their entries.' : '?'))) return;
      db.from('crm_campaigns').delete().eq('id', id).then(function(res){
        if (res.error) return toast(res.error.message, true);
        state.campaigns = state.campaigns.filter(function(x){ return x.id !== id; });
        renderCampaignList();
      });
    }
  });

  $('newEmailBtn').addEventListener('click', function(){ newCampaign('email'); });
  $('newSmsBtn').addEventListener('click', function(){ newCampaign('sms'); });
  $('backToCampaigns').addEventListener('click', closeEditor);

  function newCampaign(channel){
    editing = {
      name: '', channel: channel, subject: '', status: 'draft',
      body: channel === 'email'
        ? 'Hi {{first_name|there}},\n\n\n\nSee you on court,\nParty Padel'
        : 'Party Padel: Hi {{first_name|there}}, ',
      audience: { stages: [], lead_types: [], sources: [], tags: [], event_id: '', city: '' }
    };
    showEditor();
  }

  function openCampaign(id){
    var c = state.campaigns.find(function(x){ return x.id === id; });
    if (!c) return;
    editing = JSON.parse(JSON.stringify(c));
    showEditor();
  }

  function chipsHTML(list, selected){
    return list.map(function(o){
      var on = selected.indexOf(o.key) !== -1;
      return '<button type="button" class="filter-chip' + (on ? ' active' : '') + '" data-key="' + o.key + '" aria-pressed="' + on + '">' + esc(o.label) + '</button>';
    }).join('');
  }

  function locked(){ return editing && (editing.status === 'sent' || editing.status === 'sending'); }

  function showEditor(){
    var a = editing.audience || {};
    $('campaignListView').hidden = true;
    $('campaignEditView').hidden = false;
    $('cName').value = editing.name;
    $('cSubject').value = editing.subject;
    $('cBody').value = editing.body;
    $('audStages').innerHTML = chipsHTML(STAGES, a.stages || []);
    $('audTypes').innerHTML = chipsHTML(TYPES, a.lead_types || []);
    $('audSources').innerHTML = chipsHTML(SOURCES, a.sources || []);
    $('audEvent').value = a.event_id || '';
    $('audCity').value = a.city || '';
    $('audTags').value = (a.tags || []).join(', ');
    $('campaignError').hidden = true;
    $('testTo').value = '';
    setChannel(editing.channel);

    var isLocked = locked();
    $('campaignEditView').querySelectorAll('input:not(#testTo), textarea, select, .filter-chip, [data-channel], #mergeTags button').forEach(function(el){ el.disabled = isLocked; });
    $('saveCampaignBtn').hidden = isLocked;
    $('sendCampaignBtn').hidden = isLocked;
    $('sendCampaignBtn').textContent = editing.status === 'failed' ? 'Retry Send' : 'Send Now';
    updateProgress();
    if (editing.status === 'sending') startPolling();
    refreshAudience();
    window.scrollTo(0, 0);
  }

  function closeEditor(){
    stopPolling();
    editing = null;
    $('campaignEditView').hidden = true;
    $('campaignListView').hidden = false;
    renderCampaignList();
  }

  function setChannel(ch){
    editing.channel = ch;
    document.querySelectorAll('[data-channel]').forEach(function(b){
      b.setAttribute('aria-pressed', b.getAttribute('data-channel') === ch ? 'true' : 'false');
    });
    $('cSubjectRow').hidden = ch !== 'email';
    $('testTo').placeholder = ch === 'email' ? (state.user ? state.user.email : 'you@example.com') : 'Your mobile, e.g. 07700 900123';
    $('cBodyNote').textContent = ch === 'email'
      ? 'Plain text. Leave a blank line between paragraphs; links become clickable. The Party Padel header, footer and unsubscribe link are added for you.'
      : '"Reply STOP to opt out" is added automatically if the message doesn\'t already say it. Start with "Party Padel:" so people know who it\'s from.';
    $('audCountLabel').textContent = ch === 'email' ? 'leads opted in to email' : 'leads opted in to SMS';
    updateMeter();
    refreshPreview();
    refreshAudience();
  }

  document.querySelectorAll('[data-channel]').forEach(function(b){
    b.addEventListener('click', function(){ if (!locked()) setChannel(b.getAttribute('data-channel')); });
  });

  $('mergeTags').innerHTML = MERGE_TAGS.map(function(t){ return '<button type="button" data-tag="' + t + '">{{' + t + '}}</button>'; }).join('');
  $('mergeTags').addEventListener('click', function(e){
    var b = e.target.closest('[data-tag]');
    if (!b) return;
    var ta = $('cBody'), ins = '{{' + b.getAttribute('data-tag') + '}}';
    var s = ta.selectionStart, en = ta.selectionEnd;
    ta.value = ta.value.slice(0, s) + ins + ta.value.slice(en);
    ta.focus();
    ta.selectionStart = ta.selectionEnd = s + ins.length;
    ta.dispatchEvent(new Event('input'));
  });

  function readAudience(){
    function picked(id){
      return Array.prototype.map.call($(id).querySelectorAll('.filter-chip.active'), function(c){ return c.getAttribute('data-key'); });
    }
    return {
      stages: picked('audStages'), lead_types: picked('audTypes'), sources: picked('audSources'),
      tags: parseTags($('audTags').value), event_id: $('audEvent').value, city: $('audCity').value.trim()
    };
  }

  ['audStages', 'audTypes', 'audSources'].forEach(function(id){
    $(id).addEventListener('click', function(e){
      var chip = e.target.closest('.filter-chip');
      if (!chip || locked()) return;
      var on = !chip.classList.contains('active');
      chip.classList.toggle('active', on);
      chip.setAttribute('aria-pressed', on);
      refreshAudience();
    });
  });
  $('audEvent').addEventListener('change', function(){ refreshAudience(); });
  $('audCity').addEventListener('input', debounce(function(){ refreshAudience(); }, 300));
  $('audTags').addEventListener('input', debounce(function(){ refreshAudience(); }, 300));
  $('cBody').addEventListener('input', function(){ updateMeter(); refreshPreviewSoon(); });
  $('cSubject').addEventListener('input', function(){ refreshPreviewSoon(); });

  var previewLead = null;
  var audienceSeq = 0;

  // The count comes from the same crm_audience() SQL function the
  // crm-send Edge Function uses to send, so it's exactly who'll get it.
  function refreshAudience(){
    if (!editing) return;
    var seq = ++audienceSeq;
    var aud = readAudience(), ch = editing.channel;
    $('audCount').textContent = '…';
    db.rpc('crm_audience', { p_audience: aud, p_channel: ch }).select('*').limit(1).then(function(res){
      if (seq !== audienceSeq) return;
      previewLead = res.data && res.data[0] || null;
      refreshPreview();
    });
    db.rpc('crm_audience', { p_audience: aud, p_channel: ch }, { count: 'exact', head: true }).then(function(res){
      if (seq !== audienceSeq) return;
      $('audCount').textContent = res.error ? '?' : res.count;
    });
  }

  function updateMeter(){
    var m = $('cMeter');
    if (!editing || editing.channel !== 'sms'){ m.textContent = ''; m.className = 'crm-meter'; return; }
    var seg = smsSegments(withStopLine($('cBody').value));
    m.innerHTML = '<span>' + seg.chars + ' characters incl. opt-out line (' + seg.encoding + ')</span><span>' + seg.segments + ' SMS per person</span>';
    m.className = 'crm-meter' + (seg.segments > 2 || seg.encoding !== 'GSM' ? ' warn' : '');
    if (seg.encoding !== 'GSM') m.firstChild.textContent += ', emoji or special characters cut the limit to 70';
  }

  var refreshPreviewSoon = debounce(refreshPreview, 150);

  function refreshPreview(){
    if (!editing) return;
    var lead = previewLead || { first_name: 'Alex', last_name: 'Sample', city: 'London' };
    var aud = readAudience();
    var ev = state.eventById[lead.event_id] || state.eventById[aud.event_id] || null;
    var vars = mergeVarsFor(lead, ev);
    $('previewFor').textContent = previewLead ? 'As ' + fullName(previewLead) + ' will see it' : 'With sample details (nobody matches this audience yet)';
    var body = renderTemplate($('cBody').value, vars);
    if (editing.channel === 'sms'){
      $('preview').innerHTML = '<div class="crm-preview-sms">' + esc(withStopLine(body)) + '</div>';
      return;
    }
    var paras = body.trim().split(/\n\s*\n/).map(function(p){
      var html = esc(p).replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
      return '<p>' + html.replace(/\n/g, '<br>') + '</p>';
    }).join('');
    $('preview').innerHTML = '<div class="crm-preview-email">' +
      '<div class="crm-preview-email-subject">' + esc(renderTemplate($('cSubject').value, vars) || '(no subject)') + '</div>' +
      '<div class="crm-preview-email-head">Party Padel</div>' +
      '<div class="crm-preview-email-body">' + paras + '</div>' +
      '<div class="crm-preview-email-foot">You\'re getting this because you asked Party Padel to keep you posted.<br><u>Unsubscribe</u></div></div>';
  }

  function campaignRow(){
    return {
      name: $('cName').value.trim() || (editing.channel === 'email' ? 'Untitled mailer' : 'Untitled SMS'),
      channel: editing.channel,
      subject: editing.channel === 'email' ? $('cSubject').value : '',
      body: $('cBody').value,
      audience: readAudience()
    };
  }

  function saveCampaign(){
    var row = campaignRow();
    var q = editing.id ? db.from('crm_campaigns').update(row).eq('id', editing.id) : db.from('crm_campaigns').insert(row);
    return q.select().single().then(function(res){
      if (res.error) throw res.error;
      editing = res.data;
      var i = state.campaigns.findIndex(function(c){ return c.id === res.data.id; });
      if (i === -1) state.campaigns.unshift(res.data); else state.campaigns[i] = res.data;
      $('cName').value = res.data.name;
      return res.data;
    });
  }

  $('saveCampaignBtn').addEventListener('click', function(){
    saveCampaign().then(function(){ toast('Draft saved'); }, function(err){ toast(err.message, true); });
  });

  $('sendCampaignBtn').addEventListener('click', function(){
    var errEl = $('campaignError');
    errEl.hidden = true;
    var row = campaignRow();
    var problem = !row.body.trim() ? 'Write a message first.'
      : row.channel === 'email' && !row.subject.trim() ? 'Add a subject line.'
      : /\{\{[^}]*$|^[^{]*\}\}/.test(row.body) ? 'A merge field looks unfinished: check your {{ }} brackets.'
      : null;
    if (problem){ errEl.hidden = false; errEl.textContent = problem; return; }
    var count = parseInt($('audCount').textContent, 10);
    if (!count){ errEl.hidden = false; errEl.textContent = 'Nobody matches this audience yet.'; return; }
    var what = row.channel === 'email' ? 'email' : 'SMS';
    if (!confirm('Send this ' + what + ' to ' + count + ' ' + (count === 1 ? 'person' : 'people') + ' now? This can\'t be undone.')) return;

    var btn = this;
    btn.disabled = true;
    saveCampaign().then(function(c){
      return invokeSend({ campaign_id: c.id });
    }).then(function(){
      btn.disabled = false;
      editing.status = 'sending';
      toast('Sending…');
      showEditor();
    }, function(err){
      btn.disabled = false;
      errEl.hidden = false;
      errEl.textContent = err.message || String(err);
    });
  });

  $('sendTestBtn').addEventListener('click', function(){
    var to = $('testTo').value.trim() || (editing.channel === 'email' && state.user ? state.user.email : '');
    if (!to) return toast('Enter a mobile number to send the test to', true);
    var btn = this;
    btn.disabled = true;
    invokeSend({ test: true, channel: editing.channel, subject: $('cSubject').value, body: $('cBody').value, to: to }).then(function(){
      btn.disabled = false;
      toast('Test sent to ' + to);
    }, function(err){
      btn.disabled = false;
      toast(err.message, true);
    });
  });

  function updateProgress(){
    var box = $('sendProgress');
    if (!editing || editing.status === 'draft'){ box.hidden = true; return; }
    box.hidden = false;
    var total = editing.recipients_count || 0, done = (editing.sent_count || 0) + (editing.failed_count || 0);
    $('sendProgressBar').style.width = (total ? Math.round(done / total * 100) : (editing.status === 'sent' ? 100 : 0)) + '%';
    $('sendProgressText').textContent =
      editing.status === 'sending' ? 'Sending… ' + done + ' of ' + (total || '?') + ' done. You can leave this page, it carries on without you.'
      : editing.status === 'sent' ? 'Sent to ' + editing.sent_count + ' of ' + total + (editing.failed_count ? ', ' + editing.failed_count + ' failed (bad address or number)' : '') + ' on ' + new Date(editing.sent_at).toLocaleString('en-GB') + '.'
      : 'Send failed' + (editing.sent_count ? ' part-way: ' + editing.sent_count + ' sent' : '') + '. Retrying only goes to people who didn\'t get it.';
  }

  function startPolling(){
    stopPolling();
    pollTimer = setInterval(function(){
      if (!editing || !editing.id) return stopPolling();
      db.from('crm_campaigns').select('*').eq('id', editing.id).single().then(function(res){
        if (res.error || !editing || editing.id !== res.data.id) return;
        editing = res.data;
        var i = state.campaigns.findIndex(function(c){ return c.id === res.data.id; });
        if (i !== -1) state.campaigns[i] = res.data;
        updateProgress();
        if (res.data.status !== 'sending'){
          stopPolling();
          toast(res.data.status === 'sent' ? 'Sent' : 'Send failed', res.data.status !== 'sent');
          loadLeads();   // last-contacted dates changed
          showEditor();
        }
      });
    }, 2000);
  }
  function stopPolling(){ if (pollTimer){ clearInterval(pollTimer); pollTimer = null; } }

  /* ===================== Import ===================== */

  fillSelect($('importSource'), SOURCES);
  fillSelect($('importStage'), STAGES);
  var importRows = [];

  var HEADER_MAP = {
    first_name: ['firstname', 'first', 'givenname', 'forename', 'buyerfirstname', 'attendeefirstname'],
    last_name: ['lastname', 'surname', 'last', 'familyname', 'buyerlastname', 'attendeelastname'],
    name: ['name', 'fullname', 'buyername', 'attendeename', 'customername', 'contactname'],
    email: ['email', 'emailaddress', 'buyeremail', 'attendeeemail', 'mail'],
    phone: ['phone', 'mobile', 'phonenumber', 'mobilenumber', 'tel', 'telephone', 'buyerphone', 'attendeephone', 'mobilephone'],
    city: ['city', 'town', 'location'],
    company: ['company', 'organisation', 'organization', 'business'],
    tags: ['tags', 'tag', 'labels'],
    notes: ['notes', 'note', 'comments'],
    email_opt_in: ['emailoptin', 'emailconsent', 'marketingemail', 'acceptsmarketing', 'consent', 'optin', 'marketingconsent'],
    sms_opt_in: ['smsoptin', 'smsconsent', 'marketingsms', 'textoptin']
  };

  function yesNo(v){
    v = String(v || '').trim().toLowerCase();
    if (/^(y|yes|true|1|opted in|subscribed)$/.test(v)) return true;
    if (/^(n|no|false|0|opted out|unsubscribed)$/.test(v)) return false;
    return null;
  }

  function openImport(){
    $('importFile').value = '';
    $('importPreview').textContent = '';
    $('importError').hidden = true;
    $('importRunBtn').disabled = true;
    $('importSource').value = 'import';
    $('importStage').value = 'new';
    $('importTag').value = '';
    $('importEvent').value = '';
    $('importEmailOptIn').checked = false;
    $('importSmsOptIn').checked = false;
    importRows = [];
    $('importDialog').showModal();
  }

  $('importFile').addEventListener('change', function(){
    var file = this.files[0];
    var err = $('importError');
    err.hidden = true;
    $('importRunBtn').disabled = true;
    if (!file) return;
    file.text().then(function(text){
      var rows = parseCSV(text);
      if (rows.length < 2) throw new Error('That file has no data rows.');
      var header = rows[0].map(function(h){ return h.toLowerCase().replace(/[^a-z0-9]/g, ''); });
      var col = {};
      Object.keys(HEADER_MAP).forEach(function(k){
        var i = header.findIndex(function(h){ return HEADER_MAP[k].indexOf(h) !== -1; });
        if (i !== -1) col[k] = i;
      });
      if (col.email == null && col.phone == null) throw new Error('Couldn\'t find an email or phone column. Check the header row.');
      var seen = {};
      importRows = rows.slice(1).map(function(r){
        function get(k){ return col[k] != null ? (r[col[k]] || '').trim() : ''; }
        var first = get('first_name'), last = get('last_name');
        if (!first && !last && get('name')){
          var parts = get('name').split(/\s+/);
          first = parts.shift(); last = parts.join(' ');
        }
        return {
          first_name: first, last_name: last,
          email: normEmail(get('email')), phone: normPhone(get('phone')),
          city: get('city'), company: get('company'), notes: get('notes'),
          tags: parseTags(get('tags')),
          emailYes: col.email_opt_in != null ? yesNo(get('email_opt_in')) : null,
          smsYes: col.sms_opt_in != null ? yesNo(get('sms_opt_in')) : null
        };
      }).filter(function(r){
        if (r.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) r.email = null;
        if (!r.email && !r.phone) return false;
        var key = r.email || r.phone;
        if (seen[key]) return false;
        seen[key] = true;
        return true;
      });
      var existing = importRows.filter(findExisting).length;
      var found = Object.keys(col).filter(function(k){ return k !== 'name' || col.first_name == null; }).join(', ');
      $('importPreview').textContent = importRows.length + ' people found (' + (importRows.length - existing) + ' new, ' + existing + ' already in the CRM). Columns used: ' + found + '.';
      $('importRunBtn').disabled = !importRows.length;
    }).catch(function(e){
      err.hidden = false;
      err.textContent = e.message;
    });
  });

  function findExisting(r){
    return state.leads.find(function(l){ return (r.email && l.email === r.email) || (r.phone && l.phone === r.phone); });
  }

  $('importRunBtn').addEventListener('click', function(){
    var btn = this;
    var source = $('importSource').value, stage = $('importStage').value, eventId = $('importEvent').value || null;
    var extraTags = parseTags($('importTag').value);
    var emailAll = $('importEmailOptIn').checked, smsAll = $('importSmsOptIn').checked;
    var inserts = [], updates = [];

    importRows.forEach(function(r){
      // A "no" in the file always wins over the tick-box; a "yes" or
      // the tick-box can only ever add consent, never take it away.
      var emailOk = r.emailYes === false ? false : (r.emailYes === true || emailAll);
      var smsOk = r.smsYes === false ? false : (r.smsYes === true || smsAll);
      var ex = findExisting(r);
      if (ex){
        updates.push({ id: ex.id, patch: {
          first_name: ex.first_name || r.first_name, last_name: ex.last_name || r.last_name,
          email: ex.email || r.email, phone: ex.phone || r.phone,
          city: ex.city || r.city, company: ex.company || r.company,
          event_id: ex.event_id || eventId,
          tags: (ex.tags || []).concat(r.tags, extraTags),
          email_opt_in: ex.email_opt_in || emailOk,
          sms_opt_in: ex.sms_opt_in || smsOk
        }});
      } else {
        inserts.push({
          first_name: r.first_name, last_name: r.last_name, email: r.email, phone: r.phone,
          city: r.city, company: r.company, notes: r.notes, tags: r.tags.concat(extraTags),
          source: source, stage: stage, event_id: eventId,
          email_opt_in: emailOk, sms_opt_in: smsOk
        });
      }
    });

    btn.disabled = true;
    btn.textContent = 'Importing…';
    var added = 0, updated = 0, failed = 0, firstError = '';

    var chain = Promise.resolve();
    for (var i = 0; i < inserts.length; i += 500){
      (function(batch){
        chain = chain.then(function(){
          return db.from('crm_leads').insert(batch).select().then(function(res){
            if (res.error){ failed += batch.length; firstError = firstError || res.error.message; return; }
            added += res.data.length;
            mergeLeads(res.data);
            return db.from('crm_activities').insert(res.data.map(function(l){
              return { lead_id: l.id, kind: 'import', body: 'Imported from CSV', created_by: state.user.email };
            }));
          });
        });
      })(inserts.slice(i, i + 500));
    }
    for (var j = 0; j < updates.length; j += 10){
      (function(batch){
        chain = chain.then(function(){
          return Promise.all(batch.map(function(u){
            return db.from('crm_leads').update(u.patch).eq('id', u.id).select().single().then(function(res){
              if (res.error){ failed++; firstError = firstError || res.error.message; return; }
              updated++;
              mergeLeads([res.data]);
            });
          }));
        });
      })(updates.slice(j, j + 10));
    }

    chain.then(function(){
      btn.disabled = false;
      btn.textContent = 'Import';
      $('importDialog').close();
      toast(added + ' added, ' + updated + ' updated' + (failed ? ', ' + failed + ' failed: ' + firstError : ''), !!failed);
      renderCurrentTab();
    });
  });

})(window, document);
