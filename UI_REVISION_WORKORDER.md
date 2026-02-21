# AgentCanvas UI 개정 작업지시서

**작성일:** 2026-02-20
**근거:** 실제 빌드된 UI 스크린샷 기반 리뷰
**관련 문서:** UI.md §2.3, UX.md §10 (REV-1~7)

---

## 요약

실제 UI 리뷰 결과 7가지 문제가 발견되었습니다. 이 문서는 각 문제의 원인, 수정 방법, 영향 파일, 구현 순서를 정의합니다.

### 변경 전/후 비교

```
[ 변경 전 — 현재 구현 ]

┌─────────────────────────────────────────────────────────────────────────┐
│ AgentCanvas  [Kanban│Graph│Schedule]                Settings  Command Bar│
├─────────────────────────────────────────────────────────────────────────┤
│  [+] [+ Rule]                                                           │
│                                                                         │
│         ┌──────────────┐     ┌──────────────┐                           │
│         │ Backend Coder│     │ Common Rules │                           │
│         │ Skills 1     │     │ (리스트)      │   [Node Library]          │
│         └──────┬───────┘     └──────────────┘   [Inspector] ← 스크롤 ✗  │
│                │                                 [AI Prompt] ← 불필요    │
│         ┌──────┴───────┐                         [Run]                   │
│         │ Frontend     │                         [Memory] ← 불필요      │
│         │ Coder        │                                                 │
│         └──────┬───────┘     (정적 구조도)                                │
│                │             (모니터링 기능 없음)                          │
│         ┌──────┴───────┐                                                 │
│         │ Orchestrator │                                                 │
│         └──────┬───────┘                                                 │
│                │                                                         │
│         ┌──────┴───────┐                                                 │
│         │ QA Tester    │                                                 │
│         └──────────────┘                                                 │
│  (Agent 추가 버튼 없음, 더블클릭 동작 없음, 태스크 지시 불가)               │
├─────────────────────────────────────────────────────────────────────────┤
│  Skills 8 · Rules 1 · Errors 0 · ...                                    │
└─────────────────────────────────────────────────────────────────────────┘


[ 변경 후 — 목표 ]

┌─────────────────────────────────────────────────────────────────────────┐
│ 🟢 AgentCanvas   [Kanban│Graph│Schedule]               ⚙ Settings  ⌘K  │
├─────────────────────────────────────────────────────────────────────────┤
│  [+] [+ Agent★] [+ Rule]                                               │
│                                                                         │
│   ┌──────────────┐     ┌──────────────┐                                 │
│   │🤖 Orchestrator│────→│🔧 Coder      │    ┌─ Right Panel ──────────┐  │
│   │ ██████░░ 75% │     │ ⚡ working    │    │ [Library│Inspector│    │  │
│   │ ⭐ 리더       │     │ 프로그레스 바   │    │  Task★│Run]            │  │
│   └──────┬───────┘     └──────────────┘    │                          │  │
│          │ ← 위임 엣지 하이라이트            │ TASK ─────────────────  │  │
│   ┌──────┴───────┐     ┌──────────────┐    │ ┌─────────────────────┐ │  │
│   │🧪 Tester     │     │ Common Rules │    │ │ "이 PR 리뷰해줘"    │ │  │
│   │ 💤 idle       │     │              │    │ └─────────────────────┘ │  │
│   └──────────────┘     └──────────────┘    │ [▶ Submit Work]            │  │
│                                             │                          │  │
│   (더블클릭 → AgentDetailModal 팝업)         │ HISTORY ───────────────  │  │
│   (실시간 상태 + 이펙트 SVG 활용)             │ · PR #42 — 완료 (3m)   │  │
│                                             │ · 리팩터링 — 실행 중... │  │
│   ┌───────────────────────────────────────┐ │  (overflow-y: auto ✓)  │  │
│   │  Build Team Prompt (항상 표시, 하단)    │ └────────────────────────┘  │
│   │  ┌──────────────────────┐  [▶ Build] │                              │
│   │  │ "풀스택 팀 만들어줘"   │            │                              │
│   │  └──────────────────────┘            │                              │
│   └───────────────────────────────────────┘                              │
├─────────────────────────────────────────────────────────────────────────┤
│  Agents 4 · Tasks 5 · Done 2 · Errors 0                 [▶ Build New]  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## TASK-1: 스크롤 시스템 구현

**우선순위:** 🔴 P0 (모든 패널에 영향)
**예상 공수:** 0.5일

### 문제

오른쪽 패널의 콘텐츠가 패널 높이를 초과해도 스크롤이 동작하지 않음. Inspector, Library, Run History 등에서 콘텐츠가 잘림.

### 원인

`RightPanel.tsx` 및 하위 패널들의 CSS에서 `overflow: auto`가 선언되어 있으나, 부모 컨테이너에 높이 제한(`max-height`, `flex` 기반)이 설정되지 않아 `overflow`가 실질적으로 동작하지 않음.

### 수정 방법

**파일: `webview-ui/src/styles.css`**

```css
/* 오른쪽 패널 루트 — flex column으로 높이 100% 차지 */
.right-panel {
  display: flex;
  flex-direction: column;
  height: 100%;           /* 부모(grid cell)에서 받은 높이 */
  min-height: 0;          /* flex 아이템이 축소 가능하도록 */
}

/* 탭 헤더 — 고정 높이 */
.right-panel-tabs {
  flex-shrink: 0;
}

