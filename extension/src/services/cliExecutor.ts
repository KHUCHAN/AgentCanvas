import { spawn } from "node:child_process";
import type { CliBackend } from "../types";

export interface CliExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  durationMs: number;
}

export async function executeCliPrompt(input: {
  backend: CliBackend;
  prompt: string;
  workspacePath: string;
  timeoutMs?: number;
}): Promise<CliExecutionResult> {
  const startedAt = Date.now();
  const timeoutMs = input.timeoutMs ?? 120_000;

  const args = [...input.backend.args];
  if (!input.backend.stdinPrompt) {
    args.push(input.prompt);
  }

  return await new Promise<CliExecutionResult>((resolve) => {
    const child = spawn(input.backend.command, args, {
      cwd: input.workspacePath,
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
        durationMs: Date.now() - startedAt
      });
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      if (stdout.length > 1024 * 1024) {
        stdout = stdout.slice(-1024 * 1024);
      }
    });

    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
      if (stderr.length > 512 * 1024) {
        stderr = stderr.slice(-512 * 1024);
      }
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      done({
        success: false,
        output: "",
        error: error.message,
        durationMs: Date.now() - startedAt
      });
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        done({
          success: true,
          output: stdout.trim(),
          error: stderr.trim() || undefined,
          durationMs: Date.now() - startedAt
        });
      } else {
        done({
          success: false,
          output: stdout.trim(),
          error: stderr.trim() || `CLI exited with code ${String(code)}`,
          durationMs: Date.now() - startedAt
        });
      }
    });

    if (input.backend.stdinPrompt) {
      child.stdin.write(input.prompt);
      child.stdin.write("\n");
    }
    child.stdin.end();
  });
}
