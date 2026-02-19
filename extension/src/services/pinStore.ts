import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PinnedOutput } from "../types";
import { sanitizeFlowName } from "./flowStore";

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
    pinnedAt: Date.now()
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
      if (parsed && typeof parsed.nodeId === "string") {
        pins.push(parsed);
      }
    } catch {
      continue;
    }
  }
  return pins.sort((left, right) => right.pinnedAt - left.pinnedAt);
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}
