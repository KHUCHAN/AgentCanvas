import { useMemo } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Edge,
  MarkerType,
  Node,
  NodeProps,
  NodeTypes,
  ReactFlowProvider
} from "reactflow";
import "reactflow/dist/style.css";
import type { AgentProfile, Task } from "../messaging/protocol";

type ScheduleViewProps = {
  runId?: string;
  tasks: Task[];
  agents: AgentProfile[];
  nowMs: number;
  selectedTaskId?: string;
  onSelectTask: (taskId?: string) => void;
  onMoveTask: (taskId: string, forceStartMs: number, forceAgentId?: string) => void;
  onPinTask: (taskId: string, pinned: boolean) => void;
};

const LANE_HEIGHT = 92;
const TASK_HEIGHT = 46;
const TASK_OFFSET_Y = 24;
const MIN_TIMELINE_WIDTH = 2200;
const TIMELINE_PADDING_MS = 300_000;
const TIMELINE_TARGET_WIDTH = 2400;
const MIN_PX_PER_SEC = 0.75;
const MAX_PX_PER_SEC = 2.4;

const nodeTypes: NodeTypes = {
  scheduleLane: ScheduleLaneNode,
  scheduleTask: ScheduleTaskNode,
  scheduleNow: ScheduleNowNode
};

export default function ScheduleView(props: ScheduleViewProps) {
  return (
    <ReactFlowProvider>
      <ScheduleCanvas {...props} />
    </ReactFlowProvider>
  );
}

