import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type {
  AgentProfile,
  AgentRole,
  AgentRuntime,
  ClaudePermissionMode,
  GeminiApprovalMode,
  CliBackendId,
  CodexApprovalPolicy,
  CodexSandboxPolicy,
  PromptMode
} from "../types";
import { sanitizeFileName } from "./pathUtils";

const AGENT_PROFILES_DIR = join(".agentcanvas", "agents");

type CreateAgentInput = {
  name: string;
  role: AgentRole;
  roleLabel?: string;
  description?: string;
  systemPrompt?: string;
  isOrchestrator?: boolean;
  backendId?: CliBackendId;
  modelId?: string;
  promptMode?: PromptMode;
  maxTurns?: number;
  maxBudgetUsd?: number;
  permissionMode?: ClaudePermissionMode;
  allowedTools?: string[];
  codexApproval?: CodexApprovalPolicy;
  codexSandbox?: CodexSandboxPolicy;
  geminiApprovalMode?: GeminiApprovalMode;
  geminiUseSandbox?: boolean;
  additionalDirs?: string[];
  enableWebSearch?: boolean;
  sessionId?: string;
  sessionName?: string;
  workspaceRoot: string;
  homeDir: string;
};

type AgentProfilePatch = Partial<Pick<
  AgentProfile,
  "role" | "roleLabel" | "description" | "systemPrompt" | "isOrchestrator" | "color" | "avatar" | "preferredModel"
>> & {
  runtime?: AgentRuntime | null;
};

const cliBackendIdSchema: z.ZodType<CliBackendId> = z.enum([
  "auto",
  "claude",
  "gemini",
  "codex",
  "claude-code",
  "gemini-cli",
  "codex-cli",
  "aider",
  "custom"
]);

const runtimeSchema = z.union([
  z.object({
    kind: z.literal("cli"),
    backendId: cliBackendIdSchema,
    cwdMode: z.enum(["workspace", "agentHome"]).optional(),
    modelId: z.string().optional(),
    promptMode: z.enum(["append", "replace"]).optional(),
    maxTurns: z.number().int().positive().optional(),
    maxBudgetUsd: z.number().positive().optional(),
    permissionMode: z.enum(["default", "plan", "skip"]).optional(),
    allowedTools: z.array(z.string()).optional(),
    codexApproval: z.enum(["on-request", "untrusted", "never"]).optional(),
    codexSandbox: z.enum(["read-only", "workspace-write", "danger-full-access"]).optional(),
    geminiApprovalMode: z.enum(["default", "auto_edit", "yolo"]).optional(),
    geminiUseSandbox: z.boolean().optional(),
    additionalDirs: z.array(z.string()).optional(),
    enableWebSearch: z.boolean().optional(),
    sessionId: z.string().optional(),
    sessionName: z.string().optional(),
    useWorktree: z.boolean().optional(),
    worktreeName: z.string().optional()
  }),
  z.object({
    kind: z.literal("openclaw"),
    gatewayUrl: z.string().optional(),
    agentKey: z.string().optional()
  })
]);

const agentRoleSchema = z.enum([
  "orchestrator",
  "coder",
  "researcher",
  "reviewer",
  "planner",
  "tester",
  "writer",
  "custom"
]);

const agentProfilePatchSchema = z.object({
  role: agentRoleSchema.optional(),
  roleLabel: z.string().optional(),
  description: z.string().optional(),
  systemPrompt: z.string().optional(),
  isOrchestrator: z.boolean().optional(),
  color: z.string().optional(),
  avatar: z.string().optional(),
  preferredModel: z.string().optional(),
  runtime: runtimeSchema.nullable().optional()
});

function profileDir(workspaceRoot: string): string {
  return join(workspaceRoot, AGENT_PROFILES_DIR);
}

function profileFilePath(workspaceRoot: string, agentId: string): string {
  return join(profileDir(workspaceRoot), `${sanitizeFileName(agentId)}.json`);
}

async function readAgentProfileById(workspaceRoot: string, agentId: string): Promise<AgentProfile | undefined> {
  const path = profileFilePath(workspaceRoot, agentId);
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as AgentProfile;
    if (!parsed?.id || !parsed?.name) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
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
  const isOrchestrator = input.isOrchestrator ?? role === "orchestrator";
  const backendId = input.backendId ?? "auto";
  const modelId = input.modelId?.trim() || undefined;
  const promptMode = input.promptMode;
  const maxTurns =
    Number.isFinite(input.maxTurns) && (input.maxTurns ?? 0) > 0
      ? Math.round(input.maxTurns as number)
      : undefined;
  const maxBudgetUsd =
    Number.isFinite(input.maxBudgetUsd) && (input.maxBudgetUsd ?? 0) > 0
      ? Number(input.maxBudgetUsd)
      : undefined;
  const allowedTools = (input.allowedTools ?? []).map((item) => item.trim()).filter(Boolean);
  const additionalDirs = (input.additionalDirs ?? []).map((item) => item.trim()).filter(Boolean);
  const sessionId = input.sessionId?.trim() || undefined;
  const sessionName = input.sessionName?.trim() || undefined;
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
    isOrchestrator,
    delegatesTo: [],
    assignedSkillIds: [],
    assignedMcpServerIds: [],
    runtime: {
      kind: "cli",
      backendId,
      cwdMode: isOrchestrator ? "workspace" : "agentHome",
      modelId,
      promptMode,
      maxTurns,
      maxBudgetUsd,
      permissionMode: input.permissionMode,
      allowedTools: allowedTools.length > 0 ? allowedTools : undefined,
      codexApproval: input.codexApproval,
      codexSandbox: input.codexSandbox,
      geminiApprovalMode: input.geminiApprovalMode,
      geminiUseSandbox: input.geminiUseSandbox === true ? true : undefined,
      additionalDirs: additionalDirs.length > 0 ? additionalDirs : undefined,
      enableWebSearch: input.enableWebSearch === true ? true : undefined,
      sessionId,
      sessionName
    },
    preferredModel: modelId,
    avatar: isOrchestrator ? "🎯" : undefined
  };
  await saveAgentProfile(input.workspaceRoot, profile);
  return profile;
}

