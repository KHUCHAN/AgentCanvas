import {
  type DragEvent as ReactDragEvent,
  type WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Connection,
  ConnectionMode,
  Edge,
  MarkerType,
  Node,
  NodeMouseHandler,
  NodeTypes,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow
} from "reactflow";
import "reactflow/dist/style.css";
import emptyState from "../assets/agentcanvas_empty_state.png";
import type { DiscoverySnapshot, Position, StudioNode } from "../messaging/protocol";
import AgentNode from "./nodes/AgentNode";
import CommonRulesNode from "./nodes/CommonRulesNode";
import FolderNode from "./nodes/FolderNode";
import NoteNode from "./nodes/NoteNode";
import ProviderNode from "./nodes/ProviderNode";
import RuleDocNode from "./nodes/RuleDocNode";
import SkillNode from "./nodes/SkillNode";
import SystemNode from "./nodes/SystemNode";
import { applyDagreLayout } from "./layout/dagreLayout";
import { applyTidyLayout } from "./layout/tidyLayout";

type GraphViewProps = {
  snapshot?: DiscoverySnapshot;
  hiddenNodeIds: Set<string>;
  onSelectNode: (node?: Node) => void;
  onSelectEdge: (edge?: Edge) => void;
  onOpenFile: (path: string) => void;
  onCreateOverride: (path: string) => void;
  onToggleSkill: (skillId: string, enabled: boolean) => void;
  onHideNode: (nodeId: string) => void;
  onToggleLibrary: () => void;
  onAddCommonRule: () => void;
  onRevealPath: (path: string) => void;
  onExportSkill: (skillId: string) => void;
  onToggleCommandBar: () => void;
  onCreateNote: (position: Position, text?: string) => void;
  onSaveNote: (noteId: string, text: string, position?: Position) => void;
  onDeleteNote: (noteId: string) => void;
  onDuplicateNote: (text: string, position: Position) => void;
  onScanWorkspace: () => void;
  onImportPack: () => void;
  onEnsureRootAgents: () => void;
  onOpenCommonRulesFolder: () => void;
  onCreateCommonRuleDocs: () => void;
  onAddAgentLink: (sourceAgentId: string, targetAgentId: string) => void;
  onOpenAgentDetail: (agentId: string, agentName: string) => void;
  onAssignSkillToAgent: (agentId: string, skillId: string) => void;
  onAssignMcpToAgent: (agentId: string, mcpServerId: string) => void;
  onDropPattern: (patternId: string, position: Position) => void;
};

const nodeTypes: NodeTypes = {
  agent: AgentNode,
  provider: ProviderNode,
  commonRules: CommonRulesNode,
  skill: SkillNode,
  ruleDoc: RuleDocNode,
  note: NoteNode,
  folder: FolderNode,
  system: SystemNode
};

type EdgePalette = {
  contains: string;
  overrides: string;
  locatedIn: string;
  appliesTo: string;
  agentLink: string;
  delegates: string;
  interaction: string;
};

export default function GraphView(props: GraphViewProps) {
  return (
    <ReactFlowProvider>
      <GraphCanvas {...props} />
    </ReactFlowProvider>
  );
}

