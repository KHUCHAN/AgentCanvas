import { randomBytes } from "node:crypto";
import type {
  AgentProfile,
  BackendUsageSummary,
  ChatMessage,
  ChatMode,
  NonAutoBackendId,
  Task,
  WorkPlan,
  WorkPlanItem
} from "../types";
import { normalizeBackendId } from "./backendProfiles";

type PlannerCallback = (input: {
  request: string;
  backendId: NonAutoBackendId;
  agents: AgentProfile[];
}) => Promise<string | undefined>;

export interface OrchestratorContext {
  agents: AgentProfile[];
  activeRunId?: string;
  activeTasks: Task[];
  completedTasks: Task[];
  chatHistory: ChatMessage[];
  usageSummaries: BackendUsageSummary[];
}

export class ChatOrchestrator {
  public async handleUserMessage(input: {
    content: string;
    mode: ChatMode;
    backendId: NonAutoBackendId;
    context: OrchestratorContext;
    planner?: PlannerCallback;
  }): Promise<{
    messages: ChatMessage[];
    draftPlan?: WorkPlan;
  }> {
    const message = input.content.trim();
    if (!message) {
      return {
        messages: [
          createChatMessage("system", [
            { kind: "error", message: "Please enter a message.", recoverable: true }
          ])
        ]
      };
    }

    if (isStatusCommand(message)) {
      return {
        messages: [this.buildStatusReportMessage(input.context)]
      };
    }

    if (input.mode === "review") {
      return {
        messages: [
          createChatMessage("orchestrator", [
            {
              kind: "text",
              text: "Review mode enabled. I analyzed your request and can draft an execution plan when you switch to Planning or Direct mode."
            }
          ], { backendId: input.backendId })
        ]
      };
    }

    const draftPlan = await this.buildDraftPlan({
      request: message,
      agents: input.context.agents,
      backendId: input.backendId,
      planner: input.planner
    });

    const preface = input.mode === "direct"
      ? "Direct mode is on. I prepared a plan and can execute immediately."
      : "I prepared a draft work plan. Review and confirm when ready.";

    return {
      messages: [
        createChatMessage(
          "orchestrator",
          [{ kind: "text", text: preface }],
          { backendId: input.backendId }
        ),
        createChatMessage(
          "orchestrator",
          [{ kind: "work_plan", plan: draftPlan }],
          { backendId: input.backendId }
        )
      ],
      draftPlan
    };
  }

  public async buildDraftPlan(input: {
    request: string;
    agents: AgentProfile[];
    backendId: NonAutoBackendId;
    planner?: PlannerCallback;
  }): Promise<WorkPlan> {
    const parsedPlannerItems = await this.tryBuildPlanItemsWithPlanner(input);
    const sourceItems: ParsedPlanItem[] = parsedPlannerItems.length > 0
      ? parsedPlannerItems
      : splitWorkItems(input.request).map((title) => ({ title }));

    const items: WorkPlanItem[] = sourceItems.slice(0, 8).map((entry, index) => {
      const contextText = `${entry.title} ${entry.description ?? ""}`.trim();
      const inferredRole = inferRoleFromText(contextText);
      const hintedAgent = resolveAgentByHint(input.agents, entry.assignedAgentId, entry.assignedAgentName);
      const assignedAgent = hintedAgent ?? pickAgentForRole(input.agents, inferredRole) ?? pickFallbackAgent(input.agents);
      const assignedBackend =
        normalizeBackendFromHint(entry.assignedBackend) ??
        inferBackendFromText(contextText, input.backendId);
      const deps = normalizeDeps(entry.deps, index);
      const priority = normalizePriority(entry.priority) ?? (index === 0 ? "high" : "medium");
      return {
        index: index + 1,
        title: entry.title,
        description: entry.description ?? `Deliverable ${index + 1} for "${entry.title}"`,
        assignedAgentId: assignedAgent?.id ?? "unassigned",
        assignedAgentName: assignedAgent?.name ?? "Unassigned",
        assignedBackend,
        assignedModel: entry.assignedModel ?? resolveModelHint(assignedBackend),
        priority,
        deps,
        taskId: undefined
      };
    });

    return {
      id: `plan:${randomBytes(6).toString("hex")}`,
      status: "draft",
      items,
      estimatedDuration: estimateDuration(items.length),
      estimatedCost: estimateCost(items.length)
    };
  }

  private async tryBuildPlanItemsWithPlanner(input: {
    request: string;
    agents: AgentProfile[];
    backendId: NonAutoBackendId;
    planner?: PlannerCallback;
  }): Promise<ParsedPlanItem[]> {
    if (!input.planner) {
      return [];
    }
    try {
      const raw = await input.planner({
        request: buildPlannerPrompt(input.request, input.agents, input.backendId),
        backendId: input.backendId,
        agents: input.agents
      });
      if (!raw) {
        return [];
      }
      return parsePlannerOutput(raw);
    } catch {
      return [];
    }
  }