export async function applyAgentProfilePatch(input: {
  workspaceRoot: string;
  baseProfile: AgentProfile;
  patch: AgentProfilePatch;
}): Promise<AgentProfile> {
  const patchResult = agentProfilePatchSchema.safeParse(input.patch);
  if (!patchResult.success) {
    throw new Error(`Invalid agent profile patch: ${patchResult.error.issues.map((issue) => issue.message).join(", ")}`);
  }
  const patch = patchResult.data;
  const latestSaved = await readAgentProfileById(input.workspaceRoot, input.baseProfile.id);
  const baseProfile = latestSaved ?? input.baseProfile;
  const next = normalizeAgentProfile(
    {
      ...baseProfile,
      ...patch,
      runtime: patch.runtime === null ? undefined : patch.runtime ?? baseProfile.runtime,
      roleLabel: patch.roleLabel?.trim() ?? baseProfile.roleLabel,
      description: patch.description?.trim() ?? baseProfile.description,
      systemPrompt: patch.systemPrompt?.trim() ?? baseProfile.systemPrompt
    },
    {
      workspaceRoot: baseProfile.workspaceRoot,
      homeDir: baseProfile.homeDir
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
  const latestSaved = await readAgentProfileById(input.workspaceRoot, input.agent.id);
  const baseProfile = latestSaved ?? input.agent;
  const next = normalizeAgentProfile(
    {
      ...baseProfile,
      assignedSkillIds: [...(baseProfile.assignedSkillIds ?? []), input.skillId]
    },
    { workspaceRoot: baseProfile.workspaceRoot, homeDir: baseProfile.homeDir }
  );
  await saveAgentProfile(input.workspaceRoot, next);
  return next;
}

export async function unassignSkillFromAgent(input: {
  workspaceRoot: string;
  agent: AgentProfile;
  skillId: string;
}): Promise<AgentProfile> {
  const latestSaved = await readAgentProfileById(input.workspaceRoot, input.agent.id);
  const baseProfile = latestSaved ?? input.agent;
  const next = normalizeAgentProfile(
    {
      ...baseProfile,
      assignedSkillIds: (baseProfile.assignedSkillIds ?? []).filter((id) => id !== input.skillId)
    },
    { workspaceRoot: baseProfile.workspaceRoot, homeDir: baseProfile.homeDir }
  );
  await saveAgentProfile(input.workspaceRoot, next);
  return next;
}

export async function assignMcpToAgent(input: {
  workspaceRoot: string;
  agent: AgentProfile;
  mcpServerId: string;
}): Promise<AgentProfile> {
  const latestSaved = await readAgentProfileById(input.workspaceRoot, input.agent.id);
  const baseProfile = latestSaved ?? input.agent;
  const next = normalizeAgentProfile(
    {
      ...baseProfile,
      assignedMcpServerIds: [...(baseProfile.assignedMcpServerIds ?? []), input.mcpServerId]
    },
    { workspaceRoot: baseProfile.workspaceRoot, homeDir: baseProfile.homeDir }
  );
  await saveAgentProfile(input.workspaceRoot, next);
  return next;
}

export async function unassignMcpFromAgent(input: {
  workspaceRoot: string;
  agent: AgentProfile;
  mcpServerId: string;
}): Promise<AgentProfile> {
  const latestSaved = await readAgentProfileById(input.workspaceRoot, input.agent.id);
  const baseProfile = latestSaved ?? input.agent;
  const next = normalizeAgentProfile(
    {
      ...baseProfile,
      assignedMcpServerIds: (baseProfile.assignedMcpServerIds ?? []).filter((id) => id !== input.mcpServerId)
    },
    { workspaceRoot: baseProfile.workspaceRoot, homeDir: baseProfile.homeDir }
  );
  await saveAgentProfile(input.workspaceRoot, next);
  return next;
}

export async function setAgentDelegation(input: {
  workspaceRoot: string;
  agent: AgentProfile;
  workerIds: string[];
}): Promise<AgentProfile> {
  const latestSaved = await readAgentProfileById(input.workspaceRoot, input.agent.id);
  const baseProfile = latestSaved ?? input.agent;
  const next = normalizeAgentProfile(
    {
      ...baseProfile,
      delegatesTo: input.workerIds,
      isOrchestrator: true
    },
    { workspaceRoot: baseProfile.workspaceRoot, homeDir: baseProfile.homeDir }
  );
  await saveAgentProfile(input.workspaceRoot, next);
  return next;
}
