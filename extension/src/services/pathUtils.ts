import { access, readdir, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { promisify } from "node:util";
import { execFile as execFileCb } from "node:child_process";

const execFile = promisify(execFileCb);

export function getHomeDir(): string {
  return homedir();
}

export async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export function resolveUserPath(pathOrTilde: string, homeDir: string): string {
  if (pathOrTilde.startsWith("~/")) {
    return join(homeDir, pathOrTilde.slice(2));
  }
  if (pathOrTilde === "~") {
    return homeDir;
  }
  return pathOrTilde;
}

export async function findGitRoot(workspacePath: string): Promise<string> {
  const MAX_DEPTH = 64;
  try {
    const { stdout } = await execFile("git", ["rev-parse", "--show-toplevel"], {
      cwd: workspacePath
    });
    const resolved = stdout.trim();
    if (resolved) {
      return resolved;
    }
  } catch {
    // Fall back to directory traversal if git command is unavailable.
  }

  let current = resolve(workspacePath);
  let depth = 0;
  while (depth < MAX_DEPTH) {
    if (await exists(join(current, ".git"))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      return resolve(workspacePath);
    }
    current = parent;
    depth += 1;
  }
  return resolve(workspacePath);
}

export function pathSegmentsFromRoot(rootPath: string, targetPath: string): string[] {
  const rootParts = resolve(rootPath).split("/").filter(Boolean);
  const targetParts = resolve(targetPath).split("/").filter(Boolean);
  const dirs = [resolve(rootPath)];

  if (targetParts.length < rootParts.length) {
    return dirs;
  }

  let current = rootPath;
  for (let i = rootParts.length; i < targetParts.length; i += 1) {
    current = join(current, targetParts[i]);
    dirs.push(current);
  }
  return dirs;
}

export async function listSkillFiles(location: string): Promise<string[]> {
  const files: string[] = [];
  if (!(await exists(location))) {
    return files;
  }

  const entries = await readdir(location, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const skillMdPath = join(location, entry.name, "SKILL.md");
    if (await exists(skillMdPath)) {
      files.push(skillMdPath);
    }
  }

  return files;
}

export async function isDirectory(path: string): Promise<boolean> {
  try {
    const info = await stat(path);
    return info.isDirectory();
  } catch {
    return false;
  }
}

export function ensureAbsolutePath(path: string, workspacePath: string): string {
  return isAbsolute(path) ? path : resolve(workspacePath, path);
}

export function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}
