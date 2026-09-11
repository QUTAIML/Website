import { useEffect, useRef, useState } from "react";

type Algorithm = "bfs" | "dijkstra" | "astar";
type Traffic = "clear" | "busy";
type Intersection = { id: string; x: number; y: number; column: number; row: number; label?: string };
type Road = { from: string; to: string; cost: number; congested: boolean; arterial: boolean };
type RouteResult = { visited: string[]; path: string[]; time: number };

const columns = 12;
const rows = 8;
const nodeId = (column: number, row: number) => `i${column}-${row}`;

const landmarkNames: Record<string, string> = {
  [nodeId(0, 6)]: "Campus gate",
  [nodeId(2, 2)]: "Library",
  [nodeId(3, 6)]: "Garden walk",
  [nodeId(5, 3)]: "Tech labs",
  [nodeId(6, 5)]: "City plaza",
  [nodeId(8, 1)]: "Station",
  [nodeId(8, 6)]: "Riverside",
  [nodeId(10, 3)]: "Market",
  [nodeId(10, 6)]: "Museum",
  [nodeId(11, 1)]: "Innovation hub",
};

const intersections: Intersection[] = Array.from({ length: rows * columns }, (_, index) => {
  const column = index % columns;
  const row = Math.floor(index / columns);
  return {
    id: nodeId(column, row),
    column,
    row,
    x: 4 + (column / (columns - 1)) * 92,
    y: 8 + (row / (rows - 1)) * 84,
    label: landmarkNames[nodeId(column, row)],
  };
});

const roads: Road[] = [];
for (let row = 0; row < rows; row += 1) {
  for (let column = 0; column < columns; column += 1) {
    if (column < columns - 1) {
      const arterial = row === 2 || row === 5;
      roads.push({
        from: nodeId(column, row), to: nodeId(column + 1, row),
        cost: arterial ? 1 : 1 + ((column + row) % 3),
        congested: arterial && column >= 3 && column <= 8,
        arterial,
      });
    }
    if (row < rows - 1) {
      const arterial = column === 3 || column === 7 || column === 10;
      roads.push({
        from: nodeId(column, row), to: nodeId(column, row + 1),
        cost: arterial ? 1 : 1 + ((column * 2 + row) % 3),
        congested: arterial && row >= 1 && row <= 5,
        arterial,
      });
    }
  }
}

const startId = nodeId(0, 6);
const goalId = nodeId(11, 1);
const byId = Object.fromEntries(intersections.map((node) => [node.id, node]));
const labelFor = (id: string) => byId[id].label ?? "City intersection";

function roadBetween(from: string, to: string) {
  return roads.find((road) => (road.from === from && road.to === to) || (road.from === to && road.to === from));
}

function roadCost(from: string, to: string, traffic: Traffic) {
  const road = roadBetween(from, to);
  return road ? road.cost * (traffic === "busy" && road.congested ? 3 : 1) : Infinity;
}

function neighbours(id: string, traffic: Traffic) {
  return roads.flatMap((road) => {
    if (road.from === id) return [{ id: road.to, cost: roadCost(road.from, road.to, traffic) }];
    if (road.to === id) return [{ id: road.from, cost: roadCost(road.from, road.to, traffic) }];
    return [];
  });
}

function estimate(id: string) {
  const node = byId[id];
  const goal = byId[goalId];
  return Math.abs(node.column - goal.column) + Math.abs(node.row - goal.row);
}

function routeTime(path: string[], traffic: Traffic) {
  return path.slice(1).reduce((time, node, index) => time + roadCost(path[index], node, traffic), 0);
}

