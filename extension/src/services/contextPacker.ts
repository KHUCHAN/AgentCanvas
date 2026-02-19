import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ContextPacket, MemoryNamespace } from "../types";
import { loadConfig } from "./configService";
import { ensureMemoryScaffold } from "./memoryStore";
import { estimateTokens, queryMemoryRanked } from "./memoryQuery";

const DEFAULT_BUDGET_TOKENS = 2_000;

export async function buildContextPacket(input: {
  workspaceRoot: string;
  taskInstruction: string;
  agentId: string;
  flowName: string;
  budgetTokens?: number;
}): Promise<ContextPacket> {
  const budgetTokens = Math.max(200, input.budgetTokens ?? (await resolveDefaultBudgetTokens(input.workspaceRoot)));
  await ensureMemoryScaffold(input.workspaceRoot);

  const projectPath = join(input.workspaceRoot, ".agentcanvas", "memory", "system", "project.md");
  const conventionsPath = join(input.workspaceRoot, ".agentcanvas", "memory", "system", "conventions.md");
  const projectContext = await readTextOrEmpty(projectPath);
  const conventions = await readTextOrEmpty(conventionsPath);
  const systemContext = [projectContext.trim(), conventions.trim()].filter(Boolean).join("\n\n---\n\n");
  const systemTokens = estimateTokens(systemContext);

  const namespaces: MemoryNamespace[] = [
    "shared",
    `agent/${input.agentId}`,
    `flow/${input.flowName}`
  ];
  const remainingBudget = Math.max(0, budgetTokens - systemTokens);
  const ranked = remainingBudget > 0
    ? await queryMemoryRanked({
        workspaceRoot: input.workspaceRoot,
        text: input.taskInstruction,
        namespaces,
        budgetTokens: remainingBudget,
        agentId: input.agentId
      })
    : [];

  const selected = [];
  let memoryTokens = 0;
  for (const candidate of ranked) {
    if (memoryTokens + candidate.estimatedTokens > remainingBudget) {
      break;
    }
    selected.push(candidate);
    memoryTokens += candidate.estimatedTokens;
  }

  const relevantMemories = selected.length > 0
    ? selected
        .map((candidate) => [
          `### [${candidate.item.type}] ${candidate.item.title} (importance: ${candidate.item.importance.toFixed(2)})`,
          candidate.item.content.trim()
        ].filter(Boolean).join("\n\n"))
        .join("\n\n---\n\n")
    : "(none)";

  return {
    systemContext: systemContext || "(none)",
    relevantMemories,
    totalTokens: systemTokens + memoryTokens,
    sources: selected.map((candidate) => ({
      memoryId: candidate.item.id,
      title: candidate.item.title,
      relevanceScore: Number(candidate.score.toFixed(4))
    }))
  };
}

async function readTextOrEmpty(path: string): Promise<string> {
  try {
    return (await readFile(path, "utf8")).trim();
  } catch {
    return "";
  }
}

async function resolveDefaultBudgetTokens(workspaceRoot: string): Promise<number> {
  try {
    const config = await loadConfig(workspaceRoot);
    // Keep memory packet budget proportional to workspace threshold while preserving legacy default.
    const derived = Math.floor(config.contextThreshold / 90);
    return Math.max(200, Math.min(20_000, derived || DEFAULT_BUDGET_TOKENS));
  } catch {
    return DEFAULT_BUDGET_TOKENS;
  }
}
