import { randomUUID } from "node:crypto";
import { execFile as execFileCb } from "node:child_process";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import matter from "gray-matter";
import { z } from "zod";
import type {
  MemoryCommit,
  MemoryItem,
  MemoryItemType,
  MemoryNamespace
} from "../types";

const execFile = promisify(execFileCb);

const MEMORY_ROOT = join(".agentcanvas", "memory");
const INDEX_FILE = join(MEMORY_ROOT, "index.jsonl");
const COMMITS_FILE = join(MEMORY_ROOT, "commits.jsonl");
const memoryWriteQueue = new Map<string, Promise<unknown>>();

type IndexRow = {
  id: string;
  namespace: MemoryNamespace;
  type: MemoryItemType;
  title: string;
  importance: number;
  tags: string[];
  agentId?: string;
  createdAt: number;
  updatedAt: number;
  filePath: string;
  ttlMs?: number;
  supersededBy?: string;
};

const memoryItemTypeSchema = z.enum([
  "fact",
  "decision",
  "learning",
  "summary",
  "preference",
  "artifact"
]);

const memoryNamespaceSchema = z.custom<MemoryNamespace>((value) => {
  if (typeof value !== "string") {
    return false;
  }
  if (value === "system" || value === "shared") {
    return true;
  }
  return value.startsWith("agent/") || value.startsWith("flow/");
});

const indexRowSchema = z.object({
  id: z.string().min(1),
  namespace: memoryNamespaceSchema,
  type: memoryItemTypeSchema,
  title: z.string(),
  importance: z.number(),
  tags: z.array(z.string()),
  agentId: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  filePath: z.string().min(1),
  ttlMs: z.number().optional(),
  supersededBy: z.string().optional()
});

export async function ensureMemoryScaffold(workspaceRoot: string): Promise<void> {
  const systemDir = join(workspaceRoot, MEMORY_ROOT, "system");
  await mkdir(systemDir, { recursive: true });

  const projectPath = join(systemDir, "project.md");
  const conventionsPath = join(systemDir, "conventions.md");
  await ensureFile(projectPath, "# Project Context\n\nSummarize project goals, constraints, and boundaries.\n");
  await ensureFile(conventionsPath, "# Conventions\n\nCapture coding conventions and review rules.\n");
}

export async function addMemoryItem(input: {
  workspaceRoot: string;
  item: Omit<MemoryItem, "id" | "createdAt" | "updatedAt"> & { id?: string };
  author: string;
  message?: string;
}): Promise<MemoryItem> {
  await ensureMemoryScaffold(input.workspaceRoot);
  const now = Date.now();
  const item: MemoryItem = {
    ...input.item,
    id: input.item.id ?? `mem-${randomUUID()}`,
    createdAt: now,
    updatedAt: now
  };
  const filePath = resolveMemoryPath(input.workspaceRoot, item.namespace, item.type, item.id, item.title);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, serializeMemoryItem(item), "utf8");
  await appendIndexRow(input.workspaceRoot, toIndexRow(item, filePath));
  await appendMemoryCommit({
    workspaceRoot: input.workspaceRoot,
    author: input.author,
    message: input.message ?? `memory: ${item.type} - ${item.title}`,
    itemsAdded: [item.id],
    itemsUpdated: [],
    itemsSuperseded: []
  });
  return item;
}

export async function updateMemoryItem(input: {
  workspaceRoot: string;
  id: string;
  patch: Partial<MemoryItem>;
  author: string;
  message?: string;
}): Promise<MemoryItem | undefined> {
  const current = await getMemoryItem(input.workspaceRoot, input.id);
  if (!current) {
    return undefined;
  }
  const next: MemoryItem = {
    ...current,
    ...input.patch,
    id: current.id,
    createdAt: current.createdAt,
    updatedAt: Date.now()
  };
  const filePath = resolveMemoryPath(input.workspaceRoot, next.namespace, next.type, next.id, next.title);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, serializeMemoryItem(next), "utf8");
  await rewriteIndex(input.workspaceRoot, (rows) =>
    rows.map((row) => (row.id === next.id ? toIndexRow(next, filePath) : row))
  );
  await appendMemoryCommit({
    workspaceRoot: input.workspaceRoot,
    author: input.author,
    message: input.message ?? `memory: update - ${next.title}`,
    itemsAdded: [],
    itemsUpdated: [next.id],
    itemsSuperseded: []
  });
  return next;
}

export async function supersedeMemoryItem(input: {
  workspaceRoot: string;
  oldItemId: string;
  newItem: Omit<MemoryItem, "id" | "createdAt" | "updatedAt">;
  author: string;
  reason?: string;
}): Promise<{ oldItem?: MemoryItem; newItem: MemoryItem }> {
  const oldItem = await getMemoryItem(input.workspaceRoot, input.oldItemId);
  const created = await addMemoryItem({
    workspaceRoot: input.workspaceRoot,
    item: input.newItem,
    author: input.author,
    message: `memory: supersede - ${input.newItem.title}`
  });
  if (oldItem) {
    await updateMemoryItem({
      workspaceRoot: input.workspaceRoot,
      id: oldItem.id,
      patch: {
        supersededBy: created.id
      },
      author: input.author,
      message: input.reason ? `memory: supersede reason - ${input.reason}` : undefined
    });
  }
  await appendMemoryCommit({
    workspaceRoot: input.workspaceRoot,
    author: input.author,
    message: input.reason ? `memory: supersede - ${input.reason}` : "memory: supersede",
    itemsAdded: [created.id],
    itemsUpdated: [],
    itemsSuperseded: oldItem ? [oldItem.id] : []
  });
  return {
    oldItem,
    newItem: created
  };
}

