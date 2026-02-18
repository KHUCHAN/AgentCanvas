import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, normalize, posix, resolve, sep } from "node:path";
import JSZip from "jszip";
import { z } from "zod";
import type { Skill, SkillPackPreview, SkillPackPreviewItem } from "../types";
import { exists } from "./pathUtils";

interface SkillPackManifest {
  format: "agent-skill-pack/v1";
  name: string;
  version: string;
  createdAt: string;
  skills: Array<{
    name: string;
    relativePath: string;
    description?: string;
    source?: { type: string; workspace?: string };
  }>;
}

interface ParsedPackInfo {
  skills: SkillPackPreviewItem[];
  warnings: string[];
}

const skillPackManifestSchema = z.object({
  format: z.literal("agent-skill-pack/v1"),
  name: z.string().optional(),
  version: z.string().optional(),
  createdAt: z.string().optional(),
  skills: z.array(
    z.object({
      name: z.string(),
      relativePath: z.string(),
      description: z.string().optional()
    })
  )
});

export async function exportSkillPack(input: {
  skills: Skill[];
  outputPath: string;
  workspacePath?: string;
}): Promise<void> {
  const zip = new JSZip();
  const manifest: SkillPackManifest = {
    format: "agent-skill-pack/v1",
    name: "agent-canvas-pack",
    version: "0.1.0",
    createdAt: new Date().toISOString(),
    skills: []
  };

  for (const skill of input.skills) {
    const skillDir = dirname(skill.path);
    const zipRoot = `${skill.name}/`;
    await addDirectoryToZip(zip, skillDir, zipRoot);

    manifest.skills.push({
      name: skill.name,
      relativePath: zipRoot,
      description: skill.description,
      source: {
        type: "exported-from-vscode",
        workspace: input.workspacePath
      }
    });
  }

  zip.file("skillpack.json", JSON.stringify(manifest, null, 2));
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  await writeFile(input.outputPath, buffer);
}

export async function previewSkillPack(input: {
  zipPath: string;
  installDirDefault: string;
}): Promise<SkillPackPreview> {
  const zipBuffer = await readFile(input.zipPath);
  const zip = await JSZip.loadAsync(zipBuffer);
  const parsed = await parsePack(zip);

  return {
    zipPath: input.zipPath,
    installDirDefault: input.installDirDefault,
    skills: parsed.skills,
    warnings: parsed.warnings
  };
}

export async function importSkillPack(input: {
  zipPath: string;
  installDir: string;
  overwrite?: boolean;
}): Promise<{
  installed: Array<{ name: string; path: string }>;
  warnings: string[];
}> {
  const zipBuffer = await readFile(input.zipPath);
  const zip = await JSZip.loadAsync(zipBuffer);
  const parsed = await parsePack(zip);

  const installed: Array<{ name: string; path: string }> = [];
  await mkdir(input.installDir, { recursive: true });

  for (const item of parsed.skills) {
    const safeName = sanitizeSkillFolderName(item.name);
    const requestedBaseDir = resolve(input.installDir, safeName);
    ensureInsideBasePath(requestedBaseDir, input.installDir);
    const targetDir = input.overwrite
      ? resolve(requestedBaseDir)
      : await resolveConflictDir(requestedBaseDir);

    await extractFolder(zip, item.relativePath, targetDir);
    installed.push({
      name: basename(targetDir),
      path: targetDir
    });
  }

  return {
    installed,
    warnings: parsed.warnings
  };
}

async function parsePack(zip: JSZip): Promise<ParsedPackInfo> {
  const warnings: string[] = [];
  const manifest = await readManifest(zip);

  const skillRoots = manifest
    ? manifest.skills.flatMap((item) => {
        const normalized = normalizeSkillRoot(item.relativePath);
        if (!normalized) {
          warnings.push(`${item.name}: skipped invalid relativePath (${item.relativePath})`);
          return [];
        }
        return [{
          name: item.name,
          relativePath: normalized,
          description: item.description
        }];
      })
    : inferSkillPaths(zip).map((relativePath) => {
        const normalized = normalizeSkillRoot(relativePath) ?? "skill/";
        const fallbackName = normalized.replace(/\/$/, "").split("/").filter(Boolean).pop() ?? "skill";
        return {
          name: fallbackName,
          relativePath: normalized,
          description: undefined
        };
      });

  const normalizedRoots = dedupeSkillRoots(skillRoots);
  const skills: SkillPackPreviewItem[] = [];

  for (const root of normalizedRoots) {
    const hasScripts = containsScripts(zip, root.relativePath);
    const allowedTools = await detectAllowedTools(zip, root.relativePath);

    if (hasScripts) {
      warnings.push(`${root.name}: includes scripts/ directory (review before use)`);
    }
    if (allowedTools) {
      warnings.push(`${root.name}: declares allowed-tools (${allowedTools})`);
    }

    skills.push({
      name: root.name,
      relativePath: root.relativePath,
      description: root.description,
      hasScripts,
      allowedTools
    });
  }

  return { skills, warnings };
}

