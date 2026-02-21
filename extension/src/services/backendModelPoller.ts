import type {
  BackendModelCatalog,
  CanonicalBackendId,
  CliBackend
} from "../types";
import { BACKEND_PROFILES, normalizeBackendId } from "./backendProfiles";

const CACHE_TTL_MS = 5 * 60 * 1000;
const ORDER: CanonicalBackendId[] = ["claude", "codex", "gemini", "aider", "custom"];

let cache:
  | {
    expiresAt: number;
    catalogs: BackendModelCatalog[];
  }
  | undefined;

/**
 * Static-only model catalog resolver.
 * Dynamic CLI probing is intentionally disabled.
 */
export async function fetchBackendModelCatalogs(backends: CliBackend[]): Promise<BackendModelCatalog[]> {
  if (cache && cache.expiresAt > Date.now()) {
    return cache.catalogs;
  }

  const backendByCanonical = new Map<CanonicalBackendId, CliBackend>();
  for (const backend of backends) {
    const canonical = normalizeBackendId(backend.id);
    if (!canonical || !backend.available || backendByCanonical.has(canonical)) {
      continue;
    }
    backendByCanonical.set(canonical, backend);
  }

  const catalogs: BackendModelCatalog[] = [];
  for (const backendId of ORDER) {
    const backend = backendByCanonical.get(backendId);
    if (!backend) {
      continue;
    }
    const fallback = BACKEND_PROFILES
      .find((profile) => profile.backendId === backendId)
      ?.models.map((model) => ({
        id: model.id,
        label: model.id,
        tier: model.tier
      })) ?? [];

    catalogs.push({
      backendId,
      models: fallback,
      fetchedAt: Date.now(),
      source: "fallback"
    });
  }

  cache = {
    expiresAt: Date.now() + CACHE_TTL_MS,
    catalogs
  };
  return catalogs;
}

export function invalidateBackendModelCatalogCache(): void {
  cache = undefined;
}
