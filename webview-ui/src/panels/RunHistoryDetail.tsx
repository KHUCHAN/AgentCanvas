import { useMemo, useState } from "react";
import type { RunEvent } from "../messaging/protocol";

type RunHistoryDetailProps = {
  events: RunEvent[];
  onReplay: (modifiedPrompts?: Record<string, string>) => Promise<void> | void;
  busy?: boolean;
};

type TimelineRow = {
  nodeId: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  status: "done" | "failed" | "running";
};

export default function RunHistoryDetail(props: RunHistoryDetailProps) {
  const [editingNodeId, setEditingNodeId] = useState<string>();
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const timeline = useMemo(() => buildTimelineRows(props.events), [props.events]);
  const timeRange = useMemo(() => {
    if (timeline.length === 0) {
      return { min: 0, max: 1 };
    }
    const min = Math.min(...timeline.map((row) => row.startedAt));
    const max = Math.max(...timeline.map((row) => row.endedAt));
    return { min, max: Math.max(max, min + 1) };
  }, [timeline]);

  const runReplay = () => {
    void props.onReplay();
  };

  const runModifyReplay = () => {
    const filtered: Record<string, string> = {};
    for (const [nodeId, prompt] of Object.entries(overrides)) {
      if (prompt.trim().length > 0) {
        filtered[nodeId] = prompt.trim();
      }
    }
    void props.onReplay(Object.keys(filtered).length > 0 ? filtered : undefined);
  };

  return (
    <div className="run-history-detail">
      <div className="import-actions">
        <button onClick={runReplay} disabled={props.busy}>Replay</button>
        <button onClick={runModifyReplay} disabled={props.busy}>Modify & Replay</button>
      </div>

      <div className="timeline-list">
        {timeline.map((row) => {
          const leftPct = ((row.startedAt - timeRange.min) / (timeRange.max - timeRange.min)) * 100;
          const widthPct = ((row.endedAt - row.startedAt) / (timeRange.max - timeRange.min)) * 100;
          return (
            <div key={row.nodeId} className="timeline-row">
              <div className="timeline-label">
                <strong>{row.nodeId}</strong>
                <span>{Math.max(1, Math.round(row.durationMs / 1000))}s</span>
                <span className={`pill ${row.status === "failed" ? "pill-error" : row.status === "running" ? "pill-warning" : ""}`}>
                  {row.status}
                </span>
                <button type="button" onClick={() => setEditingNodeId((current) => (current === row.nodeId ? undefined : row.nodeId))}>
                  {editingNodeId === row.nodeId ? "Hide prompt" : "Edit prompt"}
                </button>
              </div>
              <div className="timeline-track">
                <div
                  className={`timeline-bar ${row.status}`}
                  style={{
                    left: `${Math.max(0, Math.min(100, leftPct))}%`,
                    width: `${Math.max(2, Math.min(100, widthPct))}%`
                  }}
                />
              </div>
              {editingNodeId === row.nodeId && (
                <textarea
                  rows={4}
                  className="timeline-override-editor"
                  value={overrides[row.nodeId] ?? ""}
                  onChange={(event) =>
                    setOverrides((prev) => ({
                      ...prev,
                      [row.nodeId]: event.target.value
                    }))
                  }
                  placeholder="Optional prompt override for this node replay"
                />
              )}
            </div>
          );
        })}
      </div>

      {timeline.length === 0 && <div className="muted">No timeline data</div>}
    </div>
  );
}

function buildTimelineRows(events: RunEvent[]): TimelineRow[] {
  const starts = new Map<string, number>();
  const rows = new Map<string, TimelineRow>();
  const now = Date.now();

  for (const event of events) {
    const nodeId = event.nodeId ?? "";
    if (!nodeId) {
      continue;
    }
    if (event.type === "node_started") {
      starts.set(nodeId, event.ts);
      if (!rows.has(nodeId)) {
        rows.set(nodeId, {
          nodeId,
          startedAt: event.ts,
          endedAt: event.ts,
          durationMs: 0,
          status: "running"
        });
      }
      continue;
    }
    if (event.type === "node_output" || event.type === "node_failed") {
      const startedAt = starts.get(nodeId) ?? event.ts;
      const endedAt = event.ts;
      rows.set(nodeId, {
        nodeId,
        startedAt,
        endedAt,
        durationMs: Math.max(0, endedAt - startedAt),
        status: event.type === "node_failed" ? "failed" : "done"
      });
    }
  }

  for (const [nodeId, startedAt] of starts.entries()) {
    if (!rows.has(nodeId)) {
      rows.set(nodeId, {
        nodeId,
        startedAt,
        endedAt: now,
        durationMs: Math.max(0, now - startedAt),
        status: "running"
      });
    }
  }

  return [...rows.values()].sort((left, right) => left.startedAt - right.startedAt);
}
