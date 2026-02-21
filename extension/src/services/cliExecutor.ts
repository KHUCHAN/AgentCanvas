import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import type { AgentRuntime, CliBackend } from "../types";

const MAX_STDOUT_BYTES = 16 * 1024 * 1024;
const MAX_STDERR_BYTES = 4 * 1024 * 1024;

type CliRuntime = Extract<AgentRuntime, { kind: "cli" }>;
type CliFamily = "claude" | "codex" | "gemini" | "aider" | "custom" | "other";
type StreamFormat = "plain" | "jsonl";

export interface CliExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  durationMs: number;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    cacheRead?: number;
    cacheWrite?: number;
    model?: string;
  };
}

export interface CliStreamEvent {
  backendId: CliBackend["id"];
  eventType: "text" | "action" | "usage" | "raw";
  chunk?: string;
  data?: unknown;
}

export type CliInvocation = {
  command: string;
  args: string[];
  stdinPrompt: boolean;
  streamFormat: StreamFormat;
};

export async function executeCliPrompt(input: {
  backend: CliBackend;
  prompt: string;
  workspacePath: string;
  modelId?: string;
  runtime?: CliRuntime;
  systemPrompt?: string;
  timeoutMs?: number;
  /** Per-agent isolated HOME directory built by agentEnvService. When set,
   *  overrides the process HOME so the CLI only sees this agent's MCP servers
   *  and skill files. */
  agentHomeDir?: string;
  onStreamEvent?: (event: CliStreamEvent) => void;
}): Promise<CliExecutionResult> {
  const startedAt = Date.now();
  const timeoutMs = input.timeoutMs ?? 300_000;
  const cwd = input.workspacePath.trim();
  await mkdir(cwd, { recursive: true });
  const prompt = sanitizePrompt(input.prompt);
  const invocation = buildCliInvocation({
    backend: input.backend,
    prompt,
    modelId: input.modelId,
    runtime: input.runtime,
    systemPrompt: input.systemPrompt
  });

  return await new Promise<CliExecutionResult>((resolve) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd,
      env: {
        ...process.env,
        ...input.backend.env,
        NO_COLOR: "1",
        ...(input.agentHomeDir ? { HOME: input.agentHomeDir } : {})
      },
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let finished = false;

    let lineBuffer = "";
    const parsedTextParts: string[] = [];
    let parsedUsage: CliExecutionResult["usage"];

    const done = (result: CliExecutionResult) => {
      if (finished) {
        return;
      }
      finished = true;
      resolve(result);
    };

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      done({
        success: false,
        output: "",
        error: `Timed out after ${Math.round(timeoutMs / 1000)}s`,
        durationMs: Date.now() - startedAt,
        usage: finalizeUsage({
          backendId: input.backend.id,
          parsedUsage,
          stdout,
          stderr,
          modelHint: input.modelId
        })
      });
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      if (stdout.length > MAX_STDOUT_BYTES) {
        stdout = stdout.slice(-MAX_STDOUT_BYTES);
      }

      if (invocation.streamFormat !== "jsonl") {
        return;
      }

      lineBuffer += chunk;
      const lines = lineBuffer.split(/\r?\n/);
      lineBuffer = lines.pop() ?? "";

      for (const line of lines) {
        const parsed = parseStructuredEvent(line, input.backend.id);
        if (!parsed) {
          continue;
        }
        if (parsed.text) {
          parsedTextParts.push(parsed.text);
          input.onStreamEvent?.({
            backendId: input.backend.id,
            eventType: "text",
            chunk: parsed.text,
            data: parsed.raw
          });
        } else if (parsed.action) {
          input.onStreamEvent?.({
            backendId: input.backend.id,
            eventType: "action",
            data: parsed.action
          });
        } else {
          input.onStreamEvent?.({
            backendId: input.backend.id,
            eventType: "raw",
            data: parsed.raw
          });
        }

        if (parsed.usage) {
          parsedUsage = mergeUsage(parsedUsage, parsed.usage);
          input.onStreamEvent?.({
            backendId: input.backend.id,
            eventType: "usage",
            data: parsed.usage
          });
        }
      }
    });

    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
      if (stderr.length > MAX_STDERR_BYTES) {
        stderr = stderr.slice(-MAX_STDERR_BYTES);
      }
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      done({
        success: false,
        output: "",
        error: `${error.message} (command: ${invocation.command}, cwd: ${cwd})`,
        durationMs: Date.now() - startedAt,
        usage: finalizeUsage({
          backendId: input.backend.id,
          parsedUsage,
          stdout,
          stderr,
          modelHint: input.modelId
        })
      });
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      if (invocation.streamFormat === "jsonl" && lineBuffer.trim().length > 0) {
        const parsed = parseStructuredEvent(lineBuffer, input.backend.id);
        if (parsed?.text) {
          parsedTextParts.push(parsed.text);
        }
        if (parsed?.usage) {
          parsedUsage = mergeUsage(parsedUsage, parsed.usage);
        }
      }

      const output =
        invocation.streamFormat === "jsonl" && parsedTextParts.length > 0
          ? parsedTextParts.join("").trim()
          : stdout.trim();

      done({
        success: code === 0,
        output,
        error: code === 0 ? stderr.trim() || undefined : stderr.trim() || `CLI exited with code ${String(code)}`,
        durationMs: Date.now() - startedAt,
        usage: finalizeUsage({
          backendId: input.backend.id,
          parsedUsage,
          stdout,
          stderr,
          modelHint: input.modelId
        })
      });
    });

    if (invocation.stdinPrompt) {
      child.stdin.write(prompt);
      child.stdin.write("\n");
    }
    child.stdin.end();
  });
}

