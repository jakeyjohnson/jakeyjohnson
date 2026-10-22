// Shared UI building blocks.

import { expandIp, ipTail } from './prefs.js';

// props as properties, except attribute-only ones (aria-*, data-*, list, role)
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    if (k.includes('-') || k === 'list' || k === 'role') node.setAttribute(k, v);
    else node[k] = v;
  }
  node.append(...children.flat().filter((c) => c != null && c !== false));
  return node;
}

export function panel({ step, title, meta, tools = [], id, className = '' }, ...body) {
  return el(
    'section',
    { className: `panel ${className}`, id },
    el(
      'header',
      { className: 'panel-head' },
      step && el('span', { className: 'step', textContent: step }),
      el('h2', { textContent: title }),
      meta && el('span', { className: 'panel-meta', textContent: meta }),
      tools.length ? el('div', { className: 'panel-tools' }, ...tools) : null,
    ),
    el('div', { className: 'panel-body' }, ...body),
  );
}

export function toggle({ label, checked, onchange, disabled, tip, id }) {
  return el(
    'label',
    { className: 'switch' },
    el('input', {
      type: 'checkbox',
      role: 'switch',
      checked: Boolean(checked),
      disabled,
      id,
      onchange: (e) => onchange(e.target.checked),
    }),
    el('span', { className: 'track', 'aria-hidden': 'true' }),
    el('span', { className: 'switch-label', textContent: label }),
    tip ? info(tip) : null,
  );
}

export function segmented(value, options, onchange, label) {
  return el(
    'div',
    { className: 'seg', role: 'radiogroup', 'aria-label': label },
    ...options.map(([v, text]) =>
      el('button', {
        type: 'button',
        role: 'radio',
        'aria-checked': String(v === value),
        className: v === value ? 'on' : '',
        textContent: text,
        onclick: () => {
          if (v !== value) onchange(v);
        },
      }),
    ),
  );
}

export function info(text) {
  return el('span', {
    className: 'info',
    tabIndex: 0,
    role: 'note',
    'aria-label': text,
    'data-tip': text,
    textContent: 'i',
  });
}

export function tag(text, kind = '', tip) {
  return el('span', { className: `tag ${kind}`, textContent: text, title: tip });
}

// <details class="menu">: close on choice, outside click or Escape
export function wireMenus(root = document) {
  root.addEventListener('click', (e) => {
    for (const m of root.querySelectorAll('details.menu[open]')) {
      if (!m.contains(e.target) || e.target.closest('.menu-list button, .menu-list label')) m.open = false;
    }
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape')
      for (const m of root.querySelectorAll('details.menu[open]')) {
        m.open = false;
        m.querySelector('summary')?.focus();
      }
  });
}

