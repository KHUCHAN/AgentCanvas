export type ValidationIssue = {
  level: "error" | "warning";
  code: string;
  message: string;
};

export type CliBackendId =
  | "auto"
  | "claude"
  | "gemini"
  | "codex"
  | "claude-code"
  | "gemini-cli"
  | "codex-cli"
  | "aider"
  | "custom";

export type AgentRuntime =
  | {
      kind: "cli";
      backendId: CliBackendId;
      cwdMode?: "workspace" | "agentHome";
      modelId?: string;
    }
  | {
      kind: "openclaw";
      gatewayUrl?: string;
      agentKey?: string;
    };

export type CliBackend = {
  id: CliBackendId;
  displayName: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  available: boolean;
  version?: string;
  stdinPrompt?: boolean;
};

export type CliBackendOverride = {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  displayName?: string;
  stdinPrompt?: boolean;
};

export type CliBackendOverrides = Partial<Record<Exclude<CliBackendId, "auto">, CliBackendOverride>>;

export type AgentRole =
  | "orchestrator"
  | "coder"
  | "researcher"
  | "reviewer"
  | "planner"
  | "tester"
  | "writer"
  | "custom";

export type AgentProfile = {
  id: string;
  name: string;
  providerId: string;
  workspaceRoot?: string;
  homeDir: string;
  role: AgentRole;
  roleLabel?: string;
  description?: string;
  systemPrompt?: string;
  isOrchestrator: boolean;
  delegatesTo?: string[];
  assignedSkillIds?: string[];
  assignedMcpServerIds?: string[];
  runtime?: AgentRuntime;
  preferredModel?: string;
  color?: string;
  avatar?: string;
};

export type StudioNode = {
  id: string;
  type: "agent" | "provider" | "skill" | "ruleDoc" | "note" | "folder" | "commonRules" | "system";
  position: { x: number; y: number };
  data: Record<string, unknown>;
};

export type StudioEdge = {
  id: string;
  source: string;
  target: string;
  type: "contains" | "overrides" | "locatedIn" | "appliesTo" | "agentLink" | "delegates" | "interaction";
  label?: string;
  data?: Record<string, unknown>;
};

export type InteractionTopology =
  | "p2p"
  | "manager_worker"
  | "pipeline"
  | "blackboard"
  | "market_auction"
  | "debate_judge"
  | "broker"
  | "router_targeted"
  | "broadcast";

export type MessageForm = "nl_text" | "structured_json" | "acl_performative" | "multimodal";

export type SyncMode = "turn_based" | "req_res" | "async" | "streaming";

export type Termination =
  | { type: "max_rounds"; rounds: number }
  | { type: "timeout_ms"; ms: number }
  | { type: "judge_decision" }
  | { type: "consensus_threshold"; threshold: number }
  | { type: "quality_gate"; metric: string; op: ">=" | "<="; value: number };

export type InteractionEdgeData = {
  patternId: string;
  topology: InteractionTopology;
  messageForm: MessageForm;
  sync: SyncMode;
  termination: Termination;
  params: Record<string, unknown>;
  observability: {
    logs: boolean;
    traces: boolean;
    retain_days?: number;
  };
};

export type SystemNodeKind =
  | "judge"
  | "blackboard"
  | "router"
  | "broker"
  | "coordinator"
  | "gateway"
  | "custom";

export type SystemNodeData = {
  id: string;
  name: string;
  role: string;
  description?: string;
  kind?: SystemNodeKind;
  status?: "active" | "idle" | "paused";
};

export type HandoffEnvelope = {
  intent: string;
  inputs?: string[];
  plan?: string[];
  constraints?: string[];
  deliverables?: string[];
  sandboxWorkDir: string;
  proposalJson: string;
  changedFiles: string[];
  // Backward compatibility for legacy payload keys.
  SandboxWorkDir?: string;
  ProposalJson?: string;
  ChangedFiles?: string[];
};

