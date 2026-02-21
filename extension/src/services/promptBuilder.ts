import type {
  AgentProfile,
  BackendCapabilityProfile,
  BackendUsageSummary,
  CanonicalBackendId,
  McpServer,
  Skill
} from "../types";

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
    ...(input.agent?.isOrchestrator
      ? [
          "",
          "## Orchestrator directives (always active)",
          [
            "You are the central orchestrator for this AgentCanvas run.",
            "",
            "### Task design & delegation",
            "- Break the top-level goal into discrete sub-tasks; assign each to the most suitable sub-agent.",
            "- Emit assignments as structured handoff envelopes: { target: \"<agentId>\", task: \"<instruction>\", context: \"<relevant prior output>\" }.",
            "- Do NOT execute domain work yourself — delegate to specialists.",
            "",
            "### Supervision & Review Gate",
            "- After each sub-agent returns output, evaluate it against acceptance criteria before proceeding.",
            "- If output is insufficient, re-delegate with corrective instructions.",
            "- Gate the final result behind an explicit review step; only mark a task done once quality criteria are met.",
            "",
            "### Mid-execution queries",
            "- If a sub-agent raises a blocker, surface it to the user immediately rather than guessing.",
            "- If user input is required, respond using exactly: [NEED_HUMAN: <question>].",
            "- Do not use alternative query tags or plain prose for human-input requests.",
            "",
            "### Communication protocol",
            "- All agent-to-agent messages must route through the orchestrator; direct peer-to-peer bypasses are not allowed.",
            "- Verify routing with allowedTargetIds from runtime state before delegating.",
            "- Final output must be a structured summary: what each agent produced and the overall result."
          ].join("\n")
        ]
      : []),
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
  backendProfiles?: BackendCapabilityProfile[];
  preferredBackends?: CanonicalBackendId[];
  useSmartAssignment?: boolean;
  budgetConstraint?: "strict" | "soft";
  backendUsage?: BackendUsageSummary[];
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
  const modelSelectionGuide = buildModelSelectionGuide(input.backendProfiles);

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
    "### Backend strategy",
    JSON.stringify(
      {
        useSmartAssignment: input.useSmartAssignment ?? true,
        preferredBackends: input.preferredBackends ?? [],
        budgetConstraint: input.budgetConstraint ?? "soft",
        backendUsage: input.backendUsage ?? []
      },
      null,
      2
    ),
    "",
    "### Role-aware model selection guide",
    JSON.stringify(modelSelectionGuide, null, 2),
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
    "10. assignedBackend must be explicit (claude|codex|gemini|aider|custom); never use auto.",
    "11. assignedModel must be selected from the listed model guide for that assignedBackend.",
    "12. backendAssignReason must mention both role fit and why the chosen model is appropriate.",
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
    '      "assignedBackend": "claude|codex|gemini|aider|custom",',
    '      "assignedModel": "string",',
    '      "backendAssignReason": "string",',
    '      "color": "#hex",',
    '      "avatar": "emoji"',
    "    }",
    "  ],",
    '  "suggestedNewSkills": [',
    '    { "name": "kebab-case-capability", "description": "reusable capability description", "forAgent": "agent-name" }',
    "  ],",
    '  "suggestedNewMcpServers": [',
    '    { "name": "string", "kind": "stdio|http", "forAgent": "agent-name" }',
    "  ],",
    '  "workIntent": {',
    '    "primaryCategory": "mixed",',
    '    "secondaryCategories": ["refactor"],',
    '    "categoryWeights": { "mixed": 1.0 },',
    '    "suggestedRoles": [],',
    '    "estimatedComplexity": "medium",',
    '    "estimatedDuration": "hours"',
    "  },",
    '  "backendUsageAtBuild": []',
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

type ModelGuideEntry = {
  id: string;
  tier: "fast" | "standard" | "advanced";
  contextWindow: number;
  costPer1MInput: number;
  costPer1MOutput: number;
  whenToUse: string;
  recommendedRoles: string[];
};

type ModelGuideGroup = {
  backendId: CanonicalBackendId;
  models: ModelGuideEntry[];
};

const MODEL_USAGE_HINTS: Record<
  string,
  {
    whenToUse: string;
    recommendedRoles: string[];
  }