/* 패널 콘텐츠 — 남은 공간 차지 + 스크롤 */
.panel-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;          /* 핵심: flex 아이템 축소 허용 */
}
```

**파일: `webview-ui/src/panels/RightPanel.tsx`**

각 패널 모드의 루트에 `.panel-content` 클래스가 일관적으로 적용되어 있는지 확인. 누락된 경우 래퍼 추가.

### 확인 기준

- [ ] Inspector에서 노드 프로퍼티가 10개 이상일 때 세로 스크롤 동작
- [ ] Library에서 스킬 목록이 20개 이상일 때 세로 스크롤 동작
- [ ] Run History에서 실행 기록이 화면 높이 초과 시 스크롤 동작
- [ ] 각 패널 탭 전환 시 스크롤 위치 초기화

---

## TASK-2: AI Prompt 탭 삭제 → 캔버스 하단 Build Prompt 상시 배치

**우선순위:** 🔴 P0 (핵심 워크플로우 변경)
**예상 공수:** 1.5일

### 변경 내용

1. 오른쪽 패널에서 "AI Prompt" 탭 완전 제거
2. 캔버스 영역 하단 가운데에 Build Team 프롬프트를 **항상** 표시
3. 팀 미생성 시: 전체 크기 프롬프트 (현재 BuildPrompt.tsx 기반)
4. 팀 존재 시: 축소형 프롬프트 바 (1줄 입력 + Rebuild 버튼)

### 수정 파일

**1. `webview-ui/src/panels/RightPanel.tsx`**

```typescript
// 삭제: mode === "prompt" 관련 코드 전체
// 삭제: 탭 버튼 중 "AI Prompt" 항목
// tabs 배열에서 { id: "prompt", label: "AI Prompt" } 제거
```

**2. `webview-ui/src/components/BuildPromptBar.tsx` (신규 생성)**

```typescript
interface BuildPromptBarProps {
  hasTeam: boolean;                    // 팀 존재 여부
  prompt: string;                      // 프롬프트 텍스트
  onPromptChange: (val: string) => void;
  onBuildTeam: () => void;             // 빌드/리빌드 실행
  backends: CliBackend[];              // 선택 가능한 백엔드
  selectedBackend: string;
  onBackendChange: (id: string) => void;
  isBuilding: boolean;                 // 빌드 진행 중
  progress?: GenerationProgress;       // 진행 상태
}
```

- 팀 미생성 시: 큰 카드 형태 (560px 너비, 건간 빌드 프롬프트 + 퀵 템플릿 칩 + 백엔드 선택)
- 팀 존재 시: 하단 바 형태 (캔버스 너비 80%, 높이 48px, 입력 + [▶ Rebuild])
- 위치: 캔버스 영역 하단 가운데, `position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%)`

**3. `webview-ui/src/App.tsx`**

```typescript
// GraphView/KanbanView/ScheduleView 내부가 아닌,
// 캔버스 영역 컨테이너 안에 오버레이로 배치
<div className="canvas-area" style={{ position: "relative" }}>
  {activeView === "graph" && <GraphView ... />}
  {activeView === "kanban" && <KanbanView ... />}
  {activeView === "schedule" && <ScheduleView ... />}

  {/* 항상 표시되는 Build Prompt 바 */}
  <BuildPromptBar
    hasTeam={agents.length > 0}
    prompt={buildPrompt}
    onBuildTeam={handleBuildTeam}
    ...
  />
</div>
```

**4. `webview-ui/src/styles.css`**

```css
/* 축소형 Build Prompt 바 */
.build-prompt-bar {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  width: min(80%, 700px);
  background: var(--bg-elevated);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
  z-index: 10;
  backdrop-filter: blur(8px);
}

/* 확장형 (팀 미생성) */
.build-prompt-expanded {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 560px;
  /* 기존 BuildPrompt.tsx 스타일 재활용 */
}
```

### 확인 기준

- [ ] 앱 진입 시 캔버스 가운데에 Build Prompt가 보임
- [ ] 팀 빌드 후 하단으로 축소되며 캔버스를 가리지 않음
- [ ] 축소 상태에서 입력 후 Rebuild 동작
- [ ] 오른쪽 패널 탭에 "AI Prompt"가 없음

---

## TASK-3: Task 탭 신규 추가 (작업 지시 인터페이스)

**우선순위:** 🔴 P0 (핵심 기능 부재)
**예상 공수:** 2일

### 변경 내용

빌드된 에이전트 팀에 작업을 지시하는 인터페이스. 오른쪽 패널의 새 탭.

### 수정 파일

**1. `webview-ui/src/panels/TaskPanel.tsx` (신규 생성)**

```
┌─ TASK ──────────────────────────┐
│                                  │
│  WORK ─────────────────────────  │
│  ┌────────────────────────────┐  │
│  │ "이 PR을 리뷰하고           │  │
│  │  코드 품질 개선사항 정리해줘" │  │
│  └────────────────────────────┘  │
│                                  │
│  Priority: [High ▾]             │
│  Assign to: [Auto ▾]           │
│                                  │
│  [▶ Submit Work]                    │
│                                  │
│  ─────────────────────────────── │
│  ACTIVE TASKS ─────────────────  │
│  ┌────────────────────────────┐  │
│  │ 🔵 Auth 모듈 구현 — 60%    │  │
│  │    Frontend Coder · 2m 경과 │  │
│  ├────────────────────────────┤  │
│  │ 🟡 API 리팩터링 — 대기 중   │  │
│  │    Backend Coder · deps: DB │  │
│  └────────────────────────────┘  │
│                                  │
│  ─────────────────────────────── │
│  HISTORY ──────────────────────  │
│  · PR #42 리뷰 — ✅ 완료 (3m)   │
│  · DB 스키마 설계 — ✅ 완료 (1m) │
│  · 리팩터링 — ❌ 실패            │
│                                  │  ← overflow-y: auto
└──────────────────────────────────┘
```

```typescript
interface TaskPanelProps {
  agents: AgentProfile[];              // 현재 팀 에이전트 목록
  tasks: Task[];                       // 활성 태스크 목록
  runHistory: RunHistoryEntry[];       // 실행 기록
  onRunTask: (prompt: string, opts: TaskOptions) => void;
  onCancelTask: (taskId: string) => void;
  onViewTaskDetail: (taskId: string) => void;
}

interface TaskOptions {
  priority: "high" | "medium" | "low";
  assignTo: string | "auto";          // agentId 또는 자동 배정
}
```

**핵심 동작:**
1. 사용자가 작업 프롬프트 입력 + 우선순위/담당자 선택
2. `[▶ Submit Work]` 클릭 → Orchestrator에게 전달
3. Orchestrator가 Task[] 분해 → 각 Task를 Worker에 할당
4. Active Tasks 섹션에 실시간 업데이트 (TaskEvent 구독)
5. 완료/실패 시 History로 이동

**2. `webview-ui/src/panels/RightPanel.tsx`**

```typescript
// 탭 추가
{ id: "task", label: "Task", icon: "▶" }

// 렌더링
case "task":
  return <TaskPanel agents={...} tasks={...} onRunTask={...} />;
