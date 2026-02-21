import { useMemo, useState } from "react";

type HumanQueryCardProps = {
  runId: string;
  taskId: string;
  question: string;
  onRespond: (payload: { runId: string; taskId: string; answer: string }) => Promise<void>;
  onOpenTaskDetail?: (taskId: string, runId: string) => void;
};

export default function HumanQueryCard(props: HumanQueryCardProps) {
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<number | undefined>();
  const [error, setError] = useState<string | undefined>();

  const canSubmit = useMemo(() => answer.trim().length > 0 && !submitting, [answer, submitting]);

  const submit = async () => {
    const trimmed = answer.trim();
    if (!trimmed || submitting) {
      return;
    }
    setSubmitting(true);
    setError(undefined);
    try {
      await props.onRespond({
        runId: props.runId,
        taskId: props.taskId,
        answer: trimmed
      });
      setSubmittedAt(Date.now());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="human-query-card">
      <div className="inspector-title">Human Input Required</div>
      <div className="node-meta human-query-meta">
        <span>Task: {props.taskId}</span>
        <span>Run: {props.runId}</span>
      </div>
      <pre className="human-query-question">{props.question}</pre>
      <textarea
        className="human-query-textarea"
        value={answer}
        onChange={(event) => {
          setAnswer(event.target.value);
          setSubmittedAt(undefined);
        }}
        placeholder="Write your answer for the orchestrator..."
        rows={3}
        disabled={submitting}
      />
      <div className="human-query-actions">
        <button
          type="button"
          onClick={() => props.onOpenTaskDetail?.(props.taskId, props.runId)}
        >
          Open task
        </button>
        <button type="button" onClick={() => void submit()} disabled={!canSubmit}>
          {submitting ? "Sending..." : "Send answer"}
        </button>
      </div>
      {submittedAt && !error && (
        <div className="human-query-status success">
          Submitted at {new Date(submittedAt).toLocaleTimeString()}
        </div>
      )}
      {error && <div className="human-query-status error">{error}</div>}
    </div>
  );
}
