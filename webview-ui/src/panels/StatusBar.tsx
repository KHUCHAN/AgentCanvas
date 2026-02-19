type StatusBarProps = {
  skills: number;
  rules: number;
  errors: number;
  warnings: number;
  focus: string;
  agents: number;
  tasks: number;
  done: number;
  failed: number;
  flowName: string;
  canvasView: string;
  runId?: string;
  costUsd: number;
  cacheSavedRate: number;
  contextUsed: number;
  contextThreshold: number;
  contextState: "ok" | "warn" | "danger";
  showBuildNew: boolean;
  onBuildNew: () => void;
};

export default function StatusBar(props: StatusBarProps) {
  return (
    <div className="status-bar">
      <span>Skills {props.skills}</span>
      <span>Rules {props.rules}</span>
      <span>Errors {props.errors}</span>
      <span>Warnings {props.warnings}</span>
      <span>Focus {props.focus}</span>
      <span>Agents {props.agents}</span>
      <span>Tasks {props.tasks}</span>
      <span>Done {props.done}</span>
      <span>Failed {props.failed}</span>
      <span>Cost ${props.costUsd.toFixed(3)} ({Math.round(props.cacheSavedRate * 100)}% saved)</span>
      <span className={`context-meter ${props.contextState}`}>
        Context {formatTokenCount(props.contextUsed)}/{formatTokenCount(props.contextThreshold)}
      </span>
      <span>Flow {props.flowName}</span>
      <span>View {props.canvasView}</span>
      <span>Run {props.runId ?? "-"}</span>
      {props.showBuildNew && (
        <button type="button" className="status-build-new" onClick={props.onBuildNew}>
          Build New
        </button>
      )}
    </div>
  );
}

function formatTokenCount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0";
  }
  if (value >= 1000) {
    return `${Math.round(value / 1000)}k`;
  }
  return String(Math.round(value));
}
