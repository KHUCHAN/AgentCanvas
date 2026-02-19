import type { NodeProps } from "reactflow";
import NodeTypeIcon from "./NodeTypeIcon";

type SystemNodeData = {
  id: string;
  name: string;
  role?: string;
  description?: string;
  kind?: "judge" | "blackboard" | "router" | "broker" | "coordinator" | "gateway" | "custom";
  status?: "active" | "idle" | "paused";
};

export default function SystemNode({ data, selected }: NodeProps<SystemNodeData>) {
  const kind = data.kind ?? inferKind(data.role);
  const kindMeta = KIND_META[kind];
  const status = data.status ?? "active";

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
      <div className="node-system-badges">
        <span className={`node-system-kind kind-${kind}`}>
          <span aria-hidden>{kindMeta.icon}</span>
          <span>{kindMeta.label}</span>
        </span>
        <span className={`node-system-status status-${status}`}>{status}</span>
      </div>
      {data.description && <div className="node-desc">{data.description}</div>}
      <div className="node-meta">Control plane / coordination</div>
    </div>
  );
}

const KIND_META: Record<
  NonNullable<SystemNodeData["kind"]>,
  { label: string; icon: string }
> = {
  judge: { label: "Judge", icon: "⚖" },
  blackboard: { label: "Blackboard", icon: "▦" },
  router: { label: "Router", icon: "⇄" },
  broker: { label: "Broker", icon: "↹" },
  coordinator: { label: "Coordinator", icon: "◎" },
  gateway: { label: "Gateway", icon: "⎋" },
  custom: { label: "Custom", icon: "◈" }
};

function inferKind(role: string | undefined): NonNullable<SystemNodeData["kind"]> {
  const normalized = role?.trim().toLowerCase() ?? "";
  if (normalized.includes("judge")) {
    return "judge";
  }
  if (normalized.includes("blackboard")) {
    return "blackboard";
  }
  if (normalized.includes("router")) {
    return "router";
  }
  if (normalized.includes("broker")) {
    return "broker";
  }
  if (normalized.includes("gateway")) {
    return "gateway";
  }
  if (normalized.includes("coordinator")) {
    return "coordinator";
  }
  return "custom";
}
