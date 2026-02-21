import type { BackendUsageSummary, ClaudeQuotaSnapshot } from "../messaging/protocol";

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
  backendUsageSummaries: BackendUsageSummary[];
  claudeQuota?: ClaudeQuotaSnapshot;
  showBuildNew: boolean;
  onBuildNew: () => void;
};

export default function StatusBar(props: StatusBarProps) {
  const usageText = props.backendUsageSummaries
    .slice()
    .sort((left, right) => backendOrder(left.backendId) - backendOrder(right.backendId))
    .map((summary) => `${shortBackendName(summary.backendId)} ${Math.round((1 - summary.availabilityScore) * 100)}%`)
    .join(" · ");

  const quotaText = buildQuotaText(props.claudeQuota);

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
      <span>Backends {usageText || "-"}</span>
      {quotaText && <span className="quota-meter">{quotaText}</span>}
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

function buildQuotaText(quota: ClaudeQuotaSnapshot | undefined): string {
  if (!quota) {
    return "";
  }
  const parts: string[] = [];
  if (quota.sessionUsedPct > 0) {
    parts.push(`Session ${quota.sessionUsedPct}%`);
  }
  if (quota.weekAllUsedPct > 0) {
    parts.push(`Week ${quota.weekAllUsedPct}%`);
  }
  if (parts.length === 0) {
    return "";
  }
  return `Claude: ${parts.join(" · ")}`;
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

function backendOrder(backendId: BackendUsageSummary["backendId"]): number {
  if (backendId === "claude") {
    return 0;
  }
  if (backendId === "codex") {
    return 1;
  }
  if (backendId === "gemini") {
    return 2;
  }
  if (backendId === "aider") {
    return 3;
  }
  return 4;
}

function shortBackendName(backendId: BackendUsageSummary["backendId"]): string {
  if (backendId === "claude") {
    return "C";
  }
  if (backendId === "codex") {
    return "X";
  }
  if (backendId === "gemini") {
    return "G";
  }
  if (backendId === "aider") {
    return "A";
  }
  return "U";
}
