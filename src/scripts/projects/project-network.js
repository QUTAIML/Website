// src/scripts/projects/project-network.js
// Projects hero background: a layered neural network with signals passing through it.

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const LAYER_SIZES = [3, 5, 5, 5, 3];
const PULSE_COUNT = 10;

const network = document.getElementById("project-network");

if (network) {
  function createShape(tag, attributes) {
    const shape = document.createElementNS(SVG_NAMESPACE, tag);
    Object.entries(attributes).forEach(([name, value]) => shape.setAttribute(name, value));
    network.appendChild(shape);
    return shape;
  }

  function draw() {
    const { width, height } = network.getBoundingClientRect();
    if (!width || !height) return;
    network.setAttribute("viewBox", `0 0 ${width} ${height}`);
    network.replaceChildren();

    // Layers spread across the hero, each centred vertically below the navigation.
    const top = 110;
    const usableHeight = height - top - 30;
    const layers = LAYER_SIZES.map((size, layerIndex) => {
      const x = width * (0.06 + (0.88 * layerIndex) / (LAYER_SIZES.length - 1));
      const gap = usableHeight / Math.max(...LAYER_SIZES);
      const start = top + usableHeight / 2 - (gap * (size - 1)) / 2;
      return Array.from({ length: size }, (_, index) => [x, start + gap * index]);
    });

    const routes = [];
    layers.slice(0, -1).forEach((layer, layerIndex) => {
      layer.forEach(([x1, y1]) => {
        layers[layerIndex + 1].forEach(([x2, y2]) => {
          const bend = (x2 - x1) / 2;
          routes.push(`M${x1} ${y1} C${x1 + bend} ${y1} ${x2 - bend} ${y2} ${x2} ${y2}`);
        });
      });
    });

    routes.forEach((d) => createShape("path", { d, class: "project-network-wire" }));

    // A few signals pass through at a time, on different routes and speeds.
    [...routes].sort(() => Math.random() - 0.5).slice(0, PULSE_COUNT).forEach((d) => {
      const pulse = createShape("path", { d, class: "project-network-pulse", pathLength: "100" });
      pulse.style.animationDuration = `${6 + Math.random() * 7}s`;
      pulse.style.animationDelay = `${-Math.random() * 12}s`;
    });

    layers.flat().forEach(([cx, cy]) => createShape("circle", { cx, cy, r: 2.5, class: "project-network-node" }));
  }

  // Pause the signals while the hero is off screen.
  new IntersectionObserver(([entry]) => network.classList.toggle("is-offscreen", !entry.isIntersecting)).observe(network);
  new ResizeObserver(draw).observe(network);
  draw();
}
