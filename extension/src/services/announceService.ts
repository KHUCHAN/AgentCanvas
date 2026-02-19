import type { AgentProfile, AnnounceMessage, Task } from "../types";
import type { CreateProposalResult } from "./proposalService";

export function buildAnnounce(input: {
  runId: string;
  task: Task;
  agent: AgentProfile;
  proposal?: CreateProposalResult;
  durationMs: number;
  error?: string;
}): AnnounceMessage {
  const changedFiles = input.proposal?.changedFiles ?? [];
  const summary = input.error
    ? `${input.task.title} failed: ${input.error}`
    : changedFiles.length > 0
      ? `${input.task.title}: ${changedFiles.length} file(s) changed`
      : `${input.task.title}: completed with no patch changes`;

  return {
    runId: input.runId,
    workerId: input.agent.id,
    workerName: input.agent.name,
    status: input.error ? "error" : "ok",
    summary,
    proposalPath: input.proposal?.proposalJsonPath,
    touchedFiles: changedFiles.map((item) => item.path),
    durationMs: Math.max(0, Math.round(input.durationMs))
  };
}

