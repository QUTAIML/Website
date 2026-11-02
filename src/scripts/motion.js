// src/scripts/motion.js
// Shared page animation: scroll reveals, count-ups, card spotlight and scroll effects.
// html.motion is set in the layouts' <head>, and stays off for reduced motion.

const REVEALS = {
  rise: ".section-heading, .photo-band-heading, .opportunities-copy, .community-copy, .partner-home-lede, .values-heading, .journey-editorial-heading, .now-intro, .existing-heading, .mission-copy, .team-stage-heading, .events-overview-heading, .section-split-heading, .project-pathways-layout > *, .projects-archive-heading, .sandbox-callout-layout, .partner-section-heading, .partner-events-heading, .partner-impact > header, .partner-callout, .connect-section-heading, .connect-direct-layout > *, .recap-heading, .recap-story, .solution-showcase-heading, .photo-story-heading, .photo-story-set > header, .history-intro, .history-entry-heading, .history-founders-heading, .community-story-grid > *, .community-actions-heading, .community-speaker .community-shell, .community-links .community-shell, .exec-heading, .faq-join .faq-shell, .faq-footer .faq-shell, .faq-list-kicker",
  pop: ".value-card, .credibility-promises > div, .archive-stats > article, .opportunity-block, .partner-home-card, .partner-home-impact > div, .social-grid > a, .values-row > article, .now-stats > article, .degree-pathway, .resource-panel, .executive-panel, .event-pillars > article, .event-card, .project-pathway-cards > article, .project-browser, .sponsor-spotlight, .supporter-card, .partner-impact-grid > article, .partner-event-card, .connect-social-grid > *, .recap-stats > div, .solution-grid > article, .history-portfolio, .history-founders-grid > li, .community-action-grid > article, .exec-role-layout > *, .exec-timing",
  wipe: ".photo-story-grid > *, .community-image, .mission-image, .journey-feature-image, .recap-photo, .history-photo",
  left: ".journey-milestone-list > li, .faq-list article",
  right: ".journey-feature-copy",
};

const COUNTERS = ".hero-proof strong, .archive-stats strong, .now-stats strong, .event-hero-facts strong, .project-hero-facts strong, .recap-stats strong, .history-count strong";
const SPOTLIGHT_CARDS =".value-card, .partner-home-card, .opportunity-block, .resource-panel, .executive-panel, .supporter-card, .team-card, .event-card, .solution-grid > article, .connect-social-grid > a";

const STAGGER_MS = 80;
const MAX_STAGGER_MS = 400;
const COUNT_MS = 1400;

function setUpReveals() {
  const observer = new IntersectionObserver((entries) => {
    let batchIndex = 0;

    entries.forEach(({ target, isIntersecting }) => {
      if (!isIntersecting) return;
      observer.unobserve(target);

      target.style.setProperty("--motion-delay", `${Math.min(batchIndex * STAGGER_MS, MAX_STAGGER_MS)}ms`);
      target.classList.remove("motion-pending");
      target.classList.add("motion-in");
      batchIndex += 1;

      const finish = (event) => {
        if (event.target !== target) return;
        target.removeEventListener("animationend", finish);
        target.classList.remove("motion-in", `motion-${target.dataset.motion}`);
        target.style.removeProperty("--motion-delay");
      };
      target.addEventListener("animationend", finish);
    });
  }, { rootMargin: "0px 0px -8% 0px" });

  Object.entries(REVEALS).forEach(([effect, selector]) => {
    document.querySelectorAll(selector).forEach((element) => {
      // Anything already on screen stays visible rather than flashing out.
      const isRendered = element.getClientRects().length > 0;
      if (isRendered && element.getBoundingClientRect().top < window.innerHeight) return;

      element.dataset.motion = effect;
      element.classList.add("motion-pending", `motion-${effect}`);
      observer.observe(element);
    });
  });
}

