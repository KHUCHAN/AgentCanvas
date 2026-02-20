import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Edge, Node } from "reactflow";
import GraphView from "./canvas/GraphView";
import ScheduleView from "./canvas/ScheduleView";
import ErrorBoundary from "./ErrorBoundary";
import {
  cleanupBridge,
  onExtensionMessage,
  postToExtension,
  requestToExtension
} from "./messaging/vscodeBridge";
import type {
  AgentRuntime,
  AgentRole,
  CacheConfig,
  CacheMetrics,
  CliBackend,
  CliBackendOverrides,
  DiscoverySnapshot,
  ExtensionToWebviewMessage,
  GeneratedAgentStructure,
  InteractionEdgeData,
  MemoryCommit,
  MemoryItem,
  MemoryNamespace,
  MemoryQueryResult,
  Position,
  PromptHistoryEntry,
  RunEvent,
  RunSummary,
  SessionContext,
  StudioEdge,
  StudioNode,
  SkillPackPreview,
  Task,
  TaskEvent,
  TaskSubmissionOptions
} from "./messaging/protocol";
import type { PatternIndexItem, PatternTemplate } from "./patterns/types";
import BuildPromptBar from "./components/BuildPromptBar";
import AgentDetailModal from "./panels/AgentDetailModal";
import AgentCreationModal from "./panels/AgentCreationModal";
import AgentPreviewModal from "./panels/AgentPreviewModal";
import CommandBar from "./panels/CommandBar";
import CommonRuleModal from "./panels/CommonRuleModal";
import ImportPreviewModal from "./panels/ImportPreviewModal";
import KeyboardHelpModal from "./panels/KeyboardHelpModal";
import RightPanel from "./panels/RightPanel";
import SettingsModal from "./panels/SettingsModal";
import StatusBar from "./panels/StatusBar";
import SkillWizardModal from "./panels/SkillWizardModal";
import { getValidationCounts } from "./utils/validation";
import logo from "./assets/agentcanvas_icon_28.png";
import toastInfoIcon from "./assets/micro/agentcanvas_micro_toast_info.svg";
import toastWarnIcon from "./assets/micro/agentcanvas_micro_toast_warn.svg";
import toastErrorIcon from "./assets/micro/agentcanvas_micro_toast_error.svg";
import KanbanView from "./views/KanbanView";
import type { TaskPanelOptions } from "./panels/TaskPanel";

type ScheduleRunState = {
  tasks: Task[];
  originNowMs: number;
  nowMs: number;
  anchorNowMs: number;
  anchorWallMs: number;
};

type ScheduleViewState = {
  tasks: Task[];
  nowMs: number;
};

const DEFAULT_CACHE_CONFIG: CacheConfig = {
  retention: "long",
  contextPruning: {
    mode: "cache-ttl",
    ttlSeconds: 3600
  },
  diagnostics: {
    enabled: false,
    logPath: ".agentcanvas/logs/cache-trace.jsonl"
  },
  modelRouting: {
    heartbeat: "haiku-4.5",
    cron: "haiku-4.5",
    default: "sonnet-4.5"
  },
  contextThreshold: 180000
};

const EMPTY_CACHE_METRICS: CacheMetrics = {
  cacheRead: 0,
  cacheWrite: 0,
  inputTokens: 0,
  outputTokens: 0,
  cost: 0,
  savedCost: 0,
  model: "sonnet-4.5",
  hitRate: 0
};

