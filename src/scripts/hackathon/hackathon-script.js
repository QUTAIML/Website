// src/scripts/hackathon/hackathon-script.js

document.addEventListener("DOMContentLoaded", () => {
  const target = new Date("2026-08-07T17:30:00");
  const container = document.getElementById("countdown");

  if (!container) return;

  const units = [
    { id: "cd-days", label: "Days" },
    { id: "cd-hours", label: "Hours" },
    { id: "cd-minutes", label: "Minutes" },
    { id: "cd-seconds", label: "Seconds" },
  ];

  units.forEach(({ id, label }) => {
    const wrap = document.createElement("div");
    wrap.className = "countdown-item";

    const box = document.createElement("div");
    box.className = "countdown-box";

    const num = document.createElement("span");
    num.id = id;
    num.textContent = "--";
    num.className = "countdown-number";

    const lbl = document.createElement("span");
    lbl.textContent = label;
    lbl.className = "countdown-text";

    box.appendChild(num);
    wrap.appendChild(box);
    wrap.appendChild(lbl);
    container.appendChild(wrap);
  });

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function tick() {
    const diff = target.getTime() - new Date().getTime();

    if (diff <= 0) {
      ["cd-days", "cd-hours", "cd-minutes", "cd-seconds"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = "00";
      });
      return;
    }

    document.getElementById("cd-days").textContent =
      pad(Math.floor(diff / 86400000));

    document.getElementById("cd-hours").textContent =
      pad(Math.floor(diff / 3600000) % 24);

    document.getElementById("cd-minutes").textContent =
      pad(Math.floor(diff / 60000) % 60);

    document.getElementById("cd-seconds").textContent =
      pad(Math.floor(diff / 1000) % 60);
  }

  tick();
  setInterval(tick, 1000);
});