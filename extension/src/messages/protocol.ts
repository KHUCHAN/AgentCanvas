import type {
  AgentRole,
  CliBackend,
  DiscoverySnapshot,
  GeneratedAgentStructure,
  PromptHistoryEntry,
  SkillPackPreview
} from "../types";

export type RequestId = string;

export type Position = { x: number; y: number };

type RequestMessage<TType extends string, TPayload = undefined> = TPayload extends undefined
  ? { type: TType; requestId?: RequestId }
  : { type: TType; payload: TPayload; requestId?: RequestId };

export type WebviewToExtensionMessage =
  | RequestMessage<"READY">
  | RequestMessage<"REFRESH">
  | RequestMessage<"OPEN_FILE", { path: string }>
  | RequestMessage<"REVEAL_IN_EXPLORER", { path: string }>
  | RequestMessage<
      "CREATE_SKILL",
      {
        baseDirPath: string;
        name: string;
        description: string;
        scope?: "project" | "personal" | "shared" | "global";
        extraFrontmatter?: Record<string, unknown>;
        generateOpenAiYaml?: boolean;
      }
    >
  | RequestMessage<
      "UPDATE_SKILL_FRONTMATTER",
      {
        skillId: string;
        name: string;
        description: string;
        extraFrontmatter: Record<string, unknown>;
      }
    >
  | RequestMessage<"EXPORT_PACK", { skillIds: string[]; outputPath?: string }>
  | RequestMessage<"REQUEST_IMPORT_PREVIEW", { zipPath?: string } | undefined>
  | RequestMessage<
      "CONFIRM_IMPORT_PACK",
      { zipPath: string; installDirPath: string; overwrite?: boolean }
    >
  | RequestMessage<"IMPORT_PACK", { zipPath?: string; installDirPath?: string }>
  | RequestMessage<"RUN_VALIDATION", { skillId: string }>
  | RequestMessage<"RUN_VALIDATION_ALL">
  | RequestMessage<"CREATE_OVERRIDE", { sourceRulePath: string }>
  | RequestMessage<"ADD_COMMON_RULE", { title: string; body: string }>
  | RequestMessage<"ENSURE_ROOT_AGENTS">
  | RequestMessage<"OPEN_COMMON_RULES_FOLDER">
  | RequestMessage<"CREATE_COMMON_RULE_DOCS">
  | RequestMessage<"SET_SKILL_ENABLED", { skillId: string; enabled: boolean }>
  | RequestMessage<"ADD_NOTE", { position: Position; text?: string }>
  | RequestMessage<"SAVE_NOTE", { noteId: string; text: string; position?: Position }>
  | RequestMessage<"DELETE_NOTE", { noteId: string }>
  | RequestMessage<"ADD_AGENT_LINK", { sourceAgentId: string; targetAgentId: string }>
  | RequestMessage<"REMOVE_AGENT_LINK", { sourceAgentId: string; targetAgentId: string }>
  | RequestMessage<
      "UPDATE_AGENT_PROFILE",
      {
        agentId: string;
        role?: AgentRole;
        roleLabel?: string;
        description?: string;
        systemPrompt?: string;
        isOrchestrator?: boolean;
        color?: string;
        avatar?: string;
      }
    >
  | RequestMessage<"ASSIGN_SKILL_TO_AGENT", { agentId: string; skillId: string }>
  | RequestMessage<"UNASSIGN_SKILL_FROM_AGENT", { agentId: string; skillId: string }>
  | RequestMessage<"ASSIGN_MCP_TO_AGENT", { agentId: string; mcpServerId: string }>
  | RequestMessage<"UNASSIGN_MCP_FROM_AGENT", { agentId: string; mcpServerId: string }>
  | RequestMessage<"SET_DELEGATION", { orchestratorId: string; workerIds: string[] }>
  | RequestMessage<
      "CREATE_AGENT",
      {
        name: string;
        role: AgentRole;
        roleLabel?: string;
        description?: string;
        systemPrompt?: string;
        isOrchestrator?: boolean;
      }
    >
  | RequestMessage<"DELETE_AGENT", { agentId: string }>
  | RequestMessage<"DETECT_CLI_BACKENDS">
  | RequestMessage<
      "GENERATE_AGENT_STRUCTURE",
      {
        prompt: string;
        backendId: CliBackend["id"];
        includeExistingAgents: boolean;
        includeExistingSkills: boolean;
        includeExistingMcpServers: boolean;
      }
    >
  | RequestMessage<
      "APPLY_GENERATED_STRUCTURE",
      {
        structure: GeneratedAgentStructure;
        createSuggestedSkills: boolean;
        overwriteExisting: boolean;
        historyId?: string;
      }
    >
  | RequestMessage<"GET_PROMPT_HISTORY">
  | RequestMessage<"DELETE_PROMPT_HISTORY", { historyId: string }>
  | RequestMessage<"REAPPLY_PROMPT_HISTORY", { historyId: string }>
  | RequestMessage<"LIST_FLOWS">
  | RequestMessage<"LOAD_FLOW", { flowName: string }>
  | RequestMessage<"SAVE_FLOW", { flowName: string; nodes: DiscoverySnapshot["nodes"]; edges: DiscoverySnapshot["edges"] }>
  | RequestMessage<"SAVE_NODE_POSITION", { nodeId: string; position: Position }>
  | RequestMessage<"SAVE_NODE_POSITIONS", { positions: Array<{ nodeId: string; position: Position }> }>
  | RequestMessage<"LOG_INTERACTION_EVENT", {
      flowName: string;
      interactionId: string;
      edgeId: string;
      event: string;
      data?: Record<string, unknown>;
    }>;

export type ExtensionToWebviewMessage =
  | { type: "INIT_STATE"; payload: { snapshot: DiscoverySnapshot } }
  | {
      type: "STATE_PATCH";
      payload: {
        snapshot?: DiscoverySnapshot;
        skillEnabled?: { skillId: string; enabled: boolean };
      };
    }
  | { type: "IMPORT_PREVIEW"; payload: { preview: SkillPackPreview } }
  | { type: "CLI_BACKENDS"; payload: { backends: CliBackend[] } }
  | { type: "PROMPT_HISTORY"; payload: { items: PromptHistoryEntry[] } }
  | {
      type: "GENERATION_PROGRESS";
      payload: {
        stage: "building_prompt" | "calling_cli" | "parsing_output" | "done" | "error";
        message: string;
        progress?: number;
      };
    }
  | { type: "TOAST"; payload: { level: "info" | "warning" | "error"; message: string } }
  | { type: "ERROR"; payload: { message: string; detail?: string } }
  | { type: "RESPONSE_OK"; inReplyTo: RequestId; result?: unknown }
  | { type: "RESPONSE_ERROR"; inReplyTo: RequestId; error: { message: string; detail?: string } };

export function hasRequestId(message: WebviewToExtensionMessage): message is WebviewToExtensionMessage & {
  requestId: RequestId;
} {
  return typeof message.requestId === "string" && message.requestId.length > 0;
}
