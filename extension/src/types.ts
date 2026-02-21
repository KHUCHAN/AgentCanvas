export type Scope = "project" | "personal" | "shared" | "global";
export type AgentRole =
  | "orchestrator"
  | "coder"
  | "researcher"
  | "reviewer"
  | "planner"
  | "tester"
  | "writer"
  | "custom";

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

export type PromptMode = "append" | "replace";
export type ClaudePermissionMode = "default" | "plan" | "skip";
export type CodexApprovalPolicy = "on-request" | "untrusted" | "never";
export type CodexSandboxPolicy = "read-only" | "workspace-write" | "danger-full-access";
export type GeminiApprovalMode = "default" | "auto_edit" | "yolo";

export type AgentRuntime =
  | {
      kind: "cli";
      backendId: CliBackendId;
      cwdMode?: "workspace" | "agentHome";
      modelId?: string;
      promptMode?: PromptMode;
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
      useWorktree?: boolean;
      worktreeName?: string;
    }
  | {
      kind: "openclaw";
      gatewayUrl?: string;
      agentKey?: string;
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

export interface InteractionEdgeData {
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
}

export type SystemNodeKind =
  | "judge"
  | "blackboard"
  | "router"
  | "broker"
  | "coordinator"
  | "gateway"
  | "custom";

export interface SystemNodeData {
  id: string;
  name: string;
  role: string;
  description?: string;
  kind?: SystemNodeKind;
  status?: "active" | "idle" | "paused";
}

export interface HandoffEnvelope {
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
}

export interface ValidationIssue {
  level: "error" | "warning";
  code: string;
  message: string;
}

export interface AgentProfile {
  id: string;
  name: string;
  providerId: string;
  workspaceRoot?: string;
  homeDir: string;
  metadata?: Record<string, string>;
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
}

export interface Skill {
  id: string;
  ownerAgentId: string;
  name: string;
  description: string;
  path: string;
  folderName: string;
  scope: Scope;
  providerId: string;
  enabled: boolean;
  extraFrontmatter: Record<string, unknown>;
  validation: ValidationIssue[];
}

export interface RuleDoc {
  id: string;
  ownerAgentId: string;
  type: "codex-agents";
  path: string;
  scope: "global" | "project";
  orderIndex: number;
  providerId: string;
}

export interface StudioNode {
  id: string;
  type: "agent" | "provider" | "skill" | "ruleDoc" | "note" | "folder" | "commonRules" | "system";
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface StudioEdge {
  id: string;
  source: string;
  target: string;
  type: "contains" | "overrides" | "locatedIn" | "appliesTo" | "agentLink" | "delegates" | "interaction";
  label?: string;
  data?: Record<string, unknown>;
}

export interface McpServer {
  id: string;
  ownerAgentId: string;
  providerId: "codex" | "vscode";
  name: string;
  kind: "stdio" | "http";
  configLocationPath: string;
  enabled: boolean;
  tools?: string[];
}

export interface DiscoverySnapshot {
  agent: AgentProfile;
  agents: AgentProfile[];
  skills: Skill[];
  ruleDocs: RuleDoc[];
  commonRules: RuleDoc[];
  mcpServers: McpServer[];
  nodes: StudioNode[];
  edges: StudioEdge[];
  generatedAt: string;
}

export interface StickyNote {
  id: string;
  text: string;
  position: { x: number; y: number };
}

export interface CliBackend {
  id: CliBackendId;
  displayName: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  available: boolean;
  version?: string;
  stdinPrompt?: boolean;
}

export interface CliBackendOverride {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  displayName?: string;
  stdinPrompt?: boolean;
}

export type CliBackendOverrides = Partial<Record<Exclude<CliBackendId, "auto">, CliBackendOverride>>;
export type NonAutoBackendId = Exclude<CliBackendId, "auto">;
export type CanonicalBackendId = "claude" | "codex" | "gemini" | "aider" | "custom";

export interface BackendCapabilityProfile {
  backendId: CanonicalBackendId;
  displayName: string;
  strengths: {
    coding: number;
    review: number;
    testing: number;
    research: number;
    writing: number;
    planning: number;
    multimodal: number;
    toolUse: number;
    longContext: number;
    costEfficiency: number;
  };
  limitations: string[];
  models: Array<{
    id: string;
    tier: "fast" | "standard" | "advanced";
    contextWindow: number;
    costPer1MInput: number;
    costPer1MOutput: number;
  }>;
  features: {
    stdinPrompt: boolean;
    streaming: boolean;
    mcpSupport: boolean;
    imageInput: boolean;
    webSearch: boolean;
    codeExecution: boolean;
    sessionResume: boolean;
  };
}

export interface BackendModelOption {
  id: string;
  label: string;
  tier?: "fast" | "standard" | "advanced" | "experimental";
}

export interface BackendModelCatalog {
  backendId: CanonicalBackendId;
  models: BackendModelOption[];
  fetchedAt: number;
  source: "dynamic" | "fallback";
}

export interface ClaudeQuotaSnapshot {
  sessionUsedPct: number;
  weekAllUsedPct: number;
  weekSonnetUsedPct: number;
  sessionResetsAt?: string;
  weekResetsAt?: string;
  fetchedAt: number;
  source: "dynamic" | "fallback";
}

export interface CliSubscriptionQuota {
  sessionUsedPct: number;
  weekAllUsedPct: number;
  sessionResetsAt?: string;
  weekResetsAt?: string;
  fetchedAt: number;
  source: "dynamic" | "fallback";
}

export interface GeneratedAgent {
  name: string;
  role: AgentRole;
  roleLabel?: string;
  description?: string;
  systemPrompt?: string;
  isOrchestrator: boolean;
  delegatesTo: string[];
  assignedSkillIds: string[];
  assignedMcpServerIds: string[];
  assignedBackend: CanonicalBackendId;
  assignedModel?: string;
  backendAssignReason?: string;
  color?: string;
  avatar?: string;
}

export interface SuggestedSkill {
  name: string;
  description: string;
  forAgent: string;
}

export interface SuggestedMcpServer {
  name: string;
  kind: "stdio" | "http";
  forAgent: string;
}

export type WorkCategory =
  | "new_feature"
  | "bug_fix"
  | "refactor"
  | "code_review"
  | "testing"
  | "documentation"
  | "research"
  | "devops"
  | "design"
  | "data_pipeline"
  | "full_stack"
  | "mixed";

export interface WorkIntentAnalysis {
  primaryCategory: WorkCategory;
  secondaryCategories: WorkCategory[];
  categoryWeights: Partial<Record<WorkCategory, number>>;
  suggestedRoles: Array<{
    role: AgentRole;
    count: number;
    reason: string;
    preferredBackend: CanonicalBackendId;
    backendReason: string;
  }>;
  estimatedComplexity: "light" | "medium" | "heavy";
  estimatedDuration: "minutes" | "hours" | "days";
}

export interface BackendBudget {
  dailyMaxCost?: number;
  weeklyMaxCost?: number;
  monthlyMaxCost?: number;
  dailyMaxCalls?: number;
  weeklyMaxCalls?: number;
  monthlyMaxCalls?: number;
}

export interface BackendUsagePeriod {
  callCount: number;
  totalTokens: number;
  estimatedCost: number;
  avgLatencyMs: number;
  successRate: number;
}

export interface BackendUsageRecord {
  backendId: CanonicalBackendId;
  date: string;
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  estimatedCost: number;
  avgLatencyMs: number;
  errorCount: number;
  successRate: number;
  calls: Array<{
    timestamp: string;
    flowName?: string;
    agentId?: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    latencyMs: number;
    model?: string;
    success: boolean;
    cost: number;
  }>;
}

export interface BackendUsageSummary {
  backendId: CanonicalBackendId;
  today: BackendUsagePeriod;
  thisWeek: BackendUsagePeriod;
  thisMonth: BackendUsagePeriod;
  budget?: BackendBudget;
  availabilityScore: number;
}

export interface GeneratedAgentStructure {
  teamName: string;
  teamDescription: string;
  agents: GeneratedAgent[];
  suggestedNewSkills: SuggestedSkill[];
  suggestedNewMcpServers: SuggestedMcpServer[];
  workIntent: WorkIntentAnalysis;
  backendUsageAtBuild: BackendUsageSummary[];
}

export interface PromptHistoryEntry {
  id: string;
  prompt: string;
  backendId: string;
  createdAt: string;
  applied: boolean;
  result: GeneratedAgentStructure;
}

export type ChatMode = "planning" | "direct" | "review";
export type ChatMessageRole = "user" | "orchestrator" | "system";

export interface WorkPlanItem {
  index: number;
  title: string;
  description?: string;
  assignedAgentId: string;
  assignedAgentName: string;
  assignedBackend: NonAutoBackendId;
  assignedModel?: string;
  priority: "high" | "medium" | "low";
  deps: number[];
  taskId?: string;
}

export interface WorkPlan {
  id: string;
  status: "draft" | "confirmed" | "executing" | "completed" | "canceled";
  items: WorkPlanItem[];
  estimatedDuration?: string;
  estimatedCost?: number;
}

export interface WorkPlanModification {
  index: number;
  title?: string;
  description?: string;
  priority?: WorkPlanItem["priority"];
  assignedAgentId?: string;
  assignedBackend?: NonAutoBackendId;
  deps?: number[];
}

export interface TaskStatusUpdate {
  taskId: string;
  title: string;
  status: Task["status"];
  progress: number;
  agentName: string;
  backendId: string;
  message?: string;
}

export interface TaskCompleteSummary {
  taskId: string;
  title: string;
  durationMs: number;
  changedFiles: string[];
  diffSummary?: string;
  cost?: number;
}

export type TaskConversationRole = "orchestrator" | "agent";

export interface TaskConversationTurn {
  turnId: string;
  runId: string;
  taskId: string;
  role: TaskConversationRole;
  content: string;
  timestamp: number;
  agentId?: string;
  backendId?: string;
  model?: string;
}

export interface FileDiffEntry {
  path: string;
  additions: number;
  deletions: number;
  preview?: string;
}

export type ChatMessageContent =
  | { kind: "text"; text: string }
  | { kind: "work_plan"; plan: WorkPlan }
  | { kind: "task_status"; taskId: string; status: TaskStatusUpdate }
  | { kind: "task_complete"; taskId: string; summary: TaskCompleteSummary }
  | { kind: "run_event"; event: RunEvent }
  | { kind: "node_context"; nodeId: string; nodeType: string; data: Record<string, unknown> }
  | { kind: "error"; message: string; recoverable: boolean }
  | { kind: "cost_alert"; backendId: string; usage: BackendUsageSummary }
  | { kind: "file_diff"; files: FileDiffEntry[] }
  | { kind: "approval_request"; requestId: string; description: string; options: string[] }
  /** Orchestrator needs a human answer before the blocked task can resume. */
  | { kind: "human_query"; taskId: string; question: string; runId: string };

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: ChatMessageContent[];
  timestamp: number;
  metadata?: {
    runId?: string;
    taskIds?: string[];
    backendId?: string;
    model?: string;
    tokens?: { input: number; output: number };
  };
}

export interface SkillPackPreviewItem {
  name: string;
  relativePath: string;
  description?: string;
  hasScripts: boolean;
  allowedTools?: string;
}

export interface SkillPackPreview {
  zipPath: string;
  installDirDefault: string;
  skills: SkillPackPreviewItem[];
  warnings: string[];
}

export interface CacheConfig {
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
}

export interface CacheMetrics {
  cacheRead: number;
  cacheWrite: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  savedCost: number;
  model: string;
  hitRate: number;
}

export interface UsageMetrics {
  inputTokens?: number;
  outputTokens?: number;
  cacheRead?: number;
  cacheWrite?: number;
  model?: string;
  cost?: number;
  savedCost?: number;
}

export type EventProvenance =
  | "user_input"
  | "orchestrator_to_worker"
  | "worker_proposal"
  | "announce_internal"
  | "announce_user"
  | "system";

export interface AnnounceMessage {
  runId: string;
  workerId: string;
  workerName: string;
  status: "ok" | "error" | "timeout";
  summary: string;
  proposalPath?: string;
  touchedFiles: string[];
  testsRun?: { passed: number; failed: number };
  durationMs: number;
}

export type ReviewDecision = "apply" | "reject" | "revise";

export interface ProposalReview {
  runId: string;
  taskId: string;
  decision: ReviewDecision;
  reason?: string;
  appliedAt?: number;
}

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

export interface MemoryItem {
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
}

export interface MemoryQueryResult {
  items: MemoryItem[];
  totalCount: number;
  budgetUsed: number;
  budgetLimit: number;
}

export interface ContextPacket {
  systemContext: string;
  relevantMemories: string;
  totalTokens: number;
  sources: Array<{
    memoryId: string;
    title: string;
    relevanceScore: number;
  }>;
}

export interface MemoryCommit {
  commitId: string;
  parentId?: string;
  author: string;
  message: string;
  itemsAdded: string[];
  itemsUpdated: string[];
  itemsSuperseded: string[];
  timestamp: number;
}

export type SessionScope = "workspace" | "user" | "channel";

export interface SessionContext {
  scope: SessionScope;
  scopeId?: string;
}

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

export interface Task {
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
}

export type TaskEvent =
  | { type: "snapshot"; runId: string; tasks: Task[]; nowMs: number }
  | { type: "task_created"; runId: string; task: Task; nowMs: number }
  | { type: "task_updated"; runId: string; taskId: string; patch: Partial<Task>; nowMs: number }
  | { type: "task_deleted"; runId: string; taskId: string; nowMs: number }
  | { type: "schedule_recomputed"; runId: string; affectedTaskIds: string[]; nowMs: number };

export type RunStatus = "running" | "success" | "failed" | "stopped";

export interface RunSummary {
  runId: string;
  flow: string;
  startedAt: number;
  finishedAt?: number;
  status: RunStatus;
  backendId?: CliBackendId;
  runName?: string;
  tags?: string[];
}

export interface RunEvent {
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
    | "human_query_requested"
    | "human_query_answered"
    | "task_resumed_after_human_query"
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
}

export interface PinnedOutput {
  flowName: string;
  nodeId: string;
  output: unknown;
  pinnedAt: number;
  expiresAt?: number;
}
