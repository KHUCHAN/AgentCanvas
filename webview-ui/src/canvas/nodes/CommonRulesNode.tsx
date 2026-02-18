import type { NodeProps } from "reactflow";
import NodeTypeIcon from "./NodeTypeIcon";

type CommonRulesNodeData = {
  title?: string;
  hasRootAgents?: boolean;
  hasCommonRulesFolder?: boolean;
  rules?: Array<{ id: string; path: string; scope: string }>;
  onOpenRootAgents: () => void;
  onOpenCommonRulesFolder: () => void;
  onCreateCommonRuleDocs: () => void;
};

export default function CommonRulesNode({ data, selected }: NodeProps<CommonRulesNodeData>) {
  const rules = data.rules ?? [];
  const preview = rules.slice(0, 4);
  const rest = Math.max(0, rules.length - preview.length);

  return (
    <div
      className={`node-card node-common-rules ${selected ? "is-selected" : ""}`}
      tabIndex={0}
      role="button"
      aria-label={data.title ?? "Shared Ops Rules"}
    >
      <div className="node-header">
        <span className="node-header-label">
          <NodeTypeIcon kind="commonRules" />
          Common Rules
        </span>
      </div>
      <div className="node-title">{data.title ?? "Shared Ops Rules"}</div>
      <div className="node-meta">
        Root AGENTS: {data.hasRootAgents ? "ready" : "missing"} · Common folder:{" "}
        {data.hasCommonRulesFolder ? "ready" : "missing"}
      </div>

      <div className="node-menu">
        <button onClick={data.onOpenRootAgents}>{data.hasRootAgents ? "Open AGENTS.md" : "Create AGENTS.md"}</button>
        <button onClick={data.onOpenCommonRulesFolder}>Open common rules folder</button>
        <button onClick={data.onCreateCommonRuleDocs}>Create ops docs</button>
      </div>

      {preview.length > 0 && (
        <div className="node-path">
          {preview.map((rule) => (
            <div key={rule.id}>{rule.path}</div>
          ))}
          {rest > 0 && <div>+{rest} more</div>}
        </div>
      )}
    </div>
  );
}
