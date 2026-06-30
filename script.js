/**
 * MARY CAKE — LUXURY EXPERIENCE v4
 *
 * Módulos:
 * 1. Canvas Background — relevo creme interativo com partículas douradas
 * 2. Loader
 * 3. Device Detection — lógica mobile vs desktop para CTAs
 * 4. Nav — scroll state + burger menu
 * 5. Cake Assembly — scroll-driven stage (scrub: true, pin: true)
 * 6. Section Reveals — IntersectionObserver
 * 7. Phone Tilt — parallax 3D no mockup do app
 * 8. Mobile FAB — visibilidade por scroll
 * 9. Misc
 */

(function () {
  'use strict';

  /* ─── UTILS ─── */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
  const lerp = (a, b, t) => a + (b - a) * t;
  const isMobile = () => /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768;
  const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ─── APK LINK ─── */
  const APK_URL = 'https://drive.google.com/uc?export=download&id=1E-_SBshzuCfzUelFhl0JAAkqN7XHf2hf';
  const CARDAPIO_URL = 'https://mary-cake.netlify.app/';

  /* ═══════════════════════════════════════════════════════════
     1. CANVAS BACKGROUND — ondas cream + partículas douradas
  ══════════════════════════════════════════════════════════════ */
  function initBackground() {
    if (prefersReducedMotion()) return;

    const canvas = $('#bgCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let W, H, mouseX = 0.5, mouseY = 0.5;
    let targetMX = 0.5, targetMY = 0.5;
    let time = 0;
    let raf;

    /* Partículas douradas microscópicas */
    const particles = [];
    const PARTICLE_COUNT = 28;

    function createParticle() {
      return {
        x: Math.random(),
        y: Math.random(),
        r: 1 + Math.random() * 1.5,
        speed: 0.00015 + Math.random() * 0.0002,
        angle: Math.random() * Math.PI * 2,
        angleSpeed: (Math.random() - 0.5) * 0.008,
        opacity: 0.05 + Math.random() * 0.12,
        phase: Math.random() * Math.PI * 2,
      };
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(createParticle());

    function resize() {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);

      /* Suave lerp do mouse */
      mouseX = lerp(mouseX, targetMX, 0.035);
      mouseY = lerp(mouseY, targetMY, 0.035);
      time += 0.004;

      const mx = mouseX - 0.5;  // -0.5 a 0.5
      const my = mouseY - 0.5;

      /* ── Relevo fluido: múltiplos gradientes radiais que se deslocam com o mouse ── */
      // Blob 1 — rosado champagne (canto superior esquerdo, segue mouse levemente)
      const g1x = (0.2 + mx * 0.18) * W;
      const g1y = (0.25 + my * 0.14 + Math.sin(time * 0.7) * 0.03) * H;
      const grad1 = ctx.createRadialGradient(g1x, g1y, 0, g1x, g1y, W * 0.45);
      grad1.addColorStop(0, 'rgba(245,230,216,0.72)');
      grad1.addColorStop(0.5, 'rgba(245,230,216,0.18)');
      grad1.addColorStop(1, 'transparent');
      ctx.fillStyle = grad1;
      ctx.fillRect(0, 0, W, H);

      // Blob 2 — creme quente (centro-direita, movimento oposto)
      const g2x = (0.75 - mx * 0.12) * W;
      const g2y = (0.45 - my * 0.08 + Math.sin(time * 0.5 + 1) * 0.04) * H;
      const grad2 = ctx.createRadialGradient(g2x, g2y, 0, g2x, g2y, W * 0.42);
      grad2.addColorStop(0, 'rgba(245,239,230,0.6)');
      grad2.addColorStop(0.6, 'rgba(245,239,230,0.1)');
      grad2.addColorStop(1, 'transparent');
      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, W, H);

      // Blob 3 — dourado champagne (inferior, pulsa suavemente)
      const g3x = (0.45 + mx * 0.1 + Math.sin(time * 0.9) * 0.04) * W;
      const g3y = (0.8 + my * 0.1) * H;
      const grad3 = ctx.createRadialGradient(g3x, g3y, 0, g3x, g3y, W * 0.35);
      grad3.addColorStop(0, 'rgba(201,145,76,0.06)');
      grad3.addColorStop(0.5, 'rgba(201,145,76,0.02)');
      grad3.addColorStop(1, 'transparent');
      ctx.fillStyle = grad3;
      ctx.fillRect(0, 0, W, H);

      // Blob 4 — rosa coral tênue (superior direito)
      const g4x = (0.82 + mx * 0.08) * W;
      const g4y = (0.15 + my * 0.1 + Math.sin(time * 0.6 + 2) * 0.03) * H;
      const grad4 = ctx.createRadialGradient(g4x, g4y, 0, g4x, g4y, W * 0.3);
      grad4.addColorStop(0, 'rgba(232,112,90,0.05)');
      grad4.addColorStop(1, 'transparent');
      ctx.fillStyle = grad4;
      ctx.fillRect(0, 0, W, H);

      /* ── Partículas douradas ── */
      particles.forEach(p => {
        p.angle += p.angleSpeed;
        p.x += Math.cos(p.angle) * p.speed + mx * 0.0003;
        p.y += Math.sin(p.angle) * p.speed * 0.6 + my * 0.0002;

        // Wrap
        if (p.x < -0.02) p.x = 1.02;
        if (p.x > 1.02)  p.x = -0.02;
        if (p.y < -0.02) p.y = 1.02;
        if (p.y > 1.02)  p.y = -0.02;

        const opacity = p.opacity * (0.7 + 0.3 * Math.sin(time * 2 + p.phase));
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(201,145,76,${opacity})`;
        ctx.fill();
      });

      raf = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize, { passive: true });

    /* Mouse / touch */
    window.addEventListener('mousemove', e => {
      targetMX = e.clientX / window.innerWidth;
      targetMY = e.clientY / window.innerHeight;
    }, { passive: true });

    window.addEventListener('touchmove', e => {
      if (e.touches.length > 0) {
        targetMX = e.touches[0].clientX / window.innerWidth;
        targetMY = e.touches[0].clientY / window.innerHeight;
      }
    }, { passive: true });

    draw();
  }


  /* ═══════════════════════════════════════════════════════════
     1b. PARTICLE TRAIL — rastro dourado seguindo mouse/touch
  ══════════════════════════════════════════════════════════════ */
  function initParticleTrail() {
    if (prefersReducedMotion()) return;

    const canvas = $('#trailCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let W, H;
    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    let trail = [];
    const MAX_TRAIL = 36;
    let lastX = null, lastY = null;

    function addPoint(x, y) {
      if (lastX !== null) {
        const dist = Math.hypot(x - lastX, y - lastY);
        const steps = Math.min(4, Math.max(1, Math.floor(dist / 14)));
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          trail.push({
            x: lerp(lastX, x, t),
            y: lerp(lastY, y, t),
            life: 1,
            r: 1.5 + Math.random() * 2.2,
            dx: (Math.random() - 0.5) * 0.4,
            dy: (Math.random() - 0.5) * 0.4 - 0.15,
          });
        }
      } else {
        trail.push({ x, y, life: 1, r: 2, dx: 0, dy: -0.1 });
      }
      lastX = x; lastY = y;
      if (trail.length > MAX_TRAIL * 2) trail.splice(0, trail.length - MAX_TRAIL * 2);
    }

    window.addEventListener('mousemove', e => addPoint(e.clientX, e.clientY), { passive: true });
    window.addEventListener('touchmove', e => {
      if (e.touches.length > 0) addPoint(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    window.addEventListener('touchend', () => { lastX = null; lastY = null; }, { passive: true });

    function draw() {
      ctx.clearRect(0, 0, W, H);
      trail.forEach(p => {
        p.life -= 0.025;
        p.x += p.dx;
        p.y += p.dy;
      });
      trail = trail.filter(p => p.life > 0);

      trail.forEach(p => {
        const r = p.r * p.life;
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4);
        grad.addColorStop(0, `rgba(201,145,76,${0.55 * p.life})`);
        grad.addColorStop(0.4, `rgba(232,112,90,${0.22 * p.life})`);
        grad.addColorStop(1, 'rgba(201,145,76,0)');
        ctx.beginPath();
        ctx.fillStyle = grad;
        ctx.arc(p.x, p.y, r * 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = `rgba(255,248,235,${0.85 * p.life})`;
        ctx.arc(p.x, p.y, Math.max(0.4, r * 0.5), 0, Math.PI * 2);
        ctx.fill();
      });

      requestAnimationFrame(draw);
    }
    draw();
  }


  /* ═══════════════════════════════════════════════════════════
     2. LOADER
  ══════════════════════════════════════════════════════════════ */
  function initLoader() {
    const loader = $('#loader');
    if (!loader) return;

    const minDuration = 1500;
    const start = performance.now();

    document.fonts.ready.then(() => {
      const elapsed = performance.now() - start;
      const remaining = Math.max(0, minDuration - elapsed);
      setTimeout(() => {
        loader.classList.add('is-gone');
        document.body.style.overflow = '';
      }, remaining);
    });

    // Fallback
    setTimeout(() => loader.classList.add('is-gone'), 3200);
  }


  /* ═══════════════════════════════════════════════════════════
     3. DEVICE DETECTION — CTAs adaptativos
  ══════════════════════════════════════════════════════════════ */
  function initDeviceAdaptation() {
    const mobile = isMobile();

    /* Nav CTA */
    const navCta = $('#navCta');
    const navCtaLabel = $('#navCtaLabel');
    if (navCta && navCtaLabel) {
      if (mobile) {
        navCtaLabel.textContent = 'Baixar Aplicativo';
        navCta.href = APK_URL;
        navCta.setAttribute('download', '');
      } else {
        navCtaLabel.textContent = 'Acessar Cardápio Digital';
        navCta.href = CARDAPIO_URL;
        navCta.setAttribute('target', '_blank');
        navCta.setAttribute('rel', 'noopener');
      }
    }

    /* Mobile menu CTA */
    const mobileCtaLink = $('#mobileCtaLink');
    if (mobileCtaLink) {
      if (mobile) {
        mobileCtaLink.textContent = 'Baixar Aplicativo Mary Cake';
        mobileCtaLink.href = APK_URL;
        mobileCtaLink.setAttribute('download', '');
      } else {
        mobileCtaLink.textContent = 'Acessar Cardápio Digital';
        mobileCtaLink.href = CARDAPIO_URL;
        mobileCtaLink.setAttribute('target', '_blank');
        mobileCtaLink.setAttribute('rel', 'noopener');
      }
    }

    /* APK button */
    const apkBtn = $('#apkBtn');
    if (apkBtn) {
      apkBtn.href = APK_URL;
    }

    /* FAB */
    const fab = $('#mobileFab');
    if (fab) {
      fab.href = APK_URL;
    }
  }


  /* ═══════════════════════════════════════════════════════════
     4. NAV
  ══════════════════════════════════════════════════════════════ */
  function initNav() {
    const nav = $('#nav');
    const burger = $('#navBurger');
    const menu = $('#mobileMenu');
    const closeBtn = $('#mobileMenuClose');

    /* Scroll state */
    let scrolled = false;
    function handleScroll() {
      const should = window.scrollY > 60;
      if (should !== scrolled) {
        scrolled = should;
        nav.classList.toggle('is-scrolled', scrolled);
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    /* Burger toggle */
    function openMenu() {
      menu.classList.add('is-open');
      burger.classList.add('is-open');
      burger.setAttribute('aria-expanded', 'true');
      menu.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
    function closeMenu() {
      menu.classList.remove('is-open');
      burger.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
      menu.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    if (burger) burger.addEventListener('click', () => {
      menu.classList.contains('is-open') ? closeMenu() : openMenu();
    });
    if (closeBtn) closeBtn.addEventListener('click', closeMenu);

    /* Fechar ao clicar em link */
    if (menu) {
      $$('a', menu).forEach(a => a.addEventListener('click', closeMenu));
    }
  }


  /* ═══════════════════════════════════════════════════════════
     5. CAKE ASSEMBLY — scroll-driven (pin + scrub)
  ══════════════════════════════════════════════════════════════ */
  function initCakeAssembly() {
    gsap.registerPlugin(ScrollTrigger);
    gsap.config({ force3D: true });

    if (prefersReducedMotion()) {
      $$('.cake-layer, .garnish, .particle-el, .cake-plate, .cake-drip').forEach(el => {
        gsap.set(el, { opacity: 1, y: 0 });
      });
      return;
    }

    const cakeScene = $('#cakeScene');
    const cakePin   = $('#cakePin');
    if (!cakeScene || !cakePin) return;

    const SCENE_W = clamp(window.innerWidth * 0.22, 160, 280);

    /* Posicionar layers */
    const layerDefs = [
      { el: '#cakeL0', height: SCENE_W * 0.17, sideH: SCENE_W * 0.19, y: 0 },
      { el: '#cakeL1', height: SCENE_W * 0.08, sideH: SCENE_W * 0.06, y: SCENE_W * 0.36 },
      { el: '#cakeL2', height: SCENE_W * 0.17, sideH: SCENE_W * 0.19, y: SCENE_W * 0.44 },
      { el: '#cakeL3', height: SCENE_W * 0.13, sideH: SCENE_W * 0.24, y: SCENE_W * 0.78 },
    ];

    const totalH = SCENE_W * 1.02;
    layerDefs.forEach(def => {
      const el = $(def.el);
      if (!el) return;
      const face = el.querySelector('.cake-layer-face--top');
      const side = el.querySelector('.cake-layer-side');
      if (face) gsap.set(face, { height: def.height });
      if (side) gsap.set(side, { height: def.sideH });
      gsap.set(el, {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        y: def.y - totalH / 2,
        transformOrigin: 'center bottom',
      });
    });

    /* Iniciar fora de vista */
    gsap.set('#cakePlate', { opacity: 0 });
    gsap.set('#cakeL0', { y: '+=160', opacity: 0 });
    gsap.set('#cakeL1', { y: '+=120', opacity: 0 });
    gsap.set('#cakeL2', { y: '+=100', opacity: 0 });
    gsap.set('#cakeL3', { y: '-=160', opacity: 0 });
    gsap.set('#cakeDrip', { opacity: 0 });

    /* Garnishes */
    const garnishData = [
      { el: '#gS1', startX: -80,  startY: -120, endX: -28, endY: -SCENE_W * 0.56 },
      { el: '#gS2', startX: 90,   startY: -140, endX: 18,  endY: -SCENE_W * 0.66 },
      { el: '#gS3', startX: -60,  startY: -100, endX: -38, endY: -SCENE_W * 0.51 },
      { el: '#gC1', startX: 100,  startY: -80,  endX: 38,  endY: -SCENE_W * 0.46 },
      { el: '#gC2', startX: -90,  startY: -60,  endX: -18, endY: -SCENE_W * 0.43 },
      { el: '#gM1', startX: 80,   startY: -70,  endX: 10,  endY: -SCENE_W * 0.53 },
    ];
    garnishData.forEach(g => {
      const el = $(g.el);
      if (el) gsap.set(el, { x: g.startX, y: g.startY, opacity: 0, scale: 0.5 });
    });

    /* Textos */
    const stageLine1  = $('#stageLine1 .stage-text-word');
    const stageLine2  = $('#stageLine2 .stage-text-italic');
    const stageLine3  = $('#stageLine3 .stage-text-small');
    const stageLineR1 = $('#stageLineR1 .stage-text-word');
    const stageLineR2 = $('#stageLineR2 .stage-text-small');
    const stageLineR3 = $('#stageLineR3');

    /* Scroll cue */
    const scrollCue = $('#scrollCue');

    /* Master timeline scrub */
    const tl = gsap.timeline({ paused: true });

    tl.to('#cakePlate', { opacity: 1, duration: 0.1 }, 0);
    tl.to(scrollCue, { opacity: 0, duration: 0.08 }, 0);

    tl.to('#cakeL0', { y: 0, opacity: 1, ease: 'power2.out', duration: 0.17 }, 0.05);
    tl.to(stageLine1, { y: 0, opacity: 1, ease: 'power2.out', duration: 0.12 }, 0.15);

    tl.to('#cakeL1', { y: 0, opacity: 1, ease: 'power2.out', duration: 0.16 }, 0.22);
    tl.to(stageLine2, { y: 0, opacity: 1, ease: 'power2.out', duration: 0.12 }, 0.30);

    tl.to('#cakeL2', { y: 0, opacity: 1, ease: 'power2.out', duration: 0.17 }, 0.38);
    tl.to(stageLineR1, { y: 0, opacity: 1, ease: 'power2.out', duration: 0.12 }, 0.48);
    tl.to(stageLineR2, { y: 0, opacity: 1, ease: 'power2.out', duration: 0.10 }, 0.52);

    tl.to('#cakeL3', { y: 0, opacity: 1, ease: 'power2.out', duration: 0.17 }, 0.55);
    tl.to('#cakeDrip', { opacity: 1, ease: 'power1.in', duration: 0.08 }, 0.64);
    tl.to(stageLineR3, { y: 0, opacity: 1, ease: 'power2.out', duration: 0.10 }, 0.65);
    tl.to(stageLine3,  { y: 0, opacity: 1, ease: 'power2.out', duration: 0.10 }, 0.68);

    garnishData.forEach((g, i) => {
      const el = $(g.el);
      if (!el) return;
      tl.to(el, {
        x: g.endX, y: g.endY, opacity: 1, scale: 1,
        ease: 'power2.out', duration: 0.14,
      }, 0.72 + i * 0.025);
    });

    /* Partículas da tela hero (`.particle`) — brilho no final */
    $$('.particle').forEach((p, i) => {
      tl.to(p, {
        opacity: 0.5 + Math.random() * 0.5,
        scale: 1 + Math.random() * 0.5,
        ease: 'power1.inOut', duration: 0.1,
        yoyo: true, repeat: 1,
      }, 0.80 + i * 0.01);
    });

    /* ScrollTrigger — pin: true (hero fica fixo), scrub: true */
    ScrollTrigger.create({
      trigger: '.cake-stage',
      start: 'top top',
      end: 'bottom bottom',
      pin: '.cake-pin',
      pinSpacing: false,
      scrub: 1.2,
      onUpdate: self => tl.progress(self.progress),
    });

    /* Partículas flutuantes contínuas no hero */
    if (!isMobile()) {
      $$('.particle').forEach((p, i) => {
        gsap.to(p, {
          y: `+=${12 + i * 3}`,
          x: `+=${i % 2 === 0 ? 9 : -9}`,
          ease: 'sine.inOut',
          duration: 3 + i * 0.25,
          yoyo: true, repeat: -1,
          delay: i * 0.15,
        });
      });
    }
  }


  /* ═══════════════════════════════════════════════════════════
     6. SECTION REVEALS — IntersectionObserver unificado
  ══════════════════════════════════════════════════════════════ */
  function initReveals() {
    const items = $$('[data-reveal], .section-eyebrow, .section-heading, .app-desc, .atelie-desc, .atelie-stats');
    if (!items.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.15,
      rootMargin: '0px 0px -50px 0px',
    });

    items.forEach(el => observer.observe(el));
  }


  /* ═══════════════════════════════════════════════════════════
     7. PHONE TILT — 3D parallax no mockup
  ══════════════════════════════════════════════════════════════ */
  function initPhoneTilt() {
    if (prefersReducedMotion()) return;

    const chassis = $('.phone-chassis');
    if (!chassis) return;

    const MAX_X = 18, MAX_Y = 26;
    let curX = 0, curY = 0, tX = 0, tY = 0;

    function update() {
      curX = lerp(curX, tX, 0.12);
      curY = lerp(curY, tY, 0.12);
      chassis.style.transform = `perspective(1200px) rotateX(${curX}deg) rotateY(${curY}deg)`;
      requestAnimationFrame(update);
    }

    function setFromPoint(clientX, clientY) {
      const nx = (clientX / window.innerWidth) - 0.5;
      const ny = (clientY / window.innerHeight) - 0.5;
      tY = nx * MAX_Y * 2;
      tX = -ny * MAX_X * 2;
    }

    /* Mouse — acompanha o cursor por toda a extensão da janela */
    window.addEventListener('mousemove', e => setFromPoint(e.clientX, e.clientY), { passive: true });

    /* Touch — acompanha o dedo na tela em dispositivos móveis */
    window.addEventListener('touchmove', e => {
      if (e.touches.length > 0) {
        setFromPoint(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchend', () => { tX = 0; tY = 0; }, { passive: true });
    document.addEventListener('mouseleave', () => { tX = 0; tY = 0; });

    update();
  }


  /* ═══════════════════════════════════════════════════════════
     8. MOBILE FAB — aparece após 50% de scroll
  ══════════════════════════════════════════════════════════════ */
  function initMobileFab() {
    const fab = $('#mobileFab');
    if (!fab) return;

    let visible = false;
    let ticking = false;

    function check() {
      const should = window.scrollY > window.innerHeight * 0.5;
      if (should !== visible) {
        visible = should;
        fab.classList.toggle('is-visible', visible);
      }
      ticking = false;
    }

    window.addEventListener('scroll', () => {
      if (!ticking) { requestAnimationFrame(check); ticking = true; }
    }, { passive: true });

    check();
  }


  /* ═══════════════════════════════════════════════════════════
     9. SMOOTH SCROLL — âncoras com offset da nav
  ══════════════════════════════════════════════════════════════ */
  function initSmoothScroll() {
    $$('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const id = a.getAttribute('href').slice(1);
        if (!id) return;
        const target = document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        const offset = 80;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      });
    });
  }


  /* ═══════════════════════════════════════════════════════════
     10. MISC
  ══════════════════════════════════════════════════════════════ */
  function initMisc() {
    const yr = $('#year');
    if (yr) yr.textContent = new Date().getFullYear();
  }


  /* ═══════════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════════════ */
  function init() {
    initBackground();
    initParticleTrail();
    initLoader();
    initDeviceAdaptation();
    initNav();
    initCakeAssembly();
    initReveals();
    initPhoneTilt();
    initMobileFab();
    initSmoothScroll();
    initMisc();

    window.addEventListener('load', () => {
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    });

    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        if (window.ScrollTrigger) ScrollTrigger.refresh();
      }, 300);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
