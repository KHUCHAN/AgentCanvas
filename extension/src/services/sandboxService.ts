import { copyFile, mkdir, realpath, rm, stat } from "node:fs/promises";
import { execFile as execFileCb } from "node:child_process";
import { dirname, isAbsolute, join, posix, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { sanitizeFileName } from "./pathUtils";

const execFile = promisify(execFileCb);

export const SANDBOX_BLOCKED_TOP_LEVEL_DIRS = new Set<string>([
  ".agentcanvas",
  ".git",
  "node_modules",
  "dist"
]);

export type SandboxIdentity = {
  workspaceRoot: string;
  runId: string;
  agentId: string;
};

export type SandboxPaths = {
  rootDir: string;
  inputDir: string;
  workDir: string;
  proposalDir: string;
  proposalJsonPath: string;
  patchPath: string;
  summaryPath: string;
  testLogPath: string;
};

export type PrepareSandboxResult = SandboxPaths & {
  copiedFiles: string[];
  gitHead?: string;
};

export function getSandboxPaths(input: SandboxIdentity): SandboxPaths {
  const runPart = sanitizeFileName(input.runId || "run");
  const agentPart = sanitizeFileName(input.agentId || "agent");
  const rootDir = join(input.workspaceRoot, ".agentcanvas", "sandboxes", runPart, agentPart);
  const inputDir = join(rootDir, "input");
  const workDir = join(rootDir, "work");
  const proposalDir = join(rootDir, "proposal");
  return {
    rootDir,
    inputDir,
    workDir,
    proposalDir,
    proposalJsonPath: join(proposalDir, "proposal.json"),
    patchPath: join(proposalDir, "changes.patch"),
    summaryPath: join(proposalDir, "summary.md"),
    testLogPath: join(proposalDir, "test.log")
  };
}

export function normalizeSandboxRelativePath(rawPath: string): string {
  const trimmed = rawPath.trim().replace(/\\/g, "/");
  if (!trimmed) {
    throw new Error("Sandbox file path is empty");
  }
  if (isAbsolute(trimmed)) {
    throw new Error(`Absolute path is not allowed in sandbox: ${trimmed}`);
  }
  const normalized = posix.normalize(trimmed);
  if (normalized === "." || normalized === "..") {
    throw new Error(`Invalid sandbox path: ${rawPath}`);
  }
  if (normalized.startsWith("../") || normalized.includes("/../")) {
    throw new Error(`Path traversal is not allowed in sandbox: ${rawPath}`);
  }
  if (normalized.startsWith("/")) {
    throw new Error(`Absolute-like path is not allowed in sandbox: ${rawPath}`);
  }
  const first = normalized.split("/")[0];
  if (SANDBOX_BLOCKED_TOP_LEVEL_DIRS.has(first)) {
    throw new Error(`Path is blocked by sandbox policy: ${rawPath}`);
  }
  return normalized;
}

export async function prepareSandbox(input: SandboxIdentity & { files: string[] }): Promise<PrepareSandboxResult> {
  const paths = getSandboxPaths(input);
  const copiedFiles = [...new Set(input.files.map((item) => normalizeSandboxRelativePath(item)))];

  await rm(paths.rootDir, { recursive: true, force: true });
  await mkdir(paths.inputDir, { recursive: true });
  await mkdir(paths.workDir, { recursive: true });
  await mkdir(paths.proposalDir, { recursive: true });

  for (const relativePath of copiedFiles) {
    const sourcePath = await resolveWorkspacePath(input.workspaceRoot, relativePath);
    const info = await stat(sourcePath).catch(() => undefined);
    if (!info) {
      throw new Error(`Sandbox source file does not exist: ${relativePath}`);
    }
    if (!info.isFile()) {
      throw new Error(`Sandbox source must be a file: ${relativePath}`);
    }

    const inputTarget = join(paths.inputDir, relativePath);
    const workTarget = join(paths.workDir, relativePath);
    await mkdir(dirname(inputTarget), { recursive: true });
    await mkdir(dirname(workTarget), { recursive: true });
    await copyFile(sourcePath, inputTarget);
    await copyFile(sourcePath, workTarget);
  }

  return {
    ...paths,
    copiedFiles,
    gitHead: await readGitHead(input.workspaceRoot)
  };
}

export async function readGitHead(workspaceRoot: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFile("git", ["rev-parse", "HEAD"], { cwd: workspaceRoot });
    const value = stdout.trim();
    return value || undefined;
  } catch {
    return undefined;
  }
}

async function resolveWorkspacePath(workspaceRoot: string, relativePath: string): Promise<string> {
  const root = resolve(workspaceRoot);
  const absolutePath = resolve(root, relativePath);
  if (absolutePath !== root && !absolutePath.startsWith(`${root}${sep}`)) {
    throw new Error(`Path escapes workspace root: ${relativePath}`);
  }

  const [realRoot, realAbsolutePath] = await Promise.all([
    realpath(root).catch(() => root),
    realpath(absolutePath).catch(() => absolutePath)
  ]);
  if (
    realAbsolutePath !== realRoot &&
    !realAbsolutePath.startsWith(`${realRoot}${sep}`)
  ) {
    throw new Error(`Path escapes workspace root through symlink: ${relativePath}`);
  }
  return realAbsolutePath;
}
