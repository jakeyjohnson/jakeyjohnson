/* =========================================================
   Jake's Budget Estimator — Form wiring & rendering
   Depends on assets/js/rates.js (loaded first, exposes
   window.BudgetEstimator).
   ========================================================= */

(function () {
  'use strict';

  var BE = window.BudgetEstimator;
  var form = document.getElementById('estimator-form');
  var projectTypeEl = document.getElementById('project-type');
  var locationEl = document.getElementById('location');
  var sizeEl = document.getElementById('size');
  var durationEl = document.getElementById('duration');
  var tierEl = document.getElementById('finish-tier');
  var notesEl = document.getElementById('notes');
  var sizeNoteEl = document.getElementById('size-note');
  var durationNoteEl = document.getElementById('duration-note');
  var calculateBtn = document.getElementById('calculate-btn');
  var printBtn = document.getElementById('print-btn');
  var editBtn = document.getElementById('edit-btn');

  var resultsEmpty = document.getElementById('results-empty');
  var resultsContent = document.getElementById('results-content');
  var rangeLowEl = document.getElementById('range-low');
  var rangeHighEl = document.getElementById('range-high');
  var categoriesEl = document.getElementById('results-categories');
  var assumptionsListEl = document.getElementById('assumptions-list');
  var resultsNotesEl = document.getElementById('results-notes');
  var resultsNotesTextEl = document.getElementById('results-notes-text');

  var hasCalculatedOnce = false;

  // Seed sensible defaults for the initially-selected project type.
  applyDefaults(projectTypeEl.value);

  projectTypeEl.addEventListener('change', function () {
    checkUnusualRange();
  });
  sizeEl.addEventListener('input', function () {
    clearFieldError(sizeEl);
    checkUnusualRange();
  });
  durationEl.addEventListener('input', function () {
    clearFieldError(durationEl);
    checkUnusualRange();
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) return;
    runCalculation();
  });

  var assumptionsPanel = document.getElementById('assumptions-panel');
  var assumptionsWasOpenBeforePrint = false;

  printBtn.addEventListener('click', function () {
    window.print();
  });

  // <details> hides its content natively when closed — display:block in
  // print.css can't reliably override that in Chromium, so force it open
  // for the print pass and restore whatever state it was in afterward.
  window.addEventListener('beforeprint', function () {
    assumptionsWasOpenBeforePrint = assumptionsPanel.hasAttribute('open');
    assumptionsPanel.setAttribute('open', '');
  });

  window.addEventListener('afterprint', function () {
    if (!assumptionsWasOpenBeforePrint) assumptionsPanel.removeAttribute('open');
  });

  editBtn.addEventListener('click', function () {
    projectTypeEl.focus();
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  function applyDefaults(projectType) {
    var d = BE.DEFAULTS[projectType];
    if (!d) return;
    if (!sizeEl.value) sizeEl.value = d.sqm;
    if (!durationEl.value) durationEl.value = d.weeks;
  }

  function checkUnusualRange() {
    var range = BE.RANGES[projectTypeEl.value];
    var typeLabel = BE.LABELS.projectType[projectTypeEl.value];

    var sqm = Number(sizeEl.value);
    if (sizeEl.value && (sqm < range.sqm[0] || sqm > range.sqm[1])) {
      showNote(sizeNoteEl, (sqm < range.sqm[0] ? 'Smaller' : 'Larger') + ' than typical (' + range.sqm[0] + '–' + range.sqm[1] + ' sqm) for a ' + typeLabel + '. The estimate will still calculate using your number.');
    } else {
      hideNote(sizeNoteEl);
    }

    var weeks = Number(durationEl.value);
    if (durationEl.value && (weeks < range.weeks[0] || weeks > range.weeks[1])) {
      showNote(durationNoteEl, (weeks < range.weeks[0] ? 'Shorter' : 'Longer') + ' than typical (' + range.weeks[0] + '–' + range.weeks[1] + ' weeks) for a ' + typeLabel + '. The estimate will still calculate using your number.');
    } else {
      hideNote(durationNoteEl);
    }
  }

  function showNote(el, text) {
    el.textContent = text;
    el.hidden = false;
  }

  function hideNote(el) {
    el.hidden = true;
    el.textContent = '';
  }

  function validate() {
    clearFieldError(sizeEl);
    clearFieldError(durationEl);

    if (!sizeEl.value || Number(sizeEl.value) <= 0) {
      setFieldError(sizeEl, 'Enter a size greater than zero.');
      sizeEl.focus();
      return false;
    }
    if (!durationEl.value || Number(durationEl.value) <= 0) {
      setFieldError(durationEl, 'Enter a duration greater than zero.');
      durationEl.focus();
      return false;
    }
    return true;
  }

  function setFieldError(el, message) {
    el.setAttribute('aria-invalid', 'true');
    var noteEl = el.id === 'size' ? sizeNoteEl : durationNoteEl;
    noteEl.textContent = message;
    noteEl.hidden = false;
    noteEl.classList.add('field-note--error');
  }

  function clearFieldError(el) {
    el.removeAttribute('aria-invalid');
    var noteEl = el.id === 'size' ? sizeNoteEl : durationNoteEl;
    noteEl.classList.remove('field-note--error');
  }

  function runCalculation() {
    calculateBtn.disabled = true;
    calculateBtn.textContent = 'Calculating…';

    window.setTimeout(function () {
      var inputs = {
        projectType: projectTypeEl.value,
        location: locationEl.value,
        sqm: sizeEl.value,
        weeks: durationEl.value,
        tier: tierEl.value,
        extras: {
          bespokeJoinery: form.bespokeJoinery.checked,
          structuralGlazing: form.structuralGlazing.checked,
          signage: form.signage.checked,
          furniture: form.furniture.checked,
          av: form.av.checked,
          staffing: form.staffing.checked
        }
      };

      var result = BE.calculateEstimate(inputs);
      render(result, notesEl.value.trim());

      calculateBtn.disabled = false;
      calculateBtn.textContent = 'Recalculate estimate';
      hasCalculatedOnce = true;

      if (window.matchMedia('(max-width: 767px)').matches) {
        resultsContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 400);
  }

  function render(result, notes) {
    resultsEmpty.hidden = true;
    resultsContent.hidden = false;

    rangeLowEl.textContent = BE.formatCurrency(result.rangeLow);
    rangeHighEl.textContent = BE.formatCurrency(result.rangeHigh);

    categoriesEl.innerHTML = '';
    result.categories.forEach(function (category) {
      categoriesEl.appendChild(buildCategoryBlock(category));
    });

    assumptionsListEl.innerHTML = '';
    result.assumptionsUsed.forEach(function (text) {
      var li = document.createElement('li');
      li.textContent = text;
      assumptionsListEl.appendChild(li);
    });

    if (notes) {
      resultsNotesTextEl.textContent = notes;
      resultsNotesEl.hidden = false;
    } else {
      resultsNotesEl.hidden = true;
    }
  }

  function buildCategoryBlock(category) {
    var block = document.createElement('div');
    block.className = 'category-block';

    var heading = document.createElement('h3');
    heading.className = 'category-heading';
    var nameSpan = document.createElement('span');
    nameSpan.textContent = category.name;
    var subtotalSpan = document.createElement('span');
    subtotalSpan.className = 'category-subtotal';
    subtotalSpan.textContent = BE.formatCurrency(category.subtotal);
    heading.appendChild(nameSpan);
    heading.appendChild(subtotalSpan);
    block.appendChild(heading);

    var list = document.createElement('ul');
    list.className = 'line-items';
    category.items.forEach(function (item) {
      var li = document.createElement('li');
      li.className = 'line-item';
      var nameEl = document.createElement('span');
      nameEl.className = 'line-item-name';
      nameEl.textContent = item.name;
      var amountEl = document.createElement('span');
      amountEl.className = 'line-item-amount';
      amountEl.textContent = BE.formatCurrency(item.amount);
      li.appendChild(nameEl);
      li.appendChild(amountEl);
      list.appendChild(li);
    });
    block.appendChild(list);

    return block;
  }
})();
