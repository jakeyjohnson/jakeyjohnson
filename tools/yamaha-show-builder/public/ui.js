// Small UI building blocks shared by every tab: elements, panels, switches, segmented controls,
// info tips, drop-down menus and toasts.

// Props are set as properties, except attribute-only ones (aria-*, data-*, list, role)
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

// A panel: step number, title, live meta (counts), tools on the right, then the body
export function panel({ step, title, meta, tools = [], id, className = '' }, ...body) {
  return el('section', { className: `panel ${className}`, id },
    el('header', { className: 'panel-head' },
      step && el('span', { className: 'step', textContent: step }),
      el('h2', { textContent: title }),
      meta && el('span', { className: 'panel-meta', textContent: meta }),
      tools.length ? el('div', { className: 'panel-tools' }, ...tools) : null),
    el('div', { className: 'panel-body' }, ...body));
}

// An on/off switch with its label
export function toggle({ label, checked, onchange, disabled, tip, id }) {
  return el('label', { className: 'switch' },
    el('input', { type: 'checkbox', role: 'switch', checked: Boolean(checked), disabled, id, onchange: (e) => onchange(e.target.checked) }),
    el('span', { className: 'track', 'aria-hidden': 'true' }),
    el('span', { className: 'switch-label', textContent: label }),
    tip ? info(tip) : null);
}

// Two or three choices side by side, one selected
export function segmented(value, options, onchange, label) {
  return el('div', { className: 'seg', role: 'radiogroup', 'aria-label': label },
    ...options.map(([v, text]) => el('button', {
      type: 'button', role: 'radio', 'aria-checked': String(v === value), className: v === value ? 'on' : '', textContent: text,
      onclick: () => { if (v !== value) onchange(v); },
    })));
}

// A small "i" that shows a short explanation on hover or focus
export function info(text) {
  return el('span', { className: 'info', tabIndex: 0, role: 'note', 'aria-label': text, 'data-tip': text, textContent: 'i' });
}

// A label/value tag, for states like "Sent to desk" or "Set in R1"
export function tag(text, kind = '', tip) {
  return el('span', { className: `tag ${kind}`, textContent: text, title: tip });
}

// Drop-down menus built from <details class="menu">: close on choice, outside click or Escape
export function wireMenus(root = document) {
  root.addEventListener('click', (e) => {
    for (const m of root.querySelectorAll('details.menu[open]')) {
      if (!m.contains(e.target) || e.target.closest('.menu-list button, .menu-list label')) m.open = false;
    }
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') for (const m of root.querySelectorAll('details.menu[open]')) { m.open = false; m.querySelector('summary')?.focus(); }
  });
}

// Toasts: short messages that fade after a few seconds, bottom right
export function toast(text, kind = '') {
  let box = document.getElementById('toasts');
  if (!box) {
    box = el('div', { id: 'toasts', className: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(box);
  }
  const t = el('div', { className: `toast ${kind}` }, el('span', { className: 'toast-mark', 'aria-hidden': 'true', textContent: kind === 'bad' ? '!' : kind === 'ok' ? '✓' : '•' }), el('span', { textContent: text }));
  box.append(t);
  setTimeout(() => t.classList.add('out'), kind === 'bad' ? 6500 : 3800);
  setTimeout(() => t.remove(), kind === 'bad' ? 7000 : 4300);
}

// An in-page confirm: a strip with the question and two buttons. Resolves true or false.
export function ask(host, { text, yes, no = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    const done = (v) => { strip.remove(); resolve(v); };
    const strip = el('div', { className: `ask ${danger ? 'danger' : ''}`, role: 'alertdialog', 'aria-label': text },
      el('span', { className: 'ask-text', textContent: text }),
      el('div', { className: 'ask-actions' },
        el('button', { className: 'ghost', textContent: no, onclick: () => done(false) }),
        el('button', { className: danger ? 'primary danger' : 'primary', textContent: yes, onclick: () => done(true) })));
    host.querySelector(':scope > .ask')?.remove();
    host.prepend(strip);
    strip.querySelector('.primary').focus();
  });
}
