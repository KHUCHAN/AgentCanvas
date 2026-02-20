import { z } from "zod";
import type { AgentRole, CanonicalBackendId, GeneratedAgentStructure } from "../types";
import { normalizeBackendId } from "./backendProfiles";
import { defaultWorkIntentAnalysis } from "./workIntentAnalyzer";

const ROLE_SET = [
  "orchestrator",
  "coder",
  "researcher",
  "reviewer",
  "planner",
  "tester",
  "writer",
  "custom"
] as const satisfies readonly AgentRole[];

const generatedAgentSchema = z.object({
  name: z.string().trim().min(1),
  role: z.enum(ROLE_SET),
  roleLabel: z.string().optional(),
  description: z.string().optional(),
  systemPrompt: z.string().optional(),
  isOrchestrator: z.boolean().optional(),
  delegatesTo: z.array(z.string()).optional(),
  assignedSkillIds: z.array(z.string()).optional(),
  assignedMcpServerIds: z.array(z.string()).optional(),
  assignedBackend: z.string().optional(),
  assignedModel: z.string().optional(),
  backendAssignReason: z.string().optional(),
  color: z.string().optional(),
  avatar: z.string().optional()
});

const structureSchema = z.object({
  teamName: z.string().optional(),
  teamDescription: z.string().optional(),
  agents: z.array(generatedAgentSchema).min(1),
  suggestedNewSkills: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        forAgent: z.string().optional()
      })
    )
    .optional(),
  suggestedNewMcpServers: z
    .array(
      z.object({
        name: z.string(),
        kind: z.enum(["stdio", "http"]).optional(),
        forAgent: z.string().optional()
      })
    )
    .optional(),
  workIntent: z.unknown().optional(),
  backendUsageAtBuild: z.array(z.unknown()).optional()
});

const ENGLISH_TASK_VERB_PREFIX =
  /^(build|create|implement|fix|write|add|develop|make|update|refactor|test|deploy|review|analyze|investigate|debug|improve|optimize|setup|configure|migrate|design|document|code)\b/i;
const ENGLISH_TASK_VERB_SLUG_PREFIX =
  /^(build|create|implement|fix|write|add|develop|make|update|refactor|test|deploy|review|analyze|investigate|debug|improve|optimize|setup|configure|migrate|design|document|code)(-|$)/;
const KOREAN_TASK_VERB_PREFIX = /^(구현|작성|추가|수정|개선|테스트|배포|설정|리팩터링|분석|검토|디버깅)\b/;
const KOREAN_TASK_VERB_SUFFIX = /(구현|작성|추가|수정|개선|테스트|배포|설정|리팩터링|분석|검토|디버깅)(하기|작업)?$/;

export function parseAgentStructure(rawOutput: string): GeneratedAgentStructure {
  const jsonText = extractJson(rawOutput);
  const parsed = structureSchema.parse(JSON.parse(jsonText));

  const agents: GeneratedAgentStructure["agents"] = parsed.agents.map((agent) => ({
    name: agent.name.trim(),
    role: agent.role as AgentRole,
    roleLabel: trimOptional(agent.roleLabel),
    description: trimOptional(agent.description),
    systemPrompt: trimOptional(agent.systemPrompt),
    isOrchestrator: Boolean(agent.isOrchestrator) || agent.role === "orchestrator",
    delegatesTo: dedupeArray(agent.delegatesTo),
    assignedSkillIds: dedupeArray(agent.assignedSkillIds),
    assignedMcpServerIds: dedupeArray(agent.assignedMcpServerIds),
    assignedBackend: normalizeAssignedBackend(agent.assignedBackend),
    assignedModel: trimOptional(agent.assignedModel),
    backendAssignReason: trimOptional(agent.backendAssignReason),
    color: trimOptional(agent.color),
    avatar: trimOptional(agent.avatar)
  }));

  ensureSingleOrchestrator(agents);
  const suggestedNewSkills = normalizeSuggestedSkills(parsed.suggestedNewSkills ?? []);

  return {
    teamName: trimOptional(parsed.teamName) || "Generated Team",
    teamDescription: trimOptional(parsed.teamDescription) || "AI generated team structure",
    agents,
    suggestedNewSkills,
    suggestedNewMcpServers: (parsed.suggestedNewMcpServers ?? []).map((item) => ({
      name: item.name.trim(),
      kind: item.kind ?? "stdio",
      forAgent: trimOptional(item.forAgent) || ""
    })),
    workIntent: defaultWorkIntentAnalysis(),
    backendUsageAtBuild: []
  };
}

