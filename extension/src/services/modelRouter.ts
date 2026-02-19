import type { AgentProfile, CacheConfig } from "../types";

export function resolveModel(input: {
  agent: AgentProfile | undefined;
  taskType: "generation" | "execution" | "heartbeat" | "cron";
  config: CacheConfig;
}): string {
  const preferred = input.agent?.preferredModel?.trim();
  if (preferred) {
    return preferred;
  }

  const runtimeModel =
    input.agent?.runtime?.kind === "cli"
      ? input.agent.runtime.modelId?.trim()
      : undefined;
  if (runtimeModel) {
    return runtimeModel;
  }

  if (input.taskType === "heartbeat") {
    return input.config.modelRouting.heartbeat;
  }
  if (input.taskType === "cron") {
    return input.config.modelRouting.cron;
  }
  return input.config.modelRouting.default;
}

