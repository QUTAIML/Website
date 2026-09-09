import { useEffect, useRef, useState } from "react";

type Kind = "rings" | "clusters" | "moons" | "xor" | "linear" | "custom";
type Point = { x: number; y: number; label: number };
const palette = ["#00b8d9", "#ff7ac8"];

function dataset(kind: Kind): Point[] {
  if (kind === "custom") return [];
  return Array.from({ length: 100 }, (_, index) => {
    const label = index % 2, jitter = () => (Math.random() - .5) * .1;
    if (kind === "rings") { const r = label ? .18 : .42, a = Math.random() * Math.PI * 2; return { x: .5 + Math.cos(a) * (r + jitter()), y: .5 + Math.sin(a) * (r + jitter()), label }; }
    if (kind === "moons") { const a = Math.random() * Math.PI; return label ? { x: .5 + Math.cos(a) * .27 + jitter(), y: .62 - Math.sin(a) * .27 + jitter(), label } : { x: .5 - Math.cos(a) * .27 + jitter(), y: .38 + Math.sin(a) * .27 + jitter(), label }; }
    if (kind === "xor") { const x = Math.random() * .8 + .1, y = Math.random() * .8 + .1; return { x, y, label: (x > .5) === (y > .5) ? 0 : 1 }; }
    if (kind === "linear") { const x = Math.random() * .8 + .1, y = Math.random() * .8 + .1; return { x, y, label: y > .55 * x + .22 ? 1 : 0 }; }
    return { x: (label ? .7 : .3) + (Math.random() - .5) * .28, y: (label ? .7 : .3) + (Math.random() - .5) * .28, label };
  });
}

function paint(canvas: HTMLCanvasElement | null, points: Point[], values?: number[]) {
  const ctx = canvas?.getContext("2d"); if (!canvas || !ctx) return;
  ctx.fillStyle = "#101b38"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (values) for (let y = 0; y < 36; y++) for (let x = 0; x < 54; x++) { const v = values[y * 54 + x]; ctx.fillStyle = v > .5 ? `rgba(255,122,200,${.12 + Math.abs(v-.5)})` : `rgba(0,184,217,${.12 + Math.abs(v-.5)})`; ctx.fillRect(x * canvas.width / 54, y * canvas.height / 36, canvas.width / 54 + 1, canvas.height / 36 + 1); }
  points.forEach(point => { ctx.fillStyle = palette[point.label]; ctx.beginPath(); ctx.arc(point.x * canvas.width, point.y * canvas.height, 4, 0, Math.PI * 2); ctx.fill(); });
}

export default function NeuralPlayground() {
  const canvas = useRef<HTMLCanvasElement>(null), lab = useRef<any>({}), run = useRef(0);
  const [kind, setKind] = useState<Kind>("rings"), [rate, setRate] = useState(.05), [optimizer, setOptimizer] = useState("adam"), [playing, setPlaying] = useState(false), [epoch, setEpoch] = useState(0), [train, setTrain] = useState(0), [status, setStatus] = useState("Ready. Choose a shape, then press Play or Step.");
  const setup = async (keep = false) => { const tf = await import("@tensorflow/tfjs"); await tf.ready(); const points = keep ? lab.current.points : dataset(kind), id = ++run.current; const model = tf.sequential({ name: `boundary_lab_${id}` }); model.add(tf.layers.dense({ units: 8, activation: "tanh", inputShape: [2], name: `hidden_${id}` })); model.add(tf.layers.dense({ units: 1, activation: "sigmoid", name: `output_${id}` })); model.compile({ optimizer: optimizer === "sgd" ? tf.train.sgd(rate) : optimizer === "momentum" ? tf.train.momentum(rate, .8) : tf.train.adam(rate), loss: "binaryCrossentropy" }); lab.current = { tf, model, points, train: points }; paint(canvas.current, points); setEpoch(0); setTrain(0); };
  const step = async () => { const current = lab.current; if (!current?.train?.length) return; const { tf, model, points } = current, xs = tf.tensor2d(current.train.flatMap((p: Point) => [p.x,p.y]), [current.train.length,2]), ys = tf.tensor2d(current.train.map((p: Point) => p.label), [current.train.length,1]); await model.fit(xs, ys, { epochs: 1, batchSize: Math.min(24,current.train.length), shuffle: true }); xs.dispose(); ys.dispose(); const score = async (rows:Point[]) => { const input=tf.tensor2d(rows.flatMap(p=>[p.x,p.y]),[rows.length,2]), output=model.predict(input), values=Array.from(await output.data()) as number[]; input.dispose(); output.dispose(); return values.filter((v,i)=>(v>.5?1:0)===rows[i].label).length/rows.length; }; const grid=Array.from({length:1944},(_,i)=>[(i%54)/53,Math.floor(i/54)/35]).flat(), input=tf.tensor2d(grid,[1944,2]), output=model.predict(input), values=Array.from(await output.data()) as number[]; input.dispose();output.dispose();paint(canvas.current,points,values);setTrain(await score(current.train));setEpoch(n=>n+1); };
  useEffect(()=>{setup().catch(error=>setStatus(`Setup error: ${error.message}`));},[kind,rate,optimizer]); useEffect(()=>{if(!playing)return;let cancelled=false;const loop=async()=>{try{await step();if(!cancelled)setTimeout(loop,50)}catch(error){setPlaying(false);setStatus(`Training error: ${error instanceof Error?error.message:"unknown error"}`)}};loop();return()=>{cancelled=true};},[playing]);
  const add = (event:React.PointerEvent<HTMLCanvasElement>) => { if(kind!=="custom") return; const box=event.currentTarget.getBoundingClientRect(), point={x:(event.clientX-box.left)/box.width,y:(event.clientY-box.top)/box.height,label:event.shiftKey?1:0}; lab.current.points=[...(lab.current.points||[]),point]; setup(true); };
  return <article className="sandbox-card neural-lab"><div className="sandbox-card-copy"><span>NEURAL NETWORK</span><h3>Decision boundary playground</h3><p>Choose a point shape. Cyan is class 0 and pink is class 1; in Custom mode click for cyan and Shift-click for pink.</p></div><div className="sandbox-controls"><button onClick={()=>setPlaying(true)}>Play</button><button onClick={()=>setPlaying(false)}>Pause</button><button onClick={()=>step().catch(error=>setStatus(`Training error: ${error.message}`))}>Step</button><button onClick={()=>setup(true)}>Reset</button></div><canvas ref={canvas} onPointerDown={add} className="boundary-canvas" width="440" height="280" aria-label="Decision boundary canvas"/><div className="metric-row"><b>Epoch {epoch}</b><b>Training accuracy {(train*100).toFixed(0)}%</b></div><div className="play-controls"><label>Dataset <select value={kind} onChange={event=>setKind(event.target.value as Kind)}><option value="rings">Circle in ring</option><option value="clusters">Two clusters</option><option value="moons">Two moons</option><option value="xor">XOR diagonals</option><option value="linear">Linear split</option><option value="custom">Custom points</option></select></label><label title="How large each learning update is">Learning rate <input type="range" min=".01" max=".2" step=".01" value={rate} onChange={event=>setRate(+event.target.value)}/></label><label>Optimizer <select value={optimizer} onChange={event=>setOptimizer(event.target.value)}><option value="adam">Adam</option><option value="momentum">Momentum</option><option value="sgd">Gradient descent</option></select></label></div><p className="sandbox-note" role="status">{status}</p></article>;
}
