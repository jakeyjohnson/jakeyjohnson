(function(){
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ================= Nav scroll progress ================= */
  var burger = document.getElementById('burger');
  var mobileMenu = document.getElementById('mobileMenu');
  var progressBar = document.getElementById('scrollProgress');

  function onScroll(){
    if (!progressBar) return;
    var y = window.scrollY || window.pageYOffset;
    var doc = document.documentElement;
    var scrollable = doc.scrollHeight - doc.clientHeight;
    var pct = scrollable > 0 ? y / scrollable : 0;
    progressBar.style.transform = 'scaleX(' + pct + ')';
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (burger && mobileMenu){
    burger.addEventListener('click', function(){
      var open = burger.classList.toggle('open');
      mobileMenu.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    mobileMenu.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', function(){
        burger.classList.remove('open');
        mobileMenu.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ================= Scroll reveal ================= */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry, i){
        if (entry.isIntersecting){
          var el = entry.target;
          setTimeout(function(){ el.classList.add('in'); }, (i % 4) * 80);
          io.unobserve(el);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function(el){ io.observe(el); });
  } else {
    revealEls.forEach(function(el){ el.classList.add('in'); });
  }

  /* ================= Accordion (FAQ pages) ================= */
  document.querySelectorAll('.accordion-item').forEach(function(item){
    var trigger = item.querySelector('.accordion-trigger');
    var panel = item.querySelector('.accordion-panel');
    if (!trigger || !panel) return;
    trigger.addEventListener('click', function(){
      var isOpen = item.classList.contains('open');
      document.querySelectorAll('.accordion-item.open').forEach(function(other){
        if (other !== item) other.classList.remove('open');
      });
      item.classList.toggle('open', !isOpen);
    });
  });

  /* ================= Cookie consent banner =================
     UK GDPR/PECR requires consent before setting non-essential
     cookies. The site currently sets none — no analytics, no
     ad pixels — but the gate is wired up now so any future
     tracking script can check PartyPadelConsent.get().analytics
     before loading, without a redesign. Consent choice itself
     is stored in localStorage, which is strictly necessary and
     not subject to the same consent requirement. */
  var CONSENT_KEY = 'pp_cookie_consent';

  function getConsent(){
    try {
      var raw = localStorage.getItem(CONSENT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e){ return null; }
  }

  function setConsent(analytics){
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify({
        essential: true,
        analytics: !!analytics,
        timestamp: new Date().toISOString()
      }));
    } catch (e){ /* localStorage unavailable — banner will just reappear next visit */ }
  }

  function buildBanner(){
    var el = document.createElement('div');
    el.className = 'cookie-banner';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Cookie consent');
    el.innerHTML =
      '<div class="cookie-banner-text">' +
        '<strong>Cookies</strong>' +
        'We use strictly necessary cookies to run this site. With your consent we\'d also like to set optional analytics cookies to see how the site is used — see our <a href="privacy.html">Cookie Policy</a>.' +
      '</div>' +
      '<div class="cookie-banner-actions">' +
        '<button type="button" class="btn btn-outline btn-small" data-consent="necessary">Necessary Only</button>' +
        '<button type="button" class="btn btn-primary btn-small" data-consent="all">Accept All</button>' +
      '</div>';
    return el;
  }

  function showBanner(){
    var existing = document.querySelector('.cookie-banner');
    if (existing) existing.remove();
    var banner = buildBanner();
    document.body.appendChild(banner);
    banner.querySelector('[data-consent="all"]').addEventListener('click', function(){
      setConsent(true);
      hideBanner(banner);
    });
    banner.querySelector('[data-consent="necessary"]').addEventListener('click', function(){
      setConsent(false);
      hideBanner(banner);
    });
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){ banner.classList.add('visible'); });
    });
  }

  function hideBanner(banner){
    banner.classList.remove('visible');
    setTimeout(function(){ banner.remove(); }, reduceMotion ? 0 : 450);
  }

  window.PartyPadelConsent = {
    get: getConsent,
    openPreferences: showBanner
  };

  if (!getConsent()) showBanner();

})();
