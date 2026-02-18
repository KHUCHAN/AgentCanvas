import { FormEvent, useEffect, useRef, useState } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";

type CommonRuleModalProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (title: string, body: string) => void;
};

export default function CommonRuleModal({ open, onClose, onCreate }: CommonRuleModalProps) {
  const [title, setTitle] = useState("Common Rule");
  const [body, setBody] = useState("");
  const modalRef = useRef<HTMLFormElement>(null);
  useFocusTrap(modalRef, open);

  useEffect(() => {
    if (!open) {
      setTitle("Common Rule");
      setBody("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !body.trim()) {
      return;
    }
    onCreate(title.trim(), body.trim());
  };

  if (!open) {
    return null;
  }

  return (
    <div className="command-overlay" onClick={onClose}>
      <form
        ref={modalRef}
        className="common-rule-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Add Common Rule"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="import-title">Add Common Rule</div>
        <div className="import-subtitle">
          This creates or appends to <code>AGENTS.md</code> in workspace root.
        </div>

        <div className="inspector-field">
          <label>Rule title</label>
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>

        <div className="inspector-field">
          <label>Rule content</label>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={8}
            placeholder="Write common instruction that should apply to all providers..."
          />
        </div>

        <div className="import-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit">
            Add Rule
          </button>
        </div>
      </form>
    </div>
  );
}
