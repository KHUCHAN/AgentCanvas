import { useEffect, useMemo, useState } from "react";
import type { AgentProfile, CliBackend, RunSummary, Task } from "../messaging/protocol";

type TeamPanelProps = {
  agents: AgentProfile[];
  backends: CliBackend[];
  runs: RunSummary[];
  selectedRunId?: string;
  activeRunId?: string;
  selectedTask?: Task;
  busy: boolean;
  onCreateAgent: () => void;
  onCreateSkill: () => void;
  onRebuildTeam: () => void;
  onOpenAgent: (agentId: string, agentName: string) => void;
  onRunTask: (payload: {
    instruction: string;
    backendId: CliBackend["id"];
  }) => Promise<void>;
  onRefreshRuns: () => Promise<void>;
  onSelectRun: (runId: string) => Promise<void>;
};

export default function TeamPanel(props: TeamPanelProps) {
  const [instruction, setInstruction] = useState("");
  const [backendId, setBackendId] = useState<CliBackend["id"]>("auto");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (props.backends.some((backend) => backend.id === backendId)) {
      return;
    }
    setBackendId(props.backends[0]?.id ?? "auto");
  }, [backendId, props.backends]);

  const sortedAgents = useMemo(
    () =>
      [...props.agents].sort((left, right) => {
        if (left.isOrchestrator !== right.isOrchestrator) {
          return left.isOrchestrator ? -1 : 1;
        }
        return left.name.localeCompare(right.name);
      }),
    [props.agents]
  );

  const orderedRuns = useMemo(
    () => [...props.runs].sort((left, right) => right.startedAt - left.startedAt),
    [props.runs]
  );

  const submitTask = async () => {
    const trimmed = instruction.trim();
    if (!trimmed || submitting || props.busy) {
      return;
    }
    setSubmitting(true);
    try {
      await props.onRunTask({
        instruction: trimmed,
        backendId
      });
      setInstruction("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <aside className="team-panel">
      <section className="team-panel-block">
        <div className="team-panel-title-row">
          <h3>My Team</h3>
          <div className="team-panel-inline-actions">
            <button type="button" onClick={props.onCreateAgent}>+ Agent</button>
            <button type="button" onClick={props.onCreateSkill}>+ Skill</button>
            <button type="button" onClick={props.onRebuildTeam}>Rebuild</button>
          </div>
        </div>

        <div className="team-agent-list">
          {sortedAgents.map((agent) => (
            <button
              key={agent.id}
              type="button"
              className={`team-agent-card ${agent.isOrchestrator ? "is-orchestrator" : ""}`}
              onClick={() => props.onOpenAgent(agent.id, agent.name)}
            >
              <div className="team-agent-main">
                <span className="team-agent-role">{roleBadge(agent)}</span>
                <span className="team-agent-name">{agent.name}</span>
              </div>
              <div className="team-agent-meta">
                {agent.providerId} · Skills {agent.assignedSkillIds?.length ?? 0} · MCP {agent.assignedMcpServerIds?.length ?? 0}
              </div>
            </button>
          ))}
          {sortedAgents.length === 0 && <div className="muted">No team members yet</div>}
        </div>
      </section>

      <section className="team-panel-block">
        <div className="team-panel-title-row">
          <h3>Work</h3>
          <span className="team-panel-soft">{props.activeRunId ? `Running ${props.activeRunId}` : "Idle"}</span>
        </div>

        <textarea
          className="team-work-input"
          rows={4}
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder='e.g. Review PR #42 and split into tasks for frontend, backend, and QA.'
        />

        <div className="team-panel-row">
          <label htmlFor="team-work-backend">Backend</label>
          <select
            id="team-work-backend"
            value={backendId}
            onChange={(event) => setBackendId(event.target.value as CliBackend["id"])}
          >
            {props.backends.map((backend) => (
              <option key={backend.id} value={backend.id}>
                {backend.displayName} {backend.id !== "auto" ? (backend.available ? "●" : "○") : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="team-panel-actions">
          <button
            type="button"
            className="team-panel-primary"
            onClick={() => void submitTask()}
            disabled={submitting || props.busy || !instruction.trim()}
          >
            {submitting ? "Running..." : "Run Task"}
          </button>
        </div>
      </section>

      <section className="team-panel-block">
        <div className="team-panel-title-row">
          <h3>History</h3>
          <button type="button" onClick={() => void props.onRefreshRuns()}>Refresh</button>
        </div>
        <div className="team-history-list">
          {orderedRuns.map((run) => (
            <button
              key={run.runId}
              type="button"
              className={`team-history-item ${props.selectedRunId === run.runId ? "is-selected" : ""}`}
              onClick={() => void props.onSelectRun(run.runId)}
            >
              <div className="team-history-title">{run.runName || run.runId}</div>
              <div className="team-history-meta">
                {new Date(run.startedAt).toLocaleString()} · {run.status}
              </div>
            </button>
          ))}
          {orderedRuns.length === 0 && <div className="muted">No run history</div>}
        </div>
        {props.selectedTask && (
          <div className="team-selected-task">
            <div className="team-history-title">{props.selectedTask.title}</div>
            <div className="team-history-meta">
              {props.selectedTask.status} · {Math.round((props.selectedTask.progress ?? 0) * 100)}%
            </div>
            {props.selectedTask.blocker && (
              <div className="validation-item warning">
                {props.selectedTask.blocker.kind}: {props.selectedTask.blocker.message}
              </div>
            )}
          </div>
        )}
      </section>
    </aside>
  );
}

function roleBadge(agent: AgentProfile): string {
  if (agent.isOrchestrator) {
    return "Lead";
  }
  const role = agent.role ?? "custom";
  switch (role) {
    case "coder":
      return "Coder";
    case "reviewer":
      return "Reviewer";
    case "tester":
      return "Tester";
    case "researcher":
      return "Researcher";
    case "writer":
      return "Writer";
    case "planner":
      return "Planner";
    default:
      return "Agent";
  }
}