  private buildStatusReportMessage(context: OrchestratorContext): ChatMessage {
    const totalActive = context.activeTasks.length;
    const completed = context.completedTasks.length;
    const text = totalActive === 0
      ? "No active tasks right now. I am ready for the next request."
      : `Current status: ${totalActive} active task(s), ${completed} completed task(s).`;
    return createChatMessage("orchestrator", [{ kind: "text", text }]);
  }
}

type ParsedPlanItem = {
  title: string;
  description?: string;
  assignedAgentId?: string;
  assignedAgentName?: string;
  assignedBackend?: string;
  assignedModel?: string;
  priority?: string;
  deps?: number[];
};

function buildPlannerPrompt(
  request: string,
  agents: AgentProfile[],
  backendId: NonAutoBackendId
): string {
  const availableAgents = agents.length > 0
    ? agents.map((agent) =>
      `- id: ${agent.id}, name: ${agent.name}, role: ${agent.role}, backend: ${agent.runtime?.kind === "cli" ? agent.runtime.backendId : "auto"}`
    ).join("\n")
    : "- id: unassigned, name: Unassigned, role: coder, backend: auto";

  return [
    "You are the AgentCanvas orchestrator planner.",
    "Break the user request into actionable tasks and assign each task to the best agent.",
    "Return JSON only. No markdown fences, no prose.",
    "Schema:",
    "{",
    '  "items": [',
    "    {",
    '      "title": "short task title",',
    '      "description": "implementation detail",',
    '      "assignedAgentId": "agent id from list",',
    '      "assignedBackend": "claude|codex|gemini",',
    '      "priority": "high|medium|low",',
    '      "deps": [1]',
    "    }",
    "  ]",
    "}",
    "",
    "Rules:",
    "- Use only agent ids in the list when assigning.",
    "- Keep deps 1-based indexes and only point to earlier items.",
    "- Output 1 to 8 tasks.",
    "",
    `Preferred planner backend: ${backendId}`,
    "Available agents:",
    availableAgents,
    "",
    "User request:",
    request
  ].join("\n");
}

function parsePlannerOutput(raw: string): ParsedPlanItem[] {
  const parsed = parseJsonLike(raw);
  if (!parsed) {
    return [];
  }
  const candidates = extractPlannerItems(parsed);
  if (candidates.length === 0) {
    return [];
  }

  const normalized: ParsedPlanItem[] = [];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") {
      continue;
    }
    const record = candidate as Record<string, unknown>;
    const title =
      pickString(record, ["title", "task", "name", "summary", "objective"]) ??
      pickString(record, ["description", "detail"]);
    if (!title) {
      continue;
    }
    normalized.push({
      title,
      description: pickString(record, ["description", "detail", "notes"]),
      assignedAgentId: pickString(record, ["assignedAgentId", "agentId", "ownerId"]),
      assignedAgentName: pickString(record, ["assignedAgentName", "agentName", "owner", "agent"]),
      assignedBackend: pickString(record, ["assignedBackend", "backend", "backendId"]),
      assignedModel: pickString(record, ["assignedModel", "model", "modelId"]),
      priority: pickString(record, ["priority"]),
      deps: parseDeps(record.deps)
    });
  }
  return normalized;
}

function parseJsonLike(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  const candidates: string[] = [trimmed];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    candidates.push(fenced[1].trim());
  }

  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    candidates.push(trimmed.slice(objectStart, objectEnd + 1));
  }
  const arrayStart = trimmed.indexOf("[");
  const arrayEnd = trimmed.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    candidates.push(trimmed.slice(arrayStart, arrayEnd + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      continue;
    }
  }
  return undefined;
}

function extractPlannerItems(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (!parsed || typeof parsed !== "object") {
    return [];
  }
  const record = parsed as Record<string, unknown>;
  const candidates = [record.items, record.tasks, record.plan];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }
  return [];
}

function pickString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function parseDeps(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const numbers = value
    .map((entry) => {
      if (typeof entry === "number" && Number.isFinite(entry)) {
        return Math.round(entry);
      }
      if (typeof entry === "string" && entry.trim()) {
        const parsed = Number(entry.trim());
        if (Number.isFinite(parsed)) {
          return Math.round(parsed);
        }
      }
      return undefined;
    })
    .filter((entry): entry is number => typeof entry === "number");
  return numbers.length > 0 ? numbers : undefined;
}

function normalizePriority(value: string | undefined): WorkPlanItem["priority"] | undefined {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "high" || normalized === "medium" || normalized === "low") {
    return normalized;
  }
  return undefined;
}

function normalizeDeps(deps: number[] | undefined, index: number): number[] {
  if (!deps || deps.length === 0) {
    return index === 0 ? [] : [index];
  }
  const normalized = [...new Set(
    deps
      .map((dep) => Math.round(dep))
      .filter((dep) => dep > 0 && dep <= index)
  )];
  return normalized;
}

