import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "reactflow";

const NODE_SIZE: Record<string, { w: number; h: number }> = {
  agent: { w: 230, h: 120 },
  provider: { w: 230, h: 140 },
  commonRules: { w: 320, h: 230 },
  ruleDoc: { w: 230, h: 150 },
  skill: { w: 230, h: 190 },
  folder: { w: 230, h: 140 },
  note: { w: 230, h: 220 }
};

export function applyDagreLayout(nodes: Node[], edges: Edge[]): Node[] {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: "LR",
    nodesep: 56,
    ranksep: 96,
    marginx: 30,
    marginy: 30
  });

  for (const node of nodes) {
    const size = NODE_SIZE[node.type ?? ""] ?? { w: 230, h: 140 };
    graph.setNode(node.id, {
      width: node.width ?? size.w,
      height: node.height ?? size.h
    });
  }

  for (const edge of edges) {
    graph.setEdge(edge.source, edge.target);
  }

  dagre.layout(graph);

  return nodes.map((node) => {
    if (Boolean((node.data as Record<string, unknown>)?.pinned)) {
      return node;
    }
    if (node.type === "note") {
      return node;
    }

    const positioned = graph.node(node.id);
    if (!positioned) {
      return node;
    }

    const width = node.width ?? positioned.width ?? 230;
    const height = node.height ?? positioned.height ?? 140;
    return {
      ...node,
      position: {
        x: positioned.x - width / 2,
        y: positioned.y - height / 2
      }
    };
  });
}
