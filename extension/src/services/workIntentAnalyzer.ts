import type {
  AgentProfile,
  AgentRole,
  BackendUsageSummary,
  CliBackend,
  WorkCategory,
  WorkIntentAnalysis
} from "../types";
import { listAvailableCanonicalBackends } from "./backendProfiles";

const KEYWORD_WEIGHTS: Array<{ category: WorkCategory; patterns: RegExp[]; weight: number }> = [
  { category: "code_review", patterns: [/\breview\b/i, /코드\s*리뷰/, /품질\s*검토/], weight: 2.4 },
  { category: "refactor", patterns: [/\brefactor/i, /리팩터/, /구조\s*개선/], weight: 2.2 },
  { category: "bug_fix", patterns: [/\bbug\b/i, /fix/i, /오류/, /버그/, /디버깅/], weight: 2.0 },
  { category: "testing", patterns: [/\btest/i, /qa\b/i, /e2e/i, /테스트/], weight: 1.9 },
  { category: "documentation", patterns: [/\bdocs?\b/i, /문서/, /가이드/, /readme/i], weight: 1.7 },
  { category: "research", patterns: [/\bresearch\b/i, /조사/, /분석/, /search/i], weight: 1.8 },
  { category: "devops", patterns: [/\bdeploy\b/i, /ci\/cd/i, /infra/i, /배포/], weight: 1.7 },
  { category: "design", patterns: [/\bui\b/i, /\bux\b/i, /디자인/, /시안/], weight: 1.6 },
  { category: "data_pipeline", patterns: [/\bdata\b/i, /pipeline/i, /etl/i, /데이터/], weight: 1.6 },
  { category: "new_feature", patterns: [/\bfeature\b/i, /구현/, /추가/, /만들/], weight: 1.5 },
  { category: "full_stack", patterns: [/\bfull[\s-]?stack\b/i, /풀스택/, /frontend.*backend|backend.*frontend/i], weight: 2.0 }
];

export const AFFINITY_MATRIX: Record<WorkCategory, Record<"claude" | "codex" | "gemini", number>> = {
  new_feature: { claude: 0.95, codex: 0.9, gemini: 0.82 },
  bug_fix: { claude: 0.92, codex: 0.88, gemini: 0.8 },
  refactor: { claude: 0.93, codex: 0.85, gemini: 0.78 },
  code_review: { claude: 0.9, codex: 0.92, gemini: 0.8 },
  testing: { claude: 0.85, codex: 0.82, gemini: 0.78 },
  documentation: { claude: 0.92, codex: 0.78, gemini: 0.85 },
  research: { claude: 0.7, codex: 0.75, gemini: 0.95 },
  devops: { claude: 0.8, codex: 0.85, gemini: 0.82 },
  design: { claude: 0.82, codex: 0.85, gemini: 0.88 },
  data_pipeline: { claude: 0.8, codex: 0.82, gemini: 0.88 },
  full_stack: { claude: 0.94, codex: 0.88, gemini: 0.82 },
  mixed: { claude: 0.9, codex: 0.85, gemini: 0.85 }
};

const FALLBACK_WORK_INTENT: WorkIntentAnalysis = {
  primaryCategory: "full_stack",
  secondaryCategories: [],
  categoryWeights: { full_stack: 1 },
  suggestedRoles: [
    {
      role: "orchestrator",
      count: 1,
      reason: "Coordinate tasks and resolve dependency ordering.",
      preferredBackend: "claude",
      backendReason: "Strong planning and orchestration quality."
    },
    {
      role: "coder",
      count: 2,
      reason: "Implement core feature and integration tasks.",
      preferredBackend: "codex",
      backendReason: "Balanced coding speed and review support."
    },
    {
      role: "tester",
      count: 1,
      reason: "Validate behavior and prevent regressions.",
      preferredBackend: "codex",
      backendReason: "Good test and execution support."
    }
  ],
  estimatedComplexity: "medium",
  estimatedDuration: "hours"
};

