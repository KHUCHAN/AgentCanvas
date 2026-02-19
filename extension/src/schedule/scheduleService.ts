import { computeSchedule } from "./scheduler";
import type { Task, TaskEvent } from "./types";

type ScheduleSubscriber = (event: TaskEvent) => void;

type ScheduleServiceOptions = {
  defaultEstimateMs?: number;
};

export class ScheduleService {
  private readonly runs = new Map<string, Map<string, Task>>();
  private readonly subscribers = new Map<string, Set<ScheduleSubscriber>>();
  private readonly defaultEstimateMs: number;

  public constructor(options?: ScheduleServiceOptions) {
    this.defaultEstimateMs = options?.defaultEstimateMs ?? 120_000;
  }

  public createRun(runId: string, initialTasks: Task[]): void {
    const map = new Map<string, Task>();
    for (const task of initialTasks) {
      const normalized = withTaskDefaults(task);
      map.set(normalized.id, normalized);
    }
    this.runs.set(runId, map);
    this.recompute(runId);
    this.emit(this.getSnapshotEvent(runId));
  }

  public listRunIds(): string[] {
    return [...this.runs.keys()].sort((left, right) => left.localeCompare(right));
  }

  public hasRun(runId: string): boolean {
    return this.runs.has(runId);
  }

  public getTasks(runId: string): Task[] {
    const run = this.runs.get(runId);
    if (!run) {
      return [];
    }
    return [...run.values()].map((task) => ({ ...task }));
  }

  public getSnapshotEvent(runId: string): TaskEvent {
    return {
      type: "snapshot",
      runId,
      tasks: this.getTasks(runId),
      nowMs: Date.now()
    };
  }

  public subscribe(runId: string, callback: ScheduleSubscriber): () => void {
    const set = this.subscribers.get(runId) ?? new Set<ScheduleSubscriber>();
    set.add(callback);
    this.subscribers.set(runId, set);

    callback(this.getSnapshotEvent(runId));

    return () => {
      this.unsubscribe(runId, callback);
    };
  }

  public unsubscribe(runId: string, callback: ScheduleSubscriber): void {
    const set = this.subscribers.get(runId);
    if (!set) {
      return;
    }
    set.delete(callback);
    if (set.size === 0) {
      this.subscribers.delete(runId);
    }
  }

  public upsertTask(runId: string, task: Task): void {
    const run = this.ensureRun(runId);
    const now = Date.now();
    const nextTask = withTaskDefaults({
      ...task,
      updatedAtMs: now
    });
    const prev = run.get(nextTask.id);
    run.set(nextTask.id, nextTask);

    if (!prev) {
      this.emit({ type: "task_created", runId, task: { ...nextTask }, nowMs: now });
    } else {
      this.emit({
        type: "task_updated",
        runId,
        taskId: nextTask.id,
        patch: buildPatch(prev, nextTask),
        nowMs: now
      });
    }
  }

  public patchTask(runId: string, taskId: string, patch: Partial<Task>): Task {
    const run = this.ensureRun(runId);
    const current = run.get(taskId);
    if (!current) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const now = Date.now();
    const next: Task = withTaskDefaults({
      ...current,
      ...patch,
      overrides: patch.overrides
        ? {
            ...(current.overrides ?? {}),
            ...patch.overrides
          }
        : current.overrides,
      meta: patch.meta
        ? {
            ...(current.meta ?? {}),
            ...patch.meta
          }
        : current.meta,
      updatedAtMs: now
    });
    run.set(taskId, next);
    this.emit({
      type: "task_updated",
      runId,
      taskId,
      patch: buildPatch(current, next),
      nowMs: now
    });
    return next;
  }

  public deleteTask(runId: string, taskId: string): void {
    const run = this.ensureRun(runId);
    if (!run.delete(taskId)) {
      return;
    }
    this.emit({
      type: "task_deleted",
      runId,
      taskId,
      nowMs: Date.now()
    });
  }

  public recompute(runId: string): string[] {
    const run = this.ensureRun(runId);
    const before = new Map<string, Task>();
    for (const [taskId, task] of run) {
      before.set(taskId, { ...task, overrides: task.overrides ? { ...task.overrides } : undefined });
    }

    const { updatedIds } = computeSchedule({
      tasks: run,
      defaultEstimateMs: this.defaultEstimateMs
    });

    if (updatedIds.length > 0) {
      for (const taskId of updatedIds) {
        const prev = before.get(taskId);
        const next = run.get(taskId);
        if (!prev || !next) {
          continue;
        }
        this.emit({
          type: "task_updated",
          runId,
          taskId,
          patch: buildPatch(prev, next),
          nowMs: Date.now()
        });
      }
      this.emit({
        type: "schedule_recomputed",
        runId,
        affectedTaskIds: updatedIds,
        nowMs: Date.now()
      });
    }

    return updatedIds;
  }

  private ensureRun(runId: string): Map<string, Task> {
    const run = this.runs.get(runId);
    if (run) {
      return run;
    }
    const next = new Map<string, Task>();
    this.runs.set(runId, next);
    return next;
  }

  private emit(event: TaskEvent): void {
    const callbacks = this.subscribers.get(event.runId);
    if (!callbacks || callbacks.size === 0) {
      return;
    }
    for (const callback of callbacks) {
      callback(event);
    }
  }
}

function withTaskDefaults(task: Task): Task {
  const now = Date.now();
  return {
    ...task,
    deps: [...new Set(task.deps ?? [])],
    status: task.status ?? "planned",
    createdAtMs: task.createdAtMs ?? now,
    updatedAtMs: task.updatedAtMs ?? now
  };
}

function buildPatch(previous: Task, next: Task): Partial<Task> {
  const patch: Partial<Task> = {};
  const keys: Array<keyof Task> = [
    "title",
    "agentId",
    "deps",
    "estimateMs",
    "plannedStartMs",
    "plannedEndMs",
    "actualStartMs",
    "actualEndMs",
    "progress",
    "status",
    "blocker",
    "overrides",
    "meta",
    "updatedAtMs"
  ];
  for (const key of keys) {
    if (!isEqual(previous[key], next[key])) {
      patch[key] = next[key] as never;
    }
  }
  return patch;
}

function isEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