```

**3. `webview-ui/src/App.tsx`**

- `onRunTask` 핸들러: `executeRunLoop` 또는 새로운 task dispatch 로직 연결
- TaskEvent 메시지 수신 → tasks 상태 업데이트 → TaskPanel + 캔버스 동기화

### 확인 기준

- [ ] 팀 빌드 후 오른쪽 패널에 "Task" 탭 표시
- [ ] 작업 프롬프트 입력 + Submit Work 버튼 동작
- [ ] 실행 중 Active Tasks에 실시간 진행률 표시
- [ ] 완료 시 History 섹션에 이동
- [ ] 전체 영역 스크롤 동작

---

## TASK-4: Memory 탭 삭제

**우선순위:** 🟡 P1
**예상 공수:** 0.5일

### 변경 내용

Memory 탭을 오른쪽 패널에서 완전 삭제. Orchestrator가 실행 중 Memory를 자동 관리하도록 위임.

### 수정 파일

**1. `webview-ui/src/panels/RightPanel.tsx`**

```typescript
// 삭제: mode === "memory" 관련 코드 전체
// 삭제: 탭 버튼 중 "Memory" 항목
```

**2. `webview-ui/src/panels/MemoryPanel.tsx`**

- 파일 삭제하거나, SettingsModal 내부 서브 컴포넌트로 이동
- 관리자/파워유저용으로 Settings → Advanced → Memory 에서 접근 가능하게 유지

**3. `webview-ui/src/App.tsx`**

- Memory 관련 상태(`memoryItems`, `memoryQuery` 등)를 Orchestrator runtime으로 이동
- Orchestrator가 실행 중 자동으로 `addMemory`, `supersedeMemory` 호출

**4. `extension/src/agentRuntime.ts` (또는 해당 런타임 파일)**

- Orchestrator 실행 시 자동 memory 관리 로직 추가:
  - Task 완료 시 학습 사항 자동 저장
  - 에러 발생 시 에러 컨텍스트 자동 기록
  - Decision 포인트에서 선택 근거 자동 저장

### 확인 기준

- [ ] 오른쪽 패널에 "Memory" 탭 없음
- [ ] Task 실행 중 Orchestrator가 자동으로 memory 항목 생성
- [ ] Settings 모달에서 memory 조회/관리 가능 (선택 사항)

---

## TASK-5: "+ Agent" 버튼 추가

**우선순위:** 🟡 P1
**예상 공수:** 0.5일

### 변경 내용

툴바에 `[+ Agent]` 버튼을 `[+ Rule]` 왼쪽에 추가. 클릭 시 에이전트 생성 팝업.

### 수정 파일

**1. `webview-ui/src/App.tsx` (툴바 영역)**

```typescript
// 기존: [+] [+ Rule]
// 변경: [+] [+ Agent] [+ Rule]

<button className="toolbar-btn accent" onClick={handleAddAgent}>
  + Agent
</button>
```

**2. `handleAddAgent` 핸들러**

```typescript
function handleAddAgent() {
  // 방법 A: 간단한 Agent 생성 팝업 (이름 + 역할 + 프로바이더)
  setShowAgentCreationModal(true);

  // 방법 B: 즉시 기본 Agent 생성 후 AgentDetailModal 열기
  const newAgent = createDefaultAgent();
  openAgentDetailModal(newAgent.id);
}
```

- 생성 후 캔버스에 새 AgentNode 자동 배치 (마지막 Agent 아래 또는 빈 공간에)
- 바로 AgentDetailModal이 열려서 세부 설정 가능

**3. `webview-ui/src/styles.css`**

```css
/* 기존 + Rule 버튼과 동일 스타일 */
.toolbar-btn.agent {
  background: var(--secondary);    /* 블루 #4a87e8 */
  color: white;
}
```

### 확인 기준

- [ ] 툴바에 `[+] [+ Agent] [+ Rule]` 순서로 3개 버튼 표시
- [ ] `[+ Agent]` 클릭 시 에이전트 생성 팝업/모달 열림
- [ ] 생성된 에이전트가 캔버스에 노드로 표시
- [ ] 생성 직후 AgentDetailModal로 세부 설정 가능

---

## TASK-6: Agent 더블클릭 → 관리 팝업

**우선순위:** 🟡 P1
**예상 공수:** 0.5일

### 변경 내용

Agent 노드를 더블클릭하면 `AgentDetailModal`이 즉시 열리며, 4개 탭(Overview / Skills / Rules / MCP)으로 에이전트 설정 전체를 관리할 수 있음.

### 수정 파일

**1. `webview-ui/src/views/GraphView.tsx`**

```typescript
// ReactFlow의 onNodeDoubleClick 이벤트 핸들러
const onNodeDoubleClick = useCallback(
  (_event: React.MouseEvent, node: Node) => {
    if (node.type === "agent") {
      // AgentDetailModal 열기
      props.onOpenAgentDetail(node.id);
    } else {
      // 기존 동작: 파일 열기
      props.onOpenFile(node.data.filePath);
    }
  },
  [props.onOpenAgentDetail, props.onOpenFile]
);

// ReactFlow 컴포넌트에 연결
<ReactFlow
  ...
  onNodeDoubleClick={onNodeDoubleClick}
/>
```

**2. 기존 동작 유지**

- **싱글 클릭:** 기존처럼 Inspector에 노드 요약 표시
- **더블클릭:** AgentDetailModal 팝업 (Skills, MCP, Rules, Overview 탭)
- AgentDetailModal은 이미 구현되어 있으므로 (`AgentDetailModal.tsx`) 연결만 하면 됨

### 확인 기준

- [ ] Agent 노드 싱글클릭 → Inspector에 요약 표시
- [ ] Agent 노드 더블클릭 → AgentDetailModal 팝업 열림
- [ ] 모달에서 Skills/MCP 추가·삭제 가능
- [ ] 모달 닫기 후 캔버스 노드에 변경사항 반영
- [ ] Agent 외 노드 (Skill, Rule) 더블클릭 → 기존 동작 (파일 열기) 유지

---

## TASK-7: 캔버스 = 실시간 모니터링 대시보드

**우선순위:** 🔴 P0 (핵심 가치 변경)
**예상 공수:** 3일

### 변경 내용

Graph 캔버스를 정적 구조도에서 **실시간 모니터링 화면**으로 전환. 에이전트의 현재 상태, 태스크 진행률, 데이터 흐름을 시각적으로 표현.

### 7-1. Agent 노드 상태 표시

**파일: `webview-ui/src/components/nodes/AgentNode.tsx`**

```typescript
interface AgentNodeData {
  ...existing fields...
  // 신규: 실시간 상태
  executionState: "idle" | "thinking" | "working" | "error" | "done" | "blocked";
  currentTask?: string;        // 현재 수행 중인 태스크 이름
  progress?: number;           // 0~100 진행률
}
```

**상태별 시각 표현:**

| 상태 | 테두리 색 | 이펙트 | 아이콘 |
|------|----------|--------|--------|
| `idle` | 기본 (muted) | 없음 | 💤 |
| `thinking` | 블루 #4a87e8 | 펄스 glow | 💭 |
| `working` | 틸 #2fa184 | 프로그레스 바 + shimmer | ⚡ |
| `error` | 레드 #d95c4f | 레드 펄스 (EFFECT-3) | ❌ |
| `done` | 틸 #2fa184 (muted) | 체크마크 (EFFECT-2) | ✅ |
| `blocked` | 앰버 #d4a11e | 느린 펄스 (EFFECT-4) | ⏳ |

**CSS 추가:**

```css
/* 실행 상태별 노드 테두리 */
.agent-node[data-state="working"] {
  border-color: var(--accent);
  box-shadow: 0 0 12px rgba(47, 161, 132, 0.3);
}

