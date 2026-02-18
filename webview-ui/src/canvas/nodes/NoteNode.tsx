import { useEffect, useState } from "react";
import type { NodeProps } from "reactflow";
import NodeTypeIcon from "./NodeTypeIcon";

type NoteNodeData = {
  text: string;
  onSave: (noteId: string, text: string) => void;
  onRemove: (noteId: string) => void;
  onDuplicate: (text: string) => void;
};

export default function NoteNode({ id, data }: NodeProps<NoteNodeData>) {
  const [value, setValue] = useState(data.text);

  useEffect(() => {
    setValue(data.text);
  }, [data.text]);

  const save = () => {
    data.onSave(id, value);
  };

  return (
    <div
      className="node-card node-note"
      tabIndex={0}
      role="button"
      aria-label="Note"
    >
      <div className="node-header with-actions">
        <span className="node-header-label">
          <NodeTypeIcon kind="note" />
          Note
        </span>
        <span className="hover-actions">
          <button
            onClick={() => {
              data.onDuplicate(value);
            }}
            title="Duplicate note"
          >
            Copy
          </button>
          <button onClick={() => data.onRemove(id)} title="Remove note">
            Delete
          </button>
        </span>
      </div>

      <textarea
        className="node-note-editor"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            save();
          }
        }}
        rows={4}
      />

      <div className="node-meta">Cmd/Ctrl+Enter to save</div>
    </div>
  );
}
