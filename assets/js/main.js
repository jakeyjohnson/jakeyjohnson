(function(){
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ================= Nav scroll state ================= */
  var nav = document.getElementById('nav');
  var burger = document.getElementById('burger');
  var mobileMenu = document.getElementById('mobileMenu');
  var progressBar = document.getElementById('scrollProgress');

  function onScroll(){
    var y = window.scrollY || window.pageYOffset;
    nav.classList.toggle('scrolled', y > 20);

    var doc = document.documentElement;
    var scrollable = doc.scrollHeight - doc.clientHeight;
    var pct = scrollable > 0 ? (y / scrollable) * 100 : 0;
    progressBar.style.width = pct + '%';
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

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

  /* ================= Animated counters ================= */
  var counters = document.querySelectorAll('.stat-num');
  function animateCounter(el){
    var target = parseFloat(el.getAttribute('data-target'));
    var suffix = el.getAttribute('data-suffix') || '';
    var duration = 1600;
    var start = null;

    function step(ts){
      if (!start) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      var value = Math.floor(eased * target);
      el.textContent = value.toLocaleString('en-GB') + suffix;
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target.toLocaleString('en-GB') + suffix;
    }
    requestAnimationFrame(step);
  }
  if ('IntersectionObserver' in window){
    var counterIO = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (entry.isIntersecting){
          animateCounter(entry.target);
          counterIO.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    counters.forEach(function(c){ counterIO.observe(c); });
  } else {
    counters.forEach(function(c){
      c.textContent = c.getAttribute('data-target') + (c.getAttribute('data-suffix') || '');
    });
  }

  /* ================= Event card cursor glow ================= */
  document.querySelectorAll('.event-card').forEach(function(card){
    card.addEventListener('mousemove', function(e){
      var rect = card.getBoundingClientRect();
      card.style.setProperty('--x', (e.clientX - rect.left) + 'px');
      card.style.setProperty('--y', (e.clientY - rect.top) + 'px');
    });
  });

  /* ================= Accordion (FAQ) ================= */
  document.querySelectorAll('.accordion-item').forEach(function(item){
    var trigger = item.querySelector('.accordion-trigger');
    var panel = item.querySelector('.accordion-panel');
    trigger.addEventListener('click', function(){
      var isOpen = item.classList.contains('open');
      document.querySelectorAll('.accordion-item.open').forEach(function(other){
        if (other !== item){
          other.classList.remove('open');
          other.querySelector('.accordion-panel').style.maxHeight = null;
        }
      });
      if (isOpen){
        item.classList.remove('open');
        panel.style.maxHeight = null;
      } else {
        item.classList.add('open');
        panel.style.maxHeight = panel.scrollHeight + 'px';
      }
    });
  });

  /* ================= Signup form ================= */
  var form = document.getElementById('signupForm');
  var signupBox = document.querySelector('.signup-box');
  var successPanel = document.getElementById('signupSuccess');
  var resetBtn = document.getElementById('resetForm');
  var submitBtn = form.querySelector('.btn-submit');

  form.addEventListener('submit', function(e){
    e.preventDefault();
    var valid = true;
    var name = document.getElementById('name');
    var email = document.getElementById('email');
    var city = document.getElementById('city');

    [name, email, city].forEach(function(field){ field.classList.remove('error'); });

    if (!name.value.trim()){ name.classList.add('error'); valid = false; }
    var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email.value.trim())){ email.classList.add('error'); valid = false; }
    if (!city.value){ city.classList.add('error'); valid = false; }

    if (!valid) return;

    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    // NOTE: This demo submits nowhere — wire this up to your real backend
    // (Formspree, Mailchimp, Netlify Forms, your own API, etc). We simulate
    // a short network delay so the UI feels real, then show the success state.
    setTimeout(function(){
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
      signupBox.classList.add('submitted');
      successPanel.classList.add('show');
      if (!reduceMotion) launchConfetti();
    }, 700);
  });

  if (resetBtn){
    resetBtn.addEventListener('click', function(){
      form.reset();
      signupBox.classList.remove('submitted');
      successPanel.classList.remove('show');
    });
  }

  /* ================= Hero particle canvas ================= */
  function initParticleCanvas(canvasId, opts){
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var particles = [];
    var colors = opts.colors || ['#C7FF3A', '#FFC24B', '#F6F7F2', '#C7FF3A'];
    var count = opts.count || 60;
    var w, h, dpr;

    function resize(){
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.parentElement.offsetWidth;
      h = canvas.parentElement.offsetHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function makeParticle(){
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 2.5 + 1,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: Math.random() * 0.5 + 0.2
      };
    }

    function init(){
      resize();
      particles = [];
      for (var i = 0; i < count; i++) particles.push(makeParticle());
    }

    function draw(){
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < particles.length; i++){
        var p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // subtle connecting lines
      for (var a = 0; a < particles.length; a++){
        for (var b = a + 1; b < particles.length; b++){
          var dx = particles[a].x - particles[b].x;
          var dy = particles[a].y - particles[b].y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 110){
            ctx.beginPath();
            ctx.moveTo(particles[a].x, particles[a].y);
            ctx.lineTo(particles[b].x, particles[b].y);
            ctx.strokeStyle = 'rgba(255,255,255,' + (0.08 * (1 - dist / 110)) + ')';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(draw);
    }

    init();
    window.addEventListener('resize', debounce(init, 200));
    if (!reduceMotion) requestAnimationFrame(draw);
  }

  function debounce(fn, wait){
    var t;
    return function(){
      clearTimeout(t);
      var args = arguments, ctx = this;
      t = setTimeout(function(){ fn.apply(ctx, args); }, wait);
    };
  }

  initParticleCanvas('heroCanvas', { count: 70 });
  initParticleCanvas('signupCanvas', { count: 30 });

  /* ================= Confetti burst on signup ================= */
  function launchConfetti(){
    var canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.inset = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '3000';
    document.body.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = window.innerWidth, h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var colors = ['#C7FF3A', '#F6F7F2', '#FFC24B', '#C7FF3A', '#F6F7F2', '#9FCE2C'];
    var pieces = [];
    var pieceCount = 140;

    for (var i = 0; i < pieceCount; i++){
      pieces.push({
        x: w / 2 + (Math.random() - 0.5) * 200,
        y: h * 0.35,
        vx: (Math.random() - 0.5) * 14,
        vy: (Math.random() - 1.6) * 14,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 14,
        shape: Math.random() > 0.5 ? 'rect' : 'circle',
        gravity: 0.35 + Math.random() * 0.15,
        life: 1
      });
    }

    var frame = 0;
    var maxFrames = 150;

    function tick(){
      frame++;
      ctx.clearRect(0, 0, w, h);
      pieces.forEach(function(p){
        p.vy += p.gravity;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotSpeed;
        if (frame > maxFrames * 0.6) p.life -= 1 / (maxFrames * 0.4);

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(p.life, 0);
        ctx.fillStyle = p.color;
        if (p.shape === 'rect'){
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      if (frame < maxFrames){
        requestAnimationFrame(tick);
      } else {
        canvas.remove();
      }
    }
    requestAnimationFrame(tick);
  }

})();