.agent-node[data-state="error"] {
  border-color: var(--danger);
  animation: error-pulse 1.5s infinite;
}

.agent-node[data-state="thinking"] {
  border-color: var(--secondary);
  animation: thinking-glow 2s ease-in-out infinite;
}

/* 프로그레스 바 (노드 하단) */
.agent-node-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--line);
  border-radius: 0 0 var(--node-radius) var(--node-radius);
  overflow: hidden;
}

.agent-node-progress-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.3s;
}

@keyframes error-pulse {
  0%, 100% { box-shadow: 0 0 8px rgba(217, 92, 79, 0.2); }
  50% { box-shadow: 0 0 20px rgba(217, 92, 79, 0.5); }
}

@keyframes thinking-glow {
  0%, 100% { box-shadow: 0 0 8px rgba(74, 135, 232, 0.2); }
  50% { box-shadow: 0 0 16px rgba(74, 135, 232, 0.4); }
}
```

### 7-2. 엣지 데이터 흐름 애니메이션

**파일: `webview-ui/src/styles.css`**

위임(delegates) 엣지에서 실행 중일 때 데이터 흐름 파티클 효과:

```css
/* 활성 위임 엣지 — 대시 애니메이션 */
.react-flow__edge.delegates.active path {
  stroke: var(--accent);
  stroke-width: 2.5;
  stroke-dasharray: 8 4;
  animation: edge-flow 0.8s linear infinite;
}

@keyframes edge-flow {
  0% { stroke-dashoffset: 24; }
  100% { stroke-dashoffset: 0; }
}

/* 완료된 엣지 — 페이드 */
.react-flow__edge.delegates.done path {
  stroke: var(--accent);
  stroke-width: 1.5;
  opacity: 0.5;
}
```

### 7-3. TaskEvent 구독 → 노드 상태 동기화

**파일: `webview-ui/src/App.tsx`**

```typescript
// TaskEvent 수신 시 agent 노드 상태 업데이트
useEffect(() => {
  const handler = (event: TaskEvent) => {
    setAgentStates(prev => {
      const next = new Map(prev);
      switch (event.type) {
        case "task_started":
          next.set(event.agentId, {
            state: "working",
            currentTask: event.taskTitle,
            progress: 0,
          });
          break;
        case "task_progress":
          next.set(event.agentId, {
            ...next.get(event.agentId),
            progress: event.progress,
          });
          break;
        case "task_completed":
          next.set(event.agentId, { state: "done" });
          break;
        case "task_failed":
          next.set(event.agentId, { state: "error" });
          break;
        case "task_blocked":
          next.set(event.agentId, { state: "blocked" });
          break;
      }
      return next;
    });
  };

  subscribeToTaskEvents(handler);
  return () => unsubscribeFromTaskEvents(handler);
}, []);
```

### 7-4. SVG 이펙트 에셋 활용

기존 제작된 93개 SVG 에셋을 모니터링 UI에 통합:

| 이펙트 | SVG 파일 | 사용처 |
|--------|----------|--------|
| Task Running 펄스 | `effects/agentcanvas_effect_task_running.svg` | working 상태 Agent 노드 |
| Task 완료 체크 | `effects/agentcanvas_effect_task_done.svg` | done 상태 오버레이 |
| Task 실패 X | `effects/agentcanvas_effect_task_failed.svg` | error 상태 오버레이 |
| Blocked 경고 | `effects/agentcanvas_effect_task_blocked.svg` | blocked 상태 뱃지 |
| 프로그레스 shimmer | `effects/agentcanvas_effect_progress_shimmer.svg` | 프로그레스 바 오버레이 |
| 데이터 흐름 파티클 | `edges/agentcanvas_edge_flow_particle.svg` | 활성 위임 엣지 |
| 엣지 선택 글로우 | `edges/agentcanvas_edge_select_glow.svg` | 활성 엣지 하이라이트 |
| 캐릭터 감정 | `characters/agentcanvas_char_emotion_*.svg` | Agent 상태 아이콘 (선택) |

### 확인 기준

- [ ] Task 실행 중 Agent 노드 테두리 색이 상태에 따라 변화
- [ ] Working 상태에서 프로그레스 바 표시 + shimmer 애니메이션
- [ ] Error 상태에서 레드 펄스 애니메이션
- [ ] 위임 엣지에 흐름 애니메이션 (대시 이동)
- [ ] Task 완료 시 Agent 노드에 체크마크 오버레이 표시
- [ ] 전체 Task 완료 후 모든 노드가 idle로 복귀

---

## 구현 순서 및 의존성

```
TASK-1 (스크롤) ──────────────────────────────────→ 독립
TASK-5 (+ Agent 버튼) ───────────────────────────→ 독립
TASK-6 (더블클릭) ───────────────────────────────→ 독립
TASK-4 (Memory 삭제) ────────────────────────────→ 독립
TASK-2 (AI Prompt 삭제 + BuildPrompt 바) ────────→ TASK-3 선행
TASK-3 (Task 탭) ────────────────────────────────→ TASK-7 선행
TASK-7 (모니터링 캔버스) ────────────────────────→ TASK-3 필요
```

### 추천 실행 순서

| 순서 | Task | 공수 | 병렬 가능 |
|------|------|------|----------|
| 1a | TASK-1: 스크롤 | 0.5일 | ✅ 병렬 가능 |
| 1b | TASK-5: + Agent 버튼 | 0.5일 | ✅ 병렬 가능 |
| 1c | TASK-6: 더블클릭 | 0.5일 | ✅ 병렬 가능 |
| 1d | TASK-4: Memory 삭제 | 0.5일 | ✅ 병렬 가능 |
| 2 | TASK-2: Build Prompt 바 | 1.5일 | |
| 3 | TASK-3: Task 탭 | 2일 | |
| 4 | TASK-7: 모니터링 캔버스 | 3일 | |

**총 예상 공수: 8.5일** (병렬 수행 시 6~7일)

---

## 영향받는 파일 전체 목록

| 파일 | 변경 종류 | 관련 Task |
|------|----------|----------|
| `webview-ui/src/styles.css` | 수정 | 1, 2, 3, 5, 7 |
| `webview-ui/src/panels/RightPanel.tsx` | 수정 | 1, 2, 3, 4 |
| `webview-ui/src/App.tsx` | 수정 | 2, 3, 5, 7 |
| `webview-ui/src/components/BuildPromptBar.tsx` | **신규** | 2 |
| `webview-ui/src/panels/TaskPanel.tsx` | **신규** | 3 |
| `webview-ui/src/panels/PromptPanel.tsx` | 삭제/비활성화 | 2 |
| `webview-ui/src/panels/MemoryPanel.tsx` | 삭제/이동 | 4 |
| `webview-ui/src/views/GraphView.tsx` | 수정 | 6, 7 |
| `webview-ui/src/components/nodes/AgentNode.tsx` | 수정 | 7 |

---

*이 문서는 UX.md §10 (REV-1~7) 및 UI.md §2.3 (개정)과 연동됩니다.*

---

## 2차 개정 — 버그 수정 & 기능 추가 (2026-02-20)

> 근거: BUG_FIX_SPEC.md 분석 결과 + 실제 코드 검증
> 구현 상태 검증 결과: 미구현 9건 / 부분구현 6건 / 구현됨 6건

---

### TASK-8: Team Rebuild 시 기존 팀 삭제 [BUG-1] 🔴 P0

**예상 공수:** 0.5일
**미구현 확인:** `AgentPreviewModal.tsx` line 37 — `overwriteExisting` 기본값 `false` 고정

#### 문제
Rebuild 버튼 클릭 후 팀을 새로 생성해도 기존 Agent들이 삭제되지 않고 누적됨.

#### 원인
```tsx
// AgentPreviewModal.tsx line 37 — 현재
const [overwriteExisting, setOverwriteExisting] = useState(false);
// Rebuild 모드 여부와 무관하게 항상 false로 시작
```

#### 수정 방법

**파일: `webview-ui/src/panels/AgentPreviewModal.tsx`**

```tsx
// prop 추가
type AgentPreviewModalProps = {
  open: boolean;
  structure?: GeneratedAgentStructure;
  historyId?: string;
  rebuildMode?: boolean;   // ← 추가
  onClose: () => void;
  onApply: (...) => Promise<void>;
};

