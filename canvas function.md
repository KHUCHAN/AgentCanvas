0) 결론부터: “Graph Canvas”와 “Schedule Canvas”를 분리 구현

Graph Canvas: 지금처럼 에이전트 관계/위임/패턴(구조)을 보여줌

Schedule Canvas(신규): 시간축에서 “누가 무엇을 언제까지”를 보여줌
→ UI는 Swimlane(Agent별 lane) + Timeline(가로 시간축) + Task bar(막대)

이 분리를 해야 실시간 업데이트에서도 화면이 안 망가지고, UX도 명확해집니다.

1) 데이터 모델: Task를 “단일 소스 오브 트루스”로
1-1. Task 타입(Extension/웹뷰 공용)

핵심: Plan(예정)과 Actual(실제)을 분리해야 “슬립(예상 대비 지연)”이 보입니다.

export type TaskStatus =
  | "planned"     // 계획만 있음
  | "ready"       // deps 충족, 시작 가능
  | "running"     // 실행 중
  | "blocked"     // 입력/승인/외부대기/에러로 멈춤
  | "done"
  | "failed"
  | "canceled";

export type TaskBlocker =
  | { kind: "approval"; message: string }
  | { kind: "input"; message: string }
  | { kind: "external"; message: string }
  | { kind: "error"; message: string; stack?: string };

export type Task = {
  id: string;               // "task:<uuid>"
  title: string;            // UI 표시용
  agentId: string;          // lane 결정 (Agent node id와 동일하게 맞추면 편함)
  deps: string[];           // 선행 task ids (DAG)

  // 계획(스케줄러가 채움)
  estimateMs?: number;      // 없으면 unknown(막대 길이 기본값/점선)
  plannedStartMs?: number;  // run 시작 기준 상대시간(ms)
  plannedEndMs?: number;

  // 실제(러너가 채움)
  actualStartMs?: number;
  actualEndMs?: number;
  progress?: number;        // 0~1 (없으면 UI에서 시간 기반 보간 가능)

  status: TaskStatus;
  blocker?: TaskBlocker;

  // 사용자 오버라이드(드래그로 일정 조정하는 단계에서 사용)
  overrides?: {
    pinned?: boolean;
    forceStartMs?: number;
    forceAgentId?: string;
    priority?: number;
  };

  meta?: Record<string, any>; // 로그 링크/툴콜/모델 등 확장 필드
  createdAtMs: number;
  updatedAtMs: number;
};

2) 이벤트 스트림: “스냅샷 1번 + 패치 이벤트”로 실시간 구현

웹뷰에서 “실시간”을 부드럽게 보여주려면 폴링 금지, 이벤트 기반으로 갑니다.

2-1. TaskEvent(Extension → Webview)
export type TaskEvent =
  | { type: "snapshot"; runId: string; tasks: Task[]; nowMs: number }
  | { type: "task_created"; runId: string; task: Task; nowMs: number }
  | { type: "task_updated"; runId: string; taskId: string; patch: Partial<Task>; nowMs: number }
  | { type: "task_deleted"; runId: string; taskId: string; nowMs: number }
  | { type: "schedule_recomputed"; runId: string; affectedTaskIds: string[]; nowMs: number };

2-2. Webview → Extension 요청 메시지

(AgentCanvas 기존 messaging 패턴에 “타입 추가”만 하면 됨)

SCHEDULE_SUBSCRIBE { runId }

SCHEDULE_UNSUBSCRIBE { runId }

SCHEDULE_GET_SNAPSHOT { runId }

TASK_PIN { runId, taskId, pinned: boolean }

TASK_MOVE { runId, taskId, forceStartMs?, forceAgentId? } ← 드래그 편집 단계에서

TASK_SET_PRIORITY { runId, taskId, priority }

3) 스케줄러: MVP는 “DAG + agent별 단일 큐”로 충분
3-1. 기본 가정

agent 1명당 기본 동시 실행 1개(필요하면 나중에 concurrency 추가)

