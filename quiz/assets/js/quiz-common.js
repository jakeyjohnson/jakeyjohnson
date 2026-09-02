/* Shared helpers used by host.html, display.html and play.html.
   Same IIFE-module convention as the Party Padel site's
   assets/js/events.js — plain ES5, no build step. */
(function(window){
  'use strict';

  function escapeHTML(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(c){
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Unambiguous alphabet — no 0/O or 1/I, so a code read aloud or
  // typed by hand off a screen can't be misheard/mistyped.
  var CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  function generateJoinCode(){
    var code = '';
    for (var i = 0; i < 6; i++){
      code += CODE_ALPHABET.charAt(Math.floor(Math.random() * CODE_ALPHABET.length));
    }
    return code;
  }

  // Shape-coded answer icons (colour-blind friendly, matches
  // tokens.css --color-answer-a..d) — plain inline SVG strings.
  var ANSWER_SHAPES = [
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3 L22 20 L2 20 Z"/></svg>',
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2 L22 12 L12 22 L2 12 Z"/></svg>',
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="10"/></svg>',
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/></svg>'
  ];

  function answerShape(index){
    return ANSWER_SHAPES[index] || '';
  }

  function ordinal(n){
    var s = ['th', 'st', 'nd', 'rd'];
    var v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  // Builds a ring countdown inside `el` (expects `el` to be an empty
  // container) and returns { update(fractionRemaining) } — fraction
  // is 1 at the start of the question, 0 when time's up.
  function createCountdownRing(el, totalSeconds){
    var radius = 34;
    var circumference = 2 * Math.PI * radius;
    el.innerHTML =
      '<svg viewBox="0 0 80 80">' +
        '<circle class="countdown-track" cx="40" cy="40" r="' + radius + '"></circle>' +
        '<circle class="countdown-bar" cx="40" cy="40" r="' + radius + '" ' +
          'stroke-dasharray="' + circumference + '" stroke-dashoffset="0"></circle>' +
      '</svg>' +
      '<div class="countdown-value"></div>';
    var bar = el.querySelector('.countdown-bar');
    var value = el.querySelector('.countdown-value');
    el.classList.add('countdown');
    return {
      update: function(fractionRemaining){
        var f = Math.max(0, Math.min(1, fractionRemaining));
        bar.style.strokeDashoffset = String(circumference * (1 - f));
        value.textContent = String(Math.ceil(f * totalSeconds));
        el.classList.toggle('is-urgent', f < 0.25);
      }
    };
  }

  window.QuizCommon = {
    escapeHTML: escapeHTML,
    generateJoinCode: generateJoinCode,
    answerShape: answerShape,
    ordinal: ordinal,
    createCountdownRing: createCountdownRing
  };

})(window);
