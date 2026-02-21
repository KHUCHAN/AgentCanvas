import type { CanonicalBackendId } from "../types";

export interface BackendQuota {
  backendId: CanonicalBackendId;
  remainingPct: number;
  resetsAt?: string;
}

export function selectBackendForTask(
  quotas: BackendQuota[],
  taskWeight: "light" | "medium" | "heavy"
): CanonicalBackendId | undefined {
  const threshold = taskWeight === "heavy" ? 40 : taskWeight === "medium" ? 25 : 10;
  const candidates = quotas
    .filter((quota) => quota.remainingPct >= threshold)
    .sort((left, right) => right.remainingPct - left.remainingPct);
  return candidates[0]?.backendId;
}
