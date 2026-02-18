import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parse as parseToml } from "@iarna/toml";
import type { McpServer } from "../types";
import { exists } from "./pathUtils";

export async function discoverMcpServers(input: {
  workspacePath: string;
  homeDir: string;
  codexAgentId: string;
  vscodeAgentId: string;
}): Promise<McpServer[]> {
  const codexServers = await discoverCodexMcpServers({
    workspacePath: input.workspacePath,
    homeDir: input.homeDir,
    ownerAgentId: input.codexAgentId
  });
  const vscodeServers = await discoverVsCodeMcpServers({
    workspacePath: input.workspacePath,
    ownerAgentId: input.vscodeAgentId
  });
  return [...codexServers, ...vscodeServers];
}

async function discoverCodexMcpServers(input: {
  workspacePath: string;
  homeDir: string;
  ownerAgentId: string;
}): Promise<McpServer[]> {
  const codexHome = resolve(process.env.CODEX_HOME || join(input.homeDir, ".codex"));
  const candidatePaths = [
    join(codexHome, "config.toml"),
    join(input.workspacePath, ".codex", "config.toml")
  ];

  const servers: McpServer[] = [];
  for (const configPath of candidatePaths) {
    if (!(await exists(configPath))) {
      continue;
    }
    try {
      const raw = await readFile(configPath, "utf8");
      const parsed = parseToml(raw) as Record<string, unknown>;
      const table = parsed.mcp_servers;
      if (!table || typeof table !== "object") {
        continue;
      }

      for (const [name, value] of Object.entries(table as Record<string, unknown>)) {
        if (!value || typeof value !== "object") {
          continue;
        }
        const row = value as Record<string, unknown>;
        const url = toStringOrUndefined(row.url);
        const kind: "stdio" | "http" = url ? "http" : "stdio";
        const enabled = typeof row.enabled === "boolean" ? row.enabled : true;
        const tools = toStringArray(row.enabled_tools);

        servers.push({
          id: `mcp:codex:${name}:${configPath}`,
          ownerAgentId: input.ownerAgentId,
          providerId: "codex",
          name,
          kind,
          configLocationPath: configPath,
          enabled,
          tools: tools.length > 0 ? tools : undefined
        });
      }
    } catch {
      // Keep discovery resilient; ignore malformed config.
    }
  }

  return servers;
}

async function discoverVsCodeMcpServers(input: {
  workspacePath: string;
  ownerAgentId: string;
}): Promise<McpServer[]> {
  const configPath = join(input.workspacePath, ".vscode", "mcp.json");
  if (!(await exists(configPath))) {
    return [];
  }

  try {
    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const servers = parsed.servers;
    if (!servers || typeof servers !== "object") {
      return [];
    }

    const result: McpServer[] = [];
    for (const [name, value] of Object.entries(servers as Record<string, unknown>)) {
      if (!value || typeof value !== "object") {
        continue;
      }
      const row = value as Record<string, unknown>;
      const type = toStringOrUndefined(row.type);
      const kind: "stdio" | "http" = type === "http" ? "http" : "stdio";
      const enabled = row.disabled === true ? false : true;

      result.push({
        id: `mcp:vscode:${name}:${configPath}`,
        ownerAgentId: input.ownerAgentId,
        providerId: "vscode",
        name,
        kind,
        configLocationPath: configPath,
        enabled
      });
    }
    return result;
  } catch {
    return [];
  }
}

function toStringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}
