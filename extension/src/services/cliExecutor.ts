import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import type { CliBackend } from "../types";

const MAX_STDOUT_BYTES = 16 * 1024 * 1024;
const MAX_STDERR_BYTES = 4 * 1024 * 1024;

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

export async function executeCliPrompt(input: {
  backend: CliBackend;
  prompt: string;
  workspacePath: string;
  modelId?: string;
  timeoutMs?: number;
}): Promise<CliExecutionResult> {
  const startedAt = Date.now();
  const timeoutMs = input.timeoutMs ?? 120_000;
  const cwd = input.workspacePath.trim();
  await mkdir(cwd, { recursive: true });
  const prompt = sanitizePrompt(input.prompt);

  const args = [
    ...input.backend.args,
    ...resolveModelArgs(input.backend, input.modelId)
  ];
  if (!input.backend.stdinPrompt) {
    args.push(...resolvePromptArgs(input.backend, prompt));
  }

  return await new Promise<CliExecutionResult>((resolve) => {
    const child = spawn(input.backend.command, args, {
      cwd,
      env: { ...process.env, ...input.backend.env, NO_COLOR: "1" },
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let finished = false;

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
        usage: parseUsage(input.backend.id, stdout, stderr, input.modelId)
      });
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      if (stdout.length > MAX_STDOUT_BYTES) {
        stdout = stdout.slice(-MAX_STDOUT_BYTES);
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
        error: `${error.message} (command: ${input.backend.command}, cwd: ${cwd})`,
        durationMs: Date.now() - startedAt,
        usage: parseUsage(input.backend.id, stdout, stderr, input.modelId)
      });
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        done({
          success: true,
          output: stdout.trim(),
          error: stderr.trim() || undefined,
          durationMs: Date.now() - startedAt,
          usage: parseUsage(input.backend.id, stdout, stderr, input.modelId)
        });
      } else {
        done({
          success: false,
          output: stdout.trim(),
          error: stderr.trim() || `CLI exited with code ${String(code)}`,
          durationMs: Date.now() - startedAt,
          usage: parseUsage(input.backend.id, stdout, stderr, input.modelId)
        });
      }
    });

    if (input.backend.stdinPrompt) {
      child.stdin.write(prompt);
      child.stdin.write("\n");
    }
    child.stdin.end();
  });
}

function resolveModelArgs(
  backend: CliBackend,
  modelId: string | undefined
): string[] {
  const model = normalizeModelForBackend(backend.id, modelId);
  if (!model) {
    return [];
  }
  switch (backend.id) {
    case "claude":
    case "claude-code":
    case "gemini":
    case "gemini-cli":
    case "codex":
    case "codex-cli":
    case "aider":
      return ["--model", model];
    default:
      return [];
  }
}

function normalizeModelForBackend(
  backendId: CliBackend["id"],
  modelId: string | undefined
): string | undefined {
  const raw = modelId?.trim();
  if (!raw) {
    return undefined;
  }
  const lower = raw.toLowerCase();

  if (backendId === "codex" || backendId === "codex-cli") {
    if (isOpenAiModel(lower)) {
      return raw;
    }
    return undefined;
  }

  if (backendId === "claude" || backendId === "claude-code") {
    if (lower.startsWith("claude-")) {
      return raw;
    }
    if (lower === "sonnet" || lower === "haiku" || lower === "opus") {
      return raw;
    }
    if (lower.startsWith("sonnet-")) {
      return "sonnet";
    }
    if (lower.startsWith("haiku-")) {
      return "haiku";
    }
    if (lower.startsWith("opus-")) {
      return "opus";
    }
    return undefined;
  }

  if (backendId === "gemini" || backendId === "gemini-cli") {
    if (lower.includes("gemini")) {
      return raw;
    }
    return undefined;
  }

  return raw;
}

function isOpenAiModel(model: string): boolean {
  return (
    model.startsWith("gpt-") ||
    model.startsWith("o1") ||
    model.startsWith("o3") ||
    model.startsWith("o4") ||
    model.includes("codex")
  );
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
    (backendId === "claude" || backendId === "claude-code"
      ? "sonnet-4.5"
      : undefined);

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

function parseUsageNumbers(text: string): {
  inputTokens?: number;
  outputTokens?: number;
  cacheRead?: number;
  cacheWrite?: number;
} {
  const inputTokens = pickNumber(text, [
    /"input_tokens"\s*:\s*(\d+)/i,
    /"prompt_tokens"\s*:\s*(\d+)/i,
    /\binput[_\s-]*tokens\b[^0-9]*(\d+)/i
  ]);
  const outputTokens = pickNumber(text, [
    /"output_tokens"\s*:\s*(\d+)/i,
    /"completion_tokens"\s*:\s*(\d+)/i,
    /\boutput[_\s-]*tokens\b[^0-9]*(\d+)/i
  ]);
  const cacheRead = pickNumber(text, [
    /"cache_read_input_tokens"\s*:\s*(\d+)/i,
    /"cache_read_tokens"\s*:\s*(\d+)/i,
    /\bcache[_\s-]*read[_\s-]*tokens\b[^0-9]*(\d+)/i
  ]);
  const cacheWrite = pickNumber(text, [
    /"cache_creation_input_tokens"\s*:\s*(\d+)/i,
    /"cache_write_tokens"\s*:\s*(\d+)/i,
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
  const match = /"model"\s*:\s*"([^"]+)"/i.exec(text);
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

function resolvePromptArgs(backend: CliBackend, prompt: string): string[] {
  if (expectsPromptValueArg(backend.args)) {
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