> = {
  "claude-opus-4-6": {
    whenToUse: "Most capable for complex work: deep architecture, hard reasoning, and final quality gates.",
    recommendedRoles: ["orchestrator", "planner", "reviewer"]
  },
  "claude-sonnet-4-6": {
    whenToUse: "Best for everyday tasks: balanced quality and speed.",
    recommendedRoles: ["orchestrator", "planner", "reviewer", "coder"]
  },
  "claude-haiku-4-5-20251001": {
    whenToUse: "Fastest for quick answers and lightweight tasks.",
    recommendedRoles: ["writer", "researcher", "tester"]
  },
  "gpt-5.3-codex": {
    whenToUse: "Latest frontier agentic coding model.",
    recommendedRoles: ["coder", "tester", "reviewer"]
  },
  "gpt-5.3-codex-spark": {
    whenToUse: "Ultra-fast coding model.",
    recommendedRoles: ["coder", "tester"]
  },
  "gpt-5.2-codex": {
    whenToUse: "Frontier agentic coding model.",
    recommendedRoles: ["coder", "tester", "reviewer"]
  },
  "gpt-5.1-codex-max": {
    whenToUse: "Codex-optimized flagship for deep and fast reasoning.",
    recommendedRoles: ["orchestrator", "planner", "reviewer"]
  },
  "gpt-5.2": {
    whenToUse: "Latest frontier model with improvements across knowledge, reasoning and coding.",
    recommendedRoles: ["orchestrator", "planner", "coder", "reviewer"]
  },
  "gpt-5.1-codex-mini": {
    whenToUse: "Optimized for codex. Cheaper, faster, but less capable.",
    recommendedRoles: ["tester", "writer", "researcher"]
  },
  "gpt-4.1": {
    whenToUse: "Stable fallback for compatibility-focused coding work.",
    recommendedRoles: ["coder", "tester"]
  },
  "gpt-4o": {
    whenToUse: "Multimodal fallback when image-aware context is needed.",
    recommendedRoles: ["coder", "researcher", "writer"]
  },
  o3: {
    whenToUse: "Reasoning-first fallback for difficult analysis and decision-heavy reviews.",
    recommendedRoles: ["reviewer", "planner", "orchestrator"]
  },
  "gemini-3-pro-preview": {
    whenToUse: "Best for deep research, long-context synthesis, and high-complexity analysis.",
    recommendedRoles: ["researcher", "planner", "writer"]
  },
  "gemini-3-flash-preview": {
    whenToUse: "Fast option for iterative research and medium-complexity tasks.",
    recommendedRoles: ["researcher", "writer", "tester"]
  },
  "gemini-2.5-pro": {
    whenToUse: "Stable high-quality fallback for complex reasoning.",
    recommendedRoles: ["researcher", "writer", "reviewer"]
  },
  "gemini-2.5-flash": {
    whenToUse: "Balanced speed and cost for general-purpose research and writing.",
    recommendedRoles: ["researcher", "writer", "tester"]
  },
  "gemini-2.5-flash-lite": {
    whenToUse: "Cheapest and fastest for bulk extraction and lightweight tasks.",
    recommendedRoles: ["researcher", "writer"]
  }
};

function buildModelSelectionGuide(profiles?: BackendCapabilityProfile[]): ModelGuideGroup[] {
  const targetBackends: CanonicalBackendId[] = ["claude", "codex", "gemini"];
  const selectedProfiles = (profiles ?? [])
    .filter((profile) => targetBackends.includes(profile.backendId))
    .sort((left, right) => targetBackends.indexOf(left.backendId) - targetBackends.indexOf(right.backendId));

  return selectedProfiles.map((profile) => ({
    backendId: profile.backendId,
    models: profile.models.map((model) => {
      const hint = MODEL_USAGE_HINTS[model.id];
      return {
        id: model.id,
        tier: model.tier,
        contextWindow: model.contextWindow,
        costPer1MInput: model.costPer1MInput,
        costPer1MOutput: model.costPer1MOutput,
        whenToUse: hint?.whenToUse ?? `Use for ${model.tier} workloads under ${profile.displayName}.`,
        recommendedRoles: hint?.recommendedRoles ?? ["coder", "reviewer"]
      };
    })
  }));
}
