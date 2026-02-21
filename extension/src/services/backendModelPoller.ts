import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import type {
  BackendModelCatalog,
  CanonicalBackendId,
  CliBackend
} from "../types";
import { BACKEND_PROFILES, normalizeBackendId } from "./backendProfiles";

const execFileAsync = promisify(execFile);
const CACHE_TTL_MS = 5 * 60 * 1000;
const ORDER: CanonicalBackendId[] = ["claude", "codex", "gemini", "aider", "custom"];
const GEMINI_STATIC_MODELS = [
  // Gemini 3 (from /model CLI — latest first)
  "gemini-3-pro",
  "gemini-3-flash",
  // Gemini 2.5
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  // Gemini 2.0
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite"
];

let cache:
  | {
    expiresAt: number;
    catalogs: BackendModelCatalog[];
  }
  | undefined;

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
    const dynamic = await fetchDynamicModelList(backend, backendId);
    const fallback = BACKEND_PROFILES
      .find((profile) => profile.backendId === backendId)
      ?.models.map((model) => ({
        id: model.id,
        label: model.id,
        tier: model.tier
      })) ?? [];

    const merged = mergeModelOptions(dynamic, fallback);
    catalogs.push({
      backendId,
      models: merged.length > 0 ? merged : fallback,
      fetchedAt: Date.now(),
      source: dynamic.length > 0 ? "dynamic" : "fallback"
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

/**
 * Pre-populate the model catalog cache with externally-probed results
 * (e.g. from backendProbeService). Existing cache is replaced immediately.
 * Only catalogs with at least one model are inserted; backends with empty
 * probe results fall through to the normal dynamic-fetch path.
 */
export function populateModelCatalogCache(probedCatalogs: BackendModelCatalog[]): void {
  const nonEmptyCatalogs = probedCatalogs.filter((c) => c.models.length > 0);
  if (nonEmptyCatalogs.length === 0) {
    return;
  }
  // Merge with existing cache entries so backends not covered by the probe
  // (e.g. aider, custom) keep their previously cached catalogs.
  const existing = cache?.catalogs ?? [];
  const existingById = new Map(existing.map((c) => [c.backendId, c]));
  for (const c of nonEmptyCatalogs) {
    existingById.set(c.backendId, c);
  }
  cache = {
    expiresAt: Date.now() + CACHE_TTL_MS,
    catalogs: [...existingById.values()]
  };
}

async function fetchDynamicModelList(
  backend: CliBackend,
  backendId: CanonicalBackendId
): Promise<BackendModelCatalog["models"]> {
  if (backendId === "gemini") {
    const geminiPattern = /(gemini-[a-z0-9.-]+)/gi;
    // Try stdin /model probe first
    const stdinModels = await tryStdinModelProbe(backend.command, geminiPattern);
    if (stdinModels.length > 0) {
      return stdinModels.map((id) => ({ id, label: id }));
    }
    const models = await resolveModelsFromCommandAttempts(
      backend.command,
      [
        ["--list-models"],
        ["models", "list", "--json"],
        ["models", "list"]
      ],
      geminiPattern
    );
    if (models.length > 0) {
      return models.map((id) => ({ id, label: id }));
    }
    return GEMINI_STATIC_MODELS.map((id) => ({ id, label: id }));
  }

  if (backendId === "aider") {
    const models = await resolveModelsFromCommandAttempts(
      backend.command,
      [["--list-models"]],
      /(gpt-[\w.-]+|claude-[\w.-]+|gemini-[\w.-]+|o[134][\w.-]*)/gi
    );
    if (models.length > 0) {
      return models.map((id) => ({ id, label: id }));
    }
  }

  if (backendId === "claude" || backendId === "codex") {
    const regex =
      backendId === "claude"
        ? /(claude-[a-z0-9.-]+)/gi
        : /(gpt-[\w.-]+|o[134][\w.-]*|codex-[\w.-]+)/gi;
    // Try stdin /model probe first
    const stdinModels = await tryStdinModelProbe(backend.command, regex);
    if (stdinModels.length > 0) {
      return stdinModels.map((id) => ({ id, label: id }));
    }
    const attempts = backendId === "claude"
      ? [
          ["--list-models", "--json"],
          ["--list-models"],
          ["models", "list", "--json"],
          ["models", "list"]
        ]
      : [
          ["models", "list", "--json"],
          ["models", "list"],
          ["--list-models", "--json"],
          ["--list-models"]
        ];
    const models = await resolveModelsFromCommandAttempts(backend.command, attempts, regex);
    if (models.length > 0) {
      return models.map((id) => ({ id, label: id }));
    }
  }

  return [];
}

async function tryStdinModelProbe(command: string, pattern: RegExp): Promise<string[]> {
  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn> | undefined;
    const timer = setTimeout(() => {
      try { child?.kill(); } catch { /* ignore */ }
      resolve([]);
    }, 8_000);

    try {
      child = spawn(command, [], {
        stdio: "pipe",
        env: { ...process.env, NO_COLOR: "1" },
        shell: false
      });
    } catch {
      clearTimeout(timer);
      resolve([]);
      return;
    }

    let output = "";
    child.stdout?.on("data", (chunk: Buffer) => { output += chunk.toString(); });
    child.stderr?.on("data", (chunk: Buffer) => { output += chunk.toString(); });

    child.on("error", () => {
      clearTimeout(timer);
      resolve([]);
    });

    child.on("close", () => {
      clearTimeout(timer);
      resolve(extractModelIds(output, pattern));
    });

    try {
      child.stdin?.write("/model\n");
      child.stdin?.end();
    } catch {
      clearTimeout(timer);
      try { child.kill(); } catch { /* ignore */ }
      resolve([]);
    }
  });
}