function ScheduleCanvas(props: ScheduleViewProps) {
  const laneOrder = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const agent of props.agents) {
      if (seen.has(agent.id)) {
        continue;
      }
      seen.add(agent.id);
      ordered.push(agent.id);
    }
    for (const task of props.tasks) {
      if (seen.has(task.agentId)) {
        continue;
      }
      seen.add(task.agentId);
      ordered.push(task.agentId);
    }
    return ordered;
  }, [props.agents, props.tasks]);

  const laneIndex = useMemo(() => {
    return new Map(laneOrder.map((agentId, index) => [agentId, index]));
  }, [laneOrder]);

  const maxEndMs = useMemo(() => {
    let max = 0;
    for (const task of props.tasks) {
      max = Math.max(max, task.plannedEndMs ?? 0, task.actualEndMs ?? 0);
    }
    return max;
  }, [props.tasks]);

  const pxPerSec = useMemo(() => {
    const horizonSeconds = Math.max(300, (maxEndMs + TIMELINE_PADDING_MS) / 1000);
    return clampNumber(TIMELINE_TARGET_WIDTH / horizonSeconds, MIN_PX_PER_SEC, MAX_PX_PER_SEC);
  }, [maxEndMs]);

  const timelineWidth = Math.max(MIN_TIMELINE_WIDTH, timeToX(maxEndMs + TIMELINE_PADDING_MS, pxPerSec));

  const nodes = useMemo<Node[]>(() => {
    const laneNodes: Node[] = laneOrder.map((agentId, index) => {
      const agent = props.agents.find((item) => item.id === agentId);
      return {
        id: `lane:${agentId}`,
        type: "scheduleLane",
        position: { x: 0, y: index * LANE_HEIGHT },
        draggable: false,
        selectable: false,
        data: {
          label: agent?.name ?? agentId
        },
        style: {
          width: timelineWidth,
          height: LANE_HEIGHT
        }
      };
    });

    const taskNodes: Node[] = props.tasks.map((task) => {
      const lane = laneIndex.get(task.agentId) ?? 0;
      const startMs = task.plannedStartMs ?? 0;
      const endMs = task.plannedEndMs ?? startMs + (task.estimateMs ?? 120_000);
      const width = durationToW(endMs - startMs, pxPerSec);
      return {
        id: task.id,
        type: "scheduleTask",
        position: { x: timeToX(startMs, pxPerSec), y: lane * LANE_HEIGHT + TASK_OFFSET_Y },
        draggable: true,
        selectable: true,
        data: {
          task,
          selected: props.selectedTaskId === task.id
        },
        style: {
          width,
          height: TASK_HEIGHT
        }
      };
    });

    const nowHeight = Math.max(360, laneOrder.length * LANE_HEIGHT);
    const nowLineNode: Node = {
      id: `now:${props.runId ?? "run"}`,
      type: "scheduleNow",
      position: { x: timeToX(props.nowMs, pxPerSec), y: 0 },
      draggable: false,
      selectable: false,
      connectable: false,
      zIndex: 20,
      data: {
        height: nowHeight
      },
      style: {
        pointerEvents: "none",
        width: 2,
        height: nowHeight
      }
    };

    return [...laneNodes, ...taskNodes, nowLineNode];
  }, [
    laneIndex,
    laneOrder,
    props.agents,
    props.nowMs,
    props.runId,
    props.selectedTaskId,
    props.tasks,
    pxPerSec,
    timelineWidth
  ]);

  const edges = useMemo<Edge[]>(() => {
    const result: Edge[] = [];
    for (const task of props.tasks) {
      for (const depId of task.deps) {
        result.push({
          id: `dep:${depId}:${task.id}`,
          source: depId,
          target: task.id,
          type: "smoothstep",
          animated: task.status === "running",
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 16,
            height: 16,
            color: "#6aa7f5"
          },
          style: {
            stroke: "#6aa7f5",
            strokeWidth: 1.6,
            opacity: 0.65
          }
        });
      }
    }
    return result;
  }, [props.tasks]);

  if (!props.runId) {
    return (
      <div className="schedule-empty">
        <div className="empty-title">No schedule run selected</div>
        <div className="empty-subtitle">Start a run from the Run panel, then switch to Schedule.</div>
      </div>
    );
  }

  return (
    <div className="schedule-view">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        maxZoom={2.2}
        zoomOnScroll
        panOnDrag
        onNodeClick={(_event, node) => {
          if (node.type === "scheduleTask") {
            props.onSelectTask(node.id);
          } else {
            props.onSelectTask(undefined);
          }
        }}
        onPaneClick={() => props.onSelectTask(undefined)}
        onNodeDoubleClick={(_event, node) => {
          if (node.type !== "scheduleTask") {
            return;
          }
          const task = props.tasks.find((item) => item.id === node.id);
          if (!task) {
            return;
          }
          props.onPinTask(task.id, !Boolean(task.overrides?.pinned));
        }}
        onNodeDragStop={(_event, node) => {
          if (node.type !== "scheduleTask") {
            return;
          }
          const task = props.tasks.find((item) => item.id === node.id);
          if (!task) {
            return;
          }
          const lane = clamp(
            Math.round((node.position.y - TASK_OFFSET_Y) / LANE_HEIGHT),
            0,
            Math.max(0, laneOrder.length - 1)
          );
          const forceAgentId = laneOrder[lane];
          props.onMoveTask(node.id, Math.max(0, xToTime(node.position.x, pxPerSec)), forceAgentId);
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1.05} color="#9cb0a9" />
      </ReactFlow>
    </div>
  );
}

function ScheduleLaneNode(props: NodeProps<{ label: string }>) {
  return (
    <div className="schedule-lane">
      <div className="schedule-lane-label">{props.data.label}</div>
    </div>
  );
}

function ScheduleTaskNode(
  props: NodeProps<{
    task: Task;
    selected: boolean;
  }>
) {
  const task = props.data.task;
  return (
    <div
      className={[
        "schedule-task",
        `status-${task.status}`,
        props.data.selected ? "is-selected" : "",
        task.overrides?.pinned ? "is-pinned" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="schedule-task-title">{task.title}</div>
      <div className="schedule-task-meta">
        <span>{task.status}</span>
        <span>{Math.round((task.progress ?? 0) * 100)}%</span>
      </div>
    </div>
  );
}

function ScheduleNowNode(props: NodeProps<{ height: number }>) {
  return <div className="schedule-now-line" style={{ height: props.data.height }} />;
}

function timeToX(ms: number, pxPerSec: number): number {
  return (ms / 1000) * pxPerSec;
}

function xToTime(x: number, pxPerSec: number): number {
  return (x / pxPerSec) * 1000;
}

function durationToW(ms: number, pxPerSec: number): number {
  return Math.max(44, (ms / 1000) * pxPerSec);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