function search(algorithm: Algorithm, traffic: Traffic): RouteResult {
  const open = [{ id: startId, rank: 0, driveTime: 0 }];
  const best = new Map([[startId, 0]]);
  const parent = new Map<string, string>();
  const visited: string[] = [];

  while (open.length) {
    if (algorithm !== "bfs") open.sort((a, b) => a.rank + (algorithm === "astar" ? estimate(a.id) : 0) - b.rank - (algorithm === "astar" ? estimate(b.id) : 0));
    const current = open.shift()!;
    if (current.rank !== best.get(current.id)) continue;
    visited.push(current.id);
    if (current.id === goalId) {
      const path = [goalId];
      let cursor = goalId;
      while (parent.has(cursor)) { cursor = parent.get(cursor)!; path.unshift(cursor); }
      return { visited, path, time: routeTime(path, traffic) };
    }
    for (const next of neighbours(current.id, traffic)) {
      const rank = current.rank + (algorithm === "bfs" ? 1 : next.cost);
      if (rank < (best.get(next.id) ?? Infinity)) {
        best.set(next.id, rank);
        parent.set(next.id, current.id);
        open.push({ id: next.id, rank, driveTime: current.driveTime + next.cost });
      }
    }
  }
  return { visited, path: [], time: 0 };
}

