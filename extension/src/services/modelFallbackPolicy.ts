import type { CliBackend } from "../types";
import { normalizeBackendId } from "./backendProfiles";

const GEMINI_FALLBACK_CHAIN = [
  "gemini-3-pro-preview",
  "gemini-3-flash-preview",
  "gemini-2.5-flash-lite"
] as const;

export function resolveFallbackModelIdsForBackend(input: {
  backendId: CliBackend["id"];
  primaryModelId?: string;
  maxFallbacks: number;
}): string[] {
  if (input.maxFallbacks <= 0) {
    return [];
  }
  const backend = normalizeBackendId(input.backendId);
  if (backend !== "gemini") {
    return [];
  }

  const primary = normalizeModelId(input.primaryModelId);
  const chain = [...GEMINI_FALLBACK_CHAIN];
  const normalizedPrimary = primary?.toLowerCase();
  const matchedIndex = normalizedPrimary
    ? chain.findIndex((modelId) => modelId.toLowerCase() === normalizedPrimary)
    : -1;
  const ordered = matchedIndex >= 0 ? chain.slice(matchedIndex + 1) : chain;

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const modelId of ordered) {
    const normalized = modelId.toLowerCase();
    if (normalizedPrimary && normalized === normalizedPrimary) {
      continue;
    }
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    unique.push(modelId);
    if (unique.length >= input.maxFallbacks) {
      break;
    }
  }
  return unique;
}

function normalizeModelId(modelId?: string): string | undefined {
  const trimmed = modelId?.trim();
  return trimmed ? trimmed : undefined;
}
