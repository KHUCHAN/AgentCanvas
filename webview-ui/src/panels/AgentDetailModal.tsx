import { KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AgentRole,
  AgentRuntime,
  CliBackendId,
  ClaudePermissionMode,
  CodexApprovalPolicy,
  CodexSandboxPolicy,
  DiscoverySnapshot,
  PromptMode
} from "../messaging/protocol";
import { useFocusTrap } from "../hooks/useFocusTrap";

type AgentDetailTab = "overview" | "skills" | "rules" | "mcp";

type AgentDetailModalProps = {
  open: boolean;
  agentId: string;
  agentName: string;
  snapshot?: DiscoverySnapshot;
  onClose: () => void;
  onOpenFile: (path: string) => void;
  onToggleSkill: (skillId: string, enabled: boolean) => void;
  onRevealPath: (path: string) => void;
  onCreateOverride: (path: string) => void;
  onExportSkill: (skillId: string) => void;
  onUpdateProfile: (payload: {
    agentId: string;
    role: AgentRole;
    roleLabel?: string;
    description?: string;
    systemPrompt?: string;
    isOrchestrator: boolean;
    color?: string;
    avatar?: string;
  }) => void;
  onSetRuntime: (agentId: string, runtime: AgentRuntime | null) => void;
  onSetDelegation: (agentId: string, workerIds: string[]) => void;
  onAssignSkill: (agentId: string, skillId: string) => void;
  onUnassignSkill: (agentId: string, skillId: string) => void;
  onAssignMcp: (agentId: string, mcpServerId: string) => void;
  onUnassignMcp: (agentId: string, mcpServerId: string) => void;
  onDeleteAgent: (agentId: string) => void;
};

const ROLE_OPTIONS: AgentRole[] = [
  "orchestrator",
  "coder",
  "researcher",
  "reviewer",
  "planner",
  "tester",
  "writer",
  "custom"
];