export default function MazePathfindingDemo() {
  const [traffic, setTraffic] = useState<Traffic>("clear");
  const [algorithm, setAlgorithm] = useState<Algorithm>("astar");
  const [speed, setSpeed] = useState(64);
  const [player, setPlayer] = useState(startId);
  const [manualRoute, setManualRoute] = useState([startId]);
  const [manualTime, setManualTime] = useState(0);
  const [visited, setVisited] = useState<string[]>([]);
  const [frontier, setFrontier] = useState<string[]>([]);
  const [solution, setSolution] = useState<string[]>([]);
  const [result, setResult] = useState<{ explored: number; time: number } | null>(null);
  const [comparison, setComparison] = useState<Array<{ name: string; explored: number; time: number }>>([]);
  const [message, setMessage] = useState("Start at Campus gate. Follow any connected road, then compare your route with a pathfinding algorithm.");
  const timer = useRef<number>();

  useEffect(() => () => window.clearInterval(timer.current), []);

  const reset = (nextTraffic = traffic) => {
    window.clearInterval(timer.current);
    setPlayer(startId); setManualRoute([startId]); setManualTime(0); setVisited([]); setFrontier([]); setSolution([]); setResult(null); setComparison([]);
    setMessage(nextTraffic === "busy" ? "Traffic is heavy on orange roads. Try to find a quicker detour through the city." : "Roads are clear. Plan your own route, then compare it with a search algorithm.");
  };

  const move = (next: string) => {
    const cost = roadCost(player, next, traffic);
    if (!Number.isFinite(cost)) { setMessage("Choose a junction connected to your current location."); return; }
    setPlayer(next); setManualRoute((route) => [...route, next]); setManualTime((time) => time + cost);
    if (next === goalId) setMessage("You reached Innovation hub. Now see whether the route planner can improve on your journey.");
  };

  const run = () => {
    window.clearInterval(timer.current);
    const found = search(algorithm, traffic);
    setVisited([]); setFrontier([]); setSolution([]); setResult(null);
    let index = 0;
    const algorithmName = algorithm === "astar" ? "A star" : algorithm === "bfs" ? "Breadth first search" : "Dijkstra";
    setMessage(`${algorithmName} is exploring the city road network.`);
    timer.current = window.setInterval(() => {
      if (index >= found.visited.length) {
        window.clearInterval(timer.current);
        setFrontier([]); setSolution(found.path);
        const completed = { explored: found.visited.length, time: found.time };
        setResult(completed);
        setComparison((items) => [...items.filter((item) => item.name !== algorithm), { name: algorithm, ...completed }]);
        setMessage(`Route found in ${completed.time} minutes after exploring ${completed.explored} junctions.`);
        return;
      }
      setVisited((nodes) => [...nodes, found.visited[index]]);
      setFrontier(found.visited.slice(index + 1, index + 7));
      index += 1;
    }, Math.max(18, 200 - speed * 1.75));
  };

  const pause = () => { window.clearInterval(timer.current); setMessage("Search paused. Run the search again to replay the route exploration."); };
  const onPath = (from: string, to: string, route: string[]) => route.some((node, index) => index > 0 && ((route[index - 1] === from && node === to) || (route[index - 1] === to && node === from)));

  return <article className="sandbox-card city-route-card">
    <div className="sandbox-card-copy"><span>PATHFINDING IN PRACTICE</span><h3>City route planner</h3><p>Navigate a dense city road network yourself, then watch algorithms explore the same streets to find the fastest route.</p></div>
    <div className="sandbox-controls">
      <label>Traffic <select value={traffic} onChange={(event) => { const next = event.target.value as Traffic; setTraffic(next); reset(next); }} aria-label="Traffic conditions"><option value="clear">Clear roads</option><option value="busy">Heavy traffic</option></select></label>
      <button type="button" onClick={() => reset()}>Reset journey</button>
      <label>Algorithm <select value={algorithm} onChange={(event) => setAlgorithm(event.target.value as Algorithm)} aria-label="Pathfinding algorithm"><option value="bfs">Breadth first search</option><option value="dijkstra">Dijkstra fastest route</option><option value="astar">A star fastest route</option></select></label>
      <label>Speed <input type="range" min="1" max="100" value={speed} onChange={(event) => setSpeed(+event.target.value)} aria-label="Search animation speed" /></label>
      <button type="button" onClick={run}>Run search</button><button type="button" onClick={pause}>Pause</button>
    </div>
    <div className="city-map" aria-label="Dense city road map. Select a connected intersection to make your route.">
      <svg className="city-roads" viewBox="0 0 100 100" aria-hidden="true">{roads.map((road) => {
        const from = byId[road.from], to = byId[road.to]; const fastest = onPath(road.from, road.to, solution); const manual = onPath(road.from, road.to, manualRoute);
        return <line key={`${road.from}-${road.to}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} className={`${road.arterial ? "road-arterial" : ""} ${road.congested && traffic === "busy" ? "road-congested" : ""} ${fastest ? "road-fastest" : ""} ${manual ? "road-manual" : ""}`} />;
      })}</svg>
      {intersections.map((node) => <button key={node.id} type="button" onClick={() => move(node.id)} className={`intersection ${node.id === player ? "intersection-player" : ""} ${node.id === startId ? "intersection-start" : ""} ${node.id === goalId ? "intersection-goal" : ""} ${visited.includes(node.id) ? "intersection-visited" : ""} ${frontier.includes(node.id) ? "intersection-frontier" : ""} ${solution.includes(node.id) ? "intersection-solution" : ""}`} style={{ left: `${node.x}%`, top: `${node.y}%` }} aria-label={`${labelFor(node.id)}${node.id === player ? ", current location" : ""}`}><span>{node.id === startId ? "S" : node.id === goalId ? "G" : ""}</span>{node.label && <small>{node.label}</small>}</button>)}
    </div>
    <div className="city-legend"><span><i className="legend-manual" /> Your route</span><span><i className="legend-congested" /> Heavy traffic</span><span><i className="legend-visited" /> Explored</span><span><i className="legend-fastest" /> Fastest route</span></div>
    <div className="metric-row"><b>Your time: {manualTime || "None"}{manualTime ? " min" : ""}</b><b>Explored: {result?.explored ?? "None"}</b><b>Fastest: {result?.time ? `${result.time} min` : "None"}</b></div>
    <p className="sandbox-note" role="status">{message} {result && manualTime ? manualTime === result.time ? "You matched the fastest route." : `The fastest route saves ${Math.max(0, manualTime - result.time)} minutes.` : ""}</p>
    {comparison.length > 1 && <p className="sandbox-note">Comparison: {comparison.map((item) => `${item.name === "astar" ? "A star" : item.name === "bfs" ? "BFS" : "Dijkstra"} ${item.explored} junctions, ${item.time} min`).join(" · ")}</p>}
  </article>;
}
