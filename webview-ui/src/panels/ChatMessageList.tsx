import { useEffect, useRef } from "react";
import FileDiffCard from "../components/FileDiffCard";
import NodeContextCard from "../components/NodeContextCard";
import TaskCompleteCard from "../components/TaskCompleteCard";
import TaskStatusCard from "../components/TaskStatusCard";
import WorkPlanCard from "../components/WorkPlanCard";
import type {
  ChatMessage,
  WorkPlanModification
} from "../messaging/protocol";

type ChatMessageListProps = {
  messages: ChatMessage[];
  onConfirmPlan: (planId: string) => Promise<void>;
  onModifyPlan: (planId: string, modifications: WorkPlanModification[]) => Promise<void>;
  onCancelPlan: (planId: string) => Promise<void>;
  onStopTask: (taskId: string) => Promise<void>;
};

export default function ChatMessageList(props: ChatMessageListProps) {
  const tailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    tailRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [props.messages.length]);

  return (
    <div className="chat-messages">
      {props.messages.map((message) => (
        <div key={message.id} className={`chat-message ${message.role}`}>
          <div className="chat-message-role">{message.role}</div>
          <div className="chat-message-body">
            {message.content.map((content, index) => {
              const key = `${message.id}:${index}:${content.kind}`;
              if (content.kind === "text") {
                return <div key={key} className="chat-text">{content.text}</div>;
              }
              if (content.kind === "work_plan") {
                return (
                  <WorkPlanCard
                    key={key}
                    plan={content.plan}
                    onConfirm={props.onConfirmPlan}
                    onModify={props.onModifyPlan}
                    onCancel={props.onCancelPlan}
                  />
                );
              }
              if (content.kind === "task_status") {
                return (
                  <TaskStatusCard
                    key={key}
                    update={content.status}
                    onStopTask={props.onStopTask}
                  />
                );
              }
              if (content.kind === "task_complete") {
                return <TaskCompleteCard key={key} summary={content.summary} />;
              }
              if (content.kind === "node_context") {
                return (
                  <NodeContextCard
                    key={key}
                    nodeId={content.nodeId}
                    nodeType={content.nodeType}
                    data={content.data}
                  />
                );
              }
              if (content.kind === "file_diff") {
                return <FileDiffCard key={key} files={content.files} />;
              }
              if (content.kind === "error") {
                return (
                  <div key={key} className="validation-item error">
                    {content.message}
                  </div>
                );
              }
              if (content.kind === "cost_alert") {
                return (
                  <div key={key} className="validation-item warning">
                    Cost alert for {content.backendId}: ${content.usage.today.estimatedCost.toFixed(2)} today
                  </div>
                );
              }
              if (content.kind === "approval_request") {
                return (
                  <div key={key} className="validation-item warning">
                    {content.description} ({content.options.join(" / ")})
                  </div>
                );
              }
              if (content.kind === "run_event") {
                return (
                  <div key={key} className="node-meta">
                    run event: {content.event.type}
                  </div>
                );
              }
              return null;
            })}
          </div>
        </div>
      ))}
      <div ref={tailRef} />
    </div>
  );
}
