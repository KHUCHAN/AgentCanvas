/**
 * backendProbeService — Diagnostic probe runner for all 3 CLI backends.
 *
 * On each "Rebuild" the extension calls runAndLogBackendProbes() which:
 *   1. Spawns 6 processes in parallel (model + status probe per CLI)
 *   2. Writes a structured log to <workspace>/.agentcanvas/logs/
 *   3. Returns confirmed model lists + raw status output
 *   4. Feeds results into the model-catalog and quota caches so the
 *      subsequent fetchBackendModelCatalogs / quota calls are instant.
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

// Per-probe hard timeout — short enough not to slow down rebuild
const PROBE_TIMEOUT_MS = 6_000;

// ─── Public types ─────────────────────────────────────────────────────────────

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

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Run all 6 diagnostic probes in parallel, write a log file and populate
 * the in-memory model / quota caches so the next read is instant.
 *
 * @param backends    List of available CLI backends from detectCliBackends()
 * @param workspacePath  Workspace root — log is written under .agentcanvas/logs/
 * @param outputChannel  Optional VS Code–style logger for live output
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
    `Running ${backendMap.size * 2} probes in parallel for: ${[...backendMap.keys()].join(", ")}\n`
  );

  // Run all model + status probes concurrently
  const reports = await Promise.all(
    [...backendMap.entries()].map(async ([backendId, backend]) => {
      const t0 = Date.now();
      const [modelResult, statusResult] = await Promise.all([
        runModelProbe(backend.command, backendId),
        runStatusProbe(backend.command, backendId)
      ]);
      const durationMs = Date.now() - t0;

      const modelSummary =
        modelResult.confirmedModels.length > 0
          ? `${modelResult.confirmedModels.length} models: ${modelResult.confirmedModels.join(", ")}`
          : "no models extracted";

      outputChannel?.appendLine(
        `[${backendId.toUpperCase()}] /model  [${modelResult.status}] ${modelSummary}`
      );
      outputChannel?.appendLine(
        `[${backendId.toUpperCase()}] /status [${statusResult.status}] ${statusResult.raw.slice(0, 120).replace(/\n/g, " ")}...`
      );
      outputChannel?.appendLine(`[${backendId.toUpperCase()}] Completed in ${durationMs}ms\n`);

      return {
        backendId,
        command: backend.command,
        modelProbe: modelResult,
        statusProbe: statusResult,
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

// ─── Cache population ─────────────────────────────────────────────────────────

function populateCaches(reports: BackendProbeResult[]): void {
  // Model catalog cache
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

  // Quota caches
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

// ─── Probe runners ────────────────────────────────────────────────────────────

async function stdinProbe(
  command: string,
  input: string
): Promise<{ status: "ok" | "timeout" | "error"; raw: string }> {
  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn> | undefined;

    const timer = setTimeout(() => {
      try {
        child?.kill();
      } catch {
        /* ignore */
      }
      resolve({ status: "timeout", raw: `(timeout after ${PROBE_TIMEOUT_MS / 1000}s)` });
    }, PROBE_TIMEOUT_MS);

    try {
      child = spawn(command, [], {
        stdio: "pipe",
        env: { ...process.env, NO_COLOR: "1" },
        shell: false
      });
    } catch (error) {
      clearTimeout(timer);
      resolve({ status: "error", raw: String(error) });
      return;
    }

    let output = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ status: "error", raw: String(error) });
    });
    child.on("close", () => {
      clearTimeout(timer);
      const stripped = output.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
      resolve({ status: "ok", raw: stripped.trim() });
    });

    try {
      child.stdin?.write(input);
      child.stdin?.end();
    } catch (error) {
      clearTimeout(timer);
      try {
        child.kill();
      } catch {
        /* ignore */
      }
      resolve({ status: "error", raw: String(error) });
    }
  });
}

async function runModelProbe(
  command: string,
  backendId: CanonicalBackendId
): Promise<BackendProbeResult["modelProbe"]> {
  const result = await stdinProbe(command, "/model\n");
  const pattern = getModelPattern(backendId);
  const confirmedModels = [
    ...new Set(
      (result.raw.match(pattern) ?? []).map((m) => m.trim()).filter(Boolean)
    )
  ];
  return { ...result, confirmedModels };
}

async function runStatusProbe(
  command: string,
  backendId: CanonicalBackendId
): Promise<BackendProbeResult["statusProbe"]> {
  const input = backendId === "gemini" ? "/stats session\n" : "/status\n";
  const result = await stdinProbe(command, input);
  return { status: result.status, raw: result.raw };
}

function getModelPattern(backendId: CanonicalBackendId): RegExp {
  if (backendId === "claude") {
    return /(claude-[a-z0-9.-]+)/gi;
  }
  if (backendId === "codex") {
    return /(gpt-[\w.-]+|o[134][\w.-]*)/gi;
  }
  if (backendId === "gemini") {
    return /(gemini-[a-z0-9.]+)/gi;
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
    lines.push("Raw output:");
    lines.push(r.modelProbe.raw || "(empty)");
    lines.push("");

    const statusCmd = r.backendId === "gemini" ? "/stats session" : "/status";
    lines.push(`--- ${statusCmd} probe [${r.statusProbe.status}] ---`);
    lines.push("Raw output:");
    lines.push(r.statusProbe.raw || "(empty)");
    lines.push("");
  }

  await writeFile(logPath, lines.join("\n"), "utf8");
}