export default function App() {
  const [snapshot, setSnapshot] = useState<DiscoverySnapshot>();
  const [selectedNode, setSelectedNode] = useState<Node>();
  const [selectedEdge, setSelectedEdge] = useState<Edge>();
  const [panelMode, setPanelMode] = useState<"library" | "inspector" | "task" | "run">("library");
  const [canvasMode, setCanvasMode] = useState<"kanban" | "graph" | "schedule">("graph");
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [hiddenNodeIds, setHiddenNodeIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ level: "info" | "warning" | "error"; message: string }>();
  const [commandBarOpen, setCommandBarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [forceBuildPrompt, setForceBuildPrompt] = useState(false);
  const [importPreview, setImportPreview] = useState<SkillPackPreview>();
  const [commonRuleModalOpen, setCommonRuleModalOpen] = useState(false);
  const [skillWizardOpen, setSkillWizardOpen] = useState(false);
  const [saveSignal, setSaveSignal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false);
  const [agentCreationOpen, setAgentCreationOpen] = useState(false);
  const [agentDetailModal, setAgentDetailModal] = useState<{
    agentId: string;
    agentName: string;
  } | null>(null);
  const [promptBackends, setPromptBackends] = useState<CliBackend[]>([]);
  const [promptHistory, setPromptHistory] = useState<PromptHistoryEntry[]>([]);
  const [generationProgress, setGenerationProgress] = useState<{
    stage: "building_prompt" | "calling_cli" | "parsing_output" | "done" | "error";
    message: string;
    progress?: number;
  }>();
  const [buildPromptText, setBuildPromptText] = useState("");
  const [buildPromptBackendId, setBuildPromptBackendId] = useState<CliBackend["id"]>("auto");
  const [buildPromptIncludeExistingAgents, setBuildPromptIncludeExistingAgents] = useState(true);
  const [buildPromptIncludeExistingSkills, setBuildPromptIncludeExistingSkills] = useState(true);
  const [buildPromptIncludeExistingMcpServers, setBuildPromptIncludeExistingMcpServers] = useState(true);
  const [generatedPreview, setGeneratedPreview] = useState<{
    structure: GeneratedAgentStructure;
    historyId?: string;
  }>();
  const [interactionPatterns, setInteractionPatterns] = useState<PatternIndexItem[]>([]);
  const [patternTemplates, setPatternTemplates] = useState<Record<string, PatternTemplate>>({});
  const [patternNodes, setPatternNodes] = useState<StudioNode[]>([]);
  const [patternEdges, setPatternEdges] = useState<StudioEdge[]>([]);
  const [activeFlowName, setActiveFlowName] = useState("default");
  const [runHistory, setRunHistory] = useState<RunSummary[]>([]);
  const [runEvents, setRunEvents] = useState<RunEvent[]>([]);
  const [backendOverrides, setBackendOverridesState] = useState<CliBackendOverrides>({});
  const [defaultBackendId, setDefaultBackendId] = useState<CliBackend["id"]>("auto");
  const [selectedRunId, setSelectedRunId] = useState<string>();
  const [activeRunId, setActiveRunId] = useState<string>();
  const [scheduleRunId, setScheduleRunId] = useState<string>();
  const [scheduleViewState, setScheduleViewState] = useState<ScheduleViewState>({
    tasks: [],
    nowMs: 0
  });
  const [selectedScheduleTaskId, setSelectedScheduleTaskId] = useState<string>();
  const [cacheConfig, setCacheConfig] = useState<CacheConfig>(DEFAULT_CACHE_CONFIG);
  const [cacheMetrics, setCacheMetrics] = useState<CacheMetrics>(EMPTY_CACHE_METRICS);
  const [memoryItems, setMemoryItems] = useState<MemoryItem[]>([]);
  const [memoryCommits, setMemoryCommits] = useState<MemoryCommit[]>([]);
  const [memoryQueryResult, setMemoryQueryResult] = useState<MemoryQueryResult>();
  const [contextThresholdWarning, setContextThresholdWarning] = useState<{
    current: number;
    threshold: number;
  }>();
  const scheduleOriginNowRef = useRef(0);
  const scheduleAnchorNowRef = useRef(0);
  const scheduleAnchorWallMsRef = useRef(Date.now());
  const scheduleRunIdRef = useRef<string>();
  const scheduleRunStateRef = useRef<Map<string, ScheduleRunState>>(new Map());

  useEffect(() => {
    scheduleRunIdRef.current = scheduleRunId;
  }, [scheduleRunId]);

  const showErrorToast = useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    setToast({ level: "error", message });
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => {
      setToast(undefined);
    }, 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const applyScheduleEvent = useCallback((event: TaskEvent) => {
    const cache = scheduleRunStateRef.current;
    const previous = cache.get(event.runId);
    const originNowMs = previous?.originNowMs ?? event.nowMs;
    const tasks = applyTaskEvent(previous?.tasks ?? [], event);
    const nowMs = Math.max(0, event.nowMs - originNowMs);
    const anchorWallMs = Date.now();
    const nextState: ScheduleRunState = {
      tasks,
      originNowMs,
      nowMs,
      anchorNowMs: nowMs,
      anchorWallMs
    };
    cache.set(event.runId, nextState);

    const currentRunId = scheduleRunIdRef.current;
    if (!currentRunId) {
      scheduleRunIdRef.current = event.runId;
      setScheduleRunId(event.runId);
    }
    if ((scheduleRunIdRef.current ?? event.runId) !== event.runId) {
      return;
    }

    scheduleOriginNowRef.current = nextState.originNowMs;
    scheduleAnchorNowRef.current = nextState.anchorNowMs;
    scheduleAnchorWallMsRef.current = nextState.anchorWallMs;
    setScheduleViewState({
      tasks: nextState.tasks,
      nowMs: nextState.nowMs
    });
    if (event.type === "task_deleted") {
      setSelectedScheduleTaskId((current) => (current === event.taskId ? undefined : current));
    }
  }, []);

  useEffect(() => {
    const dispose = onExtensionMessage((message) => {
      if (message.type === "SCHEDULE_EVENT") {
        applyScheduleEvent(message.payload.event);
        return;
      }
      handleExtensionMessage(message, {
        setSnapshot,
        setToast,
        setHiddenNodeIds,
        setSelectedNode,
        setSelectedEdge,
        setImportPreview,
        setPromptBackends,
        setPromptHistory,
        setGenerationProgress,
        setRunEvents,
        setCacheMetrics,
        setMemoryItems,
        setMemoryQueryResult,
        setContextThresholdWarning
      });
    });

    postToExtension({ type: "READY" });
    return () => {
      dispose();
      cleanupBridge();
    };
  }, [applyScheduleEvent]);

  useEffect(() => {
    void requestToExtension({ type: "DETECT_CLI_BACKENDS" }).catch(showErrorToast);
    void requestToExtension({ type: "GET_PROMPT_HISTORY" }).catch(showErrorToast);
    void requestToExtension<{ config: CacheConfig }>({ type: "GET_CACHE_CONFIG" })
      .then((result) => setCacheConfig(result.config ?? DEFAULT_CACHE_CONFIG))
      .catch(showErrorToast);
  }, [showErrorToast]);

  useEffect(() => {
    void loadInteractionPatternIndex()
      .then((items) => setInteractionPatterns(items))
      .catch(showErrorToast);
  }, [showErrorToast]);

  useEffect(() => {
    if (!scheduleRunId) {
      return;
    }
    let canceled = false;
    let timer = 0;
    const tick = () => {
      if (canceled) {
        return;
      }
      const elapsedMs = Date.now() - scheduleAnchorWallMsRef.current;
      const nextNowMs = Math.max(0, scheduleAnchorNowRef.current + elapsedMs);
      setScheduleViewState((current) => ({
        ...current,
        nowMs: nextNowMs
      }));
      const runState = scheduleRunStateRef.current.get(scheduleRunId);
      if (runState) {
        runState.nowMs = nextNowMs;
      }
      timer = window.setTimeout(tick, 250);
    };
    timer = window.setTimeout(tick, 250);
    return () => {
      canceled = true;
      window.clearTimeout(timer);
    };
  }, [scheduleRunId]);

  const generatedAtText = useMemo(() => {
    if (!snapshot?.generatedAt) {
      return "-";
    }
    return new Date(snapshot.generatedAt).toLocaleTimeString();
  }, [snapshot?.generatedAt]);

  const baseSnapshotMaps = useMemo(() => {
    if (!snapshot) {
      return undefined;
    }
    return {
      nodeMap: new Map<string, StudioNode>(snapshot.nodes.map((node) => [node.id, node])),
      edgeMap: new Map<string, StudioEdge>(snapshot.edges.map((edge) => [edge.id, edge]))
    };
  }, [snapshot]);

  const composedSnapshot = useMemo(() => {
    if (!snapshot || !baseSnapshotMaps) {
      return undefined;
    }
    if (patternNodes.length === 0 && patternEdges.length === 0) {
      return snapshot;
    }

    const nodeMap = new Map(baseSnapshotMaps.nodeMap);
    for (const node of patternNodes) {
      nodeMap.set(node.id, node);
    }

    const edgeMap = new Map(baseSnapshotMaps.edgeMap);
    for (const edge of patternEdges) {
      edgeMap.set(edge.id, edge);
    }

    return {
      ...snapshot,
      nodes: [...nodeMap.values()],
      edges: [...edgeMap.values()]
    };
  }, [baseSnapshotMaps, patternEdges, patternNodes, snapshot]);

  const graphSnapshot = useMemo(() => {
    if (!composedSnapshot) {
      return undefined;
    }
    const baseTypes = new Set(["agent", "commonRules", "system", "provider", "note"]);
    const nodes = composedSnapshot.nodes;
    const edges = composedSnapshot.edges;
    if (!expandedAgentId) {
      const allowed = nodes.filter((node) => baseTypes.has(node.type));
      if (allowed.length === 0) {
        return composedSnapshot;
      }
      const allowedIds = new Set(allowed.map((node) => node.id));
      return {
        ...composedSnapshot,
        nodes: allowed,
        edges: edges.filter((edge) => allowedIds.has(edge.source) && allowedIds.has(edge.target))
      };
    }

    const linkedIds = new Set<string>([expandedAgentId]);
    for (const edge of edges) {
      if (edge.source === expandedAgentId) {
        linkedIds.add(edge.target);
      }
      if (edge.target === expandedAgentId) {
        linkedIds.add(edge.source);
      }
    }

    const allowed = nodes.filter((node) => {
      if (baseTypes.has(node.type)) {
        return true;
      }
      if (linkedIds.has(node.id)) {
        return true;
      }
      const owner = String((node.data as Record<string, unknown> | undefined)?.ownerAgentId ?? "");
      return owner === expandedAgentId;
    });
    if (allowed.length === 0) {
      return composedSnapshot;
    }
    const allowedIds = new Set(allowed.map((node) => node.id));
    return {
      ...composedSnapshot,
      nodes: allowed,
      edges: edges.filter((edge) => allowedIds.has(edge.source) && allowedIds.has(edge.target))
    };
  }, [composedSnapshot, expandedAgentId]);

  const summary = useMemo(() => {
    const skills = snapshot?.skills ?? [];
    let errors = 0;
    let warnings = 0;
    for (const skill of skills) {
      const counts = getValidationCounts(skill.validation);
      errors += counts.errors;
      warnings += counts.warnings;
    }
    return {
      skills: skills.length,
      rules: snapshot?.ruleDocs.length ?? 0,
      errors,
      warnings
    };
  }, [snapshot?.ruleDocs.length, snapshot?.skills]);

  const focusLabel = useMemo(() => {
    if (selectedNode?.id) {
      return `Node:${selectedNode.id}`;
    }
    if (selectedEdge?.id) {
      return `Edge:${selectedEdge.id}`;
    }
    if (selectedScheduleTaskId) {
      return `Task:${selectedScheduleTaskId}`;
    }
    return `${canvasMode}/${panelMode}`;
  }, [canvasMode, panelMode, selectedEdge?.id, selectedNode?.id, selectedScheduleTaskId]);

  const selectedScheduleTask = useMemo(
    () => scheduleViewState.tasks.find((task) => task.id === selectedScheduleTaskId),
    [scheduleViewState.tasks, selectedScheduleTaskId]
  );

  const hasTeamReady = useMemo(() => {
    const customAgents =
      snapshot?.agents.filter((agent) => agent.id.startsWith("custom:") || agent.providerId === "custom").length ??
      0;
    return (
      customAgents > 0 ||
      patternNodes.length > 0 ||
      runHistory.length > 0 ||
      promptHistory.some((item) => item.applied) ||
      (snapshot?.agents.length ?? 0) > 2
    );
  }, [patternNodes.length, promptHistory, runHistory.length, snapshot?.agents]);

  const buildPromptExpanded = forceBuildPrompt || !hasTeamReady;

  const runSummary = useMemo(() => {
    const total = scheduleViewState.tasks.length;
    const done = scheduleViewState.tasks.filter((task) => task.status === "done" || task.status === "canceled").length;
    const failed = scheduleViewState.tasks.filter((task) => task.status === "failed").length;
    return { total, done, failed };
  }, [scheduleViewState.tasks]);

  const contextUsed = useMemo(() => {
    const tracked = cacheMetrics.inputTokens + cacheMetrics.cacheRead + cacheMetrics.cacheWrite;
    return Math.max(tracked, contextThresholdWarning?.current ?? 0);
  }, [
    cacheMetrics.cacheRead,
    cacheMetrics.cacheWrite,
    cacheMetrics.inputTokens,
    contextThresholdWarning?.current
  ]);

  const contextState = useMemo(() => {
    if (contextUsed >= cacheConfig.contextThreshold) {
      return "danger";
    }
    if (contextUsed >= Math.min(150000, cacheConfig.contextThreshold)) {
      return "warn";
    }
    return "ok";
  }, [cacheConfig.contextThreshold, contextUsed]);

  const cacheSavedRate = useMemo(() => {
    const baseline = cacheMetrics.cost + cacheMetrics.savedCost;
    if (baseline <= 0) {
      return 0;
    }
    return Math.max(0, Math.min(1, cacheMetrics.savedCost / baseline));
  }, [cacheMetrics.cost, cacheMetrics.savedCost]);

  const skillBaseOptions = useMemo(() => {
    const workspaceRoot = snapshot?.agent.workspaceRoot;
    const homeDir = snapshot?.agent.homeDir;
    const candidates = [
      workspaceRoot ? { label: "Project · .github/skills", path: `${workspaceRoot}/.github/skills` } : undefined,
      workspaceRoot ? { label: "Project · .claude/skills", path: `${workspaceRoot}/.claude/skills` } : undefined,
      workspaceRoot ? { label: "Project · .gemini/skills", path: `${workspaceRoot}/.gemini/skills` } : undefined,
      homeDir ? { label: "Personal · ~/.copilot/skills", path: `${homeDir}/.copilot/skills` } : undefined,
      homeDir ? { label: "Personal · ~/.claude/skills", path: `${homeDir}/.claude/skills` } : undefined,
      homeDir ? { label: "Personal · ~/.gemini/skills", path: `${homeDir}/.gemini/skills` } : undefined
    ].filter((item): item is { label: string; path: string } => Boolean(item));

    const seen = new Set<string>();
    const unique = candidates.filter((item) => {
      if (seen.has(item.path)) {
        return false;
      }
      seen.add(item.path);
      return true;
    });
    if (unique.length === 0) {
      return [{ label: "Project · .github/skills", path: ".github/skills" }];
    }
    return unique;
  }, [snapshot?.agent.homeDir, snapshot?.agent.workspaceRoot]);

  const defaultSkillBasePath = skillBaseOptions[0]?.path ?? ".github/skills";

  const createSkill = (name: string, description: string) => {
    postToExtension({
      type: "CREATE_SKILL",
      payload: {
        baseDirPath: defaultSkillBasePath,
        name,
        description,
        scope: "project"
      }
    });
  };

  const exportSkills = (skillIds: string[]) => {
    const ids = skillIds.length > 0 ? skillIds : snapshot?.skills.map((skill) => skill.id) ?? [];
    postToExtension({
      type: "EXPORT_PACK",
      payload: {
        skillIds: ids
      }
    });
  };

  const openFile = (path: string) => {
    if (!path) {
      return;
    }
    postToExtension({ type: "OPEN_FILE", payload: { path } });
  };

  const revealPath = (path: string) => {
    if (!path) {
      return;
    }
    postToExtension({ type: "REVEAL_IN_EXPLORER", payload: { path } });
  };

  const validateSkill = (skillId: string) => {
    if (!skillId) {
      return;
    }
    postToExtension({ type: "RUN_VALIDATION", payload: { skillId } });
  };

  const toggleSkillEnabled = (skillId: string, enabled: boolean) => {
    postToExtension({
      type: "SET_SKILL_ENABLED",
      payload: { skillId, enabled }
    });
  };

  const createOverride = (sourceRulePath: string) => {
    if (!sourceRulePath) {
      return;
    }
    postToExtension({
      type: "CREATE_OVERRIDE",
      payload: { sourceRulePath }
    });
  };

  const addCommonRule = (title: string, body: string) => {
    postToExtension({
      type: "ADD_COMMON_RULE",
      payload: { title, body }
    });
  };

  const saveSkillFrontmatter = (
    skillId: string,
    name: string,
    description: string,
    extraFrontmatter: Record<string, unknown>
  ) => {
    postToExtension({
      type: "UPDATE_SKILL_FRONTMATTER",
      payload: {
        skillId,
        name,
        description,
        extraFrontmatter
      }
    });
  };

  const hideNode = (nodeId: string) => {
    setHiddenNodeIds((prev) => {
      const next = new Set(prev);
      next.add(nodeId);
      return next;
    });

    if (selectedNode?.id === nodeId) {
      setSelectedNode(undefined);
      setPanelMode("library");
    }
  };

  const refreshDiscovery = useCallback(() => {
    postToExtension({ type: "REFRESH" });
    setHiddenNodeIds(new Set());
  }, []);

  const runValidationAll = () => {
    setBusy(true);
    void requestToExtension<{ skills: number; errors: number; warnings: number }>({
      type: "RUN_VALIDATION_ALL"
    })
      .catch(showErrorToast)
      .finally(() => setBusy(false));
  };

  const requestImportPreview = () => {
    setBusy(true);
    void requestToExtension<{ previewed: number }>({
      type: "REQUEST_IMPORT_PREVIEW"
    })
      .catch(showErrorToast)
      .finally(() => setBusy(false));
  };

  const createSkillFromWizard = async (input: {
    baseDirPath: string;
    name: string;
    description: string;
    scope: "project" | "personal" | "shared" | "global";
    generateOpenAiYaml: boolean;
  }) => {
    setBusy(true);
    try {
      await requestToExtension({
        type: "CREATE_SKILL",
        payload: {
          baseDirPath: input.baseDirPath,
          name: input.name,
          description: input.description,
          scope: input.scope,
          extraFrontmatter: {
            metadata: {
              scope: input.scope
            }
          },
          generateOpenAiYaml: input.generateOpenAiYaml
        }
      });
      setSkillWizardOpen(false);
      setPanelMode("library");
      setPanelOpen(true);
    } catch (error) {
      showErrorToast(error);
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const addNote = (position: Position, text?: string) => {
    postToExtension({
      type: "ADD_NOTE",
      payload: {
        position,
        text
      }
    });
  };

  const saveNote = (noteId: string, text: string, position?: Position) => {
    postToExtension({
      type: "SAVE_NOTE",
      payload: {
        noteId,
        text,
        position
      }
    });
  };

  const deleteNote = (noteId: string) => {
    postToExtension({
      type: "DELETE_NOTE",
      payload: { noteId }
    });
  };

  const ensureRootAgents = () => {
    setBusy(true);
    void requestToExtension<{ path?: string }>({
      type: "ENSURE_ROOT_AGENTS"
    })
      .catch(showErrorToast)
      .finally(() => setBusy(false));
  };

  const openCommonRulesFolder = () => {
    setBusy(true);
    void requestToExtension<{ path?: string }>({
      type: "OPEN_COMMON_RULES_FOLDER"
    })
      .catch(showErrorToast)
      .finally(() => setBusy(false));
  };

  const createCommonRuleDocs = () => {
    setBusy(true);
    void requestToExtension<{ created?: string[] }>({
      type: "CREATE_COMMON_RULE_DOCS"
    })
      .catch(showErrorToast)
      .finally(() => setBusy(false));
  };

  const saveNodePosition = (nodeId: string, position: Position) => {
    postToExtension({
      type: "SAVE_NODE_POSITION",
      payload: { nodeId, position }
    });
  };

  const addAgentLink = (sourceAgentId: string, targetAgentId: string) => {
    postToExtension({
      type: "ADD_AGENT_LINK",
      payload: { sourceAgentId, targetAgentId }
    });
  };

  const updateAgentProfile = (payload: {
    agentId: string;
    role: AgentRole;
    roleLabel?: string;
    description?: string;
    systemPrompt?: string;
    isOrchestrator: boolean;
    color?: string;
    avatar?: string;
  }) => {
    postToExtension({
      type: "UPDATE_AGENT_PROFILE",
      payload
    });
  };

  const setAgentRuntime = (agentId: string, runtime: AgentRuntime | null) => {
    postToExtension({
      type: "SET_AGENT_RUNTIME",
      payload: { agentId, runtime }
    });
  };

  const setAgentDelegation = (agentId: string, workerIds: string[]) => {
    postToExtension({
      type: "SET_DELEGATION",
      payload: { orchestratorId: agentId, workerIds }
    });
  };

  const assignSkillToAgent = (agentId: string, skillId: string) => {
    postToExtension({
      type: "ASSIGN_SKILL_TO_AGENT",
      payload: { agentId, skillId }
    });
  };

  const unassignSkillFromAgent = (agentId: string, skillId: string) => {
    postToExtension({
      type: "UNASSIGN_SKILL_FROM_AGENT",
      payload: { agentId, skillId }
    });
  };

  const assignMcpToAgent = (agentId: string, mcpServerId: string) => {
    postToExtension({
      type: "ASSIGN_MCP_TO_AGENT",
      payload: { agentId, mcpServerId }
    });
  };

  const unassignMcpFromAgent = (agentId: string, mcpServerId: string) => {
    postToExtension({
      type: "UNASSIGN_MCP_FROM_AGENT",
      payload: { agentId, mcpServerId }
    });
  };

  const createAgent = async (payload: {
    name: string;
    role: AgentRole;
    roleLabel?: string;
    description?: string;
    systemPrompt?: string;
    isOrchestrator: boolean;
  }) => {
    setBusy(true);
    try {
      await requestToExtension({
        type: "CREATE_AGENT",
        payload
      });
      setAgentCreationOpen(false);
      setForceBuildPrompt(false);
      setCanvasMode("kanban");
      setPanelMode("inspector");
      setPanelOpen(true);
    } catch (error) {
      showErrorToast(error);
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const deleteAgent = async (agentId: string) => {
    setBusy(true);
    try {
      await requestToExtension({
        type: "DELETE_AGENT",
        payload: { agentId }
      });
      setAgentDetailModal(null);
    } catch (error) {
      showErrorToast(error);
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const refreshPromptTools = async () => {
    setBusy(true);
    try {
      await Promise.all([
        requestToExtension({ type: "DETECT_CLI_BACKENDS" }),
        requestToExtension({ type: "GET_PROMPT_HISTORY" })
      ]);
    } catch (error) {
      showErrorToast(error);
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const generateAgentStructure = async (payload: {
    prompt: string;
    backendId: CliBackend["id"];
    includeExistingAgents: boolean;
    includeExistingSkills: boolean;
    includeExistingMcpServers: boolean;
  }) => {
    setBusy(true);
    try {
      const result = await requestToExtension<{
        structure: GeneratedAgentStructure;
        historyEntry?: PromptHistoryEntry;
      }>(
        {
          type: "GENERATE_AGENT_STRUCTURE",
          payload
        },
        180_000
      );
      if (result.structure) {
        setGeneratedPreview({
          structure: result.structure,
          historyId: result.historyEntry?.id
        });
      }
      setPanelMode("inspector");
      setPanelOpen(true);
    } catch (error) {
      showErrorToast(error);
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const buildTeamFromPromptBar = async () => {
    const prompt = buildPromptText.trim();
    if (!prompt || busy) {
      return;
    }
    await generateAgentStructure({
      prompt,
      backendId: buildPromptBackendId,
      includeExistingAgents: buildPromptIncludeExistingAgents,
      includeExistingSkills: buildPromptIncludeExistingSkills,
      includeExistingMcpServers: buildPromptIncludeExistingMcpServers
    });
  };

  const applyGeneratedStructure = async (payload: {
    structure: GeneratedAgentStructure;
    createSuggestedSkills: boolean;
    overwriteExisting: boolean;
    historyId?: string;
  }) => {
    setBusy(true);
    try {
      await requestToExtension({
        type: "APPLY_GENERATED_STRUCTURE",
        payload
      });
      setGeneratedPreview(undefined);
      setForceBuildPrompt(false);
      setCanvasMode("kanban");
      setPanelMode("inspector");
      setPanelOpen(true);
    } catch (error) {
      showErrorToast(error);
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const deletePromptHistory = async (historyId: string) => {
    setBusy(true);
    try {
      await requestToExtension({
        type: "DELETE_PROMPT_HISTORY",
        payload: { historyId }
      });
    } catch (error) {
      showErrorToast(error);
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const reapplyPromptHistory = async (historyId: string) => {
    setBusy(true);
    try {
      await requestToExtension(
        {
          type: "REAPPLY_PROMPT_HISTORY",
          payload: { historyId }
        },
        120_000
      );
      setForceBuildPrompt(false);
      setCanvasMode("kanban");
      setPanelMode("inspector");
      setPanelOpen(true);
    } catch (error) {
      showErrorToast(error);
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const refreshMemory = useCallback(async () => {
    setBusy(true);
    try {
      const [itemsResult, commitsResult] = await Promise.all([
        requestToExtension<{ items: MemoryItem[] }>({
          type: "GET_MEMORY_ITEMS",
          payload: { limit: 250 }
        }),
        requestToExtension<{ commits: MemoryCommit[] }>({
          type: "GET_MEMORY_COMMITS",
          payload: { limit: 120 }
        })
      ]);
      setMemoryItems(itemsResult.items ?? []);
      setMemoryCommits(commitsResult.commits ?? []);
    } catch (error) {
      showErrorToast(error);
      throw error;
    } finally {
      setBusy(false);
    }
  }, [showErrorToast]);

  const searchMemory = useCallback(
    async (query: string, namespaces?: MemoryNamespace[]) => {
      setBusy(true);
      try {
        const result = await requestToExtension<{ result: MemoryQueryResult }>({
          type: "SEARCH_MEMORY",
          payload: {
            query: query.trim(),
            namespaces,
            budgetTokens: 1200
          }
        });
        setMemoryQueryResult(result.result);
      } catch (error) {
        showErrorToast(error);
        throw error;
      } finally {
        setBusy(false);
      }
    },
    [showErrorToast]
  );

  const addMemoryItem = useCallback(
    async (item: Omit<MemoryItem, "id" | "createdAt" | "updatedAt">) => {
      setBusy(true);
      try {
        await requestToExtension({
          type: "ADD_MEMORY_ITEM",
          payload: { item }
        });
        await refreshMemory();
      } catch (error) {
        showErrorToast(error);
        throw error;
      } finally {
        setBusy(false);
      }
    },
    [refreshMemory, showErrorToast]
  );

  const supersedeMemory = useCallback(
    async (oldItemId: string, newContent: string, reason: string) => {
      setBusy(true);
      try {
        await requestToExtension({
          type: "SUPERSEDE_MEMORY",
          payload: { oldItemId, newContent, reason }
        });
        await refreshMemory();
      } catch (error) {
        showErrorToast(error);
        throw error;
      } finally {
        setBusy(false);
      }
    },
    [refreshMemory, showErrorToast]
  );

  const checkoutMemory = useCallback(
    async (commitId: string) => {
      setBusy(true);
      try {
        await requestToExtension({
          type: "MEMORY_CHECKOUT",
          payload: { commitId }
        });
        await refreshDiscovery();
        await refreshMemory();
      } catch (error) {
        showErrorToast(error);
        throw error;
      } finally {
        setBusy(false);
      }
    },
    [refreshDiscovery, refreshMemory, showErrorToast]
  );

  const insertInteractionPattern = async (patternId: string, anchor?: Position) => {
    setBusy(true);
    try {
      const template =
        patternTemplates[patternId] ?? (await loadInteractionPatternTemplate(patternId));
      if (!patternTemplates[patternId]) {
        setPatternTemplates((prev) => ({ ...prev, [patternId]: template }));
      }

      const invalidEdge = template.edges.find((edge) => !edge.data?.termination);
      if (invalidEdge) {
        throw new Error(`Pattern ${patternId} is invalid: termination is required`);
      }

      const instanceId = `pattern:${patternId}:${Date.now().toString(36)}`;
      const idMap = new Map<string, string>();
      const anchorX = anchor?.x ?? selectedNode?.position?.x ?? 860;
      const anchorY = anchor?.y ?? selectedNode?.position?.y ?? 220;

      const createdNodes: StudioNode[] = template.nodes.map((node, index) => {
        const id = `${instanceId}:n${index + 1}`;
        idMap.set(node.id, id);
        const position = {
          x: anchorX + (node.position?.x ?? index * 180),
          y: anchorY + (node.position?.y ?? (index % 2) * 130)
        };

        if (node.type === "system") {
          const role = String(node.data.role ?? "System");
          return {
            id,
            type: "system",
            position,
            data: {
              id,
              name: String(node.data.label ?? role),
              role,
              description: String(node.data.description ?? `${patternId} coordinator`)
            }
          };
        }

        const role = String(node.data.role ?? "custom");
        return {
          id,
          type: "agent",
          position,
          data: {
            id,
            ownerAgentId: id,
            name: String(node.data.label ?? role),
            providerId: "pattern",
            role: normalizeRole(role),
            roleLabel: role,
            description: String(node.data.description ?? `${patternId} participant`),
            isOrchestrator: normalizeRole(role) === "orchestrator",
            skillCount: 0,
            mcpCount: 0,
            avatar: "◦"
          }
        };
      });

      const createdEdges: StudioEdge[] = template.edges.map((edge, index) => ({
        id: `${instanceId}:e${index + 1}`,
        source: idMap.get(edge.source) ?? edge.source,
        target: idMap.get(edge.target) ?? edge.target,
        type: "interaction",
        label: edge.label || `${patternId}`,
        data: edge.data
      }));

      setPatternNodes((prev) => [...prev, ...createdNodes]);
      setPatternEdges((prev) => [...prev, ...createdEdges]);
      postToExtension({
        type: "INSERT_PATTERN",
        payload: {
          patternId,
          anchor: { x: anchorX, y: anchorY }
        }
      });
      for (const edge of createdEdges) {
        const interactionData = edge.data as InteractionEdgeData | undefined;
        if (!interactionData) {
          continue;
        }
        postToExtension({
          type: "CONFIGURE_INTERACTION_EDGE",
          payload: {
            edgeId: edge.id,
            label: edge.label,
            data: interactionData
          }
        });
      }
      setPanelMode("inspector");
      setPanelOpen(true);
      setToast({
        level: "info",
        message: `Inserted pattern ${template.name} (${createdNodes.length} nodes, ${createdEdges.length} edges)`
      });
    } catch (error) {
      showErrorToast(error);
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const updateInteractionEdge = (edgeId: string, update: { label?: string; data?: Record<string, unknown> }) => {
    setPatternEdges((prev) =>
      prev.map((edge) =>
        edge.id === edgeId
          ? {
            ...edge,
            label: update.label ?? edge.label,
            data: {
              ...(edge.data ?? {}),
              ...(update.data ?? {})
            }
          }
          : edge
      )
    );
    if (update.data && typeof (update.data as { termination?: unknown }).termination === "object") {
      postToExtension({
        type: "CONFIGURE_INTERACTION_EDGE",
        payload: {
          edgeId,
          label: update.label,
          data: update.data as InteractionEdgeData
        }
      });
    }
  };

  const saveFlow = useCallback(async () => {
    setBusy(true);
    try {
      await requestToExtension({
        type: "SAVE_FLOW",
        payload: {
          flowName: activeFlowName,
          nodes: patternNodes,
          edges: patternEdges
        }
      });
      setToast({ level: "info", message: `Flow saved: ${activeFlowName}` });
    } catch (error) {
      showErrorToast(error);
      throw error;
    } finally {
      setBusy(false);
    }
  }, [activeFlowName, patternEdges, patternNodes, showErrorToast]);

  const loadFlow = useCallback(async () => {
    setBusy(true);
    try {
      const listResult = await requestToExtension<{ flows: string[] }>({ type: "LIST_FLOWS" });
      const suggested = listResult.flows[0] ?? activeFlowName;
      const selected = window.prompt("Load flow name", suggested);
      if (!selected) {
        return;
      }
      const loaded = await requestToExtension<{
        flow: { flowName: string; nodes: StudioNode[]; edges: StudioEdge[] };
      }>({
        type: "LOAD_FLOW",
        payload: { flowName: selected }
      });

      setPatternNodes(loaded.flow.nodes ?? []);
      setPatternEdges(loaded.flow.edges ?? []);
      setActiveFlowName(loaded.flow.flowName || selected);
      setToast({ level: "info", message: `Flow loaded: ${loaded.flow.flowName || selected}` });
      setPanelMode("inspector");
      setPanelOpen(true);
    } catch (error) {
      showErrorToast(error);
      throw error;
    } finally {
      setBusy(false);
    }
  }, [activeFlowName, showErrorToast]);

  const subscribeScheduleRun = async (runId: string) => {
    if (!runId) {
      return;
    }
    const previousRunId = scheduleRunIdRef.current;
    if (previousRunId && previousRunId !== runId) {
      postToExtension({
        type: "SCHEDULE_UNSUBSCRIBE",
        payload: { runId: previousRunId }
      });
    }

    scheduleRunIdRef.current = runId;
    setScheduleRunId(runId);

    const cached = scheduleRunStateRef.current.get(runId);
    if (cached) {
      scheduleOriginNowRef.current = cached.originNowMs;
      scheduleAnchorNowRef.current = cached.anchorNowMs;
      scheduleAnchorWallMsRef.current = cached.anchorWallMs;
      setScheduleViewState({
        tasks: cached.tasks,
        nowMs: cached.nowMs
      });
    } else {
      setScheduleViewState({
        tasks: [],
        nowMs: 0
      });
    }

    await requestToExtension({
      type: "SCHEDULE_SUBSCRIBE",
      payload: { runId }
    });
    const snapshotResult = await requestToExtension<{ event: TaskEvent }>({
      type: "SCHEDULE_GET_SNAPSHOT",
      payload: { runId }
    });
    if (snapshotResult.event) {
      applyScheduleEvent(snapshotResult.event);
    }
  };

  const refreshRunHistory = useCallback(async () => {
    const result = await requestToExtension<{ runs: RunSummary[] }>({
      type: "LIST_RUNS",
      payload: { flowName: activeFlowName }
    });
    setRunHistory(result.runs ?? []);
  }, [activeFlowName]);

  useEffect(() => {
    if (promptBackends.length === 0) {
      return;
    }
    if (!promptBackends.some((backend) => backend.id === defaultBackendId)) {
      setDefaultBackendId(promptBackends[0].id);
    }
  }, [defaultBackendId, promptBackends]);

  useEffect(() => {
    if (promptBackends.length === 0) {
      return;
    }
    if (promptBackends.some((backend) => backend.id === buildPromptBackendId)) {
      return;
    }
    setBuildPromptBackendId(promptBackends[0].id);
  }, [buildPromptBackendId, promptBackends]);

  const runFlowFromPanel = async (payload: {
    flowName: string;
    backendId: CliBackend["id"];
    usePinnedOutputs: boolean;
    session?: SessionContext;
    runName?: string;
    tags?: string[];
    instruction?: string;
    taskOptions?: TaskSubmissionOptions;
  }) => {
    setBusy(true);
    try {
      const result = await requestToExtension<{
        runId: string;
        flowName: string;
        taskCount: number;
      }>({
        type: "RUN_FLOW",
        payload: {
          flowName: payload.flowName,
          backendId: payload.backendId,
          usePinnedOutputs: payload.usePinnedOutputs,
          session: payload.session,
          runName: payload.runName,
          tags: payload.tags,
          instruction: payload.instruction,
          taskOptions: payload.taskOptions
        }
      });
      setActiveFlowName(result.flowName);
      setActiveRunId(result.runId);
      setSelectedRunId(result.runId);
      setCanvasMode("kanban");
      setForceBuildPrompt(false);
      setPanelMode("run");
      setPanelOpen(true);
      await subscribeScheduleRun(result.runId);
      await refreshRunHistory();
    } catch (error) {
      showErrorToast(error);
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const runTaskFromPanel = async (prompt: string, options: TaskPanelOptions) => {
    const instruction = prompt.trim();
    if (!instruction) {
      return;
    }
    setSelectedScheduleTaskId(undefined);
    const tags = [
      `priority:${options.priority}`,
      options.assignTo !== "auto" ? `assign:${options.assignTo}` : "assign:auto"
    ];
    await runFlowFromPanel({
      flowName: activeFlowName || "default",
      backendId: defaultBackendId,
      usePinnedOutputs: true,
      session: { scope: "workspace" },
      runName: instruction.slice(0, 72),
      tags,
      instruction,
      taskOptions: options
    });
  };

  const runNodeFromPanel = async (payload: {
    flowName: string;
    nodeId: string;
    backendId: CliBackend["id"];
    usePinnedOutput: boolean;
    session?: SessionContext;
  }) => {
    setBusy(true);
    try {
      const result = await requestToExtension<{
        runId: string;
        flowName: string;
        nodeId: string;
      }>({
        type: "RUN_NODE",
        payload
      });
      setActiveFlowName(result.flowName);
      setActiveRunId(result.runId);
      setSelectedRunId(result.runId);
      setCanvasMode("kanban");
      setPanelMode("run");
      setPanelOpen(true);
      await subscribeScheduleRun(result.runId);
      await refreshRunHistory();
    } catch (error) {
      showErrorToast(error);
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const stopRunFromPanel = async (runId: string) => {
    if (!runId) {
      return;
    }
    await requestToExtension({
      type: "STOP_RUN",
      payload: { runId }
    });
    await refreshRunHistory();
    setActiveRunId((current) => (current === runId ? undefined : current));
  };

  const selectRun = async (runId: string) => {
    setSelectedRunId(runId);
    const selectedRun = runHistory.find((run) => run.runId === runId);
    const flowName = selectedRun?.flow ?? activeFlowName;
    setActiveFlowName(flowName);
    await subscribeScheduleRun(runId);
    const loaded = await requestToExtension<{ events: RunEvent[] }>({
      type: "LOAD_RUN",
      payload: {
        flowName,
        runId
      }
    });
    setRunEvents(loaded.events ?? []);
    setCanvasMode("kanban");
  };

  const pinOutput = async (flowName: string, nodeId: string, output: unknown) => {
    await requestToExtension({
      type: "PIN_OUTPUT",
      payload: { flowName, nodeId, output }
    });
    setToast({ level: "info", message: `Pinned output for ${nodeId}` });
  };

  const unpinOutput = async (flowName: string, nodeId: string) => {
    await requestToExtension({
      type: "UNPIN_OUTPUT",
      payload: { flowName, nodeId }
    });
    setToast({ level: "info", message: `Unpinned output for ${nodeId}` });
  };

  const setBackendOverrides = async (overrides: CliBackendOverrides) => {
    await requestToExtension({
      type: "SET_BACKEND_OVERRIDES",
      payload: { overrides }
    });
    setBackendOverridesState(overrides);
    await requestToExtension({ type: "DETECT_CLI_BACKENDS" });
    setToast({ level: "info", message: "Backend overrides updated" });
  };

  const setDefaultBackend = async (backendId: CliBackend["id"]) => {
    await requestToExtension({
      type: "SET_DEFAULT_BACKEND",
      payload: { backendId }
    });
    setDefaultBackendId(backendId);
    setToast({ level: "info", message: `Workspace default backend set: ${backendId}` });
  };

  const testBackendFromPanel = async (backendId: CliBackend["id"]) => {
    const result = await requestToExtension<{
      result: {
        backendId: CliBackend["id"];
        ok: boolean;
        durationMs: number;
        model?: string;
        message: string;
        outputPreview?: string;
      };
    }>({
      type: "TEST_BACKEND",
      payload: { backendId }
    });
    const detail = result.result;
    setToast({
      level: detail.ok ? "info" : "warning",
      message: detail.ok
        ? `${detail.backendId}: ${Math.round(detail.durationMs / 10) / 100}s${detail.model ? ` · ${detail.model}` : ""}`
        : `${detail.backendId}: ${detail.message}`
    });
    return detail;
  };

  const replayRunFromPanel = async (payload: { runId: string; modifiedPrompts?: Record<string, string> }) => {
    setBusy(true);
    try {
      const result = await requestToExtension<{
        runId: string;
        flowName: string;
      }>({
        type: "REPLAY_RUN",
        payload
      });
      setActiveFlowName(result.flowName);
      setActiveRunId(result.runId);
      setSelectedRunId(result.runId);
      setCanvasMode("kanban");
      await subscribeScheduleRun(result.runId);
      await refreshRunHistory();
      await selectRun(result.runId);
    } finally {
      setBusy(false);
    }
  };

  const openRunLog = (runId: string, flowName: string) => {
    const workspaceRoot = snapshot?.agent.workspaceRoot;
    if (!workspaceRoot) {
      return;
    }
    const sanitizedFlow = flowName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "default";
    const runLogPath = `${workspaceRoot}/.agentcanvas/runs/${sanitizedFlow}/${runId}.jsonl`;
    postToExtension({
      type: "OPEN_FILE",
      payload: {
        path: runLogPath
      }
    });
  };

  const moveScheduleTask = (taskId: string, forceStartMs: number, forceAgentId?: string) => {
    const runId = scheduleRunIdRef.current;
    if (!runId) {
      return;
    }
    void requestToExtension({
      type: "TASK_MOVE",
      payload: {
        runId,
        taskId,
        forceStartMs,
        forceAgentId
      }
    }).catch(showErrorToast);
  };

  const pinScheduleTask = (taskId: string, pinned: boolean) => {
    const runId = scheduleRunIdRef.current;
    if (!runId) {
      return;
    }
    void requestToExtension({
      type: "TASK_PIN",
      payload: {
        runId,
        taskId,
        pinned
      }
    }).catch(showErrorToast);
  };

  const setScheduleTaskStatus = (taskId: string, status: Task["status"]) => {
    const runId = scheduleRunIdRef.current;
    if (!runId) {
      return;
    }
    void requestToExtension({
      type: "TASK_SET_STATUS",
      payload: {
        runId,
        taskId,
        status
      }
    }).catch(showErrorToast);
  };

  const cancelTaskFromPanel = (taskId: string) => {
    setScheduleTaskStatus(taskId, "canceled");
  };

  const viewTaskDetailFromPanel = (taskId: string) => {
    setSelectedScheduleTaskId(taskId);
    setPanelMode("run");
    setPanelOpen(true);
  };

  const refreshCacheMetrics = useCallback(async () => {
    const result = await requestToExtension<{ metrics: CacheMetrics }>({
      type: "GET_CACHE_METRICS",
      payload: { flowName: activeFlowName }
    });
    if (result.metrics) {
      setCacheMetrics(result.metrics);
    }
  }, [activeFlowName]);

  useEffect(() => {
    void refreshRunHistory().catch(showErrorToast);
  }, [refreshRunHistory, showErrorToast]);

  useEffect(() => {
    void refreshCacheMetrics().catch(showErrorToast);
  }, [refreshCacheMetrics, showErrorToast]);

  const resetCacheMetrics = async () => {
    const result = await requestToExtension<{ metrics?: CacheMetrics }>({
      type: "RESET_CACHE_METRICS",
      payload: { flowName: activeFlowName }
    });
    if (result.metrics) {
      setCacheMetrics(result.metrics);
    } else {
      setCacheMetrics(EMPTY_CACHE_METRICS);
    }
  };

  const saveCacheConfig = async (nextConfig: CacheConfig) => {
    await requestToExtension({
      type: "UPDATE_CACHE_CONFIG",
      payload: nextConfig
    });
    setCacheConfig(nextConfig);
    setToast({ level: "info", message: "Cache configuration saved" });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTextInput =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.getAttribute("contenteditable") === "true";
      const hasModalOpen = Boolean(document.querySelector(".command-overlay"));

      if (isTextInput || hasModalOpen) {
        return;
      }

      if (event.shiftKey && event.key === "?") {
        event.preventDefault();
        setKeyboardHelpOpen(true);
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandBarOpen(true);
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === ",") {
        event.preventDefault();
        setSettingsOpen(true);
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        setSaveSignal((value) => value + 1);
        void saveFlow().catch(showErrorToast);
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o") {
        event.preventDefault();
        void loadFlow().catch(showErrorToast);
        return;
      }

      if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === "r") {
        event.preventDefault();
        refreshDiscovery();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loadFlow, refreshDiscovery, saveFlow, showErrorToast]);

  const commandItems = [
    {
      id: "refresh",
      title: "Refresh discovery",
      subtitle: "Rescan skills and rule docs",
      shortcut: "R",
      run: refreshDiscovery
    },
    {
      id: "build-team",
      title: "Open build prompt",
      subtitle: "Show expanded build prompt overlay",
      run: () => setForceBuildPrompt(true)
    },
    {
      id: "view-kanban",
      title: "Switch to Kanban",
      subtitle: "Track progress in board view",
      run: () => {
        setCanvasMode("kanban");
        setForceBuildPrompt(false);
      }
    },
    {
      id: "view-graph",
      title: "Switch to Graph",
      subtitle: "Inspect canvas relationships",
      run: () => {
        setCanvasMode("graph");
        setForceBuildPrompt(false);
      }
    },
    {
      id: "view-schedule",
      title: "Switch to Schedule",
      subtitle: "Inspect timeline view",
      run: () => {
        setCanvasMode("schedule");
        setForceBuildPrompt(false);
      }
    },
    {
      id: "toggle-expand",
      title: expandedAgentId ? "Switch to overview graph" : "Expand selected agent",
      subtitle: "Toggle graph focus mode",
      run: () => {
        if (expandedAgentId) {
          setExpandedAgentId(null);
          return;
        }
        const selectedAgent =
          selectedNode?.type === "agent"
            ? selectedNode.id
            : snapshot?.agents[0]?.id ?? null;
        setExpandedAgentId(selectedAgent);
      }
    },
    {
      id: "toggle-right-panel",
      title: panelOpen ? "Hide right panel" : "Show right panel",
      subtitle: "Toggle inspector panel visibility",
      run: () => setPanelOpen((open) => !open)
    },
    {
      id: "panel-task",
      title: "Open task panel",
      subtitle: "Submit work and monitor active tasks",
      run: () => {
        setPanelMode("task");
        setPanelOpen(true);
      }
    },
    {
      id: "keyboard-help",
      title: "Show keyboard shortcuts",
      subtitle: "Open shortcut cheat sheet",
      shortcut: "Shift+?",
      run: () => setKeyboardHelpOpen(true)
    },
    {
      id: "new-skill",
      title: "Open skill wizard",
      subtitle: "Create SKILL.md template + optional openai.yaml",
      run: () => setSkillWizardOpen(true)
    },
    {
      id: "new-agent",
      title: "Create new agent",
      subtitle: "Open custom agent creation modal",
      run: () => setAgentCreationOpen(true)
    },
    {
      id: "save-flow",
      title: "Save interaction flow",
      subtitle: "Write .agentcanvas/flows/<name>.yaml",
      shortcut: "Cmd/Ctrl+S",
      run: () => void saveFlow()
    },
    {
      id: "load-flow",
      title: "Load interaction flow",
      subtitle: "Load .agentcanvas/flows/<name>.yaml",
      shortcut: "Cmd/Ctrl+O",
      run: () => void loadFlow()
    },
    {
      id: "export-all",
      title: "Export all skills",
      subtitle: "Create a skill pack zip",
      run: () => exportSkills([])
    },
    {
      id: "validate-all",
      title: "Validate all skills",
      subtitle: "Run project-wide validation",
      run: runValidationAll
    },
    {
      id: "import-pack",
      title: "Import skill pack",
      subtitle: "Preview and install from zip",
      run: requestImportPreview
    },
    {
      id: "scan-workspace",
      title: "Scan workspace",
      subtitle: "Refresh canvas and unhide all nodes",
      run: refreshDiscovery
    },
    {
      id: "add-common-rule",
      title: "Add common rule",
      subtitle: "Append rule to workspace AGENTS.md",
      run: () => setCommonRuleModalOpen(true)
    },
    {
      id: "ensure-root-agents",
      title: "Ensure root AGENTS.md",
      subtitle: "Create workspace AGENTS.md if missing",
      run: ensureRootAgents
    },
    {
      id: "create-common-docs",
      title: "Create common ops docs",
      subtitle: "Generate AGENT_VISUALS / MCP_PLAN / AGENT_COMMS docs",
      run: createCommonRuleDocs
    },
    {
      id: "open-common-folder",
      title: "Open common rules folder",
      subtitle: "Reveal .agentcanvas/rules/common",
      run: openCommonRulesFolder
    },
    {
      id: "add-note",
      title: "Add sticky note",
      subtitle: "Use Shift+S on canvas",
      run: () => setToast({ level: "info", message: "Focus canvas and press Shift+S" })
    },
    {
      id: "open-settings",
      title: "Open settings modal",
      subtitle: "Manage providers, ops, packs and shortcuts",
      shortcut: "Cmd/Ctrl+,",
      run: () => setSettingsOpen(true)
    },
    {
      id: "cache-status",
      title: "Cache status",
      subtitle: "Refresh cache metrics for current flow",
      run: () => void refreshCacheMetrics()
    },
    {
      id: "cache-reset",
      title: "Reset cache metrics",
      subtitle: "Clear cache metrics for current flow",
      run: () => void resetCacheMetrics()
    }
  ];

  const agentExecutionStateById = useMemo(() => {
    const agentIds = new Set<string>(snapshot?.agents.map((agent) => agent.id) ?? []);
    for (const node of graphSnapshot?.nodes ?? []) {
      if (node.type === "agent") {
        agentIds.add(node.id);
      }
    }

    const tasksByAgentId = new Map<string, Task[]>();
    for (const task of scheduleViewState.tasks) {
      const bucket = tasksByAgentId.get(task.agentId);
      if (bucket) {
        bucket.push(task);
      } else {
        tasksByAgentId.set(task.agentId, [task]);
      }
    }

    const result: Record<
      string,
      {
        state: "idle" | "thinking" | "working" | "error" | "done" | "blocked";
        currentTask?: string;
        progress?: number;
      }
    > = {};

    for (const agentId of agentIds) {
      const tasks = tasksByAgentId.get(agentId) ?? [];
      if (tasks.length === 0) {
        result[agentId] = { state: "idle" };
        continue;
      }

      const running = tasks.find((task) => task.status === "running");
      if (running) {
        result[agentId] = {
          state: "working",
          currentTask: running.title,
          progress: normalizeProgressPercent(running.progress)
        };
        continue;
      }

      const failed = tasks.find((task) => task.status === "failed");
      if (failed) {
        result[agentId] = {
          state: "error",
          currentTask: failed.title
        };
        continue;
      }

      const blocked = tasks.find((task) => task.status === "blocked");
      if (blocked) {
        result[agentId] = {
          state: "blocked",
          currentTask: blocked.title
        };
        continue;
      }

      const pending = tasks.find((task) => task.status === "planned" || task.status === "ready");
      if (pending) {
        result[agentId] = {
          state: "thinking",
          currentTask: pending.title
        };
        continue;
      }

      const done = tasks.find((task) => task.status === "done" || task.status === "canceled");
      if (done) {
        result[agentId] = {
          state: "done",
          currentTask: done.title,
          progress: 100
        };
        continue;
      }

      result[agentId] = { state: "idle" };
    }

    return result;
  }, [graphSnapshot?.nodes, scheduleViewState.tasks, snapshot?.agents]);

  const delegationEdgeState = useMemo(() => {
    const active: string[] = [];
    const done: string[] = [];
    for (const edge of graphSnapshot?.edges ?? []) {
      if (edge.type !== "delegates") {
        continue;
      }
      const targetState = agentExecutionStateById[edge.target]?.state;
      if (targetState === "working" || targetState === "thinking") {
        active.push(edge.id);
        continue;
      }
      if (targetState === "done") {
        done.push(edge.id);
      }
    }
    return { active, done };
  }, [agentExecutionStateById, graphSnapshot?.edges]);

  return (
    <div className="studio-shell">
      <section className="main-section">
        <header className="top-bar">
          <div className="top-brand">
            <button
              type="button"
              className="brand-home-button"
              onClick={() => {
                setForceBuildPrompt(true);
                setCanvasMode("graph");
              }}
            >
              <img src={logo} className="brand-home-logo" alt="" />
              <span className="brand-home-text">AgentCanvas</span>
            </button>
            <div className="top-subtitle">Last refresh: {generatedAtText}</div>
          </div>

          <div className="top-actions">
            {!panelOpen && (
              <div className="view-toggle" role="tablist" aria-label="Panel mode">
                <button
                  type="button"
                  className={panelMode === "library" ? "active-toggle" : ""}
                  title="Node Library"
                  onClick={() => {
                    setPanelMode("library");
                    setPanelOpen(true);
                  }}
                >
                  Node Library
                </button>
                <button
                  type="button"
                  className={panelMode === "inspector" ? "active-toggle" : ""}
                  title="Inspector"
                  onClick={() => {
                    setPanelMode("inspector");
                    setPanelOpen(true);
                  }}
                >
                  Inspector
                </button>
                <button
                  type="button"
                  className={panelMode === "task" ? "active-toggle" : ""}
                  title="Task"
                  onClick={() => {
                    setPanelMode("task");
                    setPanelOpen(true);
                  }}
                >
                  Task
                </button>
                <button
                  type="button"
                  className={panelMode === "run" ? "active-toggle" : ""}
                  title="Run"
                  onClick={() => {
                    setPanelMode("run");
                    setPanelOpen(true);
                  }}
                >
                  Run
                </button>
              </div>
            )}
            <div className="view-toggle" role="tablist" aria-label="View mode">
              <button
                type="button"
                className={canvasMode === "kanban" ? "active-toggle" : ""}
                title="Kanban"
                onClick={() => setCanvasMode("kanban")}
              >
                Kanban
              </button>
              <button
                type="button"
                className={canvasMode === "graph" ? "active-toggle" : ""}
                title="Graph"
                onClick={() => setCanvasMode("graph")}
              >
                Graph
              </button>
              <button
                type="button"
                className={canvasMode === "schedule" ? "active-toggle" : ""}
                title="Schedule"
                onClick={() => setCanvasMode("schedule")}
              >
                Schedule
              </button>
            </div>
            <button type="button" title="Cmd/Ctrl+," onClick={() => setSettingsOpen(true)}>Settings</button>
            <button type="button" title="Cmd/Ctrl+K" onClick={() => setCommandBarOpen(true)}>Command Bar</button>
          </div>
        </header>

        <div className={`workspace-body ${panelOpen ? "is-team-mode" : ""}`}>
          <div className="workspace-main">
            <div className="canvas-area">
              {canvasMode === "kanban" && (
                <ErrorBoundary section="KanbanView">
                  <KanbanView
                    runId={scheduleRunId}
                    tasks={scheduleViewState.tasks}
                    agents={snapshot?.agents ?? []}
                    selectedTaskId={selectedScheduleTaskId}
                    onSelectTask={setSelectedScheduleTaskId}
                    onSetTaskStatus={setScheduleTaskStatus}
                    onPinTask={pinScheduleTask}
                  />
                </ErrorBoundary>
              )}

              {canvasMode === "graph" && (
                <ErrorBoundary section="GraphView">
                  <GraphView
                    snapshot={graphSnapshot}
                    hiddenNodeIds={hiddenNodeIds}
                    onSelectNode={(node) => {
                      setSelectedNode(node);
                      setSelectedEdge(undefined);
                      setPanelMode("inspector");
                      setPanelOpen(true);
                    }}
                    onSelectEdge={(edge) => {
                      setSelectedEdge(edge);
                      setSelectedNode(undefined);
                      setPanelMode("inspector");
                      setPanelOpen(true);
                    }}
                    onOpenFile={openFile}
                    onCreateOverride={createOverride}
                    onToggleSkill={toggleSkillEnabled}
                    onHideNode={hideNode}
                    onRevealPath={revealPath}
                    onExportSkill={(skillId) => exportSkills([skillId])}
                    onToggleLibrary={() => setCommandBarOpen(true)}
                    onAddCommonRule={() => setCommonRuleModalOpen(true)}
                    onAddAgent={() => setAgentCreationOpen(true)}
                    onToggleCommandBar={() => setCommandBarOpen(true)}
                    onCreateNote={addNote}
                    onSaveNote={saveNote}
                    onDeleteNote={deleteNote}
                    onDuplicateNote={(text, position) => addNote(position, text)}
                    onScanWorkspace={refreshDiscovery}
                    onImportPack={requestImportPreview}
                    onEnsureRootAgents={ensureRootAgents}
                    onOpenCommonRulesFolder={openCommonRulesFolder}
                    onCreateCommonRuleDocs={createCommonRuleDocs}
                    onAddAgentLink={addAgentLink}
                    onOpenAgentDetail={(agentId, agentName) =>
                      setAgentDetailModal({ agentId, agentName })
                    }
                    onAssignSkillToAgent={assignSkillToAgent}
                    onAssignMcpToAgent={assignMcpToAgent}
                    onDropPattern={(patternId, position) => {
                      void insertInteractionPattern(patternId, position).catch(() => undefined);
                    }}
                    onSaveNodePosition={saveNodePosition}
                    onAgentExpand={(agentId) =>
                      setExpandedAgentId((current) => (current === agentId ? null : agentId))
                    }
                    agentExecutionStateById={agentExecutionStateById}
                    activeDelegationEdgeIds={delegationEdgeState.active}
                    doneDelegationEdgeIds={delegationEdgeState.done}
                  />
                </ErrorBoundary>
              )}

              {canvasMode === "schedule" && (
                <ErrorBoundary section="ScheduleView">
                  <ScheduleView
                    runId={scheduleRunId}
                    tasks={scheduleViewState.tasks}
                    agents={snapshot?.agents ?? []}
                    nowMs={scheduleViewState.nowMs}
                    selectedTaskId={selectedScheduleTaskId}
                    onSelectTask={setSelectedScheduleTaskId}
                    onMoveTask={moveScheduleTask}
                    onPinTask={pinScheduleTask}
                  />
                </ErrorBoundary>
              )}

              <BuildPromptBar
                hasTeam={hasTeamReady}
                expanded={buildPromptExpanded}
                prompt={buildPromptText}
                onPromptChange={setBuildPromptText}
                onBuildTeam={() => void buildTeamFromPromptBar()}
                backends={promptBackends}
                selectedBackend={buildPromptBackendId}
                onBackendChange={setBuildPromptBackendId}
                isBuilding={busy}
                progress={generationProgress}
                includeExistingAgents={buildPromptIncludeExistingAgents}
                includeExistingSkills={buildPromptIncludeExistingSkills}
                includeExistingMcpServers={buildPromptIncludeExistingMcpServers}
                onIncludeExistingAgentsChange={setBuildPromptIncludeExistingAgents}
                onIncludeExistingSkillsChange={setBuildPromptIncludeExistingSkills}
                onIncludeExistingMcpServersChange={setBuildPromptIncludeExistingMcpServers}
                onExpand={() => setForceBuildPrompt(true)}
                onCollapse={() => setForceBuildPrompt(false)}
              />
            </div>
          </div>
          <ErrorBoundary section="RightPanel">
            <RightPanel
              mode={panelMode}
              open={panelOpen}
              saveSignal={saveSignal}
              snapshot={composedSnapshot}
              selectedNode={selectedNode}
              selectedScheduleTaskId={selectedScheduleTaskId}
              selectedEdge={selectedEdge}
              onModeChange={setPanelMode}
              onOpenFile={openFile}
              onRevealPath={revealPath}
              onCreateSkill={createSkill}
              onExportSkills={exportSkills}
              onValidateSkill={validateSkill}
              onCreateOverride={createOverride}
              onSaveSkillFrontmatter={saveSkillFrontmatter}
              interactionPatterns={interactionPatterns}
              onInsertPattern={(patternId) => insertInteractionPattern(patternId)}
              onUpdateInteractionEdge={(edgeId, update) => updateInteractionEdge(edgeId, update)}
              activeFlowName={activeFlowName}
              tasks={scheduleViewState.tasks}
              onRunTask={runTaskFromPanel}
              onCancelTask={cancelTaskFromPanel}
              onViewTaskDetail={viewTaskDetailFromPanel}
              runBackends={promptBackends}
              backendOverrides={backendOverrides}
              defaultBackendId={defaultBackendId}
              runHistory={runHistory}
              runEvents={runEvents}
              activeRunId={activeRunId}
              selectedRunId={selectedRunId}
              selectedScheduleTask={selectedScheduleTask}
              onRunFlow={runFlowFromPanel}
              onRunNode={runNodeFromPanel}
              onReplayRun={replayRunFromPanel}
              onStopRun={stopRunFromPanel}
              onRefreshRunHistory={refreshRunHistory}
              onSelectRun={selectRun}
              onPinOutput={pinOutput}
              onUnpinOutput={unpinOutput}
              onSetBackendOverrides={setBackendOverrides}
              onSetDefaultBackend={setDefaultBackend}
              onTestBackend={testBackendFromPanel}
              onOpenRunLog={openRunLog}
              onOpenAgentDetail={(agentId, agentName) => setAgentDetailModal({ agentId, agentName })}
            />
          </ErrorBoundary>
        </div>

        <StatusBar
          skills={summary.skills}
          rules={summary.rules}
          errors={summary.errors}
          warnings={summary.warnings}
          focus={focusLabel}
          agents={snapshot?.agents.length ?? 0}
          tasks={runSummary.total}
          done={runSummary.done}
          failed={runSummary.failed}
          flowName={activeFlowName}
          canvasView={canvasMode}
          runId={activeRunId}
          costUsd={cacheMetrics.cost}
          cacheSavedRate={cacheSavedRate}
          contextUsed={contextUsed}
          contextThreshold={cacheConfig.contextThreshold}
          contextState={contextState}
          showBuildNew={!buildPromptExpanded}
          onBuildNew={() => {
            setForceBuildPrompt(true);
          }}
        />
      </section>

      <CommandBar
        open={commandBarOpen}
        commands={commandItems}
        onClose={() => setCommandBarOpen(false)}
      />

      <SettingsModal
        open={settingsOpen}
        cacheConfig={cacheConfig}
        cacheMetrics={cacheMetrics}
        onClose={() => setSettingsOpen(false)}
        onRefreshDiscovery={refreshDiscovery}
        onSaveFlow={saveFlow}
        onLoadFlow={loadFlow}
        onRunValidationAll={runValidationAll}
        onOpenSkillWizard={() => setSkillWizardOpen(true)}
        onOpenAgentCreation={() => setAgentCreationOpen(true)}
        onOpenCommonRuleModal={() => setCommonRuleModalOpen(true)}
        onEnsureRootAgents={ensureRootAgents}
        onOpenCommonRulesFolder={openCommonRulesFolder}
        onCreateCommonRuleDocs={createCommonRuleDocs}
        onExportAllSkills={() => exportSkills([])}
        onImportPack={requestImportPreview}
        onOpenKeyboardHelp={() => setKeyboardHelpOpen(true)}
        onSaveCacheConfig={saveCacheConfig}
        onRefreshCacheMetrics={refreshCacheMetrics}
        onResetCacheMetrics={resetCacheMetrics}
      />

      <SkillWizardModal
        open={skillWizardOpen}
        onClose={() => setSkillWizardOpen(false)}
        defaultBaseDirPath={defaultSkillBasePath}
        baseDirOptions={skillBaseOptions}
        onCreate={createSkillFromWizard}
      />

      <CommonRuleModal
        open={commonRuleModalOpen}
        onClose={() => setCommonRuleModalOpen(false)}
        onCreate={(title, body) => {
          addCommonRule(title, body);
          setCommonRuleModalOpen(false);
        }}
      />

      <ImportPreviewModal
        preview={importPreview}
        onClose={() => setImportPreview(undefined)}
        onConfirm={(installDirPath, overwrite) => {
          if (!importPreview) {
            return;
          }
          postToExtension({
            type: "CONFIRM_IMPORT_PACK",
            payload: {
              zipPath: importPreview.zipPath,
              installDirPath,
              overwrite
            }
          });
          setImportPreview(undefined);
        }}
      />

      <AgentDetailModal
        open={agentDetailModal !== null}
        agentId={agentDetailModal?.agentId ?? ""}
        agentName={agentDetailModal?.agentName ?? ""}
        snapshot={snapshot}
        onClose={() => setAgentDetailModal(null)}
        onOpenFile={openFile}
        onToggleSkill={toggleSkillEnabled}
        onRevealPath={revealPath}
        onCreateOverride={createOverride}
        onExportSkill={(skillId) => exportSkills([skillId])}
        onUpdateProfile={updateAgentProfile}
        onSetRuntime={setAgentRuntime}
        onSetDelegation={setAgentDelegation}
        onAssignSkill={assignSkillToAgent}
        onUnassignSkill={unassignSkillFromAgent}
        onAssignMcp={assignMcpToAgent}
        onUnassignMcp={unassignMcpFromAgent}
        onDeleteAgent={(agentId) => void deleteAgent(agentId)}
      />

      <AgentCreationModal
        open={agentCreationOpen}
        onClose={() => setAgentCreationOpen(false)}
        onCreate={createAgent}
      />

      <AgentPreviewModal
        open={Boolean(generatedPreview)}
        structure={generatedPreview?.structure}
        historyId={generatedPreview?.historyId}
        onClose={() => setGeneratedPreview(undefined)}
        onApply={applyGeneratedStructure}
      />

      <KeyboardHelpModal open={keyboardHelpOpen} onClose={() => setKeyboardHelpOpen(false)} />

      {toast && (
        <div className={`toast ${toast.level}`} onAnimationEnd={() => setToast(undefined)}>
          <img
            className="toast-icon"
            src={
              toast.level === "warning"
                ? toastWarnIcon
                : toast.level === "error"
                  ? toastErrorIcon
                  : toastInfoIcon
            }
            alt=""
            aria-hidden="true"
          />
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

function normalizeProgressPercent(progress?: number): number | undefined {
  if (typeof progress !== "number" || Number.isNaN(progress)) {
    return undefined;
  }
  const value = progress <= 1 ? progress * 100 : progress;
  return Math.max(0, Math.min(100, value));
}

function applyTaskEvent(tasks: Task[], event: TaskEvent): Task[] {
  if (event.type === "snapshot") {
    return event.tasks;
  }
  if (event.type === "task_created") {
    const next = tasks.filter((task) => task.id !== event.task.id);
    next.push(event.task);
    return next;
  }
  if (event.type === "task_updated") {
    return tasks.map((task) => (task.id === event.taskId ? mergeTaskPatch(task, event.patch) : task));
  }
  if (event.type === "task_deleted") {
    return tasks.filter((task) => task.id !== event.taskId);
  }
  return tasks;
}

function mergeTaskPatch(task: Task, patch: Partial<Task>): Task {
  return {
    ...task,
    ...patch,
    overrides: patch.overrides !== undefined ? mergeNestedRecord(task.overrides, patch.overrides) : task.overrides,
    meta: patch.meta !== undefined ? mergeNestedRecord(task.meta, patch.meta) : task.meta
  };
}

function mergeNestedRecord<T extends Record<string, unknown> | undefined>(base: T, patch: T): T {
  if (!patch || !isPlainRecord(patch)) {
    return patch;
  }
  const result: Record<string, unknown> = isPlainRecord(base) ? { ...base } : {};
  for (const [key, patchValue] of Object.entries(patch)) {
    const currentValue = result[key];
    if (isPlainRecord(currentValue) && isPlainRecord(patchValue)) {
      result[key] = mergeNestedRecord(currentValue, patchValue);
    } else {
      result[key] = patchValue;
    }
  }
  return result as T;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function handleExtensionMessage(
  message: ExtensionToWebviewMessage,
  handlers: {
    setSnapshot: (snapshot: DiscoverySnapshot | undefined) => void;
    setToast: (toast: { level: "info" | "warning" | "error"; message: string } | undefined) => void;
    setHiddenNodeIds: (next: Set<string> | ((previous: Set<string>) => Set<string>)) => void;
    setSelectedNode: (node: Node | undefined) => void;
    setSelectedEdge: (edge: Edge | undefined) => void;
    setImportPreview: (preview: SkillPackPreview | undefined) => void;
    setPromptBackends: (backends: CliBackend[]) => void;
    setPromptHistory: (items: PromptHistoryEntry[]) => void;
    setGenerationProgress: (progress: {
      stage: "building_prompt" | "calling_cli" | "parsing_output" | "done" | "error";
      message: string;
      progress?: number;
    } | undefined) => void;
    setRunEvents: (events: RunEvent[] | ((prev: RunEvent[]) => RunEvent[])) => void;
    setCacheMetrics: (metrics: CacheMetrics) => void;
    setMemoryItems: (items: MemoryItem[] | ((previous: MemoryItem[]) => MemoryItem[])) => void;
    setMemoryQueryResult: (result: MemoryQueryResult | undefined) => void;
    setContextThresholdWarning: (
      warning: { current: number; threshold: number } | undefined
    ) => void;
  }
) {
  switch (message.type) {
    case "INIT_STATE": {
      handlers.setSnapshot(message.payload.snapshot);
      handlers.setHiddenNodeIds(new Set());
      handlers.setSelectedNode(undefined);
      handlers.setSelectedEdge(undefined);
      handlers.setImportPreview(undefined);
      return;
    }
    case "STATE_PATCH": {
      if (message.payload.snapshot) {
        handlers.setSnapshot(message.payload.snapshot);
      }
      return;
    }
    case "IMPORT_PREVIEW": {
      handlers.setImportPreview(message.payload.preview);
      return;
    }
    case "CLI_BACKENDS": {
      handlers.setPromptBackends(message.payload.backends);
      return;
    }
    case "COLLAB_EVENT": {
      handlers.setRunEvents((previous) => {
        const synthetic: RunEvent = {
          ts: message.payload.ts,
          flow: message.payload.flowName,
          runId: message.payload.runId,
          type: message.payload.event,
          actor: message.payload.actor,
          provenance: message.payload.provenance,
          payload: message.payload.data
        };
        return [...previous, synthetic].slice(-300);
      });
      return;
    }
    case "MEMORY_UPDATED": {
      handlers.setMemoryItems((previous) => {
        const withoutCurrent = previous.filter((item) => item.id !== message.payload.item.id);
        if (message.payload.action === "deleted") {
          return withoutCurrent;
        }
        return [message.payload.item, ...withoutCurrent].slice(0, 250);
      });
      return;
    }
    case "MEMORY_QUERY_RESULT": {
      handlers.setMemoryQueryResult(message.payload);
      return;
    }
    case "CONTEXT_PACKET_BUILT": {
      return;
    }
    case "PROMPT_HISTORY": {
      handlers.setPromptHistory(message.payload.items);
      return;
    }
    case "SCHEDULE_EVENT": {
      return;
    }
    case "CACHE_METRICS_UPDATE": {
      handlers.setCacheMetrics(message.payload);
      handlers.setContextThresholdWarning(undefined);
      return;
    }
    case "CONTEXT_THRESHOLD_WARNING": {
      handlers.setContextThresholdWarning(message.payload);
      return;
    }
    case "GENERATION_PROGRESS": {
      handlers.setGenerationProgress(message.payload);
      if (message.payload.stage === "done" || message.payload.stage === "error") {
        window.setTimeout(() => handlers.setGenerationProgress(undefined), 1600);
      }
      return;
    }
    case "TOAST": {
      handlers.setToast(message.payload);
      return;
    }
    case "ERROR": {
      handlers.setToast({
        level: "error",
        message: message.payload.detail
          ? `${message.payload.message}: ${message.payload.detail}`
          : message.payload.message
      });
      return;
    }
    case "RESPONSE_OK":
    case "RESPONSE_ERROR": {
      return;
    }
    default: {
      const exhaustive: never = message;
      void exhaustive;
    }
  }
}

async function loadInteractionPatternIndex(): Promise<PatternIndexItem[]> {
  const response = await fetch(new URL("./patterns/index.json", window.location.href).toString());
  if (!response.ok) {
    throw new Error(`Failed to load interaction pattern index (${response.status})`);
  }
  const payload = await response.json();
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload as PatternIndexItem[];
}

async function loadInteractionPatternTemplate(patternId: string): Promise<PatternTemplate> {
  const response = await fetch(new URL(`./patterns/${patternId}.json`, window.location.href).toString());
  if (!response.ok) {
    throw new Error(`Failed to load interaction pattern ${patternId} (${response.status})`);
  }
  const payload = (await response.json()) as PatternTemplate;
  if (!payload || !Array.isArray(payload.nodes) || !Array.isArray(payload.edges)) {
    throw new Error(`Pattern ${patternId} has invalid shape`);
  }
  return payload;
}

function normalizeRole(value: string): AgentRole {
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "orchestrator" ||
    normalized === "coder" ||
    normalized === "researcher" ||
    normalized === "reviewer" ||
    normalized === "planner" ||
    normalized === "tester" ||
    normalized === "writer"
  ) {
    return normalized;
  }
  return "custom";
}
