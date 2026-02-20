import type { AgentProfile, McpServer, Skill } from "../types";

type CachedPromptInput = {
  flowName: string;
  taskInstruction: string;
  agent?: AgentProfile;
  assignedSkills?: Skill[];
  assignedMcpServers?: McpServer[];
  commonRules?: string[];
  projectContext?: string;
  dependencyOutputs?: Array<{ taskId: string; output: unknown }>;
  relevantMemory?: string;
  runtimeState?: Record<string, unknown>;
  timestampMs?: number;
  maxPromptTokens?: number;
};

export type CachedPromptBlocks = {
  staticBlock: string;
  dynamicBlock: string;
  prompt: string;
};

const DEFAULT_MAX_PROMPT_TOKENS = 120_000;
const MIN_DYNAMIC_TOKENS = 256;

export function buildCachedPrompt(input: CachedPromptInput): CachedPromptBlocks {
  const staticBlock = [
    "You are an autonomous software agent inside AgentCanvas.",
    "Follow role, rules, and constraints before executing the task.",
    "",
    "## Agent profile",
    JSON.stringify(
      {
        id: input.agent?.id,
        name: input.agent?.name,
        role: input.agent?.role,
        roleLabel: input.agent?.roleLabel,
        description: input.agent?.description,
        systemPrompt: input.agent?.systemPrompt
      },
      null,
      2
    ),
    "",
    "## Common rules",
    input.commonRules && input.commonRules.length > 0
      ? input.commonRules.join("\n")
      : "(none)",
    "",
    "## Assigned skills",
    JSON.stringify(
      (input.assignedSkills ?? []).map((skill) => ({
        id: skill.id,
        name: skill.name,
        description: skill.description
      })),
      null,
      2
    ),
    "",
    "## Assigned MCP servers",
    JSON.stringify(
      (input.assignedMcpServers ?? []).map((server) => ({
        id: server.id,
        name: server.name,
        kind: server.kind,
        providerId: server.providerId
      })),
      null,
      2
    ),
    "",
    "## Project Context",
    input.projectContext?.trim() || "(none)"
  ].join("\n");

  const dynamicBlock = [
    "## Runtime task",
    `Flow: ${input.flowName}`,
    `Task: ${input.taskInstruction.trim()}`,
    "",
    "## Dependency outputs",
    JSON.stringify(input.dependencyOutputs ?? [], null, 2),
    "",
    "## Relevant Memory",
    input.relevantMemory?.trim() || "(none)",
    "",
    "## Runtime state",
    JSON.stringify(
      {
        ts: new Date(input.timestampMs ?? Date.now()).toISOString(),
        ...(input.runtimeState ?? {})
      },
      null,
      2
    ),
    "",
    "Return concise plain text output."
  ].join("\n");

  const bounded = enforcePromptBudget(
    staticBlock,
    dynamicBlock,
    input.maxPromptTokens ?? DEFAULT_MAX_PROMPT_TOKENS
  );

  return {
    staticBlock,
    dynamicBlock: bounded.dynamicBlock,
    prompt: composeWithCacheMarkers(staticBlock, bounded.dynamicBlock)
  };
}

