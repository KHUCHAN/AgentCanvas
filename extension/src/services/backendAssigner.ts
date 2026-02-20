import type {
  BackendCapabilityProfile,
  BackendUsageSummary,
  CanonicalBackendId,
  GeneratedAgent,
  WorkCategory,
  WorkIntentAnalysis
} from "../types";
import { AFFINITY_MATRIX } from "./workIntentAnalyzer";

export function assignBackends(input: {
  agents: GeneratedAgent[];
  workIntent: WorkIntentAnalysis;
  usageSummaries: BackendUsageSummary[];
  profiles: BackendCapabilityProfile[];
  availableBackends: CanonicalBackendId[];
  preferredBackends?: CanonicalBackendId[];
  budgetConstraint?: "strict" | "soft";
  manualBackend?: CanonicalBackendId;
}): GeneratedAgent[] {
  const available = dedupeBackends(input.availableBackends);
  const preferred = dedupeBackends(input.preferredBackends ?? []);
  const defaultCandidates: CanonicalBackendId[] = ["claude", "codex", "gemini"];

  if (input.manualBackend) {
    const fixed = available.includes(input.manualBackend)
      ? input.manualBackend
      : available[0] ?? input.manualBackend;
    return input.agents.map((agent) => applyAssignment(agent, fixed, input.profiles, {
      affinity: computeAffinity(agent, input.workIntent),
      availability: readAvailability(fixed, input.usageSummaries),
      costEfficiency: readCostEfficiency(fixed, input.profiles)
    }, "manual selection"));
  }

  const budgetConstraint = input.budgetConstraint ?? "soft";

  return input.agents.map((agent) => {
    const candidates: CanonicalBackendId[] = available.length > 0 ? available : defaultCandidates;
    let best: {
      backendId: CanonicalBackendId;
      score: number;
      affinity: number;
      availability: number;
      costEfficiency: number;
    } | undefined;

    for (const backendId of candidates) {
      const affinity = computeAffinity(agent, input.workIntent, backendId);
      const availability = readAvailability(backendId, input.usageSummaries);
      const costEfficiency = readCostEfficiency(backendId, input.profiles);
      const overBudget = availability <= 0.01;
      if (budgetConstraint === "strict" && overBudget) {
        continue;
      }

      const preferredBoost = preferred.includes(backendId) ? 0.05 : 0;
      const score = affinity * 0.4 + availability * 0.35 + costEfficiency * 0.25 + preferredBoost;
      if (!best || score > best.score) {
        best = { backendId, score, affinity, availability, costEfficiency };
      }
    }

    const fallbackBackend = candidates[0] ?? "claude";
    const fallback = best ?? {
      backendId: fallbackBackend,
      score: 0,
      affinity: computeAffinity(agent, input.workIntent, fallbackBackend),
      availability: readAvailability(fallbackBackend, input.usageSummaries),
      costEfficiency: readCostEfficiency(fallbackBackend, input.profiles)
    };

    return applyAssignment(agent, fallback.backendId, input.profiles, fallback);
  });
}

function applyAssignment(
  agent: GeneratedAgent,
  backendId: CanonicalBackendId,
  profiles: BackendCapabilityProfile[],
  score: { affinity: number; availability: number; costEfficiency: number },
  reasonPrefix?: string
): GeneratedAgent {
  const model = pickModel(agent.role, backendId, profiles);
  const computedReason = `${reasonPrefix ? `${reasonPrefix}; ` : ""}A ${score.affinity.toFixed(2)} · Av ${score.availability.toFixed(2)} · C ${score.costEfficiency.toFixed(2)}`;
  return {
    ...agent,
    assignedBackend: backendId,
    assignedModel: model,
    backendAssignReason: computedReason
  };
}

function computeAffinity(
  agent: GeneratedAgent,
  intent: WorkIntentAnalysis,
  backendId?: CanonicalBackendId
): number {
  const primaryCategory = roleToCategory(agent.role, intent.primaryCategory);
  const matrix = AFFINITY_MATRIX[primaryCategory];
  const targetBackend = (backendId === "claude" || backendId === "codex" || backendId === "gemini")
    ? backendId
    : "claude";
  const base = matrix[targetBackend] ?? 0.78;

  // Secondary categories adjust affinity mildly.
  let secondaryBlend = 0;
  for (const secondary of intent.secondaryCategories.slice(0, 2)) {
    const secondaryMatrix = AFFINITY_MATRIX[secondary];
    secondaryBlend += (secondaryMatrix?.[targetBackend] ?? base) * 0.08;
  }
  return clamp(base + secondaryBlend, 0, 1);
}

function roleToCategory(role: GeneratedAgent["role"], primary: WorkCategory): WorkCategory {
  if (role === "reviewer") {
    return "code_review";
  }
  if (role === "tester") {
    return "testing";
  }
  if (role === "researcher") {
    return "research";
  }
  if (role === "writer") {
    return "documentation";
  }
  if (role === "planner" || role === "orchestrator") {
    return primary === "mixed" ? "full_stack" : primary;
  }
  return primary;
}

function pickModel(
  role: GeneratedAgent["role"],
  backendId: CanonicalBackendId,
  profiles: BackendCapabilityProfile[]
): string | undefined {
  const profile = profiles.find((item) => item.backendId === backendId);
  if (!profile || profile.models.length === 0) {
    return undefined;
  }
  if (backendId === "claude") {
    if (role === "orchestrator" || role === "planner" || role === "reviewer") {
      return profile.models.find((model) => model.id === "sonnet-4.5")?.id ?? profile.models[0].id;
    }
    return profile.models.find((model) => model.tier === "fast")?.id ?? profile.models[0].id;
  }
  if (backendId === "codex") {
    if (role === "coder" || role === "tester") {
      return profile.models.find((model) => model.id === "o3-mini")?.id ?? profile.models[0].id;
    }
    return profile.models.find((model) => model.id === "codex-1")?.id ?? profile.models[0].id;
  }
  if (backendId === "gemini") {
    if (role === "researcher" || role === "writer") {
      return profile.models.find((model) => model.id === "gemini-2.5-flash")?.id ?? profile.models[0].id;
    }
    return profile.models.find((model) => model.id === "gemini-2.5-pro")?.id ?? profile.models[0].id;
  }
  return profile.models[0].id;
}

function readAvailability(
  backendId: CanonicalBackendId,
  usageSummaries: BackendUsageSummary[]
): number {
  const summary = usageSummaries.find((item) => item.backendId === backendId);
  if (!summary) {
    return 1;
  }
  return clamp(summary.availabilityScore, 0, 1);
}

function readCostEfficiency(
  backendId: CanonicalBackendId,
  profiles: BackendCapabilityProfile[]
): number {
  const profile = profiles.find((item) => item.backendId === backendId);
  if (!profile) {
    return 0.6;
  }
  return clamp(profile.strengths.costEfficiency, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function dedupeBackends(backends: CanonicalBackendId[]): CanonicalBackendId[] {
  return [...new Set(backends)];
}
