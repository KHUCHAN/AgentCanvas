import { DragEvent, useState } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import NodeTypeIcon from "./NodeTypeIcon";
import taskRunningEffect from "../../assets/effects/agentcanvas_effect_task_running.svg";
import taskDoneEffect from "../../assets/effects/agentcanvas_effect_task_done.svg";
import taskFailedEffect from "../../assets/effects/agentcanvas_effect_task_failed.svg";
import taskBlockedEffect from "../../assets/effects/agentcanvas_effect_task_blocked.svg";
import progressShimmerEffect from "../../assets/effects/agentcanvas_effect_progress_shimmer.svg";

type AgentNodeData = {
  id: string;
  name: string;
  providerId: string;
  avatar?: string;
  role: string;
  roleLabel?: string;
  description?: string;
  isOrchestrator?: boolean;
  skillCount?: number;
  mcpCount?: number;
  color?: string;
  onAssignSkill?: (agentId: string, skillId: string) => void;
  onAssignMcp?: (agentId: string, mcpServerId: string) => void;
  executionState?: "idle" | "thinking" | "working" | "error" | "done" | "blocked";
  currentTask?: string;
  progress?: number;
};

export default function AgentNode({ data, selected }: NodeProps<AgentNodeData>) {
  const [dropHighlight, setDropHighlight] = useState(false);
  const roleText = data.roleLabel || data.role;
  const executionState = data.executionState ?? "idle";
  const progress = normalizeProgress(data.progress);
  const stateIcon = stateIconFor(executionState);
  const stateLabel = stateLabelFor(executionState);
  const stateEffect = stateEffectFor(executionState);
  const showProgress = executionState === "working" || (typeof progress === "number" && progress > 0);

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    const types = event.dataTransfer.types;
    if (
      types.includes("application/agentcanvas-skill") ||
      types.includes("application/agentcanvas-mcp")
    ) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setDropHighlight(true);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDropHighlight(false);

    const skillRaw = event.dataTransfer.getData("application/agentcanvas-skill");
    if (skillRaw) {
      try {
        const parsed = JSON.parse(skillRaw) as { id?: string };
        if (parsed.id && data.onAssignSkill) {
          data.onAssignSkill(data.id, parsed.id);
        }
      } catch {
        // ignore malformed drag payload
      }
    }

    const mcpRaw = event.dataTransfer.getData("application/agentcanvas-mcp");
    if (mcpRaw) {
      try {
        const parsed = JSON.parse(mcpRaw) as { id?: string };
        if (parsed.id && data.onAssignMcp) {
          data.onAssignMcp(data.id, parsed.id);
        }
      } catch {
        // ignore malformed drag payload
      }
    }
  };

  return (
    <div
      className={`node-card node-agent agent-node ${selected ? "is-selected" : ""} ${data.isOrchestrator ? "is-orchestrator" : ""} ${dropHighlight ? "is-drop-target" : ""}`}
      data-state={executionState}
      tabIndex={0}
      role="button"
      aria-label={`Agent: ${data.name}`}
      style={data.color ? { borderLeftColor: data.color } : undefined}
      onKeyDown={(event) => {
        if (event.currentTarget !== event.target) {
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.currentTarget.click();
        }
      }}
      onDragOver={handleDragOver}
      onDragLeave={() => setDropHighlight(false)}
      onDrop={handleDrop}
    >
      <Handle type="target" position={Position.Left} className="agent-handle" />
      <div className="node-header">
        <span className="node-header-label">
          <NodeTypeIcon kind="agent" />
          {data.avatar && <span className="agent-avatar">{data.avatar}</span>}
          {data.isOrchestrator ? "Orchestrator" : "Agent"}
        </span>
        <span className="agent-role-badge">{roleText}</span>
      </div>
      <div className="node-title">{data.name}</div>
      {data.description && <div className="node-desc">{data.description}</div>}
      <div className="node-meta">Skills: {data.skillCount ?? 0} · MCP: {data.mcpCount ?? 0}</div>
      <div className="node-meta">provider: {data.providerId}</div>
      <div className="agent-state-row">
        <span className={`agent-state-pill state-${executionState}`}>
          {stateIcon} {stateLabel}
        </span>
        {data.currentTask && <span className="agent-current-task">{data.currentTask}</span>}
      </div>
      {showProgress && (
        <div className="agent-node-progress">
          <div className="agent-node-progress-fill" style={{ width: `${progress ?? 0}%` }} />
          {executionState === "working" && (
            <img
              src={progressShimmerEffect}
              className="agent-node-progress-shimmer"
              alt=""
              aria-hidden="true"
            />
          )}
        </div>
      )}
      {stateEffect && (
        <img
          src={stateEffect}
          className={`agent-state-effect state-${executionState}`}
          alt=""
          aria-hidden="true"
        />
      )}
      <Handle type="source" position={Position.Right} className="agent-handle" />
    </div>
  );
}

function normalizeProgress(progress?: number): number | undefined {
  if (typeof progress !== "number" || Number.isNaN(progress)) {
    return undefined;
  }
  const value = progress <= 1 ? progress * 100 : progress;
  return Math.max(0, Math.min(100, value));
}

function stateIconFor(state: AgentNodeData["executionState"]): string {
  switch (state) {
    case "thinking":
      return "THINK";
    case "working":
      return "RUN";
    case "error":
      return "ERR";
    case "done":
      return "DONE";
    case "blocked":
      return "WAIT";
    case "idle":
    default:
      return "IDLE";
  }
}

function stateLabelFor(state: AgentNodeData["executionState"]): string {
  switch (state) {
    case "thinking":
      return "thinking";
    case "working":
      return "working";
    case "error":
      return "error";
    case "done":
      return "done";
    case "blocked":
      return "blocked";
    case "idle":
    default:
      return "idle";
  }
}

function stateEffectFor(state: AgentNodeData["executionState"]): string | undefined {
  if (state === "working") {
    return taskRunningEffect;
  }
  if (state === "done") {
    return taskDoneEffect;
  }
  if (state === "error") {
    return taskFailedEffect;
  }
  if (state === "blocked") {
    return taskBlockedEffect;
  }
  return undefined;
}
