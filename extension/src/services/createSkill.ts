import { mkdir, writeFile } from "node:fs/promises";
import { basename, join, resolve, sep } from "node:path";
import { renderOpenAiYaml, renderSkillMarkdown } from "./skillTemplate";

export async function createSkillFromTemplate(input: {
  baseDirPath: string;
  name: string;
  description: string;
  scope?: "project" | "personal" | "shared" | "global";
  extraFrontmatter?: Record<string, unknown>;
  generateOpenAiYaml?: boolean;
}): Promise<{ skillDirPath: string; skillFilePath: string }> {
  try {
    const baseDirPath = resolve(input.baseDirPath);
    const cleanName = sanitizeSkillName(input.name);
    const cleanDescription = input.description.trim();
    const skillDirPath = resolve(baseDirPath, cleanName);
    ensureInsideBasePath(skillDirPath, baseDirPath);
    const skillFilePath = join(skillDirPath, "SKILL.md");

    await mkdir(skillDirPath, { recursive: true });

    const markdown = renderSkillMarkdown({
      name: cleanName,
      description: cleanDescription,
      scope: input.scope,
      extraFrontmatter: input.extraFrontmatter
    });
    await writeFile(skillFilePath, markdown, "utf8");

    if (input.generateOpenAiYaml) {
      const agentsDir = join(skillDirPath, "agents");
      await mkdir(agentsDir, { recursive: true });
      await writeFile(join(agentsDir, "openai.yaml"), renderOpenAiYaml(), "utf8");
    }

    return { skillDirPath, skillFilePath };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to create skill template: ${detail}`);
  }
}

function sanitizeSkillName(name: string): string {
  const trimmed = name.trim();
  const withoutPath = basename(trimmed).replace(/[\\/]/g, "");
  if (!withoutPath || withoutPath === "." || withoutPath === "..") {
    throw new Error("Invalid skill name");
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(withoutPath)) {
    throw new Error("Skill name must be lowercase alphanumeric with hyphens");
  }
  return withoutPath;
}

function ensureInsideBasePath(targetPath: string, basePath: string): void {
  const resolvedBase = resolve(basePath);
  const resolvedTarget = resolve(targetPath);
  if (resolvedTarget === resolvedBase) {
    throw new Error("Skill path must not be base directory itself");
  }
  if (!resolvedTarget.startsWith(`${resolvedBase}${sep}`)) {
    throw new Error("Path traversal detected while creating skill");
  }
}
