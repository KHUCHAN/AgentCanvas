import { appendFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import type { DiscoverySnapshot } from "../types";
import { assertFlowInteractionsValid } from "./interactionValidation";

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

  assertFlowInteractionsValid({ edges: input.edges });

  const payload: FlowDocument = {
    version: "0.3",
    flowName: safeName,
    generatedAt: new Date().toISOString(),
    agents: collectFlowAgents(input.nodes),
    interactions: collectFlowInteractions(input.edges),
    commonRules: collectFlowCommonRules(input.nodes),
    layout: {
      nodes: input.nodes,
      edges: input.edges
    }
  };

  await writeFile(filePath, stringify(payload), "utf8");
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

  let parsed: unknown;
  try {
    parsed = parse(raw);
  } catch {
    throw new Error(`Flow "${safeName}" is corrupted. The file contains invalid data.`);
  }

  const normalized = normalizeFlowDocument(parsed);

  if (!Array.isArray(normalized.nodes) || !Array.isArray(normalized.edges)) {
    throw new Error(`Flow "${safeName}" has an invalid structure. Expected nodes and edges arrays.`);
  }

  assertFlowInteractionsValid({ edges: normalized.edges });

  return {
    flowName: safeName,
    nodes: normalized.nodes,
    edges: normalized.edges
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

type FlowDocument = {
  version: "0.3";
  flowName: string;
  generatedAt: string;
  agents: Array<{
    id: string;
    type: "agent" | "system";
    name: string;
    role?: string;
    isOrchestrator?: boolean;
    providerId?: string;
  }>;
  interactions: Array<{
    id: string;
    source: string;
    target: string;
    type: string;
    label?: string;
    data?: Record<string, unknown>;
  }>;
  commonRules: Array<{ id: string; path?: string; scope?: string }>;
  layout: {
    nodes: DiscoverySnapshot["nodes"];
    edges: DiscoverySnapshot["edges"];
  };
};

function collectFlowAgents(nodes: DiscoverySnapshot["nodes"]): FlowDocument["agents"] {
  return nodes
    .filter(
      (
        node
      ): node is DiscoverySnapshot["nodes"][number] & { type: "agent" | "system" } =>
        node.type === "agent" || node.type === "system"
    )
    .map((node) => {
      const data = (node.data ?? {}) as Record<string, unknown>;
      return {
        id: node.id,
        type: node.type,
        name: String(data.name ?? data.title ?? node.id),
        role: typeof data.role === "string" ? data.role : undefined,
        isOrchestrator: typeof data.isOrchestrator === "boolean" ? data.isOrchestrator : undefined,
        providerId: typeof data.providerId === "string" ? data.providerId : undefined
      };
    });
}

function collectFlowInteractions(edges: DiscoverySnapshot["edges"]): FlowDocument["interactions"] {
  return edges
    .filter((edge) => edge.type === "interaction")
    .map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      label: edge.label,
      data: isRecord(edge.data) ? edge.data : undefined
    }));
}

function collectFlowCommonRules(nodes: DiscoverySnapshot["nodes"]): FlowDocument["commonRules"] {
  const result: FlowDocument["commonRules"] = [];
  for (const node of nodes) {
    if (node.type !== "commonRules" && node.type !== "ruleDoc") {
      continue;
    }
    const data = (node.data ?? {}) as Record<string, unknown>;
    const path = typeof data.path === "string" ? data.path : undefined;
    const scope = typeof data.scope === "string" ? data.scope : undefined;
    result.push({
      id: node.id,
      path,
      scope
    });
  }
  return result;
}

function normalizeFlowDocument(parsed: unknown): {
  nodes: DiscoverySnapshot["nodes"];
  edges: DiscoverySnapshot["edges"];
} {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { nodes: [], edges: [] };
  }
  const value = parsed as Record<string, unknown>;
  const layout = isRecord(value.layout) ? value.layout : undefined;
  const nodes = (layout?.nodes ?? value.nodes) as unknown;
  const edges = (layout?.edges ?? value.edges) as unknown;
  return {
    nodes: Array.isArray(nodes) ? (nodes as DiscoverySnapshot["nodes"]) : [],
    edges: Array.isArray(edges) ? (edges as DiscoverySnapshot["edges"]) : []
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
