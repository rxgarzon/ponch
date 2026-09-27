/**
 * ==========================================================================
 * PONCH® — CINEMATIC FRONTEND NARRATIVE ENGINE
 * Technologies: Vanilla JS, Lenis, GSAP, ScrollTrigger
 *
 * CRITICAL RULE: ONE-WAY NARRATIVE LIFECYCLE
 * State Machine: INITIAL -> ANIMATING -> COMPLETED
 * Animations latch forward and NEVER reverse on scroll-up.
 * ==========================================================================
 */

(function () {
  'use strict';

  // Check user motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --------------------------------------------------------------------------
     01. NARRATIVE LIFECYCLE & STATE ARCHITECTURE
     -------------------------------------------------------------------------- */
  class NarrativeEngine {
    constructor() {
      this.sections = document.querySelectorAll('.narrative-section');
      this.states = new Map(); // sectionId -> 'INITIAL' | 'ANIMATING' | 'COMPLETED'
      this.latchedProgress = new Map(); // sectionId -> maxProgress (0.0 to 1.0)
      this.initLifecycle();
    }

    initLifecycle() {
      this.sections.forEach((sec) => {
        const id = sec.id;
        this.states.set(id, 'INITIAL');
        this.latchedProgress.set(id, 0);
        sec.dataset.narrativeState = 'INITIAL';
      });

      // Expose to window for telemetry & debugging
      window.PONCH_NARRATIVE = {
        getState: (id) => this.states.get(id),
        getAllStates: () => Object.fromEntries(this.states),
        engine: this
      };
    }

    startAnimating(id) {
      if (this.isCompleted(id)) return;
      this.states.set(id, 'ANIMATING');
      const el = document.getElementById(id);
      if (el) el.dataset.narrativeState = 'ANIMATING';
    }

    complete(id) {
      this.states.set(id, 'COMPLETED');
      this.latchedProgress.set(id, 1);
      const el = document.getElementById(id);
      if (el) {
        el.dataset.narrativeState = 'COMPLETED';
        el.classList.add('is-completed');
      }
      this.updateTracker(id);
    }

    isCompleted(id) {
      return this.states.get(id) === 'COMPLETED';
    }

    /**
     * Unidirectional Latch: Guarantees progress strictly increases.
     * Prevents any rewind when the user scrolls back up.
     */
    latchProgress(id, currentProgress, timeline) {
      if (this.isCompleted(id)) return 1;

      const maxProg = this.latchedProgress.get(id) || 0;
      if (currentProgress > maxProg) {
        this.latchedProgress.set(id, currentProgress);
        if (timeline) {
          timeline.progress(currentProgress);
        }
        if (currentProgress >= 0.999) {
          this.complete(id);
        } else {
          this.startAnimating(id);
        }
        return currentProgress;
      }

      // If scrolling back up (currentProgress <= maxProg), preserve maximum progress
      if (timeline) {
        timeline.progress(maxProg);
      }
      return maxProg;
    }

    updateTracker(activeId) {
      const activeSec = document.getElementById(activeId);
      if (!activeSec) return;
      const stepIndex = activeSec.dataset.sectionIndex;
      if (!stepIndex) return;

      document.querySelectorAll('.tracker-step').forEach((step) => {
        const stepNum = parseInt(step.dataset.step, 10);
        const currentNum = parseInt(stepIndex, 10);

        if (stepNum === currentNum) {
          step.classList.add('is-active');
          step.classList.remove('is-completed');
        } else if (stepNum < currentNum) {
          step.classList.remove('is-active');
          step.classList.add('is-completed');
        } else {
          step.classList.remove('is-active', 'is-completed');
        }
      });
    }
  }

  /* --------------------------------------------------------------------------
     02. INITIALIZE LENIS & GSAP INTEGRATION
     -------------------------------------------------------------------------- */
  let lenis = null;
  const narrative = new NarrativeEngine();

  function initSmoothScroll() {
    if (typeof Lenis !== 'undefined' && !prefersReducedMotion) {
      lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: 'vertical',
        smoothWheel: true,
        wheelMultiplier: 0.9,
        touchMultiplier: 1.5,
      });

      // Synchronize Lenis with GSAP ScrollTrigger
      lenis.on('scroll', ScrollTrigger.update);

      gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
      });

      gsap.ticker.lagSmoothing(0);
    }
  }

  /* --------------------------------------------------------------------------
     03. PROCEDURAL LIGHTNING GENERATOR (SECTION 02 FALLBACK / ACCENT)
     -------------------------------------------------------------------------- */
  class LightningGenerator {
    constructor(canvasId) {
      this.canvas = document.getElementById(canvasId);
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');
      this.resize();
      window.addEventListener('resize', () => this.resize());
    }

    resize() {
      if (!this.canvas) return;
      this.canvas.width = this.canvas.parentElement.clientWidth || window.innerWidth;
      this.canvas.height = this.canvas.parentElement.clientHeight || window.innerHeight;
    }

    createBolt(x1, y1, x2, y2, displace, branchChance = 0.6) {
      if (displace < 7) {
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
        return;
      }

      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const offsetX = (Math.random() - 0.5) * displace;
      const offsetY = (Math.random() - 0.5) * displace;

      const splitX = midX + offsetX;
      const splitY = midY + offsetY;

      this.createBolt(x1, y1, splitX, splitY, displace / 2, branchChance);
      this.createBolt(splitX, splitY, x2, y2, displace / 2, branchChance);

      if (Math.random() < branchChance && displace > 30) {
        const branchX = splitX + (Math.random() - 0.5) * displace * 1.5;
        const branchY = splitY + Math.random() * displace * 1.2;
        this.createBolt(splitX, splitY, branchX, branchY, displace / 2.2, branchChance * 0.5);
      }
    }

    strike(onComplete) {
      if (!this.canvas || prefersReducedMotion) {
        if (onComplete) onComplete();
        return;
      }

      const w = this.canvas.width;
      const h = this.canvas.height;
      const ctx = this.ctx;
      this.canvas.style.opacity = '1';

      let frames = 0;
      const maxFrames = 12;

      const flashOverlay = document.getElementById('lightning-flash');

      const render = () => {
        ctx.clearRect(0, 0, w, h);

        if (frames < 4) {
          // Intense initial flash
          if (flashOverlay) flashOverlay.style.opacity = '0.9';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 4;
          ctx.shadowColor = '#50a0ff';
          ctx.shadowBlur = 25;
        } else if (frames < 8) {
          // Secondary discharge
          if (flashOverlay) flashOverlay.style.opacity = '0.25';
          ctx.strokeStyle = '#8bc4ff';
          ctx.lineWidth = 2.5;
          ctx.shadowColor = '#2d6eff';
          ctx.shadowBlur = 15;
        } else {
          // Residual fading ionization
          if (flashOverlay) flashOverlay.style.opacity = '0';
          ctx.strokeStyle = '#3877ff';
          ctx.lineWidth = 1.2;
          ctx.shadowBlur = 5;
        }

        const startX = w * (0.35 + Math.random() * 0.3);
        const endX = w * (0.45 + Math.random() * 0.2);
        this.createBolt(startX, 0, endX, h * 0.85, 140);

        frames++;
        if (frames <= maxFrames) {
          requestAnimationFrame(render);
        } else {
          ctx.clearRect(0, 0, w, h);
          this.canvas.style.opacity = '0';
          if (flashOverlay) flashOverlay.style.opacity = '0';
          if (onComplete) onComplete();
        }
      };

      render();
    }
  }

  /* --------------------------------------------------------------------------
     04. SECTION 01 — HERO ANIMATIONS & DEPTH PARALLAX
     -------------------------------------------------------------------------- */
  function setupHero() {
    const heroSec = document.getElementById('hero');
    if (!heroSec) return;

    const chars = heroSec.querySelectorAll('.hero-brand-title .char-wrap');
    const statement = heroSec.querySelector('.hero-statement .line-reveal');
    const heroBox = document.getElementById('hero-box-wrapper');
    const heroMeta = heroSec.querySelector('.hero-meta');

    // Initial Hero Entrance
    const heroEntrance = gsap.timeline({
      onStart: () => narrative.startAnimating('hero'),
      onComplete: () => narrative.complete('hero')
    });

    if (!prefersReducedMotion) {
      heroEntrance
        .fromTo(
          heroMeta,
          { opacity: 0, y: -20 },
          { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }
        )
        .fromTo(
          chars,
          { opacity: 0, y: 80, scale: 0.9, rotateX: 30 },
          { opacity: 1, y: 0, scale: 1, rotateX: 0, duration: 1.1, stagger: 0.08, ease: 'power3.out' },
          '-=0.5'
        )
        .fromTo(
          statement,
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out' },
          '-=0.6'
        )
        .fromTo(
          heroBox,
          { opacity: 0, y: 70, scale: 0.92, rotateX: 10 },
          { opacity: 1, y: 0, scale: 1, rotateX: 0, duration: 1.4, ease: 'power3.out' },
          '-=0.8'
        );
    } else {
      narrative.complete('hero');
    }

    // Subtle 3D Mouse Parallax on Hero Box
    const viewport = document.getElementById('hero-product-viewport');
    if (viewport && heroBox && !prefersReducedMotion) {
      viewport.addEventListener('mousemove', (e) => {
        const rect = viewport.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;

        gsap.to(heroBox, {
          rotateY: x * 18,
          rotateX: -y * 18,
          x: x * 15,
          y: y * 15,
          duration: 0.6,
          ease: 'power2.out'
        });
      });

      viewport.addEventListener('mouseleave', () => {
        gsap.to(heroBox, {
          rotateY: 0,
          rotateX: 0,
          x: 0,
          y: 0,
          duration: 1,
          ease: 'power2.out'
        });
      });
    }
  }

  /* --------------------------------------------------------------------------
     05. SECTION 02 — "VIENE RECARGADO" (ONE-WAY CINEMATIC STRIKE)
     -------------------------------------------------------------------------- */
  function setupRecargado() {
    const sec = document.getElementById('recargado');
    if (!sec) return;

    const video = document.getElementById('lightning-video');
    const lightning = new LightningGenerator('lightning-canvas');
    const headlines = sec.querySelectorAll('.strike-word');
    const manifesto = sec.querySelector('.recargado-manifesto');
    const chargedProduct = document.getElementById('charged-product-silhouette');
    const corona = sec.querySelector('.electric-corona');

    let triggered = false;

    // ONE-WAY TRIGGER: Fires once when scrolling down into view
    ScrollTrigger.create({
      trigger: sec,
      start: 'top 65%',
      once: true, // Native one-way enforcement
      onEnter: () => {
        if (triggered || narrative.isCompleted('recargado')) return;
        triggered = true;
        narrative.startAnimating('recargado');

        // Check if video file is available and playable
        let videoPlayed = false;
        if (video) {
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                videoPlayed = true;
                video.style.opacity = '1';
                video.addEventListener('ended', () => {
                  video.style.opacity = '0.35';
                }, { once: true });
              })
              .catch(() => {
                // Video asset not found or autoplay prevented -> Use procedural lightning
                videoPlayed = false;
              });
          }
        }

        // Trigger procedural flash & electrical discharge
        lightning.strike(() => {
          // Reveal charged product and copy with high impact
          const tl = gsap.timeline({
            onComplete: () => narrative.complete('recargado')
          });

          tl.to(corona, { opacity: 1, duration: 0.4 })
            .fromTo(
              chargedProduct,
              { opacity: 0, scale: 0.9, y: 40 },
              { opacity: 1, scale: 1, y: 0, duration: 0.9, ease: 'power3.out' },
              '-=0.2'
            )
            .fromTo(
              headlines,
              { opacity: 0, x: -40 },
              { opacity: 1, x: 0, duration: 0.8, stagger: 0.15, ease: 'power2.out' },
              '-=0.5'
            )
            .fromTo(
              manifesto,
              { opacity: 0, y: 20 },
              { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' },
              '-=0.4'
            );
        });
      }
    });
  }

  /* --------------------------------------------------------------------------
     06. SECTION 03 — LA CAJA SE ABRE (ONE-WAY DECONSTRUCTION)
     -------------------------------------------------------------------------- */
  function setupBoxOpening() {
    const sec = document.getElementById('caja-abre');
    if (!sec) return;

    const lid = document.getElementById('box-part-lid');
    const base = document.getElementById('box-part-base');
    const sachets = sec.querySelectorAll('.sachet-unit');
    const pillars = sec.querySelectorAll('.pillar-card');

    // Build the deconstruction timeline
    const deconstructTimeline = gsap.timeline({ paused: true });

    if (!prefersReducedMotion) {
      // 1. Lid separates and ascends
      deconstructTimeline.to(lid, {
        y: -110,
        rotateX: -15,
        scale: 1.05,
        duration: 1,
        ease: 'power2.out'
      }, 0);

      // 2. Base settles with slight perspective depth
      deconstructTimeline.to(base, {
        y: 30,
        duration: 1,
        ease: 'power2.out'
      }, 0);

      // 3. Sachets emerge and fan outward
      deconstructTimeline.fromTo(
        sachets[0], // Creatina (Left)
        { opacity: 0, y: 50, rotate: 0 },
        { opacity: 1, y: -40, x: -110, rotate: -12, duration: 1.2, ease: 'power3.out' },
        0.3
      );
      deconstructTimeline.fromTo(
        sachets[1], // Vitaminas (Center)
        { opacity: 0, y: 50, rotate: 0 },
        { opacity: 1, y: -70, x: 0, rotate: 0, duration: 1.2, ease: 'power3.out' },
        0.4
      );
      deconstructTimeline.fromTo(
        sachets[2], // Minerales (Right)
        { opacity: 0, y: 50, rotate: 0 },
        { opacity: 1, y: -40, x: 110, rotate: 12, duration: 1.2, ease: 'power3.out' },
        0.5
      );

      // 4. Formula Pillars stagger in
      deconstructTimeline.fromTo(
        pillars,
        { opacity: 0, y: 35 },
        { opacity: 1, y: 0, duration: 0.8, stagger: 0.15, ease: 'power2.out' },
        0.7
      );
    }

    // ScrollTrigger with ONE-WAY LATCHING
    ScrollTrigger.create({
      trigger: sec,
      start: 'top 70%',
      end: 'bottom 40%',
      onUpdate: (self) => {
        narrative.latchProgress('caja-abre', self.progress, deconstructTimeline);
      },
      onEnter: () => narrative.startAnimating('caja-abre')
    });
  }

  /* --------------------------------------------------------------------------
     07. SECTION 04 — FÓRMULA / SISTEMA ORBITAL
     -------------------------------------------------------------------------- */
  function setupOrbitalSystem() {
    const sec = document.getElementById('orbital');
    if (!sec) return;

    const core = document.getElementById('orbital-core');
    const nodes = sec.querySelectorAll('.satellite-node');
    const svgRings = sec.querySelectorAll('.orbit-path');

    const orbitalTimeline = gsap.timeline({ paused: true });

    if (!prefersReducedMotion) {
      orbitalTimeline
        .fromTo(
          core,
          { opacity: 0, scale: 0.4 },
          { opacity: 1, scale: 1, duration: 1, ease: 'back.out(1.5)' }
        )
        .fromTo(
          svgRings,
          { strokeDashoffset: 1000, opacity: 0 },
          { strokeDashoffset: 0, opacity: 1, duration: 1.5, stagger: 0.2, ease: 'power2.out' },
          '-=0.6'
        )
        .fromTo(
          nodes,
          { opacity: 0, scale: 0.7, y: 30 },
          { opacity: 1, scale: 1, y: 0, duration: 0.9, stagger: 0.12, ease: 'power3.out' },
          '-=0.8'
        );
    }

    // One-way trigger
    ScrollTrigger.create({
      trigger: sec,
      start: 'top 65%',
      once: true,
      onEnter: () => {
        narrative.startAnimating('orbital');
        orbitalTimeline.play().then(() => {
          narrative.complete('orbital');
          // Continuous subtle ambient orbital drift after completion
          if (!prefersReducedMotion) {
            nodes.forEach((node, idx) => {
              gsap.to(node, {
                y: `+=${(idx % 2 === 0 ? 8 : -8)}`,
                duration: 2.8 + idx * 0.4,
                repeat: -1,
                yoyo: true,
                ease: 'sine.inOut'
              });
            });
          }
        });
      }
    });
  }

  /* --------------------------------------------------------------------------
     08. SECTIONS 05 & 06 — SABORES (PONCHE DE FRUTAS & MORAS AZULES)
     -------------------------------------------------------------------------- */
  function setupFlavors() {
    const flavorSections = [
      { id: 'sabor-ponche', sachetSel: '.flavor-ponche .flavor-sachet-hero' },
      { id: 'sabor-moras', sachetSel: '.flavor-moras .flavor-sachet-hero' }
    ];

    flavorSections.forEach(({ id, sachetSel }) => {
      const sec = document.getElementById(id);
      if (!sec) return;

      const sachet = sec.querySelector(sachetSel);
      const editorial = sec.querySelector('.flavor-editorial');
      const items = sec.querySelectorAll('.flavor-attr-item');

      const tl = gsap.timeline({ paused: true });

      if (!prefersReducedMotion) {
        tl.fromTo(
          editorial,
          { opacity: 0, x: id === 'sabor-ponche' ? -40 : 40 },
          { opacity: 1, x: 0, duration: 1, ease: 'power3.out' }
        )
        .fromTo(
          sachet,
          { opacity: 0, scale: 0.88, y: 50 },
          { opacity: 1, scale: 1, y: 0, duration: 1.2, ease: 'power3.out' },
          '-=0.7'
        )
        .fromTo(
          items,
          { opacity: 0, y: 15 },
          { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: 'power2.out' },
          '-=0.5'
        );
      }

      ScrollTrigger.create({
        trigger: sec,
        start: 'top 65%',
        once: true,
        onEnter: () => {
          narrative.startAnimating(id);
          tl.play().then(() => narrative.complete(id));
        }
      });
    });
  }

  /* --------------------------------------------------------------------------
     09. SECTION 07 — LOS DOS (SÍNTESIS DUAL & CAJA COMPLETA)
     -------------------------------------------------------------------------- */
  function setupDualMaster() {
    const sec = document.getElementById('los-dos');
    if (!sec) return;

    const masterBox = document.getElementById('dual-box-center');
    const flankLeft = sec.querySelector('.flank-left');
    const flankRight = sec.querySelector('.flank-right');
    const metrics = sec.querySelectorAll('.metric-block');

    const tl = gsap.timeline({ paused: true });

    if (!prefersReducedMotion) {
      tl.fromTo(
        masterBox,
        { opacity: 0, scale: 0.9, y: 50 },
        { opacity: 1, scale: 1, y: 0, duration: 1.1, ease: 'power3.out' }
      )
      .fromTo(
        flankLeft,
        { opacity: 0, x: -80, rotate: -20 },
        { opacity: 1, x: 0, rotate: -8, duration: 1.2, ease: 'power3.out' },
        '-=0.8'
      )
      .fromTo(
        flankRight,
        { opacity: 0, x: 80, rotate: 20 },
        { opacity: 1, x: 0, rotate: 8, duration: 1.2, ease: 'power3.out' },
        '-=1.0'
      )
      .fromTo(
        metrics,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.8, stagger: 0.15, ease: 'power2.out' },
        '-=0.4'
      );
    }

    ScrollTrigger.create({
      trigger: sec,
      start: 'top 65%',
      once: true,
      onEnter: () => {
        narrative.startAnimating('los-dos');
        tl.play().then(() => narrative.complete('los-dos'));
      }
    });
  }

  /* --------------------------------------------------------------------------
     10. SECTION 08 — CTA & CLOSING MANIFESTO
     -------------------------------------------------------------------------- */
  function setupCTA() {
    const sec = document.getElementById('cta');
    if (!sec) return;

    const titleAnchor = sec.querySelector('.cta-brand-title');
    const statement = sec.querySelector('.cta-statement');
    const button = document.getElementById('btn-discover');

    const tl = gsap.timeline({ paused: true });

    if (!prefersReducedMotion) {
      tl.fromTo(
        titleAnchor,
        { opacity: 0, scale: 0.9 },
        { opacity: 1, scale: 1, duration: 1.3, ease: 'power2.out' }
      )
      .fromTo(
        statement,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' },
        '-=0.8'
      )
      .fromTo(
        button,
        { opacity: 0, scale: 0.92 },
        { opacity: 1, scale: 1, duration: 0.8, ease: 'back.out(1.4)' },
        '-=0.4'
      );
    }

    ScrollTrigger.create({
      trigger: sec,
      start: 'top 70%',
      once: true,
      onEnter: () => {
        narrative.startAnimating('cta');
        tl.play().then(() => narrative.complete('cta'));
      }
    });
  }

  /* --------------------------------------------------------------------------
     11. GLOBAL SCROLL POSITION & SECTION TRACKER OBSERVER
     -------------------------------------------------------------------------- */
  function setupScrollTracker() {
    const sections = document.querySelectorAll('.narrative-section');

    sections.forEach((sec) => {
      ScrollTrigger.create({
        trigger: sec,
        start: 'top 45%',
        end: 'bottom 45%',
        onEnter: () => narrative.updateTracker(sec.id),
        onEnterBack: () => narrative.updateTracker(sec.id)
      });
    });

    // Smooth scroll for nav anchors
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', function (e) {
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;
        const targetEl = document.querySelector(targetId);
        if (targetEl) {
          e.preventDefault();
          if (lenis) {
            lenis.scrollTo(targetEl, { offset: -30, duration: 1.4 });
          } else {
            targetEl.scrollIntoView({ behavior: 'smooth' });
          }
        }
      });
    });
  }

  /* --------------------------------------------------------------------------
     12. SYSTEM BOOTSTRAP
     -------------------------------------------------------------------------- */
  function init() {
    // Register GSAP plugins
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
      gsap.registerPlugin(ScrollTrigger);
    }

    initSmoothScroll();
    setupHero();
    setupRecargado();
    setupBoxOpening();
    setupOrbitalSystem();
    setupFlavors();
    setupDualMaster();
    setupCTA();
    setupScrollTracker();

    // Remove no-js flag
    document.documentElement.classList.remove('no-js');
    document.documentElement.classList.add('js-ready');
    console.log('⚡ PONCH Narrative Engine initialized successfully.');
  }

  // DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
