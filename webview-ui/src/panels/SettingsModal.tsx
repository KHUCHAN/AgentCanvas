import { useEffect, useMemo, useState } from "react";
import type {
  BackendBudget,
  BackendUsageSummary,
  CacheConfig,
  CacheMetrics,
  CanonicalBackendId
} from "../messaging/protocol";

type SettingsTab =
  | "general"
  | "providers"
  | "ops"
  | "packs"
  | "cache"
  | "usage"
  | "shortcuts";

type SettingsModalProps = {
  open: boolean;
  cacheConfig: CacheConfig;
  cacheMetrics: CacheMetrics;
  backendUsageSummaries: BackendUsageSummary[];
  onClose: () => void;
  onRefreshDiscovery: () => void;
  onSaveFlow: () => Promise<void>;
  onLoadFlow: () => Promise<void>;
  onRunValidationAll: () => void;
  onOpenSkillWizard: () => void;
  onOpenAgentCreation: () => void;
  onOpenCommonRuleModal: () => void;
  onEnsureRootAgents: () => void;
  onOpenCommonRulesFolder: () => void;
  onCreateCommonRuleDocs: () => void;
  onExportAllSkills: () => void;
  onImportPack: () => void;
  onOpenKeyboardHelp: () => void;
  onSaveCacheConfig: (config: CacheConfig) => Promise<void>;
  onRefreshCacheMetrics: () => Promise<void>;
  onResetCacheMetrics: () => Promise<void>;
  onRefreshBackendUsage: () => Promise<void>;
  onSaveBackendBudget: (
    backendId: CanonicalBackendId,
    budget: BackendBudget
  ) => Promise<void>;
};

type BudgetDraft = Partial<Record<CanonicalBackendId, BackendBudget>>;