// state 초기값을 rebuildMode에 따라 설정
const [overwriteExisting, setOverwriteExisting] = useState(
  props.rebuildMode ?? false
);

useEffect(() => {
  if (!open) { ...; return; }
  setOverwriteExisting(rebuildMode ?? false);  // open 시 rebuildMode로 리셋
}, [open, rebuildMode]);
```

**파일: `webview-ui/src/App.tsx`**

```tsx
// generatedPreview 출력 시 hasTeam 여부를 rebuildMode로 전달
<AgentPreviewModal
  open={Boolean(generatedPreview)}
  structure={generatedPreview?.structure}
  historyId={generatedPreview?.historyId}
  rebuildMode={hasTeamReady}   // ← 추가
  onClose={...}
  onApply={...}
/>
```

#### 확인 기준
- [ ] 빈 캔버스에서 팀 생성: `overwriteExisting` 체크박스 기본 해제
- [ ] 기존 팀 있을 때 Rebuild: `overwriteExisting` 체크박스 기본 체크
- [ ] Apply 시 기존 Agent 삭제 후 새 팀으로 교체

---

### TASK-9: Chat 메시지 미표시 & 패널 전환 문제 [BUG-2] 🔴 P0

**예상 공수:** 1일
**미구현 확인:** `App.tsx` `sendChatMessage` (line 1717)에 `appendLocalChatMessage` 호출 없음

#### 문제
1. Chat에서 Send 후 내가 보낸 메시지가 화면에 표시되지 않음
2. Send 후 RightPanel이 Library에서 Chat으로 전환되어 팀 목록이 사라진 것처럼 보임
3. Extension 응답이 없으면 채팅창이 영구 공백 상태

#### 원인

```tsx
// App.tsx sendChatMessage — 현재 (line 1717)
const sendChatMessage = async (content: string) => {
  const trimmed = content.trim();
  if (!trimmed) return;
  setChatSending(true);
  try {
    await requestToExtension({ type: "CHAT_SEND", payload: { ... } });
    // ❌ appendLocalChatMessage() 호출 없음 → 사용자 메시지 미표시
    setPanelMode("chat");  // ← Library 뷰를 Chat 뷰로 덮어씀
    setPanelOpen(true);
  } finally {
    setChatSending(false);
  }
};
```

#### 수정 방법

**파일: `webview-ui/src/App.tsx`**

```tsx
const sendChatMessage = async (content: string) => {
  const trimmed = content.trim();
  if (!trimmed) return;

  // ✅ 1) 사용자 메시지 즉시 로컬 추가
  appendLocalChatMessage(
    createLocalChatMessage("user", [{ kind: "text", text: trimmed }])
  );

  setChatSending(true);
  try {
    await requestToExtension({ type: "CHAT_SEND", payload: { ... } });
    // ✅ 2) 패널 모드 전환 제거 — 이미 chat 탭에 있을 때만 전환
    if (panelMode !== "chat") {
      setPanelMode("chat");
    }
    setPanelOpen(true);
  } catch (error) {
    // ✅ 3) 에러 시 에러 메시지 로컬 추가
    appendLocalChatMessage(
      createLocalChatMessage("system", [{ kind: "error", message: String(error) }])
    );
  } finally {
    setChatSending(false);
  }
};
```

**파일: `webview-ui/src/panels/RightPanel.tsx`**

Chat과 Library를 분리하여 항상 탭 전환 가능하도록:

```tsx
// 현재: normalizedMode = "library" | "chat" (이진 분기)
// 수정: library/chat 탭 헤더를 항상 표시, 선택된 탭만 content 렌더
<div className="right-panel-tabs">
  <button
    className={mode === "library" ? "tab active" : "tab"}
    onClick={() => onModeChange("library")}
  >Library</button>
  <button
    className={mode === "chat" ? "tab active" : "tab"}
    onClick={() => onModeChange("chat")}
  >Chat</button>
