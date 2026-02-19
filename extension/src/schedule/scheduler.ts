import type { Task } from "./types";

export type ComputeScheduleInput = {
  tasks: Map<string, Task>;
  defaultEstimateMs: number;
};

export type ComputeScheduleResult = {
  updatedIds: string[];
  blockedIds: string[];
};

export function computeSchedule(input: ComputeScheduleInput): ComputeScheduleResult {
  const { tasks, defaultEstimateMs } = input;
  const indeg = new Map<string, number>();
  const next = new Map<string, string[]>();

  for (const [id] of tasks) {
    indeg.set(id, 0);
    next.set(id, []);
  }

  for (const [id, task] of tasks) {
    for (const dep of task.deps) {
      if (!tasks.has(dep)) {
        continue;
      }
      indeg.set(id, (indeg.get(id) ?? 0) + 1);
      next.get(dep)?.push(id);
    }
  }

  const queue: string[] = [];
  for (const [id, degree] of indeg) {
    if (degree === 0) {
      queue.push(id);
    }
  }

  const updatedIds: string[] = [];
  const blockedIds: string[] = [];
  const processed = new Set<string>();
  const agentAvail = new Map<string, number>();

  const depsEnd = (task: Task): number => {
    let maxEnd = 0;
    for (const depId of task.deps) {
      const depTask = tasks.get(depId);
      if (!depTask) {
        continue;
      }
      maxEnd = Math.max(maxEnd, depTask.plannedEndMs ?? depTask.actualEndMs ?? 0);
    }
    return maxEnd;
  };

  while (queue.length > 0) {
    queue.sort((left, right) => compareTasks(tasks.get(left), tasks.get(right)));
    const id = queue.shift();
    if (!id) {
      break;
    }
    const task = tasks.get(id);
    if (!task) {
      continue;
    }
    processed.add(id);

    const laneAgentId = task.overrides?.forceAgentId ?? task.agentId;
    const depReadyAt = depsEnd(task);
    const laneReadyAt = agentAvail.get(laneAgentId) ?? 0;
    const earliest = Math.max(depReadyAt, laneReadyAt);
    const plannedStart =
      task.overrides?.forceStartMs !== undefined
        ? Math.max(task.overrides.forceStartMs, depReadyAt)
        : earliest;
    const estimate = normalizeEstimate(task.estimateMs, defaultEstimateMs);
    const plannedEnd = plannedStart + estimate;

    if (
      task.plannedStartMs !== plannedStart ||
      task.plannedEndMs !== plannedEnd ||
      task.agentId !== laneAgentId
    ) {
      task.plannedStartMs = plannedStart;
      task.plannedEndMs = plannedEnd;
      task.agentId = laneAgentId;
      task.updatedAtMs = Date.now();
      updatedIds.push(task.id);
    }

    if (
      task.status === "planned" &&
      task.actualStartMs === undefined &&
      task.actualEndMs === undefined
    ) {
      task.status = "ready";
      task.updatedAtMs = Date.now();
      if (!updatedIds.includes(task.id)) {
        updatedIds.push(task.id);
      }
    }

    agentAvail.set(laneAgentId, plannedEnd);

    for (const nextId of next.get(id) ?? []) {
      const current = (indeg.get(nextId) ?? 1) - 1;
      indeg.set(nextId, current);
      if (current === 0) {
        queue.push(nextId);
      }
    }
  }

  if (processed.size !== tasks.size) {
    for (const [taskId, task] of tasks) {
      if (processed.has(taskId)) {
        continue;
      }
      const shouldBlock =
        task.status !== "running" &&
        task.status !== "done" &&
        task.status !== "failed" &&
        task.status !== "canceled";
      if (!shouldBlock) {
        continue;
      }
      task.status = "blocked";
      task.blocker = {
        kind: "external",
        message: "Dependency cycle or unresolved dependency"
      };
      task.updatedAtMs = Date.now();
      blockedIds.push(taskId);
      if (!updatedIds.includes(taskId)) {
        updatedIds.push(taskId);
      }
    }
  }

  return { updatedIds, blockedIds };
}

function compareTasks(left: Task | undefined, right: Task | undefined): number {
  if (!left || !right) {
    return 0;
  }

  const leftPriority = left.overrides?.priority ?? 0;
  const rightPriority = right.overrides?.priority ?? 0;
  if (leftPriority !== rightPriority) {
    return rightPriority - leftPriority;
  }

  const leftPinned = left.overrides?.pinned ? 1 : 0;
  const rightPinned = right.overrides?.pinned ? 1 : 0;
  if (leftPinned !== rightPinned) {
    return rightPinned - leftPinned;
  }

  if (left.createdAtMs !== right.createdAtMs) {
    return left.createdAtMs - right.createdAtMs;
  }
  return left.id.localeCompare(right.id);
}

function normalizeEstimate(estimateMs: number | undefined, defaultEstimateMs: number): number {
  if (typeof estimateMs === "number" && Number.isFinite(estimateMs) && estimateMs > 0) {
    return estimateMs;
  }
  return defaultEstimateMs;
}
