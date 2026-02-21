import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { EventProvenance } from "../types";
import { sanitizeFlowName } from "./flowStore";

export type CollabEventType =
  | "task_dispatched"
  | "proposal_submitted"
  | "proposal_reviewed"
  | "announce"
  | "human_query_requested"
  | "human_query_answered"
  | "task_resumed_after_human_query";

export type CollaborationEvent = {
  ts: number;
  runId: string;
  flowName: string;
  event: CollabEventType;
  actor: string;
  provenance: EventProvenance;
  payload: unknown;
};

function collabFilePath(workspaceRoot: string, flowName: string, runId: string): string {
  return join(workspaceRoot, ".agentcanvas", "runs", sanitizeFlowName(flowName), `${runId}-collab.jsonl`);
}

export async function appendCollabEvent(input: {
  workspaceRoot: string;
  flowName: string;
  runId: string;
  event: CollabEventType;
  actor: string;
  provenance: EventProvenance;
  payload: unknown;
}): Promise<string> {
  const flowName = sanitizeFlowName(input.flowName);
  const path = collabFilePath(input.workspaceRoot, flowName, input.runId);
  await mkdir(join(input.workspaceRoot, ".agentcanvas", "runs", flowName), { recursive: true });
  const row: CollaborationEvent = {
    ts: Date.now(),
    runId: input.runId,
    flowName,
    event: input.event,
    actor: input.actor,
    provenance: input.provenance,
    payload: input.payload
  };
  await appendFile(path, `${JSON.stringify(row)}\n`, "utf8");
  return path;
}

export async function readCollabEvents(input: {
  workspaceRoot: string;
  flowName: string;
  runId: string;
}): Promise<CollaborationEvent[]> {
  const path = collabFilePath(input.workspaceRoot, input.flowName, input.runId);
  let raw = "";
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return [];
  }
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as CollaborationEvent;
      } catch {
        return undefined;
      }
    })
    .filter((value): value is CollaborationEvent => Boolean(value))
    .sort((left, right) => left.ts - right.ts);
}

export async function generateCollabReport(input: {
  workspaceRoot: string;
  flowName: string;
  runId: string;
}): Promise<string> {
  const events = await readCollabEvents(input);
  const lines: string[] = [
    `# Run Report: ${sanitizeFlowName(input.flowName)} / ${input.runId}`,
    "",
    "## Timeline",
    "",
    "| Time | Event | Actor | Details |",
    "|------|-------|-------|---------|"
  ];

  for (const event of events) {
    const detail = summarizePayload(event.payload).replace(/\|/g, "\\|");
    lines.push(
      `| ${new Date(event.ts).toLocaleTimeString()} | ${event.event} | ${event.actor} | ${detail} |`
    );
  }

  const proposalEvents = events.filter((event) => event.event === "proposal_submitted");
  if (proposalEvents.length > 0) {
    lines.push("", "## Proposals", "");
    for (const event of proposalEvents) {
      lines.push(`### ${event.actor}`);
      lines.push(`- ${summarizePayload(event.payload)}`);
    }
  }

  lines.push("", "## Final Changes", "");
  const applied = events.filter((event) => event.event === "proposal_reviewed")
    .filter((event) => String((event.payload as { decision?: string } | undefined)?.decision ?? "").toLowerCase() === "apply");
  lines.push(`- Reviewed proposals: ${events.filter((event) => event.event === "proposal_reviewed").length}`);
  lines.push(`- Applied: ${applied.length}`);

  return `${lines.join("\n")}\n`;
}

function summarizePayload(value: unknown): string {
  if (!value || typeof value !== "object") {
    return String(value ?? "");
  }
  const data = value as Record<string, unknown>;
  if (typeof data.summary === "string" && data.summary.trim()) {
    return data.summary.trim();
  }
  if (typeof data.title === "string" && data.title.trim()) {
    return data.title.trim();
  }
  if (Array.isArray(data.changedFiles)) {
    return `${data.changedFiles.length} file(s) changed`;
  }
  return summarizeObject(value);
}

function summarizeObject(value: unknown): string {
  if (!value || typeof value !== "object") {
    return String(value ?? "");
  }
  if (Array.isArray(value)) {
    return `array(${value.length})`;
  }
  const data = value as Record<string, unknown>;
  const keys = Object.keys(data);
  if (keys.length === 0) {
    return "{}";
  }
  const preview = keys
    .slice(0, 6)
    .map((key) => `${key}=${summarizeScalar(data[key])}`)
    .join(", ");
  return keys.length > 6 ? `${preview}, ...` : preview;
}

function summarizeScalar(value: unknown): string {
  if (value === null || value === undefined) {
    return String(value);
  }
  if (typeof value === "string") {
    return value.length > 40 ? `${value.slice(0, 37)}...` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `array(${value.length})`;
  }
  if (typeof value === "object") {
    return "object";
  }
  return String(value);
}
