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

  const updatedSet = new Set<string>();
  const blockedSet = new Set<string>();
  const processed = new Set<string>();
  const agentAvail = new Map<string, number>();
  const now = Date.now();
  const isTerminalStatus = (status: Task["status"]): boolean =>
    status === "running" || status === "done" || status === "failed" || status === "canceled";
  const markUpdated = (taskId: string): void => {
    updatedSet.add(taskId);
  };

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
      task.updatedAtMs = now;
      markUpdated(task.id);
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

  for (const [taskId, task] of tasks) {
    if (isTerminalStatus(task.status)) {
      continue;
    }
    const missingDeps = task.deps.filter((depId) => !tasks.has(depId));
    const unresolvedDeps = task.deps.filter((depId) => tasks.has(depId) && !processed.has(depId));
    if (missingDeps.length === 0 && unresolvedDeps.length === 0) {
      continue;
    }
    const blockerMessage =
      missingDeps.length > 0
        ? `Missing dependencies: ${missingDeps.join(", ")}`
        : "Dependency cycle detected";
    const blockerChanged =
      task.blocker?.kind !== "external" || task.blocker?.message !== blockerMessage;
    if (task.status !== "blocked" || blockerChanged) {
      task.status = "blocked";
      task.blocker = {
        kind: "external",
        message: blockerMessage
      };
      task.updatedAtMs = now;
      markUpdated(taskId);
    }
    blockedSet.add(taskId);
  }

  for (const taskId of processed) {
    const task = tasks.get(taskId);
    if (!task) {
      continue;
    }
    if (
      task.status === "planned" &&
      task.actualStartMs === undefined &&
      task.actualEndMs === undefined
    ) {
      task.status = "ready";
      task.blocker = undefined;
      task.updatedAtMs = now;
      markUpdated(task.id);
    }
  }

  if (processed.size !== tasks.size) {
    for (const [taskId, task] of tasks) {
      if (processed.has(taskId)) {
        continue;
      }
      if (isTerminalStatus(task.status)) {
        continue;
      }
      if (!blockedSet.has(taskId)) {
        task.status = "blocked";
        task.blocker = {
          kind: "external",
          message: "Dependency cycle or unresolved dependency"
        };
        task.updatedAtMs = now;
        markUpdated(taskId);
        blockedSet.add(taskId);
      }
    }
  }

  return { updatedIds: [...updatedSet], blockedIds: [...blockedSet] };
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
