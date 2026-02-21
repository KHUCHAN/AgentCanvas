/**
 * backendProbeService — Diagnostic probe runner for all 3 CLI backends.
 *
 * On each "Rebuild" the extension calls runAndLogBackendProbes() which:
 *   1. Spawns ONE process per backend in parallel
 *   2. Waits for the CLI's initial prompt to appear (idle window detection)
 *   3. Sends /model, waits, then sends /status in the same session
 *   4. Writes a structured log to <workspace>/.agentcanvas/logs/
 *   5. Feeds results into the model-catalog and quota caches
 *
 * WHY session-based instead of two separate spawns:
 *   CLIs are interactive REPLs.  They print a welcome banner / prompt on
 *   startup — only after that are they ready to accept slash commands.
 *   Sending a command immediately on spawn means the CLI hasn't finished
 *   its own initialisation, so it either ignores the command or exits with
 *   "stdin is not a terminal".  Gemini in particular needs ≥ 8s to reach
 *   its prompt.  By sharing one session we also avoid double startup cost.
 */

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  BackendModelCatalog,
  CanonicalBackendId,
  CliBackend,
  ClaudeQuotaSnapshot,
  CliSubscriptionQuota
} from "../types";
import { normalizeBackendId } from "./backendProfiles";
import { populateModelCatalogCache } from "./backendModelPoller";
import {
  populateClaudeQuotaCache,
  populateCodexQuotaCache,
  populateGeminiQuotaCache
} from "./claudeQuotaPoller";

// ─── Timing constants ──────────────────────────────────────────────────────────

/**
 * How long to wait (ms) for the CLI's stdout/stderr to go quiet before we
 * consider it "ready" to accept slash commands.
 */
const READY_IDLE_MS = 1_200;

/**
 * After sending a slash command, how long to wait for its output before
 * sending the next command (or closing stdin).
 */
const INTER_COMMAND_MS = 3_000;

/**
 * Hard per-backend wall-clock timeout (startup + both commands).
 * Gemini takes significantly longer to initialise than Claude / Codex.
 */
const TIMEOUT_BY_BACKEND: Partial<Record<CanonicalBackendId, number>> = {
  claude: 18_000,
  codex:  14_000,
  gemini: 28_000
};

const DEFAULT_TIMEOUT_MS = 18_000;

// ─── Public types ──────────────────────────────────────────────────────────────

export interface BackendProbeResult {
  backendId: CanonicalBackendId;
  command: string;
  /** Results from the `/model` stdin probe */
  modelProbe: {
    status: "ok" | "timeout" | "error";
    raw: string;
    confirmedModels: string[];
  };
  /** Results from `/status` (Claude/Codex) or `/stats session` (Gemini) */
  statusProbe: {
    status: "ok" | "timeout" | "error";
    raw: string;
  };
  durationMs: number;
  timestamp: number;
}

// ─── Main entry point ──────────────────────────────────────────────────────────

/**
 * Run one diagnostic session per available backend in parallel, write a log
 * file and populate the in-memory model / quota caches.
 */
