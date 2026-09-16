document.addEventListener('DOMContentLoaded', () => {
  // Brand mark: show it only once it has actually loaded, so a missing
  // logo file leaves the type lockup rather than a broken image.
  document.querySelectorAll('[data-brand-mark]').forEach((img) => {
    const reveal = () => {
      img.style.display = 'block';
      if (img.closest('.nav-logo')) img.closest('.nav-logo').classList.add('has-mark');
    };
    if (img.complete) { if (img.naturalWidth > 0) reveal(); }
    else { img.addEventListener('load', reveal); }
  });

  // Mobile nav toggle
  const toggle = document.querySelector('.nav-toggle');
  const panel = document.querySelector('.mobile-panel');
  if (toggle && panel) {
    toggle.addEventListener('click', () => {
      const open = panel.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    panel.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        panel.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // FAQ accordion
  document.querySelectorAll('.accordion-trigger').forEach((btn) => {
    btn.addEventListener('click', () => {
      const panelEl = document.getElementById(btn.getAttribute('aria-controls'));
      const isOpen = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!isOpen));
      if (panelEl) panelEl.classList.toggle('is-open', !isOpen);
    });
  });

  // Scroll reveal
  const revealEls = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && revealEls.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }
});
