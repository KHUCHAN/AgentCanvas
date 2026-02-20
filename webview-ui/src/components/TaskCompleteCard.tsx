import type { TaskCompleteSummary } from "../messaging/protocol";

type TaskCompleteCardProps = {
  summary: TaskCompleteSummary;
};

export default function TaskCompleteCard(props: TaskCompleteCardProps) {
  return (
    <div className="task-complete-card">
      <div className="item-title">{props.summary.title}</div>
      <div className="item-subtitle">
        Duration: {Math.round(props.summary.durationMs / 1000)}s
        {props.summary.cost !== undefined ? ` · Cost: $${props.summary.cost.toFixed(3)}` : ""}
      </div>
      {props.summary.diffSummary && (
        <div className="task-complete-diff">{props.summary.diffSummary}</div>
      )}
      {props.summary.changedFiles.length > 0 && (
        <div className="node-meta">
          Files: {props.summary.changedFiles.join(", ")}
        </div>
      )}
    </div>
  );
}