function GraphCanvas({
  snapshot,
  hiddenNodeIds,
  onSelectNode,
  onSelectEdge,
  onOpenFile,
  onCreateOverride,
  onToggleSkill,
  onHideNode,
  onToggleLibrary,
  onAddCommonRule,
  onRevealPath,
  onExportSkill,
  onToggleCommandBar,
  onCreateNote,
  onSaveNote,
  onDeleteNote,
  onDuplicateNote,
  onScanWorkspace,
  onImportPack,
  onEnsureRootAgents,
  onOpenCommonRulesFolder,
  onCreateCommonRuleDocs,
  onAddAgentLink,
  onOpenAgentDetail,
  onAssignSkillToAgent,
  onAssignMcpToAgent,
  onDropPattern
}: GraphViewProps) {
  const reactFlow = useReactFlow();
  const [panModifierActive, setPanModifierActive] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string>();

  const mappedNodes = useMemo(
    () =>
      toFlowNodes(snapshot?.nodes ?? [], hiddenNodeIds, {
        onOpenFile,
        onCreateOverride,
        onToggleSkill,
        onHideNode,
        onRevealPath,
        onExportSkill,
        onSaveNote,
        onDeleteNote,
        onDuplicateNote,
        onEnsureRootAgents,
        onOpenCommonRulesFolder,
        onCreateCommonRuleDocs,
        onAssignSkillToAgent,
        onAssignMcpToAgent
      }),
    [
      hiddenNodeIds,
      onCreateOverride,
      onDeleteNote,
      onDuplicateNote,
      onEnsureRootAgents,
      onOpenCommonRulesFolder,
      onCreateCommonRuleDocs,
      onAssignSkillToAgent,
      onAssignMcpToAgent,
      onExportSkill,
      onHideNode,
      onOpenFile,
      onRevealPath,
      onSaveNote,
      onToggleSkill,
      snapshot?.nodes
    ]
  );

  const edgePalette = useMemo(() => resolveEdgePalette(), []);
  const gridDotColor = useMemo(() => resolveGridDotColor(), []);

  const mappedEdges = useMemo(
    () => toFlowEdges(snapshot?.edges ?? [], hiddenNodeIds, edgePalette),
    [snapshot?.edges, hiddenNodeIds, edgePalette]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(mappedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(mappedEdges);

  useEffect(() => {
    setNodes(mappedNodes);
    setEdges(mappedEdges);
  }, [mappedEdges, mappedNodes, setEdges, setNodes]);

  useEffect(() => {
    if (!selectedNodeId) {
      return;
    }
    const stillExists = nodes.some((node) => node.id === selectedNodeId);
    if (!stillExists) {
      setSelectedNodeId(undefined);
      onSelectNode(undefined);
    }
  }, [nodes, onSelectNode, selectedNodeId]);

  const onNodeClick = useCallback<NodeMouseHandler>(
    (_event, node) => {
      setSelectedNodeId(node.id);
      onSelectNode(node);
      onSelectEdge(undefined);
    },
    [onSelectEdge, onSelectNode]
  );

  const onNodeDoubleClick = useCallback<NodeMouseHandler>(
    (_event, node) => {
      const data = node.data as Record<string, unknown>;
      if (typeof data.path === "string" && (node.type === "skill" || node.type === "ruleDoc")) {
        onOpenFile(data.path);
      }
      if (typeof data.path === "string" && node.type === "folder") {
        onRevealPath(data.path);
      }
      if (node.type === "agent") {
        onOpenAgentDetail(
          String(data.id ?? node.id),
          String(data.name ?? "Agent")
        );
      }
    },
    [onOpenFile, onOpenAgentDetail, onRevealPath]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      const sourceNode = nodes.find((n) => n.id === params.source);
      const targetNode = nodes.find((n) => n.id === params.target);
      if (
        sourceNode?.type === "agent" &&
        targetNode?.type === "agent" &&
        params.source &&
        params.target &&
        params.source !== params.target
      ) {
        onAddAgentLink(params.source, params.target);
      }
    },
    [nodes, onAddAgentLink]
  );

  const addNote = useCallback(() => {
    const viewportCenter = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    };
    const position = reactFlow.screenToFlowPosition(viewportCenter);
    onCreateNote(position, "Quick note");
  }, [onCreateNote, reactFlow]);

  const tidyLayout = useCallback(() => {
    setNodes((currentNodes) => applyTidyLayout(currentNodes, edges));
  }, [edges, setNodes]);

  const autoLayout = useCallback(() => {
    setNodes((currentNodes) => applyDagreLayout(currentNodes, edges));
  }, [edges, setNodes]);

  const selectNode = useCallback(
    (node: Node | undefined) => {
      if (!node) {
        setSelectedNodeId(undefined);
        onSelectNode(undefined);
        return;
      }
      setSelectedNodeId(node.id);
      onSelectNode(node);
      const center = getNodeCenter(node);
      reactFlow.setCenter(center.x, center.y, { duration: 120 });
    },
    [onSelectNode, reactFlow]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTextInput =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.getAttribute("contenteditable") === "true";

      const hasOpenModal = Boolean(document.querySelector(".command-overlay"));
      if (hasOpenModal) {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && !isTextInput) {
        event.preventDefault();
        onToggleCommandBar();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "l" && !isTextInput) {
        event.preventDefault();
        onToggleLibrary();
        return;
      }

      if (event.key === "Control" || event.key === " ") {
        setPanModifierActive(true);
      }

      if (isTextInput) {
        return;
      }

      const selectedNode = nodes.find((node) => node.id === selectedNodeId);

      if (event.key === "Escape" && selectedNode) {
        event.preventDefault();
        selectNode(undefined);
        return;
      }

      if (event.key === "Enter" && selectedNode) {
        event.preventDefault();
        const data = selectedNode.data as Record<string, unknown>;
        if (typeof data.path === "string" && (selectedNode.type === "skill" || selectedNode.type === "ruleDoc")) {
          onOpenFile(data.path);
        } else if (typeof data.path === "string" && selectedNode.type === "folder") {
          onRevealPath(data.path);
        } else if (selectedNode.type === "agent") {
          onOpenAgentDetail(
            String(data.id ?? selectedNode.id),
            String(data.name ?? "Agent")
          );
        }
        return;
      }

      if ((event.key === "Delete" || event.key === "Backspace") && selectedNode?.type === "note") {
        event.preventDefault();
        onDeleteNote(selectedNode.id);
        selectNode(undefined);
        return;
      }

      if (
        (event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "ArrowLeft" || event.key === "ArrowRight") &&
        selectedNode
      ) {
        event.preventDefault();
        const nextNode = findDirectionalNode(selectedNode, nodes, event.key);
        if (nextNode) {
          selectNode(nextNode);
        }
        return;
      }

      if (event.key === "=" || event.key === "+") {
        event.preventDefault();
        reactFlow.zoomIn();
      } else if (event.key === "-") {
        event.preventDefault();
        reactFlow.zoomOut();
      } else if (event.key === "0") {
        event.preventDefault();
        reactFlow.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 200 });
      } else if (event.key === "1") {
        event.preventDefault();
        reactFlow.fitView({ duration: 200, padding: 0.2 });
      } else if (event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        addNote();
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Control" || event.key === " ") {
        setPanModifierActive(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [
    addNote,
    nodes,
    onDeleteNote,
    onOpenAgentDetail,
    onOpenFile,
    onRevealPath,
    onToggleCommandBar,
    onToggleLibrary,
    reactFlow,
    selectNode,
    selectedNodeId
  ]);

  const onCanvasWheelCapture = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }

      event.preventDefault();
      if (event.deltaY > 0) {
        reactFlow.zoomOut({ duration: 50 });
      } else {
        reactFlow.zoomIn({ duration: 50 });
      }
    },
    [reactFlow]
  );

  const onCanvasDragOverCapture = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes("application/agentcanvas-pattern")) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const onCanvasDropCapture = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      const payload = event.dataTransfer.getData("application/agentcanvas-pattern");
      if (!payload) {
        return;
      }
      try {
        const parsed = JSON.parse(payload) as { id?: string };
        if (!parsed.id) {
          return;
        }
        event.preventDefault();
        const position = reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
        onDropPattern(parsed.id, position);
      } catch {
        // ignore malformed drop payload
      }
    },
    [onDropPattern, reactFlow]
  );

  const isEmpty = (snapshot?.skills.length ?? 0) === 0 && (snapshot?.ruleDocs.length ?? 0) === 0;

  return (
    <div
      className="graph-view"
      onWheelCapture={onCanvasWheelCapture}
      onDragOverCapture={onCanvasDragOverCapture}
      onDropCapture={onCanvasDropCapture}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={(_event, edge) => {
          onSelectEdge(edge);
          onSelectNode(undefined);
          setSelectedNodeId(undefined);
        }}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={() => {
          selectNode(undefined);
          onSelectEdge(undefined);
        }}
        onNodeDragStop={(_event, node) => {
          if (node.type !== "note") {
            return;
          }
          const data = node.data as Record<string, unknown>;
          onSaveNote(node.id, String(data.text ?? ""), {
            x: node.position.x,
            y: node.position.y
          });
        }}
        fitView
        minZoom={0.2}
        maxZoom={2.2}
        connectionMode={ConnectionMode.Loose}
        proOptions={{ hideAttribution: true }}
        panOnDrag={panModifierActive ? [0, 1, 2] : [1, 2]}
        nodesDraggable={!panModifierActive}
        selectionOnDrag={!panModifierActive}
        zoomOnScroll={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1.1} color={gridDotColor} />
      </ReactFlow>

      {isEmpty && (
        <div className="empty-placeholder">
          <img src={emptyState} alt="" className="empty-illustration" />
          <div className="empty-title">Add first step</div>
          <div className="empty-subtitle">Discover skills and rules in one click</div>
          <div className="empty-actions">
            <button onClick={onScanWorkspace}>Scan workspace</button>
            <button onClick={onToggleLibrary}>Create new Skill</button>
            <button onClick={onImportPack}>Import Pack</button>
          </div>
        </div>
      )}

      <div className="canvas-top-actions">
        <button
          className="canvas-plus"
          onClick={onToggleLibrary}
          title="Open node library (Ctrl/Cmd+L)"
          aria-label="Open node library"
        >
          +
        </button>
        <button
          className="canvas-common-rule"
          onClick={onAddCommonRule}
          title="Add common rule"
          aria-label="Add common rule"
        >
          + Rule
        </button>
      </div>

      <div className="canvas-controls">
        <button
          onClick={() => reactFlow.fitView({ duration: 180, padding: 0.2 })}
          title="Fit (1)"
          aria-label="Fit view"
        >
          1
        </button>
        <button onClick={() => reactFlow.zoomIn()} title="Zoom in (+)" aria-label="Zoom in">
          +
        </button>
        <button onClick={() => reactFlow.zoomOut()} title="Zoom out (-)" aria-label="Zoom out">
          -
        </button>
        <button
          onClick={() => reactFlow.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 180 })}
          title="Reset (0)"
          aria-label="Reset view"
        >
          0
        </button>
        <button onClick={tidyLayout} title="Tidy up" aria-label="Tidy layout">
          Tidy
        </button>
        <button onClick={autoLayout} title="Auto layout (dagre)" aria-label="Auto layout">
          Auto
        </button>
      </div>

      <div className="canvas-note-shortcut">Space/Ctrl+drag pan, Ctrl+Wheel zoom, Ctrl/Cmd+L library, Shift+S note</div>
    </div>
  );
}