async function tryExec(command: string, args: string[]): Promise<string | undefined> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      timeout: 10_000,
      maxBuffer: 512 * 1024,
      env: { ...process.env, NO_COLOR: "1" }
    });
    const merged = `${stdout}\n${stderr}`.trim();
    return merged || undefined;
  } catch {
    return undefined;
  }
}

function extractModelIds(raw: string, pattern: RegExp): string[] {
  const stripped = raw.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
  const matches = stripped.match(pattern) ?? [];
  return [...new Set(matches.map((model) => model.trim()).filter(Boolean))];
}

async function resolveModelsFromCommandAttempts(
  command: string,
  attempts: string[][],
  fallbackPattern: RegExp
): Promise<string[]> {
  for (const args of attempts) {
    const raw = await tryExec(command, args);
    if (!raw) {
      continue;
    }
    const fromJson = extractModelIdsFromJson(raw);
    if (fromJson.length > 0) {
      return fromJson;
    }
    const fromText = extractModelIds(raw, fallbackPattern);
    if (fromText.length > 0) {
      return fromText;
    }
  }
  return [];
}

function extractModelIdsFromJson(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return normalizeModelIds(collectModelIds(parsed));
  } catch {
    return [];
  }
}

function collectModelIds(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectModelIds(entry));
  }
  if (!value || typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;
  if (Array.isArray(record.models)) {
    return record.models.flatMap((entry) => collectModelIds(entry));
  }

  const candidates = [
    record.id,
    record.model,
    record.modelId,
    record.name
  ];
  const collected = candidates
    .map((candidate) => (typeof candidate === "string" ? candidate : undefined))
    .filter((candidate): candidate is string => Boolean(candidate));
  if (collected.length > 0) {
    return collected;
  }

  return Object.values(record).flatMap((entry) => collectModelIds(entry));
}

function normalizeModelIds(candidates: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (!trimmed || trimmed.length > 120) {
      continue;
    }
    if (!/^[a-z0-9._-]+$/i.test(trimmed)) {
      continue;
    }
    const looksLikeModelId = trimmed.includes("-") || /^o\d/i.test(trimmed);
    if (!looksLikeModelId) {
      continue;
    }
    if (seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized;
}

function mergeModelOptions(
  dynamic: BackendModelCatalog["models"],
  fallback: BackendModelCatalog["models"]
): BackendModelCatalog["models"] {
  // When the CLI probe confirms actual available models, use ONLY those.
  // Mixing in fallback (static) models risks sending requests to models
  // the user doesn't have access to, which causes CLI errors.
  if (dynamic.length > 0) {
    const fallbackById = new Map(fallback.map((m) => [m.id, m]));
    return dynamic.map((m) => {
      const fb = fallbackById.get(m.id);
      return {
        id: m.id,
        label: m.label || fb?.label || m.id,
        tier: m.tier ?? fb?.tier
      };
    });
  }
  // No probe results — fall back to static profile list
  return [...fallback];
}
