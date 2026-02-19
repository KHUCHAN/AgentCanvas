import { appendFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { DiscoverySnapshot } from "../types";

export function sanitizeFlowName(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "default";
}

export function getFlowsDirectory(workspaceRoot: string): string {
  return join(workspaceRoot, ".agentcanvas", "flows");
}

export async function listFlows(workspaceRoot: string): Promise<string[]> {
  const dir = getFlowsDirectory(workspaceRoot);
  try {
    const entries = await readdir(dir);
    return entries
      .filter((entry) => entry.endsWith(".yaml"))
      .map((entry) => entry.replace(/\.yaml$/, ""))
      .sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

export async function saveFlow(input: {
  workspaceRoot: string;
  flowName: string;
  nodes: DiscoverySnapshot["nodes"];
  edges: DiscoverySnapshot["edges"];
}): Promise<string> {
  const safeName = sanitizeFlowName(input.flowName);
  const dir = getFlowsDirectory(input.workspaceRoot);
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, `${safeName}.yaml`);

  const payload = {
    version: "0.2",
    flowName: safeName,
    generatedAt: new Date().toISOString(),
    nodes: input.nodes,
    edges: input.edges
  };

  // JSON is valid YAML 1.2.
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return filePath;
}

export async function loadFlow(input: {
  workspaceRoot: string;
  flowName: string;
}): Promise<{ flowName: string; nodes: DiscoverySnapshot["nodes"]; edges: DiscoverySnapshot["edges"] }> {
  const safeName = sanitizeFlowName(input.flowName);
  const filePath = join(getFlowsDirectory(input.workspaceRoot), `${safeName}.yaml`);

  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch {
    throw new Error(`Flow "${safeName}" not found. Create it first by saving a flow.`);
  }

  let parsed: { nodes?: DiscoverySnapshot["nodes"]; edges?: DiscoverySnapshot["edges"] };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    throw new Error(`Flow "${safeName}" is corrupted. The file contains invalid data.`);
  }

  if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
    throw new Error(`Flow "${safeName}" has an invalid structure. Expected nodes and edges arrays.`);
  }

  return {
    flowName: safeName,
    nodes: parsed.nodes,
    edges: parsed.edges
  };
}

export async function logInteractionEvent(input: {
  workspaceRoot: string;
  flowName: string;
  interactionId: string;
  edgeId: string;
  event: string;
  data?: Record<string, unknown>;
}): Promise<string> {
  const safeFlow = sanitizeFlowName(input.flowName || "default");
  const date = new Date().toISOString().slice(0, 10);
  const dir = join(input.workspaceRoot, ".agentcanvas", "logs", safeFlow);
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, `${date}.jsonl`);
  const row = {
    ts: Date.now(),
    flow: safeFlow,
    interactionId: input.interactionId,
    edgeId: input.edgeId,
    event: input.event,
    data: input.data ?? {}
  };
  await appendFile(filePath, `${JSON.stringify(row)}\n`, "utf8");
  return filePath;
}
