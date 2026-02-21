import { dirname, join, resolve } from "node:path";
import type { Provider, ProviderContext } from "../providers/provider";
import type {
  AgentProfile,
  DiscoverySnapshot,
  McpServer,
  RuleDoc,
  Skill,
  StudioEdge,
  StudioNode
} from "../types";
import { CODEX_DEFAULT_AGENT_ID, VSCODE_WORKSPACE_AGENT_ID } from "./agentIds";
import {
  getBuiltinOrchestratorSkillIds,
  getBuiltinOrchestratorSkills
} from "./builtinSkills";
import {
  COMMON_RULES_FOLDER,
  discoverExtensionManagedCommonRules
} from "./commonRulesService";
import { discoverCodexProjectRoot } from "./codexAgentsDiscovery";
import { discoverMcpServers } from "./mcpDiscovery";
import { exists } from "./pathUtils";
import { listCustomAgentProfiles, normalizeAgentProfile } from "./agentProfileService";

export async function runDiscovery(
  ctx: ProviderContext,
  providers: Provider[]
): Promise<DiscoverySnapshot> {
  const enabledProviders = await resolveEnabledProviders(ctx, providers);
  const collected = await collectProviderEntities(ctx, enabledProviders);
  const baseAgents = ensureBaseAgents(collected.agents, ctx);
  const customAgentProfiles = await loadCustomAgentProfiles(ctx);
  const agents = mergeAgentsWithCustomProfiles(baseAgents, customAgentProfiles, ctx);
  const skills = dedupeSkillsByPath(collected.skills);
  const ruleDocs = dedupeRuleDocsByPath(collected.ruleDocs).sort(
    (left, right) => left.orderIndex - right.orderIndex
  );

  const commonRules = await resolveCommonRules(ctx, ruleDocs);
  const mcpServers = await discoverMcpServers({
    workspacePath: ctx.workspacePath,
    homeDir: ctx.homeDir,
    codexAgentId: CODEX_DEFAULT_AGENT_ID,
    vscodeAgentId: VSCODE_WORKSPACE_AGENT_ID
  });

  // Inject built-in orchestration skills into orchestrator agents
  const builtinSkillIds = getBuiltinOrchestratorSkillIds();
  const enrichedAgents = agents.map((agent) => {
    if (!agent.isOrchestrator) {
      return agent;
    }
    const existing = new Set(agent.assignedSkillIds ?? []);
    const merged = [...(agent.assignedSkillIds ?? [])];
    for (const bid of builtinSkillIds) {
      if (!existing.has(bid)) {
        merged.push(bid);
      }
    }
    return { ...agent, assignedSkillIds: merged };
  });
  const builtinSkills = getBuiltinOrchestratorSkills();
  const enrichedSkills = [...skills, ...builtinSkills];

  const { nodes, edges } = await buildGraph({
    workspacePath: ctx.workspacePath,
    agents: enrichedAgents,
    skills: enrichedSkills,
    ruleDocs,
    commonRules,
    mcpServers
  });

  const primaryAgent =
    enrichedAgents.find((agent) => agent.id === VSCODE_WORKSPACE_AGENT_ID) ?? enrichedAgents[0];

  return {
    agent: primaryAgent,
    agents: enrichedAgents,
    skills: enrichedSkills,
    ruleDocs,
    commonRules,
    mcpServers,
    nodes,
    edges,
    generatedAt: new Date().toISOString()
  };
}

async function resolveEnabledProviders(
  ctx: ProviderContext,
  providers: Provider[]
): Promise<Provider[]> {
  const enabledProviders: Provider[] = [];
  for (const provider of providers) {
    if (await provider.detect(ctx)) {
      enabledProviders.push(provider);
    }
  }

  if (enabledProviders.length === 0) {
    return [...providers];
  }
  return enabledProviders;
}

async function collectProviderEntities(
  ctx: ProviderContext,
  providers: Provider[]
): Promise<{ agents: AgentProfile[]; skills: Skill[]; ruleDocs: RuleDoc[] }> {
  const agentMap = new Map<string, AgentProfile>();
  const skills: Skill[] = [];
  const ruleDocs: RuleDoc[] = [];

  for (const provider of providers) {
    const providerAgents = await provider.listAgents(ctx);
    for (const agent of providerAgents) {
      if (!agentMap.has(agent.id)) {
        agentMap.set(agent.id, agent);
      }
    }

    for (const agent of providerAgents) {
      const providerSkills = await provider.listSkills(ctx, agent.id);
      const providerRules = await provider.listRuleDocs(ctx, agent.id);
      for (const skill of providerSkills) {
        skills.push({
          ...skill,
          ownerAgentId: skill.ownerAgentId || agent.id
        });
      }
      for (const rule of providerRules) {
        ruleDocs.push({
          ...rule,
          ownerAgentId: rule.ownerAgentId || agent.id
        });
      }
    }
  }

  return {
    agents: [...agentMap.values()],
    skills,
    ruleDocs
  };
}

