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
      <div className="status-bar-section">
        <span>Agents {props.agents}</span>
        <span>Tasks {props.tasks}</span>
        <span>Done {props.done}</span>
        {props.failed > 0 && <span className="status-error">Failed {props.failed}</span>}
      </div>
      <div className="status-bar-separator" />
      <div className="status-bar-section">
        <span>Cost ${props.costUsd.toFixed(3)}</span>
        <span className="muted">({Math.round(props.cacheSavedRate * 100)}% saved)</span>
      </div>
      <div className="status-bar-separator" />
      <div className="status-bar-section">
        <span className={`context-meter ${props.contextState}`}>
          Context {formatTokenCount(props.contextUsed)}/{formatTokenCount(props.contextThreshold)}
        </span>
      </div>
      <div className="status-bar-separator" />
      <div className="status-bar-section">
        <span>Backends {usageText || "-"}</span>
        {quotaText && <span className="quota-meter">{quotaText}</span>}
      </div>
      <div className="status-bar-fill" />
      <div className="status-bar-section">
        <span>{props.flowName}</span>
        <span className="muted">·</span>
        <span>{props.canvasView}</span>
      </div>
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
