import { z } from "zod";
import type { ValidationIssue } from "../types";

const nameSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      "name must be lowercase alphanumeric and hyphen-separated without leading/trailing hyphens"
  });

const descriptionSchema = z.string().min(1).max(1024);

export function validateSkillMeta(input: {
  name: unknown;
  description: unknown;
  folderName: string;
  body: string;
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const parsedName = nameSchema.safeParse(input.name);
  if (!parsedName.success) {
    issues.push({
      level: "error",
      code: "SKILL_NAME_INVALID",
      message: parsedName.error.issues[0]?.message ?? "Invalid skill name"
    });
  }

  const parsedDescription = descriptionSchema.safeParse(input.description);
  if (!parsedDescription.success) {
    issues.push({
      level: "error",
      code: "SKILL_DESCRIPTION_INVALID",
      message: "description must be between 1 and 1024 characters"
    });
  }

  if (typeof input.name === "string" && input.name !== input.folderName) {
    issues.push({
      level: "error",
      code: "SKILL_FOLDER_NAME_MISMATCH",
      message: `frontmatter name (${input.name}) must match folder name (${input.folderName})`
    });
  }

  for (const warning of collectReferenceWarnings(input.body)) {
    issues.push(warning);
  }

  return issues;
}

function collectReferenceWarnings(content: string): ValidationIssue[] {
  const warnings: ValidationIssue[] = [];
  const linkMatches = content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g);

  for (const match of linkMatches) {
    const ref = match[1];
    if (!ref || ref.startsWith("http://") || ref.startsWith("https://") || ref.startsWith("#")) {
      continue;
    }
    if (ref.startsWith("/")) {
      warnings.push({
        level: "warning",
        code: "SKILL_REFERENCE_ABSOLUTE_PATH",
        message: `reference \"${ref}\" should be a skill-root relative path`
      });
      continue;
    }

    if (ref.includes("..")) {
      warnings.push({
        level: "warning",
        code: "SKILL_REFERENCE_PARENT_PATH",
        message: `reference \"${ref}\" escapes skill root and should stay relative to skill folder`
      });
    }

    const depth = ref.split("/").filter(Boolean).length;
    if (depth > 2) {
      warnings.push({
        level: "warning",
        code: "SKILL_REFERENCE_DEEP",
        message: `reference \"${ref}\" is deeper than recommended one-level structure`
      });
    }
  }

  return dedupeWarnings(warnings);
}

function dedupeWarnings(issues: ValidationIssue[]): ValidationIssue[] {
  const seen = new Set<string>();
  const result: ValidationIssue[] = [];
  for (const issue of issues) {
    const key = `${issue.code}:${issue.message}`;
    if (!seen.has(key)) {
      result.push(issue);
      seen.add(key);
    }
  }
  return result;
}
