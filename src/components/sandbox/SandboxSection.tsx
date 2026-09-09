import ClusteringVisualizer from "./ClusteringVisualizer";
import DigitClassifier from "./DigitClassifier";
import "./sandbox.css";

export default function SandboxSection() {
  return (
    <section className="sandbox-section" aria-labelledby="sandbox-title">
      <div className="sandbox-heading">
        <p className="sandbox-kicker">LEARN BY DOING</p>
        <h2 id="sandbox-title">ML Sandbox</h2>
        <p>Try two small machine-learning experiences in your browser. Nothing you draw or add leaves your device.</p>
      </div>
      <div className="sandbox-grid">
        <ClusteringVisualizer />
        <DigitClassifier />
      </div>
    </section>
  );
}
