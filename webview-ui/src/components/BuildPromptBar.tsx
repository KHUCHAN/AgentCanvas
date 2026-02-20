import { useEffect, useMemo } from "react";
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

type BuildPromptBarProps = {
  hasTeam: boolean;
  expanded: boolean;
  prompt: string;
  onPromptChange: (value: string) => void;
  onBuildTeam: () => void;
  backends: CliBackend[];
  selectedBackend: CliBackend["id"];
  onBackendChange: (backendId: CliBackend["id"]) => void;
  isBuilding: boolean;
  progress?: GenerationProgress;
  includeExistingAgents: boolean;
  includeExistingSkills: boolean;
  includeExistingMcpServers: boolean;
  onIncludeExistingAgentsChange: (value: boolean) => void;
  onIncludeExistingSkillsChange: (value: boolean) => void;
  onIncludeExistingMcpServersChange: (value: boolean) => void;
  onExpand: () => void;
  onCollapse: () => void;
};

const QUICK_TEMPLATES = [
  {
    label: "Code Review Team",
    prompt:
      "Build a code review team with one orchestrator, one reviewer, and one tester. Assign GitHub MCP to reviewer and testing MCP to tester."
  },
  {
    label: "Full Stack Team",
    prompt:
      "Create a full-stack team with one orchestrator, one frontend coder, one backend coder, and one QA tester."
  },
  {
    label: "Docs Team",
    prompt:
      "Create a docs team with one lead editor, one writer, and one reviewer. Focus on concise technical documentation."
  }
];

const PROGRESS_ICON_BY_STAGE: Record<GenerationProgress["stage"], string> = {
  building_prompt: taskRunningEffect,
  calling_cli: taskRunningEffect,
  parsing_output: taskRunningEffect,
  done: taskDoneEffect,
  error: taskFailedEffect
};

export default function BuildPromptBar(props: BuildPromptBarProps) {
  useEffect(() => {
    if (props.backends.some((backend) => backend.id === props.selectedBackend)) {
      return;
    }
    props.onBackendChange(props.backends[0]?.id ?? "auto");
  }, [props.backends, props.onBackendChange, props.selectedBackend]);

  const availableBackendCount = useMemo(
    () => props.backends.filter((backend) => backend.id !== "auto" && backend.available).length,
    [props.backends]
  );

  const compact = props.hasTeam && !props.expanded;

  if (compact) {
    return (
      <div className="build-prompt-bar" role="region" aria-label="Build team prompt">
        <input
          value={props.prompt}
          onChange={(event) => props.onPromptChange(event.target.value)}
          placeholder="Describe changes and rebuild your team..."
          className="build-prompt-bar-input"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              props.onBuildTeam();
            }
          }}
        />
        <select
          className="build-prompt-bar-select"
          value={props.selectedBackend}
          onChange={(event) => props.onBackendChange(event.target.value as CliBackend["id"])}
        >
          {props.backends.map((backend) => (
            <option key={backend.id} value={backend.id}>
              {backend.displayName}
            </option>
          ))}
        </select>
        <button type="button" onClick={props.onExpand} title="Expand prompt panel">
          Expand
        </button>
        <button
          type="button"
          className="build-prompt-primary compact"
          onClick={props.onBuildTeam}
          disabled={props.isBuilding || !props.prompt.trim()}
        >
          {props.isBuilding ? "Rebuilding..." : "Rebuild"}
        </button>
      </div>
    );
  }

  return (
    <div className="build-prompt-expanded" role="region" aria-label="Build team prompt">
      <div className="build-prompt-card">
        <div className="build-prompt-header">
          <div>
            <div className="build-prompt-title">
              {props.hasTeam ? "Refine Your Team" : "Build Your Agent Team"}
            </div>
            <div className="build-prompt-subtitle">
              {props.hasTeam
                ? "Adjust structure and regenerate from one prompt."
                : "Describe your team in natural language, then build and run."}
            </div>
          </div>
          <img
            src={buildTeamEffect}
            className={`build-prompt-hero ${props.isBuilding ? "is-active" : ""}`}
            alt=""
            aria-hidden="true"
          />
        </div>

        <textarea
          className="build-prompt-input"
          value={props.prompt}
          onChange={(event) => props.onPromptChange(event.target.value)}
          placeholder="e.g. Build a full stack team with frontend, backend, and QA. Delegate code review to a reviewer agent."
          rows={5}
        />

        <div className="build-prompt-chips">
          {QUICK_TEMPLATES.map((template) => (
            <button
              key={template.label}
              type="button"
              onClick={() => props.onPromptChange(template.prompt)}
              disabled={props.isBuilding}
            >
              {template.label}
            </button>
          ))}
        </div>

        <div className="build-prompt-row">
          <label htmlFor="build-prompt-backend">Backend</label>
          <select
            id="build-prompt-backend"
            value={props.selectedBackend}
            onChange={(event) => props.onBackendChange(event.target.value as CliBackend["id"])}
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
              checked={props.includeExistingAgents}
              onChange={(event) => props.onIncludeExistingAgentsChange(event.target.checked)}
              disabled={props.isBuilding}
            />
            Include existing agents
          </label>
          <label>
            <input
              type="checkbox"
              checked={props.includeExistingSkills}
              onChange={(event) => props.onIncludeExistingSkillsChange(event.target.checked)}
              disabled={props.isBuilding}
            />
            Include existing skills
          </label>
          <label>
            <input
              type="checkbox"
              checked={props.includeExistingMcpServers}
              onChange={(event) => props.onIncludeExistingMcpServersChange(event.target.checked)}
              disabled={props.isBuilding}
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
          {props.hasTeam && (
            <button type="button" onClick={props.onCollapse} disabled={props.isBuilding}>
              Collapse
            </button>
          )}
          <button
            className="build-prompt-primary"
            type="button"
            onClick={props.onBuildTeam}
            disabled={props.isBuilding || !props.prompt.trim()}
          >
            {props.isBuilding ? "Building..." : props.hasTeam ? "Rebuild Team" : "Build Team"}
          </button>
        </div>
      </div>
    </div>
  );
}
