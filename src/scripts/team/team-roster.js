// src/scripts/team/team-roster.js
// The line beside the teams fills as you scroll, and the jump links follow along.

document.addEventListener("DOMContentLoaded", () => {
  const roster = document.getElementById("team-roster");
  if (!roster) return;

  const groups = [...roster.querySelectorAll(".team-group")];
  const fill = roster.querySelector(".team-spine b");
  const jump = document.getElementById("team-jump");
  const links = [...jump.querySelectorAll("a")];
  let isQueued = false;

  // Each team plays its own entrance the first time it scrolls into view.
  // html.motion is only set when the visitor allows motion.
  if (document.documentElement.classList.contains("motion") && "IntersectionObserver" in window) {
    groups.forEach((group) => {
      group.querySelectorAll(".team-profiles > li").forEach((item, index) => item.style.setProperty("--team-i", index));
    });
    roster.classList.add("team-reveal");

    const revealer = new IntersectionObserver((entries) => {
      entries.forEach(({ target, isIntersecting }) => {
        if (!isIntersecting) return;
        revealer.unobserve(target);
        target.classList.add("is-visible");
      });
    }, { rootMargin: "0px 0px -18% 0px" });

    // The emblems' slow idle details only run while their team is on screen.
    const onscreen = new IntersectionObserver((entries) => {
      entries.forEach(({ target, isIntersecting }) => target.classList.toggle("is-onscreen", isIntersecting));
    });

    groups.forEach((group) => {
      revealer.observe(group);
      onscreen.observe(group);
    });
  }

  function update() {
    isQueued = false;
    const line = window.innerHeight * 0.45;
    const { top, height } = roster.getBoundingClientRect();
    fill.style.transform = `scaleY(${Math.min(1, Math.max(0, (line - top) / height))})`;

    let current = 0;
    groups.forEach((group, index) => {
      const isReached = group.getBoundingClientRect().top <= line;
      group.classList.toggle("is-reached", isReached);
      if (isReached) current = index;
    });

    links.forEach((link, index) => {
      if (index === current) {
        if (link.getAttribute("aria-current") !== "true" && jump.scrollWidth > jump.clientWidth) {
          jump.scrollTo({ left: link.offsetLeft - 16 });
        }
        link.setAttribute("aria-current", "true");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function queueUpdate() {
    if (isQueued) return;
    isQueued = true;
    requestAnimationFrame(update);
  }

  window.addEventListener("scroll", queueUpdate, { passive: true });
  window.addEventListener("resize", queueUpdate);
  update();
});
