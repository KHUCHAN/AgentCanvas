import { readFileSync } from "node:fs";
import type { UsageMetrics } from "../types";

type PricingEntry = {
  input: number;
  cacheWrite: number;
  cacheRead: number;
  output: number;
};

const DEFAULT_MODEL = "sonnet-4.5";

const DEFAULT_PRICING: Record<string, PricingEntry> = {
  "sonnet-4.5": { input: 3.0, cacheWrite: 3.75, cacheRead: 0.3, output: 15.0 },
  "haiku-4.5": { input: 0.8, cacheWrite: 1.0, cacheRead: 0.08, output: 4.0 },
  "opus-4.5": { input: 15.0, cacheWrite: 18.75, cacheRead: 1.5, output: 75.0 },
  // Codex / OpenAI pricing
  "o3-mini": { input: 1.1, cacheWrite: 0, cacheRead: 0, output: 4.4 },
  "o3": { input: 10.0, cacheWrite: 0, cacheRead: 0, output: 40.0 },
  "codex-1": { input: 5.0, cacheWrite: 0, cacheRead: 0, output: 20.0 },
  // Gemini pricing
  "gemini-2.5-flash": { input: 0.15, cacheWrite: 0.0375, cacheRead: 0.015, output: 0.6 },
  "gemini-2.5-pro": { input: 1.25, cacheWrite: 0.3125, cacheRead: 0.125, output: 10.0 }
};
const PRICING = loadPricingTable();

export function resolvePricingModel(modelId?: string): string {
  if (!modelId) {
    return DEFAULT_MODEL;
  }
  if (PRICING[modelId]) {
    return modelId;
  }
  const lower = modelId.toLowerCase();
  if (lower.includes("gemini")) {
    return "gemini-2.5-flash";
  }
  if (lower.includes("codex")) {
    return "codex-1";
  }
  if (lower.includes("o3-mini")) {
    return "o3-mini";
  }
  if (lower === "o3") {
    return "o3";
  }
  return DEFAULT_MODEL;
}

export function calculateUsageCost(
  usage: UsageMetrics | undefined,
  modelHint?: string
): {
  model: string;
  cost: number;
  savedCost: number;
} {
  const model = resolvePricingModel(usage?.model ?? modelHint);
  const pricing = PRICING[model];
  const inputTokens = normalizeTokenCount(usage?.inputTokens);
  const outputTokens = normalizeTokenCount(usage?.outputTokens);
  const cacheReadTokens = normalizeTokenCount(usage?.cacheRead);
  const cacheWriteTokens = normalizeTokenCount(usage?.cacheWrite);

  const cost =
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output +
    (cacheWriteTokens / 1_000_000) * pricing.cacheWrite +
    (cacheReadTokens / 1_000_000) * pricing.cacheRead;

  // Cache read replaces full input cost in the hot path.
  const savedCost = (cacheReadTokens / 1_000_000) * Math.max(0, pricing.input - pricing.cacheRead);

  return {
    model,
    cost: roundUsd(cost),
    savedCost: roundUsd(savedCost)
  };
}

function normalizeTokenCount(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }
  return Math.floor(number);
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function loadPricingTable(): Record<string, PricingEntry> {
  const pricing: Record<string, PricingEntry> = { ...DEFAULT_PRICING };
  const rawJson = readPricingRawJson();
  if (!rawJson) {
    return pricing;
  }

  try {
    const parsed = JSON.parse(rawJson) as Record<string, Partial<PricingEntry>>;
    for (const [model, entry] of Object.entries(parsed)) {
      const normalized = normalizePricingEntry(entry);
      if (!normalized) {
        continue;
      }
      pricing[model] = normalized;
    }
  } catch (error) {
    console.warn("[AgentCanvas] Failed to parse pricing override", error);
  }
  return pricing;
}

function readPricingRawJson(): string | undefined {
  if (process.env.AGENTCANVAS_PRICING_JSON?.trim()) {
    return process.env.AGENTCANVAS_PRICING_JSON;
  }
  const pricingFilePath = process.env.AGENTCANVAS_PRICING_FILE?.trim();
  if (!pricingFilePath) {
    return undefined;
  }
  try {
    return readFileSync(pricingFilePath, "utf8");
  } catch (error) {
    console.warn("[AgentCanvas] Failed to read pricing file", error);
    return undefined;
  }
}

function normalizePricingEntry(value: Partial<PricingEntry>): PricingEntry | undefined {
  const input = normalizeUsdPerMToken(value.input);
  const cacheWrite = normalizeUsdPerMToken(value.cacheWrite);
  const cacheRead = normalizeUsdPerMToken(value.cacheRead);
  const output = normalizeUsdPerMToken(value.output);
  if ([input, cacheWrite, cacheRead, output].some((entry) => entry === undefined)) {
    return undefined;
  }
  return {
    input: input!,
    cacheWrite: cacheWrite!,
    cacheRead: cacheRead!,
    output: output!
  };
}

function normalizeUsdPerMToken(value: unknown): number | undefined {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return undefined;
  }
  return numeric;
}
