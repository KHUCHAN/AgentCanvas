import { DragEvent, useState } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import NodeTypeIcon from "./NodeTypeIcon";

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
};

export default function AgentNode({ data, selected }: NodeProps<AgentNodeData>) {
  const [dropHighlight, setDropHighlight] = useState(false);
  const roleText = data.roleLabel || data.role;

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
      className={`node-card node-agent ${selected ? "is-selected" : ""} ${data.isOrchestrator ? "is-orchestrator" : ""} ${dropHighlight ? "is-drop-target" : ""}`}
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
      <Handle type="source" position={Position.Right} className="agent-handle" />
    </div>
  );
}
