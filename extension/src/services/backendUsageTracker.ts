import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  BackendBudget,
  BackendUsagePeriod,
  BackendUsageRecord,
  BackendUsageSummary,
  CanonicalBackendId,
  UsageMetrics
} from "../types";
import { calculateUsageCost } from "./costCalculator";

const CORE_BACKENDS: CanonicalBackendId[] = ["claude", "codex", "gemini"];
const EMPTY_PERIOD: BackendUsagePeriod = {
  callCount: 0,
  totalTokens: 0,
  estimatedCost: 0,
  avgLatencyMs: 0,
  successRate: 1
};

type BudgetsFile = Partial<Record<CanonicalBackendId, BackendBudget>>;

export class BackendUsageTracker {
  private readonly usageRoot: string;
  private readonly budgetsPath: string;

  constructor(private readonly workspaceRoot: string) {
    this.usageRoot = join(workspaceRoot, ".agentcanvas", "usage");
    this.budgetsPath = join(this.usageRoot, "budgets.json");
  }

  public async recordCall(input: {
    backendId: CanonicalBackendId;
    usage?: UsageMetrics;
    latencyMs: number;
    success: boolean;
    modelHint?: string;
    flowName?: string;
    agentId?: string;
  }): Promise<BackendUsageRecord> {
    const date = todayKey();
    const record = await this.readDailyRecord(input.backendId, date);
    const usageCost = calculateUsageCost(input.usage, input.modelHint);
    const inputTokens = normalizeInt(input.usage?.inputTokens);
    const outputTokens = normalizeInt(input.usage?.outputTokens);
    const cacheReadTokens = normalizeInt(input.usage?.cacheRead);
    const cacheWriteTokens = normalizeInt(input.usage?.cacheWrite);
    const callCount = record.callCount + 1;
    const previousLatencyWeighted = record.avgLatencyMs * record.callCount;
    const nextLatencyMs = clampInt(input.latencyMs, 0);
    const errorCount = record.errorCount + (input.success ? 0 : 1);

    const next: BackendUsageRecord = {
      ...record,
      callCount,
      inputTokens: record.inputTokens + inputTokens,
      outputTokens: record.outputTokens + outputTokens,
      cacheReadTokens: record.cacheReadTokens + cacheReadTokens,
      cacheWriteTokens: record.cacheWriteTokens + cacheWriteTokens,
      estimatedCost: roundUsd(record.estimatedCost + usageCost.cost),
      avgLatencyMs: Math.round((previousLatencyWeighted + nextLatencyMs) / callCount),
      errorCount,
      successRate: callCount > 0 ? roundRate((callCount - errorCount) / callCount) : 1,
      calls: [
        ...record.calls,
        {
          timestamp: new Date().toISOString(),
          flowName: input.flowName,
          agentId: input.agentId,
          inputTokens,
          outputTokens,
          cacheReadTokens,
          cacheWriteTokens,
          latencyMs: nextLatencyMs,
          model: input.usage?.model ?? usageCost.model,
          success: input.success,
          cost: usageCost.cost
        }
      ].slice(-500)
    };

    await this.writeDailyRecord(next);
    return next;
  }

  public async getSummary(backendId: CanonicalBackendId): Promise<BackendUsageSummary> {
    const budgets = await this.readBudgets();
    const [today, thisWeek, thisMonth] = await Promise.all([
      this.aggregatePeriod(backendId, periodRange("today")),
      this.aggregatePeriod(backendId, periodRange("week")),
      this.aggregatePeriod(backendId, periodRange("month"))
    ]);

    const budget = budgets[backendId];
    const availabilityScore = this.calculateAvailabilityFromSummary({
      backendId,
      today,
      thisWeek,
      thisMonth,
      budget,
      availabilityScore: 1
    });

    return {
      backendId,
      today,
      thisWeek,
      thisMonth,
      budget,
      availabilityScore
    };
  }

  public async getAllSummaries(backends?: CanonicalBackendId[]): Promise<BackendUsageSummary[]> {
    const targets = dedupeCanonicalBackends(backends && backends.length > 0 ? backends : CORE_BACKENDS);
    const result: BackendUsageSummary[] = [];
    for (const backendId of targets) {
      result.push(await this.getSummary(backendId));
    }
    return result;
  }

  public async getRecords(input: {
    backendId?: CanonicalBackendId;
    from: string;
    to: string;
  }): Promise<BackendUsageRecord[]> {
    const targets = input.backendId ? [input.backendId] : CORE_BACKENDS;
    const from = normalizeDateKey(input.from);
    const to = normalizeDateKey(input.to);
    const records: BackendUsageRecord[] = [];
    for (const backendId of targets) {
      const backendDir = this.backendDir(backendId);
      await mkdir(backendDir, { recursive: true });
      let entries: string[] = [];
      try {
        entries = await readdir(backendDir);
      } catch {
        entries = [];
      }
      for (const entry of entries) {
        if (!entry.endsWith(".json")) {
          continue;
        }
        const key = entry.replace(/\.json$/, "");
        if (key < from || key > to) {
          continue;
        }
        records.push(await this.readDailyRecord(backendId, key));
      }
    }
    return records.sort((left, right) => left.date.localeCompare(right.date));
  }