function toFlowNodes(
  nodes: StudioNode[],
  hiddenNodeIds: Set<string>,
  handlers: {
    onOpenFile: (path: string) => void;
    onCreateOverride: (path: string) => void;
    onToggleSkill: (skillId: string, enabled: boolean) => void;
    onHideNode: (nodeId: string) => void;
    onRevealPath: (path: string) => void;
    onExportSkill: (skillId: string) => void;
    onSaveNote: (noteId: string, text: string) => void;
    onDeleteNote: (noteId: string) => void;
    onDuplicateNote: (text: string, position: Position) => void;
    onEnsureRootAgents: () => void;
    onOpenCommonRulesFolder: () => void;
    onCreateCommonRuleDocs: () => void;
    onAssignSkillToAgent: (agentId: string, skillId: string) => void;
    onAssignMcpToAgent: (agentId: string, mcpServerId: string) => void;
  }
): Node[] {
  return nodes
    .filter((node) => !hiddenNodeIds.has(node.id))
    .map((node) => {
      if (node.type === "skill") {
        return {
          ...node,
          data: {
            ...node.data,
            onOpen: handlers.onOpenFile,
            onToggle: handlers.onToggleSkill,
            onRemove: handlers.onHideNode,
            onReveal: handlers.onRevealPath,
            onExport: handlers.onExportSkill
          }
        } satisfies Node;
      }

      if (node.type === "agent") {
        return {
          ...node,
          data: {
            ...node.data,
            onAssignSkill: handlers.onAssignSkillToAgent,
            onAssignMcp: handlers.onAssignMcpToAgent
          }
        } satisfies Node;
      }

      if (node.type === "ruleDoc") {
        return {
          ...node,
          data: {
            ...node.data,
            onOpen: handlers.onOpenFile,
            onCreateOverride: handlers.onCreateOverride,
            onRemove: handlers.onHideNode,
            onReveal: handlers.onRevealPath
          }
        } satisfies Node;
      }

      if (node.type === "folder") {
        return {
          ...node,
          data: {
            ...node.data,
            onReveal: handlers.onRevealPath
          }
        } satisfies Node;
      }

      if (node.type === "note") {
        const position = node.position;
        return {
          ...node,
          data: {
            ...node.data,
            onSave: handlers.onSaveNote,
            onRemove: handlers.onDeleteNote,
            onDuplicate: (text: string) => handlers.onDuplicateNote(text, {
              x: position.x + 40,
              y: position.y + 40
            })
          }
        } satisfies Node;
      }

      if (node.type === "commonRules") {
        return {
          ...node,
          data: {
            ...node.data,
            onOpenRootAgents: handlers.onEnsureRootAgents,
            onOpenCommonRulesFolder: handlers.onOpenCommonRulesFolder,
            onCreateCommonRuleDocs: handlers.onCreateCommonRuleDocs
          }
        } satisfies Node;
      }

      return node as Node;
    });
}