export function defaultWorkIntentAnalysis(): WorkIntentAnalysis {
  return {
    ...FALLBACK_WORK_INTENT,
    categoryWeights: { ...FALLBACK_WORK_INTENT.categoryWeights },
    suggestedRoles: FALLBACK_WORK_INTENT.suggestedRoles.map((role) => ({ ...role })),
    secondaryCategories: [...FALLBACK_WORK_INTENT.secondaryCategories]
  };
}

export function analyzeWorkIntent(input: {
  prompt: string;
  existingAgents: AgentProfile[];
  availableBackends: CliBackend[];
  usageSummaries: BackendUsageSummary[];
}): WorkIntentAnalysis {
  const weights = extractCategoryWeights(input.prompt);
  const orderedCategories = Object.entries(weights)
    .sort((left, right) => right[1] - left[1])
    .map(([category]) => category as WorkCategory);

  if (orderedCategories.length === 0) {
    return defaultWorkIntentAnalysis();
  }

  const primaryCategory = orderedCategories[0] ?? "full_stack";
  const secondaryCategories = orderedCategories.slice(1, 4);
  const suggestedRoles = determineRoles(primaryCategory, input.existingAgents.length > 0);
  const availableCanonical = listAvailableCanonicalBackends(input.availableBackends);
  const supported = new Set(availableCanonical);

  const finalizedRoles = suggestedRoles.map((item) => {
    if (supported.size === 0 || supported.has(item.preferredBackend)) {
      return item;
    }
    const fallback =
      availableCanonical.find((backend) => backend === "claude" || backend === "codex" || backend === "gemini") ??
      availableCanonical[0] ??
      item.preferredBackend;
    return {
      ...item,
      preferredBackend: fallback,
      backendReason: `${item.backendReason} (fallback to available backend)`
    };
  });

  const complexity = estimateComplexity(input.prompt, weights);
  const duration = complexity === "light" ? "minutes" : complexity === "medium" ? "hours" : "days";

  return {
    primaryCategory,
    secondaryCategories,
    categoryWeights: weights,
    suggestedRoles: finalizedRoles,
    estimatedComplexity: complexity,
    estimatedDuration: duration
  };
}

function extractCategoryWeights(prompt: string): Partial<Record<WorkCategory, number>> {
  const normalized = prompt.trim();
  if (!normalized) {
    return { full_stack: 1 };
  }

  const rawScore = new Map<WorkCategory, number>();
  for (const entry of KEYWORD_WEIGHTS) {
    let score = 0;
    for (const pattern of entry.patterns) {
      if (pattern.test(normalized)) {
        score += entry.weight;
      }
    }
    if (score > 0) {
      rawScore.set(entry.category, score);
    }
  }

  if (rawScore.size === 0) {
    return { full_stack: 1 };
  }

  if (rawScore.size >= 3) {
    rawScore.set("mixed", (rawScore.get("mixed") ?? 0) + 1.8);
  }

  const total = [...rawScore.values()].reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    return { full_stack: 1 };
  }

  const result: Partial<Record<WorkCategory, number>> = {};
  for (const [category, value] of rawScore.entries()) {
    result[category] = roundWeight(value / total);
  }
  return result;
}

