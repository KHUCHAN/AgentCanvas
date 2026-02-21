import { readFileSync } from "node:fs";
import type { UsageMetrics } from "../types";

type PricingEntry = {
  input: number;
  cacheWrite: number;
  cacheRead: number;
  output: number;
};

const DEFAULT_MODEL = "claude-sonnet-4-6";

const DEFAULT_PRICING: Record<string, PricingEntry> = {
  // Claude 4.6 pricing
  "claude-sonnet-4-6": { input: 3.0, cacheWrite: 3.75, cacheRead: 0.3, output: 15.0 },
  "claude-opus-4-6": { input: 15.0, cacheWrite: 18.75, cacheRead: 1.5, output: 75.0 },
  "sonnet-4.6": { input: 3.0, cacheWrite: 3.75, cacheRead: 0.3, output: 15.0 },
  "opus-4.6": { input: 15.0, cacheWrite: 18.75, cacheRead: 1.5, output: 75.0 },
  // Claude 4.5 pricing (legacy)
  "claude-sonnet-4-5-20250929": { input: 3.0, cacheWrite: 3.75, cacheRead: 0.3, output: 15.0 },
  "claude-haiku-4-5-20251001": { input: 0.8, cacheWrite: 1.0, cacheRead: 0.08, output: 4.0 },
  "claude-opus-4-5-20251101": { input: 15.0, cacheWrite: 18.75, cacheRead: 1.5, output: 75.0 },
  "sonnet-4.5": { input: 3.0, cacheWrite: 3.75, cacheRead: 0.3, output: 15.0 },
  "haiku-4.5": { input: 0.8, cacheWrite: 1.0, cacheRead: 0.08, output: 4.0 },
  "opus-4.5": { input: 15.0, cacheWrite: 18.75, cacheRead: 1.5, output: 75.0 },
  // GPT-5.x Codex pricing
  "gpt-5.3-codex": { input: 5.0, cacheWrite: 0, cacheRead: 0, output: 20.0 },
  "gpt-5.3-codex-spark": { input: 0.5, cacheWrite: 0, cacheRead: 0, output: 2.0 },
  "gpt-5.2-codex": { input: 2.0, cacheWrite: 0, cacheRead: 0, output: 8.0 },
  "gpt-5.1-codex-max": { input: 10.0, cacheWrite: 0, cacheRead: 0, output: 40.0 },
  "gpt-5.2": { input: 2.0, cacheWrite: 0, cacheRead: 0, output: 8.0 },
  "gpt-5.1-codex-mini": { input: 0.4, cacheWrite: 0, cacheRead: 0, output: 1.6 },
  // Codex / OpenAI legacy pricing
  "gpt-4.1": { input: 2.0, cacheWrite: 0, cacheRead: 0, output: 8.0 },
  "gpt-4.1-mini": { input: 0.4, cacheWrite: 0, cacheRead: 0, output: 1.6 },
  "gpt-4.1-nano": { input: 0.2, cacheWrite: 0, cacheRead: 0, output: 0.8 },
  "gpt-4o": { input: 2.5, cacheWrite: 0, cacheRead: 0, output: 10.0 },
  "gpt-4o-mini": { input: 0.6, cacheWrite: 0, cacheRead: 0, output: 2.4 },
  "o3-mini": { input: 1.1, cacheWrite: 0, cacheRead: 0, output: 4.4 },
  "o3": { input: 10.0, cacheWrite: 0, cacheRead: 0, output: 40.0 },
  "o4-mini": { input: 1.0, cacheWrite: 0, cacheRead: 0, output: 4.0 },
  "codex-1": { input: 5.0, cacheWrite: 0, cacheRead: 0, output: 20.0 },
  // Gemini 3.x pricing
  "gemini-3-pro-preview": { input: 2.5, cacheWrite: 0.625, cacheRead: 0.25, output: 15.0 },
  "gemini-3-flash-preview": { input: 0.3, cacheWrite: 0.075, cacheRead: 0.03, output: 1.2 },
  // Gemini 2.x pricing (legacy)
  "gemini-2.5-flash": { input: 0.15, cacheWrite: 0.0375, cacheRead: 0.015, output: 0.6 },
  "gemini-2.5-flash-lite": { input: 0.075, cacheWrite: 0.01875, cacheRead: 0.0075, output: 0.3 },
  "gemini-2.5-pro": { input: 1.25, cacheWrite: 0.3125, cacheRead: 0.125, output: 10.0 },
  "gemini-2.0-flash": { input: 0.1, cacheWrite: 0.025, cacheRead: 0.01, output: 0.4 },
  "gemini-2.0-flash-lite": { input: 0.075, cacheWrite: 0.01875, cacheRead: 0.0075, output: 0.3 }
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
  // Claude 4.6 aliases
  if (lower === "sonnet" || lower === "sonnet-4.6" || lower.includes("sonnet-4-6")) {
    return "claude-sonnet-4-6";
  }
  if (lower === "opus" || lower === "opus-4.6" || lower.includes("opus-4-6")) {
    return "claude-opus-4-6";
  }
  // Claude 4.5 legacy aliases
  if (lower === "sonnet-4.5" || lower.includes("sonnet-4-5")) {
    return "claude-sonnet-4-5-20250929";
  }
  if (lower === "haiku" || lower === "haiku-4.5" || lower.includes("haiku-4-5")) {
    return "claude-haiku-4-5-20251001";
  }
  if (lower === "opus-4.5" || lower.includes("opus-4-5")) {
    return "claude-opus-4-5-20251101";
  }
  // GPT-5.x / Codex aliases
  if (lower === "codex" || lower === "codex-latest") {
    return "gpt-5.3-codex";
  }
  if (lower.includes("gpt-5")) {
    return "gpt-5.3-codex";
  }
  if (lower.includes("codex")) {
    return "gpt-5.3-codex";
  }
  if (lower.includes("gpt-4.1")) {
    return "gpt-4.1";
  }
  if (lower === "gpt-4.1-latest") {
    return "gpt-4.1";
  }
  if (lower.includes("gpt-4o")) {
    return "gpt-4o";
  }
  if (lower === "gpt-4o-latest") {
    return "gpt-4o";
  }
  if (lower.includes("o3-mini")) {
    return "o3-mini";
  }
  if (lower === "o3") {
    return "o3";
  }
  if (lower.includes("o4-mini")) {
    return "o4-mini";
  }
  // Gemini 3.x aliases
  if (lower === "gemini" || lower === "gemini-flash") {
    return "gemini-3-flash-preview";
  }
  if (lower === "gemini-pro") {
    return "gemini-3-pro-preview";
  }
  if (lower.includes("gemini-3")) {
    return "gemini-3-flash-preview";
  }
  // Gemini 2.x legacy aliases
  if (lower === "gemini-2.5-flash-latest") {
    return "gemini-2.5-flash";
  }
  if (lower === "gemini-flash-lite" || lower === "gemini-2.5-flash-lite-latest") {
    return "gemini-2.5-flash-lite";
  }
  if (lower === "gemini-2.5-pro-latest") {
    return "gemini-2.5-pro";
  }
  if (lower === "gemini-2.0-flash-lite-latest") {
    return "gemini-2.0-flash-lite";
  }
  if (lower.includes("gemini")) {
    return "gemini-3-flash-preview";
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
