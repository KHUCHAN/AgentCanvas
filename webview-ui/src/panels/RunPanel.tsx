import { useEffect, useMemo, useState } from "react";
import type {
  CliBackend,
  CliBackendOverrides,
  RunEvent,
  RunSummary,
  SessionContext,
  Task
} from "../messaging/protocol";
import BackendSettingsModal from "./BackendSettingsModal";
import RunHistoryDetail from "./RunHistoryDetail";

type BackendTestResult = {
  backendId: CliBackend["id"];
  ok: boolean;
  durationMs: number;
  model?: string;
  message: string;
  outputPreview?: string;
};

type RunPanelProps = {
  activeFlowName: string;
  selectedNodeId?: string;
  backends: CliBackend[];
  backendOverrides: CliBackendOverrides;
  defaultBackendId: CliBackend["id"];
  runs: RunSummary[];
  runEvents: RunEvent[];
  activeRunId?: string;
  selectedRunId?: string;
  selectedTask?: Task;
  onRunFlow: (payload: {
    flowName: string;
    backendId: CliBackend["id"];
    usePinnedOutputs: boolean;
    session?: SessionContext;
  }) => Promise<void>;
  onRunNode: (payload: {
    flowName: string;
    nodeId: string;
    backendId: CliBackend["id"];
    usePinnedOutput: boolean;
    session?: SessionContext;
  }) => Promise<void>;
  onReplayRun: (payload: { runId: string; modifiedPrompts?: Record<string, string> }) => Promise<void>;
  onStopRun: (runId: string) => Promise<void>;
  onRefreshRuns: () => Promise<void>;
  onSelectRun: (runId: string) => Promise<void>;
  onPinOutput: (flowName: string, nodeId: string, output: unknown) => Promise<void>;
  onUnpinOutput: (flowName: string, nodeId: string) => Promise<void>;
  onSetBackendOverrides: (overrides: CliBackendOverrides) => Promise<void>;
  onSetDefaultBackend: (backendId: CliBackend["id"]) => Promise<void>;
  onTestBackend: (backendId: CliBackend["id"]) => Promise<BackendTestResult>;
  onOpenRunLog: (runId: string, flowName: string) => void;
};

