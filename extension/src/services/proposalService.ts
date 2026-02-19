import { readFile, writeFile } from "node:fs/promises";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import {
  getSandboxPaths,
  normalizeSandboxRelativePath,
  readGitHead,
  type SandboxIdentity
} from "./sandboxService";

const execFile = promisify(execFileCb);

type ProposalStatus = "added" | "modified" | "deleted";

export type ProposalChangedFile = {
  path: string;
  status: ProposalStatus;
};

export type ProposalDocument = {
  version: "1";
  runId: string;
  agentId: string;
  createdAt: string;
  base: {
    gitHead?: string;
  };
  paths: {
    inputDir: string;
    workDir: string;
    patchFile: string;
    summaryFile: string;
  };
  changedFiles: ProposalChangedFile[];
  allowedFiles: string[];
  notes?: string;
};

export type CreateProposalInput = SandboxIdentity & {
  notes?: string;
  allowedFiles?: string[];
  gitHead?: string;
};

export type CreateProposalResult = {
  proposalJsonPath: string;
  patchPath: string;
  summaryPath: string;
  changedFiles: ProposalChangedFile[];
  hasChanges: boolean;
};

export type ApplyProposalInput = SandboxIdentity;

export type ApplyProposalResult = {
  proposalJsonPath: string;
  patchPath: string;
  changedFiles: ProposalChangedFile[];
  applied: boolean;
};

export async function createProposal(input: CreateProposalInput): Promise<CreateProposalResult> {
  const paths = getSandboxPaths(input);
  const rawDiff = await diffSandbox(paths.rootDir);
  const patch = stripSandboxPrefixes(rawDiff);
  const changedFiles = extractChangedFiles(patch);
  const allowedFiles = [
    ...new Set((input.allowedFiles ?? []).map((item) => normalizeSandboxRelativePath(item)))
  ];
  const proposal: ProposalDocument = {
    version: "1",
    runId: input.runId,
    agentId: input.agentId,
    createdAt: new Date().toISOString(),
    base: {
      gitHead: input.gitHead ?? (await readGitHead(input.workspaceRoot))
    },
    paths: {
      inputDir: "input",
      workDir: "work",
      patchFile: "proposal/changes.patch",
      summaryFile: "proposal/summary.md"
    },
    changedFiles,
    allowedFiles,
    notes: input.notes?.trim() || undefined
  };

  await writeFile(paths.patchPath, patch, "utf8");
  await writeFile(paths.summaryPath, buildSummary(proposal), "utf8");
  await writeFile(paths.proposalJsonPath, `${JSON.stringify(proposal, null, 2)}\n`, "utf8");

  return {
    proposalJsonPath: paths.proposalJsonPath,
    patchPath: paths.patchPath,
    summaryPath: paths.summaryPath,
    changedFiles,
    hasChanges: changedFiles.length > 0
  };
}

export async function applyProposal(input: ApplyProposalInput): Promise<ApplyProposalResult> {
  const paths = getSandboxPaths(input);
  const proposal = await readProposalDocument(paths.proposalJsonPath);
  const patch = await readFile(paths.patchPath, "utf8");
  const changedFiles = extractChangedFiles(patch);

  validateProposalPaths(changedFiles.length > 0 ? changedFiles : proposal.changedFiles, proposal.allowedFiles);

  if (changedFiles.length === 0 || patch.trim().length === 0) {
    return {
      proposalJsonPath: paths.proposalJsonPath,
      patchPath: paths.patchPath,
      changedFiles: changedFiles.length > 0 ? changedFiles : proposal.changedFiles,
      applied: false
    };
  }

  await runGit(["apply", "--check", paths.patchPath], input.workspaceRoot);
  await runGit(["apply", paths.patchPath], input.workspaceRoot);

  return {
    proposalJsonPath: paths.proposalJsonPath,
    patchPath: paths.patchPath,
    changedFiles,
    applied: true
  };
}

function buildSummary(proposal: ProposalDocument): string {
  const lines = [
    "# Proposal Summary",
    "",
    `- Run ID: ${proposal.runId}`,
    `- Agent ID: ${proposal.agentId}`,
    `- Created At: ${proposal.createdAt}`,
    proposal.base.gitHead ? `- Base Git HEAD: ${proposal.base.gitHead}` : "- Base Git HEAD: unavailable",
    ""
  ];
  if (proposal.changedFiles.length === 0) {
    lines.push("No file changes detected.");
  } else {
    lines.push("## Changed Files", "");
    for (const item of proposal.changedFiles) {
      lines.push(`- [${item.status}] ${item.path}`);
    }
  }
  if (proposal.notes) {
    lines.push("", "## Notes", "", proposal.notes);
  }
  return `${lines.join("\n")}\n`;
}

function validateProposalPaths(changedFiles: ProposalChangedFile[], allowedFiles: string[]): void {
  const allowedSet = new Set(allowedFiles.map((item) => normalizeSandboxRelativePath(item)));
  for (const file of changedFiles) {
    const normalized = normalizeSandboxRelativePath(file.path);
    if (allowedSet.size > 0 && !allowedSet.has(normalized)) {
      throw new Error(`Patch touches file outside allowed set: ${normalized}`);
    }
  }
}

