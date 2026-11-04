// src/scripts/about/history-roster.js
// Each year's divisions and names sit behind a "View the team" button under its photo.
// The rosters are open in the HTML, so without JavaScript every name is still shown
// (and the site search can still read them); this script folds them away.

document.querySelectorAll(".history-roster-toggle").forEach((toggle) => {
  const roster = document.getElementById(toggle.getAttribute("aria-controls"));
  if (!roster) return;

  const label = toggle.querySelector("b");
  const { year } = toggle.dataset;

  const setOpen = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    roster.classList.toggle("is-open", open);
    label.textContent = open ? `Hide the ${year} team` : `View the ${year} team`;
    roster.dispatchEvent(new CustomEvent("history:roster-toggle", { bubbles: true, detail: { open } }));
  };

  roster.classList.add("is-collapsible");
  toggle.hidden = false;
  setOpen(false);
  toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
});