function countUp(element) {
  const finalText = element.textContent.trim();
  const [, digits, suffix] = finalText.match(/^(\d[\d,]*)(\+?)$/);
  const total = Number(digits.replace(/,/g, ""));

  // Hold the final width so neighbouring stats do not shift as the digits grow.
  const { width } = element.getBoundingClientRect();
  if (getComputedStyle(element).display === "inline") element.style.display = "inline-block";
  element.style.minWidth = `${width}px`;
  element.classList.add("motion-counting");

  const start = performance.now();
  const step = (now) => {
    const progress = Math.min((now - start) / COUNT_MS, 1);
    const eased = 1 - (1 - progress) ** 4;

    if (progress < 1) {
      element.textContent = `${Math.round(total * eased).toLocaleString("en-AU")}${suffix}`;
      requestAnimationFrame(step);
      return;
    }

    element.textContent = finalText;
    element.style.removeProperty("min-width");
    element.style.removeProperty("display");
    element.classList.remove("motion-counting");
  };
  requestAnimationFrame(step);
}

function setUpCounters() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (!isIntersecting) return;
      observer.unobserve(target);
      countUp(target);
    });
  }, { threshold: 0.6 });

  document.querySelectorAll(COUNTERS).forEach((element) => {
    if (element.children.length === 0 && /^\d[\d,]*\+?$/.test(element.textContent.trim())) {
      observer.observe(element);
    }
  });
}

function setUpScrollEffects() {
  const progressBar = document.createElement("div");
  progressBar.className = "motion-progress";
  progressBar.setAttribute("aria-hidden", "true");
  document.body.appendChild(progressBar);

  const rail = document.querySelector(".history-entries");
  let isQueued = false;

  const update = () => {
    isQueued = false;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    progressBar.style.setProperty("--motion-scroll", scrollable > 0 ? Math.min(window.scrollY / scrollable, 1) : 0);

    if (rail) {
      const { top, height } = rail.getBoundingClientRect();
      const drawn = (window.innerHeight * 0.75 - top) / height;
      rail.style.setProperty("--motion-rail", Math.max(0, Math.min(drawn, 1)));
    }
  };

  const queueUpdate = () => {
    if (isQueued) return;
    isQueued = true;
    requestAnimationFrame(update);
  };

  window.addEventListener("scroll", queueUpdate, { passive: true });
  window.addEventListener("resize", queueUpdate);
  update();
}

function setUpHero() {
  const hero = document.querySelector(".aiml-hero");
  if (!hero) return;

  // Stop the looping network animation once the hero has scrolled away.
  new IntersectionObserver(([entry]) => {
    hero.classList.toggle("motion-offscreen", !entry.isIntersecting);
  }).observe(hero);

  hero.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse") return;
    const { left, top, width, height } = hero.getBoundingClientRect();
    hero.style.setProperty("--motion-px", ((event.clientX - left) / width - 0.5) * 2);
    hero.style.setProperty("--motion-py", ((event.clientY - top) / height - 0.5) * 2);
  });
}

function setUpCardSpotlight() {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  const prepareCard = (card) => {
    if (getComputedStyle(card).position === "static") card.style.position = "relative";

    const spot = document.createElement("span");
    spot.className = "motion-spot";
    spot.setAttribute("aria-hidden", "true");
    card.appendChild(spot);
  };

  // Delegated so cards rendered later (team carousel, filters) are included.
  document.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse" || !(event.target instanceof Element)) return;
    const card = event.target.closest(SPOTLIGHT_CARDS);
    if (!card) return;

    if (!card.querySelector(":scope > .motion-spot")) prepareCard(card);

    const { left, top, width, height } = card.getBoundingClientRect();
    card.style.setProperty("--motion-mx", `${((event.clientX - left) / width) * 100}%`);
    card.style.setProperty("--motion-my", `${((event.clientY - top) / height) * 100}%`);
  }, { passive: true });
}

if (document.documentElement.classList.contains("motion")) {
  setUpReveals();
  setUpCounters();
  setUpScrollEffects();
  setUpHero();
  setUpCardSpotlight();
}
