import { useEffect, useMemo } from "react";
import type {
  BackendUsageSummary,
  CanonicalBackendId,
  ClaudeQuotaSnapshot,
  CliSubscriptionQuota,
  CliBackend
} from "../messaging/protocol";
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
  canBuild?: boolean;
  backends: CliBackend[];
  selectedBackend: CliBackend["id"];
  onBackendChange: (backendId: CliBackend["id"]) => void;
  strategy: "smart" | "manual";
  onStrategyChange: (strategy: "smart" | "manual") => void;
  preferredBackends: CanonicalBackendId[];
  onTogglePreferredBackend: (backendId: CanonicalBackendId) => void;
  budgetConstraint: "strict" | "soft";
  onBudgetConstraintChange: (value: "strict" | "soft") => void;
  usageSummaries: BackendUsageSummary[];
  claudeQuota?: ClaudeQuotaSnapshot;
  codexQuota?: CliSubscriptionQuota;
  geminiQuota?: CliSubscriptionQuota;
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

const CANONICAL_ORDER: CanonicalBackendId[] = ["claude", "codex", "gemini", "aider", "custom"];

const PROGRESS_ICON_BY_STAGE: Record<GenerationProgress["stage"], string> = {
  building_prompt: taskRunningEffect,
  calling_cli: taskRunningEffect,
  parsing_output: taskRunningEffect,
  done: taskDoneEffect,
  error: taskFailedEffect
};

