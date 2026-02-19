import { FormEvent, useMemo, useState } from "react";
import type {
  MemoryCommit,
  MemoryItem,
  MemoryItemType,
  MemoryNamespace,
  MemoryQueryResult
} from "../messaging/protocol";

type MemoryPanelProps = {
  items: MemoryItem[];
  commits: MemoryCommit[];
  queryResult?: MemoryQueryResult;
  onRefresh: () => Promise<void>;
  onSearch: (query: string, namespaces?: MemoryNamespace[]) => Promise<void>;
  onAdd: (item: Omit<MemoryItem, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  onSupersede: (oldItemId: string, newContent: string, reason: string) => Promise<void>;
  onCheckout: (commitId: string) => Promise<void>;
};

type NamespaceFilter = "all" | "system" | "shared" | "agent" | "flow";

const MEMORY_TYPES: MemoryItemType[] = [
  "fact",
  "decision",
  "learning",
  "summary",
  "preference",
  "artifact"
];

export default function MemoryPanel(props: MemoryPanelProps) {
  const [pending, setPending] = useState<"refresh" | "search" | "add" | "supersede" | "checkout" | null>(null);
  const [query, setQuery] = useState("");
  const [namespaceFilter, setNamespaceFilter] = useState<NamespaceFilter>("all");
  const [newType, setNewType] = useState<MemoryItemType>("fact");
  const [newNamespace, setNewNamespace] = useState<MemoryNamespace>("shared");
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newTags, setNewTags] = useState("");
  const [newImportance, setNewImportance] = useState(0.5);
  const [supersedeTargetId, setSupersedeTargetId] = useState<string>();
  const [supersedeContent, setSupersedeContent] = useState("");
  const [supersedeReason, setSupersedeReason] = useState("manual update");
  const [error, setError] = useState<string>();

  const filteredItems = useMemo(() => {
    if (namespaceFilter === "all") {
      return props.items;
    }
    if (namespaceFilter === "system" || namespaceFilter === "shared") {
      return props.items.filter((item) => item.namespace === namespaceFilter);
    }
    if (namespaceFilter === "agent") {
      return props.items.filter((item) => item.namespace.startsWith("agent/"));
    }
    return props.items.filter((item) => item.namespace.startsWith("flow/"));
  }, [namespaceFilter, props.items]);

  const execute = async (
    action: "refresh" | "search" | "add" | "supersede" | "checkout",
    callback: () => Promise<void>
  ) => {
    setPending(action);
    setError(undefined);
    try {
      await callback();
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      setError(detail);
    } finally {
      setPending(null);
    }
  };

  const refresh = () => execute("refresh", props.onRefresh);

  const search = (event: FormEvent) => {
    event.preventDefault();
    const namespaces = namespaceFilterToQuery(namespaceFilter);
    void execute("search", () => props.onSearch(query.trim(), namespaces));
  };

  const addMemory = (event: FormEvent) => {
    event.preventDefault();
    const title = newTitle.trim();
    const content = newContent.trim();
    if (!title || !content) {
      setError("Title and content are required.");
      return;
    }
    const tags = newTags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    void execute("add", async () => {
      await props.onAdd({
        namespace: newNamespace,
        type: newType,
        title,
        content,
        source: {},
        tags,
        importance: clampImportance(newImportance)
      });
      setNewTitle("");
      setNewContent("");
      setNewTags("");
    });
  };

  const submitSupersede = (oldItemId: string) => {
    const nextContent = supersedeContent.trim();
    const reason = supersedeReason.trim() || "manual update";
    if (!nextContent) {
      setError("Supersede content is required.");
      return;
    }
    void execute("supersede", async () => {
      await props.onSupersede(oldItemId, nextContent, reason);
      setSupersedeTargetId(undefined);
      setSupersedeContent("");
    });
  };

  return (
    <div className="panel-content" id="right-panel-memory" role="tabpanel">
      <div className="inspector-block">
        <div className="inspector-title">Memory Overview</div>
        <div className="muted">Items {props.items.length}</div>
        <div className="muted">Commits {props.commits.length}</div>
        {props.queryResult && (
          <div className="muted">
            Search result {props.queryResult.items.length}/{props.queryResult.totalCount} · tokens {props.queryResult.budgetUsed}/{props.queryResult.budgetLimit}
          </div>
        )}
        <div className="item-actions">
          <button type="button" onClick={refresh} disabled={pending !== null}>
            {pending === "refresh" ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <form className="inspector-block" onSubmit={search}>
        <div className="inspector-title">Search Memory</div>
        <div className="inspector-field">
          <label>Query</label>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search facts, decisions, learnings..."
          />
        </div>
        <div className="inspector-field">
          <label>Namespace</label>
          <select
            value={namespaceFilter}
            onChange={(event) => setNamespaceFilter(event.target.value as NamespaceFilter)}
          >
            <option value="all">All</option>
            <option value="system">System</option>
            <option value="shared">Shared</option>
            <option value="agent">Agent/*</option>
            <option value="flow">Flow/*</option>
          </select>
        </div>
        <div className="item-actions">
          <button type="submit" disabled={pending !== null}>
            {pending === "search" ? "Searching..." : "Search"}
          </button>
        </div>
      </form>

      <form className="inspector-block" onSubmit={addMemory}>
        <div className="inspector-title">Add Memory</div>
        <div className="inspector-field">
          <label>Type</label>
          <select value={newType} onChange={(event) => setNewType(event.target.value as MemoryItemType)}>
            {MEMORY_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
        <div className="inspector-field">
          <label>Namespace</label>
          <select value={newNamespace} onChange={(event) => setNewNamespace(event.target.value as MemoryNamespace)}>
            <option value="shared">shared</option>
            <option value="system">system</option>
            <option value="agent/default">agent/default</option>
            <option value="flow/default">flow/default</option>
          </select>
        </div>
        <div className="inspector-field">
          <label>Title</label>
          <input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} />
        </div>
        <div className="inspector-field">
          <label>Content</label>
          <textarea rows={4} value={newContent} onChange={(event) => setNewContent(event.target.value)} />
        </div>
        <div className="inspector-field">
          <label>Tags (comma separated)</label>
          <input value={newTags} onChange={(event) => setNewTags(event.target.value)} />
        </div>
        <div className="inspector-field">
          <label>Importance (0-1)</label>
          <input
            type="number"
            min={0}
            max={1}
            step={0.1}
            value={newImportance}
            onChange={(event) => setNewImportance(Number(event.target.value))}
          />
        </div>
        <div className="item-actions">
          <button type="submit" disabled={pending !== null}>
            {pending === "add" ? "Adding..." : "Add"}
          </button>
        </div>
      </form>

      <div className="inspector-block">
        <div className="inspector-title">Memory Items</div>
        <div className="memory-list">
          {filteredItems.length === 0 && <div className="muted">No memory items in this filter.</div>}
          {filteredItems.map((item) => (
            <div key={item.id} className="memory-item">
              <div className="memory-item-row">
                <strong>{item.title}</strong>
                <span className="pill">{item.type}</span>
              </div>
              <div className="memory-item-meta">
                {item.namespace} · importance {item.importance.toFixed(2)} · updated {new Date(item.updatedAt).toLocaleString()}
              </div>
              <div className="memory-item-content">{item.content}</div>
              <div className="item-actions">
                <button
                  type="button"
                  onClick={() => {
                    setSupersedeTargetId((current) => (current === item.id ? undefined : item.id));
                    setSupersedeContent(item.content);
                    setSupersedeReason("manual update");
                  }}
                  disabled={pending !== null}
                >
                  {supersedeTargetId === item.id ? "Close supersede" : "Supersede"}
                </button>
              </div>
              {supersedeTargetId === item.id && (
                <div className="memory-supersede">
                  <textarea
                    rows={4}
                    value={supersedeContent}
                    onChange={(event) => setSupersedeContent(event.target.value)}
                  />
                  <input
                    value={supersedeReason}
                    onChange={(event) => setSupersedeReason(event.target.value)}
                    placeholder="Reason"
                  />
                  <div className="item-actions">
                    <button type="button" onClick={() => submitSupersede(item.id)} disabled={pending !== null}>
                      {pending === "supersede" ? "Saving..." : "Save supersede"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="inspector-block">
        <div className="inspector-title">Memory Commits</div>
        <div className="memory-list">
          {props.commits.length === 0 && <div className="muted">No memory commits found.</div>}
          {props.commits.map((commit) => (
            <div key={commit.commitId} className="memory-item">
              <div className="memory-item-row">
                <strong>{commit.message}</strong>
                <span className="pill">{commit.commitId.slice(0, 8)}</span>
              </div>
              <div className="memory-item-meta">
                {commit.author} · {new Date(commit.timestamp).toLocaleString()} · +{commit.itemsAdded.length} / ~{commit.itemsUpdated.length} / ↻{commit.itemsSuperseded.length}
              </div>
              <div className="item-actions">
                <button
                  type="button"
                  onClick={() =>
                    execute("checkout", () => props.onCheckout(commit.commitId))
                  }
                  disabled={pending !== null}
                >
                  {pending === "checkout" ? "Checking out..." : "Checkout memory"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && <div className="validation-item error">{error}</div>}
    </div>
  );
}

function namespaceFilterToQuery(filter: NamespaceFilter): MemoryNamespace[] | undefined {
  if (filter === "all") {
    return undefined;
  }
  if (filter === "system" || filter === "shared") {
    return [filter];
  }
  if (filter === "agent") {
    return ["agent/default"];
  }
  return ["flow/default"];
}

function clampImportance(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}
