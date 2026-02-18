import { z } from "zod";
import type { AgentRole, GeneratedAgentStructure } from "../types";

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
    .optional()
});

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
    color: trimOptional(agent.color),
    avatar: trimOptional(agent.avatar)
  }));

  ensureSingleOrchestrator(agents);

  return {
    teamName: trimOptional(parsed.teamName) || "Generated Team",
    teamDescription: trimOptional(parsed.teamDescription) || "AI generated team structure",
    agents,
    suggestedNewSkills: (parsed.suggestedNewSkills ?? []).map((item) => ({
      name: item.name.trim(),
      description: trimOptional(item.description) || "Suggested by AI",
      forAgent: trimOptional(item.forAgent) || ""
    })),
    suggestedNewMcpServers: (parsed.suggestedNewMcpServers ?? []).map((item) => ({
      name: item.name.trim(),
      kind: item.kind ?? "stdio",
      forAgent: trimOptional(item.forAgent) || ""
    }))
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
