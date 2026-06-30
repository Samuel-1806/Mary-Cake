/* ============================================================
   MARY CAKE — CINEMATIC APP EXPERIENCE
   Three.js scroll-driven 3D phone + GSAP ScrollTrigger
   ============================================================ */
(function () {
  "use strict";

  gsap.registerPlugin(ScrollTrigger);

  var isMobile = window.matchMedia("(max-width: 760px)").matches;
  var isTouch = "ontouchstart" in window;
  var isAndroid = /Android/i.test(navigator.userAgent);

  /* ---------------------------------------------------------
     0. LOADER
  --------------------------------------------------------- */
  window.addEventListener("load", function () {
    gsap.to("#loader .loader-bar-fill", { width: "100%", duration: 0.9, ease: "power2.out" });
    setTimeout(function () {
      document.getElementById("loader").classList.add("is-hidden");
      ScrollTrigger.refresh();
    }, 700);
  });
  document.getElementById("year").textContent = new Date().getFullYear();

  /* ---------------------------------------------------------
     1. NAV + MOBILE MENU
  --------------------------------------------------------- */
  var nav = document.getElementById("nav");
  ScrollTrigger.create({
    start: 40,
    onUpdate: function (self) {
      nav.classList.toggle("is-scrolled", self.scroll() > 40);
    }
  });

  var burger = document.getElementById("navBurger");
  var mobileMenu = document.getElementById("mobileMenu");
  var mobileMenuClose = document.getElementById("mobileMenuClose");
  function toggleMenu(open) {
    mobileMenu.classList.toggle("is-open", open);
    mobileMenu.setAttribute("aria-hidden", String(!open));
    burger.setAttribute("aria-expanded", String(open));
  }
  burger && burger.addEventListener("click", function () { toggleMenu(true); });
  mobileMenuClose && mobileMenuClose.addEventListener("click", function () { toggleMenu(false); });
  mobileMenu && mobileMenu.querySelectorAll("a").forEach(function (a) {
    a.addEventListener("click", function () { toggleMenu(false); });
  });

  /* ---------------------------------------------------------
     2. CTA INTELLIGENCE — desktop QR / mobile APK download
  --------------------------------------------------------- */
  var apkUrl = "https://drive.google.com/uc?export=download&id=1E-_SBshzuCfzUelFhl0JAAkqN7XHf2hf";
  var siteUrl = "https://mary-cake.netlify.app/";
  var navCta = document.getElementById("navCta");
  var navCtaLabel = document.getElementById("navCtaLabel");
  var mobileCtaLink = document.getElementById("mobileCtaLink");

  if (isMobile || isTouch) {
    [navCta, mobileCtaLink].forEach(function (el) {
      if (!el) return;
      el.setAttribute("href", apkUrl);
      el.setAttribute("download", "");
    });
    if (navCtaLabel) navCtaLabel.textContent = "Baixar Aplicativo";
  } else {
    navCta && navCta.setAttribute("href", siteUrl);
    mobileCtaLink && mobileCtaLink.setAttribute("href", siteUrl);
  }

  /* ---------------------------------------------------------
     3. THREE.JS — 3D PHONE SCENE
  --------------------------------------------------------- */
  var canvas = document.getElementById("webgl-canvas");
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 9);

  /* -- studio lighting: ambient + champagne-gold directional -- */
  var ambient = new THREE.AmbientLight(0xfff3e0, 0.55);
  scene.add(ambient);

  var keyLight = new THREE.DirectionalLight(0xe8c98a, 1.6);
  keyLight.position.set(4, 5, 6);
  scene.add(keyLight);

  var rimLight = new THREE.DirectionalLight(0xc9914c, 0.9);
  rimLight.position.set(-5, -2, -4);
  scene.add(rimLight);

  var fillLight = new THREE.PointLight(0xffffff, 0.4, 20);
  fillLight.position.set(0, 2, 5);
  scene.add(fillLight);

  /* -- phone group -- */
  var phoneGroup = new THREE.Group();
  scene.add(phoneGroup);

  var PHONE_W = 2.1, PHONE_H = 4.3, PHONE_D = 0.22;

  // chassis (rounded box approximation via BoxGeometry + bevel-like segments)
  var chassisGeo = new THREE.BoxGeometry(PHONE_W, PHONE_H, PHONE_D, 4, 4, 2);
  var chassisMat = new THREE.MeshStandardMaterial({
    color: 0x2c1a10,
    metalness: 0.85,
    roughness: 0.25,
    envMapIntensity: 1
  });
  var chassis = new THREE.Mesh(chassisGeo, chassisMat);
  phoneGroup.add(chassis);

  // screen (textured with print-app.png)
  var screenGeo = new THREE.PlaneGeometry(PHONE_W * 0.93, PHONE_H * 0.95);
  var screenMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.35,
    metalness: 0.05,
    emissive: 0x222222,
    emissiveIntensity: 0.15
  });
  var screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.z = PHONE_D / 2 + 0.01;
  phoneGroup.add(screen);

  var texLoader = new THREE.TextureLoader();
  texLoader.load(
    "assets/print_app.png",
    function (tex) {
      tex.encoding = THREE.sRGBEncoding;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      screenMat.map = tex;
      screenMat.emissiveMap = tex;
      screenMat.needsUpdate = true;
    },
    undefined,
    function () {
      // fallback: champagne-tinted screen if texture missing
      screenMat.color.set(0xf0e3c8);
      screenMat.needsUpdate = true;
    }
  );

  // thin gold bezel ring around the screen
  var bezelGeo = new THREE.PlaneGeometry(PHONE_W * 0.97, PHONE_H * 0.99);
  var bezelMat = new THREE.MeshStandardMaterial({ color: 0xc9914c, metalness: 0.9, roughness: 0.2 });
  var bezel = new THREE.Mesh(bezelGeo, bezelMat);
  bezel.position.z = PHONE_D / 2;
  phoneGroup.add(bezel);

  // soft contact shadow disc beneath the phone
  var shadowGeo = new THREE.CircleGeometry(2.1, 48);
  var shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 });
  var shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = -3.2;
  shadowDisc.visible = false; // subtle, mostly hidden behind hero framing
  scene.add(shadowDisc);

  phoneGroup.rotation.set(0.08, -0.35, 0.04);

  /* -- gentle idle float/orbit loop (hero) -- */
  var idleTl = gsap.timeline({ repeat: -1, yoyo: true, defaults: { ease: "sine.inOut" } });
  idleTl.to(phoneGroup.position, { y: "+=0.18", duration: 2.6 }, 0);
  idleTl.to(phoneGroup.rotation, { y: "+=0.08", duration: 3.2 }, 0);

  /* ---------------------------------------------------------
     4. SCROLL CHOREOGRAPHY — camera + phone transforms
  --------------------------------------------------------- */
  // Target poses per scene: [posX, posY, posZ, rotX, rotY, rotZ, scale]
  var poses = {
    1: { pos: [0, 0, 0], rot: [0.08, -0.35, 0.04], scale: 1, camZ: 9, camY: 0 },
    2: { pos: [2.1, 0, -0.5], rot: [0.1, 0.9, -0.05], scale: 0.92, camZ: 8.4, camY: 0.1 },
    3: { pos: [0, 0.3, 1.4], rot: [-0.05, 0, 0.02], scale: 1.35, camZ: 7.6, camY: 0 },
    4: { pos: [-2.2, -0.2, -0.4], rot: [0.05, -0.9, 0.05], scale: 0.95, camZ: 8.6, camY: -0.1 },
    5: { pos: [0, 0.1, -0.8], rot: [0.4, 0.2, 0.08], scale: 0.85, camZ: 9.4, camY: 0.2 },
    6: { pos: [0, -0.6, -1.4], rot: [0.15, 0.45, 0.02], scale: 0.7, camZ: 10, camY: 0.3 }
  };

  var sceneSections = gsap.utils.toArray(".scene-section");
  var phoneState = { x: 0, y: 0, z: 0, rx: 0.08, ry: -0.35, rz: 0.04, s: 1, camZ: 9, camY: 0 };

  sceneSections.forEach(function (section, i) {
    var sceneNum = i + 1;
    var pose = poses[sceneNum];
    if (!pose) return;

    gsap.to(phoneState, {
      x: pose.pos[0], y: pose.pos[1], z: pose.pos[2],
      rx: pose.rot[0], ry: pose.rot[1], rz: pose.rot[2],
      s: pose.scale, camZ: pose.camZ, camY: pose.camY,
      ease: "none",
      scrollTrigger: {
        trigger: section,
        start: "top bottom",
        end: "bottom top",
        scrub: 1
      }
    });
  });

  /* -- per-section text reveal (fade in on enter, fade out on leave) -- */
  sceneSections.forEach(function (section) {
    var items = section.querySelectorAll("[data-reveal]");
    if (!items.length) return;
    gsap.fromTo(items,
      { opacity: 0, y: 28 },
      {
        opacity: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.08,
        scrollTrigger: {
          trigger: section,
          start: "top 70%",
          end: "bottom 25%",
          toggleActions: "play reverse play reverse"
        }
      }
    );
  });

  /* ---------------------------------------------------------
     5. POINTER / TOUCH INTERACTIVE TILT
  --------------------------------------------------------- */
  var pointer = { x: 0, y: 0 };
  var pointerTarget = { x: 0, y: 0 };

  function setPointer(clientX, clientY) {
    pointerTarget.x = (clientX / window.innerWidth) * 2 - 1;
    pointerTarget.y = (clientY / window.innerHeight) * 2 - 1;
  }
  window.addEventListener("mousemove", function (e) { setPointer(e.clientX, e.clientY); spawnTrail(e.clientX, e.clientY); }, { passive: true });
  window.addEventListener("touchmove", function (e) {
    var t = e.touches[0];
    if (!t) return;
    setPointer(t.clientX, t.clientY);
    spawnTrail(t.clientX, t.clientY);
  }, { passive: true });

  /* ---------------------------------------------------------
     6. GOLDEN PARTICLE TRAIL (2D canvas, follows cursor/touch)
  --------------------------------------------------------- */
  var trailCanvas = document.getElementById("trail-canvas");
  var tctx = trailCanvas.getContext("2d");
  var particles = [];
  var dpr = Math.min(window.devicePixelRatio, 2);

  function resizeTrail() {
    trailCanvas.width = window.innerWidth * dpr;
    trailCanvas.height = window.innerHeight * dpr;
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resizeTrail();

  function spawnTrail(x, y) {
    for (var i = 0; i < 2; i++) {
      particles.push({
        x: x, y: y,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6 - 0.3,
        r: Math.random() * 2.5 + 1.2,
        life: 1,
        decay: Math.random() * 0.012 + 0.01
      });
    }
    if (particles.length > 160) particles.splice(0, particles.length - 160);
  }

  function renderTrail() {
    tctx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx; p.y += p.vy; p.life -= p.decay;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      tctx.beginPath();
      var grd = tctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
      grd.addColorStop(0, "rgba(232,201,138," + p.life + ")");
      grd.addColorStop(1, "rgba(201,145,76,0)");
      tctx.fillStyle = grd;
      tctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
      tctx.fill();
    }
  }

  /* ---------------------------------------------------------
     7. RENDER LOOP
  --------------------------------------------------------- */
  function animate() {
    requestAnimationFrame(animate);

    pointer.x += (pointerTarget.x - pointer.x) * 0.06;
    pointer.y += (pointerTarget.y - pointer.y) * 0.06;

    phoneGroup.position.set(phoneState.x, phoneState.y, phoneState.z);
    phoneGroup.rotation.set(
      phoneState.rx + pointer.y * 0.18,
      phoneState.ry + pointer.x * 0.22,
      phoneState.rz
    );
    phoneGroup.scale.setScalar(phoneState.s);

    camera.position.z = phoneState.camZ;
    camera.position.y = phoneState.camY;
    camera.lookAt(phoneGroup.position);

    renderer.render(scene, camera);
    renderTrail();
  }
  animate();

  /* ---------------------------------------------------------
     8. RESIZE — keep phone framed correctly on all screens
  --------------------------------------------------------- */
  function onResize() {
    var w = window.innerWidth, h = window.innerHeight;
    isMobile = window.matchMedia("(max-width: 760px)").matches;

    camera.aspect = w / h;
    // widen FOV slightly on narrow viewports so the phone never clips
    camera.fov = isMobile ? 42 : 32;
    camera.updateProjectionMatrix();

    renderer.setSize(w, h);
    resizeTrail();
    ScrollTrigger.refresh();
  }
  window.addEventListener("resize", onResize);
  onResize();

})();
