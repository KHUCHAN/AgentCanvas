import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import * as vscode from "vscode";
import { AgentSkillsProvider } from "./providers/agentSkillsProvider";
import { CodexGuidanceProvider } from "./providers/codexGuidanceProvider";
import type { Provider, ProviderContext } from "./providers/provider";
import { createSkillFromTemplate } from "./services/createSkill";
import { parseAgentStructure } from "./services/agentStructureParser";
import {
  ensureCommonRulesFolder,
  ensureDefaultCommonRuleDocs,
  ensureRootAgentsFile
} from "./services/commonRulesService";
import {
  applyAgentProfilePatch,
  assignMcpToAgent,
  assignSkillToAgent,
  createCustomAgentProfile,
  deleteAgentProfile,
  setAgentDelegation,
  unassignMcpFromAgent,
  unassignSkillFromAgent
} from "./services/agentProfileService";
import { detectAllCliBackends, pickPromptBackend } from "./services/cliDetector";
import { executeCliPrompt } from "./services/cliExecutor";
import { runDiscovery } from "./services/discovery";
import {
  listFlows as listFlowFiles,
  loadFlow as loadFlowFile,
  logInteractionEvent as writeInteractionLog,
  saveFlow as saveFlowFile,
  sanitizeFlowName
} from "./services/flowStore";
import { exists, getHomeDir } from "./services/pathUtils";
import { appendPromptHistory, findPromptHistory, markPromptHistoryApplied, readPromptHistory, removePromptHistory } from "./services/promptHistory";
import { buildAgentGenerationPrompt } from "./services/promptBuilder";
import { clearPin, getPin, setPin } from "./services/pinStore";
import {
  appendRunEvent,
  finishRun,
  listRuns as listRunHistory,
  loadRunEvents,
  startRun
} from "./services/runStore";
import { updateSkillFrontmatter } from "./services/skillEditor";
import { exportSkillPack, importSkillPack, previewSkillPack } from "./services/zipPack";
import { ScheduleService } from "./schedule/scheduleService";
import type {
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage
} from "./messages/protocol";
import { hasRequestId } from "./messages/protocol";
import type {
  AgentProfile,
  CliBackend,
  CliBackendId,
  CliBackendOverrides,
  DiscoverySnapshot,
  GeneratedAgentStructure,
  Task,
  TaskEvent,
  StudioEdge,
  StickyNote
} from "./types";

