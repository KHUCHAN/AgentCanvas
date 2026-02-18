import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { CliBackend } from "../types";

const execFileAsync = promisify(execFile);

const DEFAULT_BACKENDS: Array<Pick<CliBackend, "id" | "displayName" | "command" | "args" | "stdinPrompt">> = [
  {
    id: "claude-code",
    displayName: "Claude Code",
    command: "claude",
    args: ["--print"],
    stdinPrompt: true
  },
  {
    id: "gemini-cli",
    displayName: "Gemini CLI",
    command: "gemini",
    args: [],
    stdinPrompt: true
  },
  {
    id: "codex-cli",
    displayName: "Codex CLI",
    command: "codex",
    args: ["--quiet"],
    stdinPrompt: true
  },
  {
    id: "aider",
    displayName: "Aider",
    command: "aider",
    args: ["--message"],
    stdinPrompt: false
  }
];

export async function detectAllCliBackends(input?: {
  customCliCommand?: string;
  customCliArgs?: string[];
}): Promise<CliBackend[]> {
  const detected: CliBackend[] = [];

  for (const preset of DEFAULT_BACKENDS) {
    const available = await detectCliCommand(preset.command);
    detected.push({
      ...preset,
      available,
      version: available ? await resolveVersion(preset.command) : undefined
    });
  }

  const custom = buildCustomBackend(input?.customCliCommand, input?.customCliArgs);
  if (custom) {
    const available = await detectCliCommand(custom.command);
    detected.push({
      ...custom,
      available,
      version: available ? await resolveVersion(custom.command) : undefined
    });
  }

  const auto: CliBackend = {
    id: "auto",
    displayName: "Auto (best available)",
    command: "",
    args: [],
    available: detected.some((item) => item.available),
    stdinPrompt: true
  };

  return [auto, ...detected];
}

export function pickPromptBackend(backends: CliBackend[], backendId: CliBackend["id"]): CliBackend {
  if (backendId === "auto") {
    const preferred = backends.find((backend) =>
      backend.available && backend.id !== "auto"
    );
    if (preferred) {
      return preferred;
    }
    throw new Error("No available AI CLI backend was found. Install Claude Code, Gemini CLI, Codex CLI, Aider, or configure custom CLI.");
  }

  const backend = backends.find((item) => item.id === backendId);
  if (!backend) {
    throw new Error(`Unknown CLI backend: ${backendId}`);
  }
  if (!backend.available) {
    throw new Error(`CLI backend is not available: ${backend.displayName}`);
  }
  return backend;
}

async function detectCliCommand(command: string): Promise<boolean> {
  if (!command) {
    return false;
  }

  if (isLikelyPath(command)) {
    try {
      await access(command, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

  try {
    const locator = process.platform === "win32" ? "where" : "which";
    await execFileAsync(locator, [command], { timeout: 4_000 });
    return true;
  } catch {
    return false;
  }
}

async function resolveVersion(command: string): Promise<string | undefined> {
  try {
    const { stdout, stderr } = await execFileAsync(command, ["--version"], {
      timeout: 5_000,
      maxBuffer: 256 * 1024,
      env: { ...process.env, NO_COLOR: "1" }
    });
    const merged = `${stdout}\n${stderr}`.trim();
    const line = merged.split(/\r?\n/).find((item) => item.trim().length > 0);
    return line?.trim();
  } catch {
    return undefined;
  }
}

function buildCustomBackend(customCliCommand?: string, customCliArgs?: string[]): CliBackend | undefined {
  const raw = customCliCommand?.trim();
  if (!raw) {
    return undefined;
  }

  const parsed = splitCommand(raw);
  if (parsed.length === 0) {
    return undefined;
  }

  const command = parsed[0];
  const inlineArgs = parsed.slice(1);
  const args = [...inlineArgs, ...(customCliArgs ?? [])].filter((item) => item.trim().length > 0);

  return {
    id: "custom",
    displayName: "Custom CLI",
    command,
    args,
    available: false,
    stdinPrompt: true
  };
}

function splitCommand(value: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | undefined;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (quote) {
      if (char === quote) {
        quote = undefined;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

function isLikelyPath(command: string): boolean {
  return command.includes("/") || command.includes("\\") || command.startsWith(".");
}
