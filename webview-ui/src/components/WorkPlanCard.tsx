import type { WorkPlan, WorkPlanModification } from "../messaging/protocol";

type WorkPlanCardProps = {
  plan: WorkPlan;
  onConfirm: (planId: string) => Promise<void>;
  onModify: (planId: string, modifications: WorkPlanModification[]) => Promise<void>;
  onCancel: (planId: string) => Promise<void>;
};

export default function WorkPlanCard(props: WorkPlanCardProps) {
  return (
    <div className="work-plan-card">
      <div className="inspector-title">Work Plan</div>
      <div className="node-meta">
        Status: {props.plan.status} · Items: {props.plan.items.length} · ETA: {props.plan.estimatedDuration ?? "-"} · Cost: {props.plan.estimatedCost ? `$${props.plan.estimatedCost.toFixed(2)}` : "-"}
      </div>
      <div className="work-plan-items">
        {props.plan.items.map((item) => (
          <div key={`${props.plan.id}:${item.index}`} className="work-plan-item">
            <div className="item-title">{item.index}. {item.title}</div>
            <div className="work-plan-item-agent">
              {item.assignedAgentName} · {item.assignedBackend}
            </div>
            <div className="work-plan-item-controls">
              <label>
                Priority
                <select
                  value={item.priority}
                  onChange={(event) =>
                    void props.onModify(props.plan.id, [
                      { index: item.index, priority: event.target.value as WorkPlanModification["priority"] }
                    ])
                  }
                >
                  <option value="high">high</option>
                  <option value="medium">medium</option>
                  <option value="low">low</option>
                </select>
              </label>
              <label>
                Backend
                <select
                  value={item.assignedBackend}
                  onChange={(event) =>
                    void props.onModify(props.plan.id, [
                      { index: item.index, assignedBackend: event.target.value as WorkPlanModification["assignedBackend"] }
                    ])
                  }
                >
                  <option value="claude">claude</option>
                  <option value="codex">codex</option>
                  <option value="gemini">gemini</option>
                  <option value="aider">aider</option>
                  <option value="custom">custom</option>
                </select>
              </label>
            </div>
          </div>
        ))}
      </div>
      <div className="work-plan-actions">
        <button type="button" onClick={() => void props.onCancel(props.plan.id)}>
          Cancel
        </button>
        <button type="button" onClick={() => void props.onConfirm(props.plan.id)}>
          Start
        </button>
      </div>
    </div>
  );
}