</div>
```

#### 확인 기준
- [ ] Send 즉시 내가 보낸 메시지가 채팅창에 표시
- [ ] Library 탭에서 Send 해도 Library가 사라지지 않음
- [ ] Extension 에러 발생 시 에러 메시지가 채팅에 표시

---

### TASK-10: 사용량 0 표시 개선 [BUG-3] 🟡 P2

**예상 공수:** 0.5일
**부분구현 확인:** BackendUsageTracker 인프라 구현됨, 초기 실행 시 0이 정상이나 UX 안내 부재

#### 문제
팀 Confirm 화면(AgentPreviewModal)의 Backend usage snapshot이 모두 0으로 표시됨.
첫 실행이거나 CLI 호출이 없었으면 당연히 0이지만 사용자는 오류로 인식.

#### 수정 방법

**파일: `webview-ui/src/panels/AgentPreviewModal.tsx`**

```tsx
// 사용량이 0인 경우 안내 문구 추가
{draft.backendUsageAtBuild.length > 0 ? (
  <div className="agent-detail-list">
    {draft.backendUsageAtBuild.map((summary) => {
      const hasData = summary.today.callCount > 0 || summary.thisWeek.callCount > 0;
      return (
        <div key={summary.backendId} className="agent-detail-item">
          <div className="agent-detail-item-header">
            <div className="item-title">{toBackendTitle(summary.backendId)}</div>
            {hasData ? (
              <span className="pill">{Math.round((1 - summary.availabilityScore) * 100)}% used</span>
            ) : (
              <span className="pill muted">사용 이력 없음</span>
            )}
          </div>
          {hasData ? (
            <>
              <div className="node-meta">Today: ${summary.today.estimatedCost.toFixed(2)} · {summary.today.callCount} calls</div>
              <div className="node-meta">Week: ${summary.thisWeek.estimatedCost.toFixed(2)} · Month: ${summary.thisMonth.estimatedCost.toFixed(2)}</div>
            </>
          ) : (
            <div className="node-meta muted">CLI 호출 후 자동 집계됩니다</div>
          )}
        </div>
      );
    })}
  </div>
) : (
  <div className="node-meta muted">사용 이력이 없습니다. CLI 실행 후 자동 집계됩니다.</div>
)}
```

#### 확인 기준
- [ ] 사용 이력 없을 때 "사용 이력 없음" 뱃지 표시
- [ ] "CLI 호출 후 자동 집계됩니다" 안내 문구 표시
- [ ] 실제 호출 이력 있을 때 정상 수치 표시

---

### TASK-11: Orchestrator Backend → Chat 자동 동기화 [BUG-4] 🟠 P1

**예상 공수:** 0.5일
**미구현 확인:** `App.tsx` line 136 — `chatBackendId` 하드코딩 "claude", 동기화 로직 없음

#### 문제
팀 Orchestrator가 Codex로 설정되어도 Chat은 항상 Claude로 전송.

#### 수정 방법

**파일: `webview-ui/src/App.tsx`**

```tsx
// orchestrator agent 탐색
const orchestratorAgent = useMemo(
  () => snapshot?.agents?.find((agent) => agent.isOrchestrator),
  [snapshot?.agents]
);

// orchestrator backend를 chatBackendId에 동기화
useEffect(() => {
  if (!orchestratorAgent?.runtime) return;
  if (orchestratorAgent.runtime.kind !== "cli") return;
  const backendId = orchestratorAgent.runtime.backendId;
  if (backendId && backendId !== "auto") {
    setChatBackendId(backendId as Exclude<CliBackend["id"], "auto">);
  }
}, [orchestratorAgent]);
```

**파일: `webview-ui/src/panels/ChatInput.tsx`**

```tsx
// orchestrator 고정일 때 backend select disabled
<select
  className="chat-backend-select"
  value={props.backendId}
  onChange={(event) => props.onBackendChange(...)}
  disabled={props.disabled || props.orchestratorLocked}  // ← 추가
  title={props.orchestratorLocked ? "Orchestrator 백엔드로 고정됩니다" : undefined}
>
```

#### 확인 기준
- [ ] Orchestrator가 Codex 사용 시 Chat Backend 자동으로 Codex 전환
- [ ] Orchestrator 없을 때 Chat Backend 자유 선택 가능
- [ ] 동기화 시 ChatInput backend select에 안내 표시

---

### TASK-12: 최신 모델 목록 & 드롭다운 전환 [FEAT-5] 🟢 P3

**예상 공수:** 1일
**부분구현 확인:** `ChatInput.tsx` line 68 — `<input>` (자유 입력), `<select>` 미전환

#### 모델 목록 (CLI 조사 완료)

| Backend | 모델 | 별칭 | 티어 |
|---------|------|------|------|
| Claude Code | `claude-haiku-4-5-20251001` | `haiku` | Fast |
| Claude Code | `claude-sonnet-4-5-20250929` | `sonnet` | Standard |
| Claude Code | `claude-opus-4-5-20251101` | `opus` | Advanced |
| Codex CLI | `gpt-4.1` | - | Standard |
| Codex CLI | `gpt-4.1-mini` | - | Fast |
| Codex CLI | `gpt-4.1-nano` | - | Ultra-fast |
| Codex CLI | `gpt-4o` | - | Multimodal |
| Codex CLI | `o3` | - | Reasoning |
| Codex CLI | `o3-mini` | - | Reasoning-fast |
| Codex CLI | `o4-mini` | - | Reasoning-latest |
| Codex CLI | `codex-1` | - | Code-specialist |
| Gemini CLI | `gemini-2.5-flash` | - | Fast |
| Gemini CLI | `gemini-2.5-pro` | - | Advanced |
| Gemini CLI | `gemini-2.0-flash` | - | Stable |
| Aider | (모델 자유 입력) | - | - |

#### 수정 방법

**신규 파일: `webview-ui/src/utils/modelOptions.ts`**

```ts
export const MODEL_OPTIONS: Record<string, Array<{ id: string; label: string; tier: string }>> = {
  claude: [
    { id: "claude-sonnet-4-5-20250929", label: "Sonnet 4.5 (Standard)", tier: "standard" },
    { id: "claude-haiku-4-5-20251001",  label: "Haiku 4.5 (Fast)",     tier: "fast" },
    { id: "claude-opus-4-5-20251101",   label: "Opus 4.5 (Advanced)",  tier: "advanced" },
  ],
  codex: [
    { id: "gpt-4.1",      label: "GPT-4.1 (Standard)",        tier: "standard" },
    { id: "gpt-4.1-mini", label: "GPT-4.1 Mini (Fast)",       tier: "fast" },
    { id: "gpt-4.1-nano", label: "GPT-4.1 Nano (Ultra-fast)", tier: "fast" },
    { id: "gpt-4o",       label: "GPT-4o (Multimodal)",       tier: "standard" },
    { id: "o3",           label: "o3 (Reasoning)",            tier: "advanced" },
    { id: "o3-mini",      label: "o3-mini (Reasoning-fast)",  tier: "standard" },
    { id: "o4-mini",      label: "o4-mini (Reasoning-latest)",tier: "fast" },
    { id: "codex-1",      label: "Codex-1 (Code specialist)", tier: "advanced" },
  ],
  gemini: [
    { id: "gemini-2.5-pro",   label: "Gemini 2.5 Pro (Advanced)", tier: "advanced" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Fast)",   tier: "fast" },
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash (Stable)", tier: "standard" },
  ],
  aider:  [],  // 자유 입력 허용
  custom: [],  // 자유 입력 허용
};
```

**파일: `webview-ui/src/panels/ChatInput.tsx`**

```tsx
import { MODEL_OPTIONS } from "../utils/modelOptions";

