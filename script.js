/* ===========================================================
   MARY CAKE — INSTITUTIONAL SITE
   GSAP ScrollTrigger: scroll-scrubbed cinematic hero video
   + nav, reveals, mobile menu
   =========================================================== */

(function () {
  "use strict";

  gsap.registerPlugin(ScrollTrigger);

  var prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  /* -----------------------------------------------------------
     LOADER
  ----------------------------------------------------------- */
  var loader = document.getElementById("loader");
  function hideLoader() {
    if (loader) loader.classList.add("is-hidden");
  }

  /* -----------------------------------------------------------
     HERO — pinned section, video scrubbed frame-by-frame by scroll
     The video advances as the user scrolls down and rewinds
     smoothly as the user scrolls back up. The section stays
     pinned (position fixed) for the full scrub duration, then
     the rest of the page content reveals as scroll continues.
  ----------------------------------------------------------- */
  var heroVideo = document.getElementById("heroVideo");
  var heroPin = document.getElementById("heroPin");
  var heroProgressFill = document.getElementById("heroProgressFill");
  var heroFadeEls = gsap.utils.toArray("[data-hero-fade]");

  function initHeroScrub() {
    if (!heroVideo || !heroPin) return;

    // Entrance for hero copy (independent of scroll position)
    if (!prefersReducedMotion) {
      gsap.to(heroFadeEls, {
        opacity: 1,
        y: 0,
        duration: 1.1,
        ease: "power3.out",
        stagger: 0.12,
        delay: 0.5,
      });
    } else {
      gsap.set(heroFadeEls, { opacity: 1, y: 0 });
    }

    var ctx = { duration: 0 };

    function setupScrub(duration) {
      ctx.duration = duration || 0.01;

      // Fade the hero copy out as the user starts scrolling,
      // so the video becomes the sole focus mid-scrub.
      gsap.to(".hero-content", {
        opacity: 0,
        y: -40,
        ease: "none",
        scrollTrigger: {
          trigger: heroPin,
          start: "top top",
          end: "+=35%",
          scrub: true,
        },
      });

      ScrollTrigger.create({
        trigger: heroPin,
        start: "top top",
        end: "+=300%", // scroll distance mapped to the full video duration
        pin: true,
        pinSpacing: true,
        scrub: 0.6, // smooth easing when reversing / fast scroll
        onUpdate: function (self) {
          var targetTime = self.progress * ctx.duration;
          // Guard against NaN before metadata is ready
          if (!isNaN(targetTime) && heroVideo.readyState >= 1) {
            heroVideo.currentTime = targetTime;
          }
          if (heroProgressFill) {
            heroProgressFill.style.width = self.progress * 100 + "%";
          }
        },
      });
    }

    // Video metadata gives us duration; until then, fall back to
    // a reasonable assumed length (6s, matching the placeholder)
    // so ScrollTrigger can be created without delay.
    var fallbackDuration = 6;

    if (heroVideo.readyState >= 1 && heroVideo.duration) {
      setupScrub(heroVideo.duration);
    } else {
      setupScrub(fallbackDuration);
      heroVideo.addEventListener(
        "loadedmetadata",
        function () {
          ctx.duration = heroVideo.duration || fallbackDuration;
        },
        { once: true }
      );
    }

    // Some mobile browsers need an explicit nudge to allow
    // programmatic currentTime scrubbing on a muted video.
    heroVideo.addEventListener("loadeddata", function () {
      heroVideo.pause();
    });
  }

  /* -----------------------------------------------------------
     SCROLL REVEALS — sections below the hero
  ----------------------------------------------------------- */
  function initReveals() {
    var groups = {};
    gsap.utils.toArray("[data-reveal]").forEach(function (el) {
      var section = el.closest("section");
      var key = section ? section.id || section.className : "default";
      groups[key] = groups[key] || [];
      groups[key].push(el);
    });

    Object.keys(groups).forEach(function (key) {
      var els = groups[key];
      if (prefersReducedMotion) {
        gsap.set(els, { opacity: 1, y: 0 });
        return;
      }
      gsap.to(els, {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.1,
        scrollTrigger: {
          trigger: els[0].closest("section"),
          start: "top 78%",
          once: true,
        },
      });
    });
  }

  /* -----------------------------------------------------------
     NAV — condense on scroll + mobile menu toggle
  ----------------------------------------------------------- */
  function initNav() {
    var nav = document.getElementById("nav");
    ScrollTrigger.create({
      start: 40,
      end: 99999,
      onUpdate: function (self) {
        if (self.scroll() > 40) {
          nav.classList.add("is-scrolled");
        } else {
          nav.classList.remove("is-scrolled");
        }
      },
    });

    var burger = document.getElementById("navBurger");
    var menu = document.getElementById("mobileMenu");
    if (!burger || !menu) return;

    burger.addEventListener("click", function () {
      var isOpen = menu.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", isOpen ? "true" : "false");
      document.body.style.overflow = isOpen ? "hidden" : "";
    });

    menu.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        menu.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      });
    });
  }

  /* -----------------------------------------------------------
     FOOTER YEAR
  ----------------------------------------------------------- */
  function initFooterYear() {
    var yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  }

  /* -----------------------------------------------------------
     INIT
  ----------------------------------------------------------- */
  function init() {
    initHeroScrub();
    initReveals();
    initNav();
    initFooterYear();
    ScrollTrigger.refresh();
  }

  if (document.readyState === "complete") {
    init();
    hideLoader();
  } else {
    window.addEventListener("DOMContentLoaded", init);
    window.addEventListener("load", hideLoader);
    // Safety net in case load event is delayed by slow assets
    setTimeout(hideLoader, 2500);
  }
})();
