/* Shared event data helpers — used by events.html, event.html, index.html (homepage teaser is static/hardcoded, this file is for pages that render from data). */
(function(window){
  'use strict';

  var STATUS_META = {
    'entries-open': { label: 'Entries Open', pillClass: 'status-open' },
    'limited':      { label: 'Limited',      pillClass: 'status-limited' },
    'coming-soon':  { label: 'Coming Soon',  pillClass: 'status-closed' },
    'sold-out':     { label: 'Sold Out',     pillClass: 'status-closed' },
    'completed':    { label: 'Completed',    pillClass: 'status-closed' }
  };

  function loadEvents(){
    /* Data comes from a plain <script src="assets/data/events-data.js">
       (loaded before this file), not fetch — fetch()'ing a local JSON
       file is blocked by the browser when a page is opened directly
       (file://) rather than served over http/https. */
    return Promise.resolve(window.PARTY_PADEL_EVENTS || []);
  }

  function getQueryParam(name){
    var params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  function statusMeta(status){
    return STATUS_META[status] || STATUS_META['coming-soon'];
  }

  /* Everything a buyer needs — division and skill level — is now asked
     by Ticket Tailor itself at checkout (ticket type + a custom
     question), so entering IS paying: one click straight to their
     hosted checkout. No checkout URL yet means payments genuinely
     aren't live, so the honest fallback is the same "notify me" mailto
     already used for coming-soon/sold-out, not a link to nowhere. */
  function enterOpen(ev){
    return ev.status !== 'sold-out' && ev.status !== 'coming-soon' && !!ev.ticketTailorCheckoutUrl;
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
        '<h3><a href="event.html?slug=' + encodeURIComponent(ev.slug) + '">' + ev.city + '</a></h3>' +
        '<p class="event-venue"><svg class="icon icon-sm"><use href="#ci-pin"/></svg> ' + ev.venue + '</p>' +
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
    enterOpen: enterOpen,
    enterHref: enterHref,
    enterLabel: enterLabel,
    eventCardHTML: eventCardHTML,
    shortDate: shortDate
  };

})(window);