// input → select 전환 (backendId에 따라 옵션 동적 변경)
const modelOptions = MODEL_OPTIONS[props.backendId] ?? [];
{modelOptions.length > 0 ? (
  <select
    value={props.modelId ?? ""}
    onChange={(event) => props.onModelChange(event.target.value)}
    disabled={props.disabled}
  >
    <option value="">기본 모델</option>
    {modelOptions.map((m) => (
      <option key={m.id} value={m.id}>{m.label}</option>
    ))}
  </select>
) : (
  <input value={props.modelId ?? ""} onChange={...} placeholder="model (optional)" />
)}
```

**파일: `extension/src/services/backendProfiles.ts`**

각 backend의 `models[]` 배열을 위 목록으로 업데이트.

#### 확인 기준
- [ ] Claude Backend 선택 시 claude-haiku/sonnet/opus 드롭다운 표시
- [ ] Codex Backend 선택 시 gpt-4.1, o3, o4-mini 등 드롭다운 표시
- [ ] Gemini Backend 선택 시 gemini-2.5-flash/pro 드롭다운 표시
- [ ] Aider/Custom은 자유 입력 input 유지

---

### TASK-13: 채팅 터미널 스타일 UI [FEAT-6] 🟢 P3

**예상 공수:** 1일

#### 목표
버블 형태 채팅 → 터미널(CLI) 인터랙션 방식으로 교체

#### 수정 방법

**파일: `webview-ui/src/panels/ChatMessageList.tsx`**

```tsx
// 터미널 라인 렌더링
const ROLE_PREFIX: Record<string, string> = {
  user: "❯",
  orchestrator: "◆",
  system: "●",
};

<div className={`term-line term-${message.role}`}>
  <span className="term-prefix">{ROLE_PREFIX[message.role] ?? "·"}</span>
  <div className="term-body">
    {/* 기존 content 렌더 로직 유지 */}
  </div>
  <span className="term-timestamp">
    {new Date(message.timestamp).toLocaleTimeString()}
  </span>
