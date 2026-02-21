import { useEffect, useMemo, useRef, useState } from "react";
import type {
  BackendModelCatalog,
  CanonicalBackendId,
  GeneratedAgentStructure
} from "../messaging/protocol";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { getModelOptionsForBackend } from "../utils/modelOptions";

type AgentPreviewModalProps = {
  open: boolean;
  structure?: GeneratedAgentStructure;
  historyId?: string;
  rebuildMode?: boolean;
  modelCatalogs?: BackendModelCatalog[];
  onClose: () => void;
  onApply: (payload: {
    structure: GeneratedAgentStructure;
    createSuggestedSkills: boolean;
    overwriteExisting: boolean;
    historyId?: string;
  }) => Promise<void>;
};

const BACKEND_OPTIONS: CanonicalBackendId[] = [
  "claude",
  "codex",
  "gemini",
  "aider",
  "custom"
];

export default function AgentPreviewModal({
  open,
  structure,
  historyId,
  rebuildMode = false,
  modelCatalogs,
  onClose,
  onApply
}: AgentPreviewModalProps) {
  const [createSuggestedSkills, setCreateSuggestedSkills] = useState(true);
  const [overwriteExisting, setOverwriteExisting] = useState(Boolean(rebuildMode));
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<GeneratedAgentStructure>();
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, open);

  useEffect(() => {
    if (!open) {
      setCreateSuggestedSkills(true);
      setOverwriteExisting(Boolean(rebuildMode));
      setBusy(false);
      setDraft(undefined);
      return;
    }
    if (!structure) {
      setDraft(undefined);
      return;
    }
    setDraft(cloneStructure(structure));
    setOverwriteExisting(Boolean(rebuildMode));
  }, [open, rebuildMode, structure]);

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

  const backendCoverage = useMemo(() => {
    if (!draft) {
      return new Set<CanonicalBackendId>();
    }
    return new Set(draft.backendUsageAtBuild.map((summary) => summary.backendId));
  }, [draft]);
  const hasUsageHistory = useMemo(() => {
    if (!draft) {
      return false;
    }
    return draft.backendUsageAtBuild.some((summary) => hasUsageData(summary));
  }, [draft]);

  if (!open || !draft) {
    return null;
  }

  const apply = async () => {
    setBusy(true);
    try {
      await onApply({
        structure: draft,
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
          <div className="import-title">Generated Team: {draft.teamName}</div>
          <div className="import-subtitle">{draft.teamDescription}</div>
        </div>

        <div className="agent-detail-content">
          <div className="inspector-block">
            <div className="inspector-title">Work intent</div>
            <div className="node-meta">
              Primary: {draft.workIntent.primaryCategory} · Complexity: {draft.workIntent.estimatedComplexity} · Duration: {draft.workIntent.estimatedDuration}
            </div>
            {draft.workIntent.secondaryCategories.length > 0 && (
              <div className="node-meta">
                Secondary: {draft.workIntent.secondaryCategories.join(", ")}
              </div>
            )}
          </div>

          <div className="inspector-block">
            <div className="inspector-title">Backend usage snapshot</div>
            {!hasUsageHistory && (
              <div className="node-meta">
                No usage history yet (first run). Usage metrics will appear after CLI execution.
              </div>
            )}
            {draft.backendUsageAtBuild.length > 0 && (
              <div className="agent-detail-list">
                {draft.backendUsageAtBuild.map((summary) => {
                  const hasData = hasUsageData(summary);
                  return (
                    <div key={summary.backendId} className="agent-detail-item">
                      <div className="agent-detail-item-header">
                        <div className="item-title">{toBackendTitle(summary.backendId)}</div>
                        <span className="pill">{hasData ? `${Math.round((1 - summary.availabilityScore) * 100)}% used` : "No data"}</span>
                      </div>
                      <div className="node-meta">
                        Today: ${summary.today.estimatedCost.toFixed(2)} · {summary.today.callCount} calls
                      </div>
                      <div className="node-meta">
                        Week: ${summary.thisWeek.estimatedCost.toFixed(2)} · Month: ${summary.thisMonth.estimatedCost.toFixed(2)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="inspector-block">
            <div className="inspector-title">Agents ({draft.agents.length})</div>
            <div className="agent-detail-list">
              {draft.agents.map((agent, index) => (
                <div key={`${agent.name}:${agent.role}:${index}`} className="agent-detail-item">
                  <div className="agent-detail-item-header">
                    <div className="item-title">{agent.avatar ? `${agent.avatar} ` : ""}{agent.name}</div>
                    <span className="pill">{agent.role}</span>
                  </div>
                  <div className="item-subtitle">{agent.description || "No description"}</div>

                  <div className="agent-preview-backend-edit">
                    <label>
                      Backend
                      <select
                        value={agent.assignedBackend}
                        onChange={(event) =>
                          setDraft((previous) => {
                            if (!previous) {
                              return previous;
                            }
                            const nextAgents = [...previous.agents];
                            nextAgents[index] = {
                              ...nextAgents[index],
                              assignedBackend: event.target.value as CanonicalBackendId
                            };
                            return {
                              ...previous,
                              agents: nextAgents
                            };
                          })
                        }
                      >
                        {BACKEND_OPTIONS.map((backendId) => (
                          <option key={backendId} value={backendId}>
                            {toBackendTitle(backendId)}
                            {backendCoverage.has(backendId) ? "" : " (no usage data)"}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Model
                      <select
                        value={agent.assignedModel ?? ""}
                        onChange={(event) =>
                          setDraft((previous) => {
                            if (!previous) {
                              return previous;
                            }
                            const nextAgents = [...previous.agents];
                            nextAgents[index] = {
                              ...nextAgents[index],
                              assignedModel: event.target.value.trim() || undefined
                            };
                            return {
                              ...previous,
                              agents: nextAgents
                            };
                          })
                        }
                      >
                        <option value="">Backend default</option>
                        {agent.assignedModel &&
                          !getModelOptionsForBackend(agent.assignedBackend, modelCatalogs).some((option) => option.id === agent.assignedModel) && (
                            <option value={agent.assignedModel}>{agent.assignedModel} (custom)</option>
                          )}
                        {getModelOptionsForBackend(agent.assignedBackend, modelCatalogs).map((option) => (
                          <option key={option.id} value={option.id}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="node-meta">
                    {agent.backendAssignReason || "No assignment reason"}
                  </div>
                  <div className="node-meta">
                    Delegates: {agent.delegatesTo.length || 0} · Skills: {agent.assignedSkillIds.length || 0} · MCP: {agent.assignedMcpServerIds.length || 0}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {(draft.suggestedNewSkills.length > 0 || draft.suggestedNewMcpServers.length > 0) && (
            <div className="inspector-block">
              <div className="inspector-title">Suggested New Resources</div>
              {draft.suggestedNewSkills.map((item) => (
                <div key={`skill:${item.name}:${item.forAgent}`} className="validation-item warning">
                  Skill: {item.name} · for {item.forAgent || "(unassigned)"}
                </div>
              ))}
              {draft.suggestedNewMcpServers.map((item) => (
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

function cloneStructure(input: GeneratedAgentStructure): GeneratedAgentStructure {
  return {
    ...input,
    agents: input.agents.map((agent) => ({ ...agent })),
    suggestedNewSkills: input.suggestedNewSkills.map((skill) => ({ ...skill })),
    suggestedNewMcpServers: input.suggestedNewMcpServers.map((server) => ({ ...server })),
    workIntent: {
      ...input.workIntent,
      secondaryCategories: [...input.workIntent.secondaryCategories],
      categoryWeights: { ...input.workIntent.categoryWeights },
      suggestedRoles: input.workIntent.suggestedRoles.map((role) => ({ ...role }))
    },
    backendUsageAtBuild: input.backendUsageAtBuild.map((summary) => ({
      ...summary,
      today: { ...summary.today },
      thisWeek: { ...summary.thisWeek },
      thisMonth: { ...summary.thisMonth },
      budget: summary.budget ? { ...summary.budget } : undefined
    }))
  };
}

function toBackendTitle(backendId: CanonicalBackendId): string {
  if (backendId === "claude") {
    return "Claude";
  }
  if (backendId === "codex") {
    return "Codex";
  }
  if (backendId === "gemini") {
    return "Gemini";
  }
  if (backendId === "aider") {
    return "Aider";
  }
  return "Custom";
}

function hasUsageData(summary: GeneratedAgentStructure["backendUsageAtBuild"][number]): boolean {
  return (
    summary.today.callCount > 0 ||
    summary.thisWeek.callCount > 0 ||
    summary.thisMonth.callCount > 0 ||
    summary.today.estimatedCost > 0 ||
    summary.thisWeek.estimatedCost > 0 ||
    summary.thisMonth.estimatedCost > 0
  );
}