export async function runAndLogBackendProbes(
  backends: CliBackend[],
  workspacePath: string,
  outputChannel?: { appendLine: (line: string) => void }
): Promise<BackendProbeResult[]> {
  const PROBE_BACKENDS: CanonicalBackendId[] = ["claude", "codex", "gemini"];
  const backendMap = new Map<CanonicalBackendId, CliBackend>();

  for (const backend of backends) {
    const canonical = normalizeBackendId(backend.id);
    if (!canonical || !backend.available || backendMap.has(canonical)) {
      continue;
    }
    if (PROBE_BACKENDS.includes(canonical)) {
      backendMap.set(canonical, backend);
    }
  }

  if (backendMap.size === 0) {
    outputChannel?.appendLine("[AgentCanvas] No CLI backends available — skipping probes.");
    return [];
  }

  const ts = new Date().toISOString();
  outputChannel?.appendLine(`\n=== AgentCanvas Backend Probe (${ts}) ===`);
  outputChannel?.appendLine(
    `Probing in parallel: ${[...backendMap.keys()].join(", ")}\n`
  );

  const reports = await Promise.all(
    [...backendMap.entries()].map(async ([backendId, backend]) => {
      const t0 = Date.now();
      const sessionResult = await runSessionProbe(backend.command, backendId);
      const durationMs = Date.now() - t0;

      const pattern = getModelPattern(backendId);
      const confirmedModels = [
        ...new Set(
          (sessionResult.raw.match(pattern) ?? []).map((m) => m.trim()).filter(Boolean)
        )
      ];

      const modelSummary =
        confirmedModels.length > 0
          ? `${confirmedModels.length} model(s): ${confirmedModels.join(", ")}`
          : "no models extracted";

      outputChannel?.appendLine(
        `[${backendId.toUpperCase()}] /model  [${sessionResult.status}] ${modelSummary}`
      );
      outputChannel?.appendLine(
        `[${backendId.toUpperCase()}] /status [${sessionResult.status}] ${sessionResult.raw.slice(0, 120).replace(/\n/g, " ")}...`
      );
      outputChannel?.appendLine(`[${backendId.toUpperCase()}] Completed in ${durationMs}ms\n`);

      return {
        backendId,
        command: backend.command,
        modelProbe: {
          status: sessionResult.status,
          raw: sessionResult.raw,
          confirmedModels
        },
        statusProbe: {
          status: sessionResult.status,
          raw: sessionResult.raw
        },
        durationMs,
        timestamp: Date.now()
      } as BackendProbeResult;
    })
  );

  // Write structured log file (non-fatal)
  writeProbeLog(reports, workspacePath).catch(() => undefined);

  // Populate model + quota caches from probe results
  populateCaches(reports);

  return reports;
}

// ─── Cache population ──────────────────────────────────────────────────────────

function populateCaches(reports: BackendProbeResult[]): void {
  const catalogs: BackendModelCatalog[] = reports.map((r) => ({
    backendId: r.backendId,
    models:
      r.modelProbe.confirmedModels.length > 0
        ? r.modelProbe.confirmedModels.map((id) => ({ id, label: id }))
        : [],
    fetchedAt: r.timestamp,
    source: r.modelProbe.confirmedModels.length > 0 ? "dynamic" : "fallback"
  }));
  populateModelCatalogCache(catalogs);

  for (const r of reports) {
    if (r.backendId === "claude") {
      const parsed = parseClaudeStatus(r.statusProbe.raw);
      if (parsed) {
        populateClaudeQuotaCache(parsed);
      }
    } else if (r.backendId === "codex") {
      const parsed = parseCodexStatus(r.statusProbe.raw);
      if (parsed) {
        populateCodexQuotaCache(parsed);
      }
    } else if (r.backendId === "gemini") {
      const parsed = parseGeminiStatus(r.statusProbe.raw);
      if (parsed) {
        populateGeminiQuotaCache(parsed);
      }
    }
  }
}

// ─── Session probe ─────────────────────────────────────────────────────────────

type SessionPhase = "waiting_ready" | "after_model" | "after_status" | "done";

/**
 * Spawn the CLI once and run both /model and /status (or /stats session for
 * Gemini) commands in a single interactive session:
 *
 *   1. Wait for the CLI's initial output to go idle for READY_IDLE_MS
 *      → CLI is ready to accept slash commands
 *   2. Send `/model\n` — wait INTER_COMMAND_MS for output to idle
 *   3. Send `/status\n` (or `/stats session\n`) — wait INTER_COMMAND_MS
 *   4. Close stdin (EOF) → CLI exits naturally
 *   5. Return all captured output for regex extraction
 *
 * Early-exit on TTY rejection: some CLIs (e.g. Codex) print a "stdin is not
 * a terminal" message and exit immediately.  We detect this and surface it as
 * an error rather than waiting for the hard timeout.
 */
