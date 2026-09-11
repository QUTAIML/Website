import { useEffect, useRef, useState, type PointerEvent } from "react";

type Tf = typeof import("@tensorflow/tfjs");
const emptyScores = Array.from({ length: 10 }, () => 0);
const modelUrl = `${import.meta.env.BASE_URL}models/mnist/model.json`;

export default function DigitClassifier() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<Awaited<ReturnType<Tf["loadLayersModel"]>> | null>(null);
  const tfRef = useRef<Tf | null>(null);
  const drawing = useRef(false);
  const [status, setStatus] = useState("Loading digit model…");
  const [scores, setScores] = useState(emptyScores);

  const clear = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.fillStyle = "#000";
    context.fillRect(0, 0, canvas.width, canvas.height);
    setScores(emptyScores);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const tf = await import("@tensorflow/tfjs");
        await tf.ready();
        const model = await tf.loadLayersModel(modelUrl);
        const inputShape = model.inputs[0]?.shape;
        if (inputShape?.join(",") !== ",28,28,1") {
          throw new Error(`Unexpected MNIST model input shape: ${inputShape}`);
        }
        if (!alive) {
          model.dispose();
          return;
        }
        tfRef.current = tf;
        modelRef.current = model;
        setStatus("Draw a single digit from 0 to 9");
      } catch (error) {
        console.error("Unable to load the AIML digit classifier", error);
        if (alive) setStatus("The digit model could not load. Please refresh or try a modern browser.");
      }
    })();
    return () => {
      alive = false;
      modelRef.current?.dispose();
    };
  }, []);

  useEffect(clear, []);

  const predict = async () => {
    const canvas = canvasRef.current;
    const tf = tfRef.current;
    const model = modelRef.current;
    if (!canvas || !tf || !model) {
      setStatus("Model is still loading. Please try again in a moment.");
      return;
    }

    try {
      const output = tf.tidy(() => {
        // MNIST expects a 28×28 grayscale tensor: white digit on black, 0–1, NHWC.
        const input = tf.browser
          .fromPixels(canvas, 1)
          .toFloat()
          .div(255)
          .resizeBilinear([28, 28])
          .reshape([1, 28, 28, 1]);
        return model.predict(input) as import("@tensorflow/tfjs").Tensor;
      });
      const values = Array.from(await output.data());
      output.dispose();
      setScores(values);
      setStatus("Draw another digit or clear the canvas");
    } catch (error) {
      console.error("AIML digit classifier prediction failed", error);
      setStatus("Prediction failed. Please clear the canvas and try again.");
    }
  };

  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * canvas.width) / rect.width,
      y: ((event.clientY - rect.top) * canvas.height) / rect.height,
    };
  };

  const drawAt = (event: PointerEvent<HTMLCanvasElement>) => {
    const p = point(event);
    const context = canvasRef.current!.getContext("2d")!;
    context.fillStyle = "#fff";
    context.beginPath();
    context.arc(p.x, p.y, 12, 0, Math.PI * 2);
    context.fill();
  };

  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!modelRef.current) {
      setStatus("Model is still loading. Please try again in a moment.");
      return;
    }
    drawing.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawAt(event);
  };

  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (drawing.current) drawAt(event);
  };

  const stop = () => {
    if (!drawing.current) return;
    drawing.current = false;
    void predict();
  };

  const best = scores.indexOf(Math.max(...scores));
  return (
    <article className="sandbox-card">
      <div className="sandbox-card-copy">
        <span>CNN</span><h3>Live digit classifier</h3>
        <p>Draw one large, centred digit. A small CNN trained on MNIST runs its prediction locally in your browser.</p>
      </div>
      <div className="digit-layout">
        <div>
          <canvas ref={canvasRef} className="digit-canvas" width="280" height="280" onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} aria-label="Draw a digit between zero and nine" />
          <div className="digit-actions"><button type="button" onClick={clear}>Clear drawing</button><span role="status">{status}</span></div>
        </div>
        <div className="prediction-panel" aria-live="polite">
          <p>Prediction</p><strong>{scores.some(Boolean) ? best : "None"}</strong>
          {scores.map((score, digit) => <div className="confidence" key={digit}><span>{digit}</span><i><b style={{ width: `${Math.round(score * 100)}%` }} /></i><em>{Math.round(score * 100)}%</em></div>)}
        </div>
      </div>
    </article>
  );
}
