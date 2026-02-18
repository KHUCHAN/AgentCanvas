import { FormEvent, useEffect, useRef, useState } from "react";
import type { AgentRole } from "../messaging/protocol";
import { useFocusTrap } from "../hooks/useFocusTrap";

type AgentCreationModalProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: {
    name: string;
    role: AgentRole;
    roleLabel?: string;
    description?: string;
    systemPrompt?: string;
    isOrchestrator: boolean;
  }) => Promise<void>;
};

const ROLE_OPTIONS: AgentRole[] = [
  "orchestrator",
  "coder",
  "researcher",
  "reviewer",
  "planner",
  "tester",
  "writer",
  "custom"
];

export default function AgentCreationModal({ open, onClose, onCreate }: AgentCreationModalProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<AgentRole>("custom");
  const [roleLabel, setRoleLabel] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [isOrchestrator, setIsOrchestrator] = useState(false);
  const [busy, setBusy] = useState(false);
  const modalRef = useRef<HTMLFormElement>(null);
  useFocusTrap(modalRef, open);

  useEffect(() => {
    if (!open) {
      setName("");
      setRole("custom");
      setRoleLabel("");
      setDescription("");
      setSystemPrompt("");
      setIsOrchestrator(false);
      setBusy(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose, open]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || busy) {
      return;
    }
    setBusy(true);
    try {
      await onCreate({
        name: name.trim(),
        role,
        roleLabel: roleLabel.trim() || undefined,
        description: description.trim() || undefined,
        systemPrompt: systemPrompt.trim() || undefined,
        isOrchestrator
      });
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="command-overlay" onClick={() => !busy && onClose()}>
      <form
        ref={modalRef}
        className="import-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Create Agent"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => void onSubmit(event)}
      >
        <div className="import-title">Create Agent</div>
        <div className="import-subtitle">Add a custom role-based agent to this workspace.</div>

        <div className="inspector-field">
          <label>Name</label>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Main Orchestrator" />
        </div>

        <div className="inspector-field">
          <label>Role</label>
          <select value={role} onChange={(event) => setRole(event.target.value as AgentRole)}>
            {ROLE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div className="inspector-field">
          <label>Role label</label>
          <input value={roleLabel} onChange={(event) => setRoleLabel(event.target.value)} placeholder="e.g. Team Lead" />
        </div>

        <div className="inspector-field">
          <label>Description</label>
          <input value={description} onChange={(event) => setDescription(event.target.value)} />
        </div>

        <label className="checkbox-row">
          <input type="checkbox" checked={isOrchestrator} onChange={(event) => setIsOrchestrator(event.target.checked)} />
          Is orchestrator
        </label>

        <div className="inspector-field">
          <label>System Prompt</label>
          <textarea value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} rows={5} />
        </div>

        <div className="import-actions">
          <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" disabled={busy || !name.trim()}>Create Agent</button>
        </div>
      </form>
    </div>
  );
}
