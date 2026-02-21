import { FormEvent, useEffect, useRef, useState } from "react";
import type {
  AgentRole,
  BackendModelCatalog,
  CanonicalBackendId,
  ClaudePermissionMode,
  CodexApprovalPolicy,
  CodexSandboxPolicy,
  GeminiApprovalMode,
  PromptMode
} from "../messaging/protocol";
import { useFocusTrap } from "../hooks/useFocusTrap";
import {
  backendDisplayNameFromId,
  getModelOptionsForBackend
} from "../utils/modelOptions";

type AgentCreationModalProps = {
  open: boolean;
  modelCatalogs?: BackendModelCatalog[];
  onClose: () => void;
  onCreate: (payload: {
    name: string;
    role: AgentRole;
    roleLabel?: string;
    description?: string;
    systemPrompt?: string;
    isOrchestrator: boolean;
    backendId: CanonicalBackendId;
    modelId?: string;
    promptMode?: PromptMode;
    maxTurns?: number;
    maxBudgetUsd?: number;
    permissionMode?: ClaudePermissionMode;
    allowedTools?: string[];
    codexApproval?: CodexApprovalPolicy;
    codexSandbox?: CodexSandboxPolicy;
    geminiApprovalMode?: GeminiApprovalMode;
    geminiUseSandbox?: boolean;
    additionalDirs?: string[];
    enableWebSearch?: boolean;
    sessionId?: string;
    sessionName?: string;
  }) => Promise<void>;
};

const ROLE_OPTIONS: AgentRole[] = [
  "orchestrator",
  "coder",
  "researcher",
  "reviewer",
  "planner",
  "tester",
  "writer",
  "custom"
];