async function addDirectoryToZip(zip: JSZip, sourceDir: string, zipDirPrefix: string): Promise<void> {
  const entries = await readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const absolute = join(sourceDir, entry.name);
    const relative = `${zipDirPrefix}${entry.name}`;

    if (entry.isDirectory()) {
      await addDirectoryToZip(zip, absolute, `${relative}/`);
      continue;
    }

    if (entry.isFile()) {
      const content = await readFile(absolute);
      zip.file(relative, content);
    }
  }
}

async function readManifest(zip: JSZip): Promise<SkillPackManifest | undefined> {
  const manifestFile = zip.file("skillpack.json");
  if (!manifestFile) {
    return undefined;
  }

  try {
    const text = await manifestFile.async("string");
    const parsed = JSON.parse(text) as unknown;
    const validated = skillPackManifestSchema.safeParse(parsed);
    if (validated.success) {
      return validated.data as SkillPackManifest;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function inferSkillPaths(zip: JSZip): string[] {
  const roots = new Set<string>();
  for (const fileName of Object.keys(zip.files)) {
    if (!fileName.endsWith("SKILL.md")) {
      continue;
    }
    const firstSegment = fileName.split("/")[0];
    if (firstSegment) {
      roots.add(`${firstSegment}/`);
    }
  }

  return [...roots];
}

function normalizeSkillRoot(relativePath: string): string | undefined {
  const raw = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const normalized = posix.normalize(raw);
  if (!normalized || normalized === "." || normalized.startsWith("../") || normalized.includes("/../")) {
    return undefined;
  }
  const root = normalized.split("/").filter(Boolean)[0];
  if (!root || root === "." || root === "..") {
    return undefined;
  }
  return `${root}/`;
}

function dedupeSkillRoots(
  roots: Array<{ name: string; relativePath: string; description?: string }>
): Array<{ name: string; relativePath: string; description?: string }> {
  const seen = new Set<string>();
  const result: Array<{ name: string; relativePath: string; description?: string }> = [];

  for (const root of roots) {
    const key = `${root.name}:${root.relativePath}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(root);
  }

  return result;
}

function containsScripts(zip: JSZip, prefix: string): boolean {
  return Object.keys(zip.files).some(
    (fileName) => fileName.startsWith(prefix) && fileName.includes("/scripts/")
  );
}

async function detectAllowedTools(zip: JSZip, prefix: string): Promise<string | undefined> {
  const skillFile = zip.file(`${prefix}SKILL.md`);
  if (!skillFile) {
    return undefined;
  }

  const content = await skillFile.async("string");
  const match = content.match(/allowed-tools\s*:\s*(.+)/i);
  return match?.[1]?.trim();
}

async function resolveConflictDir(baseDir: string): Promise<string> {
  if (!(await exists(baseDir))) {
    return resolve(baseDir);
  }

  let index = 1;
  while (true) {
    const candidate = `${baseDir}-${index}`;
    if (!(await exists(candidate))) {
      return resolve(candidate);
    }
    index += 1;
  }
}

async function extractFolder(zip: JSZip, prefix: string, targetDir: string): Promise<void> {
  await mkdir(targetDir, { recursive: true });
  const resolvedTargetDir = resolve(targetDir);

  const entries = Object.entries(zip.files).filter(
    ([name, entry]) => name.startsWith(prefix) && !entry.dir
  );

  for (const [fileName, file] of entries) {
    const relative = sanitizeArchiveRelativePath(fileName.slice(prefix.length));
    if (!relative) {
      continue;
    }

    const outputPath = resolve(targetDir, relative);
    ensureInsideBasePath(outputPath, resolvedTargetDir);
    await mkdir(dirname(outputPath), { recursive: true });
    const content = await file.async("nodebuffer");
    await writeFile(outputPath, content);
  }
}

function sanitizeSkillFolderName(name: string): string {
  const base = basename(name.trim()).replace(/[\\/]/g, "");
  if (!base || base === "." || base === "..") {
    throw new Error(`Invalid skill folder name in pack: ${name}`);
  }
  return base;
}

function sanitizeArchiveRelativePath(relativePath: string): string {
  const normalized = normalize(relativePath).replace(/\\/g, "/");
  if (
    !normalized ||
    normalized === "." ||
    normalized.startsWith("/") ||
    normalized.startsWith("../") ||
    normalized.includes("/../")
  ) {
    throw new Error(`Path traversal detected in zip entry: ${relativePath}`);
  }
  return normalized;
}

function ensureInsideBasePath(targetPath: string, basePath: string): void {
  const resolvedBase = resolve(basePath);
  const resolvedTarget = resolve(targetPath);
  if (resolvedTarget === resolvedBase) {
    return;
  }
  if (!resolvedTarget.startsWith(`${resolvedBase}${sep}`)) {
    throw new Error(`Path traversal detected: ${targetPath}`);
  }
}