export default function AgentDetailModal({
  open,
  agentId,
  agentName,
  snapshot,
  onClose,
  onOpenFile,
  onToggleSkill,
  onRevealPath,
  onCreateOverride,
  onExportSkill,
  onUpdateProfile,
  onSetRuntime,
  onSetDelegation,
  onAssignSkill,
  onUnassignSkill,
  onAssignMcp,
  onUnassignMcp,
  onDeleteAgent
}: AgentDetailModalProps) {
  const [activeTab, setActiveTab] = useState<AgentDetailTab>("overview");
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, open);

  const [role, setRole] = useState<AgentRole>("custom");
  const [roleLabel, setRoleLabel] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [isOrchestrator, setIsOrchestrator] = useState(false);
  const [color, setColor] = useState("");
  const [avatar, setAvatar] = useState("");
  const [delegateIds, setDelegateIds] = useState<string[]>([]);
  const [runtimeMode, setRuntimeMode] = useState<"default" | "cli" | "openclaw">("default");
  const [runtimeBackendId, setRuntimeBackendId] = useState<CliBackendId>("auto");
  const [runtimeCwdMode, setRuntimeCwdMode] = useState<"workspace" | "agentHome">("workspace");
  const [runtimeModelId, setRuntimeModelId] = useState("");
  const [runtimePromptMode, setRuntimePromptMode] = useState<PromptMode>("append");
  const [runtimeMaxTurns, setRuntimeMaxTurns] = useState("");
  const [runtimeMaxBudgetUsd, setRuntimeMaxBudgetUsd] = useState("");
  const [runtimePermissionMode, setRuntimePermissionMode] = useState<ClaudePermissionMode>("default");
  const [runtimeAllowedTools, setRuntimeAllowedTools] = useState("");
  const [runtimeCodexApproval, setRuntimeCodexApproval] = useState<CodexApprovalPolicy>("on-request");
  const [runtimeCodexSandbox, setRuntimeCodexSandbox] = useState<CodexSandboxPolicy>("workspace-write");
  const [runtimeAdditionalDirs, setRuntimeAdditionalDirs] = useState("");
  const [runtimeEnableWebSearch, setRuntimeEnableWebSearch] = useState(false);
  const [runtimeSessionId, setRuntimeSessionId] = useState("");
  const [runtimeSessionName, setRuntimeSessionName] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [openClawGateway, setOpenClawGateway] = useState("ws://127.0.0.1:18789");
  const [openClawAgentKey, setOpenClawAgentKey] = useState("");

  useEffect(() => {
    if (!open) {
      setActiveTab("overview");
    }
  }, [open]);

  const onWindowKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
  }, [onWindowKeyDown, open]);

  const onTabListKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const tabs: AgentDetailTab[] = ["overview", "skills", "rules", "mcp"];
    const currentIndex = tabs.indexOf(activeTab);
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setActiveTab(tabs[(currentIndex + 1) % tabs.length]);
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setActiveTab(tabs[(currentIndex - 1 + tabs.length) % tabs.length]);
    }
  };

  const agentProfile = useMemo(
    () => snapshot?.agents.find((agent) => agent.id === agentId),
    [snapshot?.agents, agentId]
  );

  useEffect(() => {
    if (!open || !agentProfile) {
      return;
    }
    setRole(agentProfile.role);
    setRoleLabel(agentProfile.roleLabel ?? "");
    setDescription(agentProfile.description ?? "");
    setSystemPrompt(agentProfile.systemPrompt ?? "");
    setIsOrchestrator(agentProfile.isOrchestrator);
    setColor(agentProfile.color ?? "");
    setAvatar(agentProfile.avatar ?? "");
    setDelegateIds(agentProfile.delegatesTo ?? []);
    if (!agentProfile.runtime) {
      setRuntimeMode("default");
      setRuntimeBackendId("auto");
      setRuntimeCwdMode(agentProfile.isOrchestrator ? "workspace" : "agentHome");
      setRuntimeModelId("");
      setRuntimePromptMode("append");
      setRuntimeMaxTurns("");
      setRuntimeMaxBudgetUsd("");
      setRuntimePermissionMode("default");
      setRuntimeAllowedTools("");
      setRuntimeCodexApproval("on-request");
      setRuntimeCodexSandbox("workspace-write");
      setRuntimeAdditionalDirs("");
      setRuntimeEnableWebSearch(false);
      setRuntimeSessionId("");
      setRuntimeSessionName("");
      setOpenClawGateway("ws://127.0.0.1:18789");
      setOpenClawAgentKey("");
    } else if (agentProfile.runtime.kind === "cli") {
      setRuntimeMode("cli");
      setRuntimeBackendId(agentProfile.runtime.backendId);
      setRuntimeCwdMode(
        agentProfile.runtime.cwdMode ?? (agentProfile.isOrchestrator ? "workspace" : "agentHome")
      );
      setRuntimeModelId(agentProfile.runtime.modelId ?? "");
      setRuntimePromptMode(agentProfile.runtime.promptMode ?? "append");
      setRuntimeMaxTurns(
        Number.isFinite(agentProfile.runtime.maxTurns)
          ? String(agentProfile.runtime.maxTurns)
          : ""
      );
      setRuntimeMaxBudgetUsd(
        Number.isFinite(agentProfile.runtime.maxBudgetUsd)
          ? String(agentProfile.runtime.maxBudgetUsd)
          : ""
      );
      setRuntimePermissionMode(agentProfile.runtime.permissionMode ?? "default");
      setRuntimeAllowedTools((agentProfile.runtime.allowedTools ?? []).join(", "));
      setRuntimeCodexApproval(agentProfile.runtime.codexApproval ?? "on-request");
      setRuntimeCodexSandbox(agentProfile.runtime.codexSandbox ?? "workspace-write");
      setRuntimeAdditionalDirs((agentProfile.runtime.additionalDirs ?? []).join(", "));
      setRuntimeEnableWebSearch(Boolean(agentProfile.runtime.enableWebSearch));
      setRuntimeSessionId(agentProfile.runtime.sessionId ?? "");
      setRuntimeSessionName(agentProfile.runtime.sessionName ?? "");
    } else {
      setRuntimeMode("openclaw");
      setOpenClawGateway(agentProfile.runtime.gatewayUrl ?? "ws://127.0.0.1:18789");
      setOpenClawAgentKey(agentProfile.runtime.agentKey ?? "");
    }
  }, [open, agentProfile]);

  const allOtherAgents = useMemo(
    () => (snapshot?.agents ?? []).filter((agent) => agent.id !== agentId),
    [snapshot?.agents, agentId]
  );

  const agentSkills = useMemo(
    () => (snapshot?.skills ?? []).filter((skill) => skill.ownerAgentId === agentId),
    [snapshot?.skills, agentId]
  );

  const assignedSkillIds = useMemo(() => {
    const ids = new Set(agentSkills.map((skill) => skill.id));
    for (const id of agentProfile?.assignedSkillIds ?? []) {
      ids.add(id);
    }
    return ids;
  }, [agentProfile?.assignedSkillIds, agentSkills]);

  const agentRules = useMemo(
    () => (snapshot?.ruleDocs ?? []).filter((rule) => rule.ownerAgentId === agentId),
    [snapshot?.ruleDocs, agentId]
  );

  const agentMcpServers = useMemo(
    () => (snapshot?.mcpServers ?? []).filter((server) => server.ownerAgentId === agentId),
    [snapshot?.mcpServers, agentId]
  );

  const assignedMcpIds = useMemo(() => {
    const ids = new Set(agentMcpServers.map((server) => server.id));
    for (const id of agentProfile?.assignedMcpServerIds ?? []) {
      ids.add(id);
    }
    return ids;
  }, [agentMcpServers, agentProfile?.assignedMcpServerIds]);

  const handleSaveOverview = () => {
    onUpdateProfile({
      agentId,
      role,
      roleLabel: roleLabel.trim() || undefined,
      description: description.trim() || undefined,
      systemPrompt: systemPrompt.trim() || undefined,
      isOrchestrator,
      color: color.trim() || undefined,
      avatar: avatar.trim() || undefined
    });
    if (runtimeMode === "default") {
      onSetRuntime(agentId, null);
    } else if (runtimeMode === "cli") {
      onSetRuntime(agentId, {
        kind: "cli",
        backendId: runtimeBackendId,
        cwdMode: runtimeCwdMode,
        modelId: runtimeModelId.trim() || undefined,
        promptMode: runtimePromptMode,
        maxTurns: parsePositiveInt(runtimeMaxTurns),
        maxBudgetUsd: parsePositiveNumber(runtimeMaxBudgetUsd),
        permissionMode: runtimePermissionMode,
        allowedTools: splitListInput(runtimeAllowedTools),
        codexApproval: runtimeCodexApproval,
        codexSandbox: runtimeCodexSandbox,
        additionalDirs: splitListInput(runtimeAdditionalDirs),
        enableWebSearch: runtimeEnableWebSearch,
        sessionId: runtimeSessionId.trim() || undefined,
        sessionName: runtimeSessionName.trim() || undefined
      });
    } else {
      onSetRuntime(agentId, {
        kind: "openclaw",
        gatewayUrl: openClawGateway.trim() || undefined,
        agentKey: openClawAgentKey.trim() || undefined
      });
    }
    onSetDelegation(agentId, isOrchestrator ? delegateIds : []);
  };

  const toggleDelegate = (workerId: string, checked: boolean) => {
    setDelegateIds((prev) => {
      if (checked) {
        return [...new Set([...prev, workerId])];
      }
      return prev.filter((id) => id !== workerId);
    });
  };

  if (!open) {
    return null;
  }

  return (
    <div className="command-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className="agent-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Agent: ${agentName}`}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="agent-detail-header">
          <div className="import-title">{agentName}</div>
          <div className="import-subtitle">Agent ID: {agentId}</div>
        </div>

        <div className="agent-detail-tabs" role="tablist" aria-label="Agent detail tabs" onKeyDown={onTabListKeyDown}>
          <button
            id="agent-tab-overview"
            role="tab"
            aria-selected={activeTab === "overview"}
            aria-controls="agent-tabpanel-overview"
            className={activeTab === "overview" ? "active" : ""}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>
          <button
            id="agent-tab-skills"
            role="tab"
            aria-selected={activeTab === "skills"}
            aria-controls="agent-tabpanel-skills"
            className={activeTab === "skills" ? "active" : ""}
            onClick={() => setActiveTab("skills")}
          >
            Skills ({assignedSkillIds.size})
          </button>
          <button
            id="agent-tab-rules"
            role="tab"
            aria-selected={activeTab === "rules"}
            aria-controls="agent-tabpanel-rules"
            className={activeTab === "rules" ? "active" : ""}
            onClick={() => setActiveTab("rules")}
          >
            Rules ({agentRules.length})
          </button>
          <button
            id="agent-tab-mcp"
            role="tab"
            aria-selected={activeTab === "mcp"}
            aria-controls="agent-tabpanel-mcp"
            className={activeTab === "mcp" ? "active" : ""}
            onClick={() => setActiveTab("mcp")}
          >
            MCP ({assignedMcpIds.size})
          </button>
        </div>

        <div className="agent-detail-content">
          {activeTab === "overview" && (
            <div id="agent-tabpanel-overview" role="tabpanel" aria-labelledby="agent-tab-overview">
              <div className="inspector-block">
                <div className="inspector-field">
                  <label>Role</label>
                  <select value={role} onChange={(event) => setRole(event.target.value as AgentRole)}>
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div className="inspector-field">
                  <label>Role label</label>
                  <input value={roleLabel} onChange={(event) => setRoleLabel(event.target.value)} placeholder="e.g. Team Lead" />
                </div>

                <div className="inspector-field">
                  <label>Description</label>
                  <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="One-line purpose" />
                </div>

                <label className="checkbox-row">
                  <input type="checkbox" checked={isOrchestrator} onChange={(event) => setIsOrchestrator(event.target.checked)} />
                  Is orchestrator
                </label>

                <div className="inspector-field">
                  <label>System Prompt</label>
                  <textarea value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} rows={5} />
                </div>

                <div className="inspector-field">
                  <label>Avatar (emoji or initials)</label>
                  <input value={avatar} onChange={(event) => setAvatar(event.target.value)} placeholder="🎯" />
                </div>

                <div className="inspector-field">
                  <label>Accent color</label>
                  <input value={color} onChange={(event) => setColor(event.target.value)} placeholder="#e8a64a" />
                </div>

                <div
                  className="accordion-toggle"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setShowAdvanced(!showAdvanced);
                    }
                  }}
                >
                  <span>{showAdvanced ? "▼ Hide advanced runtime settings" : "▶ Show advanced runtime settings (CLI, Budget, Tools)"}</span>
                </div>

                {showAdvanced && (
                  <div className="advanced-settings-block">
                    <div className="inspector-field">
                      <label>Runtime</label>
                      <select
                        value={runtimeMode}
                        onChange={(event) =>
                          setRuntimeMode(event.target.value as "default" | "cli" | "openclaw")
                        }
                      >
                        <option value="default">Workspace default</option>
                        <option value="cli">CLI override</option>
                        <option value="openclaw">OpenClaw</option>
                      </select>
                    </div>

                    {runtimeMode === "cli" && (
                      <>
                        <div className="inspector-field">
                          <label>CLI backend</label>
                          <select
                            value={runtimeBackendId}
                            onChange={(event) => setRuntimeBackendId(event.target.value as CliBackendId)}
                          >
                            <option value="auto">auto</option>
                            <option value="claude-code">claude-code</option>
                            <option value="gemini-cli">gemini-cli</option>
                            <option value="codex-cli">codex-cli</option>
                            <option value="aider">aider</option>
                            <option value="custom">custom</option>
                          </select>
                        </div>
                        <div className="inspector-field">
                          <label>Model</label>
                          <input
                            value={runtimeModelId}
                            onChange={(event) => setRuntimeModelId(event.target.value)}
                            placeholder="backend default"
                          />
                        </div>
                        <div className="inspector-field">
                          <label>CLI working directory</label>
                          <select
                            value={runtimeCwdMode}
                            onChange={(event) => setRuntimeCwdMode(event.target.value as "workspace" | "agentHome")}
                          >
                            <option value="workspace">workspace root</option>
                            <option value="agentHome">agent home (sandbox for worker runs)</option>
                          </select>
                        </div>
                        <div className="inspector-field">
                          <label>Prompt mode</label>
                          <select
                            value={runtimePromptMode}
                            onChange={(event) => setRuntimePromptMode(event.target.value as PromptMode)}
                          >
                            <option value="append">append</option>
                            <option value="replace">replace</option>
                          </select>
                        </div>
                        <div className="inspector-field">
                          <label>Max turns</label>
                          <input
                            value={runtimeMaxTurns}
                            onChange={(event) => setRuntimeMaxTurns(event.target.value)}
                            placeholder="e.g. 8"
                            inputMode="numeric"
                          />
                        </div>
                        <div className="inspector-field">
                          <label>Max budget (USD)</label>
                          <input
                            value={runtimeMaxBudgetUsd}
                            onChange={(event) => setRuntimeMaxBudgetUsd(event.target.value)}
                            placeholder="e.g. 5.00"
                            inputMode="decimal"
                          />
                        </div>
                        <div className="inspector-field">
                          <label>Permission mode</label>
                          <select
                            value={runtimePermissionMode}
                            onChange={(event) =>
                              setRuntimePermissionMode(event.target.value as ClaudePermissionMode)
                            }
                          >
                            <option value="default">default</option>
                            <option value="plan">plan</option>
                            <option value="skip">skip permissions</option>
                          </select>
                        </div>
                        <div className="inspector-field">
                          <label>Allowed tools (comma/newline)</label>
                          <textarea
                            value={runtimeAllowedTools}
                            onChange={(event) => setRuntimeAllowedTools(event.target.value)}
                            rows={2}
                            placeholder="Read, Glob, Grep"
                          />
                        </div>
                        <div className="inspector-field">
                          <label>Codex approval policy</label>
                          <select
                            value={runtimeCodexApproval}
                            onChange={(event) =>
                              setRuntimeCodexApproval(event.target.value as CodexApprovalPolicy)
                            }
                          >
                            <option value="on-request">on-request</option>
                            <option value="untrusted">untrusted</option>
                            <option value="never">never</option>
                          </select>
                        </div>
                        <div className="inspector-field">
                          <label>Codex sandbox</label>
                          <select
                            value={runtimeCodexSandbox}
                            onChange={(event) =>
                              setRuntimeCodexSandbox(event.target.value as CodexSandboxPolicy)
                            }
                          >
                            <option value="workspace-write">workspace-write</option>
                            <option value="read-only">read-only</option>
                            <option value="danger-full-access">danger-full-access</option>
                          </select>
                        </div>
                        <div className="inspector-field">
                          <label>Additional dirs (comma/newline)</label>
                          <textarea
                            value={runtimeAdditionalDirs}
                            onChange={(event) => setRuntimeAdditionalDirs(event.target.value)}
                            rows={2}
                            placeholder="/path/one, /path/two"
                          />
                        </div>
                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={runtimeEnableWebSearch}
                            onChange={(event) => setRuntimeEnableWebSearch(event.target.checked)}
                          />
                          Enable web search
                        </label>
                        <div className="inspector-field">
                          <label>Session ID</label>
                          <input
                            value={runtimeSessionId}
                            onChange={(event) => setRuntimeSessionId(event.target.value)}
                            placeholder="resume session id"
                          />
                        </div>
                        <div className="inspector-field">
                          <label>Session name</label>
                          <input
                            value={runtimeSessionName}
                            onChange={(event) => setRuntimeSessionName(event.target.value)}
                            placeholder="friendly session label"
                          />
                        </div>
                      </>
                    )}

                    {runtimeMode === "openclaw" && (
                      <>
                        <div className="inspector-field">
                          <label>Gateway URL</label>
                          <input
                            value={openClawGateway}
                            onChange={(event) => setOpenClawGateway(event.target.value)}
                            placeholder="ws://127.0.0.1:18789"
                          />
                        </div>
                        <div className="inspector-field">
                          <label>Agent key (optional)</label>
                          <input
                            value={openClawAgentKey}
                            onChange={(event) => setOpenClawAgentKey(event.target.value)}
                            placeholder="agent key"
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="inspector-field">
                  <label>Delegates To</label>
                  {allOtherAgents.length === 0 && <div className="muted">No other agents available.</div>}
                  {allOtherAgents.map((agent) => (
                    <label key={agent.id} className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={delegateIds.includes(agent.id)}
                        onChange={(event) => toggleDelegate(agent.id, event.target.checked)}
                        disabled={!isOrchestrator}
                      />
                      {agent.name}
                    </label>
                  ))}
                </div>

                <div className="import-actions">
                  <button onClick={handleSaveOverview}>Save</button>
                  {agentId.startsWith("custom:") && (
                    <button className="danger" onClick={() => onDeleteAgent(agentId)}>Delete Agent</button>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "skills" && (
            <div id="agent-tabpanel-skills" role="tabpanel" aria-labelledby="agent-tab-skills">
              <SkillsTab
                skills={snapshot?.skills ?? []}
                agentId={agentId}
                assignedSkillIds={assignedSkillIds}
                onOpenFile={onOpenFile}
                onToggleSkill={onToggleSkill}
                onRevealPath={onRevealPath}
                onExportSkill={onExportSkill}
                onAssignSkill={onAssignSkill}
                onUnassignSkill={onUnassignSkill}
              />
            </div>
          )}

          {activeTab === "rules" && (
            <div id="agent-tabpanel-rules" role="tabpanel" aria-labelledby="agent-tab-rules">
              <RulesTab
                rules={agentRules}
                onOpenFile={onOpenFile}
                onRevealPath={onRevealPath}
                onCreateOverride={onCreateOverride}
              />
            </div>
          )}

          {activeTab === "mcp" && (
            <div id="agent-tabpanel-mcp" role="tabpanel" aria-labelledby="agent-tab-mcp">
              <McpTab
                servers={snapshot?.mcpServers ?? []}
                agentId={agentId}
                assignedMcpIds={assignedMcpIds}
                onOpenFile={onOpenFile}
                onAssignMcp={onAssignMcp}
                onUnassignMcp={onUnassignMcp}
              />
            </div>
          )}
        </div>

        <div className="import-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function SkillsTab(props: {
  skills: DiscoverySnapshot["skills"];
  agentId: string;
  assignedSkillIds: Set<string>;
  onOpenFile: (path: string) => void;
  onToggleSkill: (skillId: string, enabled: boolean) => void;
  onRevealPath: (path: string) => void;
  onExportSkill: (skillId: string) => void;
  onAssignSkill: (agentId: string, skillId: string) => void;
  onUnassignSkill: (agentId: string, skillId: string) => void;
}) {
  if (props.skills.length === 0) {
    return <div className="muted">No skills found.</div>;
  }

  const sorted = [...props.skills].sort((left, right) => left.name.localeCompare(right.name));

  return (
    <div className="agent-detail-list">
      {sorted.map((skill) => {
        const owned = skill.ownerAgentId === props.agentId;
        const assigned = props.assignedSkillIds.has(skill.id);
        return (
          <div key={skill.id} className="agent-detail-item">
            <div className="agent-detail-item-header">
              <div className="item-title">{skill.name}</div>
              <span className={skill.enabled ? "tag-on" : "tag-off"}>{skill.enabled ? "enabled" : "disabled"}</span>
            </div>
            <div className="item-subtitle">{skill.description || "No description"}</div>
            <div className="item-actions">
              <button onClick={() => props.onOpenFile(skill.path)}>Open</button>
              <button onClick={() => props.onToggleSkill(skill.id, !skill.enabled)}>{skill.enabled ? "Disable" : "Enable"}</button>
              <button onClick={() => props.onRevealPath(skill.path)}>Reveal</button>
              <button onClick={() => props.onExportSkill(skill.id)}>Export</button>
              {owned && <button disabled>Owned</button>}
              {!owned && assigned && <button onClick={() => props.onUnassignSkill(props.agentId, skill.id)}>Unassign</button>}
              {!owned && !assigned && <button onClick={() => props.onAssignSkill(props.agentId, skill.id)}>Assign</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RulesTab(props: {
  rules: DiscoverySnapshot["ruleDocs"];
  onOpenFile: (path: string) => void;
  onRevealPath: (path: string) => void;
  onCreateOverride: (path: string) => void;
}) {
  if (props.rules.length === 0) {
    return <div className="muted">No rule documents found for this agent.</div>;
  }

  const sortedRules = [...props.rules].sort(
    (left, right) => left.orderIndex - right.orderIndex
  );

  return (
    <div className="agent-detail-list">
      {sortedRules.map((rule) => (
        <div key={rule.id} className="agent-detail-item">
          <div className="agent-detail-item-header">
            <div className="item-title">Rule {rule.orderIndex + 1}</div>
            <span className="pill">{rule.scope}</span>
          </div>
          <div className="inspector-path">{rule.path}</div>
          <div className="item-actions">
            <button onClick={() => props.onOpenFile(rule.path)}>Open</button>
            <button onClick={() => props.onCreateOverride(rule.path)}>
              Create Override
            </button>
            <button onClick={() => props.onRevealPath(rule.path)}>Reveal</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function McpTab(props: {
  servers: DiscoverySnapshot["mcpServers"];
  agentId: string;
  assignedMcpIds: Set<string>;
  onOpenFile: (path: string) => void;
  onAssignMcp: (agentId: string, mcpServerId: string) => void;
  onUnassignMcp: (agentId: string, mcpServerId: string) => void;
}) {
  if (props.servers.length === 0) {
    return <div className="muted">No MCP servers discovered.</div>;
  }

  return (
    <div className="agent-detail-list">
      {props.servers.map((server) => {
        const owned = server.ownerAgentId === props.agentId;
        const assigned = props.assignedMcpIds.has(server.id);
        return (
          <div key={server.id} className="agent-detail-item">
            <div className="agent-detail-item-header">
              <div className="item-title">{server.name}</div>
              <span className={server.enabled ? "tag-on" : "tag-off"}>{server.enabled ? "enabled" : "disabled"}</span>
            </div>
            <div className="item-subtitle">{server.kind} · {server.providerId}</div>
            <div className="inspector-path">{server.configLocationPath}</div>
            <div className="item-actions">
              <button onClick={() => props.onOpenFile(server.configLocationPath)}>Open Config</button>
              {owned && <button disabled>Owned</button>}
              {!owned && assigned && <button onClick={() => props.onUnassignMcp(props.agentId, server.id)}>Unassign</button>}
              {!owned && !assigned && <button onClick={() => props.onAssignMcp(props.agentId, server.id)}>Assign</button>}
            </div>
          </div>
        );
      })}

      {props.servers.length > 2 && (
        <div className="validation-item warning">
          WARNING: More than 2 MCP servers can increase context cost.
        </div>
      )}
    </div>
  );
}

function parsePositiveInt(value: string): number | undefined {
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

function parsePositiveNumber(value: string): number | undefined {
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

function splitListInput(value: string): string[] | undefined {
  const items = value
    .split(/\n|,/g)
    .map((item) => item.trim())
    .filter(Boolean);
  if (items.length === 0) {
    return undefined;
  }
  return items;
}
