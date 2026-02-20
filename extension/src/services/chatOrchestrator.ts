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

    const draftPlan = this.buildDraftPlan({
      request: message,
      agents: input.context.agents,
      backendId: input.backendId
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

  public buildDraftPlan(input: {
    request: string;
    agents: AgentProfile[];
    backendId: NonAutoBackendId;
  }): WorkPlan {
    const fragments = splitWorkItems(input.request);
    const items: WorkPlanItem[] = fragments.map((fragment, index) => {
      const inferredRole = inferRoleFromText(fragment);
      const assignedAgent = pickAgentForRole(input.agents, inferredRole) ?? pickFallbackAgent(input.agents);
      const assignedBackend = inferBackendFromText(fragment, input.backendId);
      const item: WorkPlanItem = {
        index: index + 1,
        title: fragment,
        description: `Deliverable ${index + 1} for "${fragment}"`,
        assignedAgentId: assignedAgent?.id ?? "unassigned",
        assignedAgentName: assignedAgent?.name ?? "Unassigned",
        assignedBackend,
        assignedModel: resolveModelHint(assignedBackend),
        priority: index === 0 ? "high" : "medium",
        deps: index === 0 ? [] : [index],
        taskId: undefined
      };
      return item;
    });

    return {
      id: `plan:${randomBytes(6).toString("hex")}`,
      status: "draft",
      items,
      estimatedDuration: estimateDuration(items.length),
      estimatedCost: estimateCost(items.length)
    };
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
  return (
    normalized.includes("status") ||
    normalized.includes("progress") ||
    normalized.includes("state") ||
    normalized.includes("상태") ||
    normalized.includes("진행")
  );
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
  if (inferred) {
    return inferred;
  }
  return "claude";
}

function resolveModelHint(backendId: NonAutoBackendId): string | undefined {
  if (backendId === "claude") {
    return "sonnet-4.5";
  }
  if (backendId === "codex") {
    return "o3-mini";
  }
  if (backendId === "gemini") {
    return "gemini-2.5-flash";
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
