/* Shared event data helpers — used by events.html, event.html, enter-team.html, index.html (homepage teaser is static/hardcoded, this file is for pages that render from data). */
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
    return fetch('assets/data/events.json').then(function(res){
      if (!res.ok) throw new Error('Could not load events data');
      return res.json();
    });
  }

  function getQueryParam(name){
    var params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  function statusMeta(status){
    return STATUS_META[status] || STATUS_META['coming-soon'];
  }

  function eventCardHTML(ev){
    var meta = statusMeta(ev.status);
    var ctaLabel = 'Enter a Team';
    var ctaHref = 'enter-team.html?event=' + encodeURIComponent(ev.slug);
    var ctaClass = 'btn-primary';
    if (ev.status === 'coming-soon'){
      ctaLabel = 'Get Notified';
      ctaHref = 'event.html?slug=' + encodeURIComponent(ev.slug);
      ctaClass = 'btn-outline';
    } else if (ev.status === 'sold-out'){
      ctaLabel = 'Entries Closed';
      ctaHref = 'event.html?slug=' + encodeURIComponent(ev.slug);
      ctaClass = 'btn-outline';
    }
    var entrantsLine = ev.status === 'coming-soon'
      ? 'Entries open soon'
      : (ev.teamsEntered + ' of ' + ev.teamsCapacity + ' teams entered');

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
          '<span>From £' + ev.priceTeam + ' / team</span>' +
        '</div>' +
        '<a href="' + ctaHref + '" class="btn ' + ctaClass + ' btn-block">' + ctaLabel + '</a>' +
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
    eventCardHTML: eventCardHTML,
    shortDate: shortDate
  };

})(window);
