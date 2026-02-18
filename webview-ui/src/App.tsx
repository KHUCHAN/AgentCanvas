import { useEffect, useMemo, useState } from "react";
import type { Edge, Node } from "reactflow";
import GraphView from "./canvas/GraphView";
import { onExtensionMessage, postToExtension, requestToExtension } from "./messaging/vscodeBridge";
import type {
  AgentRole,
  CliBackend,
  DiscoverySnapshot,
  ExtensionToWebviewMessage,
  GeneratedAgentStructure,
  Position,
  PromptHistoryEntry,
  StudioEdge,
  StudioNode,
  SkillPackPreview
} from "./messaging/protocol";
import type { PatternIndexItem, PatternTemplate } from "./patterns/types";
import AgentDetailModal from "./panels/AgentDetailModal";
import AgentCreationModal from "./panels/AgentCreationModal";
import AgentPreviewModal from "./panels/AgentPreviewModal";
import CommandBar from "./panels/CommandBar";
import CommonRuleModal from "./panels/CommonRuleModal";
import ImportPreviewModal from "./panels/ImportPreviewModal";
import KeyboardHelpModal from "./panels/KeyboardHelpModal";
import LeftSidebar from "./panels/LeftSidebar";
import RightPanel from "./panels/RightPanel";
import SkillWizardModal from "./panels/SkillWizardModal";
import { getValidationCounts } from "./utils/validation";

