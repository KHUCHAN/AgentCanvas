import { appendFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CliBackendId, RunEvent, RunStatus, RunSummary } from "../types";
import { sanitizeFlowName } from "./flowStore";

function runsDir(workspaceRoot: string, flowName: string): string {
  return join(workspaceRoot, ".agentcanvas", "runs", sanitizeFlowName(flowName));
}

function runFilePath(workspaceRoot: string, flowName: string, runId: string): string {
  return join(runsDir(workspaceRoot, flowName), `${runId}.jsonl`);
}

function indexFilePath(workspaceRoot: string, flowName: string): string {
  return join(runsDir(workspaceRoot, flowName), "index.json");
}

export function createRunId(prefix = "run"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function startRun(input: {
  workspaceRoot: string;
  flowName: string;
  runId?: string;
  backendId?: CliBackendId;
  runName?: string;
  tags?: string[];
}): Promise<RunSummary> {
  const flow = sanitizeFlowName(input.flowName || "default");
  const runId = input.runId ?? createRunId();
  const summary: RunSummary = {
    runId,
    flow,
    startedAt: Date.now(),
    status: "running",
    backendId: input.backendId,
    runName: input.runName?.trim() || undefined,
    tags: input.tags?.filter((tag) => tag.trim().length > 0)
  };

  await mkdir(runsDir(input.workspaceRoot, flow), { recursive: true });
  await upsertRunIndex(input.workspaceRoot, flow, summary);
  await appendRunEvent({
    workspaceRoot: input.workspaceRoot,
    flowName: flow,
    event: {
      ts: Date.now(),
      flow,
      runId,
      type: "run_started",
      status: "running",
      meta: {
        backendId: summary.backendId,
        runName: summary.runName
      }
    }
  });

  return summary;
}

export async function appendRunEvent(input: {
  workspaceRoot: string;
  flowName: string;
  event: RunEvent;
}): Promise<string> {
  const flow = sanitizeFlowName(input.flowName || "default");
  const filePath = runFilePath(input.workspaceRoot, flow, input.event.runId);
  const event: RunEvent = {
    ...input.event,
    flow,
    ts: input.event.ts || Date.now()
  };
  const line = `${JSON.stringify(event)}\n`;
  try {
    await appendFile(filePath, line, "utf8");
  } catch (error) {
    if (!isFsErrorCode(error, "ENOENT")) {
      throw error;
    }
    await mkdir(runsDir(input.workspaceRoot, flow), { recursive: true });
    await appendFile(filePath, line, "utf8");
  }
  return filePath;
}

export async function finishRun(input: {
  workspaceRoot: string;
  flowName: string;
  runId: string;
  status: RunStatus;
  message?: string;
}): Promise<void> {
  const flow = sanitizeFlowName(input.flowName || "default");
  const summaries = await readRunIndex(input.workspaceRoot, flow);
  const target = summaries.find((summary) => summary.runId === input.runId);
  if (target) {
    target.status = input.status;
    target.finishedAt = Date.now();
    await writeRunIndex(input.workspaceRoot, flow, summaries);
  }

  await appendRunEvent({
    workspaceRoot: input.workspaceRoot,
    flowName: flow,
    event: {
      ts: Date.now(),
      flow,
      runId: input.runId,
      type: "run_finished",
      status: input.status,
      message: input.message
    }
  });
}

export async function listRuns(input: {
  workspaceRoot: string;
  flowName?: string;
  limit?: number;
}): Promise<RunSummary[]> {
  const limit = input.limit ?? 50;
  if (input.flowName) {
    const flow = sanitizeFlowName(input.flowName);
    const runs = await readRunIndex(input.workspaceRoot, flow);
    return runs
      .sort((left, right) => right.startedAt - left.startedAt)
      .slice(0, limit);
  }

  const root = join(input.workspaceRoot, ".agentcanvas", "runs");
  let flowEntries: string[] = [];
  try {
    flowEntries = await readdir(root);
  } catch {
    return [];
  }

  const runLists = await Promise.all(flowEntries.map((flow) => readRunIndex(input.workspaceRoot, flow)));
  const all = runLists.flat();

  return all.sort((left, right) => right.startedAt - left.startedAt).slice(0, limit);
}

export async function loadRunEvents(input: {
  workspaceRoot: string;
  flowName: string;
  runId: string;
  limit?: number;
}): Promise<RunEvent[]> {
  const flow = sanitizeFlowName(input.flowName);
  const path = runFilePath(input.workspaceRoot, flow, input.runId);
  let raw = "";
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return [];
  }

  const rows = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const events: RunEvent[] = [];
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row) as RunEvent;
      events.push(parsed);
    } catch {
      continue;
    }
  }

  const limit = input.limit ?? events.length;
  return events.slice(-limit);
}

async function upsertRunIndex(
  workspaceRoot: string,
  flowName: string,
  summary: RunSummary
): Promise<void> {
  const list = await readRunIndex(workspaceRoot, flowName);
  const index = list.findIndex((item) => item.runId === summary.runId);
  if (index >= 0) {
    list[index] = summary;
  } else {
    list.push(summary);
  }
  await writeRunIndex(workspaceRoot, flowName, list);
}

async function readRunIndex(workspaceRoot: string, flowName: string): Promise<RunSummary[]> {
  const indexPath = indexFilePath(workspaceRoot, flowName);
  try {
    const raw = await readFile(indexPath, "utf8");
    const parsed = JSON.parse(raw) as RunSummary[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item) => item && typeof item.runId === "string");
  } catch {
    return [];
  }
}

async function writeRunIndex(
  workspaceRoot: string,
  flowName: string,
  summaries: RunSummary[]
): Promise<void> {
  const dir = runsDir(workspaceRoot, flowName);
  await mkdir(dir, { recursive: true });
  const path = indexFilePath(workspaceRoot, flowName);
  await writeFile(path, `${JSON.stringify(summaries, null, 2)}\n`, "utf8");
}

function isFsErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string" &&
    (error as { code: string }).code === code
  );
}