function toFlowEdges(
  edges: DiscoverySnapshot["edges"],
  hiddenNodeIds: Set<string>,
  palette: EdgePalette
): Edge[] {
  return edges
    .filter((edge) => !hiddenNodeIds.has(edge.source) && !hiddenNodeIds.has(edge.target))
    .map((edge) => ({
      ...edge,
      animated: edge.type === "contains" || edge.type === "agentLink" || edge.type === "interaction",
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 18,
        height: 18,
        color:
          edge.type === "overrides"
            ? palette.overrides
            : edge.type === "locatedIn"
              ? palette.locatedIn
              : edge.type === "appliesTo"
                ? palette.appliesTo
                : edge.type === "agentLink"
                  ? palette.agentLink
                  : edge.type === "delegates"
                    ? palette.delegates
                    : edge.type === "interaction"
                      ? palette.interaction
                  : palette.contains
      },
      style:
        edge.type === "overrides"
          ? { stroke: palette.overrides, strokeWidth: 2, strokeDasharray: "5 3" }
          : edge.type === "locatedIn"
            ? { stroke: palette.locatedIn, strokeWidth: 1.5, strokeDasharray: "2 2" }
            : edge.type === "appliesTo"
              ? { stroke: palette.appliesTo, strokeWidth: 1.8, strokeDasharray: "4 3" }
              : edge.type === "agentLink"
                ? { stroke: palette.agentLink, strokeWidth: 2.5, strokeDasharray: "6 4" }
                : edge.type === "delegates"
                  ? { stroke: palette.delegates, strokeWidth: 3 }
                  : edge.type === "interaction"
                    ? { stroke: palette.interaction, strokeWidth: 2.4, strokeDasharray: "3 3" }
                : { stroke: palette.contains, strokeWidth: 2 }
    }));
}