export function buildCliInvocation(input: {
  backend: CliBackend;
  prompt: string;
  modelId?: string;
  runtime?: CliRuntime;
  systemPrompt?: string;
}): CliInvocation {
  const family = normalizeBackendFamily(input.backend.id);
  const prompt = sanitizePrompt(input.prompt);
  const runtime = input.runtime;
  const modelId = input.modelId?.trim() || runtime?.modelId?.trim() || undefined;
  const baseArgs = normalizeBaseArgs(input.backend.args, family);

  if (family === "claude") {
    const args = [...baseArgs];
    if (runtime?.sessionId?.trim()) {
      args.push("--resume", runtime.sessionId.trim());
    }
    args.push("-p", prompt, "--output-format", "stream-json", "--include-partial-messages", "--verbose");
    if (modelId) {
      args.push("--model", modelId);
    }
    if (runtime?.promptMode === "replace" && input.systemPrompt?.trim()) {
      args.push("--system-prompt", input.systemPrompt.trim());
    } else if (input.systemPrompt?.trim()) {
      args.push("--append-system-prompt", input.systemPrompt.trim());
    }
    if (runtime?.maxTurns && runtime.maxTurns > 0) {
      args.push("--max-turns", String(Math.round(runtime.maxTurns)));
    }
    if (runtime?.maxBudgetUsd && runtime.maxBudgetUsd > 0) {
      args.push("--max-budget-usd", String(runtime.maxBudgetUsd));
    }
    if (runtime?.permissionMode === "plan") {
      args.push("--permission-mode", "plan");
    } else if (runtime?.permissionMode === "skip") {
      args.push("--dangerously-skip-permissions");
    }
    const allowedTools = (runtime?.allowedTools ?? []).map((tool) => tool.trim()).filter(Boolean);
    if (allowedTools.length > 0) {
      args.push("--allowedTools", ...allowedTools);
    }
    if (runtime?.useWorktree) {
      args.push("-w", runtime.worktreeName?.trim() || "agentcanvas");
    }
    return {
      command: input.backend.command,
      args,
      stdinPrompt: false,
      streamFormat: "jsonl"
    };
  }

  if (family === "codex") {
    const args = [...baseArgs, "exec"];
    if (runtime?.sessionId?.trim()) {
      args.push("resume", runtime.sessionId.trim());
    }
    args.push("--json");
    // Skip git repo trust check so Codex can run from any workspace directory.
    args.push("--skip-git-repo-check");
    if (modelId) {
      args.push("--model", modelId);
    }

    const codexApproval =
      runtime?.codexApproval ??
      (runtime?.permissionMode === "skip" ? "never" : undefined);
    const codexSandbox =
      runtime?.codexSandbox ??
      (runtime?.permissionMode === "skip" ? "danger-full-access" : undefined);
    if (codexApproval) {
      args.push("--ask-for-approval", codexApproval);
    }
    if (codexSandbox) {
      args.push("--sandbox", codexSandbox);
    }

    const additionalDirs = (runtime?.additionalDirs ?? []).map((dir) => dir.trim()).filter(Boolean);
    for (const dir of additionalDirs) {
      args.push("--add-dir", dir);
    }
    if (runtime?.enableWebSearch) {
      args.push("--search");
    }

    args.push(prompt);
    return {
      command: input.backend.command,
      args,
      stdinPrompt: false,
      streamFormat: "jsonl"
    };
  }

  if (family === "gemini") {
    const args = [...baseArgs, ...resolveModelArgs(family, modelId)];
    const approvalMode = runtime?.geminiApprovalMode?.trim();
    if (approvalMode && approvalMode !== "default") {
      args.push("--approval-mode", approvalMode);
    }
    if (runtime?.geminiUseSandbox) {
      args.push("--sandbox");
    }
    if (runtime?.enableWebSearch) {
      if (approvalMode !== "yolo") {
        args.push("--yolo");
      }
      args.push("--google-search");
    }
    // Gemini CLI requires explicit prompt flag in headless mode.
    args.push("--prompt", prompt);
    return {
      command: input.backend.command,
      args,
      stdinPrompt: false,
      streamFormat: "plain"
    };
  }

  const args = [...baseArgs, ...resolveModelArgs(family, modelId)];
  if (input.backend.stdinPrompt) {
    return {
      command: input.backend.command,
      args,
      stdinPrompt: true,
      streamFormat: "plain"
    };
  }
  args.push(...resolvePromptArgs(baseArgs, prompt));
  return {
    command: input.backend.command,
    args,
    stdinPrompt: false,
    streamFormat: "plain"
  };
}

