import type { Skill } from "../types";

const BUILTIN_PROVIDER = "builtin";
const BUILTIN_OWNER = "system";

const TASK_DECOMPOSER: Skill = {
  id: "builtin:task-decomposer",
  ownerAgentId: BUILTIN_OWNER,
  name: "task-decomposer",
  description:
    "Break a high-level user request into discrete, actionable sub-tasks. " +
    "Each sub-task should have a clear title, description, acceptance criteria, " +
    "and an explicit dependency list pointing to earlier sub-tasks. " +
    "Output 1–8 sub-tasks ordered by execution priority.",
  path: "",
  folderName: "task-decomposer",
  scope: "global",
  providerId: BUILTIN_PROVIDER,
  enabled: true,
  extraFrontmatter: { builtin: true },
  validation: []
};

const DEPENDENCY_TRACKER: Skill = {
  id: "builtin:dependency-tracker",
  ownerAgentId: BUILTIN_OWNER,
  name: "dependency-tracker",
  description:
    "Track and enforce dependency ordering between sub-tasks. " +
    "Ensure no task starts before its dependencies are complete. " +
    "Detect dependency cycles and surface blockers immediately. " +
    "Re-order the execution schedule when a task fails or is canceled.",
  path: "",
  folderName: "dependency-tracker",
  scope: "global",
  providerId: BUILTIN_PROVIDER,
  enabled: true,
  extraFrontmatter: { builtin: true },
  validation: []
};

const AGENT_DISPATCHER: Skill = {
  id: "builtin:agent-dispatcher",
  ownerAgentId: BUILTIN_OWNER,
  name: "agent-dispatcher",
  description:
    "Assign each sub-task to the most suitable agent based on role, " +
    "backend affinity, and current workload. " +
    "Prefer agents whose role matches the task type (coder for implementation, " +
    "tester for QA, researcher for investigation). " +
    "Respect the delegation graph — only dispatch to agents listed in delegatesTo.",
  path: "",
  folderName: "agent-dispatcher",
  scope: "global",
  providerId: BUILTIN_PROVIDER,
  enabled: true,
  extraFrontmatter: { builtin: true },
  validation: []
};

const BUILTIN_ORCHESTRATOR_SKILLS: Skill[] = [
  TASK_DECOMPOSER,
  DEPENDENCY_TRACKER,
  AGENT_DISPATCHER
];

const BUILTIN_SKILL_IDS = new Set(BUILTIN_ORCHESTRATOR_SKILLS.map((s) => s.id));

export function getBuiltinOrchestratorSkills(): Skill[] {
  return BUILTIN_ORCHESTRATOR_SKILLS;
}

export function getBuiltinOrchestratorSkillIds(): string[] {
  return BUILTIN_ORCHESTRATOR_SKILLS.map((s) => s.id);
}

export function isBuiltinSkillId(skillId: string): boolean {
  return BUILTIN_SKILL_IDS.has(skillId);
}
