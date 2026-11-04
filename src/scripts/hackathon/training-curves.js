// src/scripts/hackathon/training-curves.js
// Hackathon hero background: a training-loss chart drawing itself. On a faint grid,
// a pink "train" curve and a dashed silver "validation" curve trace left to right
// as a model trains, falling steeply then levelling off. Once drawn, the chart
// holds, fades, and redraws with new curves.

const DRAW_SECONDS = 7;
const HOLD_SECONDS = 2.5;
const FADE_SECONDS = 1;
const SAMPLES = 160;
// The chart's area within the header, as fractions of its width and height.
const AREA = { left: 0.52, right: 0.86, top: 0.2, bottom: 0.84 };

const canvas = document.getElementById("training-curves");

if (canvas) {
  const context = canvas.getContext("2d");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let width = 0;
  let height = 0;
  let curves = null;
  let phase = "drawing";
  let phaseTime = 0;
  let lastTime = 0;
  let frameId = 0;
  let isVisible = true;

  // Smoothed noise, so the curves wobble like real training rather than jitter.
  function smoothNoise(amount) {
    let value = 0;
    return Array.from({ length: SAMPLES }, () => (value = value * 0.82 + (Math.random() - 0.5) * amount));
  }

  // Loss falls fast, then levels off; validation settles a little higher.
  function createCurves() {
    const rate = 4 + Math.random() * 2.5;
    const floor = 0.08 + Math.random() * 0.06;
    const gap = 0.07 + Math.random() * 0.06;
    const trainNoise = smoothNoise(0.025);
    const valNoise = smoothNoise(0.04);
    const train = [];
    const validation = [];
    for (let index = 0; index < SAMPLES; index += 1) {
      const t = index / (SAMPLES - 1);
      const base = floor + (0.92 - floor) * Math.exp(-rate * t);
      train.push(Math.min(0.97, Math.max(0.03, base + trainNoise[index] * (1 - t * 0.6))));
      validation.push(Math.min(0.97, Math.max(0.03, base + gap * (1 - Math.exp(-rate * 1.4 * t)) + valNoise[index])));
    }
    return { train, validation };
  }

  const toX = (t) => (AREA.left + t * (AREA.right - AREA.left)) * width;
  const toY = (value) => (AREA.top + (1 - value) * (AREA.bottom - AREA.top)) * height;

  function drawGrid() {
    context.strokeStyle = "rgba(255, 139, 244, .09)";
    context.lineWidth = 1;
    context.beginPath();
    for (let line = 0; line <= 4; line += 1) {
      const y = toY(line / 4);
      context.moveTo(toX(0), y);
      context.lineTo(toX(1), y);
    }
    for (let line = 0; line <= 6; line += 1) {
      const x = toX(line / 6);
      context.moveTo(x, toY(0));
      context.lineTo(x, toY(1));
    }
    context.stroke();

    context.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.fillStyle = "rgba(200, 205, 214, .55)";
    context.textAlign = "left";
    context.fillText("loss", toX(0), toY(1) - 10);
    context.textAlign = "right";
    context.fillText("epochs →", toX(1), toY(0) + 20);
  }

  function drawCurve(values, progress, style) {
    const last = Math.max(1, Math.floor(progress * (SAMPLES - 1)));
    context.beginPath();
    for (let index = 0; index <= last; index += 1) {
      const x = toX(index / (SAMPLES - 1));
      const y = toY(values[index]);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    Object.assign(context, style);
    context.stroke();
    context.setLineDash([]);
    context.shadowBlur = 0;
    return [toX(last / (SAMPLES - 1)), toY(values[last])];
  }

  function draw() {
    context.clearRect(0, 0, width, height);
    const visibility = phase === "fading" ? Math.max(0, 1 - phaseTime / FADE_SECONDS) : 1;
    // Ease the drawing so the steep early fall reads clearly, then slows.
    const raw = phase === "drawing" ? Math.min(1, phaseTime / DRAW_SECONDS) : 1;
    const progress = reducedMotion ? 1 : 1 - (1 - raw) ** 1.6;

    context.globalAlpha = visibility;
    drawGrid();
    context.setLineDash([6, 5]);
    const valEnd = drawCurve(curves.validation, progress, { strokeStyle: "rgba(200, 205, 214, .6)", lineWidth: 1.4, shadowBlur: 0 });
    const trainEnd = drawCurve(curves.train, progress, { strokeStyle: "rgba(255, 0, 230, .85)", lineWidth: 2, shadowColor: "#ff00e6", shadowBlur: 10 });

    // Labels ride along with the end of each curve.
    context.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.textAlign = "left";
    context.fillStyle = "rgba(255, 139, 244, .9)";
    context.fillText("train", trainEnd[0] + 8, trainEnd[1] + 4);
    context.fillStyle = "rgba(200, 205, 214, .75)";
    context.fillText("validation", valEnd[0] + 8, valEnd[1] + (valEnd[1] < trainEnd[1] + 14 ? -8 : 4));
    context.globalAlpha = 1;
  }

  function advance(seconds) {
    phaseTime += seconds;
    if (phase === "drawing" && phaseTime >= DRAW_SECONDS) { phase = "holding"; phaseTime = 0; }
    if (phase === "holding" && phaseTime >= HOLD_SECONDS) { phase = "fading"; phaseTime = 0; }
    if (phase === "fading" && phaseTime >= FADE_SECONDS) { curves = createCurves(); phase = "drawing"; phaseTime = 0; }
  }

  function frame(time) {
    advance(Math.min(time - lastTime, 100) / 1000);
    lastTime = time;
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
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.round(box.width);
    height = Math.round(box.height);
    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    draw();
  }

  curves = createCurves();
  // Without motion, the finished chart is shown as a still picture.
  if (reducedMotion) phase = "holding";
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
