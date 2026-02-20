import { useState } from "react";

type NodeContextCardProps = {
  nodeId: string;
  nodeType: string;
  data: Record<string, unknown>;
};

export default function NodeContextCard(props: NodeContextCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="node-context-card">
      <div className="node-context-header">
        <span>{props.nodeType}</span>
        <strong>{props.nodeId}</strong>
      </div>
      <button type="button" onClick={() => setExpanded((current) => !current)}>
        {expanded ? "Hide details" : "Show details"}
      </button>
      {expanded && (
        <pre className="node-context-details">
          {JSON.stringify(props.data, null, 2)}
        </pre>
      )}
    </div>
  );
}