export function buildAgentGenerationPrompt(input: {
  userPrompt: string;
  existingAgents: AgentProfile[];
  existingSkills: Skill[];
  existingMcpServers: McpServer[];
  maxPromptTokens?: number;
}): string {
  const agentContext = input.existingAgents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    role: agent.role,
    isOrchestrator: agent.isOrchestrator,
    description: agent.description
  }));

  const skillContext = input.existingSkills.map((skill) => ({
    id: skill.id,
    name: skill.name,
    description: skill.description
  }));

  const mcpContext = input.existingMcpServers.map((server) => ({
    id: server.id,
    name: server.name,
    kind: server.kind,
    providerId: server.providerId
  }));

  const staticBlock = [
    "You are an agent architecture designer.",
    "Generate a multi-agent team structure as strict JSON only.",
    "Do not include markdown fences or explanations.",
    "",
    "## Current workspace context",
    "",
    "### Existing agents",
    JSON.stringify(agentContext, null, 2),
    "",
    "### Available skills",
    JSON.stringify(skillContext, null, 2),
    "",
    "### Available MCP servers",
    JSON.stringify(mcpContext, null, 2),
    "",
    "## Instructions",
    "1. Create agents with clear roles based on the user's request.",
    "2. Exactly one agent must be orchestrator (isOrchestrator=true).",
    "3. Use existing skill IDs and MCP IDs where possible.",
    "4. Unknown resources must be listed in suggestedNewSkills/suggestedNewMcpServers.",
    "5. Use delegatesTo to represent orchestration direction.",
    "6. suggestedNewSkills must be reusable capabilities (not one-off tasks).",
    "7. NEVER put task statements in suggestedNewSkills (bad: \"implement login page\", \"fix API bug\").",
    "8. suggestedNewSkills[].name must be kebab-case folder names (example: \"api-schema-validator\").",
    "9. If something is a task, encode it in agent systemPrompt/delegation, not in suggestedNewSkills.",
    "",
    "## Output schema",
    "{",
    '  "teamName": "string",',
    '  "teamDescription": "string",',
    '  "agents": [',
    "    {",
    '      "name": "string",',
    '      "role": "orchestrator|coder|researcher|reviewer|planner|tester|writer|custom",',
    '      "roleLabel": "string",',
    '      "description": "string",',
    '      "systemPrompt": "string",',
    '      "isOrchestrator": true,',
    '      "delegatesTo": ["agent-name"],',
    '      "assignedSkillIds": ["existing-skill-id"],',
    '      "assignedMcpServerIds": ["existing-mcp-id"],',
    '      "color": "#hex",',
    '      "avatar": "emoji"',
    "    }",
    "  ],",
    '  "suggestedNewSkills": [',
    '    { "name": "kebab-case-capability", "description": "reusable capability description", "forAgent": "agent-name" }',
    "  ],",
    '  "suggestedNewMcpServers": [',
    '    { "name": "string", "kind": "stdio|http", "forAgent": "agent-name" }',
    "  ]",
    "}",
    ""
  ].join("\n");

  const dynamicBlock = [
    "## User request",
    input.userPrompt.trim()
  ].join("\n");

  const bounded = enforcePromptBudget(
    staticBlock,
    dynamicBlock,
    input.maxPromptTokens ?? DEFAULT_MAX_PROMPT_TOKENS
  );
  return composeWithCacheMarkers(staticBlock, bounded.dynamicBlock);
}

function composeWithCacheMarkers(staticBlock: string, dynamicBlock: string): string {
  return [
    "<!-- CACHE_STATIC_START -->",
    staticBlock,
    "<!-- CACHE_STATIC_END -->",
    dynamicBlock
  ].join("\n");
}

function enforcePromptBudget(
  staticBlock: string,
  dynamicBlock: string,
  maxPromptTokens: number
): { dynamicBlock: string } {
  const budget = Math.max(2_000, Math.floor(maxPromptTokens));
  const staticTokens = estimatePromptTokens(staticBlock);
  const dynamicTokens = estimatePromptTokens(dynamicBlock);
  if (staticTokens + dynamicTokens <= budget) {
    return { dynamicBlock };
  }

  const allowedDynamicTokens = Math.max(MIN_DYNAMIC_TOKENS, budget - staticTokens);
  const trimmedDynamic = truncateToTokenBudget(dynamicBlock, allowedDynamicTokens);
  const truncatedNotice = "\n\n[Prompt trimmed to fit token budget]";
  return {
    dynamicBlock: `${trimmedDynamic}${truncatedNotice}`
  };
}

function truncateToTokenBudget(text: string, budgetTokens: number): string {
  if (budgetTokens <= 0) {
    return "";
  }
  if (estimatePromptTokens(text) <= budgetTokens) {
    return text;
  }

  let low = 0;
  let high = text.length;
  let best = "";

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = text.slice(0, mid).trimEnd();
    const candidateTokens = estimatePromptTokens(candidate);
    if (candidateTokens <= budgetTokens) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}

function estimatePromptTokens(text: string): number {
  const normalized = text.trim();
  if (!normalized) {
    return 0;
  }
  return Math.max(1, Math.ceil(normalized.length / 4));
}
