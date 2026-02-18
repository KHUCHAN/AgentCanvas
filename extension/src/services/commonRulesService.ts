import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { exists } from "./pathUtils";

export const COMMON_RULES_FOLDER = ".agentcanvas/rules/common";
export const AGENT_VISUALS_FILE = "AGENT_VISUALS_AND_COMMS.md";
export const MCP_PLAN_FILE = "MCP_AGENT_PLAN.md";
export const AGENT_COMMS_AND_OPS_FILE = "AGENT_COMMS_AND_OPS.md";

export async function discoverExtensionManagedCommonRules(
  workspacePath: string
): Promise<string[]> {
  const commonRulesPath = resolve(workspacePath, COMMON_RULES_FOLDER);
  if (!(await exists(commonRulesPath))) {
    return [];
  }

  const entries = await readdir(commonRulesPath, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
    .map((entry) => resolve(commonRulesPath, entry.name))
    .sort((left, right) => left.localeCompare(right));
  return files;
}

export async function ensureRootAgentsFile(workspacePath: string): Promise<string> {
  const rootAgentsPath = resolve(workspacePath, "AGENTS.md");
  if (!(await exists(rootAgentsPath))) {
    const initial = `# AGENTS\n\n## Common Rules\nAdd shared guidance here.\n`;
    await writeFile(rootAgentsPath, initial, "utf8");
  }
  return rootAgentsPath;
}

export async function ensureCommonRulesFolder(workspacePath: string): Promise<string> {
  const folderPath = resolve(workspacePath, COMMON_RULES_FOLDER);
  await mkdir(folderPath, { recursive: true });
  return folderPath;
}

export async function ensureDefaultCommonRuleDocs(workspacePath: string): Promise<string[]> {
  const folderPath = await ensureCommonRulesFolder(workspacePath);

  const targets = [
    {
      fileName: AGENT_VISUALS_FILE,
      body: AGENT_VISUALS_AND_COMMS_TEMPLATE
    },
    {
      fileName: MCP_PLAN_FILE,
      body: MCP_AGENT_PLAN_TEMPLATE
    },
    {
      fileName: AGENT_COMMS_AND_OPS_FILE,
      body: AGENT_COMMS_AND_OPS_TEMPLATE
    }
  ];

  const created: string[] = [];
  for (const target of targets) {
    const filePath = join(folderPath, target.fileName);
    if (!(await exists(filePath))) {
      await writeFile(filePath, target.body, "utf8");
      created.push(filePath);
      continue;
    }

    const existing = await readFile(filePath, "utf8");
    if (existing.trim().length === 0) {
      await writeFile(filePath, target.body, "utf8");
      created.push(filePath);
    }
  }

  return created;
}

const AGENT_VISUALS_AND_COMMS_TEMPLATE = `# AGENT_VISUALS_AND_COMMS.md
AgentCanvas - Agent Visual Identity and Communication Protocol

## Agent Visuals
- Use neutral badges and initials (no brand logo cloning).
- Keep colors aligned with VS Code theme variables.
- Status badges: OK, Warning, Error.

## Canvas Semantics
- Agent nodes are always visible.
- Common rules are pinned to top-right.
- Expanded view reveals selected agent context only.

## Communication Format
1. Intent
2. Inputs and assumptions
3. Plan
4. Actions and artifacts
5. Open questions (max 3)
`;

const MCP_AGENT_PLAN_TEMPLATE = `# MCP_AGENT_PLAN.md
AgentCanvas - MCP Integration Plan

## Goals
- Manage Codex and VS Code MCP servers from one panel.
- Use secure defaults and explicit trust warnings.

## Config Targets
- Codex: ~/.codex/config.toml and .codex/config.toml
- VS Code: .vscode/mcp.json

## Guardrails
- Never store raw secrets in config.
- Prefer env var references.
- Show diff preview before writing config.
`;

const AGENT_COMMS_AND_OPS_TEMPLATE = `# AGENT_COMMS_AND_OPS.md
AgentCanvas — Communication, Memory, and Ops Rules

## 0) Design principles
- File-first rules: durable guidance must live in markdown files.
- Deterministic enforcement first (policies/hooks), not memory-only instructions.
- Least context: keep MCP servers and skill context minimal and on-demand.
- Isolation by default: avoid context bleed across users/channels/sessions.

## 1) Standard response format
1. Intent
2. Assumptions and inputs
3. Plan (3-7 bullets)
4. Actions and artifacts
5. Risks or safety notes
6. Next steps or DONE

## 2) Memory policy
- Long-lived decisions and preferences belong in MEMORY.md.
- Daily execution notes go to memory/YYYY-MM-DD.md (append-only).
- Assume chat compaction may drop early context; durable rules must be file-backed.

## 3) Skills safety
- user-invocable controls menu exposure only.
- disable-model-invocation is the hard safety gate.
- Destructive or secret-touching skills must require explicit human invocation.

## 4) MCP policy
- Keep MCP minimal (default 0-2 servers).
- Never store raw secrets in config files; store env var names only.
- Prefer explicit allowlists for tools.

## 5) Isolation and stop control
- Session isolation is required across channels/users.
- Provide a visible stop action when runs get stuck or loop.

## 6) Handoff format
HANDOFF
Context:
Goal:
DoD:
Files:
Next:
`;
