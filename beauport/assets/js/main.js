(function () {
  "use strict";

  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelector(".nav-links");

  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("is-open");
      document.body.classList.toggle("nav-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    links.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        links.classList.remove("is-open");
        document.body.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  if ("IntersectionObserver" in window) {
    var revealEls = document.querySelectorAll(".reveal");
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.remove("js-pending");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    revealEls.forEach(function (el) {
      el.classList.add("js-pending");
      observer.observe(el);
    });
  }

  var dialTicks = document.querySelector(".dial-ticks");
  if (dialTicks) {
    var svgNS = "http://www.w3.org/2000/svg";
    for (var i = 0; i < 60; i++) {
      var angle = i * 6;
      var isMajor = i % 5 === 0;
      var rOuter = 92;
      var rInner = isMajor ? 78 : 84;
      var rad = ((angle - 90) * Math.PI) / 180;
      var line = document.createElementNS(svgNS, "line");
      line.setAttribute("x1", (100 + rOuter * Math.cos(rad)).toFixed(2));
      line.setAttribute("y1", (100 + rOuter * Math.sin(rad)).toFixed(2));
      line.setAttribute("x2", (100 + rInner * Math.cos(rad)).toFixed(2));
      line.setAttribute("y2", (100 + rInner * Math.sin(rad)).toFixed(2));
      line.setAttribute("class", isMajor ? "dial-tick dial-tick--major" : "dial-tick");
      line.setAttribute("stroke-width", isMajor ? "1" : "0.5");
      dialTicks.appendChild(line);
    }
  }

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var parallaxEls = document.querySelectorAll(".horizon-fill");
  if (parallaxEls.length && !reduceMotion) {
    var ticking = false;
    var updateParallax = function () {
      var vh = window.innerHeight;
      parallaxEls.forEach(function (el) {
        var rect = el.parentElement.getBoundingClientRect();
        var center = rect.top + rect.height / 2;
        var progress = (center - vh / 2) / vh;
        var shift = Math.max(-1, Math.min(1, progress)) * -22;
        el.style.transform = "translateY(" + shift.toFixed(1) + "px)";
      });
      ticking = false;
    };
    window.addEventListener(
      "scroll",
      function () {
        if (!ticking) {
          requestAnimationFrame(updateParallax);
          ticking = true;
        }
      },
      { passive: true }
    );
    updateParallax();
  }

  var form = document.querySelector(".enquiry-form");
  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var valid = true;

      form.querySelectorAll("[required]").forEach(function (field) {
        var errorEl = field.parentElement.querySelector(".field-error");
        var filled = field.value.trim().length > 0;
        field.setAttribute("aria-invalid", filled ? "false" : "true");
        if (errorEl) errorEl.classList.toggle("is-visible", !filled);
        if (!filled) valid = false;
      });

      if (!valid) return;

      form.classList.add("is-hidden");
      var success = document.querySelector(".form-success");
      if (success) {
        success.classList.add("is-visible");
        success.setAttribute("tabindex", "-1");
        success.focus();
      }
    });
  }
})();
