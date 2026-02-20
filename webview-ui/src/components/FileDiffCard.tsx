import type { FileDiffEntry } from "../messaging/protocol";

type FileDiffCardProps = {
  files: FileDiffEntry[];
};

export default function FileDiffCard(props: FileDiffCardProps) {
  return (
    <div className="file-diff-card">
      <div className="inspector-title">File diff</div>
      {props.files.length === 0 && <div className="muted">No file changes reported.</div>}
      {props.files.map((file) => (
        <div key={file.path} className="file-diff-line">
          <span>{file.path}</span>
          <span className="file-diff-add">+{file.additions}</span>
          <span className="file-diff-del">-{file.deletions}</span>
        </div>
      ))}
    </div>
  );
}
