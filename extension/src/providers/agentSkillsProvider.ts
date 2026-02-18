import { join, resolve } from "node:path";
import { parseSkillFile } from "../services/skillParser";
import { VSCODE_WORKSPACE_AGENT_ID } from "../services/agentIds";
import {
  ensureAbsolutePath,
  exists,
  isDirectory,
  listSkillFiles,
  resolveUserPath
} from "../services/pathUtils";
import type { AgentProfile, RuleDoc, Skill } from "../types";
import type { Provider, ProviderContext } from "./provider";

const PROJECT_SKILL_LOCATIONS = [
  ".github/skills",
  ".claude/skills",
  ".gemini/skills",
  ".agents/skills"
];
const PERSONAL_SKILL_LOCATIONS = [
  "~/.copilot/skills",
  "~/.claude/skills",
  "~/.gemini/skills",
  "~/.agents/skills"
];

export class AgentSkillsProvider implements Provider {
  public readonly id = "agent-skills";
  public readonly displayName = "Agent Skills";

  public async detect(ctx: ProviderContext): Promise<boolean> {
    const locations = this.collectLocations(ctx);
    for (const location of locations) {
      if (await isDirectory(location)) {
        return true;
      }
    }
    return false;
  }

  public async listAgents(ctx: ProviderContext): Promise<AgentProfile[]> {
    return [
      {
        id: VSCODE_WORKSPACE_AGENT_ID,
        name: "VS Code / Workspace",
        providerId: this.id,
        workspaceRoot: ctx.workspaceRoot,
        homeDir: ctx.homeDir,
        role: "coder",
        isOrchestrator: false,
        metadata: {
          source: this.displayName
        }
      }
    ];
  }

  public async listSkills(ctx: ProviderContext, _agentId: string): Promise<Skill[]> {
    const locations = this.collectLocations(ctx);
    const skills: Skill[] = [];
    const seen = new Set<string>();

    for (const location of locations) {
      const files = await listSkillFiles(location);
      for (const filePath of files) {
        if (seen.has(filePath)) {
          continue;
        }
        seen.add(filePath);

        const scope = this.resolveScope(filePath, ctx);
        const parsed = await parseSkillFile({
          filePath,
          scope,
          providerId: this.id,
          ownerAgentId: VSCODE_WORKSPACE_AGENT_ID
        });
        skills.push(parsed);
      }
    }

    skills.sort((a, b) => a.name.localeCompare(b.name));
    return skills;
  }

  public async listRuleDocs(_ctx: ProviderContext, _agentId: string): Promise<RuleDoc[]> {
    return [];
  }

  private collectLocations(ctx: ProviderContext): string[] {
    const workspaceBase = ctx.workspaceRoot ?? ctx.workspacePath;
    const projectLocations = PROJECT_SKILL_LOCATIONS.map((location) => join(workspaceBase, location));
    const personalLocations = PERSONAL_SKILL_LOCATIONS.map((location) => resolveUserPath(location, ctx.homeDir));

    const extraLocations = (ctx.extraSkillLocations ?? []).map((location) => {
      const resolvedUser = resolveUserPath(location, ctx.homeDir);
      return ensureAbsolutePath(resolvedUser, workspaceBase);
    });

    const all = [...projectLocations, ...personalLocations, ...extraLocations].map((location) => resolve(location));
    return [...new Set(all)];
  }

  private resolveScope(filePath: string, ctx: ProviderContext): Skill["scope"] {
    const workspaceBase = resolve(ctx.workspaceRoot ?? ctx.workspacePath);
    const homeBase = resolve(ctx.homeDir);

    if (filePath.startsWith(workspaceBase)) {
      return "project";
    }
    if (filePath.startsWith(homeBase)) {
      return "personal";
    }
    return "shared";
  }
}

export async function ensureSkillBaseDirectory(targetDir: string): Promise<void> {
  if (!(await exists(targetDir))) {
    await import("node:fs/promises").then(({ mkdir }) => mkdir(targetDir, { recursive: true }));
  }
}
