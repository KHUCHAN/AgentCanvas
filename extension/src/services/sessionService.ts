export type SessionScope = "workspace" | "user" | "channel";

export type SessionInput = {
  scope: SessionScope;
  scopeId?: string;
};

const SESSION_SEPARATOR = "__session__";

export function buildSessionId(flowName: string, session: SessionInput | undefined): string | undefined {
  if (!session || session.scope === "workspace") {
    return undefined;
  }
  const scopeId = sanitize(session.scopeId || "default");
  const flow = sanitize(flowName || "default");
  return `${flow}:${session.scope}:${scopeId}`;
}

export function withSessionFlow(flowName: string, sessionId?: string): string {
  const base = sanitize(flowName || "default");
  if (!sessionId) {
    return base;
  }
  return `${base}${SESSION_SEPARATOR}${sanitize(sessionId)}`;
}

export function splitSessionFlow(sessionFlowName: string): { flowName: string; sessionId?: string } {
  const normalized = sanitize(sessionFlowName || "default");
  const marker = normalized.indexOf(SESSION_SEPARATOR);
  if (marker < 0) {
    return { flowName: normalized };
  }
  return {
    flowName: normalized.slice(0, marker) || "default",
    sessionId: normalized.slice(marker + SESSION_SEPARATOR.length) || undefined
  };
}

function sanitize(value: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9._:-]+/g, "_");
  return normalized || "default";
}
