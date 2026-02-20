import type { TaskStatusUpdate } from "../messaging/protocol";

type TaskStatusCardProps = {
  update: TaskStatusUpdate;
  onStopTask?: (taskId: string) => Promise<void>;
};

export default function TaskStatusCard(props: TaskStatusCardProps) {
  const progressPercent = Math.max(
    0,
    Math.min(100, Math.round((props.update.progress <= 1 ? props.update.progress * 100 : props.update.progress)))
  );

  return (
    <div className="task-status-card">
      <div className="item-title">{props.update.title}</div>
      <div className="task-status-agent">
        {props.update.agentName} · {props.update.backendId} · {props.update.status}
      </div>
      {props.update.message && <div className="item-subtitle">{props.update.message}</div>}
      <div className="task-status-progress">
        <div className="task-status-progress-fill" style={{ width: `${progressPercent}%` }} />
      </div>
      {props.update.status === "running" && props.onStopTask && (
        <div className="work-plan-actions">
          <button type="button" onClick={() => void props.onStopTask?.(props.update.taskId)}>
            Stop task
          </button>
        </div>
      )}
    </div>
  );
}
