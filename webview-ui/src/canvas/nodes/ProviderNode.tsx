import type { NodeProps } from "reactflow";
import NodeTypeIcon from "./NodeTypeIcon";

type ProviderNodeData = {
  key: "gpt" | "claude" | "gemini";
  label: string;
  badge: string;
  tone: "teal" | "amber" | "blue";
  active: boolean;
  skillCount: number;
  ruleCount: number;
};

export default function ProviderNode({ data, selected }: NodeProps<ProviderNodeData>) {
  return (
    <div
      className={`node-card node-provider tone-${data.tone} ${selected ? "is-selected" : ""} ${
        data.active ? "is-active" : "is-inactive"
      }`}
      tabIndex={0}
      role="button"
      aria-label={`Provider: ${data.label}`}
    >
      <div className="node-header">
        <span className="node-header-label">
          <NodeTypeIcon kind="provider" />
          Provider
        </span>
        <span className="provider-badge">{data.badge}</span>
      </div>
      <div className="node-title">{data.label}</div>
      <div className="node-provider-stats">
        <span>skills {data.skillCount}</span>
        <span>rules {data.ruleCount}</span>
      </div>
      <div className="node-meta">{data.active ? "active" : "waiting"}</div>
    </div>
  );
}
