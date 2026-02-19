import { isAbsolute, relative, resolve } from "node:path";
import type {
  DiscoverySnapshot,
  HandoffEnvelope,
  InteractionEdgeData,
  StudioEdge
} from "../types";

export type InteractionValidationIssue = {
  edgeId: string;
  code: string;
  message: string;
};

export function validateFlowInteractions(input: {
  edges: DiscoverySnapshot["edges"];
}): InteractionValidationIssue[] {
  const issues: InteractionValidationIssue[] = [];

  for (const edge of input.edges) {
    if (edge.type !== "interaction") {
      continue;
    }
    const data = asInteractionEdgeData(edge.data);
    if (!data) {
      issues.push({
        edgeId: edge.id,
        code: "interaction_data_missing",
        message: "Interaction edge requires structured data."
      });
      continue;
    }

    if (!data.patternId?.trim()) {
      issues.push({
        edgeId: edge.id,
        code: "pattern_id_required",
        message: "patternId is required."
      });
    }

    validateTermination(edge, data, issues);
    validateObservability(edge, data, issues);
    validateTopologyRules(edge, data, issues);
  }

  return issues;
}

export function assertFlowInteractionsValid(input: {
  edges: DiscoverySnapshot["edges"];
}): void {
  const issues = validateFlowInteractions(input);
  if (issues.length === 0) {
    return;
  }
  const detail = issues
    .slice(0, 6)
    .map((issue) => `- [${issue.edgeId}] ${issue.message}`)
    .join("\n");
  throw new Error(`Interaction validation failed:\n${detail}`);
}

export function assertRuntimeInteractionContract(input: {
  nodes: DiscoverySnapshot["nodes"];
  edges: DiscoverySnapshot["edges"];
}): void {
  assertFlowInteractionsValid({ edges: input.edges });

  const nodeIds = new Set(input.nodes.map((node) => node.id));
  const issues: string[] = [];
  for (const edge of input.edges) {
    if (edge.type !== "interaction") {
      continue;
    }
    if (!nodeIds.has(edge.source)) {
      issues.push(`[${edge.id}] source node is missing: ${edge.source}`);
    }
    if (!nodeIds.has(edge.target)) {
      issues.push(`[${edge.id}] target node is missing: ${edge.target}`);
    }
    if (edge.source === edge.target) {
      issues.push(`[${edge.id}] self-loop interaction is not allowed`);
    }
  }

  if (issues.length > 0) {
    throw new Error(`Runtime interaction contract failed:\n${issues.slice(0, 8).join("\n")}`);
  }
}

export function buildTaskTimeoutIndex(input: {
  edges: DiscoverySnapshot["edges"];
  defaultTimeoutMs: number;
  minTimeoutMs?: number;
  maxTimeoutMs?: number;
}): Map<string, number> {
  const minTimeoutMs = input.minTimeoutMs ?? 5_000;
  const maxTimeoutMs = input.maxTimeoutMs ?? 10 * 60_000;
  const timeoutBySourceNodeId = new Map<string, number>();

  for (const edge of input.edges) {
    if (edge.type !== "interaction") {
      continue;
    }
    const data = asInteractionEdgeData(edge.data);
    if (!data || data.termination.type !== "timeout_ms") {
      continue;
    }
    const rawTimeout = Number(data.termination.ms);
    if (!Number.isFinite(rawTimeout) || rawTimeout <= 0) {
      continue;
    }
    const timeout = Math.max(minTimeoutMs, Math.min(maxTimeoutMs, Math.round(rawTimeout)));
    const current = timeoutBySourceNodeId.get(edge.source);
    if (current === undefined || timeout < current) {
      timeoutBySourceNodeId.set(edge.source, timeout);
    }
  }

  if (timeoutBySourceNodeId.size === 0) {
    return timeoutBySourceNodeId;
  }

  // Keep all runtime timeouts within default execution timeout as an upper bound.
  for (const [source, timeout] of timeoutBySourceNodeId.entries()) {
    timeoutBySourceNodeId.set(source, Math.min(timeout, input.defaultTimeoutMs));
  }
  return timeoutBySourceNodeId;
}

export function assertDirectedCommunicationAllowed(input: {
  edges: DiscoverySnapshot["edges"];
  fromAgentId: string;
  toAgentId: string;
}): void {
  const from = input.fromAgentId.trim();
  const to = input.toAgentId.trim();
  if (!from || !to) {
    throw new Error("Communication requires both fromAgentId and toAgentId.");
  }
  if (from === to) {
    return;
  }

  const allowed = input.edges.some((edge) => {
    if (edge.source !== from || edge.target !== to) {
      return false;
    }
    return edge.type === "delegates" || edge.type === "agentLink" || edge.type === "interaction";
  });

  if (!allowed) {
    throw new Error(`Communication direction is not allowed: ${from} -> ${to}`);
  }
}

