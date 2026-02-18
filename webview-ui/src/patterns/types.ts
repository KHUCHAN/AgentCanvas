export type InteractionTopology =
  | "p2p"
  | "manager_worker"
  | "pipeline"
  | "blackboard"
  | "market_auction"
  | "debate_judge"
  | "broker"
  | "router_targeted"
  | "broadcast";

export type MessageForm = "nl_text" | "structured_json" | "acl_performative" | "multimodal";

export type SyncMode = "turn_based" | "req_res" | "async" | "streaming";

export type Termination =
  | { type: "max_rounds"; rounds: number }
  | { type: "timeout_ms"; ms: number }
  | { type: "judge_decision" }
  | { type: "consensus_threshold"; threshold: number }
  | { type: "quality_gate"; metric: string; op: ">=" | "<="; value: number };

export type InteractionEdgeData = {
  patternId: string;
  topology: InteractionTopology;
  messageForm: MessageForm;
  sync: SyncMode;
  termination: Termination;
  params: Record<string, unknown>;
  observability: {
    logs: boolean;
    traces: boolean;
    retain_days?: number;
  };
};

export type PatternTemplate = {
  id: string;
  name: string;
  summary?: string;
  nodes: Array<{
    type: "agent" | "system";
    id: string;
    data: Record<string, unknown>;
    position?: { x: number; y: number };
  }>;
  edges: Array<{
    type: "interaction";
    id: string;
    source: string;
    target: string;
    label?: string;
    data: InteractionEdgeData;
  }>;
  sources?: Array<{ kind: string; ref: string; note?: string }>;
};

export type PatternIndexItem = {
  id: string;
  name: string;
  summary?: string;
  topology?: string;
  nodeCount?: number;
  edgeCount?: number;
  termination?: Record<string, unknown>;
};
