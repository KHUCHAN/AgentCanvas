import { type DragEvent as ReactDragEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Edge, Node } from "reactflow";
import type {
  CliBackend,
  CliBackendOverrides,
  DiscoverySnapshot,
  RunEvent,
  RunSummary,
  SessionContext,
  Task,
  Skill
} from "../messaging/protocol";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import type { PatternIndexItem } from "../patterns/types";
import RunPanel from "./RunPanel";
import InspectorVariables from "./InspectorVariables";
import TaskPanel, { type TaskPanelOptions } from "./TaskPanel";
import { getValidationCounts } from "../utils/validation";

type RightPanelProps = {
  mode: "library" | "inspector" | "task" | "run";
  open: boolean;
  saveSignal: number;
  snapshot?: DiscoverySnapshot;
  selectedNode?: Node;
  selectedScheduleTaskId?: string;
  selectedEdge?: Edge;
  onModeChange: (mode: "library" | "inspector" | "task" | "run") => void;
  onOpenFile: (path: string) => void;
  onRevealPath: (path: string) => void;
  onCreateSkill: (name: string, description: string) => void;
  onExportSkills: (skillIds: string[]) => void;
  onValidateSkill: (skillId: string) => void;
  onCreateOverride: (path: string) => void;
  onSaveSkillFrontmatter: (
    skillId: string,
    name: string,
      description: string,
      extraFrontmatter: Record<string, unknown>
    ) => void;
  interactionPatterns: PatternIndexItem[];
  onInsertPattern: (patternId: string) => Promise<void>;
  onUpdateInteractionEdge: (edgeId: string, update: { label?: string; data?: Record<string, unknown> }) => void;
  activeFlowName: string;
  tasks: Task[];
  onRunTask: (prompt: string, options: TaskPanelOptions) => Promise<void>;
  onCancelTask: (taskId: string) => void;
  onViewTaskDetail: (taskId: string) => void;
  runBackends: CliBackend[];
  backendOverrides: CliBackendOverrides;
  defaultBackendId: CliBackend["id"];
  runHistory: RunSummary[];
  runEvents: RunEvent[];
  activeRunId?: string;
  selectedRunId?: string;
  selectedScheduleTask?: Task;
  onRunFlow: (payload: {
    flowName: string;
    backendId: CliBackend["id"];
    usePinnedOutputs: boolean;
    session?: SessionContext;
  }) => Promise<void>;
  onRunNode: (payload: {
    flowName: string;
    nodeId: string;
    backendId: CliBackend["id"];
    usePinnedOutput: boolean;
    session?: SessionContext;
  }) => Promise<void>;
  onReplayRun: (payload: { runId: string; modifiedPrompts?: Record<string, string> }) => Promise<void>;
  onStopRun: (runId: string) => Promise<void>;
  onRefreshRunHistory: () => Promise<void>;
  onSelectRun: (runId: string) => Promise<void>;
  onPinOutput: (flowName: string, nodeId: string, output: unknown) => Promise<void>;
  onUnpinOutput: (flowName: string, nodeId: string) => Promise<void>;
  onSetBackendOverrides: (overrides: CliBackendOverrides) => Promise<void>;
  onSetDefaultBackend: (backendId: CliBackend["id"]) => Promise<void>;
  onTestBackend: (backendId: CliBackend["id"]) => Promise<{
    backendId: CliBackend["id"];
    ok: boolean;
    durationMs: number;
    model?: string;
    message: string;
    outputPreview?: string;
  }>;
  onOpenRunLog: (runId: string, flowName: string) => void;
  onOpenAgentDetail: (agentId: string, agentName: string) => void;
};

type LibraryFilter = "all" | "skills" | "rules" | "agents";
type LibrarySectionKey = "skills" | "agents" | "patterns" | "mcp" | "rules" | "newSkill";

