import { useEffect, useMemo, useState } from "react";
import type { CliBackend, CliBackendOverrides } from "../messaging/protocol";

type BackendTestResult = {
  backendId: CliBackend["id"];
  ok: boolean;
  durationMs: number;
  model?: string;
  message: string;
  outputPreview?: string;
};

type BackendSettingsModalProps = {
  open: boolean;
  backends: CliBackend[];
  overrides: CliBackendOverrides;
  defaultBackendId: CliBackend["id"];
  onClose: () => void;
  onSaveOverrides: (overrides: CliBackendOverrides) => Promise<void>;
  onSetDefaultBackend: (backendId: CliBackend["id"]) => Promise<void>;
  onTestBackend: (backendId: CliBackend["id"]) => Promise<BackendTestResult>;
};

type OverrideDraft = {
  command: string;
  argsText: string;
  envKeysText: string;
  displayName: string;
};

type EditableBackend = CliBackend & { id: Exclude<CliBackend["id"], "auto"> };

export default function BackendSettingsModal(props: BackendSettingsModalProps) {
  const editableBackends = useMemo(
    () => props.backends.filter((backend): backend is EditableBackend => backend.id !== "auto"),
    [props.backends]
  );
  const [drafts, setDrafts] = useState<Record<string, OverrideDraft>>({});
  const [busy, setBusy] = useState(false);
  const [testByBackend, setTestByBackend] = useState<Record<string, BackendTestResult>>({});

  useEffect(() => {
    if (!props.open) {
      return;
    }
    const next: Record<string, OverrideDraft> = {};
    for (const backend of editableBackends) {
      const override = props.overrides[backend.id];
      const envKeys = Object.keys(override?.env ?? {});
      next[backend.id] = {
        command: override?.command ?? "",
        argsText: (override?.args ?? []).join(" "),
        envKeysText: envKeys.join(", "),
        displayName: override?.displayName ?? ""
      };
    }
    setDrafts(next);
    setTestByBackend({});
  }, [editableBackends, props.open, props.overrides]);

  if (!props.open) {
    return null;
  }

  const save = async () => {
    setBusy(true);
    try {
      const nextOverrides: CliBackendOverrides = {};
      for (const backend of editableBackends) {
        const draft = drafts[backend.id];
        if (!draft) {
          continue;
        }
        const command = draft.command.trim();
        const args = splitArgs(draft.argsText);
        const envKeys = splitCsv(draft.envKeysText);
        nextOverrides[backend.id] = {
          command: command || undefined,
          args: args.length > 0 ? args : undefined,
          displayName: draft.displayName.trim() || undefined,
          env: envKeys.length > 0 ? Object.fromEntries(envKeys.map((key) => [key, ""])) : undefined
        };
      }
      await props.onSaveOverrides(nextOverrides);
      props.onClose();
    } finally {
      setBusy(false);
    }
  };

  const runTest = async (backendId: CliBackend["id"]) => {
    setBusy(true);
    try {
      const result = await props.onTestBackend(backendId);
      setTestByBackend((prev) => ({ ...prev, [backendId]: result }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="command-overlay" role="dialog" aria-modal="true" aria-label="Backend settings">
      <div className="command-bar backend-settings-modal">
        <div className="command-header">
          <strong>Backend Settings</strong>
          <button type="button" onClick={props.onClose}>Close</button>
        </div>
        <div className="backend-settings-list">
          {editableBackends.map((backend) => {
            const draft = drafts[backend.id];
            if (!draft) {
              return null;
            }
            const testResult = testByBackend[backend.id];
            return (
              <div key={backend.id} className="inspector-block">
                <div className="inspector-title">
                  {backend.displayName} <span className="muted">({backend.id})</span>
                </div>
                <div className="item-subtitle">
                  {backend.available ? "Available" : "Unavailable"}
                  {backend.version ? ` · ${backend.version}` : ""}
                </div>
                <div className="inspector-field">
                  <label>Command</label>
                  <input
                    value={draft.command}
                    onChange={(event) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [backend.id]: {
                          ...draft,
                          command: event.target.value
                        }
                      }))
                    }
                    placeholder={backend.command}
                  />
                </div>
                <div className="inspector-field">
                  <label>Args</label>
                  <input
                    value={draft.argsText}
                    onChange={(event) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [backend.id]: {
                          ...draft,
                          argsText: event.target.value
                        }
                      }))
                    }
                    placeholder={backend.args.join(" ")}
                  />
                </div>
                <div className="inspector-field">
                  <label>Env keys (names only)</label>
                  <input
                    value={draft.envKeysText}
                    onChange={(event) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [backend.id]: {
                          ...draft,
                          envKeysText: event.target.value
                        }
                      }))
                    }
                    placeholder="OPENAI_API_KEY, ANTHROPIC_API_KEY"
                  />
                </div>
                <div className="import-actions">
                  <button onClick={() => void props.onSetDefaultBackend(backend.id)} disabled={busy}>
                    {props.defaultBackendId === backend.id ? "Workspace default" : "Set as workspace default"}
                  </button>
                  <button onClick={() => void runTest(backend.id)} disabled={busy}>Test</button>
                </div>
                {testResult && (
                  <div className={`validation-item ${testResult.ok ? "" : "error"}`}>
                    {testResult.ok ? "OK" : "Failed"} · {Math.round(testResult.durationMs / 10) / 100}s
                    {testResult.model ? ` · ${testResult.model}` : ""}
                    {testResult.message ? ` · ${testResult.message}` : ""}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="import-actions">
          <button onClick={() => void save()} disabled={busy}>Save overrides</button>
        </div>
      </div>
    </div>
  );
}

function splitCsv(text: string): string[] {
  return text
    .split(/[,\n]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitArgs(text: string): string[] {
  return text
    .split(/\s+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}
