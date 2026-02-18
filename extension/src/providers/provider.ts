import type { AgentProfile, RuleDoc, Skill } from "../types";

export interface ProviderContext {
  workspaceRoot?: string;
  workspacePath: string;
  homeDir: string;
  extraSkillLocations?: string[];
  codexProjectFallbackFileName?: string;
}

export interface Provider {
  id: string;
  displayName: string;
  detect(ctx: ProviderContext): Promise<boolean>;
  listAgents(ctx: ProviderContext): Promise<AgentProfile[]>;
  listSkills(ctx: ProviderContext, agentId: string): Promise<Skill[]>;
  listRuleDocs(ctx: ProviderContext, agentId: string): Promise<RuleDoc[]>;
}
