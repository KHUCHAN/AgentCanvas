import type {
  BackendModelCatalog,
  CanonicalBackendId,
  CliBackendId
} from "../messaging/protocol";

export type ModelOption = {
  id: string;
  label: string;
};

const CLAUDE_OPTIONS: ModelOption[] = [
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  { id: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5" },
  { id: "claude-opus-4-5-20251101", label: "Claude Opus 4.5" }
];

const CODEX_OPTIONS: ModelOption[] = [
  { id: "gpt-4.1", label: "GPT-4.1" },
  { id: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
  { id: "gpt-4.1-nano", label: "GPT-4.1 Nano" },
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "o3", label: "o3" },
  { id: "o3-mini", label: "o3-mini" },
  { id: "o4-mini", label: "o4-mini" },
  { id: "codex-1", label: "Codex-1" }
];

const GEMINI_OPTIONS: ModelOption[] = [
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite" },
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  { id: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash-Lite" }
];

const AIDER_OPTIONS: ModelOption[] = [
  { id: "aider-default", label: "Aider Default" }
];

const CUSTOM_OPTIONS: ModelOption[] = [
  { id: "custom-default", label: "Custom Default" }
];

export const MODEL_OPTIONS_BY_CANONICAL: Record<CanonicalBackendId, ModelOption[]> = {
  claude: CLAUDE_OPTIONS,
  codex: CODEX_OPTIONS,
  gemini: GEMINI_OPTIONS,
  aider: AIDER_OPTIONS,
  custom: CUSTOM_OPTIONS
};

export function toCanonicalBackendId(backendId: CliBackendId | CanonicalBackendId): CanonicalBackendId {
  if (backendId === "claude" || backendId === "claude-code") {
    return "claude";
  }
  if (backendId === "codex" || backendId === "codex-cli") {
    return "codex";
  }
  if (backendId === "gemini" || backendId === "gemini-cli") {
    return "gemini";
  }
  if (backendId === "aider") {
    return "aider";
  }
  return "custom";
}

export function getModelOptionsForBackend(
  backendId: CliBackendId | CanonicalBackendId,
  catalogs?: BackendModelCatalog[]
): ModelOption[] {
  const canonical = toCanonicalBackendId(backendId);
  if (catalogs && catalogs.length > 0) {
    const dynamic = catalogs.find((catalog) => catalog.backendId === canonical);
    if (dynamic && dynamic.models.length > 0) {
      return dynamic.models.map((model) => ({
        id: model.id,
        label: model.label
      }));
    }
  }
  return MODEL_OPTIONS_BY_CANONICAL[canonical];
}

export function backendDisplayNameFromId(backendId: CliBackendId | CanonicalBackendId): string {
  const canonical = toCanonicalBackendId(backendId);
  if (canonical === "claude") {
    return "Claude Code";
  }
  if (canonical === "codex") {
    return "Codex CLI";
  }
  if (canonical === "gemini") {
    return "Gemini CLI";
  }
  if (canonical === "aider") {
    return "Aider";
  }
  return "Custom CLI";
}
