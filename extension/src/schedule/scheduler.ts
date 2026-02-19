import type { Task } from "./types";

export type ComputeScheduleInput = {
  tasks: Map<string, Task>;
  defaultEstimateMs: number;
  agentConcurrency?: number | Record<string, number>;
};

export type ComputeScheduleResult = {
  updatedIds: string[];
  blockedIds: string[];
};

export function computeSchedule(input: ComputeScheduleInput): ComputeScheduleResult {
  const { tasks, defaultEstimateMs, agentConcurrency } = input;
  const cycleNodes = findCycleNodes(tasks);
  const cycleNodeSet = new Set(cycleNodes);
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
  const agentAvail = new Map<string, number[]>();
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
    const laneState = getLaneState(agentAvail, laneAgentId, resolveAgentConcurrency(agentConcurrency, laneAgentId));
    const laneIndex = pickEarliestLane(laneState);
    const laneReadyAt = laneState[laneIndex] ?? 0;
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

    laneState[laneIndex] = plannedEnd;
    agentAvail.set(laneAgentId, laneState);

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
        : cycleNodeSet.has(taskId)
          ? `Dependency cycle detected: ${cycleNodes.join(" -> ")}`
          : "Dependency graph unresolved";
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
          message: cycleNodeSet.has(taskId)
            ? `Dependency cycle detected: ${cycleNodes.join(" -> ")}`
            : "Dependency cycle or unresolved dependency"
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

function resolveAgentConcurrency(
  value: number | Record<string, number> | undefined,
  agentId: string
): number {
  if (typeof value === "number") {
    return normalizeConcurrency(value);
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const perAgent = value[agentId];
    if (typeof perAgent === "number") {
      return normalizeConcurrency(perAgent);
    }
  }
  return 1;
}

function normalizeConcurrency(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(1, Math.min(32, Math.floor(value)));
}

function getLaneState(
  agentAvail: Map<string, number[]>,
  agentId: string,
  concurrency: number
): number[] {
  const current = agentAvail.get(agentId);
  if (!current) {
    return new Array<number>(concurrency).fill(0);
  }
  if (current.length >= concurrency) {
    return current.slice(0, concurrency);
  }
  return [...current, ...new Array<number>(concurrency - current.length).fill(0)];
}

function pickEarliestLane(lanes: number[]): number {
  let selectedIndex = 0;
  let selectedValue = lanes[0] ?? 0;
  for (let index = 1; index < lanes.length; index += 1) {
    const candidate = lanes[index] ?? 0;
    if (candidate < selectedValue) {
      selectedValue = candidate;
      selectedIndex = index;
    }
  }
  return selectedIndex;
}

function findCycleNodes(tasks: Map<string, Task>): string[] {
  type VisitState = 0 | 1 | 2;
  const visitState = new Map<string, VisitState>();
  const stack: string[] = [];

  const visit = (taskId: string): string[] | undefined => {
    const state = visitState.get(taskId) ?? 0;
    if (state === 1) {
      const cycleStart = stack.indexOf(taskId);
      if (cycleStart >= 0) {
        return [...stack.slice(cycleStart), taskId];
      }
      return [taskId];
    }
    if (state === 2) {
      return undefined;
    }

    visitState.set(taskId, 1);
    stack.push(taskId);

    const task = tasks.get(taskId);
    if (task) {
      for (const depId of task.deps) {
        if (!tasks.has(depId)) {
          continue;
        }
        const cycle = visit(depId);
        if (cycle && cycle.length > 0) {
          return cycle;
        }
      }
    }

    stack.pop();
    visitState.set(taskId, 2);
    return undefined;
  };

  for (const [taskId] of tasks) {
    const cycle = visit(taskId);
    if (cycle && cycle.length > 0) {
      return normalizeCyclePath(cycle);
    }
  }

  return [];
}

function normalizeCyclePath(cycle: string[]): string[] {
  if (cycle.length === 0) {
    return [];
  }
  if (cycle[0] !== cycle[cycle.length - 1]) {
    return [...cycle, cycle[0]];
  }
  return cycle;
}
