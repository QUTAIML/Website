import ClusteringVisualizer from "./ClusteringVisualizer";
import DigitClassifier from "./DigitClassifier";
import MazePathfindingDemo from "./MazePathfindingDemo";
import NeuralPlayground from "./NeuralPlayground";
import SandboxErrorBoundary from "./SandboxErrorBoundary";
import "./sandbox.css";
import "./extra-demos.css";

export default function SandboxSection() {
  return (
    <section className="sandbox-section" aria-labelledby="sandbox-title">
      <div className="sandbox-heading">
        <div>
          <p className="sandbox-kicker">LEARN BY DOING</p>
          <h2 id="sandbox-title">ML Sandbox</h2>
        </div>
        <p className="sandbox-heading-copy">Try small machine learning experiences in your browser. Nothing you draw or add leaves your device.</p>
      </div>
      <div className="sandbox-grid">
        <SandboxErrorBoundary title="Clustering visualiser"><ClusteringVisualizer /></SandboxErrorBoundary>
        <SandboxErrorBoundary title="Digit classifier"><DigitClassifier /></SandboxErrorBoundary>
        <SandboxErrorBoundary title="City route planner"><MazePathfindingDemo /></SandboxErrorBoundary>
        <SandboxErrorBoundary title="Decision boundary playground"><NeuralPlayground /></SandboxErrorBoundary>
      </div>
    </section>
  );
}
