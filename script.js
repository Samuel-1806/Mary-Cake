/* ====================================================================
   MARY CAKE — script.js
   Three.js smartphone hero · GSAP ScrollTrigger choreography
   Champagne particle trail · UI interactions
==================================================================== */
(() => {
  'use strict';

  /* ----------------------------------------------------------------
     UTIL
  ---------------------------------------------------------------- */
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const isMobile = () => window.innerWidth <= 980;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.getElementById('year') && (document.getElementById('year').textContent = new Date().getFullYear());

  /* ----------------------------------------------------------------
     NAV / MOBILE MENU
  ---------------------------------------------------------------- */
  const nav = $('#nav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('is-scrolled', window.scrollY > 40);
  }, { passive: true });

  const burger = $('#navBurger');
  const mobileMenu = $('#mobileMenu');
  const mobileClose = $('#mobileMenuClose');
  const openMenu = () => {
    mobileMenu.classList.add('is-open');
    burger.setAttribute('aria-expanded', 'true');
    document.body.classList.add('no-scroll');
  };
  const closeMenu = () => {
    mobileMenu.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('no-scroll');
  };
  burger?.addEventListener('click', () => {
    mobileMenu.classList.contains('is-open') ? closeMenu() : openMenu();
  });
  mobileClose?.addEventListener('click', closeMenu);
  $$('.mobile-menu a').forEach(a => a.addEventListener('click', closeMenu));

  /* ----------------------------------------------------------------
     MOBILE FAB visibility
  ---------------------------------------------------------------- */
  const fab = $('#mobileFab');
  const downloadSection = $('#download');
  window.addEventListener('scroll', () => {
    if (!fab) return;
    const showAfter = window.innerHeight * 0.9;
    const nearDownload = downloadSection.getBoundingClientRect().top < window.innerHeight * 0.85;
    fab.classList.toggle('is-visible', window.scrollY > showAfter && !nearDownload);
  }, { passive: true });

  /* ----------------------------------------------------------------
     SECTION REVEAL (IntersectionObserver, lightweight, CSS-driven)
  ---------------------------------------------------------------- */
  const revealTargets = $$('.scene-section, .commitment-section');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('is-revealed');
    });
  }, { threshold: 0.28 });
  revealTargets.forEach(el => io.observe(el));

  /* ----------------------------------------------------------------
     CHAMPAGNE PARTICLE TRAIL (2D canvas — microscopic, discreet)
  ---------------------------------------------------------------- */
  (() => {
    const canvas = $('#trail-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w, h, particles = [];
    const MAX_PARTICLES = 70;

    function resize() {
      w = canvas.width = window.innerWidth * devicePixelRatio;
      h = canvas.height = window.innerHeight * devicePixelRatio;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
    }
    resize();
    window.addEventListener('resize', resize);

    function spawn(x, y) {
      if (prefersReducedMotion) return;
      for (let i = 0; i < 2; i++) {
        particles.push({
          x: x * devicePixelRatio + (Math.random() - 0.5) * 6,
          y: y * devicePixelRatio + (Math.random() - 0.5) * 6,
          r: (Math.random() * 1.1 + 0.4) * devicePixelRatio,
          life: 1,
          decay: Math.random() * 0.022 + 0.016,
          vx: (Math.random() - 0.5) * 0.4,
          vy: -Math.random() * 0.6 - 0.2,
          hue: Math.random() > 0.5 ? '184,147,90' : '232,145,122'
        });
      }
      if (particles.length > MAX_PARTICLES) particles.splice(0, particles.length - MAX_PARTICLES);
    }

    let lastX = null, lastY = null;
    function pointerMove(x, y) {
      if (lastX !== null) {
        const dist = Math.hypot(x - lastX, y - lastY);
        if (dist > 14) spawn(x, y);
      } else spawn(x, y);
      lastX = x; lastY = y;
    }
    window.addEventListener('mousemove', e => pointerMove(e.clientX, e.clientY), { passive: true });
    window.addEventListener('touchmove', e => {
      if (e.touches[0]) pointerMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    function tick() {
      ctx.clearRect(0, 0, w, h);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= p.decay;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        p.x += p.vx; p.y += p.vy;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.hue},${p.life * 0.5})`;
        ctx.fill();
      }
      requestAnimationFrame(tick);
    }
    tick();
  })();

  /* ----------------------------------------------------------------
     THREE.JS — cinematic smartphone
  ---------------------------------------------------------------- */
  const loader = $('#loader');
  const loaderFill = $('.loader-bar-fill');

  function initThree() {
    const canvas = $('#webgl-canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(28, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 7.2);

    /* ---------- Lighting (fakes a soft studio environment) ---------- */
    const ambient = new THREE.AmbientLight(0xfff1da, 0.55);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffe9c4, 1.4);
    key.position.set(3.2, 4, 5);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xcfe0ff, 0.45);
    fill.position.set(-4, -1, 3);
    scene.add(fill);

    const rim = new THREE.PointLight(0xe8917a, 1.1, 14);
    rim.position.set(-2.5, 2, -3);
    scene.add(rim);

    const rim2 = new THREE.PointLight(0xb8935a, 0.9, 14);
    rim2.position.set(2.5, -2.5, -2.5);
    scene.add(rim2);

    const top = new THREE.SpotLight(0xfffaf0, 0.6, 16, Math.PI / 5, 0.6);
    top.position.set(0, 6, 4);
    scene.add(top);

    /* ---------- Phone group ---------- */
    const phone = new THREE.Group();
    scene.add(phone);

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x231811,
      metalness: 0.78,
      roughness: 0.22,
      envMapIntensity: 1.2
    });
    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0xC9A66B,
      metalness: 0.9,
      roughness: 0.18
    });

    const bodyGeo = new THREE.BoxGeometry(1.62, 3.32, 0.16, 4, 4, 1);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    phone.add(body);

    // bezel ring (slightly larger, behind) gives a metallic frame edge
    const frameGeo = new THREE.BoxGeometry(1.68, 3.38, 0.1, 2, 2, 1);
    const frame = new THREE.Mesh(frameGeo, edgeMat);
    frame.position.z = -0.04;
    phone.add(frame);

    // camera notch
    const notchGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.02, 24);
    const notchMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, metalness: 0.6, roughness: 0.4 });
    const notch = new THREE.Mesh(notchGeo, notchMat);
    notch.rotation.x = Math.PI / 2;
    notch.position.set(0, 1.5, 0.09);
    phone.add(notch);

    // screen placeholder (visible immediately, swapped once texture loads)
    const screenGeo = new THREE.PlaneGeometry(1.46, 3.0);
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x2b1810 });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.z = 0.085;
    phone.add(screen);

    // soft glass highlight over the screen
    const glassGeo = new THREE.PlaneGeometry(1.46, 3.0);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.06,
      roughness: 0.1,
      metalness: 0,
      transmission: 0.0
    });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.z = 0.09;
    phone.add(glass);

    /* ---------- Load screen texture (REQUIRED asset) ---------- */
    const texLoader = new THREE.TextureLoader();
    texLoader.load(
      'assets/print_app.png',
      (tex) => {
        tex.encoding = THREE.sRGBEncoding;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        tex.needsUpdate = true;
        screen.material.dispose();
        screen.material = new THREE.MeshBasicMaterial({ map: tex });
      },
      undefined,
      () => { /* keep dark placeholder on failure */ }
    );

    phone.rotation.x = 0.08;
    phone.rotation.y = -0.18;
    phone.scale.setScalar(1.1);

    /* ---------- Ambient micro-float (idle motion) ---------- */
    let floatT = 0;

    /* ---------- Resize ---------- */
    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', onResize);

    /* ---------- Pointer parallax (subtle) ---------- */
    let pointer = { x: 0, y: 0 };
    let pointerTarget = { x: 0, y: 0 };
    window.addEventListener('mousemove', e => {
      pointerTarget.x = (e.clientX / window.innerWidth - 0.5) * 2;
      pointerTarget.y = (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });
    window.addEventListener('touchmove', e => {
      if (!e.touches[0]) return;
      pointerTarget.x = (e.touches[0].clientX / window.innerWidth - 0.5) * 2;
      pointerTarget.y = (e.touches[0].clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });

    /* ---------- Scroll choreography keyframes ---------- */
    // Each keyframe describes the phone's target transform for that narrative beat.
    // x is in world units (negative = screen-left, positive = screen-right) so the
    // phone always rests in the column OPPOSITE the text, never covering it.
    const keyframesDesktop = [
      { x: 0,     y: 0.05,  z: 0,    rx: 0.10,  ry: -0.18, s: 1.12 }, // 1 hero — center
      { x: 1.55,  y: -0.12, z: -0.4, rx: 0.18,  ry: -0.55, s: 1.00 }, // 2 atelie — text left, phone right
      { x: -1.55, y: 0.08,  z: -0.2, rx: -0.08, ry: 0.50,  s: 1.05 }, // 3 experiencia — text right, phone left
      { x: 1.6,   y: -0.05, z: -0.1, rx: 0.22,  ry: -0.65, s: 0.96 }, // 4 jornada — text left, phone right
      { x: -1.55, y: 0.0,   z: -0.25,rx: -0.14, ry: 0.42,  s: 1.02 }, // 5 sabor — text right, phone left
      { x: 0,     y: -0.02, z: 0.25, rx: 0.04,  ry: 0.22,  s: 1.22 }  // 6 download — center, closer
    ];
    const keyframesMobile = keyframesDesktop.map((k, i) => ({
      x: 0, y: i === 0 || i === 5 ? k.y : -0.65,
      z: k.z - 0.6, rx: k.rx * 0.6, ry: k.ry * 0.6, s: k.s * 0.62
    }));

    function getKeyframes() { return isMobile() ? keyframesMobile : keyframesDesktop; }

    const sections = $$('.scene-section');
    const current = { x: 0, y: 0.05, z: 0, rx: 0.1, ry: -0.18, s: 1.12 };

    function updateFromScroll() {
      const pinEl = $('#phonePin');
      const rect = pinEl.getBoundingClientRect();
      const total = pinEl.offsetHeight - window.innerHeight;
      const scrolled = clamp(-rect.top, 0, total);
      const progress = total > 0 ? scrolled / total : 0;

      const kfs = getKeyframes();
      const segCount = kfs.length - 1;
      const pos = clamp(progress, 0, 1) * segCount;
      const idx = clamp(Math.floor(pos), 0, segCount - 1);
      const frac = pos - idx;
      const a = kfs[idx], b = kfs[idx + 1] || kfs[idx];

      current.x = lerp(a.x, b.x, frac);
      current.y = lerp(a.y, b.y, frac);
      current.z = lerp(a.z, b.z, frac);
      current.rx = lerp(a.rx, b.rx, frac);
      current.ry = lerp(a.ry, b.ry, frac);
      current.s = lerp(a.s, b.s, frac);
    }

    if (window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
      ScrollTrigger.create({
        trigger: '#phonePin',
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        onUpdate: updateFromScroll
      });
      ScrollTrigger.create({ trigger: '#phonePin', start: 'top top', onRefresh: updateFromScroll });
    } else {
      window.addEventListener('scroll', updateFromScroll, { passive: true });
    }
    updateFromScroll();

    /* ---------- Render loop ---------- */
    function animate() {
      requestAnimationFrame(animate);
      floatT += 0.0065;

      pointer.x = lerp(pointer.x, pointerTarget.x, 0.04);
      pointer.y = lerp(pointer.y, pointerTarget.y, 0.04);

      const idleY = Math.sin(floatT) * 0.05;
      const idleRX = Math.cos(floatT * 0.8) * 0.015;

      phone.position.x = lerp(phone.position.x, current.x + pointer.x * 0.12, 0.08);
      phone.position.y = lerp(phone.position.y, current.y + idleY - pointer.y * 0.06, 0.08);
      phone.position.z = lerp(phone.position.z, current.z, 0.08);
      phone.rotation.x = lerp(phone.rotation.x, current.rx + idleRX + pointer.y * 0.08, 0.07);
      phone.rotation.y = lerp(phone.rotation.y, current.ry + pointer.x * 0.18, 0.07);
      const targetScale = current.s;
      phone.scale.x = lerp(phone.scale.x, targetScale, 0.08);
      phone.scale.y = lerp(phone.scale.y, targetScale, 0.08);
      phone.scale.z = lerp(phone.scale.z, targetScale, 0.08);

      rim.position.x = Math.sin(floatT * 0.6) * 2.6 - 2.5;
      rim2.position.x = Math.cos(floatT * 0.5) * 2.6 + 2.5;

      renderer.render(scene, camera);
    }
    animate();
  }

  /* ----------------------------------------------------------------
     BOOT SEQUENCE
  ---------------------------------------------------------------- */
  function hideLoader() {
    loader?.classList.add('is-hidden');
  }

  window.addEventListener('load', () => {
    if (loaderFill) loaderFill.style.width = '100%';
    setTimeout(hideLoader, 480);
  });
  // Fallback in case 'load' is delayed
  setTimeout(() => { if (loaderFill) loaderFill.style.width = '70%'; }, 200);
  setTimeout(hideLoader, 2600);

  if (window.THREE) {
    initThree();
  }

  // Smooth-refresh ScrollTrigger after fonts/layout settle
  window.addEventListener('load', () => {
    if (window.ScrollTrigger) setTimeout(() => ScrollTrigger.refresh(), 300);
  });
})();