async function runSessionProbe(
  command: string,
  backendId: CanonicalBackendId
): Promise<{ status: "ok" | "timeout" | "error"; raw: string }> {
  const timeoutMs = TIMEOUT_BY_BACKEND[backendId] ?? DEFAULT_TIMEOUT_MS;
  const statusCmd = backendId === "gemini" ? "/stats session\n" : "/status\n";
  const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");

  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn> | undefined;
    let output = "";
    let phase: SessionPhase = "waiting_ready";
    let phaseTimer: ReturnType<typeof setTimeout> | undefined;
    let resolved = false;

    const finish = (status: "ok" | "timeout" | "error", extra?: string) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(hardTimer);
      clearTimeout(phaseTimer);
      try { child?.kill("SIGTERM"); } catch { /* ignore */ }
      resolve({ status, raw: stripAnsi(extra ?? output).trim() });
    };

    const hardTimer = setTimeout(
      () => finish("timeout", output || `(timeout after ${timeoutMs / 1000}s)`),
      timeoutMs
    );

    /**
     * Advance from the current phase to the next:
     *  waiting_ready → send /model, move to after_model
     *  after_model   → send /status, move to after_status
     *  after_status  → close stdin, let CLI exit
     */
    const advancePhase = () => {
      clearTimeout(phaseTimer);

      if (phase === "waiting_ready") {
        phase = "after_model";
        try { child?.stdin?.write("/model\n"); } catch { /* ignore */ }
        phaseTimer = setTimeout(advancePhase, INTER_COMMAND_MS);

      } else if (phase === "after_model") {
        phase = "after_status";
        try { child?.stdin?.write(statusCmd); } catch { /* ignore */ }
        phaseTimer = setTimeout(advancePhase, INTER_COMMAND_MS);

      } else if (phase === "after_status") {
        phase = "done";
        try { child?.stdin?.end(); } catch { /* ignore */ }
        // Give the CLI a moment to flush output before we kill it
        phaseTimer = setTimeout(() => finish("ok"), 1_500);
      }
    };

    /** Restart the "idle" timer each time new output arrives while waiting for ready. */
    const resetReadyTimer = () => {
      if (phase !== "waiting_ready") return;
      clearTimeout(phaseTimer);
      phaseTimer = setTimeout(advancePhase, READY_IDLE_MS);
    };

    try {
      child = spawn(command, [], {
        stdio: "pipe",
        env: { ...process.env, NO_COLOR: "1", TERM: "dumb" },
        shell: false
      });
    } catch (error) {
      finish("error", String(error));
      return;
    }

    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      resetReadyTimer();
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      // Detect early TTY rejection (e.g. Codex: "stdin is not a terminal")
      if (phase === "waiting_ready" && /not a terminal|isatty|requires.*tty/i.test(text)) {
        finish("error", output);
        return;
      }
      resetReadyTimer();
    });

    child.on("error", (error) => finish("error", String(error)));

    child.on("close", () => {
      if (resolved) return;
      clearTimeout(hardTimer);
      clearTimeout(phaseTimer);
      resolved = true;
      resolve({ status: "ok", raw: stripAnsi(output).trim() });
    });
  });
}

// ─── Model pattern matching ────────────────────────────────────────────────────

function getModelPattern(backendId: CanonicalBackendId): RegExp {
  if (backendId === "claude") {
    return /(claude-[a-z0-9.-]+)/gi;
  }
  if (backendId === "codex") {
    return /(gpt-[\w.-]+|o[134][\w.-]*)/gi;
  }
  if (backendId === "gemini") {
    return /(gemini-[a-z0-9.-]+)/gi;
  }
  return /([a-z0-9][a-z0-9._-]{2,120})/gi;
}

// ─── Status parsers (inline, avoids circular imports) ─────────────────────────

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

function parseClaudeStatus(raw: string): ClaudeQuotaSnapshot | undefined {
  const sessionMatch = /current session[^0-9]*(\d+)%\s*used(?:[^\n]*resets?\s*([^\n]+))?/i.exec(raw);
  const weekAllMatch =
    /current week\s*\((?:all|all models)\)[^0-9]*(\d+)%\s*used(?:[^\n]*resets?\s*([^\n]+))?/i.exec(raw);
  const weekSonnetMatch =
    /current week\s*\((?:sonnet|sonnet only)\)[^0-9]*(\d+)%\s*used/i.exec(raw);
  if (!sessionMatch && !weekAllMatch && !weekSonnetMatch) {
    return undefined;
  }
  return {
    sessionUsedPct: clamp(Number(sessionMatch?.[1] ?? 0)),
    weekAllUsedPct: clamp(Number(weekAllMatch?.[1] ?? 0)),
    weekSonnetUsedPct: clamp(Number(weekSonnetMatch?.[1] ?? 0)),
    sessionResetsAt: sessionMatch?.[2]?.trim() || undefined,
    weekResetsAt: weekAllMatch?.[2]?.trim() || undefined,
    fetchedAt: Date.now(),
    source: "dynamic"
  };
}

