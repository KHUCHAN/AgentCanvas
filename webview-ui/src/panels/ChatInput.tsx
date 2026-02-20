import { useState } from "react";
import type { ChatMode, CliBackend } from "../messaging/protocol";

type ChatInputProps = {
  mode: ChatMode;
  backendId: Exclude<CliBackend["id"], "auto">;
  modelId?: string;
  backends: CliBackend[];
  disabled?: boolean;
  onModeChange: (mode: ChatMode) => void;
  onBackendChange: (backendId: Exclude<CliBackend["id"], "auto">) => void;
  onModelChange: (modelId: string) => void;
  onSend: (content: string) => Promise<void>;
};

export default function ChatInput(props: ChatInputProps) {
  const [value, setValue] = useState("");

  const send = async () => {
    const content = value.trim();
    if (!content || props.disabled) {
      return;
    }
    setValue("");
    await props.onSend(content);
  };

  const backendOptions = props.backends.filter((backend) => backend.id !== "auto" && backend.available);

  return (
    <div className="chat-input-area">
      <textarea
        className="chat-input-textarea"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Message the orchestrator..."
        rows={3}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void send();
          }
        }}
      />
      <div className="chat-input-toolbar">
        <select
          className="chat-mode-select"
          value={props.mode}
          onChange={(event) => props.onModeChange(event.target.value as ChatMode)}
          disabled={props.disabled}
        >
          <option value="planning">Planning</option>
          <option value="direct">Direct</option>
          <option value="review">Review</option>
        </select>
        <select
          className="chat-backend-select"
          value={props.backendId}
          onChange={(event) => props.onBackendChange(event.target.value as Exclude<CliBackend["id"], "auto">)}
          disabled={props.disabled}
        >
          {backendOptions.map((backend) => (
            <option key={backend.id} value={backend.id}>
              {backend.displayName}
            </option>
          ))}
        </select>
        <input
          value={props.modelId ?? ""}
          onChange={(event) => props.onModelChange(event.target.value)}
          placeholder="model (optional)"
          disabled={props.disabled}
        />
        <button type="button" className="chat-send-button" onClick={() => void send()} disabled={props.disabled}>
          Send
        </button>
      </div>
    </div>
  );
}
