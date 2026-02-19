import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentProfile, AgentRole, AgentRuntime } from "../types";
import { sanitizeFileName } from "./pathUtils";

const AGENT_PROFILES_DIR = join(".agentcanvas", "agents");

type CreateAgentInput = {
  name: string;
  role: AgentRole;
  roleLabel?: string;
  description?: string;
  systemPrompt?: string;
  isOrchestrator?: boolean;
  workspaceRoot: string;
  homeDir: string;
};

type AgentProfilePatch = Partial<Pick<
  AgentProfile,
  "role" | "roleLabel" | "description" | "systemPrompt" | "isOrchestrator" | "color" | "avatar"
>> & {
  runtime?: AgentRuntime | null;
};

function profileDir(workspaceRoot: string): string {
  return join(workspaceRoot, AGENT_PROFILES_DIR);
}

function profileFilePath(workspaceRoot: string, agentId: string): string {
  return join(profileDir(workspaceRoot), `${sanitizeFileName(agentId)}.json`);
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "agent";
}

function dedupe(values: string[] | undefined): string[] | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }
  return [...new Set(values)];
}

export function normalizeAgentProfile(
  profile: AgentProfile,
  fallback: { workspaceRoot?: string; homeDir: string }
): AgentProfile {
  const role = profile.role ?? "custom";
  const isOrchestrator = profile.isOrchestrator ?? role === "orchestrator";
  return {
    ...profile,
    role,
    isOrchestrator,
    workspaceRoot: profile.workspaceRoot ?? fallback.workspaceRoot,
    homeDir: profile.homeDir || fallback.homeDir,
    delegatesTo: dedupe(profile.delegatesTo),
    assignedSkillIds: dedupe(profile.assignedSkillIds),
    assignedMcpServerIds: dedupe(profile.assignedMcpServerIds),
    runtime: profile.runtime
  };
}

export async function listCustomAgentProfiles(workspaceRoot: string): Promise<AgentProfile[]> {
  const dir = profileDir(workspaceRoot);
  let entries: string[] = [];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const profiles: AgentProfile[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json")) {
      continue;
    }
    const path = join(dir, entry);
    try {
      const raw = await readFile(path, "utf8");
      const parsed = JSON.parse(raw) as AgentProfile;
      if (!parsed.id || !parsed.name) {
        continue;
      }
      profiles.push(parsed);
    } catch {
      continue;
    }
  }
  return profiles;
}

export async function saveAgentProfile(workspaceRoot: string, profile: AgentProfile): Promise<void> {
  const dir = profileDir(workspaceRoot);
  await mkdir(dir, { recursive: true });
  const path = profileFilePath(workspaceRoot, profile.id);
  await writeFile(path, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
}

export async function deleteAgentProfile(workspaceRoot: string, agentId: string): Promise<void> {
  const path = profileFilePath(workspaceRoot, agentId);
  await rm(path, { force: true });
}

export async function createCustomAgentProfile(input: CreateAgentInput): Promise<AgentProfile> {
  const baseId = slugify(input.name);
  const role = input.role;
  const profile: AgentProfile = {
    id: `custom:${baseId}`,
    name: input.name.trim(),
    providerId: "custom",
    workspaceRoot: input.workspaceRoot,
    homeDir: input.homeDir,
    role,
    roleLabel: input.roleLabel?.trim() || undefined,
    description: input.description?.trim() || undefined,
    systemPrompt: input.systemPrompt?.trim() || undefined,
    isOrchestrator: input.isOrchestrator ?? role === "orchestrator",
    delegatesTo: [],
    assignedSkillIds: [],
    assignedMcpServerIds: [],
    runtime: {
      kind: "cli",
      backendId: "auto",
      cwdMode: "workspace"
    },
    avatar: input.isOrchestrator || role === "orchestrator" ? "🎯" : undefined
  };
  await saveAgentProfile(input.workspaceRoot, profile);
  return profile;
}

export async function applyAgentProfilePatch(input: {
  workspaceRoot: string;
  baseProfile: AgentProfile;
  patch: AgentProfilePatch;
}): Promise<AgentProfile> {
  const next = normalizeAgentProfile(
    {
      ...input.baseProfile,
      ...input.patch,
      runtime: input.patch.runtime === null ? undefined : input.patch.runtime ?? input.baseProfile.runtime,
      roleLabel: input.patch.roleLabel?.trim() ?? input.baseProfile.roleLabel,
      description: input.patch.description?.trim() ?? input.baseProfile.description,
      systemPrompt: input.patch.systemPrompt?.trim() ?? input.baseProfile.systemPrompt
    },
    {
      workspaceRoot: input.baseProfile.workspaceRoot,
      homeDir: input.baseProfile.homeDir
    }
  );
  await saveAgentProfile(input.workspaceRoot, next);
  return next;
}

export async function assignSkillToAgent(input: {
  workspaceRoot: string;
  agent: AgentProfile;
  skillId: string;
}): Promise<AgentProfile> {
  const next = normalizeAgentProfile(
    {
      ...input.agent,
      assignedSkillIds: [...(input.agent.assignedSkillIds ?? []), input.skillId]
    },
    { workspaceRoot: input.agent.workspaceRoot, homeDir: input.agent.homeDir }
  );
  await saveAgentProfile(input.workspaceRoot, next);
  return next;
}

export async function unassignSkillFromAgent(input: {
  workspaceRoot: string;
  agent: AgentProfile;
  skillId: string;
}): Promise<AgentProfile> {
  const next = normalizeAgentProfile(
    {
      ...input.agent,
      assignedSkillIds: (input.agent.assignedSkillIds ?? []).filter((id) => id !== input.skillId)
    },
    { workspaceRoot: input.agent.workspaceRoot, homeDir: input.agent.homeDir }
  );
  await saveAgentProfile(input.workspaceRoot, next);
  return next;
}

export async function assignMcpToAgent(input: {
  workspaceRoot: string;
  agent: AgentProfile;
  mcpServerId: string;
}): Promise<AgentProfile> {
  const next = normalizeAgentProfile(
    {
      ...input.agent,
      assignedMcpServerIds: [...(input.agent.assignedMcpServerIds ?? []), input.mcpServerId]
    },
    { workspaceRoot: input.agent.workspaceRoot, homeDir: input.agent.homeDir }
  );
  await saveAgentProfile(input.workspaceRoot, next);
  return next;
}

export async function unassignMcpFromAgent(input: {
  workspaceRoot: string;
  agent: AgentProfile;
  mcpServerId: string;
}): Promise<AgentProfile> {
  const next = normalizeAgentProfile(
    {
      ...input.agent,
      assignedMcpServerIds: (input.agent.assignedMcpServerIds ?? []).filter((id) => id !== input.mcpServerId)
    },
    { workspaceRoot: input.agent.workspaceRoot, homeDir: input.agent.homeDir }
  );
  await saveAgentProfile(input.workspaceRoot, next);
  return next;
}

export async function setAgentDelegation(input: {
  workspaceRoot: string;
  agent: AgentProfile;
  workerIds: string[];
}): Promise<AgentProfile> {
  const next = normalizeAgentProfile(
    {
      ...input.agent,
      delegatesTo: input.workerIds,
      isOrchestrator: true
    },
    { workspaceRoot: input.agent.workspaceRoot, homeDir: input.agent.homeDir }
  );
  await saveAgentProfile(input.workspaceRoot, next);
  return next;
}
