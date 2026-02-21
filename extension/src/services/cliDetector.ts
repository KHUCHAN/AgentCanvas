import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { promisify } from "node:util";
import type {
  BackendUsageSummary,
  CliBackend,
  CliBackendOverride,
  CliBackendOverrides
} from "../types";
import { executeCliPrompt } from "./cliExecutor";

const execFileAsync = promisify(execFile);

const LEGACY_TO_CANONICAL: Partial<Record<CliBackend["id"], CliBackend["id"]>> = {
  "claude-code": "claude",
  "gemini-cli": "gemini",
  "codex-cli": "codex"
};

const CANONICAL_TO_LEGACY: Partial<Record<CliBackend["id"], CliBackend["id"]>> = {
  claude: "claude-code",
  gemini: "gemini-cli",
  codex: "codex-cli"
};

const DEFAULT_BACKENDS: Array<
  Pick<CliBackend, "id" | "displayName" | "command" | "args" | "stdinPrompt">
> = [
  {
    id: "claude",
    displayName: "Claude Code",
    command: "claude",
    args: [],
    stdinPrompt: false
  },
  {
    id: "gemini",
    displayName: "Gemini CLI",
    command: "gemini",
    args: [],
    stdinPrompt: false
  },
  {
    id: "codex",
    displayName: "Codex CLI",
    command: "codex",
    args: [],
    stdinPrompt: false
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
  backendOverrides?: CliBackendOverrides;
}): Promise<CliBackend[]> {
  const detected: CliBackend[] = [];

  for (const preset of DEFAULT_BACKENDS) {
    const override = resolveBackendOverride(
      input?.backendOverrides,
      preset.id as Exclude<CliBackend["id"], "auto">
    );
    const resolvedBase = applyBackendOverride(
      preset,
      override
    );
    const resolved = normalizeBackendForCompatibility(resolvedBase);
    const available = await detectCliCommand(resolved.command);
    detected.push({
      ...resolved,
      available,
      version: available ? await resolveVersion(resolved.command) : undefined
    });
  }

  const custom = buildCustomBackend(
    input?.customCliCommand,
    input?.customCliArgs,
    input?.backendOverrides?.custom
  );
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

export type BackendTestResult = {
  backendId: CliBackend["id"];
  ok: boolean;
  durationMs: number;
  model?: string;
  message: string;
  outputPreview?: string;
};

export async function testBackend(input: {
  backends: CliBackend[];
  backendId: CliBackend["id"];
  workspacePath: string;
  timeoutMs?: number;
}): Promise<BackendTestResult> {
  const startedAt = Date.now();
  try {
    const backend = pickPromptBackend(input.backends, input.backendId);
    const result = await executeCliPrompt({
      backend,
      prompt: "Hello. Respond with your model name only.",
      workspacePath: input.workspacePath,
      timeoutMs: input.timeoutMs ?? 30_000
    });
    if (!result.success) {
      return {
        backendId: backend.id,
        ok: false,
        durationMs: Date.now() - startedAt,
        message: result.error || "Backend test failed"
      };
    }
    const outputLine = result.output.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim();
    return {
      backendId: backend.id,
      ok: true,
      durationMs: Date.now() - startedAt,
      model: result.usage?.model || outputLine,
      message: "Backend is operational",
      outputPreview: outputLine
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      backendId: normalizeBackendId(input.backendId),
      ok: false,
      durationMs: Date.now() - startedAt,
      message: detail
    };
  }
}

export function pickPromptBackend(
  backends: CliBackend[],
  backendId: CliBackend["id"],
  usageSummaries?: BackendUsageSummary[]
): CliBackend {
  const normalizedBackendId = normalizeBackendId(backendId);
  if (backendId === "auto") {
    if (usageSummaries && usageSummaries.length > 0) {
      const available = backends.filter((backend) => backend.available && backend.id !== "auto");
      const byCanonicalId = new Map(
        usageSummaries.map((summary) => [summary.backendId, summary] as const)
      );
      const ranked = [...available].sort((left, right) => {
        const leftSummary = byCanonicalId.get(normalizeBackendId(left.id) as "claude" | "codex" | "gemini" | "aider" | "custom");
        const rightSummary = byCanonicalId.get(normalizeBackendId(right.id) as "claude" | "codex" | "gemini" | "aider" | "custom");
        const leftScore = leftSummary?.availabilityScore ?? 1;
        const rightScore = rightSummary?.availabilityScore ?? 1;
        return rightScore - leftScore;
      });
      if (ranked[0]) {
        return ranked[0];
      }
    }
    const preferred = backends.find((backend) => backend.available && backend.id !== "auto");
    if (preferred) {
      return preferred;
    }
    throw new Error(
      "No available AI CLI backend was found. Install Claude Code, Gemini CLI, Codex CLI, Aider, or configure custom CLI."
    );
  }

  const backend = backends.find((item) => item.id === normalizedBackendId);
  if (!backend) {
    throw new Error(`Unknown CLI backend: ${normalizedBackendId}`);
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

function buildCustomBackend(
  customCliCommand?: string,
  customCliArgs?: string[],
  override?: CliBackendOverride
): CliBackend | undefined {
  const raw = customCliCommand?.trim() || override?.command?.trim();
  if (!raw) {
    return undefined;
  }

  const parsed = splitCommand(raw);
  if (parsed.length === 0) {
    return undefined;
  }

  const parsedCommand = parsed[0];
  const parsedArgs = parsed.slice(1);
  const args = (override?.args ?? [...parsedArgs, ...(customCliArgs ?? [])]).filter(
    (item) => item.trim().length > 0
  );

  return {
    id: "custom",
    displayName: override?.displayName?.trim() || "Custom CLI",
    command: override?.command?.trim() || parsedCommand,
    args,
    env: override?.env,
    available: false,
    stdinPrompt: override?.stdinPrompt ?? true
  };
}

function applyBackendOverride(
  base: Pick<CliBackend, "id" | "displayName" | "command" | "args" | "stdinPrompt" | "env">,
  override?: CliBackendOverride
): Pick<CliBackend, "id" | "displayName" | "command" | "args" | "stdinPrompt" | "env"> {
  if (!override) {
    return base;
  }
  return {
    ...base,
    displayName: override.displayName?.trim() || base.displayName,
    command: override.command?.trim() || base.command,
    args: override.args && override.args.length > 0 ? override.args : base.args,
    env: override.env ?? base.env,
    stdinPrompt: override.stdinPrompt ?? base.stdinPrompt
  };
}

function normalizeBackendForCompatibility(
  backend: Pick<CliBackend, "id" | "displayName" | "command" | "args" | "stdinPrompt" | "env">
): Pick<CliBackend, "id" | "displayName" | "command" | "args" | "stdinPrompt" | "env"> {
  if (backend.id !== "codex" && backend.id !== "codex-cli") {
    return backend;
  }

  const filteredArgs = backend.args.filter((arg) => arg !== "--quiet");
  const normalizedArgs = filteredArgs.length > 0 ? filteredArgs : ["exec", "-"];
  return {
    ...backend,
    args: normalizedArgs,
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

    if (char === "'" || char === "\"") {
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

function normalizeBackendId(backendId: Exclude<CliBackend["id"], "auto">): Exclude<CliBackend["id"], "auto">;
function normalizeBackendId(backendId: CliBackend["id"]): CliBackend["id"];
function normalizeBackendId(backendId: CliBackend["id"]): CliBackend["id"] {
  return LEGACY_TO_CANONICAL[backendId] ?? backendId;
}

function resolveBackendOverride(
  overrides: CliBackendOverrides | undefined,
  backendId: Exclude<CliBackend["id"], "auto">
): CliBackendOverride | undefined {
  const canonical = normalizeBackendId(backendId) as Exclude<CliBackend["id"], "auto">;
  const legacy = CANONICAL_TO_LEGACY[canonical] as Exclude<CliBackend["id"], "auto"> | undefined;
  return overrides?.[canonical] ?? (legacy ? overrides?.[legacy] : undefined);
}
