import { useEffect, useMemo, useState } from "react";
import type { CliBackend, CliBackendOverrides, RunEvent, RunSummary, Task } from "../messaging/protocol";

type RunPanelProps = {
  activeFlowName: string;
  selectedNodeId?: string;
  backends: CliBackend[];
  runs: RunSummary[];
  runEvents: RunEvent[];
  activeRunId?: string;
  selectedRunId?: string;
  selectedTask?: Task;
  onRunFlow: (payload: {
    flowName: string;
    backendId: CliBackend["id"];
    usePinnedOutputs: boolean;
  }) => Promise<void>;
  onRunNode: (payload: {
    flowName: string;
    nodeId: string;
    backendId: CliBackend["id"];
    usePinnedOutput: boolean;
  }) => Promise<void>;
  onStopRun: (runId: string) => Promise<void>;
  onRefreshRuns: () => Promise<void>;
  onSelectRun: (runId: string) => Promise<void>;
  onPinOutput: (flowName: string, nodeId: string, output: unknown) => Promise<void>;
  onUnpinOutput: (flowName: string, nodeId: string) => Promise<void>;
  onSetBackendOverrides: (overrides: CliBackendOverrides) => Promise<void>;
};

export default function RunPanel(props: RunPanelProps) {
  const [flowName, setFlowName] = useState(props.activeFlowName);
  const [backendId, setBackendId] = useState<CliBackend["id"]>("auto");
  const [usePinnedOutputs, setUsePinnedOutputs] = useState(true);
  const [pinNodeId, setPinNodeId] = useState(props.selectedNodeId ?? "");
  const [pinJson, setPinJson] = useState("{}");
  const [pinError, setPinError] = useState<string>();
  const [overrideText, setOverrideText] = useState("{}");
  const [overrideError, setOverrideError] = useState<string>();
  const [busy, setBusy] = useState(false);

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
    setBackendId(props.backends[0]?.id ?? "auto");
  }, [backendId, props.backends]);

  const orderedRuns = useMemo(
    () => [...props.runs].sort((left, right) => right.startedAt - left.startedAt),
    [props.runs]
  );

  const runFlow = async () => {
    setBusy(true);
    try {
      await props.onRunFlow({
        flowName: flowName.trim() || "default",
        backendId,
        usePinnedOutputs
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
        usePinnedOutput: usePinnedOutputs
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

  const saveOverrides = async () => {
    try {
      const parsed = JSON.parse(overrideText) as CliBackendOverrides;
      setOverrideError(undefined);
      await props.onSetBackendOverrides(parsed);
    } catch {
      setOverrideError("Backend overrides must be valid JSON");
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
          <label>Backend</label>
          <select value={backendId} onChange={(event) => setBackendId(event.target.value as CliBackend["id"])}>
            {props.backends.map((backend) => (
              <option key={backend.id} value={backend.id}>
                {backend.displayName} {backend.id !== "auto" ? (backend.available ? "●" : "○") : ""}
              </option>
            ))}
          </select>
        </div>
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

      <div className="inspector-block">
        <div className="inspector-title">Last Run Events</div>
        <div className="run-events">
          {props.runEvents.map((event, index) => (
            <div key={`${event.ts}-${event.type}-${index}`} className="run-event-row">
              <span className="pill">{event.type}</span>
              <span className="muted">{new Date(event.ts).toLocaleTimeString()}</span>
              <span>{event.nodeId ?? event.message ?? ""}</span>
            </div>
          ))}
        </div>
        {props.runEvents.length === 0 && <div className="muted">No events loaded</div>}
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
        <div className="inspector-title">Backend Overrides</div>
        <div className="inspector-field">
          <label>JSON</label>
          <textarea
            rows={6}
            value={overrideText}
            onChange={(event) => setOverrideText(event.target.value)}
            placeholder='{"claude-code":{"command":"claude","args":["--print"]}}'
          />
        </div>
        {overrideError && <div className="validation-item error">{overrideError}</div>}
        <div className="import-actions">
          <button onClick={() => void saveOverrides()}>Save Overrides</button>
        </div>
      </div>

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
    </div>
  );
}