export function toast(text, kind = '') {
  let box = document.getElementById('toasts');
  if (!box) {
    box = el('div', { id: 'toasts', className: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(box);
  }
  const t = el(
    'div',
    { className: `toast ${kind}` },
    el('span', {
      className: 'toast-mark',
      'aria-hidden': 'true',
      textContent: kind === 'bad' ? '!' : kind === 'ok' ? '✓' : '•',
    }),
    el('span', { textContent: text }),
  );
  box.append(t);
  setTimeout(() => t.classList.add('out'), kind === 'bad' ? 6500 : 3800);
  setTimeout(() => t.remove(), kind === 'bad' ? 7000 : 4300);
}

// in-page confirm, resolves true/false
export function ask(host, { text, yes, no = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    const done = (v) => {
      strip.remove();
      resolve(v);
    };
    const strip = el(
      'div',
      { className: `ask ${danger ? 'danger' : ''}`, role: 'alertdialog', 'aria-label': text },
      el('span', { className: 'ask-text', textContent: text }),
      el(
        'div',
        { className: 'ask-actions' },
        el('button', { className: 'ghost', textContent: no, onclick: () => done(false) }),
        el('button', {
          className: danger ? 'primary danger' : 'primary',
          textContent: yes,
          onclick: () => done(true),
        }),
      ),
    );
    host.querySelector(':scope > .ask')?.remove();
    host.prepend(strip);
    strip.querySelector('.primary').focus();
  });
}

// Vertical fader: drag cap or track, wheel, arrows (PgUp/PgDn = big steps). pos 0 bottom, 1 top.
export function vfader({ pos, label, valueText, marks = [], disabled = false, onmove }) {
  const cap = el('span', { className: 'vf-cap' });
  const track = el('div', { className: 'vf-track' }, el('span', { className: 'vf-slot' }), cap);
  const node = el(
    'div',
    {
      className: 'vfader',
      role: 'slider',
      tabIndex: disabled ? -1 : 0,
      'aria-label': label,
      'aria-orientation': 'vertical',
      'aria-valuemin': '0',
      'aria-valuemax': '100',
      'aria-disabled': String(disabled),
    },
    el(
      'div',
      { className: 'vf-marks', 'aria-hidden': 'true' },
      ...marks.map(([p, text]) => el('span', { style: `bottom:${p * 100}%`, textContent: text })),
    ),
    track,
  );
  let now = pos;
  const place = (p) => {
    now = Math.min(1, Math.max(0, p));
    cap.style.bottom = `${now * 100}%`;
    node.setAttribute('aria-valuenow', String(Math.round(now * 100)));
    node.setAttribute('aria-valuetext', valueText(now));
  };
  const move = (p) => {
    place(p);
    onmove(now);
  };
  place(pos);
  if (disabled) return node;
  const fromPointer = (e) => {
    const r = track.getBoundingClientRect();
    return 1 - (e.clientY - r.top) / r.height;
  };
  track.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    node.focus();
    track.setPointerCapture(e.pointerId);
    // grabbing the cap keeps the offset; clicking the track jumps
    const r = cap.getBoundingClientRect();
    const offset = e.clientY >= r.top && e.clientY <= r.bottom ? fromPointer(e) - now : 0;
    if (!offset) move(fromPointer(e));
    const drag = (ev) => move(fromPointer(ev) - offset);
    const stop = () => {
      track.removeEventListener('pointermove', drag);
      track.removeEventListener('pointerup', stop);
      track.removeEventListener('pointercancel', stop);
    };
    track.addEventListener('pointermove', drag);
    track.addEventListener('pointerup', stop);
    track.addEventListener('pointercancel', stop);
  });
  node.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      move(now - Math.sign(e.deltaY) * 0.01);
    },
    { passive: false },
  );
  node.addEventListener('keydown', (e) => {
    const step = {
      ArrowUp: 0.005,
      ArrowRight: 0.005,
      ArrowDown: -0.005,
      ArrowLeft: -0.005,
      PageUp: 0.05,
      PageDown: -0.05,
    }[e.key];
    if (e.key === 'Home') {
      e.preventDefault();
      return move(1);
    }
    if (e.key === 'End') {
      e.preventDefault();
      return move(0);
    }
    if (step) {
      e.preventDefault();
      move(now + step);
    }
  });
  return node;
}

// With a preset ("192.168.1") only the last number is typed. A full address is kept as-is
// (device on another network).
export function ipField({ value, prefix, label, onchange, id, className = 'ip', disabled }) {
  const own = prefix && (!value || String(value).startsWith(`${prefix}.`));
  const input = el('input', {
    id,
    value: own ? ipTail(value, prefix) : value || '',
    placeholder: own ? 'last no.' : 'IP',
    inputMode: 'decimal',
    autocomplete: 'off',
    spellcheck: false,
    className,
    'aria-label': label,
    disabled,
    title: prefix ? `Type the last number, or a whole address for another network` : null,
    onchange: (e) => onchange(expandIp(e.target.value, prefix)),
  });
  return el(
    'span',
    { className: `ipfield ${own ? 'has-prefix' : ''}` },
    own ? el('span', { className: 'ip-prefix', textContent: `${prefix}.` }) : null,
    input,
  );
}