function parseGeminiStatus(raw: string): CliSubscriptionQuota | undefined {
  const pattern = /(-?\d+(?:\.\d+)?)%\s+resets?\s+in\s+([\d]+h\s*[\d]*m?|[\d]+m)/gi;
  const matches = [...raw.matchAll(pattern)];
  if (matches.length === 0) {
    return undefined;
  }
  const usedPcts = matches.map((m) => {
    const val = parseFloat(m[1]);
    return val < 0 ? clamp(100 + val) : clamp(val);
  });
  return {
    sessionUsedPct: Math.max(...usedPcts),
    weekAllUsedPct: 0,
    sessionResetsAt: matches[0]?.[2]?.trim(),
    fetchedAt: Date.now(),
    source: "dynamic"
  };
}

function parseCodexStatus(raw: string): CliSubscriptionQuota | undefined {
  const pctMatch = /(\d+(?:\.\d+)?)%\s*(?:used|remaining)/i.exec(raw);
  if (pctMatch) {
    const val = parseFloat(pctMatch[1]);
    const isRemaining = /remaining/i.test(pctMatch[0]);
    return {
      sessionUsedPct: isRemaining ? clamp(100 - val) : clamp(val),
      weekAllUsedPct: 0,
      fetchedAt: Date.now(),
      source: "dynamic"
    };
  }
  const ratioMatch = /(\d+)\s*\/\s*(\d+)\s*(?:requests?|tokens?|credits?)/i.exec(raw);
  if (ratioMatch) {
    const used = Number(ratioMatch[1]);
    const total = Number(ratioMatch[2]);
    if (total > 0) {
      return {
        sessionUsedPct: clamp(Math.round((used / total) * 100)),
        weekAllUsedPct: 0,
        fetchedAt: Date.now(),
        source: "dynamic"
      };
    }
  }
  return undefined;
}

// ─── Log writer ───────────────────────────────────────────────────────────────

async function writeProbeLog(reports: BackendProbeResult[], workspacePath: string): Promise<void> {
  const logsDir = join(workspacePath, ".agentcanvas", "logs");
  await mkdir(logsDir, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const logPath = join(logsDir, `backend-probes-${ts}.log`);

  const lines: string[] = [
    "=== AgentCanvas Backend Probe Log ===",
    `Timestamp: ${new Date().toISOString()}`,
    `Workspace: ${workspacePath}`,
    `Backends probed: ${reports.map((r) => r.backendId).join(", ")}`,
    ""
  ];

  for (const r of reports) {
    lines.push("=".repeat(60));
    lines.push(`BACKEND: ${r.backendId.toUpperCase()}  (command: ${r.command})`);
    lines.push(`Duration: ${r.durationMs}ms`);
    lines.push("");

    lines.push(`--- /model probe [${r.modelProbe.status}] ---`);
    if (r.modelProbe.confirmedModels.length > 0) {
      lines.push(`Confirmed models (${r.modelProbe.confirmedModels.length}):`);
      for (const m of r.modelProbe.confirmedModels) {
        lines.push(`  - ${m}`);
      }
    } else {
      lines.push("(no model IDs extracted from output)");
    }
    lines.push("Raw session output (first 3000 chars):");
    lines.push(r.modelProbe.raw.slice(0, 3_000) || "(empty)");
    lines.push("");

    const statusCmd = r.backendId === "gemini" ? "/stats session" : "/status";
    lines.push(`--- ${statusCmd} probe [${r.statusProbe.status}] ---`);
    lines.push("(same session output as above)");
    lines.push("");
  }

  await writeFile(logPath, lines.join("\n"), "utf8");
}
