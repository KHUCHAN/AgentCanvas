import { useMemo, useState } from "react";
import type { RunEvent } from "../messaging/protocol";

type InspectorVariablesProps = {
  flowName: string;
  nodeId?: string;
  runEvents: RunEvent[];
  onPinOutput: (flowName: string, nodeId: string, output: unknown) => Promise<void>;
};

export default function InspectorVariables(props: InspectorVariablesProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [error, setError] = useState<string>();

  const latestOutput = useMemo(() => {
    if (!props.nodeId) {
      return undefined;
    }
    const events = props.runEvents
      .filter((event) => event.type === "node_output" && event.nodeId === props.nodeId)
      .sort((left, right) => right.ts - left.ts);
    return events[0]?.output;
  }, [props.nodeId, props.runEvents]);

  const latestTs = useMemo(() => {
    if (!props.nodeId) {
      return undefined;
    }
    const event = props.runEvents
      .filter((row) => row.type === "node_output" && row.nodeId === props.nodeId)
      .sort((left, right) => right.ts - left.ts)[0];
    return event?.ts;
  }, [props.nodeId, props.runEvents]);

  const pinCurrent = async () => {
    if (!props.nodeId || latestOutput === undefined) {
      return;
    }
    await props.onPinOutput(props.flowName, props.nodeId, latestOutput);
  };

  const saveEdited = async () => {
    if (!props.nodeId) {
      return;
    }
    try {
      const parsed = JSON.parse(jsonText);
      setError(undefined);
      await props.onPinOutput(props.flowName, props.nodeId, parsed);
      setEditOpen(false);
    } catch {
      setError("Pinned output must be valid JSON.");
    }
  };

  if (!props.nodeId) {
    return <div className="muted">Select a node to inspect variables.</div>;
  }

  return (
    <div className="inspector-block">
      <div className="inspector-title">Variables</div>
      <div className="item-subtitle">Node: {props.nodeId}</div>
      <div className="item-subtitle">Last output: {latestTs ? new Date(latestTs).toLocaleString() : "-"}</div>
      <div className="import-actions">
        <button onClick={() => void pinCurrent()} disabled={latestOutput === undefined}>
          Pin this output
        </button>
        <button
          onClick={() => {
            setEditOpen((value) => !value);
            setJsonText(JSON.stringify(latestOutput ?? {}, null, 2));
            setError(undefined);
          }}
          disabled={latestOutput === undefined}
        >
          Edit pinned output
        </button>
      </div>

      {editOpen && (
        <div className="inspector-field">
          <label>Pinned output JSON</label>
          <textarea rows={8} value={jsonText} onChange={(event) => setJsonText(event.target.value)} />
          {error && <div className="validation-item error">{error}</div>}
          <div className="import-actions">
            <button onClick={() => void saveEdited()}>Save</button>
          </div>
        </div>
      )}

      <div className="json-tree">
        <JsonNode name="output" value={latestOutput} />
      </div>
    </div>
  );
}

function JsonNode(props: { name?: string; value: unknown }) {
  const value = props.value;
  if (value === null || value === undefined) {
    return (
      <div className="json-row">
        {props.name ? <span className="json-key">{props.name}: </span> : null}
        <span className="json-primitive">null</span>
      </div>
    );
  }

  if (typeof value !== "object") {
    return (
      <div className="json-row">
        {props.name ? <span className="json-key">{props.name}: </span> : null}
        <span className="json-primitive">{String(value)}</span>
      </div>
    );
  }

  if (Array.isArray(value)) {
    return (
      <details className="json-branch" open>
        <summary>
          {props.name ? `${props.name}: ` : ""}
          [{value.length}]
        </summary>
        <div className="json-children">
          {value.map((item, index) => (
            <JsonNode key={`${index}`} name={String(index)} value={item} />
          ))}
        </div>
      </details>
    );
  }

  const entries = Object.entries(value as Record<string, unknown>);
  return (
    <details className="json-branch" open>
      <summary>
        {props.name ? `${props.name}: ` : ""}
        {"{"}
        {entries.length}
        {"}"}
      </summary>
      <div className="json-children">
        {entries.map(([key, item]) => (
          <JsonNode key={key} name={key} value={item} />
        ))}
      </div>
    </details>
  );
}
