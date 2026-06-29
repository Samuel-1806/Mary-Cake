/**
 * MARY CAKE — LUXURY EXPERIENCE v3
 * scroll-driven cake assembly + 3D phone reveal + conversion
 * Optimized for performance: will-change, transform3d, RAF throttling
 */

(function () {
  'use strict';

  /* ─────────────────────────────────────────────
     UTILITIES
  ───────────────────────────────────────────── */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
  const lerp = (a, b, t) => a + (b - a) * t;
  const isMobile = () => window.innerWidth <= 768;
  const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ─────────────────────────────────────────────
     GSAP SETUP
  ───────────────────────────────────────────── */
  gsap.registerPlugin(ScrollTrigger);
  gsap.config({ force3D: true });

  /* ─────────────────────────────────────────────
     1. LOADER
  ───────────────────────────────────────────── */
  function initLoader() {
    const loader = $('#loader');
    if (!loader) return;

    // Delay just enough for fonts to load
    const minDuration = 1400;
    const start = performance.now();

    document.fonts.ready.then(() => {
      const elapsed = performance.now() - start;
      const remaining = Math.max(0, minDuration - elapsed);
      setTimeout(() => {
        loader.classList.add('is-gone');
      }, remaining);
    });
  }

  /* ─────────────────────────────────────────────
     2. NAV
  ───────────────────────────────────────────── */
  function initNav() {
    const nav = $('#nav');
    const burger = $('#navBurger');
    const menu = $('#mobileMenu');

    // Scroll state
    let lastScrollY = 0;
    ScrollTrigger.create({
      start: 80,
      onEnter:  () => nav.classList.add('is-scrolled'),
      onLeaveBack: () => nav.classList.remove('is-scrolled'),
    });

    // Burger
    if (burger && menu) {
      burger.addEventListener('click', () => {
        const open = menu.classList.toggle('is-open');
        burger.classList.toggle('is-open', open);
        burger.setAttribute('aria-expanded', open);
        menu.setAttribute('aria-hidden', !open);
        document.body.style.overflow = open ? 'hidden' : '';
      });

      // Close on link click
      $$('a', menu).forEach(a => {
        a.addEventListener('click', () => {
          menu.classList.remove('is-open');
          burger.classList.remove('is-open');
          burger.setAttribute('aria-expanded', false);
          menu.setAttribute('aria-hidden', true);
          document.body.style.overflow = '';
        });
      });
    }
  }

  /* ─────────────────────────────────────────────
     3. CAKE ASSEMBLY — SCROLL-DRIVEN STAGE
     
     Layer stack (bottom to top):
     L0: massa base    — enters from below
     L1: cream filling — enters from below
     L2: massa top     — enters from below
     L3: frosting      — enters from above + drip
     garnishes         — float in from corners
  ───────────────────────────────────────────── */
  function initCakeAssembly() {
    if (prefersReducedMotion()) {
      // Show everything immediately
      $$('.cake-layer, .garnish, .particle, .cake-plate, .cake-drip').forEach(el => {
        gsap.set(el, { opacity: 1, y: 0 });
      });
      return;
    }

    const cakeScene = $('#cakeScene');
    const cakePin   = $('#cakePin');
    if (!cakeScene || !cakePin) return;

    // ── Define layer geometry ──
    // Each layer: { height, y-offset from bottom, side-height }
    // These are percentage of scene width
    const SCENE_W = clamp(window.innerWidth * 0.22, 180, 280);

    const layerDefs = [
      { el: '#cakeL0', height: SCENE_W * 0.16, sideH: SCENE_W * 0.18, y: 0 },
      { el: '#cakeL1', height: SCENE_W * 0.08, sideH: SCENE_W * 0.06, y: SCENE_W * 0.34 },
      { el: '#cakeL2', height: SCENE_W * 0.16, sideH: SCENE_W * 0.18, y: SCENE_W * 0.40 },
      { el: '#cakeL3', height: SCENE_W * 0.12, sideH: SCENE_W * 0.22, y: SCENE_W * 0.74 },
    ];

    // Position layers
    const totalH = SCENE_W * 0.96;
    layerDefs.forEach(def => {
      const el = $(def.el);
      if (!el) return;
      const face = el.querySelector('.cake-layer-face--top');
      const side = el.querySelector('.cake-layer-side');
      if (face) gsap.set(face, { height: def.height });
      if (side) gsap.set(side, { height: def.sideH });
      gsap.set(el, {
        position: 'absolute',
        bottom: 0,
        left: 0, right: 0,
        y: def.y - totalH / 2,
        transformOrigin: 'center bottom',
      });
    });

    // Plate
    const plate = $('#cakePlate');
    gsap.set(plate, { opacity: 0 });

    // Start: all layers offset out of view
    gsap.set('#cakeL0', { y: '+=160', opacity: 0 });
    gsap.set('#cakeL1', { y: '+=120', opacity: 0 });
    gsap.set('#cakeL2', { y: '+=100', opacity: 0 });
    gsap.set('#cakeL3', { y: '-=160', opacity: 0 });

    // Garnishes start scattered
    const garnishData = [
      { el: '#gS1', startX: -80,  startY: -120, endX: -30, endY: -SCENE_W * 0.55 },
      { el: '#gS2', startX: 90,   startY: -140, endX: 20,  endY: -SCENE_W * 0.65 },
      { el: '#gS3', startX: -60,  startY: -100, endX: -40, endY: -SCENE_W * 0.5 },
      { el: '#gC1', startX: 100,  startY: -80,  endX: 40,  endY: -SCENE_W * 0.45 },
      { el: '#gC2', startX: -90,  startY: -60,  endX: -20, endY: -SCENE_W * 0.42 },
      { el: '#gC3', startX: 70,   startY: -90,  endX: 30,  endY: -SCENE_W * 0.48 },
      { el: '#gM1', startX: 80,   startY: -70,  endX: 10,  endY: -SCENE_W * 0.52 },
    ];

    garnishData.forEach(g => {
      const el = $(g.el);
      if (el) gsap.set(el, { x: g.startX, y: g.startY, opacity: 0, scale: 0.6 });
    });

    // Text elements
    const stageLine1 = $('#stageLine1 .stage-text-word');
    const stageLine2 = $('#stageLine2 .stage-text-italic');
    const stageLine3 = $('#stageLine3 .stage-text-small');
    const stageLineR1 = $('#stageLineR1 .stage-text-word');
    const stageLineR2 = $('#stageLineR2 .stage-text-small');
    const stageLineR3 = $('#stageLineR3');

    // Scroll cue
    const scrollCue = $('#scrollCue');

    /* ── Master scroll-linked timeline ── */
    const tl = gsap.timeline({ paused: true });

    // 0–10%: plate appears + scroll cue fades
    tl.to(plate, { opacity: 1, duration: 0.1 }, 0);
    tl.to(scrollCue, { opacity: 0, duration: 0.08 }, 0);

    // 5–22%: L0 (massa base) descends in
    tl.to('#cakeL0', { y: '0', opacity: 1, ease: 'power2.out', duration: 0.17 }, 0.05);

    // 15–25%: left text line 1 appears
    tl.to(stageLine1, { y: '0%', opacity: 1, ease: 'power2.out', duration: 0.12 }, 0.15);

    // 22–38%: L1 (cream) rises in
    tl.to('#cakeL1', { y: 0, opacity: 1, ease: 'power2.out', duration: 0.16 }, 0.22);

    // 30–40%: left text italic appears
    tl.to(stageLine2, { y: '0%', opacity: 1, ease: 'power2.out', duration: 0.12 }, 0.30);

    // 38–55%: L2 (second massa) descends
    tl.to('#cakeL2', { y: 0, opacity: 1, ease: 'power2.out', duration: 0.17 }, 0.38);

    // 48–60%: right text appears
    tl.to(stageLineR1, { y: '0%', opacity: 1, ease: 'power2.out', duration: 0.12 }, 0.48);
    tl.to(stageLineR2, { y: '0%', opacity: 1, ease: 'power2.out', duration: 0.1 }, 0.52);

    // 55–72%: L3 (frosting) drops from above with bounce
    tl.to('#cakeL3', { y: 0, opacity: 1, ease: 'power2.out', duration: 0.17 }, 0.55);

    // 64–72%: drip appears
    tl.to('#cakeDrip', { opacity: 1, ease: 'power1.in', duration: 0.08 }, 0.64);

    // 65–75%: price appears
    tl.to(stageLineR3, { y: '0%', opacity: 1, ease: 'power2.out', duration: 0.1 }, 0.65);

    // 68–76%: small text
    tl.to(stageLine3, { y: '0%', opacity: 1, ease: 'power2.out', duration: 0.1 }, 0.68);

    // 72–90%: garnishes float in
    garnishData.forEach((g, i) => {
      const el = $(g.el);
      if (!el) return;
      const startProg = 0.72 + i * 0.02;
      tl.to(el, {
        x: g.endX,
        y: g.endY,
        opacity: 1,
        scale: 1,
        ease: 'power2.out',
        duration: 0.14,
      }, startProg);
    });

    // 80–90%: particles sparkle
    $$('.particle').forEach((p, i) => {
      tl.to(p, {
        opacity: 0.6 + Math.random() * 0.4,
        scale: 1 + Math.random() * 0.5,
        ease: 'power1.inOut',
        duration: 0.1,
        yoyo: true,
        repeat: 1,
      }, 0.80 + i * 0.012);
    });

    /* ── ScrollTrigger: scrub the timeline ── */
    ScrollTrigger.create({
      trigger: '.cake-stage',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1.2,
      onUpdate: self => {
        tl.progress(self.progress);
      },
    });
  }

  /* ─────────────────────────────────────────────
     4. PHONE REVEAL — scroll-triggered entry
  ───────────────────────────────────────────── */
  function initPhoneReveal() {
    if (prefersReducedMotion()) return;

    const phoneWrap = $('#phoneWrap');
    const appEyebrow = $('#appEyebrow');
    const appHeading = $('#appHeading');
    const appSub     = $('#appSub');
    if (!phoneWrap) return;

    // Phone entry
    gsap.to(phoneWrap, {
      x: 0, opacity: 1, scale: 1,
      ease: 'power3.out',
      duration: 1.4,
      scrollTrigger: {
        trigger: '.app-reveal',
        start: 'top 80%',
        once: true,
      }
    });

    // Text stagger entry
    [appEyebrow, appHeading, appSub].forEach((el, i) => {
      if (!el) return;
      gsap.to(el, {
        opacity: 1, y: 0,
        ease: 'power3.out',
        duration: 1,
        delay: 0.2 + i * 0.15,
        scrollTrigger: {
          trigger: '.app-reveal',
          start: 'top 70%',
          once: true,
        }
      });
    });
  }

  /* ─────────────────────────────────────────────
     5. PHONE PARALLAX (mouse / gyroscope)
  ───────────────────────────────────────────── */
  function initPhoneParallax() {
    const phoneScene = $('#phoneScene');
    if (!phoneScene || prefersReducedMotion()) return;

    let targetX = 0, targetY = 0;
    let currentX = 0, currentY = 0;
    let rafID = null;
    let active = false;

    const MAX_ROT_X = 12;
    const MAX_ROT_Y = 16;

    function update() {
      currentX = lerp(currentX, targetX, 0.08);
      currentY = lerp(currentY, targetY, 0.08);

      gsap.set(phoneScene, {
        rotateX: currentX,
        rotateY: currentY,
        transformPerspective: 1000,
        transformOrigin: 'center center',
      });

      rafID = requestAnimationFrame(update);
    }

    // Mouse parallax (desktop)
    if (!isMobile()) {
      document.addEventListener('mousemove', (e) => {
        const nx = (e.clientX / window.innerWidth - 0.5) * 2;
        const ny = (e.clientY / window.innerHeight - 0.5) * 2;
        targetY = nx * MAX_ROT_Y;
        targetX = -ny * MAX_ROT_X;

        if (!active) {
          active = true;
          update();
        }
      });

      document.addEventListener('mouseleave', () => {
        targetX = 0;
        targetY = 0;
      });
    } else {
      // Gyroscope / DeviceOrientation on mobile
      if (window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', (e) => {
          if (e.gamma !== null && e.beta !== null) {
            targetY = clamp(e.gamma / 3, -MAX_ROT_Y, MAX_ROT_Y);
            targetX = clamp((e.beta - 45) / 3, -MAX_ROT_X, MAX_ROT_X);

            if (!active) {
              active = true;
              update();
            }
          }
        }, { passive: true });
      }

      // Touch drag fallback
      let touchStartX = 0, touchStartY = 0;
      let baseTX = 0, baseTY = 0;

      document.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        baseTX = targetX;
        baseTY = targetY;
      }, { passive: true });

      document.addEventListener('touchmove', (e) => {
        const dx = (e.touches[0].clientX - touchStartX) / window.innerWidth;
        const dy = (e.touches[0].clientY - touchStartY) / window.innerHeight;
        targetY = clamp(baseTY + dx * MAX_ROT_Y * 2, -MAX_ROT_Y, MAX_ROT_Y);
        targetX = clamp(baseTX - dy * MAX_ROT_X * 2, -MAX_ROT_X, MAX_ROT_X);

        if (!active) {
          active = true;
          update();
        }
      }, { passive: true });
    }

    // Start loop
    update();
  }

  /* ─────────────────────────────────────────────
     6. DOWNLOAD SECTION REVEAL
  ───────────────────────────────────────────── */
  function initDownloadReveal() {
    // Use IntersectionObserver for lightweight reveal
    const items = $$('[data-reveal]');
    if (!items.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');

          // Also trigger child elements with transition delays
          $$('.dl-eyebrow, .dl-heading, .dl-sub, .dl-features, .dl-store-row, .dl-mobile-cta',
            entry.target.closest('.download-content') || document
          ).forEach(el => el.classList.add('is-visible'));

          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.2,
      rootMargin: '0px 0px -60px 0px'
    });

    items.forEach(el => observer.observe(el));

    // Download phone tilt on hover (desktop)
    const dpScene = $('#downloadPhoneScene');
    if (dpScene && !isMobile()) {
      dpScene.addEventListener('mousemove', (e) => {
        const rect = dpScene.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const rx = ((e.clientY - cy) / rect.height) * -10;
        const ry = ((e.clientX - cx) / rect.width) * 14;
        gsap.to(dpScene, {
          rotateX: rx, rotateY: ry,
          transformPerspective: 1200,
          ease: 'power2.out', duration: 0.5,
        });
      });
      dpScene.addEventListener('mouseleave', () => {
        gsap.to(dpScene, {
          rotateX: 2, rotateY: 8,
          ease: 'power2.out', duration: 0.8,
        });
      });
    }
  }

  /* ─────────────────────────────────────────────
     7. MOBILE FAB — scroll-aware visibility
  ───────────────────────────────────────────── */
  function initMobileFab() {
    const fab = $('#mobileFab');
    if (!fab) return;

    let fabVisible = false;
    let ticking = false;

    function checkFab() {
      const scrollY = window.scrollY;
      const should = scrollY > window.innerHeight * 0.5;
      if (should !== fabVisible) {
        fabVisible = should;
        gsap.to(fab, {
          y: fabVisible ? 0 : 24,
          opacity: fabVisible ? 1 : 0,
          ease: 'power2.out', duration: 0.45,
          pointerEvents: fabVisible ? 'auto' : 'none',
        });
      }
      ticking = false;
    }

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(checkFab);
        ticking = true;
      }
    }, { passive: true });

    // Initial state
    gsap.set(fab, { y: 24, opacity: 0 });
  }

  /* ─────────────────────────────────────────────
     8. PARALLAX — subtle depth on stage
  ───────────────────────────────────────────── */
  function initStageParallax() {
    if (prefersReducedMotion() || isMobile()) return;

    const cakePin = $('#cakePin');
    if (!cakePin) return;

    // Floating particles gentle movement
    $$('.particle').forEach((p, i) => {
      gsap.to(p, {
        y: `+=${10 + i * 4}`,
        x: `+=${i % 2 === 0 ? 8 : -8}`,
        ease: 'sine.inOut',
        duration: 3 + i * 0.3,
        yoyo: true, repeat: -1,
      });
    });
  }

  /* ─────────────────────────────────────────────
     9. YEAR + MISC
  ───────────────────────────────────────────── */
  function initMisc() {
    const yr = $('#year');
    if (yr) yr.textContent = new Date().getFullYear();
  }

  /* ─────────────────────────────────────────────
     10. SCROLL SMOOTHNESS — momentum on desktop
  ───────────────────────────────────────────── */
  function initSmoothScroll() {
    // Anchor clicks — smooth scroll with offset for nav
    $$('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const id = a.getAttribute('href').slice(1);
        const target = document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        const navH = 80;
        const top = target.getBoundingClientRect().top + window.scrollY - navH;
        window.scrollTo({ top, behavior: 'smooth' });
      });
    });
  }

  /* ─────────────────────────────────────────────
     INIT
  ───────────────────────────────────────────── */
  function init() {
    initLoader();
    initNav();
    initCakeAssembly();
    initPhoneReveal();
    initPhoneParallax();
    initDownloadReveal();
    initMobileFab();
    initStageParallax();
    initMisc();
    initSmoothScroll();

    // Refresh ScrollTrigger after layout settles
    window.addEventListener('load', () => {
      ScrollTrigger.refresh();
    });

    // Handle orientation change
    window.addEventListener('orientationchange', () => {
      setTimeout(() => ScrollTrigger.refresh(), 200);
    });
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
