import type { AgentProfile, McpServer, Skill } from "../types";

export function buildAgentGenerationPrompt(input: {
  userPrompt: string;
  existingAgents: AgentProfile[];
  existingSkills: Skill[];
  existingMcpServers: McpServer[];
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

  return [
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
    '    { "name": "string", "description": "string", "forAgent": "agent-name" }',
    "  ],",
    '  "suggestedNewMcpServers": [',
    '    { "name": "string", "kind": "stdio|http", "forAgent": "agent-name" }',
    "  ]",
    "}",
    "",
    "## User request",
    input.userPrompt.trim()
  ].join("\n");
}