export async function getMemoryItem(
  workspaceRoot: string,
  id: string
): Promise<MemoryItem | undefined> {
  const index = await readIndex(workspaceRoot);
  const row = index.find((entry) => entry.id === id);
  if (!row) {
    return undefined;
  }
  try {
    const raw = await readFile(join(workspaceRoot, row.filePath), "utf8");
    return deserializeMemoryItem(raw);
  } catch {
    return undefined;
  }
}

export async function listMemoryItems(input: {
  workspaceRoot: string;
  namespace?: MemoryNamespace;
  type?: MemoryItemType;
  tags?: string[];
  agentId?: string;
  since?: number;
  limit?: number;
}): Promise<MemoryItem[]> {
  const index = await readIndex(input.workspaceRoot);
  const filtered = index.filter((row) => {
    if (input.namespace && row.namespace !== input.namespace) {
      return false;
    }
    if (input.type && row.type !== input.type) {
      return false;
    }
    if (input.agentId && row.agentId !== input.agentId) {
      return false;
    }
    if (input.since && row.updatedAt < input.since) {
      return false;
    }
    if (input.tags && input.tags.length > 0) {
      const tagSet = new Set(row.tags);
      if (!input.tags.every((tag) => tagSet.has(tag))) {
        return false;
      }
    }
    return true;
  });
  const limited = filtered
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, input.limit ?? filtered.length);

  const items: MemoryItem[] = [];
  for (const row of limited) {
    try {
      const raw = await readFile(join(input.workspaceRoot, row.filePath), "utf8");
      const parsed = deserializeMemoryItem(raw);
      if (parsed) {
        items.push(parsed);
      }
    } catch {
      continue;
    }
  }
  return items;
}

export async function deleteExpiredMemoryItems(workspaceRoot: string): Promise<number> {
  const now = Date.now();
  let deletedCount = 0;
  await rewriteIndex(workspaceRoot, (rows) => {
    const live = rows.filter((row) => !(row.ttlMs && row.updatedAt + row.ttlMs <= now));
    deletedCount = rows.length - live.length;
    return live;
  });
  return deletedCount;
}

export async function listMemoryCommits(
  workspaceRoot: string,
  limit = 100
): Promise<MemoryCommit[]> {
  let raw = "";
  try {
    raw = await readFile(join(workspaceRoot, COMMITS_FILE), "utf8");
  } catch {
    return [];
  }
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as MemoryCommit;
      } catch {
        return undefined;
      }
    })
    .filter((entry): entry is MemoryCommit => Boolean(entry))
    .slice(-limit)
    .reverse();
}

export async function checkoutMemoryCommit(input: {
  workspaceRoot: string;
  commitId: string;
}): Promise<boolean> {
  try {
    await execFile("git", ["checkout", input.commitId, "--", ".agentcanvas/memory"], {
      cwd: input.workspaceRoot
    });
    return true;
  } catch {
    return false;
  }
}

function resolveMemoryPath(
  workspaceRoot: string,
  namespace: MemoryNamespace,
  type: MemoryItemType,
  id: string,
  title: string
): string {
  if (namespace === "system") {
    const fileName = sanitizeTitleForFile(title || id);
    return join(workspaceRoot, MEMORY_ROOT, "system", `${fileName}.md`);
  }
  if (namespace === "shared") {
    return join(workspaceRoot, MEMORY_ROOT, "shared", `${type}s`, `${id}.md`);
  }
  if (namespace.startsWith("agent/")) {
    return join(workspaceRoot, MEMORY_ROOT, "agents", namespace.slice("agent/".length), `${type}s`, `${id}.md`);
  }
  if (namespace.startsWith("flow/")) {
    return join(workspaceRoot, MEMORY_ROOT, "flows", namespace.slice("flow/".length), `${type}s`, `${id}.md`);
  }
  return join(workspaceRoot, MEMORY_ROOT, "shared", `${type}s`, `${id}.md`);
}

function serializeMemoryItem(item: MemoryItem): string {
  return matter.stringify(item.content.trim() || "", {
    id: item.id,
    namespace: item.namespace,
    type: item.type,
    title: item.title,
    importance: item.importance,
    tags: item.tags,
    source: item.source,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    ttlMs: item.ttlMs,
    supersededBy: item.supersededBy
  });
}