export type Skill = {
  id: string;
  ownerAgentId: string;
  name: string;
  description: string;
  path: string;
  folderName: string;
  scope: "project" | "personal" | "shared" | "global";
  extraFrontmatter: Record<string, unknown>;
  enabled: boolean;
  validation: ValidationIssue[];
};

export type RuleDoc = {
  id: string;
  ownerAgentId: string;
  type: "codex-agents";
  path: string;
  scope: "global" | "project";
  orderIndex: number;
  providerId: string;
};

export type McpServer = {
  id: string;
  ownerAgentId: string;
  providerId: "codex" | "vscode";
  name: string;
  kind: "stdio" | "http";
  configLocationPath: string;
  enabled: boolean;
  tools?: string[];
};

export type DiscoverySnapshot = {
  agent: AgentProfile;
  agents: AgentProfile[];
  skills: Skill[];
  ruleDocs: RuleDoc[];
  commonRules: RuleDoc[];
  mcpServers: McpServer[];
  nodes: StudioNode[];
  edges: StudioEdge[];
  generatedAt: string;
};

export type GeneratedAgent = {
  name: string;
  role: AgentRole;
  roleLabel?: string;
  description?: string;
  systemPrompt?: string;
  isOrchestrator: boolean;
  delegatesTo: string[];
  assignedSkillIds: string[];
  assignedMcpServerIds: string[];
  color?: string;
  avatar?: string;
};

export type SuggestedSkill = {
  name: string;
  description: string;
  forAgent: string;
};

export type SuggestedMcpServer = {
  name: string;
  kind: "stdio" | "http";
  forAgent: string;
};

export type GeneratedAgentStructure = {
  teamName: string;
  teamDescription: string;
  agents: GeneratedAgent[];
  suggestedNewSkills: SuggestedSkill[];
  suggestedNewMcpServers: SuggestedMcpServer[];
};

export type PromptHistoryEntry = {
  id: string;
  prompt: string;
  backendId: string;
  createdAt: string;
  applied: boolean;
  result: GeneratedAgentStructure;
};

export type SkillPackPreviewItem = {
  name: string;
  relativePath: string;
  description?: string;
  hasScripts: boolean;
  allowedTools?: string;
};

export type SkillPackPreview = {
  zipPath: string;
  installDirDefault: string;
  skills: SkillPackPreviewItem[];
  warnings: string[];
};

export type CacheConfig = {
  retention: "short" | "long";
  contextPruning: {
    mode: "cache-ttl";
    ttlSeconds: number;
  };
  diagnostics: {
    enabled: boolean;
    logPath: string;
  };
  modelRouting: {
    heartbeat: string;
    cron: string;
    default: string;
  };
  contextThreshold: number;
};

export type CacheMetrics = {
  cacheRead: number;
  cacheWrite: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  savedCost: number;
  model: string;
  hitRate: number;
};

export type UsageMetrics = {
  inputTokens?: number;
  outputTokens?: number;
  cacheRead?: number;
  cacheWrite?: number;
  model?: string;
  cost?: number;
  savedCost?: number;
};

export type EventProvenance =
  | "user_input"
  | "orchestrator_to_worker"
  | "worker_proposal"
  | "announce_internal"
  | "announce_user"
  | "system";

export type AnnounceMessage = {
  runId: string;
  workerId: string;
  workerName: string;
  status: "ok" | "error" | "timeout";
  summary: string;
  proposalPath?: string;
  touchedFiles: string[];
  testsRun?: { passed: number; failed: number };
  durationMs: number;
};

export type ReviewDecision = "apply" | "reject" | "revise";

export type ProposalReview = {
  runId: string;
  taskId: string;
  decision: ReviewDecision;
  reason?: string;
  appliedAt?: number;
};

export type MemoryItemType =
  | "fact"
  | "decision"
  | "learning"
  | "summary"
  | "preference"
  | "artifact";

export type MemoryNamespace =
  | "system"
  | "shared"
  | `agent/${string}`
  | `flow/${string}`;