export function assertValidHandoffEnvelope(input: {
  handoff: HandoffEnvelope;
  maxFieldLength?: number;
  maxItemsPerField?: number;
}): void {
  const maxFieldLength = input.maxFieldLength ?? 300;
  const maxItemsPerField = input.maxItemsPerField ?? 20;
  const handoff = input.handoff;
  const normalized = normalizeHandoffFields(handoff);
  const intent = String(handoff.intent ?? "").trim();
  if (!intent) {
    throw new Error("Handoff intent is required.");
  }
  if (intent.length > maxFieldLength) {
    throw new Error(`Handoff intent is too long (>${maxFieldLength}).`);
  }

  const fields: Array<[string, string[] | undefined]> = [
    ["inputs", handoff.inputs],
    ["plan", handoff.plan],
    ["constraints", handoff.constraints],
    ["deliverables", handoff.deliverables]
  ];
  let nonEmptyFieldCount = 0;
  for (const [name, values] of fields) {
    if (!values) {
      continue;
    }
    if (!Array.isArray(values)) {
      throw new Error(`Handoff ${name} must be an array of strings.`);
    }
    if (values.length > maxItemsPerField) {
      throw new Error(`Handoff ${name} has too many items (>${maxItemsPerField}).`);
    }
    let hasNonEmpty = false;
    for (const value of values) {
      const normalized = String(value ?? "").trim();
      if (!normalized) {
        continue;
      }
      hasNonEmpty = true;
      if (normalized.length > maxFieldLength) {
        throw new Error(`Handoff ${name} item is too long (>${maxFieldLength}).`);
      }
    }
    if (hasNonEmpty) {
      nonEmptyFieldCount += 1;
    }
  }

  if (nonEmptyFieldCount === 0) {
    throw new Error("Handoff requires at least one non-empty section (inputs, plan, constraints, or deliverables).");
  }

  if (!normalized.sandboxWorkDir) {
    throw new Error("Handoff sandboxWorkDir is required.");
  }
  if (!normalized.proposalJson) {
    throw new Error("Handoff proposalJson is required.");
  }
  if (normalized.changedFiles.length === 0) {
    throw new Error("Handoff changedFiles requires at least one file.");
  }

  for (const [fieldName, value] of [
    ["sandboxWorkDir", normalized.sandboxWorkDir],
    ["proposalJson", normalized.proposalJson]
  ] as const) {
    if (value.length > maxFieldLength * 2) {
      throw new Error(`Handoff ${fieldName} is too long.`);
    }
  }

  if (normalized.changedFiles.length > maxItemsPerField * 4) {
    throw new Error(`Handoff changedFiles has too many items (>${maxItemsPerField * 4}).`);
  }

  for (const changedFile of normalized.changedFiles) {
    if (changedFile.length > maxFieldLength * 2) {
      throw new Error("Handoff changedFiles item is too long.");
    }
  }
}

export function assertHandoffPathsWithinScope(input: {
  handoff: HandoffEnvelope;
  workspaceRoot: string;
  sandboxRootDir: string;
}): void {
  const normalized = normalizeHandoffFields(input.handoff);
  const workspaceRoot = resolve(input.workspaceRoot);
  const sandboxRootDir = resolve(input.sandboxRootDir);
  const sandboxWorkDir = resolvePathCandidate(normalized.sandboxWorkDir, workspaceRoot);
  const proposalJson = resolvePathCandidate(normalized.proposalJson, workspaceRoot);

  if (!isPathWithin(sandboxRootDir, sandboxWorkDir)) {
    throw new Error("Handoff sandboxWorkDir must be inside the assigned sandbox root.");
  }

  if (!isPathWithin(sandboxWorkDir, proposalJson)) {
    throw new Error("Handoff proposalJson must be inside sandboxWorkDir.");
  }

  if (!proposalJson.toLowerCase().endsWith(".json")) {
    throw new Error("Handoff proposalJson must point to a JSON file.");
  }

  for (const changedFile of normalized.changedFiles) {
    const candidate = resolvePathCandidate(changedFile, workspaceRoot);
    if (!isPathWithin(workspaceRoot, candidate)) {
      throw new Error(`Handoff changedFiles path escapes workspace: ${changedFile}`);
    }
  }
}

function validateTermination(
  edge: StudioEdge,
  data: InteractionEdgeData,
  issues: InteractionValidationIssue[]
): void {
  const termination = data.termination;
  if (!termination || typeof termination.type !== "string") {
    issues.push({
      edgeId: edge.id,
      code: "termination_required",
      message: "termination is required."
    });
    return;
  }

  if (termination.type === "max_rounds") {
    if (!isPositiveNumber(termination.rounds)) {
      issues.push({
        edgeId: edge.id,
        code: "max_rounds_invalid",
        message: "max_rounds termination requires rounds > 0."
      });
    }
  }

  if (termination.type === "timeout_ms") {
    if (!isPositiveNumber(termination.ms)) {
      issues.push({
        edgeId: edge.id,
        code: "timeout_invalid",
        message: "timeout_ms termination requires ms > 0."
      });
    }
  }

  if (termination.type === "consensus_threshold") {
    const threshold = Number(termination.threshold);
    if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
      issues.push({
        edgeId: edge.id,
        code: "consensus_threshold_invalid",
        message: "consensus_threshold must be within (0, 1]."
      });
    }
  }

  if (termination.type === "quality_gate") {
    if (!termination.metric?.trim()) {
      issues.push({
        edgeId: edge.id,
        code: "quality_gate_metric_required",
        message: "quality_gate requires metric."
      });
    }
    if (termination.op !== ">=" && termination.op !== "<=") {
      issues.push({
        edgeId: edge.id,
        code: "quality_gate_op_invalid",
        message: "quality_gate op must be '>=' or '<='."
      });
    }
    if (!Number.isFinite(Number(termination.value))) {
      issues.push({
        edgeId: edge.id,
        code: "quality_gate_value_invalid",
        message: "quality_gate requires numeric value."
      });
    }
  }
}

