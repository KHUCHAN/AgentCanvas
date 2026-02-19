import type { AnnounceMessage, ProposalReview, ReviewDecision } from "../types";

export function reviewProposal(input: {
  runId: string;
  taskId: string;
  announce: AnnounceMessage;
  autoApprove?: boolean;
  orchestratorResponse?: string;
}): ProposalReview {
  let decision: ReviewDecision;
  let reason: string | undefined;

  if (input.autoApprove) {
    decision = "apply";
  } else if (input.orchestratorResponse?.trim()) {
    const parsed = parseDecision(input.orchestratorResponse);
    decision = parsed.decision;
    reason = parsed.reason;
  } else {
    decision = input.announce.status === "ok" ? "apply" : "reject";
    reason = input.announce.status === "ok" ? undefined : "announce_status_error";
  }

  return {
    runId: input.runId,
    taskId: input.taskId,
    decision,
    reason,
    appliedAt: decision === "apply" ? Date.now() : undefined
  };
}

function parseDecision(raw: string): { decision: ReviewDecision; reason?: string } {
  const value = raw.trim();
  const normalized = value.toLowerCase();

  if (normalized === "apply" || normalized.startsWith("apply:")) {
    return {
      decision: "apply",
      reason: extractReason(value)
    };
  }
  if (normalized === "reject" || normalized.startsWith("reject:")) {
    return {
      decision: "reject",
      reason: extractReason(value)
    };
  }
  if (normalized === "revise" || normalized.startsWith("revise:")) {
    return {
      decision: "revise",
      reason: extractReason(value)
    };
  }
  throw new Error(`Unknown review decision: ${value}`);
}

function extractReason(text: string): string | undefined {
  const separator = text.indexOf(":");
  if (separator < 0) {
    return undefined;
  }
  const reason = text.slice(separator + 1).trim();
  return reason || undefined;
}
