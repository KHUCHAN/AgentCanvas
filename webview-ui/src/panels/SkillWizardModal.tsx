import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";

type SkillScope = "project" | "personal" | "shared" | "global";

const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type SkillWizardModalProps = {
  open: boolean;
  baseDirOptions: Array<{ label: string; path: string }>;
  defaultBaseDirPath: string;
  onClose: () => void;
  onCreate: (input: {
    baseDirPath: string;
    name: string;
    description: string;
    scope: SkillScope;
    generateOpenAiYaml: boolean;
  }) => Promise<void>;
};

export default function SkillWizardModal({
  open,
  baseDirOptions,
  defaultBaseDirPath,
  onClose,
  onCreate
}: SkillWizardModalProps) {
  const [baseDirPath, setBaseDirPath] = useState(defaultBaseDirPath);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<SkillScope>("project");
  const [generateOpenAiYaml, setGenerateOpenAiYaml] = useState(true);
  const [busy, setBusy] = useState(false);
  const modalRef = useRef<HTMLFormElement>(null);
  useFocusTrap(modalRef, open);

  useEffect(() => {
    if (!open) {
      setBaseDirPath(defaultBaseDirPath);
      setName("");
      setDescription("");
      setScope("project");
      setGenerateOpenAiYaml(true);
      setBusy(false);
      return;
    }
    setBaseDirPath(defaultBaseDirPath);
  }, [defaultBaseDirPath, open]);

  const nameError = useMemo(() => {
    if (!name.trim()) {
      return "name is required";
    }
    if (name.trim().length > 64) {
      return "name must be 64 chars or less";
    }
    if (!NAME_RE.test(name.trim())) {
      return "use lowercase letters, numbers, and hyphens only";
    }
    return undefined;
  }, [name]);

  const descriptionError = useMemo(() => {
    if (!description.trim()) {
      return "description is required";
    }
    if (description.trim().length > 1024) {
      return "description must be 1024 chars or less";
    }
    return undefined;
  }, [description]);

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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || nameError || descriptionError) {
      return;
    }
    setBusy(true);
    try {
      await onCreate({
        baseDirPath,
        name: name.trim(),
        description: description.trim(),
        scope,
        generateOpenAiYaml
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
        className="skill-wizard-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Skill Wizard"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="import-title">Skill Wizard</div>
        <div className="import-subtitle">Create a validated `SKILL.md` template in one step.</div>

        <div className="inspector-field">
          <label>Install location</label>
          <select
            value={baseDirPath}
            onChange={(event) => setBaseDirPath(event.target.value)}
            disabled={busy}
          >
            {baseDirOptions.map((option) => (
              <option key={option.path} value={option.path}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="inspector-field">
          <label>Name (folder + frontmatter)</label>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. api-conventions"
            disabled={busy}
          />
          {nameError && <div className="validation-item error">ERROR: {nameError}</div>}
        </div>

        <div className="inspector-field">
          <label>Description (when to use)</label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            disabled={busy}
          />
          {descriptionError && <div className="validation-item error">ERROR: {descriptionError}</div>}
        </div>

        <div className="inspector-field">
          <label>Scope badge</label>
          <select
            value={scope}
            onChange={(event) => setScope(event.target.value as SkillScope)}
            disabled={busy}
          >
            <option value="project">project</option>
            <option value="personal">personal</option>
            <option value="shared">shared</option>
            <option value="global">global</option>
          </select>
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={generateOpenAiYaml}
            onChange={(event) => setGenerateOpenAiYaml(event.target.checked)}
            disabled={busy}
          />
          Generate `agents/openai.yaml` for Codex metadata
        </label>

        <div className="import-actions">
          <button type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !!nameError || !!descriptionError}
          >
            Create Skill
          </button>
        </div>
      </form>
    </div>
  );
}