export default function SettingsModal(props: SettingsModalProps) {
  const [tab, setTab] = useState<SettingsTab>("general");
  const [draftCacheConfig, setDraftCacheConfig] = useState<CacheConfig>(props.cacheConfig);
  const [budgetDraft, setBudgetDraft] = useState<BudgetDraft>({});

  useEffect(() => {
    if (!props.open) {
      return;
    }
    setDraftCacheConfig(props.cacheConfig);
    const nextBudget: BudgetDraft = {};
    for (const summary of props.backendUsageSummaries) {
      nextBudget[summary.backendId] = { ...(summary.budget ?? {}) };
    }
    setBudgetDraft(nextBudget);
  }, [props.backendUsageSummaries, props.cacheConfig, props.open]);

  const usageRows = useMemo(
    () =>
      [...props.backendUsageSummaries].sort(
        (left, right) => backendOrder(left.backendId) - backendOrder(right.backendId)
      ),
    [props.backendUsageSummaries]
  );

  if (!props.open) {
    return null;
  }

  return (
    <div className="command-overlay" role="presentation" onClick={props.onClose}>
      <div className="settings-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="settings-modal-header">
          <div>
            <div className="import-title">Settings</div>
            <div className="import-subtitle">Manage AgentCanvas options and operations from one place.</div>
          </div>
          <button type="button" onClick={props.onClose}>Close</button>
        </div>

        <div className="settings-tabs" role="tablist" aria-label="Settings tabs">
          <button type="button" className={tab === "general" ? "active" : ""} onClick={() => setTab("general")}>
            General
          </button>
          <button type="button" className={tab === "providers" ? "active" : ""} onClick={() => setTab("providers")}>
            Providers
          </button>
          <button type="button" className={tab === "ops" ? "active" : ""} onClick={() => setTab("ops")}>
            OPS
          </button>
          <button type="button" className={tab === "packs" ? "active" : ""} onClick={() => setTab("packs")}>
            Packs
          </button>
          <button type="button" className={tab === "cache" ? "active" : ""} onClick={() => setTab("cache")}>
            Cache & Cost
          </button>
          <button type="button" className={tab === "usage" ? "active" : ""} onClick={() => setTab("usage")}>
            Usage & Budget
          </button>
          <button type="button" className={tab === "shortcuts" ? "active" : ""} onClick={() => setTab("shortcuts")}>
            Shortcuts
          </button>
        </div>

        <div className="settings-body">
          {tab === "general" && (
            <section className="settings-section">
              <h4>Workspace</h4>
              <div className="settings-actions">
                <button type="button" onClick={props.onRefreshDiscovery}>Refresh discovery</button>
                <button type="button" onClick={() => void props.onSaveFlow()}>Save flow</button>
                <button type="button" onClick={() => void props.onLoadFlow()}>Load flow</button>
                <button type="button" onClick={props.onRunValidationAll}>Validate all</button>
              </div>
            </section>
          )}

          {tab === "providers" && (
            <section className="settings-section">
              <h4>Providers and Team</h4>
              <div className="settings-actions">
                <button type="button" onClick={props.onOpenSkillWizard}>New skill</button>
                <button type="button" onClick={props.onOpenAgentCreation}>New agent</button>
              </div>
            </section>
          )}

          {tab === "ops" && (
            <section className="settings-section">
              <h4>Common Rules and Ops</h4>
              <div className="settings-actions">
                <button type="button" onClick={props.onOpenCommonRuleModal}>Add common rule</button>
                <button type="button" onClick={props.onEnsureRootAgents}>Ensure AGENTS.md</button>
                <button type="button" onClick={props.onOpenCommonRulesFolder}>Open common rules folder</button>
                <button type="button" onClick={props.onCreateCommonRuleDocs}>Create ops docs</button>
              </div>
            </section>
          )}

          {tab === "packs" && (
            <section className="settings-section">
              <h4>Skill Packs</h4>
              <div className="settings-actions">
                <button type="button" onClick={props.onExportAllSkills}>Export pack</button>
                <button type="button" onClick={props.onImportPack}>Import pack</button>
              </div>
            </section>
          )}

          {tab === "cache" && (
            <section className="settings-section">
              <h4>Cache & Cost</h4>
              <div className="settings-form-grid">
                <label>
                  Cache retention
                  <select
                    value={draftCacheConfig.retention}
                    onChange={(event) =>
                      setDraftCacheConfig((prev) => ({
                        ...prev,
                        retention: event.target.value as CacheConfig["retention"]
                      }))
                    }
                  >
                    <option value="short">short</option>
                    <option value="long">long</option>
                  </select>
                </label>
                <label>
                  Context threshold (tokens)
                  <input
                    type="number"
                    min={10000}
                    step={1000}
                    value={draftCacheConfig.contextThreshold}
                    onChange={(event) =>
                      setDraftCacheConfig((prev) => ({
                        ...prev,
                        contextThreshold: Number(event.target.value)
                      }))
                    }
                  />
                </label>
                <label>
                  TTL seconds
                  <input
                    type="number"
                    min={30}
                    step={30}
                    value={draftCacheConfig.contextPruning.ttlSeconds}
                    onChange={(event) =>
                      setDraftCacheConfig((prev) => ({
                        ...prev,
                        contextPruning: {
                          ...prev.contextPruning,
                          ttlSeconds: Number(event.target.value)
                        }
                      }))
                    }
                  />
                </label>
                <label>
                  Heartbeat model
                  <select
                    value={draftCacheConfig.modelRouting.heartbeat}
                    onChange={(event) =>
                      setDraftCacheConfig((prev) => ({
                        ...prev,
                        modelRouting: {
                          ...prev.modelRouting,
                          heartbeat: event.target.value
                        }
                      }))
                    }
                  >
                    <option value="haiku-4.5">haiku-4.5</option>
                    <option value="sonnet-4.5">sonnet-4.5</option>
                    <option value="opus-4.5">opus-4.5</option>
                  </select>
                </label>
                <label>
                  Cron model
                  <select
                    value={draftCacheConfig.modelRouting.cron}
                    onChange={(event) =>
                      setDraftCacheConfig((prev) => ({
                        ...prev,
                        modelRouting: {
                          ...prev.modelRouting,
                          cron: event.target.value
                        }
                      }))
                    }
                  >
                    <option value="haiku-4.5">haiku-4.5</option>
                    <option value="sonnet-4.5">sonnet-4.5</option>
                    <option value="opus-4.5">opus-4.5</option>
                  </select>
                </label>
                <label>
                  Default model
                  <select
                    value={draftCacheConfig.modelRouting.default}
                    onChange={(event) =>
                      setDraftCacheConfig((prev) => ({
                        ...prev,
                        modelRouting: {
                          ...prev.modelRouting,
                          default: event.target.value
                        }
                      }))
                    }
                  >
                    <option value="sonnet-4.5">sonnet-4.5</option>
                    <option value="haiku-4.5">haiku-4.5</option>
                    <option value="opus-4.5">opus-4.5</option>
                  </select>
                </label>
                <label className="settings-checkbox">
                  <input
                    type="checkbox"
                    checked={draftCacheConfig.diagnostics.enabled}
                    onChange={(event) =>
                      setDraftCacheConfig((prev) => ({
                        ...prev,
                        diagnostics: {
                          ...prev.diagnostics,
                          enabled: event.target.checked
                        }
                      }))
                    }
                  />
                  Enable cache trace logging
                </label>
                <label>
                  Diagnostics log path
                  <input
                    value={draftCacheConfig.diagnostics.logPath}
                    onChange={(event) =>
                      setDraftCacheConfig((prev) => ({
                        ...prev,
                        diagnostics: {
                          ...prev.diagnostics,
                          logPath: event.target.value
                        }
                      }))
                    }
                  />
                </label>
              </div>
              <div className="muted">
                Cost ${props.cacheMetrics.cost.toFixed(3)} · saved {(props.cacheMetrics.savedCost).toFixed(3)} ·
                hit rate {Math.round(props.cacheMetrics.hitRate * 100)}%
              </div>
              <div className="settings-actions">
                <button type="button" onClick={() => void props.onSaveCacheConfig(draftCacheConfig)}>
                  Save
                </button>
                <button type="button" onClick={() => void props.onRefreshCacheMetrics()}>
                  Refresh metrics
                </button>
                <button type="button" onClick={() => void props.onResetCacheMetrics()}>
                  Reset metrics
                </button>
              </div>
            </section>
          )}

          {tab === "usage" && (
            <section className="settings-section">
              <h4>Usage & Budget</h4>
              <div className="settings-actions">
                <button type="button" onClick={() => void props.onRefreshBackendUsage()}>
                  Refresh usage
                </button>
              </div>
              {usageRows.length === 0 && (
                <div className="muted">No backend usage records yet.</div>
              )}
              {usageRows.length > 0 && (
                <div className="backend-settings-list">
                  {usageRows.map((summary) => {
                    const draft = budgetDraft[summary.backendId] ?? {};
                    return (
                      <div key={summary.backendId} className="agent-detail-item">
                        <div className="agent-detail-item-header">
                          <div className="item-title">{toBackendTitle(summary.backendId)}</div>
                          <span className="pill">{Math.round(summary.availabilityScore * 100)}% free</span>
                        </div>
                        <div className="node-meta">
                          Today: ${summary.today.estimatedCost.toFixed(2)} · {summary.today.callCount} calls · {summary.today.totalTokens.toLocaleString()} tokens
                        </div>
                        <div className="node-meta">
                          Week: ${summary.thisWeek.estimatedCost.toFixed(2)} · {summary.thisWeek.callCount} calls
                          {" · "}
                          Month: ${summary.thisMonth.estimatedCost.toFixed(2)} · {summary.thisMonth.callCount} calls
                        </div>

                        <div className="settings-form-grid usage-budget-grid">
                          <label>
                            Daily max cost (USD)
                            <input
                              type="number"
                              min={0}
                              step={0.1}
                              value={toInputValue(draft.dailyMaxCost)}
                              onChange={(event) =>
                                setBudgetDraft((previous) => ({
                                  ...previous,
                                  [summary.backendId]: {
                                    ...draft,
                                    dailyMaxCost: parseDecimalInput(event.target.value)
                                  }
                                }))
                              }
                            />
                          </label>
                          <label>
                            Weekly max cost (USD)
                            <input
                              type="number"
                              min={0}
                              step={0.1}
                              value={toInputValue(draft.weeklyMaxCost)}
                              onChange={(event) =>
                                setBudgetDraft((previous) => ({
                                  ...previous,
                                  [summary.backendId]: {
                                    ...draft,
                                    weeklyMaxCost: parseDecimalInput(event.target.value)
                                  }
                                }))
                              }
                            />
                          </label>
                          <label>
                            Monthly max cost (USD)
                            <input
                              type="number"
                              min={0}
                              step={0.1}
                              value={toInputValue(draft.monthlyMaxCost)}
                              onChange={(event) =>
                                setBudgetDraft((previous) => ({
                                  ...previous,
                                  [summary.backendId]: {
                                    ...draft,
                                    monthlyMaxCost: parseDecimalInput(event.target.value)
                                  }
                                }))
                              }
                            />
                          </label>
                          <label>
                            Daily max calls
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={toInputValue(draft.dailyMaxCalls)}
                              onChange={(event) =>
                                setBudgetDraft((previous) => ({
                                  ...previous,
                                  [summary.backendId]: {
                                    ...draft,
                                    dailyMaxCalls: parseIntegerInput(event.target.value)
                                  }
                                }))
                              }
                            />
                          </label>
                          <label>
                            Weekly max calls
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={toInputValue(draft.weeklyMaxCalls)}
                              onChange={(event) =>
                                setBudgetDraft((previous) => ({
                                  ...previous,
                                  [summary.backendId]: {
                                    ...draft,
                                    weeklyMaxCalls: parseIntegerInput(event.target.value)
                                  }
                                }))
                              }
                            />
                          </label>
                          <label>
                            Monthly max calls
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={toInputValue(draft.monthlyMaxCalls)}
                              onChange={(event) =>
                                setBudgetDraft((previous) => ({
                                  ...previous,
                                  [summary.backendId]: {
                                    ...draft,
                                    monthlyMaxCalls: parseIntegerInput(event.target.value)
                                  }
                                }))
                              }
                            />
                          </label>
                        </div>
                        <div className="settings-actions">
                          <button
                            type="button"
                            onClick={() =>
                              void props.onSaveBackendBudget(summary.backendId, {
                                dailyMaxCost: draft.dailyMaxCost,
                                weeklyMaxCost: draft.weeklyMaxCost,
                                monthlyMaxCost: draft.monthlyMaxCost,
                                dailyMaxCalls: draft.dailyMaxCalls,
                                weeklyMaxCalls: draft.weeklyMaxCalls,
                                monthlyMaxCalls: draft.monthlyMaxCalls
                              })
                            }
                          >
                            Save budget
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {tab === "shortcuts" && (
            <section className="settings-section">
              <h4>Keyboard</h4>
              <div className="settings-actions">
                <button type="button" onClick={props.onOpenKeyboardHelp}>Open shortcuts help</button>
              </div>
              <div className="muted">Tip: Cmd/Ctrl+K opens Command Bar.</div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function backendOrder(backendId: CanonicalBackendId): number {
  if (backendId === "claude") {
    return 0;
  }
  if (backendId === "codex") {
    return 1;
  }
  if (backendId === "gemini") {
    return 2;
  }
  if (backendId === "aider") {
    return 3;
  }
  return 4;
}

function toBackendTitle(backendId: CanonicalBackendId): string {
  if (backendId === "claude") {
    return "Claude";
  }
  if (backendId === "codex") {
    return "Codex";
  }
  if (backendId === "gemini") {
    return "Gemini";
  }
  if (backendId === "aider") {
    return "Aider";
  }
  return "Custom";
}

function toInputValue(value: number | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "";
  }
  return String(value);
}

function parseDecimalInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

function parseIntegerInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return Math.floor(parsed);
}