  public async setBudget(backendId: CanonicalBackendId, budget: BackendBudget): Promise<void> {
    const budgets = await this.readBudgets();
    budgets[backendId] = normalizeBudget(budget);
    await this.writeBudgets(budgets);
  }

  public async getBudgets(): Promise<BudgetsFile> {
    return await this.readBudgets();
  }

  public async isOverBudget(backendId: CanonicalBackendId): Promise<{
    daily: boolean;
    weekly: boolean;
    monthly: boolean;
  }> {
    const summary = await this.getSummary(backendId);
    const budget = summary.budget;
    if (!budget) {
      return { daily: false, weekly: false, monthly: false };
    }
    return {
      daily: exceedsLimit(summary.today, budget.dailyMaxCost, budget.dailyMaxCalls),
      weekly: exceedsLimit(summary.thisWeek, budget.weeklyMaxCost, budget.weeklyMaxCalls),
      monthly: exceedsLimit(summary.thisMonth, budget.monthlyMaxCost, budget.monthlyMaxCalls)
    };
  }

  public async calculateAvailability(backendId: CanonicalBackendId): Promise<number> {
    const summary = await this.getSummary(backendId);
    return summary.availabilityScore;
  }

  private async aggregatePeriod(
    backendId: CanonicalBackendId,
    range: { from: string; to: string }
  ): Promise<BackendUsagePeriod> {
    const records = await this.getRecords({
      backendId,
      from: range.from,
      to: range.to
    });
    if (records.length === 0) {
      return { ...EMPTY_PERIOD };
    }
    let callCount = 0;
    let totalTokens = 0;
    let estimatedCost = 0;
    let latencyWeighted = 0;
    let successWeighted = 0;
    for (const record of records) {
      callCount += record.callCount;
      totalTokens += record.inputTokens + record.outputTokens + record.cacheReadTokens + record.cacheWriteTokens;
      estimatedCost += record.estimatedCost;
      latencyWeighted += record.avgLatencyMs * record.callCount;
      successWeighted += record.successRate * record.callCount;
    }
    return {
      callCount,
      totalTokens,
      estimatedCost: roundUsd(estimatedCost),
      avgLatencyMs: callCount > 0 ? Math.round(latencyWeighted / callCount) : 0,
      successRate: callCount > 0 ? roundRate(successWeighted / callCount) : 1
    };
  }

  private calculateAvailabilityFromSummary(summary: BackendUsageSummary): number {
    const budget = summary.budget;
    if (!budget) {
      return 1;
    }
    const ratios: number[] = [];
    if (budget.dailyMaxCost && budget.dailyMaxCost > 0) {
      ratios.push(summary.today.estimatedCost / budget.dailyMaxCost);
    }
    if (budget.weeklyMaxCost && budget.weeklyMaxCost > 0) {
      ratios.push(summary.thisWeek.estimatedCost / budget.weeklyMaxCost);
    }
    if (budget.monthlyMaxCost && budget.monthlyMaxCost > 0) {
      ratios.push(summary.thisMonth.estimatedCost / budget.monthlyMaxCost);
    }
    if (budget.dailyMaxCalls && budget.dailyMaxCalls > 0) {
      ratios.push(summary.today.callCount / budget.dailyMaxCalls);
    }
    if (budget.weeklyMaxCalls && budget.weeklyMaxCalls > 0) {
      ratios.push(summary.thisWeek.callCount / budget.weeklyMaxCalls);
    }
    if (budget.monthlyMaxCalls && budget.monthlyMaxCalls > 0) {
      ratios.push(summary.thisMonth.callCount / budget.monthlyMaxCalls);
    }
    if (ratios.length === 0) {
      return 1;
    }
    const maxUsageRatio = Math.max(...ratios);
    return roundRate(Math.max(0, 1 - maxUsageRatio));
  }

  private async readDailyRecord(backendId: CanonicalBackendId, date: string): Promise<BackendUsageRecord> {
    const path = this.dailyPath(backendId, date);
    try {
      const raw = await readFile(path, "utf8");
      const parsed = JSON.parse(raw) as BackendUsageRecord;
      return normalizeRecord(parsed, backendId, date);
    } catch {
      return emptyRecord(backendId, date);
    }
  }

  private async writeDailyRecord(record: BackendUsageRecord): Promise<void> {
    const path = this.dailyPath(record.backendId, record.date);
    await mkdir(this.backendDir(record.backendId), { recursive: true });
    await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  }

