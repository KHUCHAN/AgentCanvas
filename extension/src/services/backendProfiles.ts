import type {
  BackendCapabilityProfile,
  CanonicalBackendId,
  CliBackend
} from "../types";

const LEGACY_TO_CANONICAL: Partial<Record<CliBackend["id"], CanonicalBackendId>> = {
  "claude-code": "claude",
  "codex-cli": "codex",
  "gemini-cli": "gemini",
  claude: "claude",
  codex: "codex",
  gemini: "gemini",
  aider: "aider",
  custom: "custom"
};

export const BACKEND_PROFILES: BackendCapabilityProfile[] = [
  {
    backendId: "claude",
    displayName: "Claude Code",
    strengths: {
      coding: 0.95,
      review: 0.9,
      testing: 0.85,
      research: 0.7,
      writing: 0.92,
      planning: 0.93,
      multimodal: 0.8,
      toolUse: 0.95,
      longContext: 0.95,
      costEfficiency: 0.6
    },
    limitations: ["Higher API cost", "Limited provider-native integrations"],
    models: [
      // Claude Code currently exposes three selectable options.
      { id: "claude-opus-4-6", tier: "advanced", contextWindow: 200_000, costPer1MInput: 15.0, costPer1MOutput: 75.0 },
      { id: "claude-sonnet-4-6", tier: "standard", contextWindow: 200_000, costPer1MInput: 3.0, costPer1MOutput: 15.0 },
      { id: "claude-haiku-4-5-20251001", tier: "fast", contextWindow: 200_000, costPer1MInput: 0.8, costPer1MOutput: 4.0 }
    ],
    features: {
      stdinPrompt: true,
      streaming: true,
      mcpSupport: true,
      imageInput: true,
      webSearch: true,
      codeExecution: true,
      sessionResume: true
    }
  },
  {
    backendId: "codex",
    displayName: "Codex CLI",
    strengths: {
      coding: 0.92,
      review: 0.92,
      testing: 0.82,
      research: 0.76,
      writing: 0.78,
      planning: 0.84,
      multimodal: 0.86,
      toolUse: 0.78,
      longContext: 0.82,
      costEfficiency: 0.76
    },
    limitations: ["Cloud-run usage can incur extra costs", "Plugin ecosystem is limited"],
    models: [
      // GPT-5 Codex family (from /model CLI output — latest first)
      { id: "gpt-5.3-codex", tier: "advanced", contextWindow: 1_000_000, costPer1MInput: 5.0, costPer1MOutput: 20.0 },
      { id: "gpt-5.3-codex-spark", tier: "fast", contextWindow: 200_000, costPer1MInput: 0.5, costPer1MOutput: 2.0 },
      { id: "gpt-5.2-codex", tier: "standard", contextWindow: 200_000, costPer1MInput: 2.0, costPer1MOutput: 8.0 },
      { id: "gpt-5.1-codex-max", tier: "advanced", contextWindow: 1_000_000, costPer1MInput: 10.0, costPer1MOutput: 40.0 },
      { id: "gpt-5.2", tier: "standard", contextWindow: 200_000, costPer1MInput: 2.0, costPer1MOutput: 8.0 },
      { id: "gpt-5.1-codex-mini", tier: "fast", contextWindow: 200_000, costPer1MInput: 0.4, costPer1MOutput: 1.6 },
      // Fallback GPT-4 era models
      { id: "gpt-4.1", tier: "standard", contextWindow: 200_000, costPer1MInput: 2.0, costPer1MOutput: 8.0 },
      { id: "gpt-4o", tier: "standard", contextWindow: 200_000, costPer1MInput: 2.5, costPer1MOutput: 10.0 },
      { id: "o3", tier: "advanced", contextWindow: 200_000, costPer1MInput: 10.0, costPer1MOutput: 40.0 }
    ],
    features: {
      stdinPrompt: true,
      streaming: true,
      mcpSupport: true,
      imageInput: true,
      webSearch: true,
      codeExecution: true,
      sessionResume: true
    }
  },
  {
    backendId: "gemini",
    displayName: "Gemini CLI",
    strengths: {
      coding: 0.88,
      review: 0.82,
      testing: 0.78,
      research: 0.95,
      writing: 0.85,
      planning: 0.8,
      multimodal: 0.9,
      toolUse: 0.82,
      longContext: 0.9,
      costEfficiency: 0.9
    },
    limitations: ["Can be weaker at deep refactoring consistency"],
    models: [
      // Gemini 3 family (from /model CLI output — latest first)
      { id: "gemini-3-pro-preview", tier: "advanced", contextWindow: 2_000_000, costPer1MInput: 2.5, costPer1MOutput: 15.0 },
      { id: "gemini-3-flash-preview", tier: "standard", contextWindow: 1_000_000, costPer1MInput: 0.3, costPer1MOutput: 1.2 },
      // Gemini 2.5 family
      { id: "gemini-2.5-pro", tier: "advanced", contextWindow: 1_000_000, costPer1MInput: 1.25, costPer1MOutput: 10.0 },
      { id: "gemini-2.5-flash", tier: "standard", contextWindow: 1_000_000, costPer1MInput: 0.15, costPer1MOutput: 0.6 },
      { id: "gemini-2.5-flash-lite", tier: "fast", contextWindow: 1_000_000, costPer1MInput: 0.075, costPer1MOutput: 0.3 }
    ],
    features: {
      stdinPrompt: true,
      streaming: true,
      mcpSupport: true,
      imageInput: true,
      webSearch: true,
      codeExecution: true,
      sessionResume: true
    }
  },
  {
    backendId: "aider",
    displayName: "Aider",
    strengths: {
      coding: 0.8,
      review: 0.74,
      testing: 0.72,
      research: 0.5,
      writing: 0.5,
      planning: 0.58,
      multimodal: 0.3,
      toolUse: 0.55,
      longContext: 0.5,
      costEfficiency: 0.75
    },
    limitations: ["Model support depends on external API configuration"],
    models: [
      { id: "aider-default", tier: "standard", contextWindow: 128_000, costPer1MInput: 0, costPer1MOutput: 0 }
    ],
    features: {
      stdinPrompt: false,
      streaming: false,
      mcpSupport: false,
      imageInput: false,
      webSearch: false,
      codeExecution: true,
      sessionResume: false
    }
  },
  {
    backendId: "custom",
    displayName: "Custom CLI",
    strengths: {
      coding: 0.6,
      review: 0.6,
      testing: 0.6,
      research: 0.6,
      writing: 0.6,
      planning: 0.6,
      multimodal: 0.5,
      toolUse: 0.5,
      longContext: 0.6,
      costEfficiency: 0.6
    },
    limitations: ["Capability is unknown until configured by user"],
    models: [
      { id: "custom-default", tier: "standard", contextWindow: 128_000, costPer1MInput: 0, costPer1MOutput: 0 }
    ],
    features: {
      stdinPrompt: true,
      streaming: false,
      mcpSupport: false,
      imageInput: false,
      webSearch: false,
      codeExecution: true,
      sessionResume: false
    }
  }
];

export function normalizeBackendId(backendId: CliBackend["id"]): CanonicalBackendId | undefined {
  return LEGACY_TO_CANONICAL[backendId];
}

export function getBackendProfile(backendId: CanonicalBackendId): BackendCapabilityProfile {
  const profile = BACKEND_PROFILES.find((item) => item.backendId === backendId);
  if (!profile) {
    throw new Error(`Unknown backend capability profile: ${backendId}`);
  }
  return profile;
}

export function listAvailableCanonicalBackends(backends: CliBackend[]): CanonicalBackendId[] {
  const result: CanonicalBackendId[] = [];
  const seen = new Set<CanonicalBackendId>();
  for (const backend of backends) {
    const canonical = normalizeBackendId(backend.id);
    if (!canonical || !backend.available || seen.has(canonical)) {
      continue;
    }
    seen.add(canonical);
    result.push(canonical);
  }
  return result;
}
