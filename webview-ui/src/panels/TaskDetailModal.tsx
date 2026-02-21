import { useEffect, useRef, useState } from "react";
import { onExtensionMessage, postToExtension } from "../messaging/vscodeBridge";

type TaskDetailModalProps = {
  taskId: string;
  taskTitle?: string;
  runId: string;
  flowName: string;
  onClose: () => void;
};

type EventRow = Record<string, unknown>;

export default function TaskDetailModal({
  taskId,
  taskTitle,
  runId,
  flowName,
  onClose
}: TaskDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [output, setOutput] = useState<string | undefined>();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [activeTab, setActiveTab] = useState<"output" | "events">("output");

  // Request event data on mount
  useEffect(() => {
    postToExtension({
      type: "GET_TASK_DETAIL",
      payload: { runId, flowName, taskId }
    });
  }, [taskId, runId, flowName]);

  // Listen for the TASK_DETAIL response
  useEffect(() => {
    return onExtensionMessage((msg) => {
      if (msg.type === "TASK_DETAIL" && msg.payload.taskId === taskId) {
        setOutput(msg.payload.output);
        setEvents(msg.payload.events);
        setLoading(false);
      }
    });
  }, [taskId]);

  // Escape key to close
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Focus trap
  useEffect(() => {
    modalRef.current?.focus();
  }, []);

  return (
    <div className="command-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className="import-modal task-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Task detail"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        style={{ maxWidth: "800px", width: "90vw", maxHeight: "80vh", display: "flex", flexDirection: "column" }}
      >
        {/* Header */}
        <div className="import-title" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>Task Detail</span>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", color: "var(--vscode-foreground)", opacity: 0.7 }}
          >
            ✕
          </button>
        </div>
        {taskTitle && (
          <div className="import-subtitle" style={{ marginBottom: "0.5rem" }}>
            {taskTitle}
          </div>
        )}
        <div style={{ fontSize: "0.75rem", opacity: 0.6, marginBottom: "0.75rem", fontFamily: "monospace" }}>
          {taskId}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", borderBottom: "1px solid var(--vscode-panel-border)" }}>
          {(["output", "events"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "0.3rem 0.75rem",
                background: "none",
                border: "none",
                borderBottom: activeTab === tab ? "2px solid var(--vscode-focusBorder)" : "2px solid transparent",
                color: activeTab === tab ? "var(--vscode-foreground)" : "var(--vscode-descriptionForeground)",
                cursor: "pointer",
                fontWeight: activeTab === tab ? 600 : 400,
                textTransform: "capitalize"
              }}
            >
              {tab === "output" ? "Output" : `Events (${events.length})`}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
          {loading ? (
            <div style={{ padding: "1rem", opacity: 0.6, textAlign: "center" }}>Loading…</div>
          ) : activeTab === "output" ? (
            <pre
              style={{
                margin: 0,
                padding: "0.75rem",
                background: "var(--vscode-editor-background)",
                borderRadius: "4px",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontSize: "0.8rem",
                lineHeight: 1.5,
                color: "var(--vscode-editor-foreground)",
                minHeight: "4rem"
              }}
            >
              {output ?? "(no output recorded)"}
            </pre>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {events.length === 0 ? (
                <div style={{ padding: "1rem", opacity: 0.6, textAlign: "center" }}>No events recorded for this task.</div>
              ) : (
                events.map((ev, idx) => (
                  <EventCard key={idx} event={ev} />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EventCard({ event }: { event: EventRow }) {
  const [expanded, setExpanded] = useState(false);
  const type = String(event["type"] ?? "event");
  const ts = typeof event["ts"] === "number" ? new Date(event["ts"]).toLocaleTimeString() : undefined;
  const actor = event["actor"] ? String(event["actor"]) : undefined;

  return (
    <div
      style={{
        background: "var(--vscode-editor-background)",
        borderRadius: "4px",
        border: "1px solid var(--vscode-panel-border)",
        overflow: "hidden"
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "0.4rem 0.6rem",
          background: "none",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          color: "var(--vscode-foreground)"
        }}
      >
        <span style={{ opacity: 0.5, fontSize: "0.7rem" }}>{expanded ? "▼" : "▶"}</span>
        <span style={{ fontWeight: 600, fontSize: "0.8rem" }}>{type}</span>
        {actor && <span style={{ opacity: 0.7, fontSize: "0.75rem" }}>· {actor}</span>}
        {ts && <span style={{ marginLeft: "auto", opacity: 0.5, fontSize: "0.7rem", fontFamily: "monospace" }}>{ts}</span>}
      </button>
      {expanded && (
        <pre
          style={{
            margin: 0,
            padding: "0.5rem 0.75rem",
            borderTop: "1px solid var(--vscode-panel-border)",
            fontSize: "0.75rem",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            color: "var(--vscode-editor-foreground)",
            maxHeight: "300px",
            overflow: "auto"
          }}
        >
          {JSON.stringify(event, null, 2)}
        </pre>
      )}
    </div>
  );
}
