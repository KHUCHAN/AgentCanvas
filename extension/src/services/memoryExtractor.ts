import type { MemoryItem } from "../types";

export type MemoryDraft = Omit<MemoryItem, "id" | "createdAt" | "updatedAt">;
const DEFAULT_MAX_MEMORY_DRAFTS = 3;

export function extractMemories(input: {
  taskOutput: string;
  taskTitle: string;
  agentId: string;
  runId: string;
  taskId: string;
  flowName: string;
  success: boolean;
  changedFiles?: string[];
  maxDrafts?: number;
}): MemoryDraft[] {
  const text = String(input.taskOutput ?? "").trim();
  if (!text) {
    return [];
  }

  const drafts: MemoryDraft[] = [];
  const source = {
    agentId: input.agentId,
    runId: input.runId,
    taskId: input.taskId,
    flowName: input.flowName
  };
  const baseTags = dedupeTags([
    `flow:${input.flowName}`,
    `task:${sanitizeTag(input.taskTitle)}`,
    `agent:${sanitizeTag(input.agentId)}`
  ]);

  if (input.success) {
    const changedFiles = resolveChangedFiles(input.changedFiles, text);
    if (changedFiles.length > 0) {
      drafts.push({
        namespace: "shared",
        type: "fact",
        title: `${input.taskTitle}: changed files`,
        content: [
          "Files touched during the run:",
          "",
          ...changedFiles.map((file) => `- ${file}`)
        ].join("\n"),
        source,
        tags: dedupeTags([...baseTags, "changes"]),
        importance: 0.5
      });
    }

    if (/(decided|decision|selected|chose|tradeoff)/i.test(text)) {
      drafts.push({
        namespace: "shared",
        type: "decision",
        title: `${input.taskTitle}: implementation decision`,
        content: summarizeText(text, 700),
        source,
        tags: dedupeTags([...baseTags, "decision"]),
        importance: 0.8
      });
    }

    const tests = extractTestSummary(text);
    if (tests) {
      drafts.push({
        namespace: "shared",
        type: "fact",
        title: `${input.taskTitle}: test result`,
        content: tests,
        source,
        tags: dedupeTags([...baseTags, "tests"]),
        importance: 0.55
      });
    }
  } else {
    drafts.push({
      namespace: `agent/${input.agentId}`,
      type: "learning",
      title: `${input.taskTitle}: failure learning`,
      content: [
        "Failure summary:",
        "",
        summarizeText(text, 900),
        "",
        "Suggested follow-up:",
        inferFollowUp(text)
      ].join("\n"),
      source,
      tags: dedupeTags([...baseTags, "failure", "learning"]),
      importance: 0.9
    });
  }

  return drafts.slice(0, resolveMaxDrafts(input.maxDrafts));
}

function detectChangedFiles(text: string): string[] {
  const pattern = /\b(?:src|webview-ui|extension|scripts|docs|test|tests)\/[A-Za-z0-9._/\-]+\.[A-Za-z0-9]+\b/g;
  const matches = text.match(pattern) ?? [];
  return [...new Set(matches)].slice(0, 20);
}

function resolveChangedFiles(explicit: string[] | undefined, taskOutput: string): string[] {
  const normalizedExplicit = (explicit ?? [])
    .map((item) => String(item).trim())
    .filter(Boolean);
  if (normalizedExplicit.length > 0) {
    return [...new Set(normalizedExplicit)].slice(0, 20);
  }
  return detectChangedFiles(taskOutput);
}

function extractTestSummary(text: string): string | undefined {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const matched = lines.filter((line) => /(test|passed|failed|failing|assert)/i.test(line)).slice(0, 8);
  if (matched.length === 0) {
    return undefined;
  }
  return matched.join("\n");
}

function summarizeText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function inferFollowUp(text: string): string {
  if (/(timeout|timed out|hang)/i.test(text)) {
    return "Reduce step scope, add explicit timeout handling, and retry with narrower file targets.";
  }
  if (/(permission|denied|unauthorized|forbidden)/i.test(text)) {
    return "Check runtime credentials, sandbox permissions, and backend environment variables.";
  }
  if (/(not found|missing|enoent)/i.test(text)) {
    return "Verify file paths and tool availability before task execution.";
  }
  return "Capture the root cause and convert it into an explicit guard/check in the next run.";
}

function sanitizeTag(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function dedupeTags(tags: string[]): string[] {
  const set = new Set<string>();
  for (const tag of tags) {
    const normalized = sanitizeTag(tag);
    if (!normalized) {
      continue;
    }
    set.add(normalized);
  }
  return [...set];
}

function resolveMaxDrafts(override: number | undefined): number {
  const envValue = Number(process.env.AGENTCANVAS_MAX_MEMORY_DRAFTS);
  const configured = Number.isFinite(envValue) ? envValue : override;
  if (!Number.isFinite(configured) || configured === undefined) {
    return DEFAULT_MAX_MEMORY_DRAFTS;
  }
  return Math.max(1, Math.min(20, Math.floor(configured)));
}