  private async readBudgets(): Promise<BudgetsFile> {
    try {
      const raw = await readFile(this.budgetsPath, "utf8");
      const parsed = JSON.parse(raw) as BudgetsFile;
      const normalized: BudgetsFile = {};
      for (const backendId of CORE_BACKENDS) {
        if (!parsed[backendId]) {
          continue;
        }
        normalized[backendId] = normalizeBudget(parsed[backendId]!);
      }
      return normalized;
    } catch {
      return {};
    }
  }

  private async writeBudgets(input: BudgetsFile): Promise<void> {
    await mkdir(this.usageRoot, { recursive: true });
    await writeFile(this.budgetsPath, `${JSON.stringify(input, null, 2)}\n`, "utf8");
  }

  private backendDir(backendId: CanonicalBackendId): string {
    return join(this.usageRoot, backendId);
  }

  private dailyPath(backendId: CanonicalBackendId, date: string): string {
    return join(this.backendDir(backendId), `${date}.json`);
  }
}

function emptyRecord(backendId: CanonicalBackendId, date: string): BackendUsageRecord {
  return {
    backendId,
    date,
    callCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    estimatedCost: 0,
    avgLatencyMs: 0,
    errorCount: 0,
    successRate: 1,
    calls: []
  };
}

function normalizeRecord(input: BackendUsageRecord, backendId: CanonicalBackendId, date: string): BackendUsageRecord {
  const base = emptyRecord(backendId, date);
  return {
    ...base,
    ...input,
    backendId,
    date,
    callCount: normalizeInt(input.callCount),
    inputTokens: normalizeInt(input.inputTokens),
    outputTokens: normalizeInt(input.outputTokens),
    cacheReadTokens: normalizeInt(input.cacheReadTokens),
    cacheWriteTokens: normalizeInt(input.cacheWriteTokens),
    estimatedCost: roundUsd(Number(input.estimatedCost) || 0),
    avgLatencyMs: normalizeInt(input.avgLatencyMs),
    errorCount: normalizeInt(input.errorCount),
    successRate: roundRate(Math.max(0, Math.min(1, Number(input.successRate) || 0))),
    calls: Array.isArray(input.calls) ? input.calls.map((call) => ({
      timestamp: typeof call.timestamp === "string" ? call.timestamp : new Date().toISOString(),
      flowName: call.flowName,
      agentId: call.agentId,
      inputTokens: normalizeInt(call.inputTokens),
      outputTokens: normalizeInt(call.outputTokens),
      cacheReadTokens: normalizeInt(call.cacheReadTokens),
      cacheWriteTokens: normalizeInt(call.cacheWriteTokens),
      latencyMs: normalizeInt(call.latencyMs),
      model: call.model,
      success: Boolean(call.success),
      cost: roundUsd(Number(call.cost) || 0)
    })) : []
  };
}

function normalizeBudget(input: BackendBudget): BackendBudget {
  return {
    dailyMaxCost: normalizePositiveNumber(input.dailyMaxCost),
    weeklyMaxCost: normalizePositiveNumber(input.weeklyMaxCost),
    monthlyMaxCost: normalizePositiveNumber(input.monthlyMaxCost),
    dailyMaxCalls: normalizePositiveInt(input.dailyMaxCalls),
    weeklyMaxCalls: normalizePositiveInt(input.weeklyMaxCalls),
    monthlyMaxCalls: normalizePositiveInt(input.monthlyMaxCalls)
  };
}

function normalizePositiveNumber(value: unknown): number | undefined {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return undefined;
  }
  return roundUsd(number);
}

function normalizePositiveInt(value: unknown): number | undefined {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return undefined;
  }
  return Math.max(1, Math.floor(number));
}

function exceedsLimit(period: BackendUsagePeriod, maxCost?: number, maxCalls?: number): boolean {
  if (maxCost && period.estimatedCost > maxCost) {
    return true;
  }
  if (maxCalls && period.callCount > maxCalls) {
    return true;
  }
  return false;
}

function periodRange(period: "today" | "week" | "month"): { from: string; to: string } {
  const now = new Date();
  const to = toDateKey(now);
  const fromDate = new Date(now);
  if (period === "week") {
    const day = fromDate.getDay();
    const distance = day === 0 ? 6 : day - 1;
    fromDate.setDate(fromDate.getDate() - distance);
  } else if (period === "month") {
    fromDate.setDate(1);
  }
  return {
    from: toDateKey(fromDate),
    to
  };
}

function todayKey(): string {
  return toDateKey(new Date());
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDateKey(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return todayKey();
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function dedupeCanonicalBackends(backends: CanonicalBackendId[]): CanonicalBackendId[] {
  return [...new Set(backends)];
}

function normalizeInt(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }
  return Math.floor(number);
}

function clampInt(value: number, min: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.round(value));
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function roundRate(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