export type MemoryItem = {
  id: string;
  namespace: MemoryNamespace;
  type: MemoryItemType;
  title: string;
  content: string;
  source: {
    agentId?: string;
    runId?: string;
    taskId?: string;
    flowName?: string;
  };
  tags: string[];
  importance: number;
  createdAt: number;
  updatedAt: number;
  ttlMs?: number;
  supersededBy?: string;
};

export type MemoryQueryResult = {
  items: MemoryItem[];
  totalCount: number;
  budgetUsed: number;
  budgetLimit: number;
};

export type ContextPacket = {
  systemContext: string;
  relevantMemories: string;
  totalTokens: number;
  sources: Array<{
    memoryId: string;
    title: string;
    relevanceScore: number;
  }>;
};

export type MemoryCommit = {
  commitId: string;
  parentId?: string;
  author: string;
  message: string;
  itemsAdded: string[];
  itemsUpdated: string[];
  itemsSuperseded: string[];
  timestamp: number;
};

export type SessionScope = "workspace" | "user" | "channel";

export type SessionContext = {
  scope: SessionScope;
  scopeId?: string;
};

export type TaskSubmissionOptions = {
  priority?: "high" | "medium" | "low";
  assignTo?: string | "auto";
};

export type TaskStatus =
  | "planned"
  | "ready"
  | "running"
  | "blocked"
  | "done"
  | "failed"
  | "canceled";

export type TaskBlocker =
  | { kind: "approval"; message: string }
  | { kind: "input"; message: string }
  | { kind: "external"; message: string }
  | { kind: "error"; message: string; stack?: string };

export type Task = {
  id: string;
  title: string;
  agentId: string;
  deps: string[];
  estimateMs?: number;
  plannedStartMs?: number;
  plannedEndMs?: number;
  actualStartMs?: number;
  actualEndMs?: number;
  progress?: number;
  status: TaskStatus;
  blocker?: TaskBlocker;
  overrides?: {
    pinned?: boolean;
    forceStartMs?: number;
    forceAgentId?: string;
    priority?: number;
  };
  meta?: Record<string, unknown>;
  createdAtMs: number;
  updatedAtMs: number;
};

export type TaskEvent =
  | { type: "snapshot"; runId: string; tasks: Task[]; nowMs: number }
  | { type: "task_created"; runId: string; task: Task; nowMs: number }
  | { type: "task_updated"; runId: string; taskId: string; patch: Partial<Task>; nowMs: number }
  | { type: "task_deleted"; runId: string; taskId: string; nowMs: number }
  | { type: "schedule_recomputed"; runId: string; affectedTaskIds: string[]; nowMs: number };

export type RunStatus = "running" | "success" | "failed" | "stopped";

export type RunSummary = {
  runId: string;
  flow: string;
  startedAt: number;
  finishedAt?: number;
  status: RunStatus;
  backendId?: CliBackendId;
  runName?: string;
  tags?: string[];
};

export type RunEvent = {
  ts: number;
  runId: string;
  flow: string;
  type:
    | "run_started"
    | "run_finished"
    | "node_started"
    | "node_output"
    | "node_failed"
    | "edge_fired"
    | "task_dispatched"
    | "proposal_submitted"
    | "proposal_reviewed"
    | "proposal_applied"
    | "proposal_rejected"
    | "announce"
    | "memory_injected"
    | "run_log";
  nodeId?: string;
  edgeId?: string;
  input?: unknown;
  output?: unknown;
  payload?: unknown;
  usage?: UsageMetrics;
  provenance?: EventProvenance;
  parentRunId?: string;
  actor?: string;
  status?: RunStatus;
  message?: string;
  meta?: Record<string, unknown>;
};

export type PinnedOutput = {
  flowName: string;
  nodeId: string;
  output: unknown;
  pinnedAt: number;
  expiresAt?: number;
};

export type RequestId = string;

export type Position = { x: number; y: number };

type RequestMessage<TType extends string, TPayload = undefined> = TPayload extends undefined
  ? { type: TType; requestId?: RequestId }
  : { type: TType; payload: TPayload; requestId?: RequestId };

