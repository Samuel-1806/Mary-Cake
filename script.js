/* ============================================================
   MARY CAKE — CINEMATIC SITE v2
   Pilares:
   1. Hero pinado com video scrubbing frame-by-frame
   2. Story blocks animados conforme o progresso do scrub
   3. Progress rail lateral dourada
   4. Fade de saída revelando seção do app
   5. Phone mockup com parallax 3D no hover (desktop)
   6. Mobile FAB com glow periódico
   ============================================================ */

(function () {
  "use strict";

  gsap.registerPlugin(ScrollTrigger);

  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth <= 680;

  /* ----------------------------------------------------------
     LOADER — barra de progresso simulada
  ---------------------------------------------------------- */
  var loader     = document.getElementById("loader");
  var loaderFill = document.getElementById("loaderBarFill");
  var loaderProgress = 0;
  var loaderTimer;

  function tickLoader() {
    loaderProgress = Math.min(loaderProgress + (Math.random() * 12), 95);
    if (loaderFill) loaderFill.style.width = loaderProgress + "%";
    loaderTimer = setTimeout(tickLoader, 120 + Math.random() * 180);
  }
  tickLoader();

  function hideLoader() {
    clearTimeout(loaderTimer);
    if (loaderFill) loaderFill.style.width = "100%";
    setTimeout(function () {
      if (loader) loader.classList.add("is-hidden");
      // Anima os story blocks de entrada logo após o loader
      if (!prefersReduced) animateStoryBlockIn(1);
    }, 350);
  }

  /* ----------------------------------------------------------
     NAV
  ---------------------------------------------------------- */
  function initNav() {
    var nav    = document.getElementById("nav");
    var burger = document.getElementById("navBurger");
    var menu   = document.getElementById("mobileMenu");

    ScrollTrigger.create({
      start: 60,
      end: 99999,
      onUpdate: function (self) {
        nav.classList.toggle("is-scrolled", self.scroll() > 60);
      },
    });

    if (!burger || !menu) return;
    burger.addEventListener("click", function () {
      var open = menu.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.style.overflow = open ? "hidden" : "";
    });
    menu.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        menu.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      });
    });
  }

  /* ----------------------------------------------------------
     PROGRESS RAIL — linha dourada lateral
  ---------------------------------------------------------- */
  var railEl    = document.getElementById("progressRail");
  var railFill  = document.getElementById("progressRailFill");
  var railDot   = document.getElementById("progressRailDot");

  function updateRail(progress) {
    if (!railFill || !railDot) return;
    var pct = Math.min(Math.max(progress, 0), 1);
    railFill.style.height = (pct * 100) + "%";
    railDot.style.top     = (pct * 100) + "%";
  }

  /* ----------------------------------------------------------
     STORY BLOCKS — animação narrativa com GSAP
     Cada bloco tem três estados: off (antes), on (ativo), out (depois).
     A animação é orquestrada pelo progresso do ScrollTrigger.
  ---------------------------------------------------------- */
  var storyBlocks = [
    document.getElementById("storyBlock1"),
    document.getElementById("storyBlock2"),
    document.getElementById("storyBlock3"),
  ];

  // Ranges de progresso para cada bloco (início-in, início-out, fim-out)
  var blockRanges = [
    { inStart: 0,    inEnd: 0.06, outStart: 0.28, outEnd: 0.38 },
    { inStart: 0.32, inEnd: 0.40, outStart: 0.60, outEnd: 0.70 },
    { inStart: 0.64, inEnd: 0.72, outStart: 0.92, outEnd: 1.0  },
  ];

  // Estado atual de cada bloco: -1 (antes), 0 (entrando), 1 (visível), 2 (saindo), 3 (saído)
  var blockState = [-1, -1, -1];

  function animateStoryBlockIn(idx) {
    var block = storyBlocks[idx];
    if (!block) return;
    var eyebrow = block.querySelector(".story-eyebrow");
    var title   = block.querySelector(".story-title");
    var sub     = block.querySelector(".story-sub");

    gsap.killTweensOf([block, eyebrow, title, sub]);

    gsap.set(block, { opacity: 1 });

    var tl = gsap.timeline();
    if (eyebrow) tl.to(eyebrow, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, 0);
    if (title)   tl.to(title,   { opacity: 1, y: 0, rotateX: 0, duration: 0.8, ease: "power3.out" }, 0.08);
    if (sub)     tl.to(sub,     { opacity: 1, y: 0, duration: 0.65, ease: "power3.out" }, 0.18);
  }

  function animateStoryBlockOut(idx) {
    var block = storyBlocks[idx];
    if (!block) return;
    var eyebrow = block.querySelector(".story-eyebrow");
    var title   = block.querySelector(".story-title");
    var sub     = block.querySelector(".story-sub");

    gsap.killTweensOf([block, eyebrow, title, sub]);

    var tl = gsap.timeline({ onComplete: function () { gsap.set(block, { opacity: 0 }); } });
    if (eyebrow) tl.to(eyebrow, { opacity: 0, y: -10, duration: 0.4, ease: "power2.in" }, 0);
    if (title)   tl.to(title,   { opacity: 0, y: -16, rotateX: -6, duration: 0.45, ease: "power2.in" }, 0.04);
    if (sub)     tl.to(sub,     { opacity: 0, y: -10, duration: 0.35, ease: "power2.in" }, 0);
  }

  function resetBlock(idx) {
    var block = storyBlocks[idx];
    if (!block) return;
    gsap.set(block, { opacity: 0 });
    var eyebrow = block.querySelector(".story-eyebrow");
    var title   = block.querySelector(".story-title");
    var sub     = block.querySelector(".story-sub");
    if (eyebrow) gsap.set(eyebrow, { opacity: 0, y: 12 });
    if (title)   gsap.set(title,   { opacity: 0, y: 20, rotateX: 8 });
    if (sub)     gsap.set(sub,     { opacity: 0, y: 16 });
  }

  function onScrubProgress(progress) {
    // Atualiza cada bloco conforme o progresso global
    blockRanges.forEach(function (range, i) {
      var prev = blockState[i];
      var inProg  = progress >= range.inStart;
      var inDone  = progress >= range.inEnd;
      var outProg = progress >= range.outStart;
      var outDone = progress >= range.outEnd;

      if (!inProg) {
        // Antes do bloco
        if (prev !== -1) { resetBlock(i); blockState[i] = -1; }
      } else if (inProg && !outProg) {
        // Bloco ativo
        if (prev !== 1) { animateStoryBlockIn(i); blockState[i] = 1; }
      } else if (outProg) {
        // Bloco saindo / saído
        if (prev !== 2 && prev !== 3) { animateStoryBlockOut(i); blockState[i] = 2; }
        if (outDone && prev !== 3) { blockState[i] = 3; }
      }
    });
  }

  /* ----------------------------------------------------------
     HERO VIDEO SCRUB — frame-by-frame pelo scroll
  ---------------------------------------------------------- */
  function initHeroScrub() {
    var video     = document.getElementById("heroVideo");
    var heroPin   = document.getElementById("heroPin");
    var exitVeil  = document.getElementById("heroExitVeil");
    var scrollCue = document.getElementById("heroScrollCue");

    if (!video || !heroPin) return;

    // Garante que o vídeo esteja pausado (não deve auto-reproduzir)
    video.pause();
    video.currentTime = 0;

    // Esconde progress rail até entrar no hero
    if (railEl) railEl.classList.remove("is-visible");

    // Fade out do scroll cue quando o usuário começa a rolar
    if (scrollCue && !prefersReduced) {
      ScrollTrigger.create({
        trigger: heroPin,
        start: "top top",
        end: "+=8%",
        scrub: true,
        onUpdate: function (self) {
          gsap.set(scrollCue, { opacity: 1 - self.progress * 1.8 });
        },
      });
    }

    var videoDuration = 0.01; // fallback até metadata carregar

    function setupScrub(duration) {
      videoDuration = duration || 0.01;

      ScrollTrigger.create({
        trigger: heroPin,
        start: "top top",
        end: "+=400%",   // 4 alturas de viewport de scroll para o scrub completo
        pin: true,
        pinSpacing: true,
        scrub: isMobile ? 0.3 : 0.6,  // mais rápido no mobile para sensação responsiva
        onUpdate: function (self) {
          var p = self.progress;

          // Avança/retrocede o vídeo
          var targetTime = p * videoDuration;
          if (!isNaN(targetTime) && video.readyState >= 1) {
            // Limita a frequência de updates no mobile para evitar janks
            video.currentTime = targetTime;
          }

          // Atualiza progress rail
          if (railEl) {
            railEl.classList.toggle("is-visible", p > 0.01);
            updateRail(p);
          }

          // Orquestra os story blocks narrativos
          if (!prefersReduced) onScrubProgress(p);

          // Fade de saída: do progresso 0.88 em diante, escurece para preto
          if (exitVeil) {
            var exitProgress = Math.max(0, (p - 0.88) / 0.12);
            exitVeil.style.opacity = exitProgress.toFixed(4);
          }
        },
        onLeave: function () {
          // Ao terminar o scrub, esconde o rail
          if (railEl) railEl.classList.remove("is-visible");
        },
        onEnterBack: function () {
          if (railEl) railEl.classList.add("is-visible");
        },
      });
    }

    // Tenta usar a duração real do vídeo; fallback de 6s para vídeos curtos
    if (video.readyState >= 1 && video.duration) {
      setupScrub(video.duration);
    } else {
      setupScrub(6);
      video.addEventListener("loadedmetadata", function () {
        videoDuration = video.duration || 6;
      }, { once: true });
    }

    // Força pausa ao carregar (mobile iOS precisa)
    video.addEventListener("loadeddata", function () {
      video.pause();
    });

    // Touch: garante que o vídeo responda imediatamente ao toque no iOS
    document.addEventListener("touchstart", function () {
      if (video.paused && video.readyState >= 2) {
        video.play().then(function () { video.pause(); }).catch(function () {});
      }
    }, { once: true, passive: true });
  }

  /* ----------------------------------------------------------
     SCROLL REVEALS — seções abaixo do hero
  ---------------------------------------------------------- */
  function initReveals() {
    var groups = {};
    gsap.utils.toArray("[data-reveal]").forEach(function (el) {
      var section = el.closest("section");
      var key = section ? (section.id || section.className || "s") : "d";
      groups[key] = groups[key] || [];
      groups[key].push(el);
    });

    Object.keys(groups).forEach(function (key) {
      var els = groups[key];
      if (prefersReduced) { gsap.set(els, { opacity: 1, y: 0 }); return; }
      gsap.to(els, {
        opacity: 1, y: 0, duration: 0.85,
        ease: "power3.out", stagger: 0.09,
        scrollTrigger: {
          trigger: els[0].closest("section"),
          start: "top 78%",
          once: true,
        },
      });
    });
  }

  /* ----------------------------------------------------------
     PHONE MOCKUP — parallax 3D no hover (desktop)
  ---------------------------------------------------------- */
  function initPhoneParallax() {
    var visual = document.getElementById("appVisual");
    var body   = document.getElementById("phoneBody");
    if (!visual || !body || isMobile) return;

    var bounds = {};
    function updateBounds() { bounds = visual.getBoundingClientRect(); }
    window.addEventListener("resize", updateBounds);
    updateBounds();

    visual.addEventListener("mouseenter", function () { updateBounds(); });

    visual.addEventListener("mousemove", function (e) {
      var rect = bounds;
      var cx   = rect.left + rect.width  / 2;
      var cy   = rect.top  + rect.height / 2;
      var dx   = (e.clientX - cx) / (rect.width  / 2); // -1 … 1
      var dy   = (e.clientY - cy) / (rect.height / 2); // -1 … 1

      gsap.to(body, {
        rotateY: dx * 14,
        rotateX: -dy * 10,
        translateZ: 30,
        duration: 0.5,
        ease: "power2.out",
        transformPerspective: 900,
        transformOrigin: "center center",
      });
    });

    visual.addEventListener("mouseleave", function () {
      gsap.to(body, {
        rotateY: 0, rotateX: 0, translateZ: 0,
        duration: 0.7, ease: "power3.out",
      });
    });
  }

  /* ----------------------------------------------------------
     MOBILE FAB — esconde quando usuário está na seção #app
  ---------------------------------------------------------- */
  function initMobileFab() {
    var fab     = document.getElementById("mobileFab");
    var appSec  = document.getElementById("app");
    if (!fab || !appSec || !isMobile) return;

    ScrollTrigger.create({
      trigger: appSec,
      start: "top 80%",
      end: "bottom 20%",
      onEnter:     function () { gsap.to(fab, { opacity: 0, y: 20, duration: 0.4, ease: "power2.in" }); },
      onLeave:     function () { gsap.to(fab, { opacity: 1, y: 0,  duration: 0.4, ease: "power2.out" }); },
      onEnterBack: function () { gsap.to(fab, { opacity: 0, y: 20, duration: 0.4, ease: "power2.in" }); },
      onLeaveBack: function () { gsap.to(fab, { opacity: 1, y: 0,  duration: 0.4, ease: "power2.out" }); },
    });
  }

  /* ----------------------------------------------------------
     FOOTER YEAR
  ---------------------------------------------------------- */
  function initYear() {
    var el = document.getElementById("year");
    if (el) el.textContent = new Date().getFullYear();
  }

  /* ----------------------------------------------------------
     INIT
  ---------------------------------------------------------- */
  function init() {
    if (prefersReduced) {
      // Sem animações — exibe tudo imediatamente
      storyBlocks.forEach(function (b) {
        if (b) gsap.set(b, { opacity: 1 });
        if (b) {
          b.querySelectorAll(".story-eyebrow, .story-title, .story-sub").forEach(function (el) {
            gsap.set(el, { opacity: 1, y: 0, rotateX: 0 });
          });
        }
      });
    } else {
      // Reseta todos os story blocks para o estado invisível inicial
      storyBlocks.forEach(function (_, i) { resetBlock(i); });
    }

    initHeroScrub();
    initReveals();
    initNav();
    initPhoneParallax();
    initMobileFab();
    initYear();
    ScrollTrigger.refresh();
  }

  if (document.readyState === "complete") {
    init();
    hideLoader();
  } else {
    window.addEventListener("DOMContentLoaded", init);
    window.addEventListener("load", hideLoader);
    setTimeout(hideLoader, 3000); // safety net
  }

})();
