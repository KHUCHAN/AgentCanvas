import { useEffect, useMemo, useState } from "react";
import type { CliBackend } from "../messaging/protocol";
import buildTeamEffect from "../assets/effects/agentcanvas_effect_build_team.svg";
import taskRunningEffect from "../assets/effects/agentcanvas_effect_task_running.svg";
import taskDoneEffect from "../assets/effects/agentcanvas_effect_task_done.svg";
import taskFailedEffect from "../assets/effects/agentcanvas_effect_task_failed.svg";

type GenerationProgress = {
  stage: "building_prompt" | "calling_cli" | "parsing_output" | "done" | "error";
  message: string;
  progress?: number;
};

type BuildPromptProps = {
  backends: CliBackend[];
  busy: boolean;
  progress?: GenerationProgress;
  onBuild: (payload: {
    prompt: string;
    backendId: CliBackend["id"];
    includeExistingAgents: boolean;
    includeExistingSkills: boolean;
    includeExistingMcpServers: boolean;
  }) => Promise<void>;
};

const QUICK_TEMPLATES = [
  {
    label: "Code Review",
    prompt:
      "Build a code review team with one orchestrator, one reviewer, and one tester. Assign GitHub MCP to reviewer and testing MCP to tester."
  },
  {
    label: "Full Stack",
    prompt:
      "Create a full-stack team with one orchestrator, one frontend coder, one backend coder, and one QA tester."
  },
  {
    label: "Docs Team",
    prompt:
      "Create a docs team with one lead editor, one writer, and one reviewer. Focus on concise technical documentation."
  },
  {
    label: "Data Pipeline",
    prompt:
      "Create a data pipeline team with one orchestrator, one ingestion engineer, one transformation engineer, and one QA validator."
  }
];

const PROGRESS_ICON_BY_STAGE: Record<GenerationProgress["stage"], string> = {
  building_prompt: taskRunningEffect,
  calling_cli: taskRunningEffect,
  parsing_output: taskRunningEffect,
  done: taskDoneEffect,
  error: taskFailedEffect
};

export default function BuildPrompt(props: BuildPromptProps) {
  const [prompt, setPrompt] = useState("");
  const [backendId, setBackendId] = useState<CliBackend["id"]>("auto");
  const [includeExistingAgents, setIncludeExistingAgents] = useState(true);
  const [includeExistingSkills, setIncludeExistingSkills] = useState(true);
  const [includeExistingMcpServers, setIncludeExistingMcpServers] = useState(true);

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

  const buildTeam = async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || props.busy) {
      return;
    }
    await props.onBuild({
      prompt: trimmedPrompt,
      backendId,
      includeExistingAgents,
      includeExistingSkills,
      includeExistingMcpServers
    });
  };

  return (
    <div className="build-prompt-stage">
      <div className="build-prompt-card">
        <div className="build-prompt-header">
          <div>
            <div className="build-prompt-title">Build Your Agent Team</div>
            <div className="build-prompt-subtitle">Describe your team in natural language, then build and run.</div>
          </div>
          <img
            src={buildTeamEffect}
            className={`build-prompt-hero ${props.busy ? "is-active" : ""}`}
            alt=""
            aria-hidden="true"
          />
        </div>

        <textarea
          className="build-prompt-input"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="e.g. Build a full stack team with frontend, backend, and QA. Delegate code review to a reviewer agent."
          rows={5}
        />

        <div className="build-prompt-chips">
          {QUICK_TEMPLATES.map((template) => (
            <button key={template.label} type="button" onClick={() => setPrompt(template.prompt)} disabled={props.busy}>
              {template.label}
            </button>
          ))}
        </div>

        <div className="build-prompt-row">
          <label htmlFor="build-backend">Backend</label>
          <select
            id="build-backend"
            value={backendId}
            onChange={(event) => setBackendId(event.target.value as CliBackend["id"])}
          >
            {props.backends.map((backend) => (
              <option key={backend.id} value={backend.id}>
                {backend.displayName} {backend.id !== "auto" ? (backend.available ? "●" : "○") : ""}
              </option>
            ))}
          </select>
          <span className="build-prompt-soft">Available: {availableBackendCount}</span>
        </div>

        <div className="build-prompt-checks">
          <label>
            <input
              type="checkbox"
              checked={includeExistingAgents}
              onChange={(event) => setIncludeExistingAgents(event.target.checked)}
              disabled={props.busy}
            />
            Include existing agents
          </label>
          <label>
            <input
              type="checkbox"
              checked={includeExistingSkills}
              onChange={(event) => setIncludeExistingSkills(event.target.checked)}
              disabled={props.busy}
            />
            Include existing skills
          </label>
          <label>
            <input
              type="checkbox"
              checked={includeExistingMcpServers}
              onChange={(event) => setIncludeExistingMcpServers(event.target.checked)}
              disabled={props.busy}
            />
            Include existing MCP servers
          </label>
        </div>

        {props.progress && (
          <div className={`build-prompt-progress ${props.progress.stage === "error" ? "is-error" : ""}`}>
            <img
              src={PROGRESS_ICON_BY_STAGE[props.progress.stage]}
              className="build-prompt-progress-icon"
              alt=""
              aria-hidden="true"
            />
            <span>
              {props.progress.message}
              {typeof props.progress.progress === "number" ? ` (${props.progress.progress}%)` : ""}
            </span>
          </div>
        )}

        <div className="build-prompt-actions">
          <button
            className="build-prompt-primary"
            type="button"
            onClick={() => void buildTeam()}
            disabled={props.busy || !prompt.trim()}
          >
            {props.busy ? "Building..." : "Build Team"}
          </button>
        </div>
      </div>
    </div>
  );
}
