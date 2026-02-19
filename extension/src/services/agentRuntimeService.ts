import type { AgentProfile } from "../types";

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
