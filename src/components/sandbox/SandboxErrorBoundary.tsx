import { Component, type ErrorInfo, type ReactNode } from "react";
type Props = { children: ReactNode; title: string }; type State = { failed: boolean; message: string };
export default class SandboxErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, message: "" };
  static getDerivedStateFromError(error: Error) { return { failed: true, message: error?.message || "Unknown render error" }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error(`Sandbox demo failed: ${this.props.title}`, error, info.componentStack); }
  render() { return this.state.failed ? <article className="sandbox-card sandbox-error" role="alert"><div className="sandbox-card-copy"><span>DEMO ERROR</span><h3>{this.props.title}</h3><p><code>{this.state.message}</code></p><p>This is a component error, not a browser-capability diagnosis. See the browser console for the component stack.</p></div></article> : this.props.children; }
}
