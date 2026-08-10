// Flair Entertainment — shared behaviour: mobile nav, scroll-reveal,
// hero word-stagger, sticky header state. No framework, no build step.
(function () {
  'use strict';

  // ---------- Sticky header shadow state ----------
  var header = document.querySelector('.site-header');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // ---------- Mobile nav drawer ----------
  var toggle = document.querySelector('.nav__toggle');
  var drawer = document.querySelector('.nav__drawer');
  if (toggle && drawer) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      drawer.classList.toggle('is-open', !open);
      document.body.style.overflow = open ? '' : 'hidden';
    });
    drawer.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        toggle.setAttribute('aria-expanded', 'false');
        drawer.classList.remove('is-open');
        document.body.style.overflow = '';
      });
    });
  }

  // ---------- Hero headline word-stagger ----------
  // Wraps each word of [data-hero-headline] in a span so the CSS
  // animation (--word-index) can stagger the reveal per word.
  document.querySelectorAll('[data-hero-headline]').forEach(function (el) {
    var words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words
      .map(function (w, i) {
        return '<span class="hero__word" style="--word-index:' + i + '">' + w + '</span>';
      })
      .join(' ');
  });

  // ---------- Scroll-reveal ----------
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    revealEls.forEach(function (el, i) {
      el.style.setProperty('--reveal-index', el.dataset.revealIndex || i % 6);
      io.observe(el);
    });
  } else {
    revealEls.forEach(function (el) {
      el.classList.add('is-visible');
    });
  }

  // ---------- Marquee: duplicate track content for seamless loop ----------
  document.querySelectorAll('[data-marquee]').forEach(function (track) {
    track.innerHTML += track.innerHTML;
  });

  // ---------- Client-side form validation + success state ----------
  // No backend exists on static hosting, so this validates and shows
  // a success state only — see README for wiring a real submit target
  // (Formspree/Netlify Forms/mailto) before launch.
  document.querySelectorAll('[data-validate-form]').forEach(function (wrapper) {
    var form = wrapper.querySelector('form');
    if (!form) return;
    var fields = form.querySelectorAll('input, textarea, select');
    fields.forEach(function (field) {
      field.addEventListener('blur', function () {
        field.setAttribute('data-touched', 'true');
      });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      fields.forEach(function (field) {
        field.setAttribute('data-touched', 'true');
      });
      if (form.checkValidity()) {
        wrapper.classList.add('is-success');
        wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        var firstInvalid = form.querySelector(':invalid');
        if (firstInvalid) firstInvalid.focus();
      }
    });
  });
})();
