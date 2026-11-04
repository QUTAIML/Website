// src/scripts/hackathon/folio.js
// Each hackathon portfolio plays its entrance once as it scrolls into view, and
// its looping details (radar, scan line) only run while it is on screen.
// html.motion is only set when the visitor allows motion.

const folios = [...document.querySelectorAll(".hack-folio")];

if (folios.length && document.documentElement.classList.contains("motion") && "IntersectionObserver" in window) {
  document.documentElement.classList.add("folio-reveal");

  const revealer = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (!isIntersecting) return;
      revealer.unobserve(target);
      target.classList.add("is-visible");
    });
  }, { rootMargin: "0px 0px -22% 0px" });

  const onscreen = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => target.classList.toggle("is-onscreen", isIntersecting));
  });

  folios.forEach((folio) => {
    revealer.observe(folio);
    onscreen.observe(folio);
  });
}
