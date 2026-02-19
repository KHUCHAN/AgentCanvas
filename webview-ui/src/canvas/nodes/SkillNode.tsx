import { useMemo, useState } from "react";
import type { NodeProps } from "reactflow";
import type { ValidationIssue } from "../../messaging/protocol";
import { getValidationCounts } from "../../utils/validation";
import NodeTypeIcon from "./NodeTypeIcon";

type SkillNodeData = {
  id: string;
  name: string;
  description: string;
  path: string;
  scope: "project" | "personal" | "shared" | "global";
  enabled: boolean;
  validation: ValidationIssue[];
  onOpen: (path: string) => void;
  onToggle: (skillId: string, enabled: boolean) => void;
  onRemove: (nodeId: string) => void;
  onReveal: (path: string) => void;
  onExport: (skillId: string) => void;
};

export default function SkillNode({ id, data, selected }: NodeProps<SkillNodeData>) {
  const [menuOpen, setMenuOpen] = useState(false);
  const counts = useMemo(() => getValidationCounts(data.validation), [data.validation]);
  const toggleMenu = () => setMenuOpen((open) => !open);

  return (
    <div
      className={`node-card node-skill ${selected ? "is-selected" : ""}`}
      tabIndex={0}
      role="button"
      aria-label={`Skill: ${data.name}`}
      onKeyDown={(event) => {
        if (event.currentTarget !== event.target) {
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          data.onOpen(data.path);
        }
      }}
    >
      <div className="node-header with-actions">
        <span className="node-header-label">
          <NodeTypeIcon kind="skill" />
          Skill
        </span>
        <span className="hover-actions">
          <button onClick={() => data.onOpen(data.path)} title="Open">
            Open
          </button>
          <button onClick={() => data.onToggle(data.id, !data.enabled)} title="Enable/Disable">
            {data.enabled ? "Disable" : "Enable"}
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
            aria-label="More skill actions"
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
              data.onExport(data.id);
              setMenuOpen(false);
            }}
          >
            Export skill
          </button>
          <button
            role="menuitem"
            onClick={() => {
              data.onReveal(data.path);
              setMenuOpen(false);
            }}
          >
            Reveal folder
          </button>
        </div>
      )}

      <div className="node-title">{data.name}</div>
      <div className="node-desc">{data.description || "No description"}</div>
      <div className="node-meta-row">
        <span>{data.scope}</span>
        <span className={data.enabled ? "tag-on" : "tag-off"}>{data.enabled ? "enabled" : "disabled"}</span>
      </div>
      <div className="node-validation">
        <span className={counts.errors > 0 ? "pill pill-error" : "pill"}>E {counts.errors}</span>
        <span className={counts.warnings > 0 ? "pill pill-warning" : "pill"}>W {counts.warnings}</span>
      </div>
    </div>
  );
}