deps는 DAG(사이클 없음). 저장/생성 단계에서 validate.

3-2. 스케줄 계산(코드 그대로 구현 가능)
type ComputeScheduleInput = {
  tasks: Map<string, Task>;
  defaultEstimateMs: number; // estimate 없는 task 기본 길이(예: 2분)
  agentConcurrency?: Record<string, number>; // 나중 확장
};

export function computeSchedule(input: ComputeScheduleInput): { updatedIds: string[] } {
  const { tasks, defaultEstimateMs } = input;

  // 1) indegree + adjacency
  const indeg = new Map<string, number>();
  const next = new Map<string, string[]>();
  for (const [id, t] of tasks) {
    indeg.set(id, 0);
    next.set(id, []);
  }
  for (const [id, t] of tasks) {
    for (const dep of t.deps) {
      if (!tasks.has(dep)) continue; // missing dep은 validate에서 걸러도 됨
      indeg.set(id, (indeg.get(id) ?? 0) + 1);
      next.get(dep)!.push(id);
    }
  }

  // 2) topo queue
  const q: string[] = [];
  for (const [id, d] of indeg) if (d === 0) q.push(id);

  // 3) agent lane available time
  const agentAvail = new Map<string, number>(); // plannedEnd 누적

  const updated: string[] = [];

  // helper: deps end time max
  const depsEnd = (t: Task) => {
    let m = 0;
    for (const dep of t.deps) {
      const dt = tasks.get(dep);
      if (!dt) continue;
      m = Math.max(m, dt.plannedEndMs ?? 0);
    }
    return m;
  };

  // 4) topo processing
  while (q.length) {
    const id = q.shift()!;
    const t = tasks.get(id)!;

    const est = t.estimateMs ?? defaultEstimateMs;
    const earliest = Math.max(depsEnd(t), agentAvail.get(t.agentId) ?? 0);

    // overrides.forceStartMs가 있으면 그걸 우선(단, dep 위반이면 blocked 처리하거나 clamp)
    const plannedStart = t.overrides?.forceStartMs != null
      ? Math.max(t.overrides.forceStartMs, depsEnd(t))
      : earliest;

    const plannedEnd = plannedStart + est;

    // 변경 체크
    if (t.plannedStartMs !== plannedStart || t.plannedEndMs !== plannedEnd) {
      t.plannedStartMs = plannedStart;
      t.plannedEndMs = plannedEnd;
      t.updatedAtMs = Date.now();
      updated.push(id);
    }

    agentAvail.set(t.agentId, plannedEnd);

    // next
    for (const nid of next.get(id) ?? []) {
      indeg.set(nid, (indeg.get(nid) ?? 1) - 1);
      if (indeg.get(nid) === 0) q.push(nid);
    }
  }

  return { updatedIds: updated };
}


dep 위반(사이클/누락)은 반드시 실행 전 “그래프 린트”로 막아야 실시간 스케줄이 안정적입니다.

4) Extension 구현: TaskScheduleService 하나로 끝내기

AgentCanvas는 extension이 backend 역할을 하고 webview에 UI를 띄웁니다.
따라서 **Extension이 스케줄 상태의 권위(authoritative state)**를 가져야 합니다.

4-1. 새 파일/모듈 구조(추천)

extension/src/schedule/types.ts

Task, TaskEvent, 메시지 타입 정의(웹뷰와 공유할 수 있으면 공유)

extension/src/schedule/taskStore.ts

runId → tasks map, 구독자 관리

extension/src/schedule/scheduler.ts

위 computeSchedule

extension/src/schedule/scheduleService.ts

외부(러너/메시지 핸들러)에서 호출하는 파사드

4-2. scheduleService 핵심 API
class ScheduleService {
  private runs = new Map<string, Map<string, Task>>();
  private subscribers = new Map<string, Set<(ev: TaskEvent)=>void>>();

