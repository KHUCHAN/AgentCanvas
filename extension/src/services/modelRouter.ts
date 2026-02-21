import type { AgentProfile, CacheConfig, CanonicalBackendId } from "../types";

const BACKEND_DEFAULT_MODELS: Record<CanonicalBackendId, string> = {
  claude: "claude-sonnet-4-6",
  codex: "gpt-5.3-codex",
  gemini: "gemini-3-flash-preview",
  aider: "",
  custom: ""
};

export function resolveModel(input: {
  agent: AgentProfile | undefined;
  taskType: "generation" | "execution" | "heartbeat" | "cron";
  config: CacheConfig;
  backendFamily?: string;
}): string {
  // Resolve backend family early so we can validate model compatibility.
  const runtimeBackend =
    input.agent?.runtime?.kind === "cli" ? normalizeBackendFamily(input.agent.runtime.backendId) : undefined;
  const backendFamily = normalizeBackendFamily(input.backendFamily) ?? runtimeBackend;

  // Only use preferredModel if it is compatible with the execution backend.
  // This prevents e.g. "gemini-2.5-flash" from being sent to Claude/Codex CLI.
  const preferred = input.agent?.preferredModel?.trim();
  if (preferred && isModelCompatibleWithBackend(preferred, backendFamily)) {
    return preferred;
  }

  const runtimeModel =
    input.agent?.runtime?.kind === "cli"
      ? input.agent.runtime.modelId?.trim()
      : undefined;
  if (runtimeModel && isModelCompatibleWithBackend(runtimeModel, backendFamily)) {
    return runtimeModel;
  }

  if (input.taskType === "heartbeat") {
    return input.config.modelRouting.heartbeat;
  }
  if (input.taskType === "cron") {
    return input.config.modelRouting.cron;
  }

  if (backendFamily) {
    const backendDefault = BACKEND_DEFAULT_MODELS[backendFamily];
    if (backendDefault) {
      return backendDefault;
    }
  }

  return input.config.modelRouting.default;
}

/**
 * Returns true when modelId is a known alias for the given backend family.
 * If backendFamily is unknown/undefined, any model is allowed.
 */
function isModelCompatibleWithBackend(modelId: string, backendFamily: CanonicalBackendId | undefined): boolean {
  if (!backendFamily) {
    return true;
  }
  const lower = modelId.toLowerCase();
  if (backendFamily === "claude") {
    return lower.startsWith("claude-");
  }
  if (backendFamily === "codex") {
    return lower.startsWith("gpt-") || /^o\d/i.test(lower) || lower.startsWith("codex-");
  }
  if (backendFamily === "gemini") {
    return lower.startsWith("gemini-");
  }
  // aider / custom — no model-id restrictions
  return true;
}

function normalizeBackendFamily(backendId: unknown): CanonicalBackendId | undefined {
  if (typeof backendId !== "string") {
    return undefined;
  }
  const value = backendId.trim().toLowerCase();
  if (value === "claude" || value === "claude-code") {
    return "claude";
  }
  if (value === "codex" || value === "codex-cli") {
    return "codex";
  }
  if (value === "gemini" || value === "gemini-cli") {
    return "gemini";
  }
  if (value === "aider") {
    return "aider";
  }
  if (value === "custom") {
    return "custom";
  }
  return undefined;
}