async function loadCustomAgentProfiles(ctx: ProviderContext): Promise<AgentProfile[]> {
  const profiles = await listCustomAgentProfiles(ctx.workspacePath);
  return profiles.map((profile) =>
    normalizeAgentProfile(profile, {
      workspaceRoot: ctx.workspaceRoot,
      homeDir: ctx.homeDir
    })
  );
}

function ensureBaseAgents(agents: AgentProfile[], ctx: ProviderContext): AgentProfile[] {
  const map = new Map<string, AgentProfile>(agents.map((agent) => [
    agent.id,
    normalizeAgentProfile(agent, {
      workspaceRoot: ctx.workspaceRoot,
      homeDir: ctx.homeDir
    })
  ]));

  if (!map.has(VSCODE_WORKSPACE_AGENT_ID)) {
    map.set(VSCODE_WORKSPACE_AGENT_ID, {
      id: VSCODE_WORKSPACE_AGENT_ID,
      name: "VS Code / Workspace",
      providerId: "agent-skills",
      workspaceRoot: ctx.workspaceRoot,
      homeDir: ctx.homeDir,
      metadata: { source: "fallback" },
      role: "coder",
      isOrchestrator: false,
      description: "Workspace execution agent",
      systemPrompt: "Focus on implementing tasks within the current workspace.",
      runtime: {
        kind: "cli",
        backendId: "auto",
        cwdMode: "workspace"
      }
    });
  }

  if (!map.has(CODEX_DEFAULT_AGENT_ID)) {
    map.set(CODEX_DEFAULT_AGENT_ID, {
      id: CODEX_DEFAULT_AGENT_ID,
      name: "Codex / default",
      providerId: "codex-guidance",
      workspaceRoot: ctx.workspaceRoot,
      homeDir: ctx.homeDir,
      metadata: { source: "fallback" },
      role: "orchestrator",
      isOrchestrator: true,
      avatar: "🎯",
      description: "Default orchestration agent",
      systemPrompt: "Plan work and delegate to worker agents when possible.",
      runtime: {
        kind: "cli",
        backendId: "auto",
        cwdMode: "workspace"
      }
    });
  }

  return [...map.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function mergeAgentsWithCustomProfiles(
  baseAgents: AgentProfile[],
  customProfiles: AgentProfile[],
  ctx: ProviderContext
): AgentProfile[] {
  const map = new Map<string, AgentProfile>(baseAgents.map((agent) => [agent.id, agent]));
  for (const profile of customProfiles) {
    const existing = map.get(profile.id);
    const merged = normalizeAgentProfile(
      {
        ...(existing ?? {}),
        ...profile,
        providerId: profile.providerId || existing?.providerId || "custom",
        homeDir: profile.homeDir || existing?.homeDir || ctx.homeDir
      } as AgentProfile,
      {
        workspaceRoot: existing?.workspaceRoot ?? ctx.workspaceRoot,
        homeDir: existing?.homeDir ?? ctx.homeDir
      }
    );
    map.set(profile.id, merged);
  }
  return [...map.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function dedupeSkillsByPath(items: Skill[]): Skill[] {
  const seen = new Set<string>();
  const result: Skill[] = [];
  for (const item of items) {
    if (seen.has(item.path)) {
      continue;
    }
    seen.add(item.path);
    result.push(item);
  }
  return result;
}

function dedupeRuleDocsByPath(items: RuleDoc[]): RuleDoc[] {
  const seen = new Set<string>();
  const result: RuleDoc[] = [];
  for (const item of items) {
    if (seen.has(item.path)) {
      continue;
    }
    seen.add(item.path);
    result.push(item);
  }
  return result;
}

async function resolveCommonRules(ctx: ProviderContext, ruleDocs: RuleDoc[]): Promise<RuleDoc[]> {
  const projectRoot = await discoverCodexProjectRoot({
    workspacePath: ctx.workspacePath,
    homeDir: ctx.homeDir
  });
  const resolvedProjectRoot = resolve(projectRoot);

  const codexCommons = ruleDocs.filter((rule) => {
    if (rule.scope === "global") {
      return true;
    }
    return rule.scope === "project" && resolve(dirname(rule.path)) === resolvedProjectRoot;
  });

  const extensionManagedPaths = await discoverExtensionManagedCommonRules(ctx.workspacePath);
  let extensionOrder = codexCommons.length + 1;
  const extensionRules: RuleDoc[] = extensionManagedPaths.map((path) => ({
    id: `common:${path}`,
    ownerAgentId: CODEX_DEFAULT_AGENT_ID,
    type: "codex-agents",
    path,
    scope: "project",
    orderIndex: extensionOrder++,
    providerId: "agentcanvas-common"
  }));

  const all = [...codexCommons, ...extensionRules];
  return dedupeRuleDocsByPath(all).sort((left, right) => left.orderIndex - right.orderIndex);
}

async function buildGraph(input: {
  workspacePath: string;
  agents: AgentProfile[];
  skills: Skill[];
  ruleDocs: RuleDoc[];
  commonRules: RuleDoc[];
  mcpServers: McpServer[];
}): Promise<{ nodes: StudioNode[]; edges: StudioEdge[] }> {
  const nodes: StudioNode[] = [];
  const edges: StudioEdge[] = [];
  const edgeKeys = new Set<string>();
  const folderNodeByPath = new Map<string, string>();
  const skillNodeBySkillId = new Map<string, string>();

  const addEdge = (edge: StudioEdge) => {
    const key = [
      edge.type,
      edge.source,
      edge.target,
      edge.label ?? "",
      stableEdgeDataKey(edge.data)
    ].join("|");
    if (edgeKeys.has(key)) {
      return;
    }
    edgeKeys.add(key);
    edges.push(edge);
  };

  const rootAgentsPath = resolve(input.workspacePath, "AGENTS.md");
  const commonRulesPath = resolve(input.workspacePath, COMMON_RULES_FOLDER);
  const hasRootAgents = await exists(rootAgentsPath);
  const hasCommonRulesFolder = await exists(commonRulesPath);

  const skillIdsByAgent = new Map<string, Set<string>>();
  for (const skill of input.skills) {
    const set = skillIdsByAgent.get(skill.ownerAgentId) ?? new Set<string>();
    set.add(skill.id);
    skillIdsByAgent.set(skill.ownerAgentId, set);
  }

  const mcpIdsByAgent = new Map<string, Set<string>>();
  for (const server of input.mcpServers) {
    const set = mcpIdsByAgent.get(server.ownerAgentId) ?? new Set<string>();
    set.add(server.id);
    mcpIdsByAgent.set(server.ownerAgentId, set);
  }

  for (const agent of input.agents) {
    const skillSet = skillIdsByAgent.get(agent.id) ?? new Set<string>();
    for (const skillId of agent.assignedSkillIds ?? []) {
      skillSet.add(skillId);
    }
    skillIdsByAgent.set(agent.id, skillSet);

    const mcpSet = mcpIdsByAgent.get(agent.id) ?? new Set<string>();
    for (const serverId of agent.assignedMcpServerIds ?? []) {
      mcpSet.add(serverId);
    }
    mcpIdsByAgent.set(agent.id, mcpSet);
  }

  for (const [index, agent] of input.agents.entries()) {
    const skillCount = skillIdsByAgent.get(agent.id)?.size ?? 0;
    const mcpCount = mcpIdsByAgent.get(agent.id)?.size ?? 0;
    nodes.push({
      id: agent.id,
      type: "agent",
      position: { x: 90, y: 120 + index * 240 },
      data: {
        id: agent.id,
        ownerAgentId: agent.id,
        name: agent.name,
        providerId: agent.providerId,
        workspaceRoot: agent.workspaceRoot,
        homeDir: agent.homeDir,
        role: agent.role,
        roleLabel: agent.roleLabel,
        description: agent.description,
        systemPrompt: agent.systemPrompt,
        isOrchestrator: agent.isOrchestrator,
        delegatesTo: agent.delegatesTo ?? [],
        assignedSkillIds: agent.assignedSkillIds ?? [],
        assignedMcpServerIds: agent.assignedMcpServerIds ?? [],
        runtime: agent.runtime,
        color: agent.color,
        avatar: agent.avatar || initialsForAgent(agent.name),
        skillCount,
        mcpCount
      }
    });
  }

  nodes.push({
    id: "common-rules",
    type: "commonRules",
    position: { x: 1000, y: 40 },
    data: {
      id: "common-rules",
      title: "Common Rules",
      pinned: true,
      path: rootAgentsPath,
      hasRootAgents,
      commonRulesPath,
      hasCommonRulesFolder,
      rules: input.commonRules.map((rule) => ({
        id: rule.id,
        path: rule.path,
        scope: rule.scope
      }))
    }
  });

  for (const agent of input.agents) {
    addEdge({
      id: `appliesTo:common-rules:${agent.id}`,
      source: "common-rules",
      target: agent.id,
      type: "appliesTo"
    });
  }

  const agentIdSet = new Set(input.agents.map((agent) => agent.id));
  for (const agent of input.agents) {
    for (const workerId of agent.delegatesTo ?? []) {
      if (!agentIdSet.has(workerId) || workerId === agent.id) {
        continue;
      }
      addEdge({
        id: `delegates:${agent.id}:${workerId}`,
        source: agent.id,
        target: workerId,
        type: "delegates",
        label: "delegates"
      });
    }
  }

  for (const [index, skill] of input.skills.entries()) {
    const nodeId = normalizeNodeId(`skill:${skill.id}`);
    const folderPath = dirname(skill.path);
    let folderNodeId = folderNodeByPath.get(folderPath);

    if (!folderNodeId) {
      folderNodeId = normalizeNodeId(`folder:${folderPath}`);
      folderNodeByPath.set(folderPath, folderNodeId);
      nodes.push({
        id: folderNodeId,
        type: "folder",
        position: { x: 520 + (index % 2) * 260, y: 520 + Math.floor(index / 2) * 180 },
        data: {
          id: folderNodeId,
          ownerAgentId: skill.ownerAgentId,
          path: folderPath,
          title: folderPath.split("/").filter(Boolean).pop() ?? folderPath
        }
      });
    }

    nodes.push({
      id: nodeId,
      type: "skill",
      position: { x: 760 + (index % 2) * 260, y: 460 + Math.floor(index / 2) * 180 },
      data: {
        id: skill.id,
        ownerAgentId: skill.ownerAgentId,
        name: skill.name,
        description: skill.description,
        path: skill.path,
        folderName: skill.folderName,
        scope: skill.scope,
        enabled: skill.enabled,
        extraFrontmatter: skill.extraFrontmatter,
        validation: skill.validation
      }
    });
    skillNodeBySkillId.set(skill.id, nodeId);

    addEdge({
      id: `contains:${skill.ownerAgentId}:${nodeId}`,
      source: skill.ownerAgentId,
      target: nodeId,
      type: "contains"
    });
    addEdge({
      id: `locatedIn:${nodeId}:${folderNodeId}`,
      source: nodeId,
      target: folderNodeId,
      type: "locatedIn"
    });
  }

  for (const agent of input.agents) {
    for (const skillId of agent.assignedSkillIds ?? []) {
      const nodeId = skillNodeBySkillId.get(skillId);
      if (!nodeId) {
        continue;
      }
      addEdge({
        id: `contains:assigned:${agent.id}:${nodeId}`,
        source: agent.id,
        target: nodeId,
        type: "contains"
      });
    }
  }

  for (const [index, ruleDoc] of input.ruleDocs.entries()) {
    const nodeId = normalizeNodeId(`rule:${ruleDoc.id}`);
    nodes.push({
      id: nodeId,
      type: "ruleDoc",
      position: { x: 430, y: 300 + index * 170 },
      data: {
        id: ruleDoc.id,
        ownerAgentId: ruleDoc.ownerAgentId,
        path: ruleDoc.path,
        scope: ruleDoc.scope,
        orderIndex: ruleDoc.orderIndex,
        title: `Rule ${ruleDoc.orderIndex + 1}`
      }
    });
    addEdge({
      id: `contains:${ruleDoc.ownerAgentId}:${nodeId}`,
      source: ruleDoc.ownerAgentId,
      target: nodeId,
      type: "contains"
    });
  }

  const rulesByAgent = new Map<string, RuleDoc[]>();
  for (const rule of input.ruleDocs) {
    const list = rulesByAgent.get(rule.ownerAgentId) ?? [];
    list.push(rule);
    rulesByAgent.set(rule.ownerAgentId, list);
  }
  for (const [agentId, rules] of rulesByAgent.entries()) {
    const ordered = [...rules].sort((left, right) => left.orderIndex - right.orderIndex);
    for (let index = 1; index < ordered.length; index += 1) {
      const prevId = normalizeNodeId(`rule:${ordered[index - 1].id}`);
      const nextId = normalizeNodeId(`rule:${ordered[index].id}`);
      addEdge({
        id: `overrides:${agentId}:${prevId}:${nextId}`,
        source: prevId,
        target: nextId,
        type: "overrides"
      });
    }
  }

  return { nodes, edges };
}

function normalizeNodeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9-_:.]/g, "_");
}

function initialsForAgent(name: string): string {
  const parts = name
    .split(/[\/\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return "AG";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function stableEdgeDataKey(data: unknown): string {
  if (!data || typeof data !== "object") {
    return "";
  }
  if (Array.isArray(data)) {
    return `[${data.map((item) => stableEdgeDataKey(item)).join(",")}]`;
  }

  const record = data as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${key}:${stableEdgeDataKey(record[key])}`).join(",")}}`;
}
