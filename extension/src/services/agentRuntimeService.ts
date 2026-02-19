import type { AgentProfile, CliBackendId } from "../types";

const LEGACY_TO_CANONICAL: Partial<Record<CliBackendId, CliBackendId>> = {
  "claude-code": "claude",
  "gemini-cli": "gemini",
  "codex-cli": "codex"
};

export type ResolvedAgentRuntime = {
  runtimeKind: "workspace-default" | "cli" | "openclaw";
  cwd: string;
  backendId?: CliBackendId;
  modelId?: string;
  gatewayUrl?: string;
  agentKey?: string;
};

export function resolveAgentCwd(
  agent: AgentProfile | undefined,
  workspaceRoot: string,
  agentHomeOverride?: string
): string {
  if (!agent) {
    return workspaceRoot;
  }
  const runtime = agent.runtime;
  if (runtime?.kind === "cli" && runtime.cwdMode === "agentHome") {
    return agentHomeOverride ?? agent.homeDir;
  }
  return workspaceRoot;
}

export function normalizeCliBackendId(backendId: CliBackendId | undefined): CliBackendId | undefined {
  if (!backendId) {
    return undefined;
  }
  return LEGACY_TO_CANONICAL[backendId] ?? backendId;
}

export function resolveAgentRuntime(input: {
  agent: AgentProfile | undefined;
  workspaceRoot: string;
  requestedBackendId?: CliBackendId;
  agentHomeOverride?: string;
}): ResolvedAgentRuntime {
  const cwd = resolveAgentCwd(input.agent, input.workspaceRoot, input.agentHomeOverride);
  const agent = input.agent;
  const requestedBackendId = normalizeCliBackendId(input.requestedBackendId);

  if (!agent?.runtime) {
    return {
      runtimeKind: "workspace-default",
      cwd,
      backendId: requestedBackendId
    };
  }

  if (agent.runtime.kind === "openclaw") {
    return {
      runtimeKind: "openclaw",
      cwd,
      backendId: "custom",
      modelId: agent.preferredModel,
      gatewayUrl: agent.runtime.gatewayUrl,
      agentKey: agent.runtime.agentKey
    };
  }

  const runtimeBackendId = normalizeCliBackendId(agent.runtime.backendId);
  const backendId = requestedBackendId && requestedBackendId !== "auto"
    ? requestedBackendId
    : runtimeBackendId;

  return {
    runtimeKind: "cli",
    cwd,
    backendId,
    modelId: agent.preferredModel ?? agent.runtime.modelId
  };
}
