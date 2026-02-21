import { useEffect, useRef, useState } from "react";
import { onExtensionMessage, postToExtension } from "../messaging/vscodeBridge";
import type { TaskConversationTurn } from "../messaging/protocol";

type TaskDetailModalProps = {
  taskId: string;
  taskTitle?: string;
  runId: string;
  flowName: string;
  taskStatus?: string;
  onClose: () => void;
};

type EventRow = Record<string, unknown>;

export default function TaskDetailModal({
  taskId,
  taskTitle,
  runId,
  flowName,
  taskStatus,
  onClose
}: TaskDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const outputEndRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [output, setOutput] = useState<string | undefined>();
  const [streamingOutput, setStreamingOutput] = useState("");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [conversation, setConversation] = useState<TaskConversationTurn[]>([]);
  const [conversationLoading, setConversationLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"output" | "events" | "conversation">("output");

  const isLive = taskStatus === "running";

  useEffect(() => {
    setLoading(true);
    setConversationLoading(true);
    setOutput(undefined);
    setStreamingOutput("");
    setEvents([]);
    setConversation([]);
  }, [taskId]);

  // Request event data on mount
  useEffect(() => {
    postToExtension({
      type: "GET_TASK_DETAIL",
      payload: { runId, flowName, taskId }
    });
    postToExtension({
      type: "GET_TASK_CONVERSATION",
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

  // Listen for the TASK_CONVERSATION response
  useEffect(() => {
    return onExtensionMessage((msg) => {
      if (msg.type === "TASK_CONVERSATION" && msg.payload.taskId === taskId) {
        setConversation(msg.payload.turns ?? []);
        setConversationLoading(false);
      }
    });
  }, [taskId]);

  // Listen for real-time TASK_STREAM_CHUNK
  useEffect(() => {
    return onExtensionMessage((msg) => {
      if (msg.type === "TASK_STREAM_CHUNK" && msg.payload.taskId === taskId) {
        setStreamingOutput((prev) => prev + msg.payload.chunk);
        setLoading(false);
      }
    });
  }, [taskId]);

  // Auto-scroll to bottom when streaming
  useEffect(() => {
    if (activeTab === "output" && streamingOutput) {
      outputEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeTab, streamingOutput]);

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

  const displayOutput = output ?? (streamingOutput || undefined);

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
          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            Task Detail
            {isLive && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  color: "#4ec9b0",
                  background: "rgba(78, 201, 176, 0.12)",
                  borderRadius: "4px",
                  padding: "0.15rem 0.45rem"
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#4ec9b0",
                    animation: "pulse 1.5s ease-in-out infinite"
                  }}
                />
                Live
              </span>
            )}
          </span>
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
          {(["output", "conversation", "events"] as const).map((tab) => (
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
              {tab === "output"
                ? "Output"
                : tab === "conversation"
                  ? `Conversation (${conversation.length})`
                  : `Events (${events.length})`}
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
              {displayOutput ?? "(no output recorded)"}
              <div ref={outputEndRef} />
            </pre>
          ) : activeTab === "conversation" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {conversationLoading ? (
                <div style={{ padding: "1rem", opacity: 0.6, textAlign: "center" }}>Loading conversation…</div>
              ) : conversation.length === 0 ? (
                <div style={{ padding: "1rem", opacity: 0.6, textAlign: "center" }}>
                  No orchestrator/agent conversation recorded for this task.
                </div>
              ) : (
                conversation.map((turn) => (
                  <ConversationTurnCard key={turn.turnId} turn={turn} />
                ))
              )}
            </div>
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
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
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

function ConversationTurnCard({ turn }: { turn: TaskConversationTurn }) {
  const isOrchestrator = turn.role === "orchestrator";
  return (
    <div
      style={{
        background: "var(--vscode-editor-background)",
        borderRadius: "4px",
        border: "1px solid var(--vscode-panel-border)",
        overflow: "hidden"
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.4rem 0.6rem",
          borderBottom: "1px solid var(--vscode-panel-border)",
          fontSize: "0.75rem",
          opacity: 0.85
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: "92px",
            padding: "0.1rem 0.4rem",
            borderRadius: "999px",
            fontWeight: 600,
            background: isOrchestrator
              ? "color-mix(in srgb, var(--vscode-focusBorder) 20%, transparent)"
              : "color-mix(in srgb, var(--vscode-charts-green) 20%, transparent)"
          }}
        >
          {isOrchestrator ? "orchestrator" : "agent"}
        </span>
        {turn.agentId && <span>{turn.agentId}</span>}
        <span style={{ marginLeft: "auto", opacity: 0.7, fontFamily: "monospace" }}>
          {new Date(turn.timestamp).toLocaleTimeString()}
        </span>
      </div>
      <pre
        style={{
          margin: 0,
          padding: "0.65rem 0.75rem",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontSize: "0.76rem",
          lineHeight: 1.45,
          color: "var(--vscode-editor-foreground)"
        }}
      >
        {turn.content}
      </pre>
    </div>
  );
}