  createRun(runId: string, initialTasks: Task[]) { ... } // snapshot 생성
  upsertTask(runId: string, task: Task) { ... }
  patchTask(runId: string, taskId: string, patch: Partial<Task>) { ... }
  deleteTask(runId: string, taskId: string) { ... }

  recompute(runId: string) {
    const tasks = this.runs.get(runId);
    if (!tasks) return;
    const { updatedIds } = computeSchedule({ tasks, defaultEstimateMs: 120_000 });
    if (updatedIds.length) this.emit({ type:"schedule_recomputed", runId, affectedTaskIds: updatedIds, nowMs: Date.now() });
    // 그리고 updatedIds 각각에 대해 patch 이벤트를 보내도 되고(정밀), 
    // UI에서 snapshot 후 recompute만으로도 위치를 다시 계산하게 해도 됨(단순)
  }

  subscribe(runId: string, cb: (ev: TaskEvent)=>void) { ... } // snapshot 먼저 push
  unsubscribe(runId: string, cb: (ev: TaskEvent)=>void) { ... }

  private emit(ev: TaskEvent) { ... } // throttle(예: 50ms) 권장
}

4-3. 실시간 “부드러움”을 위한 throttle 규칙

task_progress 같은 이벤트는 1초에 2~4회 이하로 제한

나머지는 즉시 보내도 되지만, schedule_recomputed는 묶어서(예: 100ms 배치)

5) Webview UI 구현: React Flow로 “Swimlane Timeline” 만들기

AgentCanvas webview는 React + React Flow 기반입니다.
그러니 Schedule Canvas도 React Flow를 그대로 씁니다.

5-1. 좌표계(이게 핵심)

y = laneIndex * LANE_HEIGHT

x = timeToX(plannedStartMs)

bar width = durationToW(plannedEndMs - plannedStartMs)

const PX_PER_SEC = 4; // 예: 1초=4px (줌은 ReactFlow zoom으로)
const timeToX = (ms: number) => (ms / 1000) * PX_PER_SEC;
const durationToW = (ms: number) => Math.max(40, (ms / 1000) * PX_PER_SEC);


시간 단위를 “상대 ms(run 기준)”로 잡으면

리플레이/저장/복원

다른 컴퓨터에서 다시 열었을 때
모두 일관됩니다.

5-2. 노드 타입 2개만 만들면 됨
(1) LaneNode (배경 + agent label)

type: "lane"

draggable: false, selectable: false

style width는 “현재 뷰포트 + 여유” 정도로 크게

(2) TaskBarNode (막대)

type: "task"

draggable: false (편집 기능 넣을 때만 true)

style.width = durationToW(...)

status에 따라 클래스만 바꿈(색은 CSS로)

5-3. ReactFlow nodes/edges 생성(웹뷰에서)
function buildScheduleGraph(tasks: Task[], laneOrder: string[]) {
  const laneIndex = new Map(laneOrder.map((id, i) => [id, i]));

  const laneNodes = laneOrder.map((agentId, i) => ({
    id: `lane:${agentId}`,
    type: "lane",
    position: { x: 0, y: i * 84 },
    data: { agentId },
    draggable: false,
    selectable: false,
    style: { width: 5000, height: 84 } // 넉넉히
  }));

  const taskNodes = tasks.map(t => {
    const y = (laneIndex.get(t.agentId) ?? 0) * 84 + 18;
    const x = timeToX(t.plannedStartMs ?? 0);
    const w = durationToW((t.plannedEndMs ?? 0) - (t.plannedStartMs ?? 0));

    return {
      id: t.id,
      type: "task",
      position: { x, y },
      data: { taskId: t.id },
      draggable: false,
      style: { width: w, height: 48 }
    };
  });

  // deps edges(기본은 cross-agent만 표시 추천)
  const edges = tasks.flatMap(t => {
    return t.deps.map(depId => ({
      id: `e:${depId}->${t.id}`,
      source: depId,
      target: t.id,
      type: "smoothstep",
      animated: t.status === "running",
    }));
  });

  return { nodes: [...laneNodes, ...taskNodes], edges };
}