</div>
```

**파일: `webview-ui/src/styles.css`**

```css
.chat-messages {
  font-family: "JetBrains Mono", "Fira Code", "SF Mono", monospace;
  font-size: 13px;
  line-height: 1.6;
}
.term-line {
  display: flex;
  gap: 10px;
  padding: 2px 0;
  align-items: flex-start;
}
.term-prefix {
  flex-shrink: 0;
  width: 16px;
  font-size: 12px;
  margin-top: 2px;
}
.term-line.term-user .term-prefix     { color: #7ec8e3; }
.term-line.term-orchestrator .term-prefix { color: #a8e6cf; }
.term-line.term-system .term-prefix   { color: #888; }
.term-body { flex: 1; white-space: pre-wrap; word-break: break-word; }
.term-timestamp { flex-shrink: 0; font-size: 10px; color: var(--fg-muted); margin-top: 3px; }
```

#### 확인 기준
- [ ] 사용자 메시지 앞에 `❯` 프리픽스 표시
- [ ] Orchestrator 응답 앞에 `◆` 프리픽스 표시
- [ ] System 메시지 앞에 `●` 프리픽스 표시
- [ ] 모노스페이스 폰트 적용
- [ ] 각 메시지에 타임스탬프 표시

---

### TASK-14: Agent 생성 모달 — Backend & Model 선택 [FEAT-7] 🟢 P3

**예상 공수:** 0.5일
**미구현 확인:** `AgentCreationModal.tsx` line 8-15 — payload에 backendId, modelId 없음

#### 수정 방법

**파일: `webview-ui/src/panels/AgentCreationModal.tsx`**

```tsx
// State 추가
const [backendId, setBackendId] = useState<string>("claude");
const [modelId, setModelId] = useState<string>("");

// Role select 아래에 추가
<div className="inspector-field">
  <label>Backend (CLI)</label>
  <select
    value={backendId}
    onChange={(event) => { setBackendId(event.target.value); setModelId(""); }}
  >
    <option value="claude">Claude Code</option>
    <option value="codex">Codex CLI</option>
    <option value="gemini">Gemini CLI</option>
    <option value="aider">Aider</option>
    <option value="custom">Custom</option>
  </select>
</div>

<div className="inspector-field">
  <label>Model</label>
  {(MODEL_OPTIONS[backendId] ?? []).length > 0 ? (
    <select value={modelId} onChange={(e) => setModelId(e.target.value)}>
      <option value="">기본 모델</option>
      {(MODEL_OPTIONS[backendId] ?? []).map((m) => (
        <option key={m.id} value={m.id}>{m.label}</option>
      ))}
    </select>
  ) : (
    <input value={modelId} onChange={(e) => setModelId(e.target.value)} placeholder="model (optional)" />
  )}
</div>

// onCreate payload 확장
await onCreate({
  name: name.trim(), role, roleLabel, description, systemPrompt, isOrchestrator,
  backendId,   // ← 추가
  modelId: modelId.trim() || undefined,  // ← 추가
});
```

**파일: `webview-ui/src/App.tsx`** — `handleCreateAgent`에서 backendId/modelId를 `AgentProfile.runtime` 및 `preferredModel`에 매핑

#### 확인 기준
- [ ] Agent 생성 모달에 Backend 선택 드롭다운 추가
- [ ] 선택한 Backend에 따라 Model 드롭다운 동적 변경
- [ ] 생성된 Agent의 `runtime.backendId`와 `preferredModel`에 값 반영

---

### TASK-15: TeamPanel +Skill 버튼 & RightPanel New Skill 섹션 제거 [FEAT-8] 🟢 P3

**예상 공수:** 0.5일
**미구현 확인:** `TeamPanel.tsx` — +Skill 버튼 없음 / `RightPanel.tsx` line 131 — newSkill 섹션 존재

#### 수정 방법

**파일: `webview-ui/src/panels/TeamPanel.tsx`**

```tsx
// prop 추가
type TeamPanelProps = {
  ...
  onCreateSkill: () => void;  // ← 추가
};

// 버튼 추가
<div className="team-panel-inline-actions">
  <button type="button" onClick={props.onCreateAgent}>+ Agent</button>
  <button type="button" onClick={props.onCreateSkill}>+ Skill</button>  {/* ← 추가 */}
  <button type="button" onClick={props.onRebuildTeam}>Rebuild</button>
</div>
```

**파일: `webview-ui/src/App.tsx`**

```tsx
<TeamPanel
  ...
  onCreateSkill={() => setSkillWizardOpen(true)}  // ← 추가
/>
```

**파일: `webview-ui/src/panels/RightPanel.tsx`**

```tsx
// 제거 대상:
// 1) LibrarySectionKey에서 "newSkill" 제거
type LibrarySectionKey = "skills" | "agents" | "patterns" | "mcp" | "rules";
//   ↑ "newSkill" 삭제

// 2) collapsedSections 초기값에서 newSkill 제거
const [collapsedSections, setCollapsedSections] = useState({
  skills: false, agents: false, patterns: false, mcp: false, rules: false
  // newSkill: false  ← 삭제
});

// 3) New Skill 섹션 UI 블록 전체 삭제 (기존 line 625~631 및 하위 form 전체)

// 4) skillName, skillDescription state 삭제
// 5) onCreateSkill prop 제거 (TeamPanel로 이동했으므로)
```

#### 확인 기준
- [ ] TeamPanel에 `+ Skill` 버튼 표시
- [ ] `+ Skill` 클릭 시 SkillWizardModal 오픈
- [ ] RightPanel Library에서 "New Skill" 섹션 미표시

---

### TASK-16: Build Prompt Bar와 Zoom 버튼 겹침 해결 [LAYOUT-1] 🟠 P1

**예상 공수:** 0.5일
**미구현 확인:** `styles.css` — `build-prompt-bar` bottom:32px가 `canvas-controls` bottom:14px를 덮음

#### 문제

```css
/* 현재 상태 — 겹침 발생 */
.build-prompt-bar  { bottom: 32px; z-index: 12; }  /* Build bar */
.canvas-controls   { bottom: 14px; z-index: 5;  }  /* Zoom 버튼 ← 가려짐 */
```

#### 수정 방법 (권장 — 캔버스 컨트롤을 위로 이동)

**파일: `webview-ui/src/styles.css`**

```css
/* canvas-controls를 build-prompt-bar 위로 이동 */
.canvas-controls {
  position: absolute;
  right: 14px;
  bottom: 90px;   /* build-prompt-bar 높이(~50px) + 여유 40px */
  z-index: 15;    /* build-prompt-bar(12)보다 높게 */
}

/* build-prompt-bar를 약간 더 아래로 */
.build-prompt-bar {
  bottom: 16px;   /* 기존 32px → 16px으로 내려서 여유 확보 */
  z-index: 12;
}
```

#### 확인 기준
- [ ] Build Prompt Bar compact 모드에서 Zoom(+/-/0/1) 버튼 모두 클릭 가능
- [ ] Build Prompt Bar expanded 모드에서도 Zoom 버튼 접근 가능
- [ ] Zoom 버튼과 Build bar가 시각적으로 겹치지 않음

---

### TASK-17: 팀 생성 후 자동 레이아웃 정렬 [LAYOUT-2] 🟡 P2

**예상 공수:** 0.5일
**미구현 확인:** `GraphView.tsx` — `autoLayoutSignal` prop 없음, Apply 후 자동 layout 트리거 없음

#### 문제
팀 Apply 직후 Agent 노드들이 임의 위치(0,0 등)에 생성되어 겹침.

#### 수정 방법

**파일: `webview-ui/src/App.tsx`**

```tsx
const [autoLayoutSignal, setAutoLayoutSignal] = useState(0);

// 팀 Apply 성공 후 layout 트리거
const handleApplyGenerated = async (payload) => {
  setBusy(true);
  try {
    await requestToExtension({ type: "APPLY_GENERATED_STRUCTURE", payload });
    setGeneratedPreview(undefined);
    // ✅ 팀 Apply 직후 자동 tidy layout 발동
    setTimeout(() => setAutoLayoutSignal((prev) => prev + 1), 500);
  } catch (error) { ... }
  finally { setBusy(false); }
};
```

**파일: `webview-ui/src/canvas/GraphView.tsx`**

```tsx
type GraphViewProps = {
  ...
  autoLayoutSignal?: number;  // ← 추가
};

// autoLayoutSignal 변화 시 tidyLayout 실행
useEffect(() => {
  if (!autoLayoutSignal) return;
  const nextNodes = applyTidyLayout(nodes, edges);
  setNodes(nextNodes);
  nextNodes.forEach((node) =>
    onSaveNodePosition(node.id, node.position)
  );
}, [autoLayoutSignal]);
```

#### tidyLayout 배치 기준 (기존 로직 활용)

```
X.agent = 90       → 모든 Agent 노드는 왼쪽 열에
X.provider = 360   → Provider 노드 중간 열
X.skill = 680      → Skill 노드 오른쪽 열
GAP.section = 46   → Agent 간 수직 간격
```

#### 확인 기준
- [ ] 팀 Apply 후 0.5초 내에 노드들이 자동 정렬
- [ ] 노드 겹침 없이 깔끔한 그리드 배치
- [ ] 위치가 `.agentcanvas` 설정에 저장되어 재오픈 시 유지

---

## 2차 개정 — 영향 파일 추가 목록

| 파일 | 변경 종류 | 관련 Task |
|------|----------|----------|
| `webview-ui/src/panels/AgentPreviewModal.tsx` | 수정 | 8, 10 |
| `webview-ui/src/panels/AgentCreationModal.tsx` | 수정 | 14 |
| `webview-ui/src/panels/ChatInput.tsx` | 수정 | 11, 12 |
| `webview-ui/src/panels/ChatMessageList.tsx` | 수정 | 13 |
| `webview-ui/src/panels/TeamPanel.tsx` | 수정 | 15 |
| `webview-ui/src/panels/RightPanel.tsx` | 수정 | 15 |
| `webview-ui/src/App.tsx` | 수정 | 8, 9, 11, 17 |
| `webview-ui/src/canvas/GraphView.tsx` | 수정 | 16, 17 |
| `webview-ui/src/styles.css` | 수정 | 13, 16 |
| `webview-ui/src/utils/modelOptions.ts` | **신규** | 12, 14 |
| `extension/src/services/backendProfiles.ts` | 수정 | 12 |

## 2차 개정 — 우선순위 & 공수

| 순서 | Task | 우선순위 | 예상 공수 |
|------|------|---------|----------|
| 1a | TASK-8: Rebuild 기존 삭제 | 🔴 P0 | 0.5일 |
| 1b | TASK-9: Chat 메시지 표시 | 🔴 P0 | 1일 |
| 1c | TASK-16: Zoom 버튼 겹침 | 🟠 P1 | 0.5일 |
| 1d | TASK-11: Backend 동기화 | 🟠 P1 | 0.5일 |
| 2a | TASK-10: 사용량 0 안내 | 🟡 P2 | 0.5일 |
| 2b | TASK-17: 팀 자동 레이아웃 | 🟡 P2 | 0.5일 |
| 3a | TASK-12: 최신 모델 dropdown | 🟢 P3 | 1일 |
| 3b | TASK-13: 터미널 UI | 🟢 P3 | 1일 |
| 3c | TASK-14: Agent 모달 확장 | 🟢 P3 | 0.5일 |
| 3d | TASK-15: +Skill 버튼 | 🟢 P3 | 0.5일 |

**2차 추가 공수: 6.5일** (병렬 진행 시 4~5일)
