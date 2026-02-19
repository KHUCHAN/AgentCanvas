import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PinnedOutput } from "../types";
import { sanitizeFlowName } from "./flowStore";
import { sanitizeFileName } from "./pathUtils";

const DEFAULT_PIN_TTL_MS = 1000 * 60 * 60 * 24 * 30;

function pinDir(workspaceRoot: string, flowName: string): string {
  return join(workspaceRoot, ".agentcanvas", "pins", sanitizeFlowName(flowName));
}

function pinFilePath(workspaceRoot: string, flowName: string, nodeId: string): string {
  return join(pinDir(workspaceRoot, flowName), `${sanitizeFileName(nodeId)}.json`);
}

export async function getPin(input: {
  workspaceRoot: string;
  flowName: string;
  nodeId: string;
}): Promise<PinnedOutput | undefined> {
  const path = pinFilePath(input.workspaceRoot, input.flowName, input.nodeId);
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as PinnedOutput;
    if (!parsed || typeof parsed.nodeId !== "string") {
      return undefined;
    }
    if (isExpired(parsed)) {
      await rm(path, { force: true });
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

export async function setPin(input: {
  workspaceRoot: string;
  flowName: string;
  nodeId: string;
  output: unknown;
}): Promise<PinnedOutput> {
  const dir = pinDir(input.workspaceRoot, input.flowName);
  await mkdir(dir, { recursive: true });
  const pin: PinnedOutput = {
    flowName: sanitizeFlowName(input.flowName),
    nodeId: input.nodeId,
    output: input.output,
    pinnedAt: Date.now(),
    expiresAt: Date.now() + resolvePinTtlMs()
  };
  const path = pinFilePath(input.workspaceRoot, input.flowName, input.nodeId);
  await writeFile(path, `${JSON.stringify(pin, null, 2)}\n`, "utf8");
  return pin;
}

export async function clearPin(input: {
  workspaceRoot: string;
  flowName: string;
  nodeId: string;
}): Promise<void> {
  const path = pinFilePath(input.workspaceRoot, input.flowName, input.nodeId);
  await rm(path, { force: true });
}

export async function listPins(input: {
  workspaceRoot: string;
  flowName: string;
}): Promise<PinnedOutput[]> {
  const dir = pinDir(input.workspaceRoot, input.flowName);
  let entries: string[] = [];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const pins: PinnedOutput[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json")) {
      continue;
    }
    try {
      const raw = await readFile(join(dir, entry), "utf8");
      const parsed = JSON.parse(raw) as PinnedOutput;
      if (parsed && typeof parsed.nodeId === "string" && !isExpired(parsed)) {
        pins.push(parsed);
      } else if (parsed && isExpired(parsed)) {
        await rm(join(dir, entry), { force: true }).catch(() => undefined);
      }
    } catch {
      continue;
    }
  }
  return pins.sort((left, right) => right.pinnedAt - left.pinnedAt);
}

function resolvePinTtlMs(): number {
  const configured = Number(process.env.AGENTCANVAS_PIN_TTL_MS);
  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_PIN_TTL_MS;
  }
  return Math.max(60_000, Math.floor(configured));
}

function isExpired(pin: PinnedOutput): boolean {
  const expiresAt = typeof pin.expiresAt === "number" ? pin.expiresAt : pin.pinnedAt + resolvePinTtlMs();
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
}
