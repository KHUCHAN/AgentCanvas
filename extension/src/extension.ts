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
  saveFlow as saveFlowFile
} from "./services/flowStore";
import { exists, getHomeDir } from "./services/pathUtils";
import { appendPromptHistory, findPromptHistory, markPromptHistoryApplied, readPromptHistory, removePromptHistory } from "./services/promptHistory";
import { buildAgentGenerationPrompt } from "./services/promptBuilder";
import { updateSkillFrontmatter } from "./services/skillEditor";
import { exportSkillPack, importSkillPack, previewSkillPack } from "./services/zipPack";
import type {
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage
} from "./messages/protocol";
import { hasRequestId } from "./messages/protocol";
import type { AgentProfile, DiscoverySnapshot, StudioEdge, StickyNote } from "./types";
import type { CliBackend, GeneratedAgentStructure } from "./types";

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
}

export function deactivate(): void {
  panelController = undefined;
}

class AgentCanvasPanel {
  private static readonly viewType = "agentCanvas.panel";
  private readonly providers: Provider[];
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionContext: vscode.ExtensionContext;
  private snapshot: DiscoverySnapshot | undefined;
  private notes: StickyNote[] = [];
  private notesLoaded = false;
  private agentLinks: StudioEdge[] = [];
  private agentLinksLoaded = false;

  private constructor(panel: vscode.WebviewPanel, extensionContext: vscode.ExtensionContext) {
    this.panel = panel;
    this.extensionContext = extensionContext;
    this.providers = [new AgentSkillsProvider(), new CodexGuidanceProvider()];

    this.panel.onDidDispose(() => {
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
    const snapshot = await runDiscovery(await this.buildProviderContext(), this.providers);
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
      customCliArgs: config.get<string[]>("customCliArgs", [])
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

    for (const generated of structure.agents) {
      const sourceNameKey = normalizeLabel(generated.name);
      const existing = normalizedNameToAgent.get(sourceNameKey);
      let targetAgent: AgentProfile;

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
    }

    for (const generated of structure.agents) {
      const orchestrator = createdBySourceName.get(normalizeLabel(generated.name));
      if (!orchestrator || !generated.isOrchestrator) {
        continue;
      }
      const workerIds = generated.delegatesTo
        .map((workerName) => createdBySourceName.get(normalizeLabel(workerName))?.id)
        .filter((workerId): workerId is string => Boolean(workerId))
        .filter((workerId) => workerId !== orchestrator.id);
      await setAgentDelegation({
        workspaceRoot,
        agent: orchestrator,
        workerIds
      });
    }

    if (createSuggestedSkills) {
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
        availableSkillIds.add(skillPath);

        const owner = createdBySourceName.get(normalizeLabel(suggested.forAgent));
        if (owner) {
          await assignSkillToAgent({
            workspaceRoot,
            agent: owner,
            skillId: skillPath
          });
        }
      }
    }

    const latestSnapshot = await runDiscovery(await this.buildProviderContext(), this.providers);
    const knownSkills = latestSnapshot.skills;
    const knownMcps = latestSnapshot.mcpServers;

    for (const generated of structure.agents) {
      const targetAgent = createdBySourceName.get(normalizeLabel(generated.name));
      if (!targetAgent) {
        continue;
      }

      for (const requestedSkill of generated.assignedSkillIds) {
        const resolvedSkillId = resolveSkillId(requestedSkill, knownSkills);
        if (!resolvedSkillId || !availableSkillIds.has(resolvedSkillId) && !knownSkills.some((skill) => skill.id === resolvedSkillId)) {
          continue;
        }
        await assignSkillToAgent({
          workspaceRoot,
          agent: targetAgent,
          skillId: resolvedSkillId
        });
      }

      for (const requestedMcp of generated.assignedMcpServerIds) {
        const resolvedMcpId = resolveMcpServerId(requestedMcp, knownMcps);
        if (!resolvedMcpId || !availableMcpIds.has(resolvedMcpId) && !knownMcps.some((server) => server.id === resolvedMcpId)) {
          continue;
        }
        await assignMcpToAgent({
          workspaceRoot,
          agent: targetAgent,
          mcpServerId: resolvedMcpId
        });
      }
    }
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
