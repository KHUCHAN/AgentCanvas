import ChatInput from "./ChatInput";
import ChatMessageList from "./ChatMessageList";
import type {
  ChatMessage,
  ChatMode,
  CliBackend,
  WorkPlanModification
} from "../messaging/protocol";

type ChatPanelProps = {
  hasTeam: boolean;
  messages: ChatMessage[];
  mode: ChatMode;
  backendId: Exclude<CliBackend["id"], "auto">;
  modelId?: string;
  backends: CliBackend[];
  sending?: boolean;
  onModeChange: (mode: ChatMode) => void;
  onBackendChange: (backendId: Exclude<CliBackend["id"], "auto">) => void;
  onModelChange: (modelId: string) => void;
  onSend: (content: string) => Promise<void>;
  onConfirmPlan: (planId: string) => Promise<void>;
  onModifyPlan: (planId: string, modifications: WorkPlanModification[]) => Promise<void>;
  onCancelPlan: (planId: string) => Promise<void>;
  onStopTask: (taskId: string) => Promise<void>;
  onOpenBuildPrompt: () => void;
};

export default function ChatPanel(props: ChatPanelProps) {
  return (
    <div className="chat-panel">
      {props.messages.length === 0 && (
        <div className="chat-empty">
          {props.hasTeam
            ? "Ask the orchestrator to plan or execute work."
            : "No team is configured yet. Build a team first or start chatting to draft a plan."}
          {!props.hasTeam && (
            <div className="work-plan-actions">
              <button type="button" onClick={props.onOpenBuildPrompt}>
                Build team
              </button>
            </div>
          )}
        </div>
      )}

      <ChatMessageList
        messages={props.messages}
        onConfirmPlan={props.onConfirmPlan}
        onModifyPlan={props.onModifyPlan}
        onCancelPlan={props.onCancelPlan}
        onStopTask={props.onStopTask}
      />

      <ChatInput
        mode={props.mode}
        backendId={props.backendId}
        modelId={props.modelId}
        backends={props.backends}
        disabled={props.sending}
        onModeChange={props.onModeChange}
        onBackendChange={props.onBackendChange}
        onModelChange={props.onModelChange}
        onSend={props.onSend}
      />
    </div>
  );
}
