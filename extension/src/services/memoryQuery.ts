import type { MemoryItem, MemoryItemType, MemoryNamespace, MemoryQueryResult } from "../types";
import { listMemoryItems } from "./memoryStore";

export type RankedMemoryItem = {
  item: MemoryItem;
  score: number;
  estimatedTokens: number;
};

export async function queryMemory(input: {
  workspaceRoot: string;
  text: string;
  namespaces: MemoryNamespace[];
  budgetTokens: number;
  agentId?: string;
  types?: MemoryItemType[];
  minImportance?: number;
}): Promise<MemoryQueryResult> {
  const ranked = await queryMemoryRanked(input);
  const selected: MemoryItem[] = [];
  let used = 0;
  for (const candidate of ranked) {
    if (used + candidate.estimatedTokens > input.budgetTokens) {
      break;
    }
    selected.push(candidate.item);
    used += candidate.estimatedTokens;
  }
  return {
    items: selected,
    totalCount: ranked.length,
    budgetUsed: used,
    budgetLimit: input.budgetTokens
  };
}

export async function queryMemoryRanked(input: {
  workspaceRoot: string;
  text: string;
  namespaces: MemoryNamespace[];
  budgetTokens: number;
  agentId?: string;
  types?: MemoryItemType[];
  minImportance?: number;
}): Promise<RankedMemoryItem[]> {
  const all = await listMemoryItems({
    workspaceRoot: input.workspaceRoot,
    limit: 2_000
  });
  const namespaceSet = new Set(input.namespaces);
  const typeSet = input.types ? new Set(input.types) : undefined;
  const minImportance = Math.max(0, Math.min(1, input.minImportance ?? 0));
  const queryTerms = normalizeQueryTerms(input.text);

  const candidates = all.filter((item) => {
    if (!namespaceSet.has(item.namespace)) {
      return false;
    }
    if (typeSet && !typeSet.has(item.type)) {
      return false;
    }
    if (item.importance < minImportance) {
      return false;
    }
    if (input.agentId && item.source.agentId && item.source.agentId !== input.agentId) {
      return false;
    }
    if (item.supersededBy) {
      return false;
    }
    if (item.ttlMs && item.updatedAt + item.ttlMs <= Date.now()) {
      return false;
    }
    return true;
  });

  return candidates
    .map((item) => {
      const keywordScore = computeKeywordScore(queryTerms, item);
      const importanceScore = clamp01(item.importance);
      const recencyScore = computeRecencyScore(item.updatedAt);
      const score = keywordScore * 0.4 + importanceScore * 0.3 + recencyScore * 0.3;
      const estimatedTokens = estimateTokens(`${item.title}\n${item.content}`);
      return { item, score, estimatedTokens };
    })
    .sort((left, right) => right.score - left.score || right.item.updatedAt - left.item.updatedAt);
}

function normalizeQueryTerms(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_]+/g)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2)
    .slice(0, 24);
}

function computeKeywordScore(terms: string[], item: MemoryItem): number {
  if (terms.length === 0) {
    return 0.2;
  }
  const title = item.title.toLowerCase();
  const content = item.content.toLowerCase();
  const tags = item.tags.map((tag) => tag.toLowerCase());
  let hits = 0;
  for (const term of terms) {
    if (title.includes(term)) {
      hits += 2;
      continue;
    }
    if (tags.some((tag) => tag.includes(term))) {
      hits += 1.5;
      continue;
    }
    if (content.includes(term)) {
      hits += 1;
    }
  }
  const maxHits = terms.length * 2;
  if (maxHits <= 0) {
    return 0;
  }
  return clamp01(hits / maxHits);
}

function computeRecencyScore(updatedAtMs: number): number {
  const ageMs = Math.max(0, Date.now() - updatedAtMs);
  const ageDays = ageMs / (24 * 60 * 60 * 1000);
  const score = Math.exp(-ageDays / 30);
  return clamp01(score);
}

export function estimateTokens(text: string): number {
  const normalized = text.trim();
  if (!normalized) {
    return 0;
  }

  const asciiWords = (normalized.match(/[A-Za-z0-9_]+/g) ?? []).length;
  const cjkChars = (normalized.match(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g) ?? []).length;
  const punctuation = (normalized.match(/[^\w\s]/g) ?? []).length;
  const charFallback = Math.ceil(normalized.length / 4);

  const heuristic = Math.ceil(asciiWords * 1.25 + cjkChars + punctuation * 0.35);
  return Math.max(1, Math.max(charFallback, heuristic));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}
