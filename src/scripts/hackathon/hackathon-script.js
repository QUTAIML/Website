// src/scripts/hackathon/hackathon-script.js
// Countdown for the AIML Hackathon 2027. Times are fixed to Brisbane (AEST, UTC+10).

const START = new Date("2027-04-02T17:00:00+10:00").getTime(); // kickoff
const END = new Date("2027-04-04T20:00:00+10:00").getTime(); // finish

const section = document.getElementById("hackathon-countdown");
const grid = document.getElementById("countdown");

if (section && grid) {
  const kicker = document.getElementById("countdown-kicker");
  const label = document.getElementById("countdown-label");
  const finished = document.getElementById("countdown-finished");

  const units = [
    { key: "days", label: "Days", size: 86400000, mod: Infinity },
    { key: "hours", label: "Hours", size: 3600000, mod: 24 },
    { key: "minutes", label: "Minutes", size: 60000, mod: 60 },
    { key: "seconds", label: "Seconds", size: 1000, mod: 60 },
  ];

  const els = {};
  units.forEach(({ key, label: text }) => {
    const item = document.createElement("div");
    item.className = "countdown-item";
    const box = document.createElement("div");
    box.className = "countdown-box";
    const num = document.createElement("span");
    num.className = "countdown-number";
    num.textContent = "--";
    const lbl = document.createElement("span");
    lbl.className = "countdown-text";
    lbl.textContent = text;
    box.appendChild(num);
    item.appendChild(box);
    item.appendChild(lbl);
    grid.appendChild(item);
    els[key] = num;
  });

  const pad = (n) => String(n).padStart(2, "0");

  // Re-trigger the CSS flip animation whenever a digit changes.
  function setDigit(key, value) {
    const el = els[key];
    if (el.textContent === value) return;
    el.textContent = value;
    el.classList.remove("flip");
    void el.offsetWidth;
    el.classList.add("flip");
  }

  let phase = "";

  function setPhase(next) {
    if (phase === next) return;
    phase = next;
    section.dataset.phase = next;
    const done = next === "after";
    grid.hidden = done;
    finished.hidden = !done;
    label.hidden = done;
    if (next === "before") {
      kicker.textContent = "COMING SOON";
      label.textContent = "Kicks off 2 April 2027, 5:00pm";
    } else if (next === "live") {
      kicker.textContent = "LIVE NOW";
      label.textContent = "Hacking ends 4 April 2027, 8:00pm";
    } else {
      kicker.textContent = "HACKATHON COMPLETE";
    }
  }

  function tick() {
    const now = Date.now();
    const next = now < START ? "before" : now < END ? "live" : "after";
    setPhase(next);
    if (next === "after") return;

    const target = next === "before" ? START : END;
    const diff = Math.max(0, target - now);
    units.forEach(({ key, size, mod }) => {
      const v = Math.floor(diff / size);
      setDigit(key, pad(mod === Infinity ? v : v % mod));
    });
  }

  tick();
  setInterval(tick, 1000);
}