function determineRoles(primaryCategory: WorkCategory, hasExistingAgents: boolean): WorkIntentAnalysis["suggestedRoles"] {
  const base = hasExistingAgents ? 0 : 1;
  switch (primaryCategory) {
    case "code_review":
      return [
        role("orchestrator", 1, "Coordinate review lanes", "claude", "Reliable structured planning"),
        role("reviewer", 1 + base, "Perform static review and risk checks", "codex", "Strong review affinity"),
        role("tester", 1, "Validate edge cases and tests", "codex", "Good execution-oriented QA")
      ];
    case "documentation":
      return [
        role("orchestrator", 1, "Coordinate doc deliverables", "claude", "Strong writing and planning"),
        role("writer", 1 + base, "Author concise technical docs", "gemini", "Cost-efficient documentation flow"),
        role("reviewer", 1, "Check accuracy and consistency", "claude", "High quality proofreading")
      ];
    case "research":
      return [
        role("orchestrator", 1, "Synthesize findings", "claude", "Strong synthesis and planning"),
        role("researcher", 1 + base, "Collect and compare sources", "gemini", "High research affinity"),
        role("writer", 1, "Summarize results into action plan", "gemini", "Fast long-context summarization")
      ];
    case "testing":
      return [
        role("orchestrator", 1, "Prioritize test scope", "claude", "Reliable planning"),
        role("tester", 2, "Generate and run test scenarios", "codex", "Good execution + test fluency"),
        role("coder", 1, "Patch failures quickly", "codex", "Fast iteration loop")
      ];
    case "refactor":
      return [
        role("orchestrator", 1, "Drive refactor sequence", "claude", "High architectural planning"),
        role("coder", 2 + base, "Refactor implementation safely", "codex", "Code transformation speed"),
        role("reviewer", 1, "Guard against regressions", "claude", "High quality review")
      ];
    case "bug_fix":
      return [
        role("orchestrator", 1, "Coordinate triage and fixes", "claude", "Better incident orchestration"),
        role("coder", 1 + base, "Fix root cause and add guards", "codex", "Fast debugging loop"),
        role("tester", 1, "Write regression checks", "codex", "Strong test automation support")
      ];
    case "devops":
      return [
        role("orchestrator", 1, "Coordinate rollout safety", "claude", "Planning and risk control"),
        role("coder", 1 + base, "Implement CI/CD changes", "codex", "Command/code execution fit"),
        role("reviewer", 1, "Review infra risks", "claude", "Policy and risk review quality")
      ];
    case "design":
      return [
        role("orchestrator", 1, "Coordinate UX scope", "claude", "Strong planning with constraints"),
        role("coder", 1 + base, "Implement UI changes", "codex", "Frontend implementation speed"),
        role("writer", 1, "Capture UX rationale and docs", "gemini", "Efficient design communication")
      ];
    case "data_pipeline":
      return [
        role("orchestrator", 1, "Coordinate data stages", "claude", "Complex dependency planning"),
        role("coder", 1 + base, "Implement pipeline stages", "codex", "Execution-oriented coding"),
        role("researcher", 1, "Validate data assumptions", "gemini", "Research and context strengths")
      ];
    case "new_feature":
    case "full_stack":
    case "mixed":
    default:
      return [
        role("orchestrator", 1, "Coordinate multi-agent execution", "claude", "Best for complex planning"),
        role("coder", 2 + base, "Deliver implementation tasks", "codex", "Balanced coding throughput"),
        role("tester", 1, "Prevent regressions with tests", "codex", "Good test quality/cost"),
        role("reviewer", 1, "Code quality and risk checks", "claude", "Strong review and reasoning")
      ];
  }
}

function role(
  agentRole: AgentRole,
  count: number,
  reason: string,
  preferredBackend: "claude" | "codex" | "gemini",
  backendReason: string
): WorkIntentAnalysis["suggestedRoles"][number] {
  return { role: agentRole, count, reason, preferredBackend, backendReason };
}

function estimateComplexity(
  prompt: string,
  weights: Partial<Record<WorkCategory, number>>
): "light" | "medium" | "heavy" {
  const lengthScore = Math.min(3, Math.floor(prompt.trim().length / 140));
  const categoryScore = Object.keys(weights).length;
  const weighted = Object.values(weights).reduce((sum, value) => sum + (value ?? 0), 0);
  const total = lengthScore + categoryScore + weighted;
  if (total >= 6.2) {
    return "heavy";
  }
  if (total >= 3.5) {
    return "medium";
  }
  return "light";
}

function roundWeight(value: number): number {
  return Math.round(value * 1000) / 1000;
}
