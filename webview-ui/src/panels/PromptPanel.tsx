import { useEffect, useMemo, useState } from "react";
import type { CliBackend, PromptHistoryEntry } from "../messaging/protocol";

type GenerationProgress = {
  stage: "building_prompt" | "calling_cli" | "parsing_output" | "done" | "error";
  message: string;
  progress?: number;
};

type PromptPanelProps = {
  backends: CliBackend[];
  history: PromptHistoryEntry[];
  progress?: GenerationProgress;
  onRefresh: () => Promise<void> | void;
  onGenerate: (payload: {
    prompt: string;
    backendId: CliBackend["id"];
    includeExistingAgents: boolean;
    includeExistingSkills: boolean;
    includeExistingMcpServers: boolean;
  }) => Promise<void>;
  onDeleteHistory: (historyId: string) => Promise<void>;
  onReapplyHistory: (historyId: string) => Promise<void>;
};

const PROMPT_TEMPLATES = [
  {
    label: "Code Review Team",
    prompt:
      "Build a code review team with one orchestrator lead, one reviewer, and one tester. Assign GitHub MCP to reviewer and testing-related MCP to tester."
  },
  {
    label: "Full Stack Team",
    prompt:
      "Create a full-stack team with a planner orchestrator, frontend coder, backend coder, and QA tester."
  },
  {
    label: "Docs Team",
    prompt:
      "Create a documentation team with one orchestrator editor, one writer, and one reviewer."
  }
];

export default function PromptPanel(props: PromptPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [backendId, setBackendId] = useState<CliBackend["id"]>("auto");
  const [includeExistingAgents, setIncludeExistingAgents] = useState(true);
  const [includeExistingSkills, setIncludeExistingSkills] = useState(true);
  const [includeExistingMcpServers, setIncludeExistingMcpServers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("");

  useEffect(() => {
    if (props.backends.some((backend) => backend.id === backendId)) {
      return;
    }
    setBackendId(props.backends[0]?.id ?? "auto");
  }, [backendId, props.backends]);

  const availableBackendCount = useMemo(
    () => props.backends.filter((backend) => backend.id !== "auto" && backend.available).length,
    [props.backends]
  );

  const filteredHistory = useMemo(() => {
    const normalized = historyFilter.trim().toLowerCase();
    if (!normalized) {
      return props.history;
    }
    return props.history.filter((item) =>
      item.prompt.toLowerCase().includes(normalized) ||
      item.result.teamName.toLowerCase().includes(normalized)
    );
  }, [historyFilter, props.history]);

  const generate = async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || busy) {
      return;
    }
    setBusy(true);
    try {
      await props.onGenerate({
        prompt: trimmedPrompt,
        backendId,
        includeExistingAgents,
        includeExistingSkills,
        includeExistingMcpServers
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel-content" id="right-panel-prompt" role="tabpanel">
      <div className="inspector-block">
        <div className="inspector-title">AI Prompt</div>

        <div className="inspector-field">
          <label>Backend</label>
          <select value={backendId} onChange={(event) => setBackendId(event.target.value as CliBackend["id"])}>
            {props.backends.map((backend) => (
              <option key={backend.id} value={backend.id}>
                {backend.displayName} {backend.id !== "auto" ? (backend.available ? "●" : "○") : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="muted">Available backends: {availableBackendCount}</div>

        <div className="inspector-field">
          <label>Prompt</label>
          <textarea
            rows={6}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Describe the team you want to generate..."
          />
        </div>

        <div className="item-actions">
          {PROMPT_TEMPLATES.map((template) => (
            <button key={template.label} type="button" onClick={() => setPrompt(template.prompt)} disabled={busy}>
              {template.label}
            </button>
          ))}
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={includeExistingAgents}
            onChange={(event) => setIncludeExistingAgents(event.target.checked)}
            disabled={busy}
          />
          Include existing agents
        </label>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={includeExistingSkills}
            onChange={(event) => setIncludeExistingSkills(event.target.checked)}
            disabled={busy}
          />
          Include existing skills
        </label>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={includeExistingMcpServers}
            onChange={(event) => setIncludeExistingMcpServers(event.target.checked)}
            disabled={busy}
          />
          Include existing MCP servers
        </label>

        {props.progress && (
          <div className={`validation-item ${props.progress.stage === "error" ? "error" : "warning"}`}>
            {props.progress.message}
            {typeof props.progress.progress === "number" ? ` (${props.progress.progress}%)` : ""}
          </div>
        )}

        <div className="import-actions">
          <button
            onClick={() => {
              void Promise.resolve(props.onRefresh()).catch(() => undefined);
            }}
            disabled={busy}
          >
            Refresh Backends
          </button>
          <button onClick={() => void generate()} disabled={busy || !prompt.trim()}>
            {busy ? "Generating..." : "Generate Agent Team"}
          </button>
        </div>
      </div>

      <div className="inspector-block">
        <div className="inspector-title">History</div>
        <input
          className="library-search"
          value={historyFilter}
          onChange={(event) => setHistoryFilter(event.target.value)}
          placeholder="Search history..."
        />
        <div className="agent-detail-list">
          {filteredHistory.map((item) => (
            <div key={item.id} className="agent-detail-item">
              <div className="agent-detail-item-header">
                <div className="item-title">{item.result.teamName}</div>
                <span className="pill">{item.applied ? "applied" : "draft"}</span>
              </div>
              <div className="item-subtitle">{new Date(item.createdAt).toLocaleString()}</div>
              <div className="item-subtitle">{item.prompt}</div>
              <div className="item-actions">
                <button onClick={() => setPrompt(item.prompt)} disabled={busy}>Use Prompt</button>
                <button
                  onClick={() => {
                    void props.onReapplyHistory(item.id).catch(() => undefined);
                  }}
                  disabled={busy}
                >
                  Reapply
                </button>
                <button
                  onClick={() => {
                    void props.onDeleteHistory(item.id).catch(() => undefined);
                  }}
                  disabled={busy}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
        {filteredHistory.length === 0 && <div className="muted">No prompt history</div>}
      </div>
    </div>
  );
}
