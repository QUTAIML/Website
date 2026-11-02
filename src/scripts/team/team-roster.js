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
