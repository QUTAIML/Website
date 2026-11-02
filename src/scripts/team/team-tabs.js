// src/scripts/team/team-tabs.js
// Team list beside the people. Without JavaScript the tabs stay hidden and every team is listed.

document.addEventListener("DOMContentLoaded", () => {
  const explorer = document.getElementById("team-explorer");
  if (!explorer) return;

  const tabs = [...explorer.querySelectorAll(".team-tab")];
  const panels = [...explorer.querySelectorAll(".team-panel")];

  const AUTO_ADVANCE_MS = 6000;
  let isExplorerVisible = false;

  // Teams wider than the panel scroll sideways. The arrows and nodes follow the scroll position.
  const rosters = panels.map((panel) => {
    const scroller = panel.querySelector(".team-profiles");
    const arrows = panel.querySelector(".team-panel-arrows");
    const previous = panel.querySelector("[data-team-previous]");
    const next = panel.querySelector("[data-team-next]");
    const people = [...scroller.children];
    const nodes = [...panel.querySelectorAll(".team-panel-count i")];

    function sync() {
      if (panel.hidden) return;
      const furthest = scroller.scrollWidth - scroller.clientWidth;
      arrows.hidden = furthest <= 1;
      previous.disabled = scroller.scrollLeft <= 1;
      next.disabled = scroller.scrollLeft >= furthest - 1;
      const view = scroller.getBoundingClientRect();
      people.forEach((person, index) => {
        const { left, right } = person.getBoundingClientRect();
        nodes[index]?.classList.toggle("is-off-screen", right > view.right + 2 || left < view.left - 2);
      });
    }

    function move(direction) {
      const behavior = document.documentElement.classList.contains("motion") ? "smooth" : "auto";
      scroller.scrollBy({ left: direction * scroller.clientWidth, behavior });
    }

    previous.addEventListener("click", () => move(-1));
    next.addEventListener("click", () => move(1));
    scroller.addEventListener("scroll", () => requestAnimationFrame(sync), { passive: true });
    // Rotates through a long team every few seconds, until someone takes over.
    let timer = 0;
    let isPaused = false;
    const stopTimer = () => { clearTimeout(timer); timer = 0; };
    function queueAdvance() {
      stopTimer();
      const furthest = scroller.scrollWidth - scroller.clientWidth;
      if (!isExplorerVisible || isPaused || panel.hidden || furthest <= 1 || !document.documentElement.classList.contains("motion")) return;
      timer = setTimeout(() => {
        if (scroller.scrollLeft >= furthest - 1) scroller.scrollTo({ left: 0, behavior: "smooth" });
        else move(1);
        queueAdvance();
      }, AUTO_ADVANCE_MS);
    }
    function takeOver() {
      isPaused = true;
      stopTimer();
    }

    previous.addEventListener("click", takeOver);
    next.addEventListener("click", takeOver);
    ["pointerdown", "focusin"].forEach((type) => scroller.addEventListener(type, takeOver, { passive: true }));
    scroller.addEventListener("wheel", (event) => { if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) takeOver(); }, { passive: true });

    function restart() {
      isPaused = false;
      scroller.scrollLeft = 0;
      queueAdvance();
    }
    return { sync, queueAdvance, stopTimer, restart, panel };
  });
  window.addEventListener("resize", () => rosters.forEach(({ sync }) => sync()));

  // The wait only starts once the people are on screen.
  new IntersectionObserver(([entry]) => {
    isExplorerVisible = entry.isIntersecting;
    rosters.forEach(({ queueAdvance, stopTimer }) => (isExplorerVisible ? queueAdvance() : stopTimer()));
  }, { threshold: 0.35 }).observe(explorer);

  function selectTab(tab, shouldFocus = false) {
    tabs.forEach((other) => {
      const isSelected = other === tab;
      other.setAttribute("aria-selected", String(isSelected));
      other.tabIndex = isSelected ? 0 : -1;
    });
    panels.forEach((panel) => { panel.hidden = panel.id !== tab.getAttribute("aria-controls"); });
    rosters.forEach(({ sync, restart, stopTimer, panel }) => {
      stopTimer();
      if (!panel.hidden) restart();
      sync();
    });
    if (shouldFocus) tab.focus();
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      selectTab(tab);
      // On phones the list scrolls sideways, so keep the chosen team in view.
      if (window.matchMedia("(max-width: 800px)").matches) {
        tab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    });
    tab.addEventListener("keydown", (event) => {
      const moves = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
      if (event.key in moves) {
        event.preventDefault();
        selectTab(tabs[(index + moves[event.key] + tabs.length) % tabs.length], true);
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        selectTab(event.key === "Home" ? tabs[0] : tabs.at(-1), true);
      }
    });
  });

  explorer.classList.add("is-ready");
  selectTab(tabs[0]);
});
