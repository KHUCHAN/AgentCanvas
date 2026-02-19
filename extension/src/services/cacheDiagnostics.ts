import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { CacheConfig, UsageMetrics } from "../types";
import { calculateUsageCost } from "./costCalculator";

export async function logCacheEvent(input: {
  workspaceRoot: string;
  flowName: string;
  runId: string;
  nodeId?: string;
  usage: UsageMetrics | undefined;
  model: string;
  config: CacheConfig;
}): Promise<void> {
  if (!input.config.diagnostics.enabled) {
    return;
  }

  const relativeLogPath = input.config.diagnostics.logPath?.trim() || ".agentcanvas/logs/cache-trace.jsonl";
  const logPath = join(input.workspaceRoot, relativeLogPath);
  await mkdir(dirname(logPath), { recursive: true });

  const costs = calculateUsageCost(input.usage, input.model);
  const row = {
    ts: new Date().toISOString(),
    flowName: input.flowName,
    runId: input.runId,
    nodeId: input.nodeId,
    model: costs.model,
    cacheRead: normalizeTokenCount(input.usage?.cacheRead),
    cacheWrite: normalizeTokenCount(input.usage?.cacheWrite),
    inputTokens: normalizeTokenCount(input.usage?.inputTokens),
    outputTokens: normalizeTokenCount(input.usage?.outputTokens),
    cost: input.usage?.cost ?? costs.cost,
    savedCost: input.usage?.savedCost ?? costs.savedCost
  };

  await appendFile(logPath, `${JSON.stringify(row)}\n`, "utf8");
}

function normalizeTokenCount(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }
  return Math.floor(number);
}

