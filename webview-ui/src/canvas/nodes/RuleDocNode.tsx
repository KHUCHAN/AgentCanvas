import { useState } from "react";
import type { NodeProps } from "reactflow";
import NodeTypeIcon from "./NodeTypeIcon";

type RuleDocNodeData = {
  path: string;
  scope: "global" | "project";
  orderIndex: number;
  onOpen: (path: string) => void;
  onCreateOverride: (path: string) => void;
  onRemove: (nodeId: string) => void;
  onReveal: (path: string) => void;
};

export default function RuleDocNode({ id, data, selected }: NodeProps<RuleDocNodeData>) {
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleMenu = () => setMenuOpen((open) => !open);

  return (
    <div
      className={`node-card node-rule ${selected ? "is-selected" : ""}`}
      tabIndex={0}
      role="button"
      aria-label={`Rule document: ${data.path}`}
      onKeyDown={(event) => {
        if (event.currentTarget !== event.target) {
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          data.onOpen(data.path);
        }
      }}
    >
      <div className="node-header with-actions">
        <span className="node-header-label">
          <NodeTypeIcon kind="rule" />
          Rule
        </span>
        <span className="hover-actions">
          <button onClick={() => data.onOpen(data.path)} title="Open">
            Open
          </button>
          <button onClick={() => data.onCreateOverride(data.path)} title="Create override">
            Override
          </button>
          <button onClick={() => data.onRemove(id)} title="Remove from view">
            Hide
          </button>
          <button
            onClick={toggleMenu}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggleMenu();
              }
            }}
            title="More actions"
            aria-label="More rule actions"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            ...
          </button>
        </span>
      </div>

      {menuOpen && (
        <div
          className="node-menu"
          role="menu"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setMenuOpen(false);
            }
          }}
        >
          <button
            role="menuitem"
            onClick={() => {
              data.onReveal(data.path);
              setMenuOpen(false);
            }}
          >
            Reveal file
          </button>
        </div>
      )}

      <div className="node-title">#{data.orderIndex + 1}</div>
      <div className="node-meta">{data.scope}</div>
      <div className="node-path">{data.path}</div>
    </div>
  );
}
