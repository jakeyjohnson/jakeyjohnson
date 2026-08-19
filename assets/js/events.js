/* Shared event data helpers — used by events.html, event.html, index.html and results.html. */
(function(window){
  'use strict';

  var STATUS_META = {
    'entries-open': { label: 'Entries Open', pillClass: 'status-open' },
    'limited':      { label: 'Limited',      pillClass: 'status-limited' },
    'coming-soon':  { label: 'Coming Soon',  pillClass: 'status-closed' },
    'sold-out':     { label: 'Sold Out',     pillClass: 'status-closed' },
    'completed':    { label: 'Completed',    pillClass: 'status-closed' }
  };

  /* Maps a snake_case row from the Supabase "events" table (see
     supabase/schema.sql) back into the exact camelCase shape every
     consumer page already expects — event.html, events.html, the
     homepage teaser, and admin.html's list view all share this. Kept
     here rather than duplicated in admin.html. dateLabel is computed
     rather than stored, so it can never drift out of sync with date. */
  function rowToEvent(row){
    var d = new Date(row.event_date + 'T00:00:00');
    return {
      id: row.id,
      slug: row.slug,
      city: row.city,
      date: row.event_date,
      dateLabel: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      time: row.event_time,
      venue: row.venue,
      address: row.address,
      status: row.status,
      playersEntered: row.players_entered,
      playersCapacity: row.players_capacity,
      pricePlayer: row.price_player,
      priceSpectator: row.price_spectator,
      ticketTailorCheckoutUrl: row.ticket_tailor_checkout_url || '',
      divisions: [
        { name: 'Beginners', skillMin: row.beginners_skill_min, skillMax: row.beginners_skill_max, spacesLeft: row.beginners_spaces_left },
        { name: 'Advanced',  skillMin: row.advanced_skill_min,  skillMax: row.advanced_skill_max,  spacesLeft: row.advanced_spaces_left }
      ],
      schedule: row.schedule || []
    };
  }

  function loadEvents(){
    if (!window.PartyPadelDB){
      console.error('Party Padel: no Supabase client — check assets/js/supabase-config.js is filled in.');
      return Promise.resolve([]);
    }
    return window.PartyPadelDB
      .from('events')
      .select('*')
      .order('event_date', { ascending: true })
      .then(function(res){
        if (res.error){
          console.error('Party Padel: failed to load events —', res.error.message);
          return [];
        }
        return res.data.map(rowToEvent);
      });
  }

  function getQueryParam(name){
    var params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  function statusMeta(status){
    return STATUS_META[status] || STATUS_META['coming-soon'];
  }

  /* Event text (city, venue, schedule rows...) now comes from a web
     form (admin.html) writing to a database, not a developer-trusted
     static file — so every place that concatenates it into an HTML
     string, rather than assigning it via .textContent, needs to escape
     it first or it's a stored-XSS hole against every site visitor. */
  function escapeHTML(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(c){
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* Everything a buyer needs — division and skill level — is now asked
     by Ticket Tailor itself at checkout (ticket type + a custom
     question), so entering IS paying: one click straight to their
     hosted checkout. No checkout URL yet means payments genuinely
     aren't live, so the honest fallback is the same "notify me" mailto
     already used for coming-soon/sold-out, not a link to nowhere.
     Requiring the https:// scheme also stops a stray "javascript:" or
     similar value ever ending up as a real link's href. */
  function enterOpen(ev){
    return ev.status !== 'sold-out' && ev.status !== 'coming-soon' && /^https:\/\//i.test(ev.ticketTailorCheckoutUrl || '');
  }
  function enterHref(ev){
    if (enterOpen(ev)) return ev.ticketTailorCheckoutUrl;
    if (ev.status === 'sold-out') return 'event.html?slug=' + encodeURIComponent(ev.slug);
    return 'mailto:hello@partypadel.uk?subject=Notify%20me%20-%20' + encodeURIComponent(ev.city);
  }
  function enterLabel(ev){
    if (enterOpen(ev)) return 'Enter — £' + ev.pricePlayer;
    if (ev.status === 'sold-out') return 'Entries Closed';
    return 'Get Notified';
  }

  function eventCardHTML(ev){
    var meta = statusMeta(ev.status);
    var ctaClass = enterOpen(ev) ? 'btn-primary' : 'btn-outline';
    var entrantsLine = ev.status === 'coming-soon'
      ? 'Entries open soon'
      : (ev.playersEntered + ' of ' + ev.playersCapacity + ' players entered');

    return '' +
      '<article class="event-card reveal">' +
        '<div class="event-card-head">' +
          '<span class="status-pill ' + meta.pillClass + '">' + meta.label + '</span>' +
          '<span class="event-date"><svg class="icon icon-sm"><use href="#ci-calendar"/></svg> ' + shortDate(ev.date) + '</span>' +
        '</div>' +
        '<h3><a href="event.html?slug=' + encodeURIComponent(ev.slug) + '">' + escapeHTML(ev.city) + '</a></h3>' +
        '<p class="event-venue"><svg class="icon icon-sm"><use href="#ci-pin"/></svg> ' + escapeHTML(ev.venue) + '</p>' +
        '<div class="court-rule" aria-hidden="true"></div>' +
        '<div class="event-meta-row">' +
          '<span>' + entrantsLine + '</span>' +
          '<span>From £' + ev.pricePlayer + ' / player</span>' +
        '</div>' +
        '<a href="' + enterHref(ev) + '" class="btn ' + ctaClass + ' btn-block">' + enterLabel(ev) + '</a>' +
      '</article>';
  }

  function shortDate(iso){
    var d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  window.PartyPadelEvents = {
    loadEvents: loadEvents,
    getQueryParam: getQueryParam,
    statusMeta: statusMeta,
    escapeHTML: escapeHTML,
    enterOpen: enterOpen,
    enterHref: enterHref,
    enterLabel: enterLabel,
    eventCardHTML: eventCardHTML,
    shortDate: shortDate
  };

})(window);
