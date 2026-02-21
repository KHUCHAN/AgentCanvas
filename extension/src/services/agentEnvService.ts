/**
 * agentEnvService.ts
 *
 * Builds a per-agent isolated HOME directory inside the sandbox, containing:
 *   - CLI-specific MCP server config  (only the agent's assigned servers)
 *   - CLI-specific skill files        (only the agent's assigned skills)
 *
 * Sandbox layout (FRAMEWORK.md §3):
 *   <workspace>/.agentcanvas/sandboxes/<runId>/<agentId>/home/
 *     .claude/settings.json          ← Claude MCP
 *     .claude/skills/<name>/SKILL.md ← Claude skills
 *     .codex/config.toml             ← Codex MCP
 *     .agents/skills/<name>/SKILL.md ← Codex skills
 *     .gemini/settings.json          ← Gemini MCP
 *     .gemini/skills/<name>/SKILL.md ← Gemini skills
 *
 * Usage in cliExecutor:
 *   spawn(cmd, args, { env: { ...process.env, HOME: agentHomeDir } })
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseToml } from "@iarna/toml";
import type { CanonicalBackendId, McpServer, Skill } from "../types";
import { exists } from "./pathUtils";

// ─── Public API ───────────────────────────────────────────────────────────────

export async function buildAgentHomeDir(input: {
  agentId: string;
  runId: string;
  workspacePath: string;
  backendFamily: CanonicalBackendId;
  assignedMcpServers: McpServer[];
  assignedSkills: Skill[];
}): Promise<string> {
  const agentHome = join(
    input.workspacePath,
    ".agentcanvas",
    "sandboxes",
    input.runId,
    input.agentId,
    "home"
  );
  await mkdir(agentHome, { recursive: true });

  // MCP config
  const rawEntries = await loadRawMcpEntries(input.assignedMcpServers);
  if (rawEntries.length > 0) {
    await writeMcpConfig(agentHome, input.backendFamily, rawEntries);
  }

  // Skill files
  const enabledSkills = input.assignedSkills.filter((s) => s.enabled && s.path);
  if (enabledSkills.length > 0) {
    await writeSkillFiles(agentHome, input.backendFamily, enabledSkills);
  }

  return agentHome;
}

// ─── MCP entry loader ─────────────────────────────────────────────────────────

interface RawMcpEntry {
  name: string;
  kind: "stdio" | "http";
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  enabledTools?: string[];
}

async function loadRawMcpEntries(servers: McpServer[]): Promise<RawMcpEntry[]> {
  // Group by configLocationPath to minimise file reads
  const byPath = new Map<string, McpServer[]>();
  for (const server of servers) {
    if (!server.enabled) continue;
    const group = byPath.get(server.configLocationPath) ?? [];
    group.push(server);
    byPath.set(server.configLocationPath, group);
  }

  const entries: RawMcpEntry[] = [];

  for (const [configPath, configServers] of byPath.entries()) {
    if (!(await exists(configPath))) continue;

    try {
      const raw = await readFile(configPath, "utf8");

      if (configPath.endsWith(".toml")) {
        // Codex ~/.codex/config.toml  →  [mcp_servers.<name>]
        const parsed = parseToml(raw) as Record<string, unknown>;
        const table = (parsed.mcp_servers ?? {}) as Record<string, unknown>;
        for (const server of configServers) {
          const row = table[server.name] as Record<string, unknown> | undefined;
          if (!row) continue;
          entries.push(toRawEntry(server, row));
        }
      } else if (configPath.endsWith(".json")) {
        // VSCode .vscode/mcp.json  →  { servers: { <name>: { ... } } }
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const table = (parsed.servers ?? {}) as Record<string, unknown>;
        for (const server of configServers) {
          const row = table[server.name] as Record<string, unknown> | undefined;
          if (!row) continue;
          entries.push(toRawEntry(server, row));
        }
      }
    } catch {
      // Discovery is resilient — skip malformed configs
    }
  }

  return entries;
}

function toRawEntry(server: McpServer, row: Record<string, unknown>): RawMcpEntry {
  return {
    name: server.name,
    kind: server.kind,
    command: typeof row.command === "string" ? row.command : undefined,
    args: toStringArray(row.args),
    url: typeof row.url === "string" ? row.url : undefined,
    env: toStringRecord(row.env),
    enabledTools: server.tools
  };
}

// ─── MCP config writers ───────────────────────────────────────────────────────

async function writeMcpConfig(
  agentHome: string,
  backendFamily: CanonicalBackendId,
  entries: RawMcpEntry[]
): Promise<void> {
  if (backendFamily === "claude") {
    await writeClaudeMcpConfig(agentHome, entries);
  } else if (backendFamily === "gemini") {
    await writeGeminiMcpConfig(agentHome, entries);
  } else if (backendFamily === "codex") {
    await writeCodexMcpConfig(agentHome, entries);
  }
  // aider / custom / other: no known MCP config standard → skip
}

// Claude  ~/.claude/settings.json  →  { mcpServers: { name: { command, args, env } } }
async function writeClaudeMcpConfig(agentHome: string, entries: RawMcpEntry[]): Promise<void> {
  const configDir = join(agentHome, ".claude");
  await mkdir(configDir, { recursive: true });

  const mcpServers: Record<string, unknown> = {};
  for (const e of entries) {
    if (e.kind === "stdio" && e.command) {
      mcpServers[e.name] = {
        command: e.command,
        ...(e.args?.length && { args: e.args }),
        ...(e.env && { env: e.env })
      };
    } else if (e.kind === "http" && e.url) {
      mcpServers[e.name] = {
        url: e.url,
        ...(e.env && { env: e.env })
      };
    }
  }

  // Preserve any existing settings (e.g., user prefs) if the file already exists
  let base: Record<string, unknown> = {};
  const settingsPath = join(configDir, "settings.json");
  try {
    base = JSON.parse(await readFile(settingsPath, "utf8")) as Record<string, unknown>;
  } catch { /* new file */ }

  await writeFile(settingsPath, JSON.stringify({ ...base, mcpServers }, null, 2), "utf8");
}

