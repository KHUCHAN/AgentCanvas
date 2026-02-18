import type { ValidationIssue } from "../messaging/protocol";

export function getValidationCounts(issues: ValidationIssue[]): {
  errors: number;
  warnings: number;
} {
  let errors = 0;
  let warnings = 0;
  for (const issue of issues) {
    if (issue.level === "error") {
      errors += 1;
    } else if (issue.level === "warning") {
      warnings += 1;
    }
  }
  return { errors, warnings };
}
