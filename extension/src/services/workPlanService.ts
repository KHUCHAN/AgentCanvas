import type { WorkPlan, WorkPlanModification } from "../types";

export class WorkPlanService {
  private readonly plansByWorkspace = new Map<string, Map<string, WorkPlan>>();

  public create(workspaceRoot: string, plan: WorkPlan): WorkPlan {
    const map = this.ensureWorkspaceMap(workspaceRoot);
    map.set(plan.id, clonePlan(plan));
    return clonePlan(plan);
  }

  public get(workspaceRoot: string, planId: string): WorkPlan | undefined {
    const map = this.plansByWorkspace.get(workspaceRoot);
    const plan = map?.get(planId);
    if (!plan) {
      return undefined;
    }
    return clonePlan(plan);
  }

  public list(workspaceRoot: string): WorkPlan[] {
    const map = this.plansByWorkspace.get(workspaceRoot);
    if (!map) {
      return [];
    }
    return [...map.values()].map((plan) => clonePlan(plan));
  }

  public setStatus(
    workspaceRoot: string,
    planId: string,
    status: WorkPlan["status"]
  ): WorkPlan {
    const map = this.ensureWorkspaceMap(workspaceRoot);
    const current = map.get(planId);
    if (!current) {
      throw new Error(`Work plan not found: ${planId}`);
    }
    const next: WorkPlan = {
      ...current,
      status
    };
    map.set(planId, next);
    return clonePlan(next);
  }

  public applyModifications(
    workspaceRoot: string,
    planId: string,
    modifications: WorkPlanModification[]
  ): WorkPlan {
    const map = this.ensureWorkspaceMap(workspaceRoot);
    const current = map.get(planId);
    if (!current) {
      throw new Error(`Work plan not found: ${planId}`);
    }

    const itemByIndex = new Map<number, WorkPlan["items"][number]>(
      current.items.map((item) => [item.index, { ...item }])
    );

    for (const modification of modifications) {
      const target = itemByIndex.get(modification.index);
      if (!target) {
        continue;
      }
      itemByIndex.set(modification.index, {
        ...target,
        title: modification.title ?? target.title,
        description: modification.description ?? target.description,
        priority: modification.priority ?? target.priority,
        assignedAgentId: modification.assignedAgentId ?? target.assignedAgentId,
        assignedBackend: modification.assignedBackend ?? target.assignedBackend,
        deps: modification.deps ? [...new Set(modification.deps)] : target.deps
      });
    }

    const next: WorkPlan = {
      ...current,
      items: current.items.map((item) => itemByIndex.get(item.index) ?? item)
    };
    map.set(planId, next);
    return clonePlan(next);
  }

  public remove(workspaceRoot: string, planId: string): boolean {
    const map = this.plansByWorkspace.get(workspaceRoot);
    if (!map) {
      return false;
    }
    return map.delete(planId);
  }

  private ensureWorkspaceMap(workspaceRoot: string): Map<string, WorkPlan> {
    const existing = this.plansByWorkspace.get(workspaceRoot);
    if (existing) {
      return existing;
    }
    const created = new Map<string, WorkPlan>();
    this.plansByWorkspace.set(workspaceRoot, created);
    return created;
  }
}

function clonePlan(plan: WorkPlan): WorkPlan {
  return {
    ...plan,
    items: plan.items.map((item) => ({
      ...item,
      deps: [...item.deps]
    }))
  };
}
