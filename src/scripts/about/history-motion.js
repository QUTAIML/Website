// src/scripts/about/history-motion.js
// Motion for "The people who shape AIML" (/about/history):
//  - each year lights up on the timeline as you reach it
//  - team photos drift slightly against the scroll
//  - each team's roles cascade in once its card is shown (after its roster is opened)
//  - the hero's year links glide to their chapter
// html.motion is only set when the visitor allows motion; without it nothing here runs.

if (document.documentElement.classList.contains("motion")) {
  const entries = [...document.querySelectorAll(".history-entry")];
  const photos = [...document.querySelectorAll(".history-photo")];
  let isQueued = false;

  const update = () => {
    isQueued = false;
    const line = window.innerHeight * 0.55;
    entries.forEach((entry) => entry.classList.toggle("is-reached", entry.getBoundingClientRect().top <= line));

    photos.forEach((photo) => {
      const { top, height } = photo.getBoundingClientRect();
      if (top > window.innerHeight || top + height < 0) return;
      // -1 as the photo enters at the bottom, 1 as it leaves at the top.
      const progress = (window.innerHeight / 2 - (top + height / 2)) / (window.innerHeight / 2 + height / 2);
      photo.style.setProperty("--history-shift", `${(progress * height * 0.045).toFixed(1)}px`);
    });
  };

  const queueUpdate = () => {
    if (isQueued) return;
    isQueued = true;
    requestAnimationFrame(update);
  };

  window.addEventListener("scroll", queueUpdate, { passive: true });
  window.addEventListener("resize", queueUpdate);
  update();

  const cards = new IntersectionObserver((observed) => {
    observed.forEach(({ target, isIntersecting }) => {
      // Cards in a closed roster wait until it is opened.
      if (!isIntersecting || target.closest(".history-roster.is-collapsible:not(.is-open)")) return;
      cards.unobserve(target);
      target.classList.add("is-shown");
    });
  }, { rootMargin: "0px 0px -10% 0px" });

  document.querySelectorAll(".history-portfolio").forEach((card) => {
    card.querySelectorAll("li").forEach((row, index) => row.style.setProperty("--row", index));
    cards.observe(card);
  });

  // A card folded away in a closed roster may already have been reported, so
  // observe its cards afresh when the roster opens.
  document.addEventListener("history:roster-toggle", ({ target, detail }) => {
    if (!detail.open) return;
    target.querySelectorAll(".history-portfolio:not(.is-shown)").forEach((card) => {
      cards.unobserve(card);
      cards.observe(card);
    });
  });

  document.querySelectorAll(".history-hero-years a").forEach((link) => {
    link.addEventListener("click", (event) => {
      const target = document.querySelector(link.getAttribute("href"));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", link.getAttribute("href"));
    });
  });
}
