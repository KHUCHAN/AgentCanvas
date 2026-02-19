import { mkdirSync, watch, type FSWatcher } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { CacheConfig } from "../types";

const CONFIG_DIR = ".agentcanvas";
const CONFIG_FILE = "config.json";

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  retention: "long",
  contextPruning: {
    mode: "cache-ttl",
    ttlSeconds: 3600
  },
  diagnostics: {
    enabled: false,
    logPath: ".agentcanvas/logs/cache-trace.jsonl"
  },
  modelRouting: {
    heartbeat: "haiku-4.5",
    cron: "haiku-4.5",
    default: "sonnet-4.5"
  },
  contextThreshold: 180_000
};

export type Disposable = {
  dispose: () => void;
};

export function getConfigPath(workspaceRoot: string): string {
  return join(workspaceRoot, CONFIG_DIR, CONFIG_FILE);
}

export async function loadConfig(workspaceRoot: string): Promise<CacheConfig> {
  const path = getConfigPath(workspaceRoot);
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<CacheConfig>;
    return normalizeCacheConfig(parsed);
  } catch {
    return normalizeCacheConfig(undefined);
  }
}

export async function saveConfig(workspaceRoot: string, config: CacheConfig): Promise<void> {
  const path = getConfigPath(workspaceRoot);
  await mkdir(dirname(path), { recursive: true });
  const normalized = normalizeCacheConfig(config);
  await writeFile(path, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
}

export function watchConfig(
  workspaceRoot: string,
  onChange: (config: CacheConfig) => void
): Disposable {
  const configPath = getConfigPath(workspaceRoot);
  const configDir = dirname(configPath);
  mkdirSync(configDir, { recursive: true });

  let watcher: FSWatcher | undefined;
  try {
    watcher = watch(configDir, (eventType, fileName) => {
      if (!fileName || String(fileName) !== CONFIG_FILE) {
        return;
      }
      if (eventType !== "change" && eventType !== "rename") {
        return;
      }
      void loadConfig(workspaceRoot)
        .then((config) => onChange(config))
        .catch((error) => {
          console.warn("[AgentCanvas] Failed to reload config", error);
        });
    });
  } catch {
    console.warn("[AgentCanvas] Config watcher is unavailable for", configDir);
    watcher = undefined;
  }

  return {
    dispose: () => {
      watcher?.close();
    }
  };
}

function normalizeCacheConfig(input: Partial<CacheConfig> | undefined): CacheConfig {
  const retention = input?.retention === "short" ? "short" : "long";
  const ttl = toInteger(input?.contextPruning?.ttlSeconds, 3600, 30, 86_400);
  const threshold = toInteger(input?.contextThreshold, 180_000, 10_000, 1_500_000);

  return {
    retention,
    contextPruning: {
      mode: "cache-ttl",
      ttlSeconds: ttl
    },
    diagnostics: {
      enabled: Boolean(input?.diagnostics?.enabled),
      logPath:
        (input?.diagnostics?.logPath?.trim() || DEFAULT_CACHE_CONFIG.diagnostics.logPath)
    },
    modelRouting: {
      heartbeat: normalizeModel(input?.modelRouting?.heartbeat, DEFAULT_CACHE_CONFIG.modelRouting.heartbeat),
      cron: normalizeModel(input?.modelRouting?.cron, DEFAULT_CACHE_CONFIG.modelRouting.cron),
      default: normalizeModel(input?.modelRouting?.default, DEFAULT_CACHE_CONFIG.modelRouting.default)
    },
    contextThreshold: threshold
  };
}

function toInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.round(number)));
}

function normalizeModel(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed || fallback;
}