export default function RightPanel(props: RightPanelProps) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 120);
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>("all");
  const [skillName, setSkillName] = useState("");
  const [skillDescription, setSkillDescription] = useState("");
  const [inspectorTab, setInspectorTab] = useState<"overview" | "variables">("overview");
  const [agentInspectorTab, setAgentInspectorTab] = useState<"overview" | "skills" | "rules" | "mcp">("overview");
  const [skillRenderLimit, setSkillRenderLimit] = useState(160);
  const [agentRenderLimit, setAgentRenderLimit] = useState(120);
  const [ruleRenderLimit, setRuleRenderLimit] = useState(120);
  const [mcpRenderLimit, setMcpRenderLimit] = useState(120);
  const [patternRenderLimit, setPatternRenderLimit] = useState(120);
  const [collapsedSections, setCollapsedSections] = useState<Record<LibrarySectionKey, boolean>>({
    skills: false,
    agents: false,
    patterns: false,
    mcp: false,
    rules: false,
    newSkill: false
  });
  const previousSelectedTypeRef = useRef<string>();

  useEffect(() => {
    if (props.mode !== "inspector") {
      return;
    }
    setInspectorTab("overview");
  }, [props.mode]);

  useEffect(() => {
    window.requestAnimationFrame(() => {
      const panel = document.querySelector<HTMLElement>(".right-panel .panel-content");
      panel?.scrollTo({ top: 0, left: 0 });
    });
  }, [props.mode]);

  const skills = props.snapshot?.skills ?? [];
  const agents = props.snapshot?.agents ?? [];
  const rules = props.snapshot?.ruleDocs ?? [];
  const mcpServers = props.snapshot?.mcpServers ?? [];
  const normalizedQuery = debouncedQuery.trim().toLowerCase();

  const filteredSkills = useMemo(() => {
    if (!normalizedQuery) {
      return skills;
    }
    return skills.filter(
      (skill) =>
        skill.name.toLowerCase().includes(normalizedQuery) ||
        skill.description.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery, skills]);

  const filteredAgents = useMemo(() => {
    if (!normalizedQuery) {
      return agents;
    }
    return agents.filter((agent) => {
      const roleText = agent.roleLabel || agent.role;
      return (
        agent.name.toLowerCase().includes(normalizedQuery) ||
        agent.providerId.toLowerCase().includes(normalizedQuery) ||
        roleText.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [agents, normalizedQuery]);

  const filteredRules = useMemo(() => {
    if (!normalizedQuery) {
      return rules;
    }
    return rules.filter((rule) =>
      `${rule.path} ${rule.providerId} ${rule.scope}`.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery, rules]);

  const filteredMcpServers = useMemo(() => {
    if (!normalizedQuery) {
      return mcpServers;
    }
    return mcpServers.filter((server) =>
      `${server.name} ${server.kind} ${server.providerId}`.toLowerCase().includes(normalizedQuery)
    );
  }, [mcpServers, normalizedQuery]);

  const filteredPatterns = useMemo(() => {
    if (!normalizedQuery) {
      return props.interactionPatterns;
    }
    return props.interactionPatterns.filter((pattern) =>
      `${pattern.name} ${pattern.summary ?? ""} ${pattern.id}`.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery, props.interactionPatterns]);

  useEffect(() => {
    setSkillRenderLimit(160);
    setAgentRenderLimit(120);
    setRuleRenderLimit(120);
    setMcpRenderLimit(120);
    setPatternRenderLimit(120);
  }, [debouncedQuery]);

  const visibleSkills = useMemo(
    () => filteredSkills.slice(0, skillRenderLimit),
    [filteredSkills, skillRenderLimit]
  );
  const visibleAgents = useMemo(
    () => filteredAgents.slice(0, agentRenderLimit),
    [agentRenderLimit, filteredAgents]
  );
  const visibleRules = useMemo(
    () => filteredRules.slice(0, ruleRenderLimit),
    [filteredRules, ruleRenderLimit]
  );
  const visibleMcpServers = useMemo(
    () => filteredMcpServers.slice(0, mcpRenderLimit),
    [filteredMcpServers, mcpRenderLimit]
  );
  const visiblePatterns = useMemo(
    () => filteredPatterns.slice(0, patternRenderLimit),
    [filteredPatterns, patternRenderLimit]
  );

  const selectedType = props.selectedNode?.type;
  const selectedEdgeType = props.selectedEdge?.type;
  const selectedAgentId =
    selectedType === "agent"
      ? String((props.selectedNode?.data as Record<string, unknown>)?.id ?? props.selectedNode?.id ?? "")
      : "";
  const selectedAgentProfile = useMemo(
    () => props.snapshot?.agents.find((agent) => agent.id === selectedAgentId),
    [props.snapshot?.agents, selectedAgentId]
  );
  const agentSkills = useMemo(() => {
    if (!selectedAgentId) {
      return [];
    }
    const assigned = new Set(selectedAgentProfile?.assignedSkillIds ?? []);
    return (props.snapshot?.skills ?? []).filter(
      (skill) => skill.ownerAgentId === selectedAgentId || assigned.has(skill.id)
    );
  }, [props.snapshot?.skills, selectedAgentId, selectedAgentProfile?.assignedSkillIds]);
  const agentRules = useMemo(
    () => (props.snapshot?.ruleDocs ?? []).filter((rule) => rule.ownerAgentId === selectedAgentId),
    [props.snapshot?.ruleDocs, selectedAgentId]
  );
  const agentMcpServers = useMemo(
    () => (props.snapshot?.mcpServers ?? []).filter((server) => server.ownerAgentId === selectedAgentId),
    [props.snapshot?.mcpServers, selectedAgentId]
  );
  useEffect(() => {
    const previousType = previousSelectedTypeRef.current;
    if (selectedType === "agent" && previousType !== "agent") {
      setAgentInspectorTab("overview");
    }
    previousSelectedTypeRef.current = selectedType;
  }, [selectedType]);

  const toggleLibrarySection = useCallback((section: LibrarySectionKey) => {
    setCollapsedSections((current) => ({
      ...current,
      [section]: !current[section]
    }));
  }, []);

  const beginDragPreview = useCallback((event: ReactDragEvent<HTMLElement>) => {
    event.currentTarget.classList.add("is-dragging");
  }, []);

  const endDragPreview = useCallback((event: ReactDragEvent<HTMLElement>) => {
    event.currentTarget.classList.remove("is-dragging");
  }, []);

  const libraryHasMatches = useMemo(() => {
    if (libraryFilter === "skills") {
      return filteredSkills.length > 0;
    }
    if (libraryFilter === "rules") {
      return filteredRules.length > 0;
    }
    if (libraryFilter === "agents") {
      return filteredAgents.length > 0;
    }
    return (
      filteredSkills.length > 0 ||
      filteredAgents.length > 0 ||
      filteredRules.length > 0 ||
      filteredMcpServers.length > 0 ||
      filteredPatterns.length > 0
    );
  }, [filteredAgents.length, filteredMcpServers.length, filteredPatterns.length, filteredRules.length, filteredSkills.length, libraryFilter]);

  if (!props.open) {
    return null;
  }

  const handleCreateSkill = (event: FormEvent) => {
    event.preventDefault();
    if (!skillName.trim()) {
      return;
    }
    props.onCreateSkill(skillName.trim(), skillDescription.trim());
    setSkillName("");
    setSkillDescription("");
  };

  return (
    <aside className="right-panel">
      <div className="right-panel-tabs" role="tablist" aria-label="Right panel tabs">
        <button
          role="tab"
          aria-selected={props.mode === "library"}
          aria-controls="right-panel-library"
          className={props.mode === "library" ? "active" : ""}
          onClick={() => props.onModeChange("library")}
        >
          Node Library
        </button>
        <button
          role="tab"
          aria-selected={props.mode === "inspector"}
          aria-controls="right-panel-inspector"
          className={props.mode === "inspector" ? "active" : ""}
          onClick={() => props.onModeChange("inspector")}
        >
          Inspector
        </button>
        <button
          role="tab"
          aria-selected={props.mode === "task"}
          aria-controls="right-panel-task"
          className={props.mode === "task" ? "active" : ""}
          onClick={() => props.onModeChange("task")}
        >
          Task
        </button>
        <button
          role="tab"
          aria-selected={props.mode === "run"}
          aria-controls="right-panel-run"
          className={props.mode === "run" ? "active" : ""}
          onClick={() => props.onModeChange("run")}
        >
          Run
        </button>
      </div>

      {(props.mode === "task" || props.mode === "run") && (
        <div className="panel-mode-subtitle">
          {props.mode === "task"
            ? "Task: submit work instructions and track current tasks."
            : "Run: monitor execution sessions, timeline, and logs."}
        </div>
      )}

      {props.mode === "library" && (
        <div className="panel-content" id="right-panel-library" role="tabpanel">
          <div role="search">
            <input
              className="library-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search library..."
            />
          </div>
          <div className="library-filter-row" role="tablist" aria-label="Library filters">
            <button
              type="button"
              className={libraryFilter === "all" ? "active" : ""}
              onClick={() => setLibraryFilter("all")}
            >
              All
            </button>
            <button
              type="button"
              className={libraryFilter === "skills" ? "active" : ""}
              onClick={() => setLibraryFilter("skills")}
            >
              Skills
            </button>
            <button
              type="button"
              className={libraryFilter === "rules" ? "active" : ""}
              onClick={() => setLibraryFilter("rules")}
            >
              Rules
            </button>
            <button
              type="button"
              className={libraryFilter === "agents" ? "active" : ""}
              onClick={() => setLibraryFilter("agents")}
            >
              Agents
            </button>
          </div>

          {!libraryHasMatches && <div className="muted">No matching items</div>}

          {(libraryFilter === "all" || libraryFilter === "skills") && (
            <div className="library-block">
              <button
                type="button"
                className="library-section-header"
                onClick={() => toggleLibrarySection("skills")}
              >
                <span className="library-title">Skills</span>
                <span className="library-section-meta">
                  {filteredSkills.length} / {skills.length}
                </span>
                <span className="library-section-caret">{collapsedSections.skills ? "+" : "-"}</span>
              </button>
              {!collapsedSections.skills && (
                <>
                  {visibleSkills.map((skill) => (
                    <LibrarySkillItem
                      key={skill.id}
                      skill={skill}
                      onOpen={props.onOpenFile}
                      onReveal={props.onRevealPath}
                      onValidate={props.onValidateSkill}
                      onExport={(id) => props.onExportSkills([id])}
                    />
                  ))}
                  {filteredSkills.length === 0 && <div className="muted">No matching skills</div>}
                  {filteredSkills.length > visibleSkills.length && (
                    <button type="button" onClick={() => setSkillRenderLimit((current) => current + 160)}>
                      Load more ({filteredSkills.length - visibleSkills.length} remaining)
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {(libraryFilter === "all" || libraryFilter === "agents") && (
            <div className="library-block">
              <button
                type="button"
                className="library-section-header"
                onClick={() => toggleLibrarySection("agents")}
              >
                <span className="library-title">Agents</span>
                <span className="library-section-meta">
                  {filteredAgents.length} / {agents.length}
                </span>
                <span className="library-section-caret">{collapsedSections.agents ? "+" : "-"}</span>
              </button>
              {!collapsedSections.agents && (
                <>
                  {visibleAgents.map((agent) => (
                    <div key={agent.id} className="library-item">
                      <div className="item-main">
                        <div className="item-title">{agent.name}</div>
                        <div className="item-subtitle">
                          {agent.roleLabel || agent.role} · {agent.providerId}
                        </div>
                      </div>
                      <div className="item-actions">
                        <button type="button" onClick={() => props.onOpenAgentDetail(agent.id, agent.name)}>
                          Open
                        </button>
                      </div>
                    </div>
                  ))}
                  {filteredAgents.length === 0 && <div className="muted">No matching agents</div>}
                  {filteredAgents.length > visibleAgents.length && (
                    <button type="button" onClick={() => setAgentRenderLimit((current) => current + 120)}>
                      Load more ({filteredAgents.length - visibleAgents.length} remaining)
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {libraryFilter === "all" && (
            <div className="library-block">
              <button
                type="button"
                className="library-section-header"
                onClick={() => toggleLibrarySection("patterns")}
              >
                <span className="library-title">Interaction Patterns</span>
                <span className="library-section-meta">
                  {filteredPatterns.length} / {props.interactionPatterns.length}
                </span>
                <span className="library-section-caret">{collapsedSections.patterns ? "+" : "-"}</span>
              </button>
              {!collapsedSections.patterns && (
                <>
                  {visiblePatterns.map((pattern) => (
                    <div
                      key={pattern.id}
                      className="library-item draggable"
                      draggable
                      onDragStart={(event) => {
                        beginDragPreview(event);
                        event.dataTransfer.setData(
                          "application/agentcanvas-pattern",
                          JSON.stringify({ id: pattern.id, name: pattern.name })
                        );
                        event.dataTransfer.effectAllowed = "copy";
                      }}
                      onDragEnd={endDragPreview}
                    >
                      <div className="item-main">
                        <div className="item-title">{pattern.name}</div>
                        <div className="item-subtitle">{pattern.summary || pattern.id}</div>
                        <div className="item-badges">
                          {pattern.topology && <span className="pill">{pattern.topology}</span>}
                          {pattern.nodeCount !== undefined && <span className="pill">N {pattern.nodeCount}</span>}
                          {pattern.edgeCount !== undefined && <span className="pill">E {pattern.edgeCount}</span>}
                        </div>
                      </div>
                      <div className="item-actions">
                        <button
                          type="button"
                          onClick={() => {
                            void props.onInsertPattern(pattern.id).catch(() => undefined);
                          }}
                        >
                          Insert
                        </button>
                      </div>
                    </div>
                  ))}
                  {filteredPatterns.length === 0 && <div className="muted">No interaction patterns found</div>}
                  {filteredPatterns.length > visiblePatterns.length && (
                    <button type="button" onClick={() => setPatternRenderLimit((current) => current + 120)}>
                      Load more ({filteredPatterns.length - visiblePatterns.length} remaining)
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {libraryFilter === "all" && (
            <div className="library-block">
              <button
                type="button"
                className="library-section-header"
                onClick={() => toggleLibrarySection("mcp")}
              >
                <span className="library-title">MCP Servers</span>
                <span className="library-section-meta">
                  {filteredMcpServers.length} / {mcpServers.length}
                </span>
                <span className="library-section-caret">{collapsedSections.mcp ? "+" : "-"}</span>
              </button>
              {!collapsedSections.mcp && (
                <>
                  {visibleMcpServers.map((server) => (
                    <div
                      key={server.id}
                      className="library-item draggable"
                      draggable
                      onDragStart={(event) => {
                        beginDragPreview(event);
                        event.dataTransfer.setData(
                          "application/agentcanvas-mcp",
                          JSON.stringify({
                            type: "mcp",
                            id: server.id,
                            name: server.name
                          })
                        );
                        event.dataTransfer.effectAllowed = "copy";
                      }}
                      onDragEnd={endDragPreview}
                    >
                      <div className="item-main">
                        <div className="item-title">{server.name}</div>
                        <div className="item-subtitle">{server.kind} · {server.providerId}</div>
                      </div>
                    </div>
                  ))}
                  {filteredMcpServers.length === 0 && <div className="muted">No MCP servers discovered</div>}
                  {filteredMcpServers.length > visibleMcpServers.length && (
                    <button type="button" onClick={() => setMcpRenderLimit((current) => current + 120)}>
                      Load more ({filteredMcpServers.length - visibleMcpServers.length} remaining)
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {(libraryFilter === "all" || libraryFilter === "rules") && (
            <div className="library-block">
              <button
                type="button"
                className="library-section-header"
                onClick={() => toggleLibrarySection("rules")}
              >
                <span className="library-title">Rule Docs</span>
                <span className="library-section-meta">
                  {filteredRules.length} / {rules.length}
                </span>
                <span className="library-section-caret">{collapsedSections.rules ? "+" : "-"}</span>
              </button>
              {!collapsedSections.rules && (
                <>
                  {visibleRules.map((rule) => (
                    <div key={rule.id} className="library-item">
                      <div className="item-main">
                        <div className="item-title">{rule.providerId}</div>
                        <div className="item-subtitle">{rule.path}</div>
                      </div>
                      <div className="item-actions">
                        <button type="button" onClick={() => props.onOpenFile(rule.path)}>Open</button>
                        <button type="button" onClick={() => props.onCreateOverride(rule.path)}>Override</button>
                        <button type="button" onClick={() => props.onRevealPath(rule.path)}>Reveal</button>
                      </div>
                    </div>
                  ))}
                  {filteredRules.length === 0 && <div className="muted">No matching rules</div>}
                  {filteredRules.length > visibleRules.length && (
                    <button type="button" onClick={() => setRuleRenderLimit((current) => current + 120)}>
                      Load more ({filteredRules.length - visibleRules.length} remaining)
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {(libraryFilter === "all" || libraryFilter === "skills") && (
            <form className="new-skill-form" onSubmit={handleCreateSkill}>
              <button
                type="button"
                className="library-section-header"
                onClick={() => toggleLibrarySection("newSkill")}
              >
                <span className="library-title">New Skill</span>
                <span className="library-section-meta">Create</span>
                <span className="library-section-caret">{collapsedSections.newSkill ? "+" : "-"}</span>
              </button>
              {!collapsedSections.newSkill && (
                <>
                  <input
                    value={skillName}
                    onChange={(event) => setSkillName(event.target.value)}
                    placeholder="name (kebab-case)"
                  />
                  <textarea
                    value={skillDescription}
                    onChange={(event) => setSkillDescription(event.target.value)}
                    placeholder="description"
                    rows={3}
                  />
                  <button type="submit">Create</button>
                </>
              )}
            </form>
          )}
        </div>
      )}

      {props.mode === "inspector" && (
        <div className="panel-content" id="right-panel-inspector" role="tabpanel">
          <div className="view-toggle inspector-subtabs" role="tablist" aria-label="Inspector tabs">
            <button
              type="button"
              className={inspectorTab === "overview" ? "active-toggle" : ""}
              onClick={() => setInspectorTab("overview")}
            >
              Overview
            </button>
            <button
              type="button"
              className={inspectorTab === "variables" ? "active-toggle" : ""}
              onClick={() => setInspectorTab("variables")}
            >
              Variables
            </button>
          </div>

          {inspectorTab === "variables" ? (
            <InspectorVariables
              flowName={props.activeFlowName}
              nodeId={props.selectedNode?.id}
              runEvents={props.runEvents}
              onPinOutput={props.onPinOutput}
            />
          ) : (
            <>
              {!props.selectedNode && !props.selectedEdge && <div className="muted">Select a node or edge to inspect</div>}

          {selectedType === "skill" && (
            <SkillInspector
              selectedNode={props.selectedNode}
              onOpenFile={props.onOpenFile}
              onRevealPath={props.onRevealPath}
              onValidate={props.onValidateSkill}
              onExport={(id) => props.onExportSkills([id])}
              onSave={props.onSaveSkillFrontmatter}
              saveSignal={props.saveSignal}
            />
          )}

          {selectedType === "ruleDoc" && (
            <RuleInspector
              selectedNode={props.selectedNode}
              onOpenFile={props.onOpenFile}
              onRevealPath={props.onRevealPath}
              onCreateOverride={props.onCreateOverride}
            />
          )}

          {selectedType === "folder" && (
            <div className="inspector-block">
              <div className="inspector-title">Folder</div>
              <div className="inspector-path">{String(props.selectedNode?.data.path ?? "")}</div>
              <div className="inspector-actions">
                <button onClick={() => props.onRevealPath(String(props.selectedNode?.data.path ?? ""))}>
                  Reveal folder
                </button>
              </div>
            </div>
          )}

          {selectedType === "agent" && (
            <div className="inspector-block">
              <div className="inspector-title">Agent</div>
              <div className="inspector-heading">
                {String((props.selectedNode?.data as Record<string, unknown>)?.name ?? "Agent")}
              </div>
              <div className="view-toggle inspector-subtabs" role="tablist" aria-label="Agent manage tabs">
                <button
                  type="button"
                  className={agentInspectorTab === "overview" ? "active-toggle" : ""}
                  onClick={() => setAgentInspectorTab("overview")}
                >
                  Overview
                </button>
                <button
                  type="button"
                  className={agentInspectorTab === "skills" ? "active-toggle" : ""}
                  onClick={() => setAgentInspectorTab("skills")}
                >
                  Skills
                </button>
                <button
                  type="button"
                  className={agentInspectorTab === "rules" ? "active-toggle" : ""}
                  onClick={() => setAgentInspectorTab("rules")}
                >
                  Rules
                </button>
                <button
                  type="button"
                  className={agentInspectorTab === "mcp" ? "active-toggle" : ""}
                  onClick={() => setAgentInspectorTab("mcp")}
                >
                  MCP
                </button>
              </div>

              {agentInspectorTab === "overview" && (
                <>
                  <div className="muted">
                    Provider: {String((props.selectedNode?.data as Record<string, unknown>)?.providerId ?? "-")}
                  </div>
                  <div className="muted">Role: {selectedAgentProfile?.role ?? "custom"}</div>
                  <div className="muted">Skills: {agentSkills.length}</div>
                  <div className="muted">Rules: {agentRules.length}</div>
                  <div className="muted">MCP Servers: {agentMcpServers.length}</div>
                  <div className="muted">Common rules tracked: {props.snapshot?.commonRules.length ?? 0}</div>
                </>
              )}

              {agentInspectorTab === "skills" && (
                <>
                  {agentSkills.length === 0 && (
                    <div className="muted">No skills assigned to this agent.</div>
                  )}
                  {agentSkills.map((skill) => (
                    <div key={skill.id} className="validation-item">
                      {skill.name} · {skill.enabled ? "enabled" : "disabled"}
                    </div>
                  ))}
                </>
              )}

              {agentInspectorTab === "rules" && (
                <>
                  {agentRules.length === 0 && (
                    <div className="muted">No rule docs linked to this agent.</div>
                  )}
                  {agentRules.map((rule) => (
                    <div key={rule.id} className="validation-item">
                      {rule.path}
                    </div>
                  ))}
                </>
              )}

              {agentInspectorTab === "mcp" && (
                <>
                  <div className="muted">Servers: {agentMcpServers.length}</div>
                  {agentMcpServers.length > 2 && (
                    <div className="validation-item warning">
                      WARNING: More than 2 MCP servers can increase context cost.
                    </div>
                  )}
                  {agentMcpServers.map((server) => (
                    <div key={server.id} className="validation-item">
                      {server.name} · {server.kind} · {server.providerId} · {server.enabled ? "enabled" : "disabled"}
                    </div>
                  ))}
                  {agentMcpServers.length === 0 && (
                    <div className="muted">No MCP servers discovered for this agent.</div>
                  )}
                </>
              )}
            </div>
          )}

          {selectedType === "provider" && (
            <div className="inspector-block">
              <div className="inspector-title">Provider</div>
              <div className="inspector-heading">
                {String((props.selectedNode?.data as Record<string, unknown>)?.label ?? "")}
              </div>
              <div className="muted">
                Skills: {String((props.selectedNode?.data as Record<string, unknown>)?.skillCount ?? 0)}
              </div>
              <div className="muted">
                Rules: {String((props.selectedNode?.data as Record<string, unknown>)?.ruleCount ?? 0)}
              </div>
            </div>
          )}

          {selectedType === "note" && (
            <div className="inspector-block">
              <div className="inspector-title">Note</div>
              <div className="muted">Sticky note node. Drag to reposition on canvas.</div>
            </div>
          )}

              {selectedEdgeType === "interaction" && props.selectedEdge && (
                <InteractionEdgeInspector edge={props.selectedEdge} onSave={props.onUpdateInteractionEdge} />
              )}
            </>
          )}
        </div>
      )}

      {props.mode === "task" && (
        <TaskPanel
          agents={props.snapshot?.agents ?? []}
          tasks={props.tasks}
          runHistory={props.runHistory}
          activeRunId={props.activeRunId}
          onRunTask={props.onRunTask}
          onCancelTask={props.onCancelTask}
          onViewTaskDetail={props.onViewTaskDetail}
        />
      )}

      {props.mode === "run" && (
        <RunPanel
          activeFlowName={props.activeFlowName}
          selectedNodeId={props.selectedScheduleTaskId ?? props.selectedNode?.id}
          backends={props.runBackends}
          backendOverrides={props.backendOverrides}
          defaultBackendId={props.defaultBackendId}
          runs={props.runHistory}
          runEvents={props.runEvents}
          activeRunId={props.activeRunId}
          selectedRunId={props.selectedRunId}
          selectedTask={props.selectedScheduleTask}
          onRunFlow={props.onRunFlow}
          onRunNode={props.onRunNode}
          onReplayRun={props.onReplayRun}
          onStopRun={props.onStopRun}
          onRefreshRuns={props.onRefreshRunHistory}
          onSelectRun={props.onSelectRun}
          onPinOutput={props.onPinOutput}
          onUnpinOutput={props.onUnpinOutput}
          onSetBackendOverrides={props.onSetBackendOverrides}
          onSetDefaultBackend={props.onSetDefaultBackend}
          onTestBackend={props.onTestBackend}
          onOpenRunLog={props.onOpenRunLog}
        />
      )}
    </aside>
  );
}

function LibrarySkillItem(props: {
  skill: Skill;
  onOpen: (path: string) => void;
  onReveal: (path: string) => void;
  onValidate: (skillId: string) => void;
  onExport: (skillId: string) => void;
}) {
  const counts = useMemo(
    () => getValidationCounts(props.skill.validation),
    [props.skill.validation]
  );

  return (
    <div
      className="library-item draggable"
      draggable
      onDragStart={(event) => {
        event.currentTarget.classList.add("is-dragging");
        event.dataTransfer.setData(
          "application/agentcanvas-skill",
          JSON.stringify({
            type: "skill",
            id: props.skill.id,
            name: props.skill.name
          })
        );
        event.dataTransfer.effectAllowed = "copy";
      }}
      onDragEnd={(event) => {
        event.currentTarget.classList.remove("is-dragging");
      }}
    >
      <div className="item-main">
        <div className="item-title">{props.skill.name}</div>
        <div className="item-subtitle">{props.skill.description || "No description"}</div>
        <div className="item-badges">
          <span className={counts.errors ? "pill pill-error" : "pill"}>E {counts.errors}</span>
          <span className={counts.warnings ? "pill pill-warning" : "pill"}>W {counts.warnings}</span>
        </div>
      </div>
      <div className="item-actions">
        <button type="button" onClick={() => props.onOpen(props.skill.path)}>Open</button>
        <button type="button" onClick={() => props.onReveal(props.skill.path)}>Reveal</button>
        <button type="button" onClick={() => props.onValidate(props.skill.id)}>Validate</button>
        <button type="button" onClick={() => props.onExport(props.skill.id)}>Export</button>
      </div>
    </div>
  );
}

function InteractionEdgeInspector(props: {
  edge: Edge;
  onSave: (edgeId: string, update: { label?: string; data?: Record<string, unknown> }) => void;
}) {
  const [label, setLabel] = useState("");
  const [dataText, setDataText] = useState("{}");
  const [error, setError] = useState<string>();

  useEffect(() => {
    setLabel(String(props.edge.label ?? ""));
    setDataText(JSON.stringify((props.edge.data as Record<string, unknown> | undefined) ?? {}, null, 2));
    setError(undefined);
  }, [props.edge.id]);

  const save = () => {
    try {
      const parsedRaw = JSON.parse(dataText) as unknown;
      if (!isRecord(parsedRaw)) {
        setError("interaction data must be a JSON object");
        return;
      }
      const parsed = parsedRaw as Record<string, unknown>;
      const termination = parsed.termination as Record<string, unknown> | undefined;
      if (!termination || typeof termination.type !== "string") {
        setError("termination is required for interaction edges");
        return;
      }
      setError(undefined);
      props.onSave(props.edge.id, {
        label: label.trim() || undefined,
        data: parsed
      });
    } catch {
      setError("interaction data must be valid JSON");
    }
  };

  return (
    <div className="inspector-block">
      <div className="inspector-title">Interaction Edge</div>
      <div className="inspector-path">{props.edge.source} → {props.edge.target}</div>
      <div className="inspector-field">
        <label>Label</label>
        <input value={label} onChange={(event) => setLabel(event.target.value)} />
      </div>
      <div className="inspector-field">
        <label>Interaction Data (JSON)</label>
        <textarea
          rows={10}
          value={dataText}
          onChange={(event) => setDataText(event.target.value)}
          className={error ? "invalid-json" : ""}
        />
      </div>
      {error && <div className="validation-item error">{error}</div>}
      <div className="inspector-actions">
        <button onClick={save}>Save interaction</button>
      </div>
    </div>
  );
}

function SkillInspector(props: {
  selectedNode?: Node;
  onOpenFile: (path: string) => void;
  onRevealPath: (path: string) => void;
  onValidate: (skillId: string) => void;
  onExport: (skillId: string) => void;
  onSave: (
    skillId: string,
    name: string,
    description: string,
    extraFrontmatter: Record<string, unknown>
  ) => void;
  saveSignal: number;
}) {
  const node = props.selectedNode;
  const data = (node?.data ?? {}) as Record<string, unknown>;
  const skillId = String(data.id ?? "");
  const validation = ((data.validation as unknown[]) ?? []) as Array<{
    level: "error" | "warning";
    message: string;
  }>;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [extraFrontmatterText, setExtraFrontmatterText] = useState("{}");
  const [jsonError, setJsonError] = useState<string>();

  useEffect(() => {
    setName(String(data.name ?? ""));
    setDescription(String(data.description ?? ""));
    const extraFrontmatter = (data.extraFrontmatter as Record<string, unknown> | undefined) ?? {};
    setExtraFrontmatterText(JSON.stringify(extraFrontmatter, null, 2));
    setJsonError(undefined);
  }, [skillId]);

  const handleSave = useCallback(() => {
    try {
      const parsed = JSON.parse(extraFrontmatterText) as Record<string, unknown>;
      setJsonError(undefined);
      props.onSave(skillId, name, description, parsed);
    } catch {
      setJsonError("extra frontmatter must be valid JSON");
    }
  }, [description, extraFrontmatterText, name, props.onSave, skillId]);

  useEffect(() => {
    if (!skillId || props.saveSignal === 0) {
      return;
    }
    handleSave();
  }, [handleSave, props.saveSignal, skillId]);

  return (
    <div className="inspector-block">
      <div className="inspector-title">Skill</div>
      <div className="inspector-field">
        <label>Name</label>
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="inspector-field">
        <label>Description</label>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
        />
      </div>
      <div className="inspector-field">
        <label>Extra frontmatter (JSON)</label>
        <textarea
          value={extraFrontmatterText}
          onChange={(event) => setExtraFrontmatterText(event.target.value)}
          rows={6}
          className={jsonError ? "invalid-json" : ""}
        />
      </div>
      {jsonError && <div className="validation-item error">ERROR: {jsonError}</div>}

      <div className="inspector-actions wrap">
        <button onClick={() => props.onOpenFile(String(data.path ?? ""))}>Open SKILL.md</button>
        <button onClick={() => props.onRevealPath(String(data.path ?? ""))}>Reveal folder</button>
        <button onClick={() => props.onValidate(String(data.id ?? ""))}>Validate</button>
        <button onClick={() => props.onExport(String(data.id ?? ""))}>Export</button>
        <button onClick={handleSave}>Save frontmatter</button>
      </div>

      <div className="inspector-title muted-title">Validation</div>
      {validation.length === 0 && <div className="muted">No errors or warnings</div>}
      {validation.map((item, index) => (
        <div key={`${item.level}-${index}`} className={`validation-item ${item.level}`}>
          {item.level.toUpperCase()}: {item.message}
        </div>
      ))}
    </div>
  );
}

function RuleInspector(props: {
  selectedNode?: Node;
  onOpenFile: (path: string) => void;
  onRevealPath: (path: string) => void;
  onCreateOverride: (path: string) => void;
}) {
  const data = (props.selectedNode?.data ?? {}) as Record<string, unknown>;

  return (
    <div className="inspector-block">
      <div className="inspector-title">Rule Doc</div>
      <div className="inspector-path">{String(data.path ?? "")}</div>
      <div className="muted">chain order: {Number(data.orderIndex ?? 0) + 1}</div>
      <div className="inspector-actions">
        <button onClick={() => props.onOpenFile(String(data.path ?? ""))}>Open</button>
        <button onClick={() => props.onCreateOverride(String(data.path ?? ""))}>Create override</button>
        <button onClick={() => props.onRevealPath(String(data.path ?? ""))}>Reveal</button>
      </div>
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
