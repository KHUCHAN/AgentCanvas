import { useState } from "react";
import type {
  BackendModelCatalog,
  ChatMode,
  CliBackend
} from "../messaging/protocol";
import { getModelOptionsForBackend } from "../utils/modelOptions";

type ChatInputProps = {
  mode: ChatMode;
  backendId: Exclude<CliBackend["id"], "auto">;
  modelId?: string;
  backends: CliBackend[];
  modelCatalogs?: BackendModelCatalog[];
  disabled?: boolean;
  backendLocked?: boolean;
  backendLockReason?: string;
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
  const modelOptions = getModelOptionsForBackend(props.backendId, props.modelCatalogs);
  const selectedModelId = props.modelId ?? "";

  return (
    <div className="chat-input-area">
      <textarea
        className="chat-input-textarea"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="❯ Message the orchestrator..."
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
          disabled={props.disabled || props.backendLocked}
        >
          {backendOptions.map((backend) => (
            <option key={backend.id} value={backend.id}>
              {backend.displayName}
            </option>
          ))}
        </select>
        <select
          className="chat-model-select"
          value={selectedModelId}
          onChange={(event) => props.onModelChange(event.target.value)}
          disabled={props.disabled}
        >
          <option value="">Backend default</option>
          {selectedModelId &&
            !modelOptions.some((option) => option.id === selectedModelId) && (
              <option value={selectedModelId}>{selectedModelId} (custom)</option>
            )}
          {modelOptions.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
        <button type="button" className="chat-send-button" onClick={() => void send()} disabled={props.disabled}>
          Send
        </button>
      </div>
      {props.backendLocked && (
        <div className="chat-input-lock-hint">
          {props.backendLockReason || "Backend is locked to orchestrator runtime."}
        </div>
      )}
    </div>
  );
}
