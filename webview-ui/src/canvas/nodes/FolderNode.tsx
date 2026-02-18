import type { NodeProps } from "reactflow";
import NodeTypeIcon from "./NodeTypeIcon";

type FolderNodeData = {
  title: string;
  path: string;
  onReveal: (path: string) => void;
};

export default function FolderNode({ data, selected }: NodeProps<FolderNodeData>) {
  return (
    <div
      className={`node-card node-folder ${selected ? "is-selected" : ""}`}
      tabIndex={0}
      role="button"
      aria-label={`Folder: ${data.title}`}
      onKeyDown={(event) => {
        if (event.currentTarget !== event.target) {
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          data.onReveal(data.path);
        }
      }}
    >
      <div className="node-header with-actions">
        <span className="node-header-label">
          <NodeTypeIcon kind="folder" />
          Folder
        </span>
        <span className="hover-actions">
          <button onClick={() => data.onReveal(data.path)} title="Reveal in Explorer">
            Reveal
          </button>
        </span>
      </div>
      <div className="node-title">{data.title}</div>
      <div className="node-path">{data.path}</div>
    </div>
  );
}
