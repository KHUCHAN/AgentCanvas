import { useEffect, useRef } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";

type KeyboardHelpModalProps = {
  open: boolean;
  onClose: () => void;
};

const SHORTCUTS: Array<{ key: string; action: string }> = [
  { key: "Ctrl/Cmd+S", action: "Save flow and inspector changes" },
  { key: "Ctrl/Cmd+O", action: "Load flow" },
  { key: "R", action: "Refresh discovery" },
  { key: "Ctrl/Cmd+K", action: "Open command bar" },
  { key: "Ctrl/Cmd+L", action: "Open node library" },
  { key: "Shift+S", action: "Add sticky note" },
  { key: "Ctrl+Wheel / +/-", action: "Zoom canvas" },
  { key: "1 / 0", action: "Fit view / Reset view" },
  { key: "Arrow Keys", action: "Move selection to nearby node" },
  { key: "Enter", action: "Open selected node target" },
  { key: "Delete/Backspace", action: "Delete selected note node" },
  { key: "Escape", action: "Close modal / clear node selection" }
];

export default function KeyboardHelpModal({ open, onClose }: KeyboardHelpModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, open);

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

  if (!open) {
    return null;
  }

  return (
    <div className="command-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className="import-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="import-title">Keyboard Shortcuts</div>
        <div className="import-subtitle">Key-first controls for AgentCanvas.</div>
        <div className="agent-detail-list">
          {SHORTCUTS.map((item) => (
            <div key={item.key} className="agent-detail-item">
              <div className="agent-detail-item-header">
                <strong>{item.key}</strong>
                <span className="muted">{item.action}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="import-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
