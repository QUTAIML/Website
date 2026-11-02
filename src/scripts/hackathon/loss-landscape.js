// src/scripts/hackathon/loss-landscape.js
// Hackathon hero background: gradient descent on a loss landscape. The lines are
// contours of a surface and each light is an optimiser rolling down to a minimum.

const WELLS = [
  [0.60, 0.30, 0.20, 1],
  [0.84, 0.70, 0.17, 0.85],
  [0.45, 0.82, 0.15, 0.6],
  [0.93, 0.16, 0.11, 0.55],
];
const CONTOUR_LEVELS = 17;
const GRID_STEP = 10;
const WALKER_COUNT = 5;
const LEARNING_RATE = 0.0016;
const MOMENTUM = 0.93;
const TRAIL_LENGTH = 170;
const HOLD_STEPS = 80;
const MAX_STEPS = 900;
const STEPS_PER_SECOND = 40;

const canvas = document.getElementById("loss-landscape");

if (canvas) {
  const context = canvas.getContext("2d");
  const contours = document.createElement("canvas");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let width = 0;
  let height = 0;
  let aspect = 1;
  let lowest = 0;
  let highest = 1;
  let walkers = [];
  let frameId = 0;
  let lastTime = 0;
  let pending = 0;
  let isVisible = true;

  // Positions are in units of hero height, so the wells stay round at any width.
  function loss(x, y) {
    const slope = 0.35 * (x / aspect) + 0.18 * y;
    const ripple = 0.035 * Math.sin(6.5 * x + 1) * Math.cos(8 * y);
    const wells = WELLS.reduce((total, [cx, cy, spread, depth]) => {
      const dx = x - cx * aspect;
      const dy = y - cy;
      return total + depth * Math.exp(-(dx * dx + dy * dy) / (2 * spread * spread));
    }, 0);
    return slope + ripple - wells;
  }

  function gradient(x, y) {
    const h = 0.002;
    return [(loss(x + h, y) - loss(x - h, y)) / (2 * h), (loss(x, y + h) - loss(x, y - h)) / (2 * h)];
  }

  function drawContours(pixelRatio) {
    contours.width = width * pixelRatio;
    contours.height = height * pixelRatio;
    const target = contours.getContext("2d");
    target.scale(pixelRatio, pixelRatio);

    const columns = Math.ceil(width / GRID_STEP) + 1;
    const rows = Math.ceil(height / GRID_STEP) + 1;
    const values = [];
    lowest = Infinity;
    highest = -Infinity;
    for (let row = 0; row <= rows; row += 1) {
      values[row] = [];
      for (let column = 0; column <= columns; column += 1) {
        const value = loss((column * GRID_STEP) / height, (row * GRID_STEP) / height);
        values[row][column] = value;
        lowest = Math.min(lowest, value);
        highest = Math.max(highest, value);
      }
    }

    // Marching squares: each grid cell contributes the line crossing it at this level.
    const crossing = (a, b, level) => (level - a) / (b - a);
    for (let index = 1; index < CONTOUR_LEVELS; index += 1) {
      const level = lowest + ((highest - lowest) * index) / CONTOUR_LEVELS;
      const depth = 1 - index / CONTOUR_LEVELS;
      target.beginPath();
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const a = values[row][column];
          const b = values[row][column + 1];
          const c = values[row + 1][column + 1];
          const d = values[row + 1][column];
          const x = column * GRID_STEP;
          const y = row * GRID_STEP;
          const points = [];
          if (a < level !== b < level) points.push([x + crossing(a, b, level) * GRID_STEP, y]);
          if (b < level !== c < level) points.push([x + GRID_STEP, y + crossing(b, c, level) * GRID_STEP]);
          if (d < level !== c < level) points.push([x + crossing(d, c, level) * GRID_STEP, y + GRID_STEP]);
          if (a < level !== d < level) points.push([x, y + crossing(a, d, level) * GRID_STEP]);
          for (let point = 0; point + 1 < points.length; point += 2) {
            target.moveTo(...points[point]);
            target.lineTo(...points[point + 1]);
          }
        }
      }
      target.strokeStyle = `rgba(255, 139, 244, ${0.06 + 0.3 * depth})`;
      target.lineWidth = 1;
      target.stroke();
    }
  }

  function createWalker() {
    return {
      x: (0.42 + Math.random() * 0.58) * aspect,
      y: Math.random(),
      vx: 0,
      vy: 0,
      trail: [],
      steps: 0,
      hold: 0,
    };
  }

  function stepWalker(walker) {
    if (walker.hold > 0) {
      walker.hold -= 1;
      walker.trail.shift();
      return walker.hold === 0 ? createWalker() : walker;
    }

    const [gx, gy] = gradient(walker.x, walker.y);
    walker.vx = MOMENTUM * walker.vx - LEARNING_RATE * gx;
    walker.vy = MOMENTUM * walker.vy - LEARNING_RATE * gy;
    walker.x += walker.vx;
    walker.y += walker.vy;
    walker.steps += 1;
    walker.trail.push([walker.x * height, walker.y * height]);
    if (walker.trail.length > TRAIL_LENGTH) walker.trail.shift();

    const isSettled = walker.steps > 40 && Math.hypot(walker.vx, walker.vy) < 0.00035;
    const hasLeft = walker.x < 0 || walker.x > aspect || walker.y < 0 || walker.y > 1;
    if (isSettled || hasLeft || walker.steps > MAX_STEPS) walker.hold = HOLD_STEPS;
    return walker;
  }

  function drawWalker(walker) {
    const { trail, hold } = walker;
    for (let index = 1; index < trail.length; index += 1) {
      context.beginPath();
      context.moveTo(...trail[index - 1]);
      context.lineTo(...trail[index]);
      context.strokeStyle = `rgba(255, 0, 230, ${(index / trail.length) * 0.9})`;
      context.lineWidth = 2;
      context.stroke();
    }

    const x = walker.x * height;
    const y = walker.y * height;
    if (hold > 0) {
      // A ring opens where the optimiser came to rest.
      const progress = 1 - hold / HOLD_STEPS;
      context.beginPath();
      context.arc(x, y, 4 + progress * 26, 0, Math.PI * 2);
      context.strokeStyle = `rgba(255, 139, 244, ${0.8 * (1 - progress)})`;
      context.lineWidth = 1.5;
      context.stroke();
    }
    context.beginPath();
    context.arc(x, y, 3.5, 0, Math.PI * 2);
    context.fillStyle = "#fff";
    context.shadowColor = "#ff00e6";
    context.shadowBlur = 16;
    context.fill();
    context.shadowBlur = 0;
  }

  function drawReadout() {
    const lead = walkers[0];
    const value = (loss(lead.x, lead.y) - lowest) / (highest - lowest);
    context.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.textAlign = "right";
    context.fillStyle = "rgba(255, 139, 244, .85)";
    context.fillText(`epoch ${String(lead.steps).padStart(4, "0")}   loss ${value.toFixed(3)}`, width - 28, 112);
  }

  function draw() {
    context.clearRect(0, 0, width, height);
    context.drawImage(contours, 0, 0, width, height);
    walkers.forEach(drawWalker);
    drawReadout();
  }

  function frame(time) {
    pending += Math.min(time - lastTime, 100) / 1000;
    lastTime = time;
    while (pending > 1 / STEPS_PER_SECOND) {
      walkers = walkers.map(stepWalker);
      pending -= 1 / STEPS_PER_SECOND;
    }
    draw();
    frameId = requestAnimationFrame(frame);
  }

  function start() {
    if (reducedMotion || frameId || !isVisible || document.hidden) return;
    lastTime = performance.now();
    frameId = requestAnimationFrame(frame);
  }

  function stop() {
    cancelAnimationFrame(frameId);
    frameId = 0;
  }

  function resize() {
    const box = canvas.getBoundingClientRect();
    if (!box.width || !box.height) return;
    if (Math.round(box.width) === width && Math.round(box.height) === height) return;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.round(box.width);
    height = Math.round(box.height);
    aspect = width / height;
    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    drawContours(pixelRatio);
    walkers = Array.from({ length: WALKER_COUNT }, createWalker);

    // Without motion, show finished descents as a still picture.
    if (reducedMotion) {
      walkers = walkers.map((walker) => {
        let current = walker;
        while (current.hold === 0 && current.steps < MAX_STEPS) current = stepWalker(current);
        return current;
      });
    }
    draw();
  }

  resize();
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([entry]) => {
    isVisible = entry.isIntersecting;
    if (isVisible) start();
    else stop();
  }).observe(canvas);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  start();
}
