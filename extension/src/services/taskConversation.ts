import type { RunEvent, TaskConversationRole, TaskConversationTurn } from "../types";

export function extractTaskConversationTurns(
  events: RunEvent[],
  runId: string,
  taskId: string
): TaskConversationTurn[] {
  const turns: TaskConversationTurn[] = [];
  for (const event of events) {
    if (event.type !== "run_log" || event.message !== "task_conversation_turn") {
      continue;
    }
    const meta = event.meta;
    if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
      continue;
    }
    const metaTaskId = typeof meta.taskId === "string" ? meta.taskId : undefined;
    if (metaTaskId !== taskId) {
      continue;
    }
    const role = parseTaskConversationRole(meta.role);
    if (!role) {
      continue;
    }
    const content = typeof meta.content === "string" ? meta.content : "";
    if (!content.trim()) {
      continue;
    }
    turns.push({
      turnId: `${runId}:${taskId}:${String(event.ts)}:${String(turns.length + 1)}`,
      runId,
      taskId,
      role,
      content,
      timestamp: event.ts,
      agentId: typeof meta.agentId === "string" ? meta.agentId : undefined,
      backendId: typeof meta.backendId === "string" ? meta.backendId : undefined,
      model: typeof meta.model === "string" ? meta.model : undefined
    });
  }
  turns.sort((left, right) => left.timestamp - right.timestamp);
  return turns;
}

function parseTaskConversationRole(value: unknown): TaskConversationRole | undefined {
  const roleRaw = typeof value === "string" ? value.toLowerCase() : "";
  if (roleRaw === "orchestrator") {
    return "orchestrator";
  }
  if (roleRaw === "agent") {
    return "agent";
  }
  return undefined;
}
