import { useEffect, useRef, useState } from "react";
import type { GeneratedAgentStructure } from "../messaging/protocol";
import { useFocusTrap } from "../hooks/useFocusTrap";

type AgentPreviewModalProps = {
  open: boolean;
  structure?: GeneratedAgentStructure;
  historyId?: string;
  onClose: () => void;
  onApply: (payload: {
    structure: GeneratedAgentStructure;
    createSuggestedSkills: boolean;
    overwriteExisting: boolean;
    historyId?: string;
  }) => Promise<void>;
};

export default function AgentPreviewModal({
  open,
  structure,
  historyId,
  onClose,
  onApply
}: AgentPreviewModalProps) {
  const [createSuggestedSkills, setCreateSuggestedSkills] = useState(true);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [busy, setBusy] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, open);

  useEffect(() => {
    if (!open) {
      setCreateSuggestedSkills(true);
      setOverwriteExisting(false);
      setBusy(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose, open]);

  if (!open || !structure) {
    return null;
  }

  const apply = async () => {
    setBusy(true);
    try {
      await onApply({
        structure,
        createSuggestedSkills,
        overwriteExisting,
        historyId
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="command-overlay" onClick={() => !busy && onClose()}>
      <div
        ref={modalRef}
        className="agent-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Generated agent team preview"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="agent-detail-header">
          <div className="import-title">Generated Team: {structure.teamName}</div>
          <div className="import-subtitle">{structure.teamDescription}</div>
        </div>

        <div className="agent-detail-content">
          <div className="inspector-block">
            <div className="inspector-title">Agents ({structure.agents.length})</div>
            <div className="agent-detail-list">
              {structure.agents.map((agent) => (
                <div key={`${agent.name}:${agent.role}`} className="agent-detail-item">
                  <div className="agent-detail-item-header">
                    <div className="item-title">{agent.avatar ? `${agent.avatar} ` : ""}{agent.name}</div>
                    <span className="pill">{agent.role}</span>
                  </div>
                  <div className="item-subtitle">{agent.description || "No description"}</div>
                  <div className="node-meta">
                    Delegates: {agent.delegatesTo.length || 0} · Skills: {agent.assignedSkillIds.length || 0} · MCP: {agent.assignedMcpServerIds.length || 0}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {(structure.suggestedNewSkills.length > 0 || structure.suggestedNewMcpServers.length > 0) && (
            <div className="inspector-block">
              <div className="inspector-title">Suggested New Resources</div>
              {structure.suggestedNewSkills.map((item) => (
                <div key={`skill:${item.name}:${item.forAgent}`} className="validation-item warning">
                  Skill: {item.name} · for {item.forAgent || "(unassigned)"}
                </div>
              ))}
              {structure.suggestedNewMcpServers.map((item) => (
                <div key={`mcp:${item.name}:${item.forAgent}`} className="validation-item warning">
                  MCP: {item.name} ({item.kind}) · for {item.forAgent || "(unassigned)"}
                </div>
              ))}
            </div>
          )}
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={createSuggestedSkills}
            onChange={(event) => setCreateSuggestedSkills(event.target.checked)}
            disabled={busy}
          />
          Create suggested skills automatically
        </label>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={overwriteExisting}
            onChange={(event) => setOverwriteExisting(event.target.checked)}
            disabled={busy}
          />
          Overwrite existing agents with same name
        </label>

        <div className="import-actions">
          <button onClick={onClose} disabled={busy}>Cancel</button>
          <button onClick={() => void apply()} disabled={busy}>Apply to Canvas</button>
        </div>
      </div>
    </div>
  );
}
