import type { NodeProps } from "reactflow";
import NodeTypeIcon from "./NodeTypeIcon";

type SystemNodeData = {
  id: string;
  name: string;
  role?: string;
  description?: string;
};

export default function SystemNode({ data, selected }: NodeProps<SystemNodeData>) {
  return (
    <div
      className={`node-card node-system ${selected ? "is-selected" : ""}`}
      tabIndex={0}
      role="button"
      aria-label={`System node: ${data.name}`}
    >
      <div className="node-header">
        <span className="node-header-label">
          <NodeTypeIcon kind="system" />
          System
        </span>
        {data.role && <span className="provider-badge">{data.role}</span>}
      </div>
      <div className="node-title">{data.name}</div>
      {data.description && <div className="node-desc">{data.description}</div>}
      <div className="node-meta">Control plane / coordination</div>
    </div>
  );
}
