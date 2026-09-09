import { useMemo, useRef, useState, type PointerEvent } from "react";

type Point = { x: number; y: number };
const colours = ["#FF8BF4", "#77E4FF", "#FFE16B", "#8DFF9A", "#FF9277", "#C7A6FF"];

function kMeans(points: Point[], k: number) {
  if (!points.length) return { labels: [] as number[], centroids: [] as Point[] };
  const count = Math.min(k, points.length);
  let centroids = Array.from({ length: count }, (_, index) => points[Math.floor((index * points.length) / count)]);
  let labels = points.map(() => 0);
  for (let iteration = 0; iteration < 24; iteration += 1) {
    labels = points.map((point) => centroids.reduce((best, centroid, index) => {
      const distance = (point.x - centroid.x) ** 2 + (point.y - centroid.y) ** 2;
      return distance < best.distance ? { index, distance } : best;
    }, { index: 0, distance: Infinity }).index);
    const next = centroids.map((centroid, index) => {
      const members = points.filter((_, pointIndex) => labels[pointIndex] === index);
      if (!members.length) return centroid;
      return { x: members.reduce((sum, point) => sum + point.x, 0) / members.length, y: members.reduce((sum, point) => sum + point.y, 0) / members.length };
    });
    if (next.every((centroid, index) => Math.hypot(centroid.x - centroids[index].x, centroid.y - centroids[index].y) < 0.5)) break;
    centroids = next;
  }
  return { labels, centroids };
}

const presets: Record<string, Point[]> = {
  "Three groups": [{ x: 20, y: 25 }, { x: 27, y: 32 }, { x: 34, y: 21 }, { x: 24, y: 43 }, { x: 38, y: 39 }, { x: 64, y: 25 }, { x: 71, y: 32 }, { x: 78, y: 22 }, { x: 75, y: 43 }, { x: 66, y: 40 }, { x: 43, y: 67 }, { x: 51, y: 76 }, { x: 59, y: 68 }, { x: 48, y: 84 }, { x: 61, y: 82 }],
  "Two groups": [{ x: 18, y: 18 }, { x: 28, y: 28 }, { x: 35, y: 20 }, { x: 23, y: 38 }, { x: 39, y: 35 }, { x: 65, y: 62 }, { x: 74, y: 72 }, { x: 81, y: 64 }, { x: 70, y: 82 }, { x: 84, y: 84 }],
};

export default function ClusteringVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [points, setPoints] = useState<Point[]>(presets["Three groups"]);
  const [k, setK] = useState(3);
  const result = useMemo(() => kMeans(points, k), [points, k]);
  const addPoint = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPoints((current) => [...current, { x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 }]);
  };
  return <article className="sandbox-card">
    <div className="sandbox-card-copy"><span>CLUSTERING</span><h3>Live K-means visualizer</h3><p>Click the plot to add observations, then move K to see how the algorithm groups nearby data and relocates each centroid.</p></div>
    <div className="sandbox-controls">
      <label htmlFor="cluster-k">Clusters: <strong>{Math.min(k, Math.max(points.length, 1))}</strong></label>
      <input id="cluster-k" type="range" min="1" max="6" value={k} onChange={(event) => setK(Number(event.target.value))} aria-label="Number of clusters" />
      <select aria-label="Load a clustering preset" defaultValue="" onChange={(event) => { if (event.target.value) setPoints(presets[event.target.value]); event.target.value = ""; }}><option value="">Load preset…</option>{Object.keys(presets).map((name) => <option key={name}>{name}</option>)}</select>
      <button type="button" onClick={() => setPoints([])}>Clear points</button>
    </div>
    <div className="cluster-plot-wrap">
      <canvas ref={canvasRef} className="cluster-plot" width="520" height="330" onPointerDown={addPoint} aria-label="Interactive K-means plot. Click or tap to add a data point." />
      <svg className="cluster-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {points.map((point, index) => <circle key={`${point.x}-${point.y}-${index}`} cx={point.x} cy={point.y} r="1.5" fill={colours[result.labels[index] ?? 0]} />)}
        {result.centroids.map((centroid, index) => <g key={`centroid-${index}`}><circle cx={centroid.x} cy={centroid.y} r="3.2" fill="#101010" stroke={colours[index]} strokeWidth="1.3" /><path d={`M ${centroid.x - 1.8} ${centroid.y} H ${centroid.x + 1.8} M ${centroid.x} ${centroid.y - 1.8} V ${centroid.y + 1.8}`} stroke={colours[index]} strokeWidth=".8" /></g>)}
      </svg>
    </div>
    <p className="sandbox-note">{points.length ? `${points.length} points · centroids shown as crosses` : "Add a few points to begin."}</p>
  </article>;
}