function resolveEdgePalette(): EdgePalette {
  const style = getComputedStyle(document.documentElement);
  return {
    contains: style.getPropertyValue("--edge-contains").trim() || "#2fa184",
    overrides: style.getPropertyValue("--edge-overrides").trim() || "#de9f30",
    locatedIn: style.getPropertyValue("--edge-located").trim() || "#6d7fd8",
    appliesTo: style.getPropertyValue("--edge-applies-to").trim() || "#4a87e8",
    agentLink: style.getPropertyValue("--edge-agent-link").trim() || "#4a87e8",
    delegates: style.getPropertyValue("--edge-delegates").trim() || "#e8a64a",
    interaction: style.getPropertyValue("--edge-interaction").trim() || "#9a6fe8"
  };
}

function resolveGridDotColor(): string {
  const style = getComputedStyle(document.documentElement);
  return style.getPropertyValue("--line-strong").trim() || "#9cb0a9";
}

function getNodeCenter(node: Node): { x: number; y: number } {
  const width = node.width ?? 230;
  const height = node.height ?? 90;
  return {
    x: node.position.x + width / 2,
    y: node.position.y + height / 2
  };
}

function findDirectionalNode(
  currentNode: Node,
  nodes: Node[],
  direction: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight"
): Node | undefined {
  const current = getNodeCenter(currentNode);
  const directionVector =
    direction === "ArrowUp"
      ? { x: 0, y: -1 }
      : direction === "ArrowDown"
        ? { x: 0, y: 1 }
        : direction === "ArrowLeft"
          ? { x: -1, y: 0 }
          : { x: 1, y: 0 };

  let best: { node: Node; score: number } | undefined;

  for (const candidate of nodes) {
    if (candidate.id === currentNode.id) {
      continue;
    }

    const center = getNodeCenter(candidate);
    const dx = center.x - current.x;
    const dy = center.y - current.y;
    const primary = dx * directionVector.x + dy * directionVector.y;
    if (primary <= 0) {
      continue;
    }

    const cross =
      directionVector.x !== 0
        ? Math.abs(dy)
        : Math.abs(dx);
    const distance = Math.hypot(dx, dy);
    const score = primary - cross * 1.15 - distance * 0.05;

    if (!best || score > best.score) {
      best = { node: candidate, score };
    }
  }

  return best?.node;
}