5-4. Now Line(현재 시간선) 오버레이

React Flow 위에 absolute div로 그리면 가장 단순합니다.

nowMs는 extension이 이벤트에 계속 넣어주거나,

webview에서 requestAnimationFrame/setInterval(250ms)로 증가시켜도 됨
(실제 값은 1초에 한 번만 받아도 “실시간처럼” 보임)

오버레이 좌표 변환:

React Flow viewport transform: { x: tx, y: ty, zoom }

worldX → screenX: screenX = worldX * zoom + tx

const NowLineOverlay = ({ nowMs }: { nowMs: number }) => {
  const { x: tx, y: ty, zoom } = useViewport(); // 버전에 따라 훅 이름 다를 수 있음
  const worldX = timeToX(nowMs);
  const screenX = worldX * zoom + tx;

  return (
    <div
      style={{
        position: "absolute",
        left: screenX,
        top: 0,
        bottom: 0,
        width: 2,
        pointerEvents: "none",
      }}
      className="nowLine"
    />
  );
};

6) 실시간 업데이트 파이프라인: “tasks Map” + “파생 nodes” + “애니메이션”
6-1. 웹뷰 상태(추천)

const tasksById = useRef(new Map<string, Task>())

이벤트 들어오면 Map을 갱신

nodes/edges는 useMemo로 매번 재생성하거나,

규모가 커지면 “변경된 task만 node patch”하는 방식으로 최적화

MVP는 useMemo 재생성으로도 충분합니다(수백 task까지).

6-2. 지터(막대가 자꾸 흔들림) 방지

스케줄이 재계산될 때 막대가 순간이동하면 UX가 최악이 되기 쉬워요.

task node 스타일에 transition: transform 120ms linear 적용

혹은 “recompute는 200ms throttle”로 덜 흔들리게

7) 태스크 생성 전략(이게 제품 완성도를 결정)

실시간 스케줄이 “예쁘게” 보이려면 task가 “그럴듯하게” 생성돼야 합니다.

MVP: 시스템이 만드는 최소 태스크

orchestrator가 worker에게 위임하는 순간:

task_created(title=“<agent> 작업”, agentId=worker)

dep는 orchestrator task에 연결

각 agent가 실제 CLI 호출을 시작하면:

task_started

출력 받으면:

task_done or task_failed

이 방식은 모델 출력 파싱 없이도 안정적.

확장: Plan 턴(LLM이 태스크 JSON 생성) + Validate

오케스트레이터가 “실행 전에” 다음 JSON을 만들게 함:

[{title, agentId, deps, estimateMs}]

extension이 JSON 스키마 검증 + DAG 검증 통과 시 schedule 생성

실패하면 MVP 방식으로 fallback

8) “바로 개발” 체크리스트
8-1. Extension

ScheduleService 추가 (in-memory + 이벤트 emit)

webview 메시지 핸들러에:

subscribe/unsubscribe/snapshot/pin/move 구현

“테스트용” 커맨드 하나 추가:

AgentCanvas: Demo Schedule Run
→ 10개 task 만들어서 3개 agent lane에 배치 + 1초마다 progress 업데이트

8-2. Webview

오른쪽 패널 탭에 Schedule 추가 (AgentCanvas는 패널/탭 구조가 이미 있음 )

ScheduleView.tsx:

ReactFlow instance

LaneNode / TaskNode 등록

NowLineOverlay 추가

Inspector 연동:

task 클릭 → taskId로 상세 표시(상태/블로커/로그 링크)

9) 다음 단계(선택): “드래그로 재스케줄” 넣는 방법

TaskBarNode를 draggable: true로 바꾸고,

드래그 종료 시:

worldX -> timeMs 역변환

TASK_MOVE(runId, taskId, forceStartMs)를 extension으로 전송

extension은

task.overrides.forceStartMs 갱신

computeSchedule() 재실행

schedule_recomputed + patch 전송