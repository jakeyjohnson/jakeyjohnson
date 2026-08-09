(function () {
  'use strict';

  /* Tactile press/hover feedback for buttons, powered by the Motion
     library (https://motion.dev), vendored locally as its UMD build
     (assets/js/vendor/motion.js -> window.Motion). Purely additive: if
     that script hasn't loaded for any reason, buttons keep working
     exactly as before via the existing CSS hover states. */
  if (typeof window.Motion === 'undefined') return;
  var animate = window.Motion.animate;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  document.querySelectorAll('.btn').forEach(function (btn) {
    btn.addEventListener('pointerenter', function () {
      animate(btn, { scale: 1.03 }, { duration: 0.2, easing: [0.22, 1, 0.36, 1] });
    });
    btn.addEventListener('pointerleave', function () {
      animate(btn, { scale: 1 }, { duration: 0.2, easing: [0.22, 1, 0.36, 1] });
    });
    btn.addEventListener('pointerdown', function () {
      animate(btn, { scale: 0.96 }, { duration: 0.1, easing: [0.22, 1, 0.36, 1] });
    });
    btn.addEventListener('pointerup', function () {
      animate(btn, { scale: 1.03 }, { duration: 0.15, easing: [0.22, 1, 0.36, 1] });
    });
  });
})();
