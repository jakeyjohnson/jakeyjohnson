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

  // Countdown to gates opening, Sat 5 June 2027, 10:00
  const cd = document.getElementById('countdown');
  if (cd) {
    const target = new Date('2027-06-05T10:00:00+01:00').getTime();
    const fields = {};
    cd.querySelectorAll('[data-cd]').forEach((el) => { fields[el.dataset.cd] = el; });
    const pad = (n) => String(n).padStart(2, '0');
    let timer = null;
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        cd.hidden = true;
        if (timer) clearInterval(timer);
        return;
      }
      const s = Math.floor(diff / 1000);
      fields.days.textContent = Math.floor(s / 86400);
      fields.hours.textContent = pad(Math.floor(s / 3600) % 24);
      fields.mins.textContent = pad(Math.floor(s / 60) % 60);
      fields.secs.textContent = pad(s % 60);
    };
    tick();
    if (!cd.hidden) timer = setInterval(tick, 1000);
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
