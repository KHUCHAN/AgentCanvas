import { useMemo, useState } from "react";
import type { AgentProfile, Task } from "../messaging/protocol";

type KanbanColumnId = "todo" | "progress" | "blocked" | "done";

type KanbanViewProps = {
  runId?: string;
  tasks: Task[];
  agents: AgentProfile[];
  selectedTaskId?: string;
  onSelectTask: (taskId?: string) => void;
  onSetTaskStatus?: (taskId: string, status: Task["status"]) => void;
  onPinTask?: (taskId: string, pinned: boolean) => void;
};

const COLUMN_META: Array<{ id: KanbanColumnId; title: string }> = [
  { id: "todo", title: "To Do" },
  { id: "progress", title: "In Progress" },
  { id: "blocked", title: "Blocked" },
  { id: "done", title: "Done" }
];

export default function KanbanView(props: KanbanViewProps) {
  const [dragTaskId, setDragTaskId] = useState<string>();
  const [contextMenu, setContextMenu] = useState<{
    taskId: string;
    x: number;
    y: number;
    pinned: boolean;
  }>();

  const agentNameById = useMemo(
    () => new Map(props.agents.map((agent) => [agent.id, agent.name] as const)),
    [props.agents]
  );

  const taskTitleById = useMemo(
    () => new Map(props.tasks.map((task) => [task.id, task.title] as const)),
    [props.tasks]
  );

  const columns = useMemo(() => {
    const map = new Map<KanbanColumnId, Task[]>([
      ["todo", []],
      ["progress", []],
      ["blocked", []],
      ["done", []]
    ]);

    for (const task of props.tasks) {
      map.get(mapStatusToColumn(task.status))?.push(task);
    }

    for (const tasks of map.values()) {
      tasks.sort((left, right) => {
        const leftPriority = normalizePriority(left.overrides?.priority);
        const rightPriority = normalizePriority(right.overrides?.priority);
        if (leftPriority !== rightPriority) {
          return rightPriority - leftPriority;
        }
        return left.createdAtMs - right.createdAtMs;
      });
    }
    return map;
  }, [props.tasks]);

  if (!props.runId) {
    return (
      <div className="kanban-empty">
        <div className="empty-title">No tasks yet</div>
        <div className="empty-subtitle">Use the Chat panel to ask the orchestrator for work.</div>
      </div>
    );
  }

  if (props.tasks.length === 0) {
    return (
      <div className="kanban-empty">
        <div className="empty-title">Preparing tasks...</div>
        <div className="empty-subtitle">A run is active. Tasks will appear here as the planner expands work.</div>
      </div>
    );
  }

  return (
    <div className="kanban-board" onClick={() => setContextMenu(undefined)}>
      {COLUMN_META.map((column) => {
        const tasks = columns.get(column.id) ?? [];
        return (
          <section key={column.id} className={`kanban-column ${column.id}`}>
            <header className="kanban-column-header">
              <span>{column.title}</span>
              <span className="kanban-column-count">{tasks.length}</span>
            </header>
            <div
              className="kanban-column-body"
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                event.preventDefault();
                const droppedTaskId = event.dataTransfer.getData("application/agentcanvas-task") || dragTaskId;
                if (!droppedTaskId) {
                  return;
                }
                const droppedTask = props.tasks.find((task) => task.id === droppedTaskId);
                if (!droppedTask) {
                  setDragTaskId(undefined);
                  return;
                }
                props.onSetTaskStatus?.(droppedTaskId, mapColumnToStatus(column.id));
                setDragTaskId(undefined);
              }}
            >
              {tasks.map((task) => {
                const priority = priorityLabel(task.overrides?.priority);
                const progress = Math.round((task.progress ?? 0) * 100);
                const deps = task.deps.map((dep) => taskTitleById.get(dep) ?? dep).slice(0, 2);
                const isFailed = task.status === "failed";
                const isBlocked = task.status === "blocked";
                return (
                  <article
                    key={task.id}
                    className={[
                      "kanban-card",
                      props.selectedTaskId === task.id ? "is-selected" : "",
                      isFailed ? "failed" : "",
                      isBlocked ? "blocked" : ""
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => props.onSelectTask(task.id)}
                    draggable
                    onDragStart={(event) => {
                      setDragTaskId(task.id);
                      event.dataTransfer.setData("application/agentcanvas-task", task.id);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setDragTaskId(undefined)}
                    role="button"
                    tabIndex={0}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setContextMenu({
                        taskId: task.id,
                        x: event.clientX,
                        y: event.clientY,
                        pinned: Boolean(task.overrides?.pinned)
                      });
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        props.onSelectTask(task.id);
                      }
                    }}
                  >
                    <div className="kanban-card-title">{task.title}</div>
                    <div className="kanban-card-agent">
                      <span className={`kanban-card-priority ${priority.toLowerCase()}`} />
                      <span>{agentNameById.get(task.agentId) ?? task.agentId}</span>
                      <span className="kanban-card-badge">{priority}</span>
                    </div>
                    {deps.length > 0 && (
                      <div className="kanban-card-deps">
                        deps: {deps.join(", ")}
                        {task.deps.length > deps.length ? " ..." : ""}
                      </div>
                    )}
                    {task.status === "running" && (
                      <div className="kanban-card-progress">
                        <div className="kanban-card-progress-fill" style={{ width: `${progress}%` }} />
                      </div>
                    )}
                    {task.status === "done" && task.actualEndMs && (
                      <div className="kanban-card-meta">
                        Completed {new Date(task.actualEndMs).toLocaleTimeString()}
                      </div>
                    )}
                    {task.status === "failed" && (
                      <div className="kanban-card-meta">Failed{task.blocker?.message ? `: ${task.blocker.message}` : ""}</div>
                    )}
                  </article>
                );
              })}
              {tasks.length === 0 && <div className="kanban-column-empty">No tasks</div>}
            </div>
          </section>
        );
      })}
      {contextMenu && (
        <div
          className="kanban-context-menu"
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              props.onSetTaskStatus?.(contextMenu.taskId, "ready");
              setContextMenu(undefined);
            }}
          >
            Retry task
          </button>
          <button
            type="button"
            onClick={() => {
              props.onPinTask?.(contextMenu.taskId, !contextMenu.pinned);
              setContextMenu(undefined);
            }}
          >
            {contextMenu.pinned ? "Unpin task" : "Pin task"}
          </button>
          <button
            type="button"
            onClick={() => {
              props.onSetTaskStatus?.(contextMenu.taskId, "canceled");
              setContextMenu(undefined);
            }}
          >
            Cancel task
          </button>
        </div>
      )}
    </div>
  );
}

function mapStatusToColumn(status: Task["status"]): KanbanColumnId {
  switch (status) {
    case "planned":
    case "ready":
      return "todo";
    case "running":
      return "progress";
    case "blocked":
      return "blocked";
    case "done":
    case "failed":
    case "canceled":
      return "done";
    default:
      return "todo";
  }
}

function normalizePriority(priority?: number): number {
  if (typeof priority !== "number" || Number.isNaN(priority)) {
    return 1;
  }
  return Math.max(0, Math.min(10, priority));
}

function mapColumnToStatus(columnId: KanbanColumnId): Task["status"] {
  switch (columnId) {
    case "todo":
      return "ready";
    case "progress":
      return "running";
    case "blocked":
      return "blocked";
    case "done":
      return "done";
    default:
      return "ready";
  }
}

function priorityLabel(priority?: number): "High" | "Medium" | "Low" {
  const normalized = normalizePriority(priority);
  if (normalized >= 7) {
    return "High";
  }
  if (normalized >= 4) {
    return "Medium";
  }
  return "Low";
}