export default function BuildPromptBar(props: BuildPromptBarProps) {
  const canBuild = props.canBuild ?? Boolean(props.prompt.trim());
  const manualBackendOptions = useMemo(
    () => props.backends.filter((backend) => backend.id !== "auto" && backend.available),
    [props.backends]
  );

  const availableBackendCount = useMemo(
    () => manualBackendOptions.length,
    [manualBackendOptions]
  );

  const preferredBackendOptions = useMemo(() => {
    const seen = new Set<CanonicalBackendId>();
    const options: CanonicalBackendId[] = [];
    for (const backend of manualBackendOptions) {
      const canonical = toCanonicalBackendId(backend.id);
      if (!canonical || seen.has(canonical)) {
        continue;
      }
      seen.add(canonical);
      options.push(canonical);
    }
    return options.sort(
      (left, right) => CANONICAL_ORDER.indexOf(left) - CANONICAL_ORDER.indexOf(right)
    );
  }, [manualBackendOptions]);

  useEffect(() => {
    if (props.strategy !== "manual") {
      return;
    }
    if (manualBackendOptions.some((backend) => backend.id === props.selectedBackend)) {
      return;
    }
    props.onBackendChange(manualBackendOptions[0]?.id ?? "auto");
  }, [manualBackendOptions, props.onBackendChange, props.selectedBackend, props.strategy]);

  const compact = props.hasTeam && !props.expanded;
  const triggerBuild = () => {
    if (props.isBuilding || !canBuild) {
      return;
    }
    props.onBuildTeam();
  };
  const usageRows = useMemo(() => {
    const callMax = Math.max(
      1,
      ...props.usageSummaries.map((summary) => summary.today.callCount)
    );
    return [...props.usageSummaries]
      .sort(
        (left, right) => CANONICAL_ORDER.indexOf(left.backendId) - CANONICAL_ORDER.indexOf(right.backendId)
      )
      .map((summary) => {
        const percent = usagePercent(summary, callMax);
        const label = summary.budget
          ? `${summary.today.estimatedCost.toFixed(2)} / ${summary.budget.dailyMaxCost?.toFixed(2) ?? "-"} USD`
          : `${summary.today.callCount} calls today`;
        return { ...summary, percent, label };
      });
  }, [props.usageSummaries]);

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
              triggerBuild();
            }
          }}
        />
        <div className="build-prompt-bar-strategy-pill">
          {props.strategy === "smart" ? "Smart" : "Manual"}
        </div>
        {props.strategy === "manual" && (
          <select
            className="build-prompt-bar-select"
            value={props.selectedBackend}
            onChange={(event) => props.onBackendChange(event.target.value as CliBackend["id"])}
          >
            {manualBackendOptions.map((backend) => (
              <option key={backend.id} value={backend.id}>
                {backend.displayName}
              </option>
            ))}
          </select>
        )}
        <button type="button" onClick={props.onExpand} title="Expand prompt panel">
          Expand
        </button>
        <button
          type="button"
          className="build-prompt-primary compact"
          onClick={triggerBuild}
          disabled={props.isBuilding || !canBuild}
        >
          {props.isBuilding ? "Rebuilding..." : "Rebuild"}
        </button>
        {props.progress && (
          <div className={`build-prompt-compact-progress ${props.progress.stage}`}>
            {props.progress.message}
          </div>
        )}
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
          placeholder="e.g. Refactor frontend, update API docs, and add E2E tests."
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

        <div className="build-prompt-strategy">
          <div className="build-prompt-strategy-title">Backend strategy</div>
          <div className="build-prompt-strategy-options" role="radiogroup" aria-label="Backend strategy">
            <label>
              <input
                type="radio"
                checked={props.strategy === "smart"}
                onChange={() => props.onStrategyChange("smart")}
                disabled={props.isBuilding}
              />
              Smart assignment
            </label>
            <label>
              <input
                type="radio"
                checked={props.strategy === "manual"}
                onChange={() => props.onStrategyChange("manual")}
                disabled={props.isBuilding}
              />
              Manual backend
            </label>
          </div>

          {props.strategy === "manual" ? (
            <div className="build-prompt-row">
              <label htmlFor="build-prompt-backend">Backend</label>
              <select
                id="build-prompt-backend"
                value={props.selectedBackend}
                onChange={(event) => props.onBackendChange(event.target.value as CliBackend["id"])}
                disabled={props.isBuilding}
              >
                {manualBackendOptions.map((backend) => (
                  <option key={backend.id} value={backend.id}>
                    {backend.displayName}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="build-prompt-smart-grid">
              <div className="build-prompt-row">
                <label htmlFor="build-prompt-budget-constraint">Budget mode</label>
                <select
                  id="build-prompt-budget-constraint"
                  value={props.budgetConstraint}
                  onChange={(event) =>
                    props.onBudgetConstraintChange(event.target.value as "strict" | "soft")
                  }
                  disabled={props.isBuilding}
                >
                  <option value="soft">Soft (fallback allowed)</option>
                  <option value="strict">Strict (avoid over-budget)</option>
                </select>
              </div>
              <div className="build-prompt-preferred">
                <span>Preferred backends</span>
                <div className="build-prompt-preferred-chips">
                  {preferredBackendOptions.map((backendId) => {
                    const active = props.preferredBackends.includes(backendId);
                    return (
                      <button
                        key={backendId}
                        type="button"
                        className={active ? "is-active" : ""}
                        disabled={props.isBuilding}
                        onClick={() => props.onTogglePreferredBackend(backendId)}
                      >
                        {toBackendTitle(backendId)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <span className="build-prompt-soft">Available: {availableBackendCount}</span>
        </div>

        <div className="build-prompt-usage">
          <div className="build-prompt-usage-title">Subscription usage</div>
          {(props.claudeQuota || props.codexQuota || props.geminiQuota) ? (
            <div className="build-prompt-quota-grid">
              {props.claudeQuota && (
                <>
                  <div className="build-prompt-usage-row">
                    <div className="build-prompt-usage-row-head">
                      <span>Claude · Session</span>
                      <span>{props.claudeQuota.sessionUsedPct}% used{props.claudeQuota.sessionResetsAt ? ` · resets ${props.claudeQuota.sessionResetsAt}` : ""}</span>
                    </div>
                    <div className="build-prompt-usage-track">
                      <div className="build-prompt-usage-fill" style={{ width: `${Math.max(2, props.claudeQuota.sessionUsedPct)}%` }} />
                    </div>
                  </div>
                  <div className="build-prompt-usage-row">
                    <div className="build-prompt-usage-row-head">
                      <span>Claude · Week</span>
                      <span>{props.claudeQuota.weekAllUsedPct}% used{props.claudeQuota.weekResetsAt ? ` · resets ${props.claudeQuota.weekResetsAt}` : ""}</span>
                    </div>
                    <div className="build-prompt-usage-track">
                      <div className="build-prompt-usage-fill" style={{ width: `${Math.max(2, props.claudeQuota.weekAllUsedPct)}%` }} />
                    </div>
                  </div>
                </>
              )}
              {props.codexQuota && (
                <div className="build-prompt-usage-row">
                  <div className="build-prompt-usage-row-head">
                    <span>Codex · Session</span>
                    <span>{props.codexQuota.sessionUsedPct}% used{props.codexQuota.sessionResetsAt ? ` · resets ${props.codexQuota.sessionResetsAt}` : ""}</span>
                  </div>
                  <div className="build-prompt-usage-track">
                    <div className="build-prompt-usage-fill" style={{ width: `${Math.max(2, props.codexQuota.sessionUsedPct)}%` }} />
                  </div>
                </div>
              )}
              {props.geminiQuota && (
                <div className="build-prompt-usage-row">
                  <div className="build-prompt-usage-row-head">
                    <span>Gemini · Daily</span>
                    <span>{props.geminiQuota.sessionUsedPct}% used{props.geminiQuota.sessionResetsAt ? ` · resets in ${props.geminiQuota.sessionResetsAt}` : ""}</span>
                  </div>
                  <div className="build-prompt-usage-track">
                    <div className="build-prompt-usage-fill" style={{ width: `${Math.max(2, props.geminiQuota.sessionUsedPct)}%` }} />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="build-prompt-soft">No quota data yet — fetched from <code>claude/codex/gemini status</code> at startup.</div>
          )}
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
            <button type="button" onClick={props.onCollapse}>
              Collapse
            </button>
          )}
          <button
            className="build-prompt-primary"
            type="button"
            onClick={triggerBuild}
            disabled={props.isBuilding || !canBuild}
          >
            {props.isBuilding ? "Building..." : props.hasTeam ? "Rebuild Team" : "Build Team"}
          </button>
        </div>
      </div>
    </div>
  );
}

function toCanonicalBackendId(backendId: CliBackend["id"]): CanonicalBackendId | undefined {
  if (backendId === "claude" || backendId === "claude-code") {
    return "claude";
  }
  if (backendId === "codex" || backendId === "codex-cli") {
    return "codex";
  }
  if (backendId === "gemini" || backendId === "gemini-cli") {
    return "gemini";
  }
  if (backendId === "aider") {
    return "aider";
  }
  if (backendId === "custom") {
    return "custom";
  }
  return undefined;
}

function toBackendTitle(backendId: CanonicalBackendId): string {
  if (backendId === "claude") {
    return "Claude";
  }
  if (backendId === "codex") {
    return "Codex";
  }
  if (backendId === "gemini") {
    return "Gemini";
  }
  if (backendId === "aider") {
    return "Aider";
  }
  return "Custom";
}

function usagePercent(summary: BackendUsageSummary, callMax: number): number {
  if (summary.budget) {
    return clamp((1 - summary.availabilityScore) * 100, 0, 100);
  }
  if (callMax <= 0) {
    return 0;
  }
  return clamp((summary.today.callCount / callMax) * 100, 0, 100);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
