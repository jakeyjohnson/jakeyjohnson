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

  // Booking bar: appears once the hero is out of the way, hides again while
  // the ticket section itself is on screen (the buttons are right there).
  const bookBar = document.getElementById('book-bar');
  const ticketsSection = document.getElementById('tickets');
  if (bookBar) {
    let ticketsOnScreen = false;
    if (ticketsSection && 'IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        ticketsOnScreen = entries[0].isIntersecting;
      }, { threshold: 0.2 }).observe(ticketsSection);
    }
    const updateBar = () => {
      const past = window.scrollY > window.innerHeight * 0.7;
      bookBar.classList.toggle('is-visible', past && !ticketsOnScreen);
    };
    updateBar();
    window.addEventListener('scroll', updateBar, { passive: true });
  }

  // Newsletter sign-up.
  // With no action set (the static preview, or before the endpoint is wired
  // up) it validates and shows the success state without navigating. Once an
  // action URL is present it submits normally and the provider takes over.
  const signup = document.getElementById('signup-form');
  if (signup) {
    const errorEl = document.getElementById('signup-error');
    const successEl = document.getElementById('signup-success');
    const fail = (msg, field) => {
      errorEl.textContent = msg;
      errorEl.hidden = false;
      if (field) field.focus();
    };

    signup.addEventListener('submit', (e) => {
      const name = signup.querySelector('#s-name');
      const email = signup.querySelector('#s-email');
      const consent = signup.querySelector('#s-consent');
      errorEl.hidden = true;

      if (!name.value.trim()) { e.preventDefault(); return fail('Please add your first name.', name); }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
        e.preventDefault(); return fail('That email address does not look right.', email);
      }
      if (!consent.checked) { e.preventDefault(); return fail('Please tick the box so we know you want the emails.', consent); }

      // No endpoint yet — confirm in place rather than reloading the page.
      if (!signup.getAttribute('action')) {
        e.preventDefault();
        signup.querySelectorAll('.signup-fields, .consent, button, .form-note').forEach((el) => { el.hidden = true; });
        successEl.hidden = false;
      }
    });
  }

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
