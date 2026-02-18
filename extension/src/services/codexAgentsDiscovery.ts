import { readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { parse as parseToml } from "@iarna/toml";
import { exists } from "./pathUtils";

type CodexConfig = {
  project_root_markers?: unknown;
  project_doc_fallback_filenames?: unknown;
};

export type DiscoveredCodexDoc = {
  path: string;
  sourceDir: string;
  scope: "global" | "project";
  orderIndex: number;
  isOverride: boolean;
};

export async function discoverCodexAgentsChain(input: {
  workspacePath: string;
  homeDir: string;
  fallbackFileName?: string;
}): Promise<DiscoveredCodexDoc[]> {
  const codexHome = resolveCodexHome(input.homeDir);
  const config = await readCodexConfig(join(codexHome, "config.toml"));

  const markers = asStringArray(config.project_root_markers, [".git"]);
  const configuredFallbacks = asStringArray(config.project_doc_fallback_filenames, []);
  const fallbackFileNames = dedupeStrings([
    ...configuredFallbacks,
    ...(input.fallbackFileName ? [input.fallbackFileName] : [])
  ]);

  const docs: DiscoveredCodexDoc[] = [];

  const globalDoc = await pickGuidanceFile(codexHome, []);
  if (globalDoc) {
    docs.push({
      path: globalDoc.path,
      sourceDir: codexHome,
      scope: "global",
      orderIndex: 0,
      isOverride: globalDoc.isOverride
    });
  }

  const workspacePath = resolve(input.workspacePath);
  const projectRoot = await findProjectRoot(workspacePath, markers);
  const dirs = getPathSegments(projectRoot, workspacePath);

  let orderIndex = docs.length;
  for (const dir of dirs) {
    const selected = await pickGuidanceFile(dir, fallbackFileNames);
    if (!selected) {
      continue;
    }

    docs.push({
      path: selected.path,
      sourceDir: resolve(dir),
      scope: "project",
      orderIndex,
      isOverride: selected.isOverride
    });
    orderIndex += 1;
  }

  return docs;
}

export async function discoverCodexProjectRoot(input: {
  workspacePath: string;
  homeDir: string;
}): Promise<string> {
  const codexHome = resolveCodexHome(input.homeDir);
  const config = await readCodexConfig(join(codexHome, "config.toml"));
  const markers = asStringArray(config.project_root_markers, [".git"]);
  return findProjectRoot(resolve(input.workspacePath), markers);
}

async function readCodexConfig(configPath: string): Promise<CodexConfig> {
  if (!(await exists(configPath))) {
    return {};
  }

  try {
    const raw = await readFile(configPath, "utf8");
    const parsed = parseToml(raw) as Record<string, unknown>;
    return {
      project_root_markers: parsed.project_root_markers,
      project_doc_fallback_filenames: parsed.project_doc_fallback_filenames
    };
  } catch (error) {
    console.warn(`Failed to parse Codex config: ${configPath}`, error);
    return {};
  }
}

function asStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }
  const normalized = value.filter((item): item is string => typeof item === "string");
  return normalized.length > 0 ? normalized : [...fallback];
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function resolveCodexHome(homeDir: string): string {
  const envHome = process.env.CODEX_HOME;
  if (envHome && envHome.trim().length > 0) {
    return resolve(envHome);
  }
  return join(homeDir, ".codex");
}

async function findProjectRoot(startPath: string, markers: string[]): Promise<string> {
  const MAX_DEPTH = 64;
  let current = resolve(startPath);
  let depth = 0;
  while (depth < MAX_DEPTH) {
    for (const marker of markers) {
      if (await exists(join(current, marker))) {
        return current;
      }
    }

    const parent = dirname(current);
    if (parent === current) {
      return resolve(startPath);
    }
    current = parent;
    depth += 1;
  }
  return resolve(startPath);
}

function getPathSegments(rootPath: string, targetPath: string): string[] {
  const root = resolve(rootPath);
  const target = resolve(targetPath);
  const relativePath = relative(root, target);

  if (relativePath.startsWith("..") || relativePath === "") {
    return [root];
  }

  const parts = relativePath.split(/[\\/]/).filter(Boolean);
  const dirs = [root];
  let cursor = root;
  for (const part of parts) {
    cursor = join(cursor, part);
    dirs.push(cursor);
  }
  return dirs;
}

async function pickGuidanceFile(
  directoryPath: string,
  fallbackFileNames: string[]
): Promise<{ path: string; isOverride: boolean } | undefined> {
  const candidates = ["AGENTS.override.md", "AGENTS.md", ...fallbackFileNames];
  for (const name of candidates) {
    const candidate = join(directoryPath, name);
    if (await exists(candidate)) {
      return {
        path: resolve(candidate),
        isOverride: name === "AGENTS.override.md"
      };
    }
  }
  return undefined;
}