function normalizeBackendFamily(backendId: CliBackend["id"]): CliFamily {
  if (backendId === "claude" || backendId === "claude-code") {
    return "claude";
  }
  if (backendId === "codex" || backendId === "codex-cli") {
    return "codex";
  }
  if (backendId === "gemini" || backendId === "gemini-cli") {
    return "gemini";
  }
  if (backendId === "aider") {
    return "aider";
  }
  if (backendId === "custom") {
    return "custom";
  }
  return "other";
}

function normalizeBaseArgs(args: string[] | undefined, family: CliFamily): string[] {
  if (!args || args.length === 0) {
    return [];
  }
  if (family === "claude") {
    const normalized: string[] = [];
    for (let index = 0; index < args.length; index += 1) {
      const current = args[index];
      const lowered = current.trim().toLowerCase();
      if (lowered === "--print" || lowered === "-p" || lowered.startsWith("--print=")) {
        // Legacy configs may include prompt value right after -p/--print.
        const next = args[index + 1];
        if (next && !next.startsWith("-")) {
          index += 1;
        }
        continue;
      }
      normalized.push(current);
    }
    return normalized;
  }
  if (family === "codex") {
    return args.filter(
      (arg) => arg !== "exec" && arg !== "-" && arg !== "--json" && arg !== "--skip-git-repo-check"
    );
  }
  if (family === "aider") {
    return args.filter((arg) => arg !== "--message" && arg !== "--prompt" && arg !== "-m");
  }
  if (family === "gemini") {
    const normalized: string[] = [];
    for (let index = 0; index < args.length; index += 1) {
      const current = args[index];
      const lowered = current.trim().toLowerCase();
      if (lowered === "--model" || lowered === "--approval-mode" || lowered === "--prompt" || lowered === "-p") {
        if (!lowered.includes("=")) {
          const next = args[index + 1];
          if (next && !next.startsWith("-")) {
            index += 1;
          }
        }
        continue;
      }
      if (
        lowered.startsWith("--model=") ||
        lowered.startsWith("--approval-mode=") ||
        lowered.startsWith("--prompt=")
      ) {
        continue;
      }
      if (lowered === "--") {
        continue;
      }
      if (lowered === "--yolo" || lowered === "--sandbox" || lowered === "--google-search") {
        continue;
      }
      normalized.push(current);
    }
    return normalized;
  }
  return [...args];
}

function resolveModelArgs(family: CliFamily, modelId: string | undefined): string[] {
  if (!modelId) {
    return [];
  }
  if (family === "claude" || family === "gemini" || family === "codex" || family === "aider" || family === "custom") {
    return ["--model", modelId];
  }
  return [];
}

function resolvePromptArgs(args: string[], prompt: string): string[] {
  if (expectsPromptValueArg(args)) {
    return [prompt];
  }
  return ["--", prompt];
}

function expectsPromptValueArg(args: string[]): boolean {
  return args.some((arg) => {
    const normalized = arg.trim().toLowerCase();
    return normalized === "--message" || normalized === "--prompt" || normalized === "-m";
  });
}

