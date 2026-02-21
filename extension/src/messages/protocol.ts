import type {
  AgentRuntime,
  AgentRole,
  BackendBudget,
  BackendModelCatalog,
  BackendUsageSummary,
  ChatMessage,
  ChatMode,
  CanonicalBackendId,
  ClaudePermissionMode,
  ClaudeQuotaSnapshot, CliSubscriptionQuota,
  ContextPacket,
  CacheConfig,
  CacheMetrics,
  CliBackend,
  CliBackendId,
  CliBackendOverrides,
  CodexApprovalPolicy,
  CodexSandboxPolicy,
  GeminiApprovalMode,
  DiscoverySnapshot,
  EventProvenance,
  GeneratedAgentStructure,
  HandoffEnvelope,
  InteractionEdgeData,
  MemoryCommit,
  MemoryItem,
  MemoryItemType,
  MemoryNamespace,
  MemoryQueryResult,
  ProposalReview,
  PromptHistoryEntry,
  ReviewDecision,
  WorkPlan,
  WorkPlanModification,
  TaskStatusUpdate,
  SessionContext,
  SkillPackPreview,
  TaskEvent,
  TaskSubmissionOptions,
  TaskStatus
} from "../types";

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
        backendId?: CanonicalBackendId;
        modelId?: string;
        promptMode?: "append" | "replace";
        maxTurns?: number;
        maxBudgetUsd?: number;
        permissionMode?: ClaudePermissionMode;
        allowedTools?: string[];
        codexApproval?: CodexApprovalPolicy;
        codexSandbox?: CodexSandboxPolicy;
        geminiApprovalMode?: GeminiApprovalMode;
        geminiUseSandbox?: boolean;
        additionalDirs?: string[];
        enableWebSearch?: boolean;
        sessionId?: string;
        sessionName?: string;
      }
    >
  | RequestMessage<"DELETE_AGENT", { agentId: string }>
  | RequestMessage<"DETECT_CLI_BACKENDS">
  | RequestMessage<"TEST_BACKEND", { backendId: CliBackendId }>
  | RequestMessage<
      "GENERATE_AGENT_STRUCTURE",
      {
        prompt: string;
        backendId?: CliBackend["id"];
        preferredBackends?: CanonicalBackendId[];
        useSmartAssignment?: boolean;
        budgetConstraint?: "strict" | "soft";
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
  | RequestMessage<
      "CHAT_SEND",
      {
        content: string;
        mode: ChatMode;
        backendId: Exclude<CliBackendId, "auto">;
        modelId?: string;
        attachments?: Array<{ type: "file" | "image"; path: string }>;
      }
    >
  | RequestMessage<"WORK_PLAN_CONFIRM", { planId: string }>
  | RequestMessage<"WORK_PLAN_MODIFY", { planId: string; modifications: WorkPlanModification[] }>
  | RequestMessage<"WORK_PLAN_CANCEL", { planId: string }>
  | RequestMessage<"TASK_STOP_FROM_CHAT", { taskId: string }>
  | RequestMessage<"CHAT_GET_HISTORY", { limit?: number; before?: string } | undefined>
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
  | RequestMessage<"GET_BACKEND_USAGE", {
      backendId?: CanonicalBackendId;
      period?: "today" | "week" | "month";
    } | undefined>
  | RequestMessage<"SET_BACKEND_BUDGET", {
      backendId: CanonicalBackendId;
      budget: BackendBudget;
    }>
  | RequestMessage<"GET_BACKEND_BUDGETS">
  | RequestMessage<"LOG_INTERACTION_EVENT", {
      flowName: string;
      interactionId: string;
      edgeId: string;
      event: string;
      data?: Record<string, unknown>;
    }>
  /** Fetch full event log for a task to display in the detail modal. */
  | RequestMessage<"GET_TASK_DETAIL", { runId: string; flowName: string; taskId: string; nodeId?: string }>
  /** Human replies to an orchestrator question that blocked a task. */
  | RequestMessage<"HUMAN_QUERY_RESPONSE", { runId: string; taskId: string; answer: string }>;

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
  | { type: "BACKEND_MODELS_UPDATE"; payload: { catalogs: BackendModelCatalog[] } }
  | { type: "BACKEND_QUOTA_UPDATE"; payload: { claude?: ClaudeQuotaSnapshot; codex?: CliSubscriptionQuota; gemini?: CliSubscriptionQuota } }
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
  | { type: "CHAT_MESSAGE"; payload: { message: ChatMessage } }
  | { type: "CHAT_STREAM_CHUNK"; payload: { messageId: string; chunk: string } }
  | { type: "WORK_PLAN_UPDATED"; payload: { plan: WorkPlan } }
  | { type: "TASK_STATUS_UPDATE"; payload: { update: TaskStatusUpdate } }
  | { type: "CHAT_HISTORY"; payload: { messages: ChatMessage[] } }
  | { type: "SCHEDULE_EVENT"; payload: { event: TaskEvent } }
  | { type: "CACHE_METRICS_UPDATE"; payload: CacheMetrics }
  | { type: "BACKEND_USAGE_UPDATE"; payload: { summaries: BackendUsageSummary[] } }
  | { type: "BUDGET_WARNING"; payload: { backendId: CanonicalBackendId; type: "approaching" | "exceeded"; detail: string } }
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
  | { type: "RESPONSE_ERROR"; inReplyTo: RequestId; error: { message: string; detail?: string } }
  /** Full event log for a task — sent in reply to GET_TASK_DETAIL. */
  | { type: "TASK_DETAIL"; payload: { taskId: string; output?: string; events: Record<string, unknown>[] } };

export function hasRequestId(message: WebviewToExtensionMessage): message is WebviewToExtensionMessage & {
  requestId: RequestId;
} {
  return typeof message.requestId === "string" && message.requestId.length > 0;
}