// Gemini  ~/.gemini/settings.json  →  { mcpServers: { name: { command, args, env } } }
async function writeGeminiMcpConfig(agentHome: string, entries: RawMcpEntry[]): Promise<void> {
  const configDir = join(agentHome, ".gemini");
  await mkdir(configDir, { recursive: true });

  const mcpServers: Record<string, unknown> = {};
  for (const e of entries) {
    if (e.kind === "stdio" && e.command) {
      mcpServers[e.name] = {
        command: e.command,
        ...(e.args?.length && { args: e.args }),
        ...(e.env && { env: e.env }),
        ...(e.enabledTools?.length && { includeTools: e.enabledTools })
      };
    } else if (e.kind === "http" && e.url) {
      mcpServers[e.name] = {
        url: e.url,
        type: "http",
        ...(e.env && { env: e.env }),
        ...(e.enabledTools?.length && { includeTools: e.enabledTools })
      };
    }
  }

  let base: Record<string, unknown> = {};
  const settingsPath = join(configDir, "settings.json");
  try {
    base = JSON.parse(await readFile(settingsPath, "utf8")) as Record<string, unknown>;
  } catch { /* new file */ }

  await writeFile(settingsPath, JSON.stringify({ ...base, mcpServers }, null, 2), "utf8");
}

// Codex  ~/.codex/config.toml  →  [mcp_servers.<name>]  command/url/args/env
async function writeCodexMcpConfig(agentHome: string, entries: RawMcpEntry[]): Promise<void> {
  const configDir = join(agentHome, ".codex");
  await mkdir(configDir, { recursive: true });

  const lines: string[] = [];
  for (const e of entries) {
    lines.push(`[mcp_servers.${e.name}]`);
    if (e.command) lines.push(`command = ${JSON.stringify(e.command)}`);
    if (e.url) lines.push(`url = ${JSON.stringify(e.url)}`);
    if (e.args?.length) {
      lines.push(`args = [${e.args.map((a) => JSON.stringify(a)).join(", ")}]`);
    }
    if (e.env && Object.keys(e.env).length > 0) {
      const pairs = Object.entries(e.env)
        .map(([k, v]) => `${k} = ${JSON.stringify(v)}`)
        .join(", ");
      lines.push(`env = {${pairs}}`);
    }
    if (e.enabledTools?.length) {
      lines.push(`enabled_tools = [${e.enabledTools.map((t) => JSON.stringify(t)).join(", ")}]`);
    }
    lines.push("");
  }

  await writeFile(join(configDir, "config.toml"), lines.join("\n"), "utf8");
}

// ─── Skill file writer ────────────────────────────────────────────────────────

async function writeSkillFiles(
  agentHome: string,
  backendFamily: CanonicalBackendId,
  skills: Skill[]
): Promise<void> {
  let skillsBase: string;
  if (backendFamily === "claude") {
    skillsBase = join(agentHome, ".claude", "skills");
  } else if (backendFamily === "gemini") {
    skillsBase = join(agentHome, ".gemini", "skills");
  } else if (backendFamily === "codex") {
    skillsBase = join(agentHome, ".agents", "skills");
  } else {
    return;
  }

  for (const skill of skills) {
    try {
      const content = await readFile(skill.path, "utf8");
      const destDir = join(skillsBase, skill.folderName);
      await mkdir(destDir, { recursive: true });
      await writeFile(join(destDir, "SKILL.md"), content, "utf8");
    } catch {
      // Skip unreadable skill files
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const arr = value.filter((v): v is string => typeof v === "string");
  return arr.length > 0 ? arr : undefined;
}

function toStringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string") result[k] = v;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}