let panelController: AgentCanvasPanel | undefined;

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("agentCanvas.open", async () => {
      panelController = await AgentCanvasPanel.createOrShow(context);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("agentCanvas.refresh", async () => {
      panelController = await AgentCanvasPanel.createOrShow(context);
      await panelController.refreshState(true);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("agentCanvas.demoScheduleRun", async () => {
      panelController = await AgentCanvasPanel.createOrShow(context);
      await panelController.startDemoScheduleRun();
    })
  );
}

export function deactivate(): void {
  panelController = undefined;
}

class AgentCanvasPanel {
  private static readonly viewType = "agentCanvas.panel";
  private readonly providers: Provider[];
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionContext: vscode.ExtensionContext;
  private readonly scheduleService = new ScheduleService({ defaultEstimateMs: 120_000 });
  private snapshot: DiscoverySnapshot | undefined;
  private notes: StickyNote[] = [];
  private notesLoaded = false;
  private agentLinks: StudioEdge[] = [];
  private agentLinksLoaded = false;
  private nodePositions: Map<string, { x: number; y: number }> = new Map();
  private nodePositionsLoaded = false;
  private scheduleSubscriberByRunId = new Map<string, (event: TaskEvent) => void>();
  private demoRunTimers = new Map<string, NodeJS.Timeout>();
  private activeRunStops = new Map<string, () => void>();
  private activeRunFlowById = new Map<string, string>();

  private constructor(panel: vscode.WebviewPanel, extensionContext: vscode.ExtensionContext) {
    this.panel = panel;
    this.extensionContext = extensionContext;
    this.providers = [new AgentSkillsProvider(), new CodexGuidanceProvider()];

    this.panel.onDidDispose(() => {
      for (const [runId, subscriber] of this.scheduleSubscriberByRunId.entries()) {
        this.scheduleService.unsubscribe(runId, subscriber);
      }
      this.scheduleSubscriberByRunId.clear();
      for (const timer of this.demoRunTimers.values()) {
        clearInterval(timer);
      }
      this.demoRunTimers.clear();
      this.activeRunStops.clear();
      this.activeRunFlowById.clear();
      if (panelController === this) {
        panelController = undefined;
      }
    });

    this.panel.webview.onDidReceiveMessage((message: WebviewToExtensionMessage) => {
      this.handleMessage(message)
        .then((result) => {
          if (hasRequestId(message)) {
            this.respondOk(message.requestId, result);
          }
        })
        .catch((error) => {
          const detail = error instanceof Error ? error.message : String(error);
          if (hasRequestId(message)) {
            this.respondError(message.requestId, "AgentCanvas operation failed", detail);
          } else {
            this.postMessage({
              type: "ERROR",
              payload: {
                message: "AgentCanvas operation failed",
                detail
              }
            });
          }
        });
    });
  }

  public static async createOrShow(context: vscode.ExtensionContext): Promise<AgentCanvasPanel> {
    if (panelController) {
      panelController.panel.reveal(vscode.ViewColumn.One);
      return panelController;
    }

    const panel = vscode.window.createWebviewPanel(
      AgentCanvasPanel.viewType,
      "AgentCanvas",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, "webview-ui", "dist")
        ]
      }
    );

    const controller = new AgentCanvasPanel(panel, context);
    panelController = controller;
    await controller.ensureNotesLoaded();
    panel.webview.html = await controller.buildWebviewHtml();
    await controller.refreshState(true);
    return controller;
  }

  public async refreshState(asInitMessage = false): Promise<void> {
    await this.ensureNotesLoaded();
    await this.ensureAgentLinksLoaded();
    await this.ensureNodePositionsLoaded();
    const snapshot = await runDiscovery(await this.buildProviderContext(), this.providers);

    // Apply persisted node positions (from user drag)
    for (const node of snapshot.nodes) {
      const savedPosition = this.nodePositions.get(node.id);
      if (savedPosition) {
        node.position = { ...savedPosition };
      }
    }

    snapshot.nodes = [...snapshot.nodes, ...this.notes.map((note) => this.toNoteNode(note))];
    snapshot.edges = [...snapshot.edges, ...this.agentLinks];
    this.snapshot = snapshot;

    if (asInitMessage || !this.panel.visible) {
      this.postMessage({
        type: "INIT_STATE",
        payload: { snapshot }
      });
      return;
    }

    this.postMessage({
      type: "STATE_PATCH",
      payload: {
        snapshot
      }
    });
  }

  private async handleMessage(message: WebviewToExtensionMessage): Promise<unknown> {
    switch (message.type) {
      case "READY": {
        await this.refreshState(true);
        return { ok: true };
      }
      case "REFRESH": {
        await this.refreshState();
        this.toast("info", "State refreshed");
        return { ok: true };
      }
      case "OPEN_FILE": {
        await this.openFile(message.payload.path);
        return { opened: message.payload.path };
      }
      case "REVEAL_IN_EXPLORER": {
        await this.revealInExplorer(message.payload.path);
        return { revealed: message.payload.path };
      }
      case "CREATE_SKILL": {
        const skillFile = await this.createSkill(
          message.payload.baseDirPath,
          message.payload.name,
          message.payload.description,
          message.payload.scope,
          message.payload.extraFrontmatter,
          message.payload.generateOpenAiYaml
        );
        this.toast("info", `Created ${skillFile}`);
        await this.refreshState();
        return { skillFile };
      }
      case "UPDATE_SKILL_FRONTMATTER": {
        await this.saveSkillFrontmatter(
          message.payload.skillId,
          message.payload.name,
          message.payload.description,
          message.payload.extraFrontmatter
        );
        await this.refreshState();
        return { ok: true };
      }
      case "EXPORT_PACK": {
        await this.exportPack(message.payload.skillIds, message.payload.outputPath);
        await this.refreshState();
        return { ok: true };
      }
      case "REQUEST_IMPORT_PREVIEW": {
        const zipPath =
          "payload" in message && message.payload ? message.payload.zipPath : undefined;
        return await this.requestImportPreview(zipPath);
      }
      case "CONFIRM_IMPORT_PACK": {
        await this.importPack(
          message.payload.zipPath,
          message.payload.installDirPath,
          message.payload.overwrite
        );
        await this.refreshState();
        return { ok: true };
      }
      case "IMPORT_PACK": {
        await this.importPack(message.payload.zipPath, message.payload.installDirPath);
        await this.refreshState();
        return { ok: true };
      }
      case "RUN_VALIDATION": {
        return await this.runValidation(message.payload.skillId);
      }
      case "RUN_VALIDATION_ALL": {
        return await this.runValidationAll();
      }
      case "CREATE_OVERRIDE": {
        await this.createOverrideFile(message.payload.sourceRulePath);
        await this.refreshState();
        return { ok: true };
      }
      case "ADD_COMMON_RULE": {
        await this.addCommonRule(message.payload.title, message.payload.body);
        await this.refreshState();
        return { ok: true };
      }
      case "SET_SKILL_ENABLED": {
        this.setSkillEnabled(message.payload.skillId, message.payload.enabled);
        return { ok: true };
      }
      case "ADD_NOTE": {
        await this.addNote(message.payload.position, message.payload.text);
        await this.refreshState();
        return { ok: true };
      }
      case "SAVE_NOTE": {
        await this.saveNote(message.payload.noteId, message.payload.text, message.payload.position);
        await this.refreshState();
        return { ok: true };
      }
      case "DELETE_NOTE": {
        await this.deleteNote(message.payload.noteId);
        await this.refreshState();
        return { ok: true };
      }
      case "ENSURE_ROOT_AGENTS":
      {
        const agentsPath = await this.ensureRootAgents();
        await this.refreshState();
        return { path: agentsPath };
      }
      case "OPEN_COMMON_RULES_FOLDER": {
        const folderPath = await this.openCommonRulesFolder();
        return { path: folderPath };
      }
      case "CREATE_COMMON_RULE_DOCS": {
        const created = await this.createCommonRuleDocs();
        await this.refreshState();
        return { created };
      }
      case "ADD_AGENT_LINK": {
        await this.addAgentLink(
          message.payload.sourceAgentId,
          message.payload.targetAgentId
        );
        await this.refreshState();
        return { ok: true };
      }
      case "REMOVE_AGENT_LINK": {
        await this.removeAgentLink(
          message.payload.sourceAgentId,
          message.payload.targetAgentId
        );
        await this.refreshState();
        return { ok: true };
      }
      case "UPDATE_AGENT_PROFILE": {
        const agent = this.requireAgent(message.payload.agentId);
        await applyAgentProfilePatch({
          workspaceRoot: this.getWorkspaceRoot(),
          baseProfile: agent,
          patch: {
            role: message.payload.role,
            roleLabel: message.payload.roleLabel,
            description: message.payload.description,
            systemPrompt: message.payload.systemPrompt,
            isOrchestrator: message.payload.isOrchestrator,
            color: message.payload.color,
            avatar: message.payload.avatar
          }
        });
        await this.refreshState();
        return { ok: true };
      }
      case "ASSIGN_SKILL_TO_AGENT": {
        const agent = this.requireAgent(message.payload.agentId);
        await assignSkillToAgent({
          workspaceRoot: this.getWorkspaceRoot(),
          agent,
          skillId: message.payload.skillId
        });
        await this.refreshState();
        return { ok: true };
      }
      case "UNASSIGN_SKILL_FROM_AGENT": {
        const agent = this.requireAgent(message.payload.agentId);
        await unassignSkillFromAgent({
          workspaceRoot: this.getWorkspaceRoot(),
          agent,
          skillId: message.payload.skillId
        });
        await this.refreshState();
        return { ok: true };
      }
      case "ASSIGN_MCP_TO_AGENT": {
        const agent = this.requireAgent(message.payload.agentId);
        await assignMcpToAgent({
          workspaceRoot: this.getWorkspaceRoot(),
          agent,
          mcpServerId: message.payload.mcpServerId
        });
        await this.refreshState();
        return { ok: true };
      }
      case "UNASSIGN_MCP_FROM_AGENT": {
        const agent = this.requireAgent(message.payload.agentId);
        await unassignMcpFromAgent({
          workspaceRoot: this.getWorkspaceRoot(),
          agent,
          mcpServerId: message.payload.mcpServerId
        });
        await this.refreshState();
        return { ok: true };
      }
      case "SET_DELEGATION": {
        const agent = this.requireAgent(message.payload.orchestratorId);
        await setAgentDelegation({
          workspaceRoot: this.getWorkspaceRoot(),
          agent,
          workerIds: message.payload.workerIds
        });
        await this.refreshState();
        return { ok: true };
      }
      case "CREATE_AGENT": {
        const homeDir = this.snapshot?.agent.homeDir ?? getHomeDir();
        const profile = await createCustomAgentProfile({
          workspaceRoot: this.getWorkspaceRoot(),
          homeDir,
          name: message.payload.name,
          role: message.payload.role,
          roleLabel: message.payload.roleLabel,
          description: message.payload.description,
          systemPrompt: message.payload.systemPrompt,
          isOrchestrator: message.payload.isOrchestrator
        });
        await this.refreshState();
        return { agentId: profile.id };
      }
      case "DELETE_AGENT": {
        await deleteAgentProfile(this.getWorkspaceRoot(), message.payload.agentId);
        await this.refreshState();
        return { ok: true };
      }
      case "DETECT_CLI_BACKENDS": {
        const backends = await this.detectCliBackends();
        this.postMessage({
          type: "CLI_BACKENDS",
          payload: { backends }
        });
        return { backends };
      }
      case "GENERATE_AGENT_STRUCTURE": {
        try {
          const snapshot = await this.ensureSnapshot();
          const backends = await this.detectCliBackends();
          const backend = pickPromptBackend(backends, message.payload.backendId);

          this.postGenerationProgress("building_prompt", `Building prompt for ${backend.displayName}`, 15);
          const fullPrompt = buildAgentGenerationPrompt({
            userPrompt: message.payload.prompt,
            existingAgents: message.payload.includeExistingAgents ? snapshot.agents : [],
            existingSkills: message.payload.includeExistingSkills ? snapshot.skills : [],
            existingMcpServers: message.payload.includeExistingMcpServers ? snapshot.mcpServers : []
          });

          this.postGenerationProgress("calling_cli", `Calling ${backend.displayName}`, 45);
          const result = await executeCliPrompt({
            backend,
            prompt: fullPrompt,
            workspacePath: this.getWorkspaceRoot(),
            timeoutMs: 120_000
          });
          if (!result.success) {
            throw new Error(result.error || "CLI request failed");
          }

          this.postGenerationProgress("parsing_output", "Parsing generated structure", 75);
          const structure = parseAgentStructure(result.output);
          const historyEntry = await appendPromptHistory({
            workspaceRoot: this.getWorkspaceRoot(),
            prompt: message.payload.prompt,
            backendId: backend.id,
            result: structure,
            applied: false
          });
          this.postGenerationProgress("done", `Generated ${structure.agents.length} agent(s)`, 100);

          this.postMessage({
            type: "PROMPT_HISTORY",
            payload: { items: await readPromptHistory(this.getWorkspaceRoot()) }
          });

          return {
            structure,
            historyEntry,
            backend: backend.id,
            durationMs: result.durationMs
          };
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          this.postGenerationProgress("error", detail);
          throw error;
        }
      }
      case "APPLY_GENERATED_STRUCTURE": {
        await this.applyGeneratedStructure(
          message.payload.structure,
          message.payload.createSuggestedSkills,
          message.payload.overwriteExisting
        );
        if (message.payload.historyId) {
          await markPromptHistoryApplied(this.getWorkspaceRoot(), message.payload.historyId, true);
        }
        await this.refreshState();
        this.postMessage({
          type: "PROMPT_HISTORY",
          payload: { items: await readPromptHistory(this.getWorkspaceRoot()) }
        });
        return { ok: true, agentsCreated: message.payload.structure.agents.length };
      }
      case "GET_PROMPT_HISTORY": {
        const items = await readPromptHistory(this.getWorkspaceRoot());
        this.postMessage({ type: "PROMPT_HISTORY", payload: { items } });
        return { items };
      }
      case "DELETE_PROMPT_HISTORY": {
        await removePromptHistory(this.getWorkspaceRoot(), message.payload.historyId);
        const items = await readPromptHistory(this.getWorkspaceRoot());
        this.postMessage({ type: "PROMPT_HISTORY", payload: { items } });
        return { ok: true };
      }
      case "REAPPLY_PROMPT_HISTORY": {
        const item = await findPromptHistory(this.getWorkspaceRoot(), message.payload.historyId);
        if (!item) {
          throw new Error(`Prompt history not found: ${message.payload.historyId}`);
        }
        await this.applyGeneratedStructure(item.result, false, true);
        await markPromptHistoryApplied(this.getWorkspaceRoot(), item.id, true);
        await this.refreshState();
        this.postMessage({
          type: "PROMPT_HISTORY",
          payload: { items: await readPromptHistory(this.getWorkspaceRoot()) }
        });
        return { ok: true, historyId: item.id };
      }
      case "LIST_FLOWS": {
        return { flows: await this.listFlows() };
      }
      case "LOAD_FLOW": {
        return { flow: await this.loadFlow(message.payload.flowName) };
      }
      case "SAVE_FLOW": {
        const filePath = await this.saveFlow(
          message.payload.flowName,
          message.payload.nodes,
          message.payload.edges
        );
        this.toast("info", `Saved flow: ${filePath}`);
        return { path: filePath };
      }
      case "SAVE_NODE_POSITION": {
        await this.saveNodePosition(
          message.payload.nodeId,
          message.payload.position
        );
        return { ok: true };
      }
      case "SAVE_NODE_POSITIONS": {
        await this.saveNodePositions(message.payload.positions);
        return { ok: true };
      }
      case "SCHEDULE_SUBSCRIBE": {
        this.subscribeSchedule(message.payload.runId);
        return { ok: true };
      }
      case "SCHEDULE_UNSUBSCRIBE": {
        this.unsubscribeSchedule(message.payload.runId);
        return { ok: true };
      }
      case "SCHEDULE_GET_SNAPSHOT": {
        return { event: this.scheduleService.getSnapshotEvent(message.payload.runId) };
      }
      case "TASK_PIN": {
        await this.pinTask(message.payload.runId, message.payload.taskId, message.payload.pinned);
        return { ok: true };
      }
      case "TASK_MOVE": {
        await this.moveTask(
          message.payload.runId,
          message.payload.taskId,
          message.payload.forceStartMs,
          message.payload.forceAgentId
        );
        return { ok: true };
      }
      case "TASK_SET_PRIORITY": {
        await this.setTaskPriority(
          message.payload.runId,
          message.payload.taskId,
          message.payload.priority
        );
        return { ok: true };
      }
      case "RUN_FLOW": {
        return await this.runFlow({
          flowName: message.payload.flowName,
          backendId: message.payload.backendId,
          runName: message.payload.runName,
          tags: message.payload.tags,
          usePinnedOutputs: message.payload.usePinnedOutputs
        });
      }
      case "RUN_NODE": {
        return await this.runSingleNode({
          flowName: message.payload.flowName,
          nodeId: message.payload.nodeId,
          backendId: message.payload.backendId,
          usePinnedOutput: message.payload.usePinnedOutput
        });
      }
      case "STOP_RUN": {
        await this.stopRun(message.payload.runId);
        return { ok: true };
      }
      case "LIST_RUNS": {
        const flowName =
          "payload" in message && message.payload ? message.payload.flowName : undefined;
        return {
          runs: await listRunHistory({
            workspaceRoot: this.getWorkspaceRoot(),
            flowName,
            limit: 100
          })
        };
      }
      case "LOAD_RUN": {
        return {
          events: await loadRunEvents({
            workspaceRoot: this.getWorkspaceRoot(),
            flowName: message.payload.flowName,
            runId: message.payload.runId
          })
        };
      }
      case "PIN_OUTPUT": {
        const pin = await setPin({
          workspaceRoot: this.getWorkspaceRoot(),
          flowName: message.payload.flowName,
          nodeId: message.payload.nodeId,
          output: message.payload.output
        });
        return { pin };
      }
      case "UNPIN_OUTPUT": {
        await clearPin({
          workspaceRoot: this.getWorkspaceRoot(),
          flowName: message.payload.flowName,
          nodeId: message.payload.nodeId
        });
        return { ok: true };
      }
      case "SET_AGENT_RUNTIME": {
        await this.setAgentRuntime(message.payload.agentId, message.payload.runtime);
        await this.refreshState();
        return { ok: true };
      }
      case "SET_BACKEND_OVERRIDES": {
        await this.setBackendOverrides(message.payload.overrides);
        const backends = await this.detectCliBackends();
        this.postMessage({
          type: "CLI_BACKENDS",
          payload: { backends }
        });
        return { backends };
      }
      case "LOG_INTERACTION_EVENT": {
        await this.logInteractionEvent({
          flowName: message.payload.flowName,
          interactionId: message.payload.interactionId,
          edgeId: message.payload.edgeId,
          event: message.payload.event,
          data: message.payload.data
        });
        return { ok: true };
      }
      default: {
        const exhaustive: never = message;
        void exhaustive;
        return undefined;
      }
    }
  }

  private async buildProviderContext(): Promise<ProviderContext> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const workspacePath = workspaceFolder?.uri.fsPath ?? process.cwd();
    const chatConfig = vscode.workspace.getConfiguration("chat");
    const extraSkillLocations = chatConfig.get<string[]>("agentSkillsLocations", []);

    const extensionConfig = vscode.workspace.getConfiguration("agentCanvas");
    const codexProjectFallbackFileName = extensionConfig.get<string>(
      "codexProjectFallbackFileName",
      ""
    );

    return {
      workspaceRoot: workspacePath,
      workspacePath,
      homeDir: getHomeDir(),
      extraSkillLocations,
      codexProjectFallbackFileName: codexProjectFallbackFileName || undefined
    };
  }

  private async buildWebviewHtml(): Promise<string> {
    const devServerUrl = vscode.workspace
      .getConfiguration("agentCanvas")
      .get<string>("webviewDevServerUrl", "")
      .trim();

    if (devServerUrl) {
      const devHtml = await this.buildDevServerHtml(devServerUrl);
      if (devHtml) {
        return devHtml;
      }
    }

    const distUri = vscode.Uri.joinPath(this.extensionContext.extensionUri, "webview-ui", "dist");
    const indexUri = vscode.Uri.joinPath(distUri, "index.html");

    let rawHtml = "";
    try {
      rawHtml = await readFile(indexUri.fsPath, "utf8");
    } catch {
      return this.fallbackHtml("Build webview assets first with `npm run build:webview`.");
    }

    const webview = this.panel.webview;
    const nonce = randomBytes(16).toString("base64");

    const assetReplaced = rawHtml.replace(/(src|href)="(.+?)"/g, (_whole, attr: string, assetPath: string) => {
      if (/^(https?:|vscode-webview-resource:|data:)/.test(assetPath)) {
        return `${attr}=\"${assetPath}\"`;
      }
      const targetUri = vscode.Uri.joinPath(distUri, assetPath);
      const webviewUri = webview.asWebviewUri(targetUri);
      return `${attr}=\"${webviewUri}\"`;
    });

    const csp = [
      `default-src 'none'`,
      `img-src ${webview.cspSource} https: data:`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `font-src ${webview.cspSource}`,
      `script-src 'nonce-${nonce}' ${webview.cspSource}`
    ].join("; ");

    let html = assetReplaced.replace(/<head>/i, `<head>\n<meta http-equiv=\"Content-Security-Policy\" content=\"${csp}\">`);

    html = html.replace(/<script type="module" /g, `<script nonce=\"${nonce}\" type=\"module\" `);
    return html;
  }

  private fallbackHtml(message: string): string {
    const safeMessage = escapeHtml(message);
    const logo = `
      <svg width="360" height="84" viewBox="0 0 360 84" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="AgentCanvas">
        <rect x="2" y="2" width="64" height="64" rx="14" stroke="#2FA184" stroke-width="4" />
        <circle cx="34" cy="42" r="7" fill="#2FA184" />
        <line x1="34" y1="18" x2="34" y2="33" stroke="#2FA184" stroke-width="4" stroke-linecap="round" />
        <line x1="34" y1="42" x2="16" y2="54" stroke="#2FA184" stroke-width="4" stroke-linecap="round" />
        <line x1="34" y1="42" x2="52" y2="54" stroke="#2FA184" stroke-width="4" stroke-linecap="round" />
        <text x="84" y="49" fill="#D7DCE5" font-size="34" font-family="Inter, Segoe UI, Arial, sans-serif" font-weight="600">AgentCanvas</text>
      </svg>
    `;
    return `<!doctype html>
<html>
  <body style="font-family: Inter, Segoe UI, Arial, sans-serif; color: #d7dce5; background: #181b20; margin: 0;">
    <main style="min-height: 100vh; display: grid; place-items: center; padding: 24px;">
      <section style="width: min(720px, 100%); border: 1px solid rgba(215,220,229,0.18); border-radius: 16px; background: #1f232a; padding: 24px;">
        ${logo}
        <p style="margin: 14px 0 0; color: #d7dce5;">${safeMessage}</p>
      </section>
    </main>
  </body>
</html>`;
  }

  private postMessage(message: ExtensionToWebviewMessage): void {
    this.panel.webview.postMessage(message);
  }

  private respondOk(inReplyTo: string, result?: unknown): void {
    this.postMessage({
      type: "RESPONSE_OK",
      inReplyTo,
      result
    });
  }

  private respondError(inReplyTo: string, message: string, detail?: string): void {
    this.postMessage({
      type: "RESPONSE_ERROR",
      inReplyTo,
      error: {
        message,
        detail
      }
    });
  }

  private toast(level: "info" | "warning" | "error", message: string): void {
    this.postMessage({
      type: "TOAST",
      payload: { level, message }
    });
  }

  private async openFile(path: string): Promise<void> {
    const uri = vscode.Uri.file(path);
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, { preview: false });
  }

  private async revealInExplorer(path: string): Promise<void> {
    const target = vscode.Uri.file(path);
    await vscode.commands.executeCommand("revealFileInOS", target);
  }

  private async createSkill(
    baseDirPath: string,
    name: string,
    description: string,
    scope?: "project" | "personal" | "shared" | "global",
    extraFrontmatter?: Record<string, unknown>,
    generateOpenAiYaml?: boolean
  ): Promise<string> {
    const created = await createSkillFromTemplate({
      baseDirPath: resolve(baseDirPath),
      name,
      description,
      scope,
      extraFrontmatter,
      generateOpenAiYaml
    });
    return created.skillFilePath;
  }

  private async exportPack(skillIds: string[], outputPath?: string): Promise<void> {
    if (!this.snapshot) {
      this.toast("warning", "Nothing to export yet");
      return;
    }

    const selectedSkills = this.snapshot.skills.filter((skill) => skillIds.includes(skill.id));
    if (selectedSkills.length === 0) {
      this.toast("warning", "Select at least one skill to export");
      return;
    }

    const finalOutput = outputPath ?? (await this.requestPackSaveLocation());
    if (!finalOutput) {
      return;
    }

    await exportSkillPack({
      skills: selectedSkills,
      outputPath: finalOutput,
      workspacePath: this.snapshot.agent.workspaceRoot
    });

    this.toast("info", `Exported ${selectedSkills.length} skill(s) to ${finalOutput}`);
  }

  private async importPack(
    zipPath?: string,
    installDirPath?: string,
    overwrite = false
  ): Promise<void> {
    const selectedZip = zipPath ?? (await this.requestZipImportLocation());
    if (!selectedZip) {
      return;
    }

    const installDir = installDirPath ?? (await this.requestInstallDirectory());
    if (!installDir) {
      return;
    }

    const result = await importSkillPack({
      zipPath: selectedZip,
      installDir,
      overwrite
    });

    if (result.warnings.length > 0) {
      this.toast("warning", result.warnings.join(" | "));
    }
    this.toast("info", `Imported ${result.installed.length} skill(s) to ${installDir}`);
  }

  private async requestImportPreview(zipPath?: string): Promise<{ previewed: number } | undefined> {
    const selectedZip = zipPath ?? (await this.requestZipImportLocation());
    if (!selectedZip) {
      return undefined;
    }

    const installDirDefault =
      (this.snapshot?.agent.workspaceRoot
        ? join(this.snapshot.agent.workspaceRoot, ".github", "skills")
        : undefined) ?? process.cwd();

    const preview = await previewSkillPack({
      zipPath: selectedZip,
      installDirDefault
    });

    this.postMessage({
      type: "IMPORT_PREVIEW",
      payload: { preview }
    });
    return { previewed: preview.skills.length };
  }

  private async saveSkillFrontmatter(
    skillId: string,
    name: string,
    description: string,
    extraFrontmatter: Record<string, unknown>
  ): Promise<void> {
    if (!this.snapshot) {
      this.toast("warning", "No snapshot loaded");
      return;
    }

    const skill = this.snapshot.skills.find((item) => item.id === skillId);
    if (!skill) {
      this.toast("warning", "Skill not found");
      return;
    }

    await updateSkillFrontmatter({
      skillFilePath: skill.path,
      name: name.trim(),
      description: description.trim(),
      extraFrontmatter
    });

    this.toast("info", `Saved frontmatter: ${skill.name}`);
  }

  private async runValidation(skillId: string): Promise<{ errors: number; warnings: number }> {
    await this.refreshState();
    if (!this.snapshot) {
      return { errors: 0, warnings: 0 };
    }

    const target = this.snapshot.skills.find((skill) => skill.id === skillId);
    if (!target) {
      this.toast("warning", "Skill no longer exists");
      return { errors: 0, warnings: 0 };
    }

    const errorCount = target.validation.filter((item) => item.level === "error").length;
    const warningCount = target.validation.filter((item) => item.level === "warning").length;
    this.toast("info", `Validation: ${errorCount} error(s), ${warningCount} warning(s)`);
    return { errors: errorCount, warnings: warningCount };
  }

  private async runValidationAll(): Promise<{ skills: number; errors: number; warnings: number }> {
    await this.refreshState();
    if (!this.snapshot) {
      return { skills: 0, errors: 0, warnings: 0 };
    }

    let errorCount = 0;
    let warningCount = 0;
    for (const skill of this.snapshot.skills) {
      errorCount += skill.validation.filter((item) => item.level === "error").length;
      warningCount += skill.validation.filter((item) => item.level === "warning").length;
    }

    this.toast(
      "info",
      `Validate all: ${this.snapshot.skills.length} skill(s), ${errorCount} error(s), ${warningCount} warning(s)`
    );
    return {
      skills: this.snapshot.skills.length,
      errors: errorCount,
      warnings: warningCount
    };
  }

  private setSkillEnabled(skillId: string, enabled: boolean): void {
    if (!this.snapshot) {
      return;
    }

    this.snapshot = {
      ...this.snapshot,
      skills: this.snapshot.skills.map((skill) =>
        skill.id === skillId
          ? {
            ...skill,
            enabled
          }
          : skill
      ),
      nodes: this.snapshot.nodes.map((node) => {
        if (node.type !== "skill") {
          return node;
        }
        const nodeSkillId = (node.data.id as string | undefined) ?? "";
        if (nodeSkillId !== skillId) {
          return node;
        }
        return {
          ...node,
          data: {
            ...node.data,
            enabled
          }
        };
      })
    };

    this.postMessage({
      type: "STATE_PATCH",
      payload: {
        snapshot: this.snapshot,
        skillEnabled: {
          skillId,
          enabled
        }
      }
    });
  }

  private async createOverrideFile(sourceRulePath: string): Promise<void> {
    const overrideUri = vscode.Uri.file(join(dirname(sourceRulePath), "AGENTS.override.md"));

    try {
      await vscode.workspace.fs.stat(overrideUri);
      this.toast("warning", `Override already exists: ${overrideUri.fsPath}`);
      await this.openFile(overrideUri.fsPath);
      return;
    } catch {
      // Continue and create file when it doesn't exist.
    }

    await vscode.workspace.fs.writeFile(
      overrideUri,
      Buffer.from(`# AGENTS Override\n\nAdd local overrides here.\n`, "utf8")
    );
    this.toast("info", `Created override: ${overrideUri.fsPath}`);
    await this.openFile(overrideUri.fsPath);
  }

  private async addCommonRule(title: string, body: string): Promise<void> {
    const workspaceRoot = this.getWorkspaceRoot();

    const agentsPath = join(workspaceRoot, "AGENTS.md");
    const heading = title.trim() || "Common Rule";
    const content = body.trim();
    if (!content) {
      this.toast("warning", "Rule content is empty");
      return;
    }

    let nextContent = "";
    try {
      const existing = await readFile(agentsPath, "utf8");
      nextContent = `${existing.trimEnd()}\n\n## ${heading}\n${content}\n`;
    } catch {
      nextContent = `# AGENTS\n\n## ${heading}\n${content}\n`;
    }

    await writeFile(agentsPath, nextContent, "utf8");
    this.toast("info", `Common rule added to ${agentsPath}`);
    await this.openFile(agentsPath);
  }

  private async ensureAgentLinksLoaded(): Promise<void> {
    if (this.agentLinksLoaded) {
      return;
    }
    this.agentLinks = this.extensionContext.workspaceState.get<StudioEdge[]>(
      this.getAgentLinksStorageKey(),
      []
    );
    this.agentLinksLoaded = true;
  }

  private getAgentLinksStorageKey(): string {
    const workspacePath =
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ??
      this.snapshot?.agent.workspaceRoot ??
      process.cwd();
    return `agentCanvas.agentLinks:${workspacePath}`;
  }

  private async persistAgentLinks(): Promise<void> {
    await this.extensionContext.workspaceState.update(
      this.getAgentLinksStorageKey(),
      this.agentLinks
    );
  }

  private async addAgentLink(sourceAgentId: string, targetAgentId: string): Promise<void> {
    await this.ensureAgentLinksLoaded();
    const edgeId = `agentLink:${sourceAgentId}:${targetAgentId}`;
    const exists = this.agentLinks.some((link) => link.id === edgeId);
    if (exists) {
      this.toast("info", "Agent link already exists");
      return;
    }
    this.agentLinks.push({
      id: edgeId,
      source: sourceAgentId,
      target: targetAgentId,
      type: "agentLink"
    });
    await this.persistAgentLinks();
    this.toast("info", "Agent link created");
  }

  private async removeAgentLink(sourceAgentId: string, targetAgentId: string): Promise<void> {
    await this.ensureAgentLinksLoaded();
    const edgeId = `agentLink:${sourceAgentId}:${targetAgentId}`;
    const previousLength = this.agentLinks.length;
    this.agentLinks = this.agentLinks.filter((link) => link.id !== edgeId);
    if (this.agentLinks.length !== previousLength) {
      await this.persistAgentLinks();
      this.toast("info", "Agent link removed");
    }
  }

  private async ensureNodePositionsLoaded(): Promise<void> {
    if (this.nodePositionsLoaded) {
      return;
    }
    const stored = this.extensionContext.workspaceState.get<
      Array<[string, { x: number; y: number }]>
    >(this.getNodePositionsStorageKey(), []);
    this.nodePositions = new Map(stored);
    this.nodePositionsLoaded = true;
  }

  private getNodePositionsStorageKey(): string {
    const workspacePath =
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ??
      this.snapshot?.agent.workspaceRoot ??
      process.cwd();
    return `agentCanvas.nodePositions:${workspacePath}`;
  }

  private async persistNodePositions(): Promise<void> {
    await this.extensionContext.workspaceState.update(
      this.getNodePositionsStorageKey(),
      [...this.nodePositions.entries()]
    );
  }

  private async saveNodePosition(
    nodeId: string,
    position: { x: number; y: number }
  ): Promise<void> {
    await this.ensureNodePositionsLoaded();
    this.nodePositions.set(nodeId, position);
    await this.persistNodePositions();
  }

  private async saveNodePositions(
    positions: Array<{ nodeId: string; position: { x: number; y: number } }>
  ): Promise<void> {
    await this.ensureNodePositionsLoaded();
    for (const entry of positions) {
      this.nodePositions.set(entry.nodeId, entry.position);
    }
    await this.persistNodePositions();
  }

  private async ensureNotesLoaded(): Promise<void> {
    if (this.notesLoaded) {
      return;
    }
    this.notes = this.extensionContext.workspaceState.get<StickyNote[]>(
      this.getNotesStorageKey(),
      []
    );
    this.notesLoaded = true;
  }

  private getNotesStorageKey(): string {
    const workspacePath =
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ??
      this.snapshot?.agent.workspaceRoot ??
      process.cwd();
    return `agentCanvas.notes:${workspacePath}`;
  }

  private async persistNotes(): Promise<void> {
    await this.extensionContext.workspaceState.update(this.getNotesStorageKey(), this.notes);
  }

  private toNoteNode(note: StickyNote): DiscoverySnapshot["nodes"][number] {
    return {
      id: note.id,
      type: "note",
      position: note.position,
      data: {
        id: note.id,
        noteId: note.id,
        text: note.text
      }
    };
  }

  private async addNote(position: { x: number; y: number }, text?: string): Promise<void> {
    await this.ensureNotesLoaded();
    this.notes.push({
      id: `note:${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      text: text?.trim() || "Quick note",
      position
    });
    await this.persistNotes();
  }

  private async saveNote(
    noteId: string,
    text: string,
    position?: { x: number; y: number }
  ): Promise<void> {
    await this.ensureNotesLoaded();
    const target = this.notes.find((item) => item.id === noteId);
    if (!target) {
      return;
    }
    target.text = text;
    if (position) {
      target.position = position;
    }
    await this.persistNotes();
  }

  private async deleteNote(noteId: string): Promise<void> {
    await this.ensureNotesLoaded();
    const previousLength = this.notes.length;
    this.notes = this.notes.filter((item) => item.id !== noteId);
    if (this.notes.length !== previousLength) {
      await this.persistNotes();
    }
  }

  private async requestPackSaveLocation(): Promise<string | undefined> {
    const uri = await vscode.window.showSaveDialog({
      saveLabel: "Export Skill Pack",
      filters: {
        "Zip Archive": ["zip"]
      },
      defaultUri: vscode.Uri.file(join(process.cwd(), "agent-skill-pack.zip"))
    });
    return uri?.fsPath;
  }

  private async requestZipImportLocation(): Promise<string | undefined> {
    const picks = await vscode.window.showOpenDialog({
      canSelectMany: false,
      openLabel: "Import Skill Pack",
      filters: {
        "Zip Archive": ["zip"]
      }
    });
    return picks?.[0]?.fsPath;
  }

  private async requestInstallDirectory(): Promise<string | undefined> {
    const workspacePath = this.snapshot?.agent.workspaceRoot ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const defaultDir = workspacePath ? join(workspacePath, ".github", "skills") : undefined;

    const picks = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectMany: false,
      canSelectFolders: true,
      openLabel: "Install Skills",
      defaultUri: defaultDir ? vscode.Uri.file(defaultDir) : undefined
    });

    return picks?.[0]?.fsPath ?? defaultDir;
  }

  private getWorkspaceRoot(): string {
    return (
      this.snapshot?.agent.workspaceRoot ??
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ??
      process.cwd()
    );
  }

  private requireAgent(agentId: string): AgentProfile {
    if (!this.snapshot) {
      throw new Error("No snapshot loaded");
    }
    const agent = this.snapshot.agents.find((item) => item.id === agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    return agent;
  }

  private async ensureRootAgents(): Promise<string> {
    const workspaceRoot = this.getWorkspaceRoot();
    const agentsPath = await ensureRootAgentsFile(workspaceRoot);
    this.toast("info", `Prepared root AGENTS.md: ${agentsPath}`);
    await this.openFile(agentsPath);
    return agentsPath;
  }

  private async openCommonRulesFolder(): Promise<string> {
    const workspaceRoot = this.getWorkspaceRoot();
    const folderPath = await ensureCommonRulesFolder(workspaceRoot);
    await this.revealInExplorer(folderPath);
    this.toast("info", `Opened common rules folder: ${folderPath}`);
    return folderPath;
  }

  private async createCommonRuleDocs(): Promise<string[]> {
    const workspaceRoot = this.getWorkspaceRoot();
    const created = await ensureDefaultCommonRuleDocs(workspaceRoot);
    if (created.length === 0) {
      this.toast("info", "Common rule docs already exist");
    } else {
      this.toast("info", `Created ${created.length} common rule doc(s)`);
      await this.openFile(created[0]);
    }
    return created;
  }

  private async listFlows(): Promise<string[]> {
    return await listFlowFiles(this.getWorkspaceRoot());
  }

  private async saveFlow(
    flowName: string,
    nodes: DiscoverySnapshot["nodes"],
    edges: DiscoverySnapshot["edges"]
  ): Promise<string> {
    return await saveFlowFile({
      workspaceRoot: this.getWorkspaceRoot(),
      flowName,
      nodes,
      edges
    });
  }

  private async loadFlow(
    flowName: string
  ): Promise<{ flowName: string; nodes: DiscoverySnapshot["nodes"]; edges: DiscoverySnapshot["edges"] }> {
    return await loadFlowFile({
      workspaceRoot: this.getWorkspaceRoot(),
      flowName
    });
  }

  private async logInteractionEvent(input: {
    flowName: string;
    interactionId: string;
    edgeId: string;
    event: string;
    data?: Record<string, unknown>;
  }): Promise<void> {
    await writeInteractionLog({
      workspaceRoot: this.getWorkspaceRoot(),
      flowName: input.flowName,
      interactionId: input.interactionId,
      edgeId: input.edgeId,
      event: input.event,
      data: input.data
    });
  }

  public async startDemoScheduleRun(): Promise<{ runId: string }> {
    const workspaceRoot = this.getWorkspaceRoot();
    const flowName = "demo-schedule";
    const run = await startRun({
      workspaceRoot,
      flowName,
      backendId: "auto",
      runName: "Demo Schedule"
    });
    const runId = run.runId;

    const agentIds =
      (this.snapshot?.agents ?? []).slice(0, 3).map((agent) => agent.id).length >= 3
        ? (this.snapshot?.agents ?? []).slice(0, 3).map((agent) => agent.id)
        : ["demo:planner", "demo:coder", "demo:tester"];

    const taskTemplates: Array<{ id: string; title: string; lane: number; deps: string[] }> = [
      { id: "t1", title: "Collect requirements", lane: 0, deps: [] },
      { id: "t2", title: "Design architecture", lane: 0, deps: ["t1"] },
      { id: "t3", title: "Implement API", lane: 1, deps: ["t2"] },
      { id: "t4", title: "Implement UI", lane: 1, deps: ["t2"] },
      { id: "t5", title: "Write integration tests", lane: 2, deps: ["t3", "t4"] },
      { id: "t6", title: "Run test suite", lane: 2, deps: ["t5"] },
      { id: "t7", title: "Fix regressions", lane: 1, deps: ["t6"] },
      { id: "t8", title: "Review and merge", lane: 0, deps: ["t7"] },
      { id: "t9", title: "Prepare release notes", lane: 2, deps: ["t8"] },
      { id: "t10", title: "Ship release", lane: 0, deps: ["t8", "t9"] }
    ];

    const idMap = new Map<string, string>();
    const now = Date.now();
    const tasks: Task[] = taskTemplates.map((template, index) => {
      const taskId = `task:${runId}:${template.id}`;
      idMap.set(template.id, taskId);
      return {
        id: taskId,
        title: template.title,
        agentId: agentIds[template.lane] ?? agentIds[0],
        deps: [],
        estimateMs: 90_000 + (index % 3) * 45_000,
        status: "planned",
        progress: 0,
        meta: {
          nodeId: template.id,
          source: "demo"
        },
        createdAtMs: now + index,
        updatedAtMs: now + index
      };
    });

    for (const template of taskTemplates) {
      const taskId = idMap.get(template.id);
      if (!taskId) {
        continue;
      }
      const task = tasks.find((item) => item.id === taskId);
      if (!task) {
        continue;
      }
      task.deps = template.deps.map((dep) => idMap.get(dep)).filter((dep): dep is string => Boolean(dep));
    }

    this.scheduleService.createRun(runId, tasks);
    this.activeRunFlowById.set(runId, flowName);

    let stopped = false;
    const stop = () => {
      stopped = true;
    };
    this.activeRunStops.set(runId, stop);

    const timer = setInterval(async () => {
      try {
        const current = this.scheduleService.getTasks(runId);
        const running = current.find((task) => task.status === "running");

        if (stopped) {
          for (const task of current) {
            if (task.status === "done" || task.status === "failed" || task.status === "canceled") {
              continue;
            }
            this.scheduleService.patchTask(runId, task.id, {
              status: "canceled",
              actualEndMs: Date.now()
            });
          }
          this.scheduleService.recompute(runId);
          await finishRun({
            workspaceRoot,
            flowName,
            runId,
            status: "stopped",
            message: "Stopped by user"
          });
          clearInterval(timer);
          this.demoRunTimers.delete(runId);
          this.activeRunStops.delete(runId);
          this.activeRunFlowById.delete(runId);
          return;
        }

        if (running) {
          const nextProgress = Math.min(1, (running.progress ?? 0) + 0.25);
          if (nextProgress >= 1) {
            this.scheduleService.patchTask(runId, running.id, {
              progress: 1,
              status: "done",
              actualEndMs: Date.now()
            });
            await appendRunEvent({
              workspaceRoot,
              flowName,
              event: {
                ts: Date.now(),
                flow: flowName,
                runId,
                type: "node_output",
                nodeId: String(running.meta?.nodeId ?? running.id),
                output: {
                  summary: `${running.title} completed`
                }
              }
            });
          } else {
            this.scheduleService.patchTask(runId, running.id, { progress: nextProgress });
          }
          this.scheduleService.recompute(runId);
        } else {
          const runnable = current.find((task) => {
            if (!(task.status === "planned" || task.status === "ready")) {
              return false;
            }
            return task.deps.every((depId) => current.find((item) => item.id === depId)?.status === "done");
          });

          if (runnable) {
            this.scheduleService.patchTask(runId, runnable.id, {
              status: "running",
              progress: 0,
              actualStartMs: Date.now()
            });
            await appendRunEvent({
              workspaceRoot,
              flowName,
              event: {
                ts: Date.now(),
                flow: flowName,
                runId,
                type: "node_started",
                nodeId: String(runnable.meta?.nodeId ?? runnable.id),
                input: {
                  title: runnable.title
                }
              }
            });
            this.scheduleService.recompute(runId);
          } else if (
            current.every(
              (task) =>
                task.status === "done" ||
                task.status === "failed" ||
                task.status === "canceled"
            )
          ) {
            await finishRun({
              workspaceRoot,
              flowName,
              runId,
              status: "success"
            });
            clearInterval(timer);
            this.demoRunTimers.delete(runId);
            this.activeRunStops.delete(runId);
            this.activeRunFlowById.delete(runId);
            this.toast("info", `Demo schedule run complete: ${runId}`);
          }
        }
      } catch (error) {
        clearInterval(timer);
        this.demoRunTimers.delete(runId);
        this.activeRunStops.delete(runId);
        this.activeRunFlowById.delete(runId);
        const detail = error instanceof Error ? error.message : String(error);
        await finishRun({
          workspaceRoot,
          flowName,
          runId,
          status: "failed",
          message: detail
        });
        this.toast("error", `Demo schedule run failed: ${detail}`);
      }
    }, 1000);

    this.demoRunTimers.set(runId, timer);
    this.toast("info", `Demo schedule started: ${runId}`);
    return { runId };
  }

  private subscribeSchedule(runId: string): void {
    if (this.scheduleSubscriberByRunId.has(runId)) {
      return;
    }
    const subscriber = (event: TaskEvent) => {
      this.postMessage({
        type: "SCHEDULE_EVENT",
        payload: { event }
      });
    };
    this.scheduleSubscriberByRunId.set(runId, subscriber);
    this.scheduleService.subscribe(runId, subscriber);
  }

  private unsubscribeSchedule(runId: string): void {
    const subscriber = this.scheduleSubscriberByRunId.get(runId);
    if (!subscriber) {
      return;
    }
    this.scheduleService.unsubscribe(runId, subscriber);
    this.scheduleSubscriberByRunId.delete(runId);
  }

  private async pinTask(runId: string, taskId: string, pinned: boolean): Promise<void> {
    this.scheduleService.patchTask(runId, taskId, {
      overrides: {
        pinned
      }
    });
    this.scheduleService.recompute(runId);
  }

  private async moveTask(
    runId: string,
    taskId: string,
    forceStartMs?: number,
    forceAgentId?: string
  ): Promise<void> {
    this.scheduleService.patchTask(runId, taskId, {
      overrides: {
        forceStartMs,
        forceAgentId
      }
    });
    this.scheduleService.recompute(runId);
  }

  private async setTaskPriority(runId: string, taskId: string, priority?: number): Promise<void> {
    this.scheduleService.patchTask(runId, taskId, {
      overrides: {
        priority
      }
    });
    this.scheduleService.recompute(runId);
  }

  private async runFlow(input: {
    flowName: string;
    backendId?: CliBackendId;
    runName?: string;
    tags?: string[];
    usePinnedOutputs?: boolean;
  }): Promise<{ runId: string; flowName: string; taskCount: number }> {
    const workspaceRoot = this.getWorkspaceRoot();
    const flow = await this.tryLoadFlowDefinition(input.flowName);
    const run = await startRun({
      workspaceRoot,
      flowName: flow.flowName,
      backendId: input.backendId ?? "auto",
      runName: input.runName,
      tags: input.tags
    });

    const tasks = this.buildTasksFromFlow(run.runId, flow.nodes, flow.edges);
    this.scheduleService.createRun(run.runId, tasks);
    this.activeRunFlowById.set(run.runId, flow.flowName);

    void this.executeRunLoop({
      runId: run.runId,
      flowName: flow.flowName,
      nodes: flow.nodes,
      edges: flow.edges,
      requestedBackendId: input.backendId,
      usePinnedOutputs: input.usePinnedOutputs
    }).catch((error) => {
      const detail = error instanceof Error ? error.message : String(error);
      this.toast("error", `Run failed: ${detail}`);
    });

    return {
      runId: run.runId,
      flowName: flow.flowName,
      taskCount: tasks.length
    };
  }

  private async runSingleNode(input: {
    flowName: string;
    nodeId: string;
    backendId?: CliBackendId;
    usePinnedOutput?: boolean;
  }): Promise<{ runId: string; flowName: string; nodeId: string }> {
    const workspaceRoot = this.getWorkspaceRoot();
    const flow = await this.tryLoadFlowDefinition(input.flowName);
    const node = flow.nodes.find((item) => item.id === input.nodeId);
    if (!node) {
      throw new Error(`Node not found in flow: ${input.nodeId}`);
    }

    const run = await startRun({
      workspaceRoot,
      flowName: flow.flowName,
      backendId: input.backendId ?? "auto",
      runName: `Single node: ${input.nodeId}`
    });

    const now = Date.now();
    const task: Task = {
      id: `task:${run.runId}:${sanitizeRunNodeId(node.id)}`,
      title: this.resolveNodeTitle(node),
      agentId: node.type === "agent" ? node.id : `system:${node.id}`,
      deps: [],
      status: "planned",
      progress: 0,
      createdAtMs: now,
      updatedAtMs: now,
      meta: {
        nodeId: node.id,
        nodeType: node.type
      }
    };
    this.scheduleService.createRun(run.runId, [task]);
    this.activeRunFlowById.set(run.runId, flow.flowName);

    void this.executeRunLoop({
      runId: run.runId,
      flowName: flow.flowName,
      nodes: [node],
      edges: [],
      requestedBackendId: input.backendId,
      usePinnedOutputs: input.usePinnedOutput
    }).catch((error) => {
      const detail = error instanceof Error ? error.message : String(error);
      this.toast("error", `Run failed: ${detail}`);
    });

    return { runId: run.runId, flowName: flow.flowName, nodeId: input.nodeId };
  }

  private async stopRun(runId: string): Promise<void> {
    const stop = this.activeRunStops.get(runId);
    if (stop) {
      stop();
      return;
    }
    const flowName = this.activeRunFlowById.get(runId) ?? "default";
    await finishRun({
      workspaceRoot: this.getWorkspaceRoot(),
      flowName,
      runId,
      status: "stopped",
      message: "Stopped by user"
    });
    this.activeRunFlowById.delete(runId);
  }

  private async executeRunLoop(input: {
    runId: string;
    flowName: string;
    nodes: DiscoverySnapshot["nodes"];
    edges: DiscoverySnapshot["edges"];
    requestedBackendId?: CliBackendId;
    usePinnedOutputs?: boolean;
  }): Promise<void> {
    const workspaceRoot = this.getWorkspaceRoot();
    const taskOutputs = new Map<string, unknown>();
    const nodeById = new Map(input.nodes.map((node) => [node.id, node] as const));
    let stopped = false;
    let failedMessage: string | undefined;

    this.activeRunFlowById.set(input.runId, input.flowName);
    this.activeRunStops.set(input.runId, () => {
      stopped = true;
    });

    while (true) {
      if (stopped) {
        const current = this.scheduleService.getTasks(input.runId);
        for (const task of current) {
          if (task.status === "done" || task.status === "failed" || task.status === "canceled") {
            continue;
          }
          this.scheduleService.patchTask(input.runId, task.id, {
            status: "canceled",
            actualEndMs: Date.now()
          });
        }
        this.scheduleService.recompute(input.runId);
        break;
      }

      const tasks = this.scheduleService.getTasks(input.runId);
      const hasFailure = tasks.some((task) => task.status === "failed");
      if (hasFailure) {
        failedMessage = "One or more tasks failed";
        break;
      }

      const allFinished =
        tasks.length > 0 &&
        tasks.every(
          (task) =>
            task.status === "done" ||
            task.status === "failed" ||
            task.status === "canceled"
        );
      if (allFinished) {
        break;
      }

      const nextTask = tasks.find((task) => {
        if (!(task.status === "planned" || task.status === "ready")) {
          return false;
        }
        return task.deps.every((depId) => tasks.find((item) => item.id === depId)?.status === "done");
      });

      if (!nextTask) {
        await sleep(120);
        continue;
      }

      this.scheduleService.patchTask(input.runId, nextTask.id, {
        status: "running",
        actualStartMs: Date.now(),
        progress: 0
      });
      await appendRunEvent({
        workspaceRoot,
        flowName: input.flowName,
        event: {
          ts: Date.now(),
          flow: input.flowName,
          runId: input.runId,
          type: "node_started",
          nodeId: String(nextTask.meta?.nodeId ?? nextTask.id),
          input: {
            title: nextTask.title
          }
        }
      });

      const pinned =
        input.usePinnedOutputs && nextTask.meta?.nodeId
          ? await getPin({
              workspaceRoot,
              flowName: input.flowName,
              nodeId: String(nextTask.meta.nodeId)
            })
          : undefined;

      if (pinned) {
        taskOutputs.set(nextTask.id, pinned.output);
        this.scheduleService.patchTask(input.runId, nextTask.id, {
          status: "done",
          progress: 1,
          actualEndMs: Date.now(),
          meta: {
            ...(nextTask.meta ?? {}),
            source: "pinned"
          }
        });
        await appendRunEvent({
          workspaceRoot,
          flowName: input.flowName,
          event: {
            ts: Date.now(),
            flow: input.flowName,
            runId: input.runId,
            type: "node_output",
            nodeId: String(nextTask.meta?.nodeId ?? nextTask.id),
            output: pinned.output,
            meta: {
              source: "pinned"
            }
          }
        });
        this.scheduleService.recompute(input.runId);
        continue;
      }

      const node = nodeById.get(String(nextTask.meta?.nodeId ?? ""));
      const backend = await this.resolveBackendForTask(input.requestedBackendId, node);
      const prompt = this.buildTaskPrompt(nextTask, node, taskOutputs, input.flowName);
      const result = await executeCliPrompt({
        backend,
        prompt,
        workspacePath: this.getWorkspaceRoot(),
        timeoutMs: 120_000
      });

      if (result.success) {
        taskOutputs.set(nextTask.id, result.output);
        this.scheduleService.patchTask(input.runId, nextTask.id, {
          status: "done",
          progress: 1,
          actualEndMs: Date.now(),
          meta: {
            ...(nextTask.meta ?? {}),
            backendId: backend.id
          }
        });
        await appendRunEvent({
          workspaceRoot,
          flowName: input.flowName,
          event: {
            ts: Date.now(),
            flow: input.flowName,
            runId: input.runId,
            type: "node_output",
            nodeId: String(nextTask.meta?.nodeId ?? nextTask.id),
            output: result.output,
            meta: {
              backendId: backend.id,
              durationMs: result.durationMs
            }
          }
        });
      } else {
        failedMessage = result.error || "CLI execution failed";
        this.scheduleService.patchTask(input.runId, nextTask.id, {
          status: "failed",
          actualEndMs: Date.now(),
          blocker: {
            kind: "error",
            message: failedMessage
          },
          meta: {
            ...(nextTask.meta ?? {}),
            backendId: backend.id
          }
        });
        await appendRunEvent({
          workspaceRoot,
          flowName: input.flowName,
          event: {
            ts: Date.now(),
            flow: input.flowName,
            runId: input.runId,
            type: "node_failed",
            nodeId: String(nextTask.meta?.nodeId ?? nextTask.id),
            message: failedMessage,
            meta: {
              backendId: backend.id,
              durationMs: result.durationMs
            }
          }
        });
      }

      this.scheduleService.recompute(input.runId);
      if (failedMessage) {
        break;
      }
    }

    const status = stopped ? "stopped" : failedMessage ? "failed" : "success";
    await finishRun({
      workspaceRoot,
      flowName: input.flowName,
      runId: input.runId,
      status,
      message: failedMessage
    });
    this.activeRunStops.delete(input.runId);
    this.activeRunFlowById.delete(input.runId);
  }

  private buildTasksFromFlow(
    runId: string,
    nodes: DiscoverySnapshot["nodes"],
    edges: DiscoverySnapshot["edges"]
  ): Task[] {
    const executableNodes = nodes.filter((node) => node.type === "agent" || node.type === "system");
    if (executableNodes.length === 0) {
      const now = Date.now();
      return [
        {
          id: `task:${runId}:default`,
          title: "Workspace run",
          agentId: this.snapshot?.agent.id ?? "workspace",
          deps: [],
          status: "planned",
          progress: 0,
          createdAtMs: now,
          updatedAtMs: now,
          meta: {
            nodeId: this.snapshot?.agent.id ?? "workspace",
            nodeType: "system"
          }
        }
      ];
    }

    const nodeIdSet = new Set(executableNodes.map((node) => node.id));
    const upstream = new Map<string, string[]>();
    for (const node of executableNodes) {
      upstream.set(node.id, []);
    }

    for (const edge of edges) {
      if (!nodeIdSet.has(edge.source) || !nodeIdSet.has(edge.target)) {
        continue;
      }
      if (
        edge.type !== "interaction" &&
        edge.type !== "delegates" &&
        edge.type !== "agentLink" &&
        edge.type !== "contains"
      ) {
        continue;
      }
      upstream.get(edge.target)?.push(edge.source);
    }

    const taskIdByNodeId = new Map<string, string>();
    const now = Date.now();
    const tasks: Task[] = executableNodes.map((node, index) => {
      const taskId = `task:${runId}:${sanitizeRunNodeId(node.id)}`;
      taskIdByNodeId.set(node.id, taskId);
      const task: Task = {
        id: taskId,
        title: this.resolveNodeTitle(node),
        agentId: node.type === "agent" ? node.id : `system:${node.id}`,
        deps: [],
        status: "planned",
        progress: 0,
        estimateMs: 90_000 + (index % 2) * 45_000,
        createdAtMs: now + index,
        updatedAtMs: now + index,
        meta: {
          nodeId: node.id,
          nodeType: node.type
        }
      };
      return task;
    });

    for (const task of tasks) {
      const nodeId = String(task.meta?.nodeId ?? "");
      const deps = upstream.get(nodeId) ?? [];
      task.deps = deps
        .map((depNodeId) => taskIdByNodeId.get(depNodeId))
        .filter((depTaskId): depTaskId is string => Boolean(depTaskId));
    }
    return tasks;
  }

  private buildTaskPrompt(
    task: Task,
    node: DiscoverySnapshot["nodes"][number] | undefined,
    outputs: Map<string, unknown>,
    flowName: string
  ): string {
    const data = (node?.data ?? {}) as Record<string, unknown>;
    const name = String(data.name ?? data.title ?? task.title);
    const role = String(data.role ?? (node?.type === "agent" ? "agent" : "system"));
    const systemPrompt = String(data.systemPrompt ?? data.description ?? "").trim();
    const dependencyOutputs = task.deps
      .map((depId) => ({
        taskId: depId,
        output: outputs.get(depId)
      }))
      .filter((item) => item.output !== undefined);

    return [
      `Flow: ${flowName}`,
      `Node: ${name}`,
      `Role: ${role}`,
      `Task: ${task.title}`,
      systemPrompt ? `System Prompt:\n${systemPrompt}` : "",
      dependencyOutputs.length > 0
        ? `Upstream outputs:\n${JSON.stringify(dependencyOutputs, null, 2)}`
        : "",
      "Return concise plain text output."
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  private resolveNodeTitle(node: DiscoverySnapshot["nodes"][number]): string {
    const data = node.data as Record<string, unknown>;
    return String(data.name ?? data.title ?? data.role ?? node.id);
  }

  private async tryLoadFlowDefinition(
    flowName: string
  ): Promise<{ flowName: string; nodes: DiscoverySnapshot["nodes"]; edges: DiscoverySnapshot["edges"] }> {
    try {
      return await this.loadFlow(flowName);
    } catch {
      const snapshot = await this.ensureSnapshot();
      return {
        flowName: sanitizeFlowName(flowName || "default"),
        nodes: snapshot.nodes,
        edges: snapshot.edges
      };
    }
  }

  private async resolveBackendForTask(
    requestedBackendId: CliBackendId | undefined,
    node: DiscoverySnapshot["nodes"][number] | undefined
  ): Promise<CliBackend> {
    const backends = await this.detectCliBackends();
    const config = vscode.workspace.getConfiguration("agentCanvas");
    let backendId = requestedBackendId;

    if (!backendId || backendId === "auto") {
      if (node?.type === "agent") {
        const agent = this.snapshot?.agents.find((item) => item.id === node.id);
        if (agent?.runtime?.kind === "cli") {
          backendId = agent.runtime.backendId;
        } else if (agent?.runtime?.kind === "openclaw") {
          return {
            id: "custom",
            displayName: "OpenClaw CLI",
            command: "openclaw",
            args: ["agent", "--message"],
            available: true,
            stdinPrompt: false
          };
        }
      }
      if (!backendId || backendId === "auto") {
        backendId = config.get<CliBackendId>("promptBackend", "auto");
      }
    }

    return pickPromptBackend(backends, backendId ?? "auto");
  }

  private async setAgentRuntime(agentId: string, runtime: AgentProfile["runtime"] | null): Promise<void> {
    const agent = this.requireAgent(agentId);
    await applyAgentProfilePatch({
      workspaceRoot: this.getWorkspaceRoot(),
      baseProfile: agent,
      patch: {
        runtime
      }
    });
  }

  private async setBackendOverrides(overrides: CliBackendOverrides): Promise<void> {
    const config = vscode.workspace.getConfiguration("agentCanvas");
    await config.update("cliBackendOverrides", overrides, vscode.ConfigurationTarget.Workspace);
  }

  private async ensureSnapshot(): Promise<DiscoverySnapshot> {
    if (this.snapshot) {
      return this.snapshot;
    }
    await this.refreshState(true);
    if (!this.snapshot) {
      throw new Error("Discovery snapshot is unavailable");
    }
    return this.snapshot;
  }

  private async detectCliBackends(): Promise<CliBackend[]> {
    const config = vscode.workspace.getConfiguration("agentCanvas");
    return await detectAllCliBackends({
      customCliCommand: config.get<string>("customCliCommand", ""),
      customCliArgs: config.get<string[]>("customCliArgs", []),
      backendOverrides: config.get<CliBackendOverrides>("cliBackendOverrides", {})
    });
  }

  private postGenerationProgress(
    stage: "building_prompt" | "calling_cli" | "parsing_output" | "done" | "error",
    message: string,
    progress?: number
  ): void {
    this.postMessage({
      type: "GENERATION_PROGRESS",
      payload: { stage, message, progress }
    });
  }

  private async applyGeneratedStructure(
    structure: GeneratedAgentStructure,
    createSuggestedSkills: boolean,
    overwriteExisting: boolean
  ): Promise<void> {
    const snapshot = await this.ensureSnapshot();
    const workspaceRoot = this.getWorkspaceRoot();
    const homeDir = snapshot.agent.homeDir ?? getHomeDir();

    const currentAgents = snapshot.agents;
    const normalizedNameToAgent = new Map(
      currentAgents.map((agent) => [normalizeLabel(agent.name), agent] as const)
    );
    const usedNames = new Set(currentAgents.map((agent) => normalizeLabel(agent.name)));
    const createdBySourceName = new Map<string, AgentProfile>();

    const availableSkillIds = new Set(snapshot.skills.map((skill) => skill.id));
    const availableMcpIds = new Set(snapshot.mcpServers.map((server) => server.id));

    // Phase 1: Create or update agents
    this.postGenerationProgress("building_prompt", `Creating ${structure.agents.length} agent(s)...`, 10);
    for (const generated of structure.agents) {
      const sourceNameKey = normalizeLabel(generated.name);
      const existing = normalizedNameToAgent.get(sourceNameKey);
      let targetAgent: AgentProfile;

      try {
        if (existing && (overwriteExisting || existing.id.startsWith("custom:"))) {
          targetAgent = await applyAgentProfilePatch({
            workspaceRoot,
            baseProfile: existing,
            patch: {
              role: generated.role,
              roleLabel: generated.roleLabel,
              description: generated.description,
              systemPrompt: generated.systemPrompt,
              isOrchestrator: generated.isOrchestrator,
              color: generated.color,
              avatar: generated.avatar
            }
          });
        } else {
          const preferredName = (generated.name || "Generated Agent").trim();
          const finalName = makeUniqueLabel(preferredName, usedNames);
          usedNames.add(normalizeLabel(finalName));
          targetAgent = await createCustomAgentProfile({
            workspaceRoot,
            homeDir,
            name: finalName,
            role: generated.role,
            roleLabel: generated.roleLabel,
            description: generated.description,
            systemPrompt: generated.systemPrompt,
            isOrchestrator: generated.isOrchestrator
          });

          if (generated.color || generated.avatar) {
            targetAgent = await applyAgentProfilePatch({
              workspaceRoot,
              baseProfile: targetAgent,
              patch: {
                color: generated.color,
                avatar: generated.avatar
              }
            });
          }
        }

        normalizedNameToAgent.set(sourceNameKey, targetAgent);
        createdBySourceName.set(sourceNameKey, targetAgent);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        this.toast("warning", `Failed to create/update agent "${generated.name}": ${detail}`);
      }
    }

    // Phase 2: Set delegation relationships
    this.postGenerationProgress("building_prompt", "Setting delegation relationships...", 30);
    for (const generated of structure.agents) {
      const orchestrator = createdBySourceName.get(normalizeLabel(generated.name));
      if (!orchestrator || !generated.isOrchestrator) {
        continue;
      }
      const workerIds = generated.delegatesTo
        .map((workerName) => createdBySourceName.get(normalizeLabel(workerName))?.id)
        .filter((workerId): workerId is string => Boolean(workerId))
        .filter((workerId) => workerId !== orchestrator.id);

      if (workerIds.length === 0) {
        continue;
      }

      try {
        await setAgentDelegation({
          workspaceRoot,
          agent: orchestrator,
          workerIds
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        this.toast("warning", `Failed to set delegation for "${orchestrator.name}": ${detail}`);
      }
    }

    // Phase 3: Create suggested skills
    if (createSuggestedSkills && structure.suggestedNewSkills.length > 0) {
      this.postGenerationProgress("building_prompt", "Creating suggested skills...", 50);
      const skillBaseDir = join(workspaceRoot, ".github", "skills");
      for (const suggested of structure.suggestedNewSkills) {
        const skillName = normalizeSkillName(suggested.name);
        if (!skillName) {
          continue;
        }

        const skillPath = join(skillBaseDir, skillName, "SKILL.md");
        if (!(await exists(skillPath))) {
          try {
            await createSkillFromTemplate({
              baseDirPath: skillBaseDir,
              name: skillName,
              description: (suggested.description || "Suggested by AI").trim(),
              scope: "project"
            });
          } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            this.toast("warning", `Failed to create suggested skill ${skillName}: ${detail}`);
          }
        }

        const owner = createdBySourceName.get(normalizeLabel(suggested.forAgent));
        if (owner) {
          try {
            await assignSkillToAgent({
              workspaceRoot,
              agent: owner,
              skillId: skillPath
            });
          } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            this.toast("warning", `Failed to assign skill ${skillName} to ${owner.name}: ${detail}`);
          }
        }
      }
    }

    // Phase 4: Resolve and assign existing skills/MCPs
    this.postGenerationProgress("building_prompt", "Assigning skills and MCP servers...", 70);
    let latestSnapshot: DiscoverySnapshot;
    try {
      latestSnapshot = await runDiscovery(await this.buildProviderContext(), this.providers);
    } catch {
      latestSnapshot = snapshot;
    }
    const knownSkills = latestSnapshot.skills;
    const knownMcps = latestSnapshot.mcpServers;

    // Also add known skill IDs to the available set
    for (const skill of knownSkills) {
      availableSkillIds.add(skill.id);
    }
    for (const server of knownMcps) {
      availableMcpIds.add(server.id);
    }

    for (const generated of structure.agents) {
      const targetAgent = createdBySourceName.get(normalizeLabel(generated.name));
      if (!targetAgent) {
        continue;
      }

      for (const requestedSkill of generated.assignedSkillIds) {
        const resolvedSkillId = resolveSkillId(requestedSkill, knownSkills);
        if (!resolvedSkillId) {
          continue;
        }
        try {
          await assignSkillToAgent({
            workspaceRoot,
            agent: targetAgent,
            skillId: resolvedSkillId
          });
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          this.toast("warning", `Failed to assign skill "${requestedSkill}" to ${targetAgent.name}: ${detail}`);
        }
      }

      for (const requestedMcp of generated.assignedMcpServerIds) {
        const resolvedMcpId = resolveMcpServerId(requestedMcp, knownMcps);
        if (!resolvedMcpId) {
          continue;
        }
        try {
          await assignMcpToAgent({
            workspaceRoot,
            agent: targetAgent,
            mcpServerId: resolvedMcpId
          });
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          this.toast("warning", `Failed to assign MCP "${requestedMcp}" to ${targetAgent.name}: ${detail}`);
        }
      }
    }

    this.postGenerationProgress("done", `Applied ${createdBySourceName.size} agent(s) successfully`, 100);
  }

  private async buildDevServerHtml(devServerUrl: string): Promise<string | undefined> {
    const normalized = devServerUrl.endsWith("/") ? devServerUrl.slice(0, -1) : devServerUrl;
    const indexUrl = `${normalized}/`;

    try {
      const response = await fetch(indexUrl);
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      const rawHtml = await response.text();
      const nonce = randomBytes(16).toString("base64");

      const withNonce = rawHtml.replace(
        /<script type="module" /g,
        `<script nonce="${nonce}" type="module" `
      );

      const csp = [
        `default-src 'none'`,
        `img-src ${this.panel.webview.cspSource} https: data:`,
        `style-src ${this.panel.webview.cspSource} 'unsafe-inline' ${normalized}`,
        `font-src ${this.panel.webview.cspSource} ${normalized}`,
        `script-src 'nonce-${nonce}' ${this.panel.webview.cspSource} ${normalized} 'unsafe-eval'`,
        `connect-src ${normalized} ws://localhost:* ws://127.0.0.1:*`
      ].join("; ");

      const rewrittenAssets = withNonce.replace(
        /(src|href)="\/(.*?)"/g,
        (_full, attr: string, path: string) => `${attr}="${normalized}/${path}"`
      );

      return rewrittenAssets.replace(
        /<head>/i,
        `<head>\n<meta http-equiv="Content-Security-Policy" content="${csp}">`
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.toast(
        "warning",
        `Dev webview server unavailable (${detail}). Falling back to bundled assets.`
      );
      return undefined;
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase();
}

function makeUniqueLabel(base: string, used: Set<string>): string {
  const trimmed = base.trim() || "Generated Agent";
  const baseKey = normalizeLabel(trimmed);
  if (!used.has(baseKey)) {
    return trimmed;
  }
  let index = 2;
  let candidate = `${trimmed} ${index}`;
  while (used.has(normalizeLabel(candidate))) {
    index += 1;
    candidate = `${trimmed} ${index}`;
  }
  return candidate;
}

function normalizeSkillName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveSkillId(requested: string, skills: DiscoverySnapshot["skills"]): string | undefined {
  const direct = skills.find((skill) => skill.id === requested);
  if (direct) {
    return direct.id;
  }
  const normalized = normalizeLabel(requested);
  const byName = skills.find((skill) => normalizeLabel(skill.name) === normalized);
  if (byName) {
    return byName.id;
  }
  const byFolder = skills.find((skill) => normalizeLabel(skill.folderName) === normalized);
  return byFolder?.id;
}

function resolveMcpServerId(
  requested: string,
  servers: DiscoverySnapshot["mcpServers"]
): string | undefined {
  const direct = servers.find((server) => server.id === requested);
  if (direct) {
    return direct.id;
  }
  const normalized = normalizeLabel(requested);
  const byName = servers.find((server) => normalizeLabel(server.name) === normalized);
  return byName?.id;
}

function sanitizeRunNodeId(nodeId: string): string {
  return nodeId.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