export type WebviewToExtensionMessage =
  | RequestMessage<"READY">
  | RequestMessage<"REFRESH">
  | RequestMessage<"OPEN_FILE", { path: string }>
  | RequestMessage<"REVEAL_IN_EXPLORER", { path: string }>
  | RequestMessage<
      "CREATE_SKILL",
      {
        baseDirPath: string;
        name: string;
        description: string;
        scope?: "project" | "personal" | "shared" | "global";
        extraFrontmatter?: Record<string, unknown>;
        generateOpenAiYaml?: boolean;
      }
    >
  | RequestMessage<
      "UPDATE_SKILL_FRONTMATTER",
      {
        skillId: string;
        name: string;
        description: string;
        extraFrontmatter: Record<string, unknown>;
      }
    >
  | RequestMessage<"EXPORT_PACK", { skillIds: string[]; outputPath?: string }>
  | RequestMessage<"REQUEST_IMPORT_PREVIEW", { zipPath?: string } | undefined>
  | RequestMessage<
      "CONFIRM_IMPORT_PACK",
      { zipPath: string; installDirPath: string; overwrite?: boolean }
    >
  | RequestMessage<"IMPORT_PACK", { zipPath?: string; installDirPath?: string }>
  | RequestMessage<"RUN_VALIDATION", { skillId: string }>
  | RequestMessage<"RUN_VALIDATION_ALL">
  | RequestMessage<"CREATE_OVERRIDE", { sourceRulePath: string }>
  | RequestMessage<"ADD_COMMON_RULE", { title: string; body: string }>
  | RequestMessage<"ENSURE_ROOT_AGENTS">
  | RequestMessage<"OPEN_COMMON_RULES_FOLDER">
  | RequestMessage<"CREATE_COMMON_RULE_DOCS">
  | RequestMessage<"SET_SKILL_ENABLED", { skillId: string; enabled: boolean }>
  | RequestMessage<"ADD_NOTE", { position: Position; text?: string }>
  | RequestMessage<"SAVE_NOTE", { noteId: string; text: string; position?: Position }>
  | RequestMessage<"DELETE_NOTE", { noteId: string }>
  | RequestMessage<"ADD_AGENT_LINK", { sourceAgentId: string; targetAgentId: string }>
  | RequestMessage<"REMOVE_AGENT_LINK", { sourceAgentId: string; targetAgentId: string }>
  | RequestMessage<
      "UPDATE_AGENT_PROFILE",
      {
        agentId: string;
        role?: AgentRole;
        roleLabel?: string;
        description?: string;
        systemPrompt?: string;
        isOrchestrator?: boolean;
        color?: string;
        avatar?: string;
      }
    >
  | RequestMessage<"ASSIGN_SKILL_TO_AGENT", { agentId: string; skillId: string }>
  | RequestMessage<"UNASSIGN_SKILL_FROM_AGENT", { agentId: string; skillId: string }>
  | RequestMessage<"ASSIGN_MCP_TO_AGENT", { agentId: string; mcpServerId: string }>
  | RequestMessage<"UNASSIGN_MCP_FROM_AGENT", { agentId: string; mcpServerId: string }>
  | RequestMessage<"SET_DELEGATION", { orchestratorId: string; workerIds: string[] }>
  | RequestMessage<
      "CREATE_AGENT",
      {
        name: string;
        role: AgentRole;
        roleLabel?: string;
        description?: string;
        systemPrompt?: string;
        isOrchestrator?: boolean;
      }
    >
  | RequestMessage<"DELETE_AGENT", { agentId: string }>
  | RequestMessage<"DETECT_CLI_BACKENDS">
  | RequestMessage<"TEST_BACKEND", { backendId: CliBackendId }>
  | RequestMessage<
      "GENERATE_AGENT_STRUCTURE",
      {
        prompt: string;
        backendId: CliBackend["id"];
        includeExistingAgents: boolean;
        includeExistingSkills: boolean;
        includeExistingMcpServers: boolean;
      }
    >
  | RequestMessage<
      "APPLY_GENERATED_STRUCTURE",
      {
        structure: GeneratedAgentStructure;
        createSuggestedSkills: boolean;
        overwriteExisting: boolean;
        historyId?: string;
      }
    >
  | RequestMessage<"GET_PROMPT_HISTORY">
  | RequestMessage<"DELETE_PROMPT_HISTORY", { historyId: string }>
  | RequestMessage<"REAPPLY_PROMPT_HISTORY", { historyId: string }>
  | RequestMessage<"LIST_FLOWS">
  | RequestMessage<"LOAD_FLOW", { flowName: string }>
  | RequestMessage<"SAVE_FLOW", { flowName: string; nodes: DiscoverySnapshot["nodes"]; edges: DiscoverySnapshot["edges"] }>
  | RequestMessage<"SAVE_NODE_POSITION", { nodeId: string; position: Position }>
  | RequestMessage<"SAVE_NODE_POSITIONS", { positions: Array<{ nodeId: string; position: Position }> }>
  | RequestMessage<"SCHEDULE_SUBSCRIBE", { runId: string }>
  | RequestMessage<"SCHEDULE_UNSUBSCRIBE", { runId: string }>
  | RequestMessage<"SCHEDULE_GET_SNAPSHOT", { runId: string }>
  | RequestMessage<"TASK_PIN", { runId: string; taskId: string; pinned: boolean }>
  | RequestMessage<
      "TASK_MOVE",
      { runId: string; taskId: string; forceStartMs?: number; forceAgentId?: string }
    >
  | RequestMessage<"TASK_SET_PRIORITY", { runId: string; taskId: string; priority?: number }>
  | RequestMessage<"TASK_SET_STATUS", { runId: string; taskId: string; status: TaskStatus }>
  | RequestMessage<
      "RUN_FLOW",
      {
        flowName: string;
        backendId?: CliBackendId;
        runName?: string;
        tags?: string[];
        instruction?: string;
        taskOptions?: TaskSubmissionOptions;
        usePinnedOutputs?: boolean;
        session?: SessionContext;
      }
    >
  | RequestMessage<
      "RUN_NODE",
      {
        flowName: string;
        nodeId: string;
        backendId?: CliBackendId;
        usePinnedOutput?: boolean;
        session?: SessionContext;
      }
    >
  | RequestMessage<"REPLAY_RUN", { runId: string; modifiedPrompts?: Record<string, string> }>
  | RequestMessage<"STOP_RUN", { runId: string }>
  | RequestMessage<"LIST_RUNS", { flowName?: string } | undefined>
  | RequestMessage<"LOAD_RUN", { flowName: string; runId: string }>
  | RequestMessage<"PIN_OUTPUT", { flowName: string; nodeId: string; output: unknown }>
  | RequestMessage<"UNPIN_OUTPUT", { flowName: string; nodeId: string }>
  | RequestMessage<"APPLY_PROPOSAL", { runId: string; agentId: string }>
  | RequestMessage<"REJECT_PROPOSAL", { runId: string; agentId: string; reason?: string }>
  | RequestMessage<"INSERT_PATTERN", { patternId: string; anchor?: Position }>
  | RequestMessage<"CONFIGURE_INTERACTION_EDGE", { edgeId: string; label?: string; data: InteractionEdgeData }>
  | RequestMessage<"HANDOFF_RECEIVED", { runId: string; fromAgentId: string; toAgentId: string; handoff: HandoffEnvelope }>
  | RequestMessage<"GET_COLLAB_LOG", { runId: string }>
  | RequestMessage<"GET_COLLAB_REPORT_MD", { runId: string }>
  | RequestMessage<"MANUAL_REVIEW", { runId: string; taskId: string; decision: ReviewDecision; reason?: string }>
  | RequestMessage<
      "GET_MEMORY_ITEMS",
      { namespace?: MemoryNamespace; type?: MemoryItemType; limit?: number } | undefined
    >
  | RequestMessage<
      "SEARCH_MEMORY",
      { query: string; namespaces?: MemoryNamespace[]; budgetTokens?: number }
    >
  | RequestMessage<"ADD_MEMORY_ITEM", { item: Omit<MemoryItem, "id" | "createdAt" | "updatedAt"> }>
  | RequestMessage<"SUPERSEDE_MEMORY", { oldItemId: string; newContent: string; reason: string }>
  | RequestMessage<"MEMORY_CHECKOUT", { commitId: string }>
  | RequestMessage<"GET_MEMORY_COMMITS", { limit?: number } | undefined>
  | RequestMessage<"GET_CACHE_METRICS", { flowName: string }>
  | RequestMessage<"GET_CACHE_CONFIG">
  | RequestMessage<"UPDATE_CACHE_CONFIG", CacheConfig>
  | RequestMessage<"RESET_CACHE_METRICS", { flowName?: string } | undefined>
  | RequestMessage<"SET_AGENT_RUNTIME", { agentId: string; runtime: AgentRuntime | null }>
  | RequestMessage<"SET_DEFAULT_BACKEND", { backendId: CliBackendId }>
  | RequestMessage<"SET_BACKEND_OVERRIDES", { overrides: CliBackendOverrides }>
  | RequestMessage<"LOG_INTERACTION_EVENT", {
      flowName: string;
      interactionId: string;
      edgeId: string;
      event: string;
      data?: Record<string, unknown>;
    }>;