function parseStructuredEvent(
  line: string,
  backendId: CliBackend["id"]
): {
  raw: unknown;
  text?: string;
  action?: unknown;
  usage?: CliExecutionResult["usage"];
} | undefined {
  const trimmed = line.trim();
  if (!trimmed) {
    return undefined;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(trimmed) as unknown;
  } catch {
    return undefined;
  }

  if (!isObject(raw)) {
    return { raw };
  }

  const text = extractTextFromStructuredEvent(raw);
  const type = typeof raw.type === "string" ? raw.type.toLowerCase() : "";
  const usage = extractUsageFromStructuredEvent(raw, backendId);
  const action = type.includes("action") || type.includes("tool") || type.includes("command")
    ? raw
    : undefined;

  return {
    raw,
    text: text?.replace(/\r/g, ""),
    action,
    usage
  };
}

function extractTextFromStructuredEvent(raw: Record<string, unknown>): string | undefined {
  const directCandidates = [
    asString(raw.delta),
    asString(raw.text),
    asString(raw.completion),
    asString(raw.content)
  ].filter(Boolean) as string[];
  if (directCandidates.length > 0) {
    return directCandidates.join("");
  }

  const deltaText = asNestedString(raw, ["delta", "text"])
    ?? asNestedString(raw, ["message", "delta", "text"])
    ?? asNestedString(raw, ["response", "delta", "text"]);
  if (deltaText) {
    return deltaText;
  }

  const contentText = extractContentText(raw.content)
    ?? extractContentText(raw.message)
    ?? extractContentText(raw.result)
    ?? extractContentText(raw.response);
  if (contentText) {
    return contentText;
  }

  if (isObject(raw.message)) {
    return extractTextFromStructuredEvent(raw.message);
  }
  if (isObject(raw.response)) {
    return extractTextFromStructuredEvent(raw.response);
  }

  return undefined;
}

function extractContentText(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    const parts: string[] = [];
    for (const entry of value) {
      if (typeof entry === "string") {
        parts.push(entry);
        continue;
      }
      if (!isObject(entry)) {
        continue;
      }
      const text =
        asString(entry.text) ??
        asNestedString(entry, ["delta", "text"]) ??
        asNestedString(entry, ["content", "text"]) ??
        asString(entry.value);
      if (text) {
        parts.push(text);
      }
    }
    if (parts.length > 0) {
      return parts.join("");
    }
    return undefined;
  }
  if (!isObject(value)) {
    return undefined;
  }
  return (
    asString(value.text) ??
    asNestedString(value, ["delta", "text"]) ??
    asNestedString(value, ["message", "text"]) ??
    asNestedString(value, ["content", "text"]) ??
    undefined
  );
}

function extractUsageFromStructuredEvent(
  raw: Record<string, unknown>,
  backendId: CliBackend["id"]
): CliExecutionResult["usage"] | undefined {
  const usageSource =
    (isObject(raw.usage) ? raw.usage : undefined) ??
    (isObject(raw.result) && isObject(raw.result.usage) ? raw.result.usage : undefined) ??
    (isObject(raw.response) && isObject(raw.response.usage) ? raw.response.usage : undefined);

  const usageText = JSON.stringify(usageSource ?? raw);
  const numeric = parseUsageNumbers(usageText);
  const model =
    (usageSource ? parseUsageModel(JSON.stringify(usageSource)) : undefined) ??
    parseUsageModel(JSON.stringify(raw)) ??
    inferModelFromBackend(backendId);

  if (
    numeric.inputTokens === undefined &&
    numeric.outputTokens === undefined &&
    numeric.cacheRead === undefined &&
    numeric.cacheWrite === undefined &&
    !model
  ) {
    return undefined;
  }

  return {
    ...numeric,
    model
  };
}

function finalizeUsage(input: {
  backendId: CliBackend["id"];
  parsedUsage: CliExecutionResult["usage"] | undefined;
  stdout: string;
  stderr: string;
  modelHint: string | undefined;
}): CliExecutionResult["usage"] {
  const fallbackUsage = parseUsage(input.backendId, input.stdout, input.stderr, input.modelHint);
  return mergeUsage(fallbackUsage, input.parsedUsage);
}