function validateObservability(
  edge: StudioEdge,
  data: InteractionEdgeData,
  issues: InteractionValidationIssue[]
): void {
  const observability = data.observability;
  if (!observability || typeof observability !== "object") {
    issues.push({
      edgeId: edge.id,
      code: "observability_required",
      message: "observability configuration is required."
    });
    return;
  }

  if (typeof observability.logs !== "boolean" || typeof observability.traces !== "boolean") {
    issues.push({
      edgeId: edge.id,
      code: "observability_flags_invalid",
      message: "observability.logs and observability.traces must be boolean."
    });
  }
}

function validateTopologyRules(
  edge: StudioEdge,
  data: InteractionEdgeData,
  issues: InteractionValidationIssue[]
): void {
  if (data.topology === "debate_judge") {
    const hasTimeoutTermination = data.termination.type === "timeout_ms";
    const hasTimeoutParam = isPositiveNumber((data.params as Record<string, unknown>).debate_timeout_ms);
    if (!hasTimeoutTermination && !hasTimeoutParam) {
      issues.push({
        edgeId: edge.id,
        code: "debate_timeout_required",
        message: "debate_judge requires timeout_ms termination or params.debate_timeout_ms."
      });
    }
  }

  if (data.topology === "blackboard") {
    if (!isPositiveNumber(data.observability.retain_days)) {
      issues.push({
        edgeId: edge.id,
        code: "blackboard_retention_required",
        message: "blackboard topology requires observability.retain_days > 0."
      });
    }
  }

  if (data.topology === "broker") {
    const rateLimit = Number((data.params as Record<string, unknown>).rate_limit_per_min);
    if (!Number.isFinite(rateLimit) || rateLimit <= 0) {
      issues.push({
        edgeId: edge.id,
        code: "broker_rate_limit_required",
        message: "broker topology requires params.rate_limit_per_min > 0."
      });
    }
  }
}

function asInteractionEdgeData(value: unknown): InteractionEdgeData | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const candidate = value as Partial<InteractionEdgeData>;
  if (!candidate.termination || !candidate.topology || !candidate.messageForm || !candidate.sync) {
    return undefined;
  }
  return {
    patternId: String(candidate.patternId ?? ""),
    topology: candidate.topology,
    messageForm: candidate.messageForm,
    sync: candidate.sync,
    termination: candidate.termination,
    params: isRecord(candidate.params) ? candidate.params : {},
    observability: isRecord(candidate.observability)
      ? {
          logs: Boolean((candidate.observability as Record<string, unknown>).logs),
          traces: Boolean((candidate.observability as Record<string, unknown>).traces),
          retain_days: Number((candidate.observability as Record<string, unknown>).retain_days) || undefined
        }
      : {
          logs: false,
          traces: false
        }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeHandoffFields(handoff: HandoffEnvelope): {
  sandboxWorkDir: string;
  proposalJson: string;
  changedFiles: string[];
} {
  const sandboxWorkDir = pickStringField(handoff.sandboxWorkDir, handoff.SandboxWorkDir);
  const proposalJson = pickStringField(handoff.proposalJson, handoff.ProposalJson);
  const changedFiles = pickArrayField(handoff.changedFiles, handoff.ChangedFiles);
  return {
    sandboxWorkDir,
    proposalJson,
    changedFiles
  };
}

function pickStringField(primary: string | undefined, legacy: string | undefined): string {
  return String(primary ?? legacy ?? "").trim();
}

function pickArrayField(primary: string[] | undefined, legacy: string[] | undefined): string[] {
  const source = Array.isArray(primary) && primary.length > 0 ? primary : legacy;
  if (!Array.isArray(source)) {
    return [];
  }
  return source
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
}

function resolvePathCandidate(value: string, workspaceRoot: string): string {
  const candidate = value.trim();
  if (!candidate) {
    return workspaceRoot;
  }
  if (isAbsolute(candidate)) {
    return resolve(candidate);
  }
  return resolve(workspaceRoot, candidate);
}

function isPathWithin(rootPath: string, candidatePath: string): boolean {
  const rel = relative(rootPath, candidatePath);
  if (!rel) {
    return true;
  }
  return !rel.startsWith("..") && !isAbsolute(rel);
}

function isPositiveNumber(value: unknown): boolean {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}
