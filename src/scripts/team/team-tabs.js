// src/scripts/team/team-tabs.js
// Team tabs along a rail. Without JavaScript the tabs stay hidden and every team is listed.

document.addEventListener("DOMContentLoaded", () => {
  const explorer = document.getElementById("team-explorer");
  if (!explorer) return;

  const tabs = [...explorer.querySelectorAll(".team-tab")];
  const panels = [...explorer.querySelectorAll(".team-panel")];
  const rail = explorer.querySelector(".team-tabs");
  rail.style.setProperty("--team-count", tabs.length);

  function selectTab(tab, shouldFocus = false) {
    tabs.forEach((other) => {
      const isSelected = other === tab;
      other.setAttribute("aria-selected", String(isSelected));
      other.tabIndex = isSelected ? 0 : -1;
    });
    panels.forEach((panel) => { panel.hidden = panel.id !== tab.getAttribute("aria-controls"); });
    rail.style.setProperty("--team-progress", tabs.indexOf(tab) / Math.max(tabs.length - 1, 1));
    if (shouldFocus) tab.focus();
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      selectTab(tab);
      // On phones the rail scrolls sideways, so keep the chosen team in view.
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
