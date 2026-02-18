import { FormEvent, useEffect, useRef, useState } from "react";
import type { SkillPackPreview } from "../messaging/protocol";
import { useFocusTrap } from "../hooks/useFocusTrap";

type ImportPreviewModalProps = {
  preview?: SkillPackPreview;
  onClose: () => void;
  onConfirm: (installDirPath: string, overwrite: boolean) => void;
};

export default function ImportPreviewModal({
  preview,
  onClose,
  onConfirm
}: ImportPreviewModalProps) {
  const [installDirPath, setInstallDirPath] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const modalRef = useRef<HTMLFormElement>(null);
  useFocusTrap(modalRef, Boolean(preview));

  useEffect(() => {
    if (!preview) {
      return;
    }
    setInstallDirPath(preview.installDirDefault);
    setOverwrite(false);
  }, [preview]);

  useEffect(() => {
    if (!preview) {
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
  }, [onClose, preview]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!installDirPath.trim()) {
      return;
    }
    onConfirm(installDirPath.trim(), overwrite);
  };

  if (!preview) {
    return null;
  }

  return (
    <div className="command-overlay" onClick={onClose}>
      <form
        ref={modalRef}
        className="import-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Import Skill Pack Preview"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="import-title">Import Skill Pack Preview</div>
        <div className="import-subtitle">{preview.zipPath}</div>

        <div className="library-title">Detected skills</div>
        <div className="import-skills-list">
          {preview.skills.map((skill) => (
            <div key={`${skill.name}:${skill.relativePath}`} className="library-item">
              <div className="item-title">{skill.name}</div>
              <div className="item-subtitle">{skill.description || "No description"}</div>
              <div className="item-badges">
                {skill.hasScripts && <span className="pill pill-warning">scripts/ included</span>}
                {skill.allowedTools && <span className="pill">allowed-tools: {skill.allowedTools}</span>}
              </div>
            </div>
          ))}
        </div>

        {preview.warnings.length > 0 && (
          <div className="import-warnings">
            <div className="library-title">Risk warnings</div>
            {preview.warnings.map((warning) => (
              <div key={warning} className="validation-item warning">
                WARNING: {warning}
              </div>
            ))}
          </div>
        )}

        <div className="inspector-field">
          <label>Install directory</label>
          <input
            value={installDirPath}
            onChange={(event) => setInstallDirPath(event.target.value)}
            placeholder="/path/to/.github/skills"
          />
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={overwrite}
            onChange={(event) => setOverwrite(event.target.checked)}
          />
          Overwrite existing skill folders (otherwise suffix -1, -2...)
        </label>

        <div className="import-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit">
            Install skills
          </button>
        </div>
      </form>
    </div>
  );
}
