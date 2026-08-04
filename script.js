(() => {
  "use strict";

  gsap.registerPlugin(ScrollTrigger);

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------
     Frame sequence config
  ------------------------------------------------------------ */
  const FRAME_COUNT = 100;
  const FRAME_PATH = (i) => `./images/ezgif-frame-${String(i).padStart(3, "0")}.jpg`;

  const canvas = document.getElementById("sequenceCanvas");
  const ctx = canvas.getContext("2d");
  const images = new Array(FRAME_COUNT);

  const preloader = document.getElementById("preloader");
  const preloaderBar = document.getElementById("preloaderBar");
  const preloaderPct = document.getElementById("preloaderPct");

  const seqState = { frame: 0 };

  /* ------------------------------------------------------------
     Canvas sizing (device-pixel-ratio aware, cover-fit draw)
  ------------------------------------------------------------ */
  function sizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawFrame(Math.round(seqState.frame));
  }

  function drawFrame(index) {
    const img = images[index];
    if (!img || !img.complete || img.naturalWidth === 0) return;

    const rect = canvas.getBoundingClientRect();
    const cw = rect.width, ch = rect.height;
    const iw = img.naturalWidth, ih = img.naturalHeight;

    const scale = Math.max(cw / iw, ch / ih);
    const dw = iw * scale, dh = ih * scale;
    const dx = (cw - dw) / 2, dy = (ch - dh) / 2;

    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  /* ------------------------------------------------------------
     Preload all frames, then boot the scroll experience
  ------------------------------------------------------------ */
  function preload() {
    let loaded = 0;

    return new Promise((resolve) => {
      for (let i = 1; i <= FRAME_COUNT; i++) {
        const img = new Image();
        img.src = FRAME_PATH(i);
        img.onload = img.onerror = () => {
          loaded++;
          const pct = Math.round((loaded / FRAME_COUNT) * 100);
          preloaderBar.style.width = pct + "%";
          preloaderPct.textContent = pct;
          if (i === 1) drawFrame(0);
          if (loaded === FRAME_COUNT) resolve();
        };
        images[i - 1] = img;
      }
    });
  }

  /* ------------------------------------------------------------
     Story beats — opacity mapped to scroll progress (0 → 1)
  ------------------------------------------------------------ */
  const beats = [
    { el: document.querySelector(".beat-1"), range: [0.00, 0.03, 0.13, 0.17] },
    { el: document.querySelector(".beat-2"), range: [0.19, 0.23, 0.39, 0.43] },
    { el: document.querySelector(".beat-3"), range: [0.45, 0.49, 0.67, 0.71] },
    { el: document.querySelector(".beat-4"), range: [0.74, 0.79, 1.00, 1.00] },
  ];

  function beatOpacity(p, [inStart, inEnd, outStart, outEnd]) {
    if (p < inStart) return 0;
    if (p < inEnd) return (p - inStart) / (inEnd - inStart);
    if (p < outStart) return 1;
    if (p < outEnd) return 1 - (p - outStart) / (outEnd - outStart);
    return outEnd >= 1 ? 1 : 0;
  }

  function updateBeats(p) {
    beats.forEach(({ el, range }) => {
      if (!el) return;
      const o = beatOpacity(p, range);
      el.style.opacity = o;
      const isCentered = el.classList.contains("beat-4");
      const rise = (1 - o) * 16;
      el.style.transform = isCentered
        ? `translate(-50%, calc(-50% + ${rise}px))`
        : `translateY(calc(-50% + ${rise}px))`;
      el.style.pointerEvents = o > 0.6 ? "auto" : "none";
    });
  }

  /* ------------------------------------------------------------
     Steep ring — circular progress + act counter
  ------------------------------------------------------------ */
  const ringProgress = document.getElementById("ringProgress");
  const steepLabel = document.getElementById("steepLabel");
  const RING_CIRC = 2 * Math.PI * 44;

  function updateRing(p) {
    const offset = RING_CIRC * (1 - p);
    ringProgress.style.strokeDashoffset = offset;
    const act = Math.min(4, Math.floor(p * 4) + 1);
    steepLabel.textContent = "0" + act;
  }

  /* ------------------------------------------------------------
     The Blend — card entrance + hover motion
  ------------------------------------------------------------ */
  function initBlendCards() {
    const cards = gsap.utils.toArray(".blend-item");
    if (!cards.length) return;

    // Entrance: staggered rise-and-fade as the grid comes into view
    gsap.from(cards, {
      y: reduceMotion ? 0 : 56,
      opacity: 0,
      duration: 0.9,
      ease: "power3.out",
      stagger: 0.14,
      scrollTrigger: {
        trigger: ".blend-grid",
        start: "top 82%",
        toggleActions: "play none none reverse",
      },
    });

    // Heading itself gets a quieter fade-up, slightly ahead of the cards
    gsap.from([".blend .section-eyebrow", ".blend .section-title"], {
      y: reduceMotion ? 0 : 24,
      opacity: 0,
      duration: 0.8,
      ease: "power2.out",
      stagger: 0.1,
      scrollTrigger: {
        trigger: ".blend",
        start: "top 75%",
        toggleActions: "play none none reverse",
      },
    });

    if (reduceMotion) return;

    // Hover: glow bloom, underline draw, index rises, card lifts
    cards.forEach((card) => {
      const glow = card.querySelector(".blend-glow");
      const underline = card.querySelector(".blend-underline");
      const index = card.querySelector(".blend-index");
      const heading = card.querySelector("h3");

      const tl = gsap.timeline({ paused: true });
      tl.to(card, { y: -8, duration: 0.5, ease: "power3.out" }, 0)
        .to(glow, { opacity: 1, scale: 1, duration: 0.6, ease: "power2.out" }, 0)
        .to(underline, { scaleX: 1, duration: 0.55, ease: "power3.out" }, 0.02)
        .to(index, { y: -4, letterSpacing: "0.04em", duration: 0.5, ease: "power3.out" }, 0)
        .to(heading, { x: 4, duration: 0.5, ease: "power3.out" }, 0);

      card.addEventListener("mouseenter", () => tl.play());
      card.addEventListener("mouseleave", () => tl.reverse());

      // Subtle cursor-follow glow position
      card.addEventListener("mousemove", (e) => {
        const rect = card.getBoundingClientRect();
        const relX = ((e.clientX - rect.left) / rect.width) * 100;
        gsap.to(glow, { left: relX + "%", duration: 0.6, ease: "power2.out" });
      });
    });
  }

  /* ------------------------------------------------------------
     Origins — typewriter reveal, triggered on scroll-in
  ------------------------------------------------------------ */
  function initTypewriter() {
    const el = document.querySelector(".type-text");
    if (!el) return;
    const fullText = el.dataset.text || "";
    el.textContent = reduceMotion ? fullText : "";
    if (reduceMotion) return;

    ScrollTrigger.create({
      trigger: ".origins",
      start: "top 72%",
      once: true,
      onEnter: () => {
        let i = 0;
        const speed = 34;
        (function tick() {
          el.textContent = fullText.slice(0, i);
          i++;
          if (i <= fullText.length) setTimeout(tick, speed);
        })();
      },
    });
  }
const paragraph = document.querySelector(".origins-copy");
  const targetSpan = paragraph.querySelector(".type-typed-text");
  const textToType = paragraph.getAttribute("data-text");
  let charIndex = 0;
  const typingSpeed = 35; // Slightly faster speed for longer paragraph text

  function typeWriter() {
    if (charIndex < textToType.length) {
      targetSpan.textContent += textToType.charAt(charIndex);
      charIndex++;
      setTimeout(typeWriter, typingSpeed);
    }
  }

  typeWriter();
  /* ------------------------------------------------------------
     Origins media — quiet parallax + fade-in on scroll
  ------------------------------------------------------------ */
  function initOriginsMedia() {
    const media = document.querySelector(".origins-media");
    const text = document.querySelector(".origins-text");
    if (!media) return;

    gsap.from(media, {
      opacity: 0,
      x: reduceMotion ? 0 : 40,
      duration: 1,
      ease: "power3.out",
      scrollTrigger: {
        trigger: ".origins",
        start: "top 75%",
        toggleActions: "play none none reverse",
      },
    });
    if (text) {
      gsap.from(text, {
        opacity: 0,
        y: reduceMotion ? 0 : 24,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".origins",
          start: "top 75%",
          toggleActions: "play none none reverse",
        },
      });
    }
    if (reduceMotion) return;

    gsap.to(media, {
      yPercent: -6,
      ease: "none",
      scrollTrigger: {
        trigger: ".origins",
        start: "top bottom",
        end: "bottom top",
        scrub: true,
      },
    });
  }

  /* ------------------------------------------------------------
     The Selection — entrance + hover glow
  ------------------------------------------------------------ */
  function initSelectionCards() {
    const cards = gsap.utils.toArray(".selection-card");
    if (!cards.length) return;

    gsap.from(cards, {
      y: reduceMotion ? 0 : 44,
      opacity: 0,
      scale: reduceMotion ? 1 : 0.97,
      duration: 0.9,
      ease: "power3.out",
      stagger: 0.14,
      scrollTrigger: {
        trigger: ".selection-grid",
        start: "top 85%",
        toggleActions: "play none none reverse",
      },
    });

    gsap.from([".selection-head", ".selection .section-title", ".selection-sub"], {
      y: reduceMotion ? 0 : 22,
      opacity: 0,
      duration: 0.8,
      ease: "power2.out",
      stagger: 0.08,
      scrollTrigger: {
        trigger: ".selection",
        start: "top 78%",
        toggleActions: "play none none reverse",
      },
    });

    if (reduceMotion) return;

    cards.forEach((card) => {
      const glow = card.querySelector(".card-glow");
      const tl = gsap.timeline({ paused: true });
      tl.to(card, { y: -6, borderColor: "rgba(201,161,91,.9)", duration: 0.45, ease: "power3.out" }, 0)
        .to(glow, { opacity: 1, duration: 0.5, ease: "power2.out" }, 0);

      card.addEventListener("mouseenter", () => tl.play());
      card.addEventListener("mouseleave", () => tl.reverse());
    });
  }

  /* ------------------------------------------------------------
     History — pinned crossfade timeline
  ------------------------------------------------------------ */
  function initHistoryTimeline() {
    const pinEl = document.querySelector(".history-pin");
    const chapters = gsap.utils.toArray(".history-chapter");
    if (!pinEl || !chapters.length) return;

    const dots = gsap.utils.toArray(".history-dot");
    const progressFill = document.getElementById("historyProgressFill");

    function setActiveDot(i) {
      dots.forEach((d, di) => d.classList.toggle("is-active", di === i));
    }
    setActiveDot(0);

    // Heading reveal — plain scroll-in, not part of the pin
    gsap.from(".history-head", {
      y: reduceMotion ? 0 : 24,
      opacity: 0,
      duration: 0.9,
      ease: "power3.out",
      scrollTrigger: {
        trigger: ".history-head",
        start: "top 82%",
        toggleActions: "play none none reverse",
      },
    });

    if (reduceMotion) {
      // No pin, no scrub: let every chapter sit in normal flow, stacked and readable
      gsap.set(".history-pin", { height: "auto" });
      gsap.set(chapters, { position: "relative", opacity: 1, visibility: "visible" });
      return;
    }

    // Start state: only chapter 1 visible. autoAlpha toggles opacity + visibility
    // together and — unlike animating "visibility" directly — GSAP snaps the
    // visibility flip at the correct end of the fade, so it never cuts early.
    gsap.set(chapters, { autoAlpha: 0, pointerEvents: "none" });
    gsap.set(chapters[0], { autoAlpha: 1, pointerEvents: "auto" });

    const HOLD = 1;   // time spent fully on a chapter before the next one starts
    const FADE = 0.4; // time spent cross-dissolving into the next chapter

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: pinEl,
        start: "top top",
        end: "+=500%",
        pin: pinEl,
        scrub: 1,
        anticipatePin: 1,
        onUpdate: (self) => {
          if (progressFill) progressFill.style.width = (self.progress * 100).toFixed(2) + "%";
        },
      },
    });

    chapters.forEach((chapter, i) => {
      if (i === 0) return;
      const prev = chapters[i - 1];
      tl.to(prev, {
        autoAlpha: 0,
        duration: FADE,
        onStart: () => { prev.style.pointerEvents = "none"; },
      }, `+=${HOLD}`)
        .to(chapter, {
          autoAlpha: 1,
          duration: FADE,
          onStart: () => { chapter.style.pointerEvents = "auto"; setActiveDot(i); },
          onReverseComplete: () => setActiveDot(i - 1),
        }, "<");
    });
  }

  /* ------------------------------------------------------------
     Boot
  ------------------------------------------------------------ */
  async function init() {
    sizeCanvas();
    await preload();

    preloader.classList.add("hidden");
    document.body.style.overflow = "";

    sizeCanvas();
    updateBeats(0);
    updateRing(0);

    const scrollLength = reduceMotion ? "+=2500" : "+=4200";

    ScrollTrigger.create({
      trigger: "#sequenceWrapper",
      start: "top top",
      end: scrollLength,
      scrub: reduceMotion ? true : 0.5,
      pin: ".sequence-pin",
      anticipatePin: 1,
      onUpdate: (self) => {
        seqState.frame = self.progress * (FRAME_COUNT - 1);
        drawFrame(Math.round(seqState.frame));
        updateBeats(self.progress);
        updateRing(self.progress);
      },
    });

    initBlendCards();
    initTypewriter();
    initOriginsMedia();
    initHistoryTimeline();
    initSelectionCards();

    ScrollTrigger.refresh();
  }

  window.addEventListener("resize", () => {
    sizeCanvas();
    ScrollTrigger.refresh();
  });

  document.body.style.overflow = "hidden";
  init();
})();