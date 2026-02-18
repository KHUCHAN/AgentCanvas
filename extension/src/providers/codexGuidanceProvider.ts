import {
  discoverCodexAgentsChain
} from "../services/codexAgentsDiscovery";
import { CODEX_DEFAULT_AGENT_ID } from "../services/agentIds";
import type { AgentProfile, RuleDoc, Skill } from "../types";
import type { Provider, ProviderContext } from "./provider";

export class CodexGuidanceProvider implements Provider {
  public readonly id = "codex-guidance";
  public readonly displayName = "Codex Guidance";

  public async detect(ctx: ProviderContext): Promise<boolean> {
    const docs = await this.resolveRuleDocs(ctx);
    return docs.length > 0;
  }

  public async listAgents(ctx: ProviderContext): Promise<AgentProfile[]> {
    return [
      {
        id: CODEX_DEFAULT_AGENT_ID,
        name: "Codex / default",
        providerId: this.id,
        workspaceRoot: ctx.workspaceRoot,
        homeDir: ctx.homeDir,
        role: "orchestrator",
        isOrchestrator: true,
        avatar: "🎯",
        metadata: {
          source: this.displayName
        }
      }
    ];
  }

  public async listSkills(_ctx: ProviderContext, _agentId: string): Promise<Skill[]> {
    return [];
  }

  public async listRuleDocs(ctx: ProviderContext, _agentId: string): Promise<RuleDoc[]> {
    return this.resolveRuleDocs(ctx);
  }

  private async resolveRuleDocs(ctx: ProviderContext): Promise<RuleDoc[]> {
    const chain = await discoverCodexAgentsChain({
      workspacePath: ctx.workspacePath,
      homeDir: ctx.homeDir,
      fallbackFileName: ctx.codexProjectFallbackFileName
    });

    return chain.map((doc) => ({
      id: `${doc.path}:${doc.orderIndex}`,
      ownerAgentId: CODEX_DEFAULT_AGENT_ID,
      type: "codex-agents",
      path: doc.path,
      scope: doc.scope,
      orderIndex: doc.orderIndex,
      providerId: this.id
    }));
  }
}
