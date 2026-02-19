import type { CacheMetrics, UsageMetrics } from "../types";
import { calculateUsageCost } from "./costCalculator";

type FlowMetricsState = {
  cacheRead: number;
  cacheWrite: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  savedCost: number;
  model: string;
  callCount: number;
};

export type SessionMetrics = CacheMetrics & {
  callCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheRead: number;
  totalCacheWrite: number;
  totalCost: number;
  totalSavedCost: number;
};

export class TokenTracker {
  private readonly stateByFlow = new Map<string, FlowMetricsState>();

  public recordUsage(input: {
    flowName: string;
    usage?: UsageMetrics;
    modelHint?: string;
  }): SessionMetrics {
    const flowKey = normalizeFlowName(input.flowName);
    const state = this.getOrCreate(flowKey);
    const usage = input.usage;
    const usageInput = normalizeTokenCount(usage?.inputTokens);
    const usageOutput = normalizeTokenCount(usage?.outputTokens);
    const usageCacheRead = normalizeTokenCount(usage?.cacheRead);
    const usageCacheWrite = normalizeTokenCount(usage?.cacheWrite);

    const computed = calculateUsageCost(usage, input.modelHint);

    state.inputTokens += usageInput;
    state.outputTokens += usageOutput;
    state.cacheRead += usageCacheRead;
    state.cacheWrite += usageCacheWrite;
    state.cost += computed.cost;
    state.savedCost += computed.savedCost;
    state.model = usage?.model || input.modelHint || state.model;
    state.callCount += 1;

    return this.toSessionMetrics(state);
  }

  public getSessionMetrics(flowName: string): SessionMetrics {
    const state = this.stateByFlow.get(normalizeFlowName(flowName));
    return this.toSessionMetrics(state ?? this.getEmptyState());
  }

  public getContextSize(flowName: string): number {
    const state = this.stateByFlow.get(normalizeFlowName(flowName));
    if (!state) {
      return 0;
    }
    return state.inputTokens + state.cacheRead + state.cacheWrite;
  }

  public reset(flowName?: string): void {
    if (!flowName) {
      this.stateByFlow.clear();
      return;
    }
    this.stateByFlow.delete(normalizeFlowName(flowName));
  }

  private getOrCreate(flowName: string): FlowMetricsState {
    const existing = this.stateByFlow.get(flowName);
    if (existing) {
      return existing;
    }
    const created = this.getEmptyState();
    this.stateByFlow.set(flowName, created);
    return created;
  }

  private getEmptyState(): FlowMetricsState {
    return {
      cacheRead: 0,
      cacheWrite: 0,
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      savedCost: 0,
      model: "sonnet-4.5",
      callCount: 0
    };
  }

  private toSessionMetrics(state: FlowMetricsState): SessionMetrics {
    const total = state.cacheRead + state.inputTokens;
    const hitRate = total > 0 ? state.cacheRead / total : 0;
    return {
      cacheRead: state.cacheRead,
      cacheWrite: state.cacheWrite,
      inputTokens: state.inputTokens,
      outputTokens: state.outputTokens,
      cost: roundUsd(state.cost),
      savedCost: roundUsd(state.savedCost),
      model: state.model,
      hitRate: roundRate(hitRate),
      callCount: state.callCount,
      totalInputTokens: state.inputTokens,
      totalOutputTokens: state.outputTokens,
      totalCacheRead: state.cacheRead,
      totalCacheWrite: state.cacheWrite,
      totalCost: roundUsd(state.cost),
      totalSavedCost: roundUsd(state.savedCost)
    };
  }
}

function normalizeFlowName(value: string): string {
  const trimmed = value.trim().toLowerCase();
  return trimmed || "default";
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

function roundRate(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