function mergeUsage(
  base: CliExecutionResult["usage"] | undefined,
  next: CliExecutionResult["usage"] | undefined
): CliExecutionResult["usage"] | undefined {
  if (!base && !next) {
    return undefined;
  }
  return {
    inputTokens: next?.inputTokens ?? base?.inputTokens,
    outputTokens: next?.outputTokens ?? base?.outputTokens,
    cacheRead: next?.cacheRead ?? base?.cacheRead,
    cacheWrite: next?.cacheWrite ?? base?.cacheWrite,
    model: next?.model ?? base?.model
  };
}

function parseUsage(
  backendId: CliBackend["id"],
  stdout: string,
  stderr: string,
  modelHint?: string
): CliExecutionResult["usage"] {
  const merged = `${stderr}\n${stdout}`;
  const numeric = parseUsageNumbers(merged);
  const model =
    parseUsageModel(merged) ??
    modelHint?.trim() ??
    inferModelFromBackend(backendId);

  if (
    numeric.inputTokens === undefined &&
    numeric.outputTokens === undefined &&
    numeric.cacheRead === undefined &&
    numeric.cacheWrite === undefined &&
    !model
  ) {
    return undefined;
  }

  return {
    ...numeric,
    model
  };
}

function inferModelFromBackend(backendId: CliBackend["id"]): string | undefined {
  if (backendId === "claude" || backendId === "claude-code") {
    return "claude-sonnet-4-6";
  }
  if (backendId === "codex" || backendId === "codex-cli") {
    return "gpt-5.3-codex";
  }
  if (backendId === "gemini" || backendId === "gemini-cli") {
    return "gemini-3-flash-preview";
  }
  return undefined;
}

function parseUsageNumbers(text: string): {
  inputTokens?: number;
  outputTokens?: number;
  cacheRead?: number;
  cacheWrite?: number;
} {
  const inputTokens = pickNumber(text, [
    /"input_tokens"\s*:\s*(\d+)/i,
    /"prompt_tokens"\s*:\s*(\d+)/i,
    /"prompt_token_count"\s*:\s*(\d+)/i,
    /"inputTokenCount"\s*:\s*(\d+)/i,
    /"inputTokens"\s*:\s*(\d+)/i,
    /\binput[_\s-]*tokens\b[^0-9]*(\d+)/i
  ]);
  const outputTokens = pickNumber(text, [
    /"output_tokens"\s*:\s*(\d+)/i,
    /"completion_tokens"\s*:\s*(\d+)/i,
    /"candidates_token_count"\s*:\s*(\d+)/i,
    /"outputTokenCount"\s*:\s*(\d+)/i,
    /"outputTokens"\s*:\s*(\d+)/i,
    /\boutput[_\s-]*tokens\b[^0-9]*(\d+)/i
  ]);
  const cacheRead = pickNumber(text, [
    /"cache_read_input_tokens"\s*:\s*(\d+)/i,
    /"cache_read_tokens"\s*:\s*(\d+)/i,
    /"cached_content_token_count"\s*:\s*(\d+)/i,
    /"cacheRead"\s*:\s*(\d+)/i,
    /\bcache[_\s-]*read[_\s-]*tokens\b[^0-9]*(\d+)/i
  ]);
  const cacheWrite = pickNumber(text, [
    /"cache_creation_input_tokens"\s*:\s*(\d+)/i,
    /"cache_write_tokens"\s*:\s*(\d+)/i,
    /"cacheWrite"\s*:\s*(\d+)/i,
    /\bcache[_\s-]*(write|creation)[_\s-]*tokens\b[^0-9]*(\d+)/i
  ]);

  return {
    inputTokens,
    outputTokens,
    cacheRead,
    cacheWrite
  };
}

function parseUsageModel(text: string): string | undefined {
  const match =
    /"model"\s*:\s*"([^"]+)"/i.exec(text) ??
    /\bmodel[_\s-]*id\b[^a-zA-Z0-9._-]*([a-zA-Z0-9._-]+)/i.exec(text);
  const model = match?.[1]?.trim();
  return model || undefined;
}

function pickNumber(text: string, patterns: RegExp[]): number | undefined {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) {
      continue;
    }
    const candidates = match.slice(1).filter(Boolean);
    for (const candidate of candidates) {
      const number = Number(candidate);
      if (Number.isFinite(number)) {
        return number;
      }
    }
  }
  return undefined;
}

function sanitizePrompt(value: string): string {
  return value.replace(/\0/g, "");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  return value;
}

function asNestedString(value: unknown, path: string[]): string | undefined {
  let current: unknown = value;
  for (const key of path) {
    if (!isObject(current)) {
      return undefined;
    }
    current = current[key];
  }
  return asString(current);
}