function normalizeBackendFromHint(value: string | undefined): NonAutoBackendId | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "claude" || normalized === "claude-code") {
    return "claude";
  }
  if (normalized === "codex" || normalized === "codex-cli") {
    return "codex";
  }
  if (normalized === "gemini" || normalized === "gemini-cli") {
    return "gemini";
  }
  return undefined;
}

function resolveAgentByHint(
  agents: AgentProfile[],
  hintedId: string | undefined,
  hintedName: string | undefined
): AgentProfile | undefined {
  const normalizedHintedId = hintedId?.trim();
  if (normalizedHintedId) {
    const direct = agents.find((agent) => agent.id === normalizedHintedId);
    if (direct) {
      return direct;
    }
  }

  const normalizedHintedName = hintedName?.trim().toLowerCase();
  if (normalizedHintedName) {
    const byName = agents.find((agent) => agent.name.trim().toLowerCase() === normalizedHintedName);
    if (byName) {
      return byName;
    }
  }
  return undefined;
}

export function isConfirmCommand(content: string): boolean {
  const normalized = content.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return (
    normalized === "go" ||
    normalized === "start" ||
    normalized === "confirm" ||
    normalized === "run" ||
    normalized === "진행" ||
    normalized === "진행해" ||
    normalized === "시작해" ||
    normalized === "ㄱ"
  );
}

export function isCancelCommand(content: string): boolean {
  const normalized = content.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return (
    normalized === "cancel" ||
    normalized === "stop" ||
    normalized === "abort" ||
    normalized === "취소" ||
    normalized === "중단" ||
    normalized === "멈춰"
  );
}

function isStatusCommand(content: string): boolean {
  const normalized = content.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  const explicitStatusCommands = new Set([
    "status",
    "/status",
    "progress",
    "/progress",
    "state",
    "/state",
    "상태",
    "/상태"
  ]);
  if (explicitStatusCommands.has(normalized)) {
    return true;
  }
  if (normalized.startsWith("status ") || normalized.startsWith("/status ")) {
    return true;
  }
  if (normalized.startsWith("progress ") || normalized.startsWith("/progress ")) {
    return true;
  }
  if (normalized.startsWith("state ") || normalized.startsWith("/state ")) {
    return true;
  }
  if (normalized.startsWith("상태 ")) {
    return true;
  }
  return false;
}

function splitWorkItems(request: string): string[] {
  const tokens = request
    .split(/\n|,|\.| 그리고 | and | then /gi)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (tokens.length === 0) {
    return ["Handle the requested work"];
  }
  return tokens.slice(0, 5);
}

function inferRoleFromText(text: string): AgentProfile["role"] {
  const normalized = text.toLowerCase();
  if (normalized.includes("test") || normalized.includes("qa") || normalized.includes("검증")) {
    return "tester";
  }
  if (normalized.includes("review") || normalized.includes("검토")) {
    return "reviewer";
  }
  if (normalized.includes("docs") || normalized.includes("문서")) {
    return "writer";
  }
  if (normalized.includes("research") || normalized.includes("조사")) {
    return "researcher";
  }
  return "coder";
}

function pickAgentForRole(agents: AgentProfile[], role: AgentProfile["role"]): AgentProfile | undefined {
  return agents.find((agent) => agent.role === role);
}

function pickFallbackAgent(agents: AgentProfile[]): AgentProfile | undefined {
  return (
    agents.find((agent) => agent.isOrchestrator) ??
    agents.find((agent) => agent.role === "coder") ??
    agents[0]
  );
}

function inferBackendFromText(text: string, fallback: NonAutoBackendId): NonAutoBackendId {
  const normalized = text.toLowerCase();
  if (normalized.includes("research") || normalized.includes("조사")) {
    return "gemini";
  }
  if (normalized.includes("review") || normalized.includes("리뷰")) {
    return "codex";
  }
  if (normalized.includes("docs") || normalized.includes("문서")) {
    return "gemini";
  }

  const inferred = normalizeBackendId(fallback);
  if (inferred === "claude" || inferred === "codex" || inferred === "gemini") {
    return inferred;
  }
  return "claude";
}

function resolveModelHint(backendId: NonAutoBackendId): string | undefined {
  if (backendId === "claude") {
    return "claude-sonnet-4-6";
  }
  if (backendId === "codex") {
    return "gpt-5.3-codex";
  }
  if (backendId === "gemini") {
    return "gemini-3-flash-preview";
  }
  return undefined;
}

function estimateDuration(itemCount: number): string {
  if (itemCount <= 1) {
    return "~15m";
  }
  if (itemCount <= 3) {
    return "~30m";
  }
  return "~60m";
}

function estimateCost(itemCount: number): number {
  return Number((0.6 * Math.max(1, itemCount)).toFixed(2));
}

export function createChatMessage(
  role: ChatMessage["role"],
  content: ChatMessage["content"],
  metadata?: ChatMessage["metadata"]
): ChatMessage {
  return {
    id: `chat:${randomBytes(8).toString("hex")}`,
    role,
    content,
    timestamp: Date.now(),
    metadata
  };
}
