import { useMemo, useState } from "react";
import type { AgentProfile, RunSummary, Task } from "../messaging/protocol";

export type TaskPanelOptions = {
  priority: "high" | "medium" | "low";
  assignTo: string | "auto";
};

type TaskPanelProps = {
  agents: AgentProfile[];
  tasks: Task[];
  runHistory: RunSummary[];
  activeRunId?: string;
  onRunTask: (prompt: string, options: TaskPanelOptions) => Promise<void>;
  onCancelTask: (taskId: string) => void;
  onViewTaskDetail: (taskId: string) => void;
};

export default function TaskPanel(props: TaskPanelProps) {
  const [instruction, setInstruction] = useState("");
  const [priority, setPriority] = useState<TaskPanelOptions["priority"]>("medium");
  const [assignTo, setAssignTo] = useState<TaskPanelOptions["assignTo"]>("auto");
  const [submitting, setSubmitting] = useState(false);

  const activeTasks = useMemo(
    () =>
      props.tasks
        .filter((task) => task.status === "planned" || task.status === "ready" || task.status === "running" || task.status === "blocked")
        .sort((left, right) => {
          if (left.status !== right.status) {
            return statusRank(left.status) - statusRank(right.status);
          }
          return right.updatedAtMs - left.updatedAtMs;
        }),
    [props.tasks]
  );

  const completedTasks = useMemo(
    () =>
      props.tasks
        .filter((task) => task.status === "done" || task.status === "failed" || task.status === "canceled")
        .sort((left, right) => (right.actualEndMs ?? right.updatedAtMs) - (left.actualEndMs ?? left.updatedAtMs))
        .slice(0, 24),
    [props.tasks]
  );

  const recentRuns = useMemo(
    () => [...props.runHistory].sort((left, right) => right.startedAt - left.startedAt).slice(0, 14),
    [props.runHistory]
  );

  const agentNameById = useMemo(
    () => new Map(props.agents.map((agent) => [agent.id, agent.name] as const)),
    [props.agents]
  );

  const submit = async () => {
    const prompt = instruction.trim();
    if (!prompt || submitting) {
      return;
    }
    setSubmitting(true);
    try {
      await props.onRunTask(prompt, {
        priority,
        assignTo
      });
      setInstruction("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="panel-content task-panel-content" id="right-panel-task" role="tabpanel">
      <div className="inspector-block">
        <div className="inspector-title">Work</div>
        <textarea
          className="task-panel-input"
          rows={4}
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder="e.g. Review PR #42 and produce concrete code quality improvements."
        />
        <div className="task-panel-row">
          <label htmlFor="task-priority">Priority</label>
          <select
            id="task-priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value as TaskPanelOptions["priority"])}
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div className="task-panel-row">
          <label htmlFor="task-assignee">Assign to</label>
          <select
            id="task-assignee"
            value={assignTo}
            onChange={(event) => setAssignTo(event.target.value)}
          >
            <option value="auto">Auto (Orchestrator)</option>
            {props.agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </div>
        <div className="task-panel-actions">
          <button
            type="button"
            className={`task-panel-primary ${submitting ? "is-busy-shimmer" : ""}`}
            onClick={() => void submit()}
            disabled={submitting || !instruction.trim()}
          >
            {submitting ? "Submitting..." : "Submit Work"}
          </button>
          <span className="muted">{props.activeRunId ? `Running ${props.activeRunId}` : "Idle"}</span>
        </div>
      </div>

      <div className="inspector-block">
        <div className="inspector-title">Active Tasks</div>
        <div className="task-panel-list">
          {activeTasks.map((task) => (
            <div key={task.id} className={`task-panel-item status-${task.status}`}>
              <button type="button" className="task-panel-item-main" onClick={() => props.onViewTaskDetail(task.id)}>
                <div className="item-title">{task.title}</div>
                <div className="item-subtitle">
                  {agentNameById.get(task.agentId) ?? task.agentId} · {task.status}
                </div>
                {typeof task.progress === "number" && task.status === "running" && (
                  <div className="task-panel-progress">
                    <div
                      className="task-panel-progress-fill"
                      style={{ width: `${Math.round(task.progress * 100)}%` }}
                    />
                  </div>
                )}
              </button>
              {(task.status === "running" || task.status === "planned" || task.status === "ready") && (
                <button type="button" onClick={() => props.onCancelTask(task.id)}>
                  Cancel
                </button>
              )}
            </div>
          ))}
          {activeTasks.length === 0 && <div className="muted">No active tasks.</div>}
        </div>
      </div>

      <div className="inspector-block">
        <div className="inspector-title">History</div>
        <div className="task-panel-history">
          {completedTasks.map((task) => (
            <button key={task.id} type="button" className="task-panel-history-item" onClick={() => props.onViewTaskDetail(task.id)}>
              <div className="item-title">{task.title}</div>
              <div className="item-subtitle">
                {statusIcon(task.status)} {task.status}
                {task.actualEndMs ? ` · ${new Date(task.actualEndMs).toLocaleTimeString()}` : ""}
              </div>
            </button>
          ))}
          {completedTasks.length === 0 && <div className="muted">No completed tasks.</div>}
        </div>
      </div>

      <div className="inspector-block">
        <div className="inspector-title">Recent Runs</div>
        <div className="task-panel-history">
          {recentRuns.map((run) => (
            <div key={run.runId} className="task-panel-history-item">
              <div className="item-title">{run.runName || run.runId}</div>
              <div className="item-subtitle">
                {new Date(run.startedAt).toLocaleString()} · {run.status}
              </div>
            </div>
          ))}
          {recentRuns.length === 0 && <div className="muted">No run history.</div>}
        </div>
      </div>
    </div>
  );
}

function statusRank(status: Task["status"]): number {
  if (status === "running") {
    return 0;
  }
  if (status === "blocked") {
    return 1;
  }
  if (status === "ready") {
    return 2;
  }
  if (status === "planned") {
    return 3;
  }
  return 4;
}

function statusIcon(status: Task["status"]): string {
  if (status === "done") {
    return "OK";
  }
  if (status === "failed") {
    return "ERR";
  }
  if (status === "canceled") {
    return "CANCEL";
  }
  return status.toUpperCase();
}
