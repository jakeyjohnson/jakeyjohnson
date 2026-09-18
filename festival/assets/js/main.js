/* Wilderwood Festival — nav, theme, reveal, accordion, line-up tabs.
   No dependencies. Every enhancement is additive: the pages work
   with JavaScript switched off. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- theme ---------- */
  var STORE = 'wilderwood-theme';
  try {
    var saved = localStorage.getItem(STORE);
    if (saved === 'dark' || saved === 'light') root.setAttribute('data-theme', saved);
  } catch (e) { /* private mode — fall back to prefers-color-scheme */ }

  function currentTheme() {
    var set = root.getAttribute('data-theme');
    if (set) return set;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  document.querySelectorAll('.theme-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem(STORE, next); } catch (e) {}
      btn.setAttribute('aria-label', next === 'dark' ? 'Switch to day mode' : 'Switch to night mode');
    });
  });

  /* ---------- mobile drawer ---------- */
  var drawer = document.getElementById('drawer');
  var openers = document.querySelectorAll('[data-drawer-open]');
  var closers = document.querySelectorAll('[data-drawer-close]');

  function setDrawer(open) {
    if (!drawer) return;
    drawer.setAttribute('data-open', open ? 'true' : 'false');
    drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    document.body.classList.toggle('is-locked', open);
    openers.forEach(function (b) { b.setAttribute('aria-expanded', open ? 'true' : 'false'); });
    if (open) {
      var first = drawer.querySelector('a, button');
      if (first) first.focus();
    } else if (openers[0]) {
      openers[0].focus();
    }
  }
  openers.forEach(function (b) { b.addEventListener('click', function () { setDrawer(true); }); });
  closers.forEach(function (b) { b.addEventListener('click', function () { setDrawer(false); }); });
  drawer && drawer.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () { setDrawer(false); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && drawer && drawer.getAttribute('data-open') === 'true') setDrawer(false);
  });
  if (drawer) setDrawer(false);

  /* ---------- scroll reveal ---------- */
  var targets = document.querySelectorAll('.reveal');
  if (reduced || !('IntersectionObserver' in window)) {
    targets.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var delay = Number(el.getAttribute('data-delay') || 0);
        window.setTimeout(function () { el.classList.add('is-in'); }, delay);
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    targets.forEach(function (el) { io.observe(el); });
  }

  /* ---------- accordion ---------- */
  document.querySelectorAll('.acc__btn').forEach(function (btn) {
    var panel = document.getElementById(btn.getAttribute('aria-controls'));
    if (!panel) return;
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
      panel.setAttribute('data-open', open ? 'false' : 'true');
    });
  });

  /* ---------- line-up day tabs ---------- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[data-day-tab]'));
  var days = Array.prototype.slice.call(document.querySelectorAll('[data-day-panel]'));

  function showDay(day) {
    tabs.forEach(function (t) {
      t.setAttribute('aria-selected', t.getAttribute('data-day-tab') === day ? 'true' : 'false');
    });
    days.forEach(function (p) {
      var match = day === 'all' || p.getAttribute('data-day-panel') === day;
      p.hidden = !match;
    });
  }
  tabs.forEach(function (t) {
    t.addEventListener('click', function () { showDay(t.getAttribute('data-day-tab')); });
    t.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      var i = tabs.indexOf(t);
      var next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      next.focus();
      showDay(next.getAttribute('data-day-tab'));
    });
  });
  if (tabs.length) showDay('all');

  /* ---------- demo forms ---------- */
  document.querySelectorAll('form[data-demo]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var note = form.querySelector('.form-note');
      if (note) note.textContent = 'Thanks — demo site, nothing was sent. Wire this form to your mailing list provider.';
    });
  });

  /* ---------- current year ---------- */
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();