function deserializeMemoryItem(raw: string): MemoryItem {
  const parsed = matter(raw);
  const data = parsed.data as Record<string, unknown>;
  return {
    id: String(data.id ?? ""),
    namespace: String(data.namespace ?? "shared") as MemoryNamespace,
    type: String(data.type ?? "fact") as MemoryItemType,
    title: String(data.title ?? "Untitled"),
    content: parsed.content.trim(),
    source: (data.source as MemoryItem["source"]) ?? {},
    tags: Array.isArray(data.tags) ? data.tags.map((tag) => String(tag)) : [],
    importance: Number(data.importance ?? 0.5),
    createdAt: Number(data.createdAt ?? Date.now()),
    updatedAt: Number(data.updatedAt ?? Date.now()),
    ttlMs: typeof data.ttlMs === "number" ? data.ttlMs : undefined,
    supersededBy: typeof data.supersededBy === "string" ? data.supersededBy : undefined
  };
}

function toIndexRow(item: MemoryItem, filePath: string): IndexRow {
  return {
    id: item.id,
    namespace: item.namespace,
    type: item.type,
    title: item.title,
    importance: item.importance,
    tags: item.tags,
    agentId: item.source.agentId,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    filePath: filePath.replace(/\\/g, "/").replace(/.*\.agentcanvas\//, ".agentcanvas/"),
    ttlMs: item.ttlMs,
    supersededBy: item.supersededBy
  };
}

async function appendIndexRow(workspaceRoot: string, row: IndexRow): Promise<void> {
  await withMemoryWriteQueue(workspaceRoot, async () => {
    const path = join(workspaceRoot, INDEX_FILE);
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, `${JSON.stringify(row)}\n`, "utf8");
  });
}

async function readIndex(workspaceRoot: string): Promise<IndexRow[]> {
  let raw = "";
  try {
    raw = await readFile(join(workspaceRoot, INDEX_FILE), "utf8");
  } catch {
    return [];
  }
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        const parsed = JSON.parse(line) as unknown;
        const validated = indexRowSchema.safeParse(parsed);
        return validated.success ? validated.data : undefined;
      } catch {
        return undefined;
      }
    })
    .filter((row): row is IndexRow => Boolean(row));
}

async function writeIndexRows(workspaceRoot: string, rows: IndexRow[]): Promise<void> {
  await withMemoryWriteQueue(workspaceRoot, async () => {
    await writeIndexRowsUnsafe(workspaceRoot, rows);
  });
}

async function writeIndexRowsUnsafe(workspaceRoot: string, rows: IndexRow[]): Promise<void> {
  const path = join(workspaceRoot, INDEX_FILE);
  await mkdir(dirname(path), { recursive: true });
  const text = rows.map((row) => JSON.stringify(row)).join("\n");
  await writeFile(path, text.length > 0 ? `${text}\n` : "", "utf8");
}

async function rewriteIndex(
  workspaceRoot: string,
  updater: (rows: IndexRow[]) => IndexRow[]
): Promise<void> {
  await withMemoryWriteQueue(workspaceRoot, async () => {
    const rows = await readIndex(workspaceRoot);
    const updated = updater(rows);
    await writeIndexRowsUnsafe(workspaceRoot, updated);
  });
}

async function appendMemoryCommit(input: {
  workspaceRoot: string;
  author: string;
  message: string;
  itemsAdded: string[];
  itemsUpdated: string[];
  itemsSuperseded: string[];
}): Promise<MemoryCommit> {
  return await withMemoryWriteQueue(input.workspaceRoot, async () => {
    const parent = (await listMemoryCommits(input.workspaceRoot, 1))[0];
    const gitCommit = await tryGitCommit(input.workspaceRoot, input.message);
    const commit: MemoryCommit = {
      commitId: gitCommit ?? `memc-${randomUUID()}`,
      parentId: parent?.commitId,
      author: input.author,
      message: input.message,
      itemsAdded: input.itemsAdded,
      itemsUpdated: input.itemsUpdated,
      itemsSuperseded: input.itemsSuperseded,
      timestamp: Date.now()
    };
    const path = join(input.workspaceRoot, COMMITS_FILE);
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, `${JSON.stringify(commit)}\n`, "utf8");
    return commit;
  });
}

async function tryGitCommit(workspaceRoot: string, message: string): Promise<string | undefined> {
  try {
    await execFile("git", ["add", ".agentcanvas/memory"], { cwd: workspaceRoot });
    await execFile("git", ["commit", "-m", message], { cwd: workspaceRoot });
    const { stdout } = await execFile("git", ["rev-parse", "HEAD"], { cwd: workspaceRoot });
    const commitId = stdout.trim();
    return commitId || undefined;
  } catch {
    return undefined;
  }
}

async function ensureFile(path: string, content: string): Promise<void> {
  try {
    await readFile(path, "utf8");
  } catch {
    await writeFile(path, content, "utf8");
  }
}

function sanitizeTitleForFile(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "memory";
}

async function withMemoryWriteQueue<T>(
  workspaceRoot: string,
  operation: () => Promise<T>
): Promise<T> {
  const key = resolve(workspaceRoot);
  const previous = memoryWriteQueue.get(key) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(operation);
  const cleanup = run.finally(() => {
    if (memoryWriteQueue.get(key) === cleanup) {
      memoryWriteQueue.delete(key);
    }
  });
  memoryWriteQueue.set(key, cleanup);
  return await run;
}