export default function RunPanel(props: RunPanelProps) {
  const [flowName, setFlowName] = useState(props.activeFlowName);
  const [backendId, setBackendId] = useState<CliBackend["id"]>(props.defaultBackendId || "auto");
  const [usePinnedOutputs, setUsePinnedOutputs] = useState(true);
  const [sessionScope, setSessionScope] = useState<SessionContext["scope"]>("workspace");
  const [sessionId, setSessionId] = useState("");
  const [pinNodeId, setPinNodeId] = useState(props.selectedNodeId ?? "");
  const [pinJson, setPinJson] = useState("{}");
  const [pinError, setPinError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [backendModalOpen, setBackendModalOpen] = useState(false);
  const [lastBackendTest, setLastBackendTest] = useState<BackendTestResult>();

  useEffect(() => {
    setFlowName(props.activeFlowName);
  }, [props.activeFlowName]);

  useEffect(() => {
    if (!props.selectedNodeId) {
      return;
    }
    setPinNodeId(props.selectedNodeId);
  }, [props.selectedNodeId]);

  useEffect(() => {
    if (props.backends.some((backend) => backend.id === backendId)) {
      return;
    }
    setBackendId(props.defaultBackendId || props.backends[0]?.id || "auto");
  }, [backendId, props.backends, props.defaultBackendId]);

  const orderedRuns = useMemo(
    () => [...props.runs].sort((left, right) => right.startedAt - left.startedAt),
    [props.runs]
  );

  const selectedRun = useMemo(
    () => orderedRuns.find((run) => run.runId === props.selectedRunId),
    [orderedRuns, props.selectedRunId]
  );

  const queueState = useMemo(() => buildQueueState(props.runEvents), [props.runEvents]);

  const collabEvents = useMemo(
    () =>
      props.runEvents
        .filter((event) =>
          event.type === "task_dispatched" ||
          event.type === "proposal_submitted" ||
          event.type === "proposal_reviewed" ||
          event.type === "proposal_applied" ||
          event.type === "proposal_rejected" ||
          event.type === "announce" ||
          event.type === "human_query_requested" ||
          event.type === "human_query_answered" ||
          event.type === "task_resumed_after_human_query"
        )
        .slice(-50),
    [props.runEvents]
  );

  const currentSession = useMemo<SessionContext>(
    () =>
      sessionScope === "workspace"
        ? { scope: "workspace" }
        : {
            scope: sessionScope,
            scopeId: sessionId.trim() || "default"
          },
    [sessionId, sessionScope]
  );

  const runFlow = async () => {
    setBusy(true);
    try {
      await props.onRunFlow({
        flowName: flowName.trim() || "default",
        backendId,
        usePinnedOutputs,
        session: currentSession
      });
    } finally {
      setBusy(false);
    }
  };

  const runNode = async () => {
    if (!props.selectedNodeId) {
      return;
    }
    setBusy(true);
    try {
      await props.onRunNode({
        flowName: flowName.trim() || "default",
        nodeId: props.selectedNodeId,
        backendId,
        usePinnedOutput: usePinnedOutputs,
        session: currentSession
      });
    } finally {
      setBusy(false);
    }
  };

  const savePin = async () => {
    if (!pinNodeId.trim()) {
      return;
    }
    try {
      const parsed = JSON.parse(pinJson);
      setPinError(undefined);
      await props.onPinOutput(flowName.trim() || "default", pinNodeId.trim(), parsed);
    } catch {
      setPinError("Pin output must be valid JSON");
    }
  };

  const replayRun = async (modifiedPrompts?: Record<string, string>) => {
    if (!props.selectedRunId) {
      return;
    }
    setBusy(true);
    try {
      await props.onReplayRun({
        runId: props.selectedRunId,
        modifiedPrompts
      });
    } finally {
      setBusy(false);
    }
  };

  const testBackendNow = async () => {
    setBusy(true);
    try {
      const result = await props.onTestBackend(backendId);
      setLastBackendTest(result);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel-content" id="right-panel-run" role="tabpanel">
      <div className="inspector-block">
        <div className="inspector-title">Run</div>
        <div className="inspector-field">
          <label>Flow</label>
          <input value={flowName} onChange={(event) => setFlowName(event.target.value)} />
        </div>
        <div className="inspector-field">
          <label>Session</label>
          <div className="inline-controls">
            <select
              value={sessionScope}
              onChange={(event) => setSessionScope(event.target.value as SessionContext["scope"])}
            >
              <option value="workspace">workspace</option>
              <option value="user">user</option>
              <option value="channel">channel</option>
            </select>
            {sessionScope !== "workspace" && (
              <input
                value={sessionId}
                onChange={(event) => setSessionId(event.target.value)}
                placeholder={`${sessionScope} id`}
              />
            )}
          </div>
        </div>
        <div className="inspector-field">
          <label>Backend</label>
          <div className="inline-controls">
            <select value={backendId} onChange={(event) => setBackendId(event.target.value as CliBackend["id"])}>
              {props.backends.map((backend) => (
                <option key={backend.id} value={backend.id}>
                  {backend.displayName}
                  {backend.id !== "auto" ? backend.available ? " ●" : " ○" : ""}
                  {backend.version ? ` · ${backend.version}` : ""}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => void testBackendNow()} disabled={busy}>Test</button>
            <button type="button" onClick={() => setBackendModalOpen(true)} aria-label="Backend settings">⚙</button>
          </div>
        </div>
        {lastBackendTest && (
          <div className={`validation-item ${lastBackendTest.ok ? "" : "error"}`}>
            {lastBackendTest.ok ? "OK" : "Failed"} · {Math.round(lastBackendTest.durationMs / 10) / 100}s
            {lastBackendTest.model ? ` · ${lastBackendTest.model}` : ""}
            {lastBackendTest.message ? ` · ${lastBackendTest.message}` : ""}
          </div>
        )}
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={usePinnedOutputs}
            onChange={(event) => setUsePinnedOutputs(event.target.checked)}
          />
          Use pinned outputs
        </label>
        <div className="import-actions">
          <button onClick={() => void runFlow()} disabled={busy}>Run Flow</button>
          <button onClick={() => void runNode()} disabled={busy || !props.selectedNodeId}>
            Run Selected Node
          </button>
          <button
            onClick={() => {
              if (!props.activeRunId) {
                return;
              }
              void props.onStopRun(props.activeRunId);
            }}
            disabled={!props.activeRunId}
          >
            Stop
          </button>
        </div>
        <div className="muted">Active run: {props.activeRunId ?? "-"}</div>
      </div>

      {props.activeRunId && (
        <div className="inspector-block run-queue-card">
          <div className="inspector-title">Running</div>
          <div className="item-subtitle">Current: {queueState.currentTask ?? "(idle)"}</div>
          <div className="item-subtitle">Last tool: {queueState.lastTool ?? "(unknown)"}</div>
          <div className="item-subtitle">Duration: {queueState.durationSec}s</div>
          <div className="item-subtitle">Last error: {queueState.lastError ?? "(none)"}</div>
          <div className="item-subtitle">Retries: {queueState.retryCount}</div>
          <div className="import-actions">
            <button onClick={() => void props.onStopRun(props.activeRunId!)}>Stop</button>
            <button
              onClick={() => props.onOpenRunLog(props.activeRunId!, props.activeFlowName)}
            >
              View Log
            </button>
          </div>
        </div>
      )}

      <div className="inspector-block">
        <div className="inspector-title">Run History</div>
        <div className="import-actions">
          <button onClick={() => void props.onRefreshRuns()}>Refresh</button>
        </div>
        <div className="agent-detail-list">
          {orderedRuns.map((run) => (
            <button
              key={run.runId}
              className={`run-item ${props.selectedRunId === run.runId ? "active" : ""}`}
              onClick={() => {
                void props.onSelectRun(run.runId);
              }}
            >
              <div className="item-title">{run.runName || run.runId}</div>
              <div className="item-subtitle">
                {new Date(run.startedAt).toLocaleString()} · {run.status}
              </div>
              <div className="item-subtitle">{run.backendId ?? "auto"}</div>
            </button>
          ))}
        </div>
        {orderedRuns.length === 0 && <div className="muted">No runs yet</div>}
      </div>

      {props.selectedRunId && (
        <div className="inspector-block">
          <div className="inspector-title">Run Timeline</div>
          <div className="item-subtitle">Run: {selectedRun?.runName || props.selectedRunId}</div>
          <RunHistoryDetail events={props.runEvents} onReplay={replayRun} busy={busy} />
        </div>
      )}

      <div className="inspector-block">
        <div className="inspector-title">Collaboration Timeline</div>
        <div className="collab-card-list">
          {collabEvents.map((event, index) => (
            <CollabCard key={`${event.ts}-${event.type}-${index}`} event={event} />
          ))}
        </div>
        {collabEvents.length === 0 && <div className="muted">No collaboration events</div>}
      </div>

      {props.selectedTask && (
        <div className="inspector-block">
          <div className="inspector-title">Selected Task</div>
          <div className="item-title">{props.selectedTask.title}</div>
          <div className="item-subtitle">Status: {props.selectedTask.status}</div>
          <div className="item-subtitle">
            Progress: {Math.round((props.selectedTask.progress ?? 0) * 100)}%
          </div>
          <div className="item-subtitle">
            Planned: {props.selectedTask.plannedStartMs ?? 0} - {props.selectedTask.plannedEndMs ?? 0}
          </div>
          {props.selectedTask.blocker && (
            <div className="validation-item warning">
              {props.selectedTask.blocker.kind}: {props.selectedTask.blocker.message}
            </div>
          )}
        </div>
      )}

      <div className="inspector-block">
        <div className="inspector-title">Pin Output</div>
        <div className="inspector-field">
          <label>Node ID</label>
          <input value={pinNodeId} onChange={(event) => setPinNodeId(event.target.value)} />
        </div>
        <div className="inspector-field">
          <label>Output JSON</label>
          <textarea rows={6} value={pinJson} onChange={(event) => setPinJson(event.target.value)} />
        </div>
        {pinError && <div className="validation-item error">{pinError}</div>}
        <div className="import-actions">
          <button onClick={() => void savePin()} disabled={!pinNodeId.trim()}>
            Pin
          </button>
          <button
            onClick={() => {
              if (!pinNodeId.trim()) {
                return;
              }
              void props.onUnpinOutput(flowName.trim() || "default", pinNodeId.trim());
            }}
            disabled={!pinNodeId.trim()}
          >
            Unpin
          </button>
        </div>
      </div>

      <BackendSettingsModal
        open={backendModalOpen}
        backends={props.backends}
        overrides={props.backendOverrides}
        defaultBackendId={props.defaultBackendId}
        onClose={() => setBackendModalOpen(false)}
        onSaveOverrides={props.onSetBackendOverrides}
        onSetDefaultBackend={props.onSetDefaultBackend}
        onTestBackend={props.onTestBackend}
      />
    </div>
  );
}

function CollabCard(props: { event: RunEvent }) {
  const meta = props.event.payload as Record<string, unknown> | undefined;
  const summary = typeof meta?.summary === "string" ? meta.summary : undefined;
  const reason = typeof meta?.reason === "string" ? meta.reason : undefined;
  return (
    <div className={`collab-card collab-${props.event.type}`}>
      <div className="collab-card-header">
        <span className="pill">{props.event.type}</span>
        <span className="muted">{new Date(props.event.ts).toLocaleTimeString()}</span>
      </div>
      <div className="item-subtitle">
        {props.event.actor ? `Actor: ${props.event.actor}` : props.event.nodeId ? `Node: ${props.event.nodeId}` : ""}
      </div>
      {summary && <div>{summary}</div>}
      {reason && <div>{reason}</div>}
      {typeof props.event.message === "string" && props.event.message && <div>{props.event.message}</div>}
      {!summary && !reason && Boolean(props.event.payload) ? (
        <pre className="collab-payload">{JSON.stringify(props.event.payload, null, 2)}</pre>
      ) : null}
    </div>
  );
}

function buildQueueState(events: RunEvent[]): {
  currentTask?: string;
  lastTool?: string;
  durationSec: number;
  lastError?: string;
  retryCount: number;
} {
  const sorted = [...events].sort((left, right) => left.ts - right.ts);
  const latestStart = [...sorted].reverse().find((event) => event.type === "node_started");
  const currentNodeId = latestStart?.nodeId;
  const endedAfterStart = currentNodeId
    ? sorted.find(
      (event) =>
        event.nodeId === currentNodeId &&
        (event.type === "node_output" || event.type === "node_failed") &&
        event.ts >= (latestStart?.ts ?? 0)
    )
    : undefined;

  const lastOutput = [...sorted].reverse().find((event) => event.type === "node_output");
  const lastFailure = [...sorted].reverse().find((event) => event.type === "node_failed");
  const retryCount = sorted.filter((event) => event.type === "node_failed").length;

  return {
    currentTask: currentNodeId && !endedAfterStart ? currentNodeId : undefined,
    lastTool:
      (lastOutput?.meta as Record<string, unknown> | undefined)?.backendId as string | undefined,
    durationSec: latestStart ? Math.max(0, Math.round((Date.now() - latestStart.ts) / 1000)) : 0,
    lastError: lastFailure?.message,
    retryCount
  };
}