export default function App() {
  const [snapshot, setSnapshot] = useState<DiscoverySnapshot>();
  const [selectedNode, setSelectedNode] = useState<Node>();
  const [selectedEdge, setSelectedEdge] = useState<Edge>();
  const [panelMode, setPanelMode] = useState<"library" | "inspector" | "prompt">("library");
  const [panelOpen, setPanelOpen] = useState(true);
  const [hiddenNodeIds, setHiddenNodeIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ level: "info" | "warning" | "error"; message: string }>();
  const [commandBarOpen, setCommandBarOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<SkillPackPreview>();
  const [commonRuleModalOpen, setCommonRuleModalOpen] = useState(false);
  const [skillWizardOpen, setSkillWizardOpen] = useState(false);
  const [saveSignal, setSaveSignal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false);
  const [agentCreationOpen, setAgentCreationOpen] = useState(false);
  const [agentDetailModal, setAgentDetailModal] = useState<{
    agentId: string;
    agentName: string;
  } | null>(null);
  const [promptBackends, setPromptBackends] = useState<CliBackend[]>([]);
  const [promptHistory, setPromptHistory] = useState<PromptHistoryEntry[]>([]);
  const [generationProgress, setGenerationProgress] = useState<{
    stage: "building_prompt" | "calling_cli" | "parsing_output" | "done" | "error";
    message: string;
    progress?: number;
  }>();
  const [generatedPreview, setGeneratedPreview] = useState<{
    structure: GeneratedAgentStructure;
    historyId?: string;
  }>();
  const [interactionPatterns, setInteractionPatterns] = useState<PatternIndexItem[]>([]);
  const [patternTemplates, setPatternTemplates] = useState<Record<string, PatternTemplate>>({});
  const [patternNodes, setPatternNodes] = useState<StudioNode[]>([]);
  const [patternEdges, setPatternEdges] = useState<StudioEdge[]>([]);
  const [activeFlowName, setActiveFlowName] = useState("default");

  useEffect(() => {
    const dispose = onExtensionMessage((message) => {
      handleExtensionMessage(message, {
        setSnapshot,
        setToast,
        setHiddenNodeIds,
        setSelectedNode,
        setSelectedEdge,
        setImportPreview,
        setPromptBackends,
        setPromptHistory,
        setGenerationProgress
      });
    });

    postToExtension({ type: "READY" });
    void requestToExtension({ type: "DETECT_CLI_BACKENDS" }).catch(showErrorToast);
    void requestToExtension({ type: "GET_PROMPT_HISTORY" }).catch(showErrorToast);
    return dispose;
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTextInput =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.getAttribute("contenteditable") === "true";

      if (isTextInput) {
        return;
      }

      if (event.shiftKey && event.key === "?") {
        event.preventDefault();
        setKeyboardHelpOpen(true);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    void loadInteractionPatternIndex()
      .then((items) => setInteractionPatterns(items))
      .catch(showErrorToast);
  }, []);

  const generatedAtText = useMemo(() => {
    if (!snapshot?.generatedAt) {
      return "-";
    }
    return new Date(snapshot.generatedAt).toLocaleTimeString();
  }, [snapshot?.generatedAt]);

  const composedSnapshot = useMemo(() => {
    if (!snapshot) {
      return undefined;
    }

    const nodeMap = new Map<string, StudioNode>();
    for (const node of snapshot.nodes) {
      nodeMap.set(node.id, node);
    }
    for (const node of patternNodes) {
      nodeMap.set(node.id, node);
    }

    const edgeMap = new Map<string, StudioEdge>();
    for (const edge of snapshot.edges) {
      edgeMap.set(edge.id, edge);
    }
    for (const edge of patternEdges) {
      edgeMap.set(edge.id, edge);
    }

    return {
      ...snapshot,
      nodes: [...nodeMap.values()],
      edges: [...edgeMap.values()]
    };
  }, [patternEdges, patternNodes, snapshot]);

  const summary = useMemo(() => {
    const skills = snapshot?.skills ?? [];
    let errors = 0;
    let warnings = 0;
    for (const skill of skills) {
      const counts = getValidationCounts(skill.validation);
      errors += counts.errors;
      warnings += counts.warnings;
    }
    return {
      skills: skills.length,
      rules: snapshot?.ruleDocs.length ?? 0,
      errors,
      warnings
    };
  }, [snapshot?.ruleDocs.length, snapshot?.skills]);

  const skillBaseOptions = useMemo(() => {
    const workspaceRoot = snapshot?.agent.workspaceRoot;
    const homeDir = snapshot?.agent.homeDir;
    const candidates = [
      workspaceRoot ? { label: "Project · .github/skills", path: `${workspaceRoot}/.github/skills` } : undefined,
      workspaceRoot ? { label: "Project · .claude/skills", path: `${workspaceRoot}/.claude/skills` } : undefined,
      workspaceRoot ? { label: "Project · .gemini/skills", path: `${workspaceRoot}/.gemini/skills` } : undefined,
      homeDir ? { label: "Personal · ~/.copilot/skills", path: `${homeDir}/.copilot/skills` } : undefined,
      homeDir ? { label: "Personal · ~/.claude/skills", path: `${homeDir}/.claude/skills` } : undefined,
      homeDir ? { label: "Personal · ~/.gemini/skills", path: `${homeDir}/.gemini/skills` } : undefined
    ].filter((item): item is { label: string; path: string } => Boolean(item));

    const seen = new Set<string>();
    const unique = candidates.filter((item) => {
      if (seen.has(item.path)) {
        return false;
      }
      seen.add(item.path);
      return true;
    });
    if (unique.length === 0) {
      return [{ label: "Project · .github/skills", path: ".github/skills" }];
    }
    return unique;
  }, [snapshot?.agent.homeDir, snapshot?.agent.workspaceRoot]);

  const defaultSkillBasePath = skillBaseOptions[0]?.path ?? ".github/skills";

  const createSkill = (name: string, description: string) => {
    postToExtension({
      type: "CREATE_SKILL",
      payload: {
        baseDirPath: defaultSkillBasePath,
        name,
        description,
        scope: "project"
      }
    });
  };

  const exportSkills = (skillIds: string[]) => {
    const ids = skillIds.length > 0 ? skillIds : snapshot?.skills.map((skill) => skill.id) ?? [];
    postToExtension({
      type: "EXPORT_PACK",
      payload: {
        skillIds: ids
      }
    });
  };

  const openFile = (path: string) => {
    if (!path) {
      return;
    }
    postToExtension({ type: "OPEN_FILE", payload: { path } });
  };

  const revealPath = (path: string) => {
    if (!path) {
      return;
    }
    postToExtension({ type: "REVEAL_IN_EXPLORER", payload: { path } });
  };

  const validateSkill = (skillId: string) => {
    if (!skillId) {
      return;
    }
    postToExtension({ type: "RUN_VALIDATION", payload: { skillId } });
  };

  const toggleSkillEnabled = (skillId: string, enabled: boolean) => {
    postToExtension({
      type: "SET_SKILL_ENABLED",
      payload: { skillId, enabled }
    });
  };

  const createOverride = (sourceRulePath: string) => {
    if (!sourceRulePath) {
      return;
    }
    postToExtension({
      type: "CREATE_OVERRIDE",
      payload: { sourceRulePath }
    });
  };

  const addCommonRule = (title: string, body: string) => {
    postToExtension({
      type: "ADD_COMMON_RULE",
      payload: { title, body }
    });
  };

  const saveSkillFrontmatter = (
    skillId: string,
    name: string,
    description: string,
    extraFrontmatter: Record<string, unknown>
  ) => {
    postToExtension({
      type: "UPDATE_SKILL_FRONTMATTER",
      payload: {
        skillId,
        name,
        description,
        extraFrontmatter
      }
    });
  };

  const hideNode = (nodeId: string) => {
    setHiddenNodeIds((prev) => {
      const next = new Set(prev);
      next.add(nodeId);
      return next;
    });

    if (selectedNode?.id === nodeId) {
      setSelectedNode(undefined);
      setPanelMode("library");
    }
  };

  const showErrorToast = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    setToast({ level: "error", message });
  };

  const refreshDiscovery = () => {
    postToExtension({ type: "REFRESH" });
    setHiddenNodeIds(new Set());
  };

  const runValidationAll = () => {
    setBusy(true);
    void requestToExtension<{ skills: number; errors: number; warnings: number }>({
      type: "RUN_VALIDATION_ALL"
    })
      .catch(showErrorToast)
      .finally(() => setBusy(false));
  };

  const requestImportPreview = () => {
    setBusy(true);
    void requestToExtension<{ previewed: number }>({
      type: "REQUEST_IMPORT_PREVIEW"
    })
      .catch(showErrorToast)
      .finally(() => setBusy(false));
  };

  const createSkillFromWizard = async (input: {
    baseDirPath: string;
    name: string;
    description: string;
    scope: "project" | "personal" | "shared" | "global";
    generateOpenAiYaml: boolean;
  }) => {
    setBusy(true);
    try {
      await requestToExtension({
        type: "CREATE_SKILL",
        payload: {
          baseDirPath: input.baseDirPath,
          name: input.name,
          description: input.description,
          scope: input.scope,
          extraFrontmatter: {
            metadata: {
              scope: input.scope
            }
          },
          generateOpenAiYaml: input.generateOpenAiYaml
        }
      });
      setSkillWizardOpen(false);
      setPanelMode("library");
      setPanelOpen(true);
    } catch (error) {
      showErrorToast(error);
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const addNote = (position: Position, text?: string) => {
    postToExtension({
      type: "ADD_NOTE",
      payload: {
        position,
        text
      }
    });
  };

  const saveNote = (noteId: string, text: string, position?: Position) => {
    postToExtension({
      type: "SAVE_NOTE",
      payload: {
        noteId,
        text,
        position
      }
    });
  };

  const deleteNote = (noteId: string) => {
    postToExtension({
      type: "DELETE_NOTE",
      payload: { noteId }
    });
  };

  const ensureRootAgents = () => {
    setBusy(true);
    void requestToExtension<{ path?: string }>({
      type: "ENSURE_ROOT_AGENTS"
    })
      .catch(showErrorToast)
      .finally(() => setBusy(false));
  };

  const openCommonRulesFolder = () => {
    setBusy(true);
    void requestToExtension<{ path?: string }>({
      type: "OPEN_COMMON_RULES_FOLDER"
    })
      .catch(showErrorToast)
      .finally(() => setBusy(false));
  };

  const createCommonRuleDocs = () => {
    setBusy(true);
    void requestToExtension<{ created?: string[] }>({
      type: "CREATE_COMMON_RULE_DOCS"
    })
      .catch(showErrorToast)
      .finally(() => setBusy(false));
  };

  const addAgentLink = (sourceAgentId: string, targetAgentId: string) => {
    postToExtension({
      type: "ADD_AGENT_LINK",
      payload: { sourceAgentId, targetAgentId }
    });
  };

  const updateAgentProfile = (payload: {
    agentId: string;
    role: AgentRole;
    roleLabel?: string;
    description?: string;
    systemPrompt?: string;
    isOrchestrator: boolean;
    color?: string;
    avatar?: string;
  }) => {
    postToExtension({
      type: "UPDATE_AGENT_PROFILE",
      payload
    });
  };

  const setAgentDelegation = (agentId: string, workerIds: string[]) => {
    postToExtension({
      type: "SET_DELEGATION",
      payload: { orchestratorId: agentId, workerIds }
    });
  };

  const assignSkillToAgent = (agentId: string, skillId: string) => {
    postToExtension({
      type: "ASSIGN_SKILL_TO_AGENT",
      payload: { agentId, skillId }
    });
  };

  const unassignSkillFromAgent = (agentId: string, skillId: string) => {
    postToExtension({
      type: "UNASSIGN_SKILL_FROM_AGENT",
      payload: { agentId, skillId }
    });
  };

  const assignMcpToAgent = (agentId: string, mcpServerId: string) => {
    postToExtension({
      type: "ASSIGN_MCP_TO_AGENT",
      payload: { agentId, mcpServerId }
    });
  };

  const unassignMcpFromAgent = (agentId: string, mcpServerId: string) => {
    postToExtension({
      type: "UNASSIGN_MCP_FROM_AGENT",
      payload: { agentId, mcpServerId }
    });
  };

  const createAgent = async (payload: {
    name: string;
    role: AgentRole;
    roleLabel?: string;
    description?: string;
    systemPrompt?: string;
    isOrchestrator: boolean;
  }) => {
    setBusy(true);
    try {
      await requestToExtension({
        type: "CREATE_AGENT",
        payload
      });
      setAgentCreationOpen(false);
      setPanelMode("inspector");
      setPanelOpen(true);
    } catch (error) {
      showErrorToast(error);
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const deleteAgent = async (agentId: string) => {
    setBusy(true);
    try {
      await requestToExtension({
        type: "DELETE_AGENT",
        payload: { agentId }
      });
      setAgentDetailModal(null);
    } catch (error) {
      showErrorToast(error);
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const refreshPromptTools = async () => {
    setBusy(true);
    try {
      await Promise.all([
        requestToExtension({ type: "DETECT_CLI_BACKENDS" }),
        requestToExtension({ type: "GET_PROMPT_HISTORY" })
      ]);
    } catch (error) {
      showErrorToast(error);
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const generateAgentStructure = async (payload: {
    prompt: string;
    backendId: CliBackend["id"];
    includeExistingAgents: boolean;
    includeExistingSkills: boolean;
    includeExistingMcpServers: boolean;
  }) => {
    setBusy(true);
    try {
      const result = await requestToExtension<{
        structure: GeneratedAgentStructure;
        historyEntry?: PromptHistoryEntry;
      }>(
        {
          type: "GENERATE_AGENT_STRUCTURE",
          payload
        },
        180_000
      );
      if (result.structure) {
        setGeneratedPreview({
          structure: result.structure,
          historyId: result.historyEntry?.id
        });
      }
      setPanelMode("prompt");
      setPanelOpen(true);
    } catch (error) {
      showErrorToast(error);
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const applyGeneratedStructure = async (payload: {
    structure: GeneratedAgentStructure;
    createSuggestedSkills: boolean;
    overwriteExisting: boolean;
    historyId?: string;
  }) => {
    setBusy(true);
    try {
      await requestToExtension({
        type: "APPLY_GENERATED_STRUCTURE",
        payload
      });
      setGeneratedPreview(undefined);
      setPanelMode("inspector");
      setPanelOpen(true);
    } catch (error) {
      showErrorToast(error);
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const deletePromptHistory = async (historyId: string) => {
    setBusy(true);
    try {
      await requestToExtension({
        type: "DELETE_PROMPT_HISTORY",
        payload: { historyId }
      });
    } catch (error) {
      showErrorToast(error);
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const reapplyPromptHistory = async (historyId: string) => {
    setBusy(true);
    try {
      await requestToExtension(
        {
          type: "REAPPLY_PROMPT_HISTORY",
          payload: { historyId }
        },
        120_000
      );
      setPanelMode("inspector");
      setPanelOpen(true);
    } catch (error) {
      showErrorToast(error);
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const insertInteractionPattern = async (patternId: string, anchor?: Position) => {
    setBusy(true);
    try {
      const template =
        patternTemplates[patternId] ?? (await loadInteractionPatternTemplate(patternId));
      if (!patternTemplates[patternId]) {
        setPatternTemplates((prev) => ({ ...prev, [patternId]: template }));
      }

      const invalidEdge = template.edges.find((edge) => !edge.data?.termination);
      if (invalidEdge) {
        throw new Error(`Pattern ${patternId} is invalid: termination is required`);
      }

      const instanceId = `pattern:${patternId}:${Date.now().toString(36)}`;
      const idMap = new Map<string, string>();
      const anchorX = anchor?.x ?? selectedNode?.position?.x ?? 860;
      const anchorY = anchor?.y ?? selectedNode?.position?.y ?? 220;

      const createdNodes: StudioNode[] = template.nodes.map((node, index) => {
        const id = `${instanceId}:n${index + 1}`;
        idMap.set(node.id, id);
        const position = {
          x: anchorX + (node.position?.x ?? index * 180),
          y: anchorY + (node.position?.y ?? (index % 2) * 130)
        };

        if (node.type === "system") {
          const role = String(node.data.role ?? "System");
          return {
            id,
            type: "system",
            position,
            data: {
              id,
              name: String(node.data.label ?? role),
              role,
              description: String(node.data.description ?? `${patternId} coordinator`)
            }
          };
        }

        const role = String(node.data.role ?? "custom");
        return {
          id,
          type: "agent",
          position,
          data: {
            id,
            ownerAgentId: id,
            name: String(node.data.label ?? role),
            providerId: "pattern",
            role: normalizeRole(role),
            roleLabel: role,
            description: String(node.data.description ?? `${patternId} participant`),
            isOrchestrator: normalizeRole(role) === "orchestrator",
            skillCount: 0,
            mcpCount: 0,
            avatar: "◦"
          }
        };
      });

      const createdEdges: StudioEdge[] = template.edges.map((edge, index) => ({
        id: `${instanceId}:e${index + 1}`,
        source: idMap.get(edge.source) ?? edge.source,
        target: idMap.get(edge.target) ?? edge.target,
        type: "interaction",
        label: edge.label || `${patternId}`,
        data: edge.data
      }));

      setPatternNodes((prev) => [...prev, ...createdNodes]);
      setPatternEdges((prev) => [...prev, ...createdEdges]);
      for (const edge of createdEdges) {
        postToExtension({
          type: "LOG_INTERACTION_EVENT",
          payload: {
            flowName: activeFlowName,
            interactionId: String((edge.data as Record<string, unknown> | undefined)?.patternId ?? patternId),
            edgeId: edge.id,
            event: "configured",
            data: edge.data as Record<string, unknown> | undefined
          }
        });
      }
      setPanelMode("inspector");
      setPanelOpen(true);
      setToast({
        level: "info",
        message: `Inserted pattern ${template.name} (${createdNodes.length} nodes, ${createdEdges.length} edges)`
      });
    } catch (error) {
      showErrorToast(error);
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const updateInteractionEdge = (edgeId: string, update: { label?: string; data?: Record<string, unknown> }) => {
    setPatternEdges((prev) =>
      prev.map((edge) =>
        edge.id === edgeId
          ? {
            ...edge,
            label: update.label ?? edge.label,
            data: {
              ...(edge.data ?? {}),
              ...(update.data ?? {})
            }
          }
          : edge
      )
    );
    postToExtension({
      type: "LOG_INTERACTION_EVENT",
      payload: {
        flowName: activeFlowName,
        interactionId: String(update.data?.patternId ?? "interaction"),
        edgeId,
        event: "updated",
        data: update.data
      }
    });
  };

  const saveFlow = async () => {
    setBusy(true);
    try {
      await requestToExtension({
        type: "SAVE_FLOW",
        payload: {
          flowName: activeFlowName,
          nodes: patternNodes,
          edges: patternEdges
        }
      });
      setToast({ level: "info", message: `Flow saved: ${activeFlowName}` });
    } catch (error) {
      showErrorToast(error);
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const loadFlow = async () => {
    setBusy(true);
    try {
      const listResult = await requestToExtension<{ flows: string[] }>({ type: "LIST_FLOWS" });
      const suggested = listResult.flows[0] ?? activeFlowName;
      const selected = window.prompt("Load flow name", suggested);
      if (!selected) {
        return;
      }
      const loaded = await requestToExtension<{
        flow: { flowName: string; nodes: StudioNode[]; edges: StudioEdge[] };
      }>({
        type: "LOAD_FLOW",
        payload: { flowName: selected }
      });

      setPatternNodes(loaded.flow.nodes ?? []);
      setPatternEdges(loaded.flow.edges ?? []);
      setActiveFlowName(loaded.flow.flowName || selected);
      setToast({ level: "info", message: `Flow loaded: ${loaded.flow.flowName || selected}` });
      setPanelMode("inspector");
      setPanelOpen(true);
    } catch (error) {
      showErrorToast(error);
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const commandItems = [
    {
      id: "refresh",
      title: "Refresh discovery",
      subtitle: "Rescan skills and rule docs",
      shortcut: "R",
      run: refreshDiscovery
    },
    {
      id: "node-library",
      title: "Open node library",
      subtitle: "Switch to library panel",
      shortcut: "Ctrl/Cmd+L",
      run: () => {
        setPanelMode("library");
        setPanelOpen(true);
      }
    },
    {
      id: "keyboard-help",
      title: "Show keyboard shortcuts",
      subtitle: "Open shortcut cheat sheet",
      shortcut: "Shift+?",
      run: () => setKeyboardHelpOpen(true)
    },
    {
      id: "new-skill",
      title: "Open skill wizard",
      subtitle: "Create SKILL.md template + optional openai.yaml",
      run: () => setSkillWizardOpen(true)
    },
    {
      id: "new-agent",
      title: "Create new agent",
      subtitle: "Open custom agent creation modal",
      run: () => setAgentCreationOpen(true)
    },
    {
      id: "prompt-panel",
      title: "Open AI prompt panel",
      subtitle: "Generate agent team from natural language",
      run: () => {
        setPanelMode("prompt");
        setPanelOpen(true);
      }
    },
    {
      id: "save-flow",
      title: "Save interaction flow",
      subtitle: "Write .agentcanvas/flows/<name>.yaml",
      run: () => void saveFlow()
    },
    {
      id: "load-flow",
      title: "Load interaction flow",
      subtitle: "Load .agentcanvas/flows/<name>.yaml",
      run: () => void loadFlow()
    },
    {
      id: "export-all",
      title: "Export all skills",
      subtitle: "Create a skill pack zip",
      run: () => exportSkills([])
    },
    {
      id: "validate-all",
      title: "Validate all skills",
      subtitle: "Run project-wide validation",
      run: runValidationAll
    },
    {
      id: "import-pack",
      title: "Import skill pack",
      subtitle: "Preview and install from zip",
      run: requestImportPreview
    },
    {
      id: "scan-workspace",
      title: "Scan workspace",
      subtitle: "Refresh canvas and unhide all nodes",
      run: refreshDiscovery
    },
    {
      id: "add-common-rule",
      title: "Add common rule",
      subtitle: "Append rule to workspace AGENTS.md",
      run: () => setCommonRuleModalOpen(true)
    },
    {
      id: "ensure-root-agents",
      title: "Ensure root AGENTS.md",
      subtitle: "Create workspace AGENTS.md if missing",
      run: ensureRootAgents
    },
    {
      id: "create-common-docs",
      title: "Create common ops docs",
      subtitle: "Generate AGENT_VISUALS / MCP_PLAN / AGENT_COMMS docs",
      run: createCommonRuleDocs
    },
    {
      id: "open-common-folder",
      title: "Open common rules folder",
      subtitle: "Reveal .agentcanvas/rules/common",
      run: openCommonRulesFolder
    },
    {
      id: "add-note",
      title: "Add sticky note",
      subtitle: "Use Shift+S on canvas",
      run: () => setToast({ level: "info", message: "Focus canvas and press Shift+S" })
    }
  ];

  return (
    <div className="studio-shell">
      <aside className="left-sidebar">
        <LeftSidebar snapshot={snapshot} />
      </aside>

      <section className="main-section">
        <header className="top-bar">
          <div className="top-meta">
            <div className="top-title">{snapshot?.agent.name ?? "Local Agent"}</div>
            <div className="top-subtitle">Last refresh: {generatedAtText}</div>
          </div>

          <div className="top-actions">
            <button title="Create new skill" onClick={() => setSkillWizardOpen(true)}>New Skill</button>
            <button title="Create new agent" onClick={() => setAgentCreationOpen(true)}>New Agent</button>
            <button title="Save interaction flow" onClick={() => void saveFlow()}>Save Flow</button>
            <button title="Load interaction flow" onClick={() => void loadFlow()}>Load Flow</button>
            <button title="Refresh discovery (R)" onClick={refreshDiscovery}>Refresh</button>
            <button title="Export all skills" onClick={() => exportSkills([])}>Export Pack</button>
            <button title="Import skill pack" onClick={requestImportPreview}>Import Pack</button>
            <button title="Validate all skills" onClick={runValidationAll}>Validate</button>
            <button onClick={() => setCommonRuleModalOpen(true)}>Common Rule</button>
            <button onClick={createCommonRuleDocs}>Ops Docs</button>
            <button title="Keyboard shortcuts (Shift+?)" onClick={() => setKeyboardHelpOpen(true)}>Shortcuts</button>
            <button
              onClick={() => {
                setPanelMode("prompt");
                setPanelOpen(true);
              }}
            >
              AI Prompt
            </button>
            <button onClick={() => setSaveSignal((current) => current + 1)}>Save</button>
            <button title="Open command bar (Ctrl/Cmd+K)" onClick={() => setCommandBarOpen(true)}>Command Bar</button>
            <button onClick={() => setPanelOpen((open) => !open)}>
              {panelOpen ? "Hide Panel" : "Show Panel"}
            </button>
            {busy && <button disabled>Working...</button>}
          </div>
        </header>

        <div className="workspace-body">
          <GraphView
            snapshot={composedSnapshot}
            hiddenNodeIds={hiddenNodeIds}
            onSelectNode={(node) => {
              setSelectedNode(node);
              setSelectedEdge(undefined);
              if (node) {
                setPanelMode("inspector");
                setPanelOpen(true);
              }
            }}
            onSelectEdge={(edge) => {
              setSelectedEdge(edge);
              setSelectedNode(undefined);
              if (edge) {
                setPanelMode("inspector");
                setPanelOpen(true);
              }
            }}
            onOpenFile={openFile}
            onCreateOverride={createOverride}
            onToggleSkill={toggleSkillEnabled}
            onHideNode={hideNode}
            onRevealPath={revealPath}
            onExportSkill={(skillId) => exportSkills([skillId])}
            onToggleLibrary={() => {
              setPanelMode("library");
              setPanelOpen(true);
            }}
            onAddCommonRule={() => setCommonRuleModalOpen(true)}
            onToggleCommandBar={() => setCommandBarOpen((open) => !open)}
            onCreateNote={addNote}
            onSaveNote={saveNote}
            onDeleteNote={deleteNote}
            onDuplicateNote={(text, position) => addNote(position, text)}
            onScanWorkspace={refreshDiscovery}
            onImportPack={requestImportPreview}
            onEnsureRootAgents={ensureRootAgents}
            onOpenCommonRulesFolder={openCommonRulesFolder}
            onCreateCommonRuleDocs={createCommonRuleDocs}
            onAddAgentLink={addAgentLink}
            onOpenAgentDetail={(agentId, agentName) =>
              setAgentDetailModal({ agentId, agentName })
            }
            onAssignSkillToAgent={assignSkillToAgent}
            onAssignMcpToAgent={assignMcpToAgent}
            onDropPattern={(patternId, position) => {
              void insertInteractionPattern(patternId, position).catch(() => undefined);
            }}
          />

          <RightPanel
            mode={panelMode}
            open={panelOpen}
            snapshot={composedSnapshot}
            selectedNode={selectedNode}
            selectedEdge={selectedEdge}
            onModeChange={setPanelMode}
            onOpenFile={openFile}
            onRevealPath={revealPath}
            onCreateSkill={createSkill}
            onExportSkills={exportSkills}
            onValidateSkill={validateSkill}
            onCreateOverride={createOverride}
            onSaveSkillFrontmatter={saveSkillFrontmatter}
            saveSignal={saveSignal}
            promptBackends={promptBackends}
            promptHistory={promptHistory}
            generationProgress={generationProgress}
            onRefreshPromptTools={refreshPromptTools}
            onGenerateAgentStructure={generateAgentStructure}
            onDeletePromptHistory={deletePromptHistory}
            onReapplyPromptHistory={reapplyPromptHistory}
            interactionPatterns={interactionPatterns}
            onInsertPattern={insertInteractionPattern}
            onUpdateInteractionEdge={updateInteractionEdge}
          />
        </div>

        <div className="status-bar">
          <span>Skills {summary.skills}</span>
          <span>Rules {summary.rules}</span>
          <span>Errors {summary.errors}</span>
          <span>Warnings {summary.warnings}</span>
          <span>Flow {activeFlowName}</span>
          <span>Focus Canvas</span>
        </div>
      </section>

      <CommandBar
        open={commandBarOpen}
        commands={commandItems}
        onClose={() => setCommandBarOpen(false)}
      />

      <SkillWizardModal
        open={skillWizardOpen}
        onClose={() => setSkillWizardOpen(false)}
        defaultBaseDirPath={defaultSkillBasePath}
        baseDirOptions={skillBaseOptions}
        onCreate={createSkillFromWizard}
      />

      <CommonRuleModal
        open={commonRuleModalOpen}
        onClose={() => setCommonRuleModalOpen(false)}
        onCreate={(title, body) => {
          addCommonRule(title, body);
          setCommonRuleModalOpen(false);
        }}
      />

      <ImportPreviewModal
        preview={importPreview}
        onClose={() => setImportPreview(undefined)}
        onConfirm={(installDirPath, overwrite) => {
          if (!importPreview) {
            return;
          }
          postToExtension({
            type: "CONFIRM_IMPORT_PACK",
            payload: {
              zipPath: importPreview.zipPath,
              installDirPath,
              overwrite
            }
          });
          setImportPreview(undefined);
        }}
      />

      <AgentDetailModal
        open={agentDetailModal !== null}
        agentId={agentDetailModal?.agentId ?? ""}
        agentName={agentDetailModal?.agentName ?? ""}
        snapshot={snapshot}
        onClose={() => setAgentDetailModal(null)}
        onOpenFile={openFile}
        onToggleSkill={toggleSkillEnabled}
        onRevealPath={revealPath}
        onCreateOverride={createOverride}
        onExportSkill={(skillId) => exportSkills([skillId])}
        onUpdateProfile={updateAgentProfile}
        onSetDelegation={setAgentDelegation}
        onAssignSkill={assignSkillToAgent}
        onUnassignSkill={unassignSkillFromAgent}
        onAssignMcp={assignMcpToAgent}
        onUnassignMcp={unassignMcpFromAgent}
        onDeleteAgent={(agentId) => void deleteAgent(agentId)}
      />

      <AgentCreationModal
        open={agentCreationOpen}
        onClose={() => setAgentCreationOpen(false)}
        onCreate={createAgent}
      />

      <AgentPreviewModal
        open={Boolean(generatedPreview)}
        structure={generatedPreview?.structure}
        historyId={generatedPreview?.historyId}
        onClose={() => setGeneratedPreview(undefined)}
        onApply={applyGeneratedStructure}
      />

      <KeyboardHelpModal open={keyboardHelpOpen} onClose={() => setKeyboardHelpOpen(false)} />

      {toast && (
        <div className={`toast ${toast.level}`} onAnimationEnd={() => setToast(undefined)}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

function handleExtensionMessage(
  message: ExtensionToWebviewMessage,
  handlers: {
    setSnapshot: (snapshot: DiscoverySnapshot | undefined) => void;
    setToast: (toast: { level: "info" | "warning" | "error"; message: string } | undefined) => void;
    setHiddenNodeIds: (next: Set<string> | ((previous: Set<string>) => Set<string>)) => void;
    setSelectedNode: (node: Node | undefined) => void;
    setSelectedEdge: (edge: Edge | undefined) => void;
    setImportPreview: (preview: SkillPackPreview | undefined) => void;
    setPromptBackends: (backends: CliBackend[]) => void;
    setPromptHistory: (items: PromptHistoryEntry[]) => void;
    setGenerationProgress: (progress: {
      stage: "building_prompt" | "calling_cli" | "parsing_output" | "done" | "error";
      message: string;
      progress?: number;
    } | undefined) => void;
  }
) {
  switch (message.type) {
    case "INIT_STATE": {
      handlers.setSnapshot(message.payload.snapshot);
      handlers.setHiddenNodeIds(new Set());
      handlers.setSelectedNode(undefined);
      handlers.setSelectedEdge(undefined);
      handlers.setImportPreview(undefined);
      return;
    }
    case "STATE_PATCH": {
      if (message.payload.snapshot) {
        handlers.setSnapshot(message.payload.snapshot);
      }
      return;
    }
    case "IMPORT_PREVIEW": {
      handlers.setImportPreview(message.payload.preview);
      return;
    }
    case "CLI_BACKENDS": {
      handlers.setPromptBackends(message.payload.backends);
      return;
    }
    case "PROMPT_HISTORY": {
      handlers.setPromptHistory(message.payload.items);
      return;
    }
    case "GENERATION_PROGRESS": {
      handlers.setGenerationProgress(message.payload);
      if (message.payload.stage === "done" || message.payload.stage === "error") {
        window.setTimeout(() => handlers.setGenerationProgress(undefined), 1600);
      }
      return;
    }
    case "TOAST": {
      handlers.setToast(message.payload);
      return;
    }
    case "ERROR": {
      handlers.setToast({
        level: "error",
        message: message.payload.detail
          ? `${message.payload.message}: ${message.payload.detail}`
          : message.payload.message
      });
      return;
    }
    case "RESPONSE_OK":
    case "RESPONSE_ERROR": {
      return;
    }
    default: {
      const exhaustive: never = message;
      void exhaustive;
    }
  }
}

async function loadInteractionPatternIndex(): Promise<PatternIndexItem[]> {
  const response = await fetch(new URL("./patterns/index.json", window.location.href).toString());
  if (!response.ok) {
    throw new Error(`Failed to load interaction pattern index (${response.status})`);
  }
  const payload = await response.json();
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload as PatternIndexItem[];
}

async function loadInteractionPatternTemplate(patternId: string): Promise<PatternTemplate> {
  const response = await fetch(new URL(`./patterns/${patternId}.json`, window.location.href).toString());
  if (!response.ok) {
    throw new Error(`Failed to load interaction pattern ${patternId} (${response.status})`);
  }
  const payload = (await response.json()) as PatternTemplate;
  if (!payload || !Array.isArray(payload.nodes) || !Array.isArray(payload.edges)) {
    throw new Error(`Pattern ${patternId} has invalid shape`);
  }
  return payload;
}

function normalizeRole(value: string): AgentRole {
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "orchestrator" ||
    normalized === "coder" ||
    normalized === "researcher" ||
    normalized === "reviewer" ||
    normalized === "planner" ||
    normalized === "tester" ||
    normalized === "writer"
  ) {
    return normalized;
  }
  return "custom";
}