function ensureSingleOrchestrator(
  agents: Array<{ role: AgentRole; isOrchestrator: boolean }>
): void {
  const orchestratorIndexes = agents
    .map((agent, index) => ({ index, isOrchestrator: agent.isOrchestrator }))
    .filter((item) => item.isOrchestrator)
    .map((item) => item.index);

  if (orchestratorIndexes.length === 0) {
    agents[0].isOrchestrator = true;
    agents[0].role = "orchestrator";
    return;
  }

  if (orchestratorIndexes.length > 1) {
    const keep = orchestratorIndexes[0];
    for (const index of orchestratorIndexes.slice(1)) {
      agents[index].isOrchestrator = false;
      if (agents[index].role === "orchestrator") {
        agents[index].role = "custom";
      }
    }
    agents[keep].role = "orchestrator";
    agents[keep].isOrchestrator = true;
  }
}

function extractJson(rawOutput: string): string {
  const trimmed = rawOutput.trim();
  if (!trimmed) {
    throw new Error("CLI returned empty output");
  }

  if (trimmed.startsWith("{")) {
    return trimmed;
  }

  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const block = trimmed.match(/(\{[\s\S]*\})/);
  if (block?.[1]) {
    return block[1].trim();
  }

  throw new Error("Could not find JSON object in CLI output");
}

function trimOptional(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function dedupeArray(values: string[] | undefined): string[] {
  if (!values || values.length === 0) {
    return [];
  }
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeAssignedBackend(value: string | undefined): CanonicalBackendId {
  const normalized = normalizeBackendId((value?.trim() || "claude") as never);
  if (normalized === "claude" || normalized === "codex" || normalized === "gemini" || normalized === "aider" || normalized === "custom") {
    return normalized;
  }
  return "claude";
}

function normalizeSuggestedSkills(
  items: Array<{ name: string; description?: string; forAgent?: string }>
): GeneratedAgentStructure["suggestedNewSkills"] {
  const dedupe = new Set<string>();
  const result: GeneratedAgentStructure["suggestedNewSkills"] = [];

  for (const item of items) {
    const rawName = item.name.trim();
    if (!rawName) {
      continue;
    }
    const normalizedName = normalizeSuggestedSkillName(rawName);
    if (!normalizedName) {
      continue;
    }
    if (isLikelyTaskSkillName(rawName) || isLikelyTaskSkillName(normalizedName)) {
      continue;
    }
    if (dedupe.has(normalizedName)) {
      continue;
    }
    dedupe.add(normalizedName);

    result.push({
      name: normalizedName,
      description: normalizeSuggestedSkillDescription(item.description, normalizedName),
      forAgent: trimOptional(item.forAgent) || ""
    });
  }

  return result;
}

function normalizeSuggestedSkillName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[`"'“”‘’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeSuggestedSkillDescription(description: string | undefined, skillName: string): string {
  const fallback = `Reusable capability for ${skillName.replace(/-/g, " ")}`;
  const trimmed = trimOptional(description);
  if (!trimmed) {
    return fallback;
  }
  if (isLikelyTaskDescription(trimmed)) {
    return fallback;
  }
  return trimmed;
}

function isLikelyTaskSkillName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) {
    return true;
  }
  if (/[.!?:;]/.test(trimmed)) {
    return true;
  }
  if (ENGLISH_TASK_VERB_PREFIX.test(trimmed)) {
    return true;
  }
  if (KOREAN_TASK_VERB_PREFIX.test(trimmed) || KOREAN_TASK_VERB_SUFFIX.test(trimmed)) {
    return true;
  }
  if (trimmed.split(/\s+/).filter(Boolean).length >= 8) {
    return true;
  }
  const normalized = normalizeSuggestedSkillName(trimmed);
  if (!normalized) {
    return true;
  }
  return ENGLISH_TASK_VERB_SLUG_PREFIX.test(normalized);
}

function isLikelyTaskDescription(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  if (ENGLISH_TASK_VERB_PREFIX.test(trimmed)) {
    return true;
  }
  if (KOREAN_TASK_VERB_PREFIX.test(trimmed) || KOREAN_TASK_VERB_SUFFIX.test(trimmed)) {
    return true;
  }
  return /\b(todo|task|ticket)\b/i.test(trimmed);
}
