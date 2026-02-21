import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import type { ClaudeQuotaSnapshot, CliBackend, CliSubscriptionQuota } from "../types";

const execFileAsync = promisify(execFile);
const CACHE_TTL_MS = 5 * 60 * 1000;

// ─── Shared stdin probe ────────────────────────────────────────────────────────

async function stdinProbe(command: string, input: string, timeoutMs = 12_000): Promise<string | undefined> {
  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn> | undefined;
    const timer = setTimeout(() => {
      try { child?.kill(); } catch { /* ignore */ }
      resolve(undefined);
    }, timeoutMs);

    try {
      child = spawn(command, [], {
        stdio: "pipe",
        env: { ...process.env, NO_COLOR: "1" },
        shell: false
      });
    } catch {
      clearTimeout(timer);
      resolve(undefined);
      return;
    }

    let output = "";
    child.stdout?.on("data", (chunk: Buffer) => { output += chunk.toString(); });
    child.stderr?.on("data", (chunk: Buffer) => { output += chunk.toString(); });

    child.on("error", () => { clearTimeout(timer); resolve(undefined); });
    child.on("close", () => { clearTimeout(timer); resolve(output.trim() || undefined); });

    try {
      child.stdin?.write(input);
      child.stdin?.end();
    } catch {
      clearTimeout(timer);
      try { child.kill(); } catch { /* ignore */ }
      resolve(undefined);
    }
  });
}

// ─── Claude cache ────────────────────────────────────────────────────────────

let claudeCache:
  | { expiresAt: number; snapshot: ClaudeQuotaSnapshot }
  | undefined;

export async function fetchClaudeQuotaSnapshot(backends: CliBackend[]): Promise<ClaudeQuotaSnapshot | undefined> {
  if (claudeCache && claudeCache.expiresAt > Date.now()) {
    return claudeCache.snapshot;
  }

  const claudeBackend = backends.find(
    (b) => b.available && (b.id === "claude" || b.id === "claude-code")
  );
  if (!claudeBackend) return undefined;

  const raw = await runStatusProbe(claudeBackend.command, [
    ["status", "--json"],
    ["status"],
    ["--help"]
  ]);
  const parsed = raw ? parseClaudeQuotaOutput(raw) : undefined;
  if (!parsed) return undefined;

  claudeCache = { expiresAt: Date.now() + CACHE_TTL_MS, snapshot: parsed };
  return parsed;
}

export function invalidateClaudeQuotaCache(): void { claudeCache = undefined; }

// ─── Codex cache ─────────────────────────────────────────────────────────────

let codexCache:
  | { expiresAt: number; snapshot: CliSubscriptionQuota }
  | undefined;

export async function fetchCodexQuotaSnapshot(backends: CliBackend[]): Promise<CliSubscriptionQuota | undefined> {
  if (codexCache && codexCache.expiresAt > Date.now()) {
    return codexCache.snapshot;
  }

  const codexBackend = backends.find(
    (b) => b.available && (b.id === "codex" || b.id === "codex-cli")
  );
  if (!codexBackend) return undefined;

  // Codex /status shows text bars (no % values) — try stdin probe first, then CLI args
  const stdinOut = await stdinProbe(codexBackend.command, "/status\n");
  if (stdinOut) {
    const parsed = parseCodexQuotaOutput(stdinOut);
    if (parsed) {
      codexCache = { expiresAt: Date.now() + CACHE_TTL_MS, snapshot: parsed };
      return parsed;
    }
  }

  // Fall back to CLI subcommands
  const raw = await runStatusProbe(codexBackend.command, [
    ["status", "--json"],
    ["status"],
    ["usage"]
  ]);
  const parsed = raw ? parseCodexQuotaOutput(raw) : undefined;
  if (!parsed) return undefined;

  codexCache = { expiresAt: Date.now() + CACHE_TTL_MS, snapshot: parsed };
  return parsed;
}

export function invalidateCodexQuotaCache(): void { codexCache = undefined; }

// ─── Gemini cache ─────────────────────────────────────────────────────────────

let geminiCache:
  | { expiresAt: number; snapshot: CliSubscriptionQuota }
  | undefined;

export async function fetchGeminiQuotaSnapshot(backends: CliBackend[]): Promise<CliSubscriptionQuota | undefined> {
  if (geminiCache && geminiCache.expiresAt > Date.now()) {
    return geminiCache.snapshot;
  }

  const geminiBackend = backends.find(
    (b) => b.available && (b.id === "gemini" || b.id === "gemini-cli")
  );
  if (!geminiBackend) return undefined;

  // Gemini exposes quota via `/stats session` REPL command (stdin pipe)
  const stdinOut = await stdinProbe(geminiBackend.command, "/stats session\n");
  if (stdinOut) {
    const parsed = parseGeminiStatsOutput(stdinOut);
    if (parsed) {
      geminiCache = { expiresAt: Date.now() + CACHE_TTL_MS, snapshot: parsed };
      return parsed;
    }
  }

  // Fall back to CLI subcommands
  const raw = await runStatusProbe(geminiBackend.command, [
    ["status", "--json"],
    ["status"],
    ["--help"]
  ]);
  const parsed = raw ? parseGeminiStatsOutput(raw) : undefined;
  if (!parsed) return undefined;

  geminiCache = { expiresAt: Date.now() + CACHE_TTL_MS, snapshot: parsed };
  return parsed;
}

export function invalidateGeminiQuotaCache(): void { geminiCache = undefined; }

// ─── Shared invalidation ─────────────────────────────────────────────────────

export function invalidateAllQuotaCaches(): void {
  claudeCache = undefined;
  codexCache = undefined;
  geminiCache = undefined;
}

// ─── Cache population (used by backendProbeService) ──────────────────────────