async function readProposalDocument(path: string): Promise<ProposalDocument> {
  const raw = await readFile(path, "utf8");
  const parsed = JSON.parse(raw) as Partial<ProposalDocument>;
  if (!parsed || parsed.version !== "1") {
    throw new Error("Invalid proposal document: unsupported version");
  }
  if (!parsed.runId || !parsed.agentId) {
    throw new Error("Invalid proposal document: missing runId/agentId");
  }
  return {
    version: "1",
    runId: parsed.runId,
    agentId: parsed.agentId,
    createdAt: parsed.createdAt ?? new Date().toISOString(),
    base: parsed.base ?? {},
    paths: parsed.paths ?? {
      inputDir: "input",
      workDir: "work",
      patchFile: "proposal/changes.patch",
      summaryFile: "proposal/summary.md"
    },
    changedFiles: Array.isArray(parsed.changedFiles) ? parsed.changedFiles : [],
    allowedFiles: Array.isArray(parsed.allowedFiles) ? parsed.allowedFiles : [],
    notes: parsed.notes
  };
}

function extractChangedFiles(patch: string): ProposalChangedFile[] {
  type Block = {
    oldPath?: string | null;
    newPath?: string | null;
  };
  const byPath = new Map<string, ProposalStatus>();
  let block: Block = {};
  const finalizeBlock = () => {
    const oldPath = block.oldPath;
    const newPath = block.newPath;
    block = {};
    let status: ProposalStatus | undefined;
    let path: string | undefined;
    if (oldPath === null && typeof newPath === "string") {
      status = "added";
      path = newPath;
    } else if (newPath === null && typeof oldPath === "string") {
      status = "deleted";
      path = oldPath;
    } else if (typeof newPath === "string") {
      status = "modified";
      path = newPath;
    } else if (typeof oldPath === "string") {
      status = "modified";
      path = oldPath;
    }
    if (!status || !path) {
      return;
    }
    const normalized = normalizeSandboxRelativePath(path);
    const existing = byPath.get(normalized);
    byPath.set(normalized, existing ?? status);
  };

  for (const line of patch.split(/\r?\n/)) {
    if (line.startsWith("diff --git ")) {
      finalizeBlock();
      continue;
    }
    if (line.startsWith("--- ")) {
      block.oldPath = parsePatchPath(line.slice(4));
      continue;
    }
    if (line.startsWith("+++ ")) {
      block.newPath = parsePatchPath(line.slice(4));
      continue;
    }
  }
  finalizeBlock();

  return [...byPath.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([path, status]) => ({ path, status }));
}

function parsePatchPath(raw: string): string | null {
  const token = raw.trim().split("\t")[0].replace(/^"+|"+$/g, "");
  if (token === "/dev/null") {
    return null;
  }
  if (token.startsWith("a/") || token.startsWith("b/")) {
    return token.slice(2);
  }
  return token;
}

function stripSandboxPrefixes(rawPatch: string): string {
  const lines = rawPatch.split(/\r?\n/);
  const rewritten = lines.map((line) => {
    if (line.startsWith("diff --git a/input/") && line.includes(" b/work/")) {
      return line.replace(/^diff --git a\/input\//, "diff --git a/").replace(/ b\/work\//, " b/");
    }
    if (line.startsWith("--- a/input/")) {
      return line.replace(/^--- a\/input\//, "--- a/");
    }
    if (line.startsWith("+++ b/work/")) {
      return line.replace(/^\+\+\+ b\/work\//, "+++ b/");
    }
    if (line.startsWith("rename from input/")) {
      return line.replace(/^rename from input\//, "rename from ");
    }
    if (line.startsWith("rename to work/")) {
      return line.replace(/^rename to work\//, "rename to ");
    }
    if (line.startsWith("Binary files input/") && line.includes(" and work/")) {
      return line.replace(/^Binary files input\//, "Binary files ").replace(/ and work\//, " and ");
    }
    return line;
  });
  return `${rewritten.join("\n").trimEnd()}\n`;
}

async function diffSandbox(sandboxRoot: string): Promise<string> {
  try {
    const { stdout } = await execFile("git", ["diff", "--no-index", "--binary", "input", "work"], {
      cwd: sandboxRoot,
      maxBuffer: 16 * 1024 * 1024
    });
    return stdout;
  } catch (error) {
    const parsed = error as {
      code?: number;
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    if (parsed.code === 1) {
      return parsed.stdout ?? "";
    }
    throw new Error(parsed.stderr || parsed.message || "Failed to generate sandbox patch");
  }
}

async function runGit(args: string[], cwd: string): Promise<void> {
  try {
    await execFile("git", args, { cwd, maxBuffer: 16 * 1024 * 1024 });
  } catch (error) {
    const parsed = error as { stderr?: string; stdout?: string; message?: string };
    throw new Error(parsed.stderr || parsed.stdout || parsed.message || "git command failed");
  }
}