export type ExtensionToWebviewMessage =
  | { type: "INIT_STATE"; payload: { snapshot: DiscoverySnapshot } }
  | {
      type: "STATE_PATCH";
      payload: {
        snapshot?: DiscoverySnapshot;
        skillEnabled?: { skillId: string; enabled: boolean };
      };
    }
  | { type: "IMPORT_PREVIEW"; payload: { preview: SkillPackPreview } }
  | { type: "CLI_BACKENDS"; payload: { backends: CliBackend[] } }
  | { type: "COLLAB_EVENT"; payload: {
      event: "task_dispatched" | "proposal_submitted" | "proposal_reviewed" | "announce";
      runId: string;
      flowName: string;
      actor: string;
      provenance: EventProvenance;
      data: unknown;
      ts: number;
    } }
  | { type: "MEMORY_UPDATED"; payload: { item: MemoryItem; action: "added" | "updated" | "superseded" | "deleted" } }
  | { type: "MEMORY_QUERY_RESULT"; payload: MemoryQueryResult }
  | { type: "CONTEXT_PACKET_BUILT"; payload: { taskId: string; packet: ContextPacket } }
  | { type: "PROMPT_HISTORY"; payload: { items: PromptHistoryEntry[] } }
  | { type: "SCHEDULE_EVENT"; payload: { event: TaskEvent } }
  | { type: "CACHE_METRICS_UPDATE"; payload: CacheMetrics }
  | { type: "CONTEXT_THRESHOLD_WARNING"; payload: { current: number; threshold: number } }
  | {
      type: "GENERATION_PROGRESS";
      payload: {
        stage: "building_prompt" | "calling_cli" | "parsing_output" | "done" | "error";
        message: string;
        progress?: number;
      };
    }
  | { type: "TOAST"; payload: { level: "info" | "warning" | "error"; message: string } }
  | { type: "ERROR"; payload: { message: string; detail?: string } }
  | { type: "RESPONSE_OK"; inReplyTo: RequestId; result?: unknown }
  | { type: "RESPONSE_ERROR"; inReplyTo: RequestId; error: { message: string; detail?: string } };

export function isResponseMessage(
  message: ExtensionToWebviewMessage
): message is
  | { type: "RESPONSE_OK"; inReplyTo: RequestId; result?: unknown }
  | { type: "RESPONSE_ERROR"; inReplyTo: RequestId; error: { message: string; detail?: string } } {
  return message.type === "RESPONSE_OK" || message.type === "RESPONSE_ERROR";
}