export default function AgentCreationModal({ open, modelCatalogs, onClose, onCreate }: AgentCreationModalProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<AgentRole>("custom");
  const [roleLabel, setRoleLabel] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [isOrchestrator, setIsOrchestrator] = useState(false);
  const [backendId, setBackendId] = useState<CanonicalBackendId>("claude");
  const [modelId, setModelId] = useState("");
  const [promptMode, setPromptMode] = useState<PromptMode>("append");
  const [maxTurns, setMaxTurns] = useState("");
  const [maxBudgetUsd, setMaxBudgetUsd] = useState("");
  const [permissionMode, setPermissionMode] = useState<ClaudePermissionMode>("default");
  const [allowedTools, setAllowedTools] = useState("");
  const [codexApproval, setCodexApproval] = useState<CodexApprovalPolicy>("on-request");
  const [codexSandbox, setCodexSandbox] = useState<CodexSandboxPolicy>("workspace-write");
  const [geminiApprovalMode, setGeminiApprovalMode] = useState<GeminiApprovalMode>("default");
  const [geminiUseSandbox, setGeminiUseSandbox] = useState(false);
  const [additionalDirs, setAdditionalDirs] = useState("");
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const modalRef = useRef<HTMLFormElement>(null);
  useFocusTrap(modalRef, open);
  const modelOptions = getModelOptionsForBackend(backendId, modelCatalogs);

  useEffect(() => {
    if (!open) {
      setName("");
      setRole("custom");
      setRoleLabel("");
      setDescription("");
      setSystemPrompt("");
      setIsOrchestrator(false);
      setBackendId("claude");
      setModelId("");
      setPromptMode("append");
      setMaxTurns("");
      setMaxBudgetUsd("");
      setPermissionMode("default");
      setAllowedTools("");
      setCodexApproval("on-request");
      setCodexSandbox("workspace-write");
      setGeminiApprovalMode("default");
      setGeminiUseSandbox(false);
      setAdditionalDirs("");
      setEnableWebSearch(false);
      setSessionId("");
      setSessionName("");
      setBusy(false);
      setErrorMessage(undefined);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose, open]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || busy) {
      return;
    }
    setBusy(true);
    setErrorMessage(undefined);
    try {
      const isClaudeBackend = backendId === "claude";
      const isCodexBackend = backendId === "codex";
      const isGeminiBackend = backendId === "gemini";
      await onCreate({
        name: name.trim(),
        role,
        roleLabel: roleLabel.trim() || undefined,
        description: description.trim() || undefined,
        systemPrompt: systemPrompt.trim() || undefined,
        isOrchestrator,
        backendId,
        modelId: modelId.trim() || undefined,
        promptMode: isClaudeBackend ? promptMode : undefined,
        maxTurns: isClaudeBackend ? parsePositiveInt(maxTurns) : undefined,
        maxBudgetUsd: isClaudeBackend ? parsePositiveNumber(maxBudgetUsd) : undefined,
        permissionMode: isClaudeBackend ? permissionMode : undefined,
        allowedTools: isClaudeBackend ? splitListInput(allowedTools) : undefined,
        codexApproval: isCodexBackend ? codexApproval : undefined,
        codexSandbox: isCodexBackend ? codexSandbox : undefined,
        geminiApprovalMode: isGeminiBackend ? geminiApprovalMode : undefined,
        geminiUseSandbox: isGeminiBackend ? geminiUseSandbox : undefined,
        additionalDirs: isCodexBackend ? splitListInput(additionalDirs) : undefined,
        enableWebSearch: isCodexBackend || isGeminiBackend ? enableWebSearch : undefined,
        sessionId: sessionId.trim() || undefined,
        sessionName: sessionName.trim() || undefined
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setErrorMessage(`Failed to create agent: ${detail}`);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="command-overlay" onClick={() => !busy && onClose()}>
      <form
        ref={modalRef}
        className="import-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Create Agent"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => void onSubmit(event)}
      >
        <div className="import-title">Create Agent</div>
        <div className="import-subtitle">Add a custom role-based agent to this workspace.</div>

        <div className="inspector-field">
          <label>Name</label>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Main Orchestrator" />
        </div>

        <div className="inspector-field">
          <label>Role</label>
          <select value={role} onChange={(event) => setRole(event.target.value as AgentRole)}>
            {ROLE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div className="inspector-field">
          <label>Role label</label>
          <input value={roleLabel} onChange={(event) => setRoleLabel(event.target.value)} placeholder="e.g. Team Lead" />
        </div>

        <div className="inspector-field">
          <label>Backend (CLI)</label>
          <select
            value={backendId}
            onChange={(event) => {
              setBackendId(event.target.value as CanonicalBackendId);
              setModelId("");
            }}
          >
            <option value="claude">{backendDisplayNameFromId("claude")}</option>
            <option value="codex">{backendDisplayNameFromId("codex")}</option>
            <option value="gemini">{backendDisplayNameFromId("gemini")}</option>
            <option value="aider">{backendDisplayNameFromId("aider")}</option>
            <option value="custom">{backendDisplayNameFromId("custom")}</option>
          </select>
        </div>

        <div className="inspector-field">
          <label>Model</label>
          <select value={modelId} onChange={(event) => setModelId(event.target.value)}>
            <option value="">Backend default</option>
            {modelOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </div>

        {backendId === "claude" && (
          <>
            <div className="inspector-field">
              <label>Prompt mode</label>
              <select value={promptMode} onChange={(event) => setPromptMode(event.target.value as PromptMode)}>
                <option value="append">Append system prompt</option>
                <option value="replace">Replace system prompt</option>
              </select>
            </div>
            <div className="inspector-field">
              <label>Max turns</label>
              <input
                value={maxTurns}
                onChange={(event) => setMaxTurns(event.target.value)}
                placeholder="e.g. 8"
                inputMode="numeric"
              />
            </div>
            <div className="inspector-field">
              <label>Max budget (USD)</label>
              <input
                value={maxBudgetUsd}
                onChange={(event) => setMaxBudgetUsd(event.target.value)}
                placeholder="e.g. 5.00"
                inputMode="decimal"
              />
            </div>
            <div className="inspector-field">
              <label>Permission mode</label>
              <select
                value={permissionMode}
                onChange={(event) => setPermissionMode(event.target.value as ClaudePermissionMode)}
              >
                <option value="default">Default</option>
                <option value="plan">Plan-only</option>
                <option value="skip">Skip permissions</option>
              </select>
            </div>
            <div className="inspector-field">
              <label>Allowed tools (comma or newline)</label>
              <textarea
                value={allowedTools}
                onChange={(event) => setAllowedTools(event.target.value)}
                rows={3}
                placeholder="Read, Glob, Grep"
              />
            </div>
          </>
        )}

        {backendId === "codex" && (
          <>
            <div className="inspector-field">
              <label>Approval policy</label>
              <select
                value={codexApproval}
                onChange={(event) => setCodexApproval(event.target.value as CodexApprovalPolicy)}
              >
                <option value="on-request">On request</option>
                <option value="untrusted">Untrusted only</option>
                <option value="never">Never ask</option>
              </select>
            </div>
            <div className="inspector-field">
              <label>Sandbox mode</label>
              <select
                value={codexSandbox}
                onChange={(event) => setCodexSandbox(event.target.value as CodexSandboxPolicy)}
              >
                <option value="workspace-write">Workspace write</option>
                <option value="read-only">Read only</option>
                <option value="danger-full-access">Danger full access</option>
              </select>
            </div>
            <div className="inspector-field">
              <label>Additional dirs (comma or newline)</label>
              <textarea
                value={additionalDirs}
                onChange={(event) => setAdditionalDirs(event.target.value)}
                rows={2}
                placeholder="/path/one, /path/two"
              />
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={enableWebSearch}
                onChange={(event) => setEnableWebSearch(event.target.checked)}
              />
              Enable web search
            </label>
          </>
        )}

        {backendId === "gemini" && (
          <>
            <div className="inspector-field">
              <label>Approval mode</label>
              <select
                value={geminiApprovalMode}
                onChange={(event) => setGeminiApprovalMode(event.target.value as GeminiApprovalMode)}
              >
                <option value="default">Default (ask per action)</option>
                <option value="auto_edit">Auto-edit</option>
                <option value="yolo">Full-auto (yolo)</option>
              </select>
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={geminiUseSandbox}
                onChange={(event) => setGeminiUseSandbox(event.target.checked)}
              />
              Enable sandbox mode
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={enableWebSearch}
                onChange={(event) => setEnableWebSearch(event.target.checked)}
              />
              Enable web search
            </label>
          </>
        )}

        <div className="inspector-field">
          <label>Session ID (optional)</label>
          <input
            value={sessionId}
            onChange={(event) => setSessionId(event.target.value)}
            placeholder="Resume previous CLI session"
          />
        </div>

        <div className="inspector-field">
          <label>Session name (optional)</label>
          <input
            value={sessionName}
            onChange={(event) => setSessionName(event.target.value)}
            placeholder="Friendly session label"
          />
        </div>

        <div className="inspector-field">
          <label>Description</label>
          <input value={description} onChange={(event) => setDescription(event.target.value)} />
        </div>

        <label className="checkbox-row">
          <input type="checkbox" checked={isOrchestrator} onChange={(event) => setIsOrchestrator(event.target.checked)} />
          Is orchestrator
        </label>

        <div className="inspector-field">
          <label>System Prompt</label>
          <textarea value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} rows={5} />
        </div>

        {errorMessage && (
          <div className="modal-error">{errorMessage}</div>
        )}

        <div className="import-actions">
          <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" disabled={busy || !name.trim()}>Create Agent</button>
        </div>
      </form>
    </div>
  );
}

function parsePositiveInt(value: string): number | undefined {
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

function parsePositiveNumber(value: string): number | undefined {
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

function splitListInput(value: string): string[] | undefined {
  const items = value
    .split(/\n|,/g)
    .map((item) => item.trim())
    .filter(Boolean);
  if (items.length === 0) {
    return undefined;
  }
  return items;
}