/** Pre-populate the Claude quota cache from an external probe result. */
export function populateClaudeQuotaCache(snapshot: ClaudeQuotaSnapshot): void {
  claudeCache = { expiresAt: Date.now() + CACHE_TTL_MS, snapshot };
}

/** Pre-populate the Codex quota cache from an external probe result. */
export function populateCodexQuotaCache(snapshot: CliSubscriptionQuota): void {
  codexCache = { expiresAt: Date.now() + CACHE_TTL_MS, snapshot };
}

/** Pre-populate the Gemini quota cache from an external probe result. */
export function populateGeminiQuotaCache(snapshot: CliSubscriptionQuota): void {
  geminiCache = { expiresAt: Date.now() + CACHE_TTL_MS, snapshot };
}

// ─── Shared exec probe ───────────────────────────────────────────────────────

async function runStatusProbe(command: string, probes: string[][]): Promise<string | undefined> {
  for (const args of probes) {
    try {
      const { stdout, stderr } = await execFileAsync(command, args, {
        timeout: args[0] === "--help" ? 8_000 : 15_000,
        maxBuffer: 512 * 1024,
        env: { ...process.env, NO_COLOR: "1" }
      });
      const merged = `${stdout}\n${stderr}`.trim();
      if (merged) return merged;
    } catch {
      continue;
    }
  }
  return undefined;
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

function stripAnsi(raw: string): string {
  return raw.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}

function clampPercent(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

// Claude: parses "current session X% used" / "current week (all models) X% used"
function parseClaudeQuotaOutput(raw: string): ClaudeQuotaSnapshot | undefined {
  const clean = stripAnsi(raw);
  const sessionMatch =
    /current session[^0-9]*(\d+)%\s*used(?:[^\n]*resets?\s*([^\n]+))?/i.exec(clean);
  const weekAllMatch =
    /current week\s*\((?:all|all models)\)[^0-9]*(\d+)%\s*used(?:[^\n]*resets?\s*([^\n]+))?/i.exec(clean);
  const weekSonnetMatch =
    /current week\s*\((?:sonnet|sonnet only)\)[^0-9]*(\d+)%\s*used/i.exec(clean);

  if (!sessionMatch && !weekAllMatch && !weekSonnetMatch) return undefined;

  return {
    sessionUsedPct: clampPercent(sessionMatch?.[1]),
    weekAllUsedPct: clampPercent(weekAllMatch?.[1]),
    weekSonnetUsedPct: clampPercent(weekSonnetMatch?.[1]),
    sessionResetsAt: sessionMatch?.[2]?.trim() || undefined,
    weekResetsAt: weekAllMatch?.[2]?.trim() || undefined,
    fetchedAt: Date.now(),
    source: "dynamic"
  };
}

// Gemini: parses `/stats session` output
// "Usage remaining" column shows values like "-97.5% resets in 22h 21m"
// Negative sign means this much quota is *remaining* → used = 100 - abs(remaining)
function parseGeminiStatsOutput(raw: string): CliSubscriptionQuota | undefined {
  const clean = stripAnsi(raw);

  // Find all "Usage remaining" entries: e.g. "-97.5% resets in 22h 21m" or "97.5% resets in 22h"
  const usagePattern = /(-?\d+(?:\.\d+)?)%\s+resets?\s+in\s+([\d]+h\s*[\d]*m?|[\d]+m)/gi;
  const matches = [...clean.matchAll(usagePattern)];

  if (matches.length === 0) return undefined;

  // Each entry: value is "remaining %" if negative, "used %" if positive
  const usedPcts = matches.map((m) => {
    const val = parseFloat(m[1]);
    // If negative (e.g. -97.5), it means 97.5% remaining → 2.5% used
    return val < 0 ? clampPercent(100 + val) : clampPercent(val);
  });

  // Show the worst-case (highest used %) across all models
  const sessionUsedPct = Math.max(...usedPcts);
  const firstResetMatch = matches[0]?.[2]?.trim();

  return {
    sessionUsedPct,
    weekAllUsedPct: 0,
    sessionResetsAt: firstResetMatch,
    fetchedAt: Date.now(),
    source: "dynamic"
  };
}

// Codex: /status output shows text bars without %, and a URL for detailed usage.
// Try to parse any numeric percentage if present; otherwise returns undefined.
function parseCodexQuotaOutput(raw: string): CliSubscriptionQuota | undefined {
  const clean = stripAnsi(raw);

  // Try percentage patterns first (future-proofing in case format changes)
  const pctMatch = /(\d+(?:\.\d+)?)%\s*(?:used|remaining|of(?:\s+your)?\s+(?:quota|limit))/i.exec(clean);
  if (pctMatch) {
    const val = parseFloat(pctMatch[1]);
    const isRemaining = /remaining/i.test(pctMatch[0]);
    return {
      sessionUsedPct: isRemaining ? clampPercent(100 - val) : clampPercent(val),
      weekAllUsedPct: 0,
      fetchedAt: Date.now(),
      source: "dynamic"
    };
  }

  // Try "used / total" numeric pattern (e.g. "45 / 100 requests")
  const ratioMatch = /(\d+)\s*\/\s*(\d+)\s*(?:requests?|tokens?|credits?)/i.exec(clean);
  if (ratioMatch) {
    const used = Number(ratioMatch[1]);
    const total = Number(ratioMatch[2]);
    if (total > 0) {
      return {
        sessionUsedPct: clampPercent(Math.round((used / total) * 100)),
        weekAllUsedPct: 0,
        fetchedAt: Date.now(),
        source: "dynamic"
      };
    }
  }

  // Codex shows only text bars + a URL to chatgpt.com/codex/settings/usage
  // Cannot extract % from text bars — return undefined
  return undefined;
}
