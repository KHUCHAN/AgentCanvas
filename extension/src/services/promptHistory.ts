import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { GeneratedAgentStructure, PromptHistoryEntry } from "../types";

const HISTORY_PATH = join(".agentcanvas", "prompt-history.json");
const MAX_HISTORY_ITEMS = 100;

function resolvePath(workspaceRoot: string): string {
  return join(workspaceRoot, HISTORY_PATH);
}

export async function readPromptHistory(workspaceRoot: string): Promise<PromptHistoryEntry[]> {
  const filePath = resolvePath(workspaceRoot);
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter(isPromptHistoryEntry)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  } catch {
    return [];
  }
}

export async function appendPromptHistory(input: {
  workspaceRoot: string;
  prompt: string;
  backendId: string;
  result: GeneratedAgentStructure;
  applied?: boolean;
}): Promise<PromptHistoryEntry> {
  const item: PromptHistoryEntry = {
    id: `ph_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    prompt: input.prompt,
    backendId: input.backendId,
    createdAt: new Date().toISOString(),
    applied: Boolean(input.applied),
    result: input.result
  };

  const history = await readPromptHistory(input.workspaceRoot);
  history.unshift(item);
  await writePromptHistory(input.workspaceRoot, history.slice(0, MAX_HISTORY_ITEMS));
  return item;
}

export async function markPromptHistoryApplied(
  workspaceRoot: string,
  historyId: string,
  applied: boolean
): Promise<void> {
  const history = await readPromptHistory(workspaceRoot);
  const next = history.map((item) =>
    item.id === historyId
      ? {
        ...item,
        applied
      }
      : item
  );
  await writePromptHistory(workspaceRoot, next);
}

export async function removePromptHistory(workspaceRoot: string, historyId: string): Promise<void> {
  const history = await readPromptHistory(workspaceRoot);
  await writePromptHistory(
    workspaceRoot,
    history.filter((item) => item.id !== historyId)
  );
}

export async function findPromptHistory(
  workspaceRoot: string,
  historyId: string
): Promise<PromptHistoryEntry | undefined> {
  const history = await readPromptHistory(workspaceRoot);
  return history.find((item) => item.id === historyId);
}

async function writePromptHistory(workspaceRoot: string, items: PromptHistoryEntry[]): Promise<void> {
  const filePath = resolvePath(workspaceRoot);
  await mkdir(join(workspaceRoot, ".agentcanvas"), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

function isPromptHistoryEntry(value: unknown): value is PromptHistoryEntry {
  if (!value || typeof value !== "object") {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.prompt === "string" &&
    typeof row.backendId === "string" &&
    typeof row.createdAt === "string" &&
    typeof row.applied === "boolean" &&
    typeof row.result === "object" &&
    row.result !== null
  );
}
