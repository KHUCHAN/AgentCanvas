# CODE_REVIEW2 — UI 검증 및 수정 지시서

> **작성일**: 2026-02-19
> **대상**: AgentCanvas Webview UI (webview-ui/src/)
> **검증 방법**: 스크린샷 대조 + 소스코드 정적 분석 (App.tsx, RightPanel.tsx, KanbanView.tsx, ScheduleView.tsx, GraphView.tsx, AgentNode.tsx, AgentDetailModal.tsx, styles.css)
> **심각도**: 🔴 CRITICAL · 🟠 HIGH · 🟡 MEDIUM · 🔵 LOW

---

## 1. 사용자 보고 이슈 (7건)

### USR-1 🔴 스크롤이 필요한 화면에 스크롤 기능 미구현

**증상**: Kanban 컬럼, Node Library, Inspector, Schedule 등 콘텐츠가 넘칠 때 스크롤 불가

**원인 분석**:

| 영역 | CSS 클래스 | 문제점 |
|------|-----------|--------|
| Kanban 컬럼 | `.kanban-column` (line 2200) | `min-height: 0` 누락 → flex 자식이 content-height로 커져서 overflow 작동 안 함 |
| `.kanban-column-body` | (line 2233) | `overflow: auto` 존재하지만 부모 `.kanban-column`에서 높이가 무한 확장되어 실효 없음 |
| Inspector 블록 | `.inspector-block` (line 821) | `overflow` 규칙 자체가 없음; 내용이 길어지면 패널 바깥으로 삐져나옴 |
| Node Library | `.panel-content` (line 793) | `overflow-y: auto` 존재 → 작동해야 하나, 내부 블록(`.library-block`)에 height 제한 없음 |
| Schedule View | `.schedule-view` (line 1214) | `min-height: 0` 존재하지만 ReactFlow가 height를 잡지 못하면 빈 화면 |

**수정 지침**:

```css
/* styles.css — .kanban-column (line 2200 부근) */
.kanban-column {
  min-width: 270px;
  flex: 1;
  /* ➕ 추가 */
  min-height: 0;          /* flex child가 shrink할 수 있게 */
  max-height: 100%;
  /* 기존 유지 */
  border: 1px solid var(--line);
  border-radius: 12px;
  background: color-mix(in srgb, var(--bg-soft) 94%, transparent);
  display: flex;
  flex-direction: column;
}

/* .kanban-column-body에 flex: 1 추가 */
.kanban-column-body {
  flex: 1;               /* ➕ 추가 */
  min-height: 0;         /* ➕ 추가 */
  padding: 8px;
  display: grid;
  gap: 8px;
  overflow: auto;        /* 기존 유지 — 이제 작동함 */
}

/* Inspector 블록에 스크롤 추가 */
.inspector-block {
  padding: 10px;
  max-height: 340px;     /* ➕ 추가 */
  overflow-y: auto;      /* ➕ 추가 */
}
```

---

### USR-2 🟠 Inspector 작동 안 함

**증상**: Inspector 탭 선택 후 노드를 클릭해도 내용이 안 보이거나 비어있음

**원인 분석** (`RightPanel.tsx` line 1~80, `App.tsx`):
1. `selectedNode` prop이 `undefined`인 경우 Inspector가 "Select a node…" 메시지만 표시
2. `App.tsx`에서 `onNodeClick` 핸들러가 `setPanelMode("inspector")` 를 호출하지만, 현재 mode가 다른 탭일 때 이전 선택 상태가 리셋됨
3. Inspector의 sub-tab("overview", "json", "variables", "edges")이 agent 변경 시 매번 "overview"로 리셋되어 사용자가 작업 중 컨텍스트를 잃음

**수정 지침**:
1. `App.tsx` — `onNodeClick` 핸들러 확인: `selectedNode` 상태가 실제 ReactFlow node 객체를 올바르게 저장하는지 검증
2. `RightPanel.tsx` — Inspector 렌더링 시 `selectedNode`가 있으면 즉시 데이터를 표시하도록 보장
3. sub-tab 리셋 로직 제거: `useEffect`에서 `inspectorSubTab`을 리셋하는 로직을 agent 변경이 아닌 노드 타입 변경에만 적용

---

### USR-3 🟠 Schedule이 제대로 안 보임

**증상**: Schedule 탭 진입 시 빈 화면이거나 레이아웃이 깨짐

**원인 분석** (`ScheduleView.tsx`, `styles.css` line 1214):
1. Schedule은 ReactFlow 기반 타임라인이라 **반드시 부모 컨테이너에 명시적 width/height 필요**
2. `.schedule-view`에 `min-width: 0; min-height: 0;`만 있고, 부모에서 flex/grid로 높이를 넘겨주는 구조가 불안정
3. Schedule에 task가 없을 때 `.schedule-empty`가 표시되지만, **task가 있으나 시간 범위 밖인 경우** 빈 화면이 됨 (empty state 분기 누락)
4. ReactFlow 뷰포트 초기화(fitView) 호출 타이밍이 늦으면 렌더링이 안 보임

**수정 지침**:
1. `.schedule-view`를 감싸는 부모(`.workspace-body > canvas 영역`)에 `height: 100%` 보장
2. ScheduleView 내부에서 `useEffect` → `fitView()` 호출 추가 (task 변경 시)
3. "시간 범위 밖" 케이스에 대한 안내 메시지 추가

---

### USR-4 🟡 글씨가 삐져나옴 (Text Overflow)

**증상**: 노드 타이틀, Kanban 카드 제목, Team Agent 이름 등이 잘리지 않고 넘침

**원인 분석** — text-overflow 누락 목록:

| CSS 클래스 | 파일/라인 | 현재 상태 | 수정 필요 |
|-----------|----------|----------|----------|
| `.node-title` | styles.css:678 | 제한 없음 | `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` |
| `.kanban-card-title` | styles.css:2276 | 제한 없음 | `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` |
| `.team-agent-name` | styles.css:2125 | 제한 없음 | `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` |
| `.build-prompt-title` | styles.css:1943 | font-size: 28px → 좁은 화면에서 넘침 | `overflow: hidden; text-overflow: ellipsis; word-break: break-word;` |
| `.item-subtitle` | styles.css:861 | (Library description) 제한 없음 | `overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;` |
| `.command-item-title` | styles.css:1122 | 제한 없음 | `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` |
| `.team-history-title` | styles.css:2182 | 제한 없음 | `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` |

**수정 지침**: 위 테이블의 모든 클래스에 truncation 규칙 추가. 특히 `.kanban-card-title`과 `.node-title`은 고정 폭 컨테이너 안에 있으므로 `white-space: nowrap` + `text-overflow: ellipsis` 필수.

---

### USR-5 🟡 Task와 Run의 차이가 불명확

**증상**: 우측 패널에 Task 탭과 Run 탭이 따로 있는데, 차이를 모르겠음

**원인 분석**:
1. **Task 패널** (`TaskPanel.tsx`): Work 프롬프트 입력 + 우선순위/담당자 설정 + "Submit Work" 버튼 + Active Tasks 목록 + History
2. **Run 패널** (`RunPanel.tsx`): Flow 실행 제어 + Run 이벤트 스트리밍 + 타임라인 + 로그
3. 문제: **두 패널의 역할 구분이 UI에서 전혀 설명되지 않음**
4. Task 패널의 "ACTIVE TASKS"와 Run 패널의 "Run Events"가 같은 실행 내용을 다른 형식으로 보여주므로 혼란

**수정 지침**:
1. Task 탭 헤더에 서브타이틀 추가: "작업 지시 & 추적" → 사용자가 여기서 일을 지시한다는 것을 명시
2. Run 탭 헤더에 서브타이틀 추가: "실행 세션 & 로그" → 시스템 실행 상태를 본다는 것을 명시
3. Task 탭 "Submit Work" 클릭 후 **자동으로 Run 탭으로 전환** 검토 (현재 코드는 `setPanelMode("task")` — 아래 BUG-1 참조)
4. 장기적으로: Task와 Run을 하나의 탭으로 합치되 섹션으로 분리하는 것도 고려

---

### USR-6 🟡 Node Library 사용 편의성 부족

**증상**: Library에 skill/rule/agent가 단순 리스트로 나열되어 있어 원하는 항목 찾기 어려움

**원인 분석** (`RightPanel.tsx`):
1. Library는 `snapshot.skills`, `snapshot.ruleDocuments`, `snapshot.agents`를 각각 블록으로 렌더링
2. 필터링은 검색 바(`.library-search`)로만 가능 — **카테고리 필터/태그 필터 없음**
3. Skill이 160+개까지 가능한데 **가상화(virtualization) 없음** → 긴 리스트 렌더링 시 성능 저하
4. 각 항목의 `.item-subtitle`(설명)이 truncation 없이 전부 표시되어 리스트가 길어짐

**수정 지침**:
1. 타입별 접기/펼치기(collapse) 추가: Skills / Rules / Agents 헤더를 클릭하면 접기
2. 검색 바 옆에 타입 필터 칩 추가 (All / Skills / Rules / Agents)
3. `.item-subtitle`에 2줄 clamp 적용 (위 USR-4 참고)
4. 항목이 50개 이상이면 `react-window` 등 가상 스크롤 적용 검토
5. Drag-and-Drop 시 드래그 중인 항목의 preview 스타일 추가

---

### USR-7 🔵 Graph 화면의 +Agent 옆 + 버튼 역할 불명확

**증상**: +Agent 버튼 옆에 다른 + 버튼이 있는데 무엇인지 모르겠음

**원인 분석** (`App.tsx` top-actions 영역):
1. `+ Agent` 버튼: 새 에이전트 추가 → 명확
2. `+` 버튼: `onAddNote` (메모 노드 추가) 또는 다른 quick-add 기능으로 추정
3. **문제**: 버튼에 라벨이 없고 아이콘만 있어서 기능을 알 수 없음

**수정 지침**:
1. 모든 toolbar 버튼에 **툴팁(title attribute)** 추가
2. `+` 버튼을 `+ Note` 또는 아이콘+라벨 형태로 변경
3. 공간이 부족하면 드롭다운 메뉴로 묶기: "Add ▾" → Agent / Note / Rule

---

## 2. 코드 분석 발견 이슈

### BUG-1 🔴 runTaskFromPanel()이 runFlowFromPanel() 설정을 덮어씀

**파일**: `App.tsx` line 1368~1391
**증상**: Task 패널에서 "Submit Work" → 내부적으로 `runFlowFromPanel()` 호출 → Kanban+Run 모드로 전환 **BUT** 직후 line 1388-1389에서 `setPanelMode("task"); setCanvasMode("graph");` 로 덮어씀

**코드**:
```typescript
// line 1378: runFlowFromPanel() 내부에서 setCanvasMode("kanban"), setPanelMode("run") 호출
await runFlowFromPanel({ ... });

// line 1388-1389: 위 설정을 즉시 덮어씀 ❌
setPanelMode("task");      // "run"을 "task"로 강제 변경
setCanvasMode("graph");    // "kanban"을 "graph"로 강제 변경
```

**결과**: Submit Work 후 사용자는 Kanban 보드 대신 Graph 뷰에 남게 됨. Run 패널 대신 Task 패널에 남게 됨. 비즈니스 플로우(Submit → Kanban → 모니터링)가 완전히 깨짐.

**수정**:
```typescript
// line 1388-1389를 삭제하거나, 아래로 교체:
setPanelMode("run");       // 실행 상태를 보여주기
setCanvasMode("kanban");   // Kanban 보드로 전환
```

---

### BUG-2 🔴 Z-index 스태킹 역전

**파일**: `styles.css`

| 요소 | z-index | 기대 순서 |
|------|---------|----------|
| `.build-prompt-bar` | 12 (line 1867) | 캔버스 위 |
| `.command-overlay` (모달 백드롭) | 20 (line 1051) | 모달 레이어 |
| `.toast` | 30 (line 1164) | 최상위 알림 |
| `.kanban-context-menu` | 40 (line 2346) | 컨텍스트 메뉴 |

**문제**: Toast(30)가 command-overlay(20)보다 위에 있어서, 모달이 열려 있을 때 토스트가 모달 위에 뜸. 이 자체는 의도일 수 있으나, **command-overlay 내부 dialog에 z-index가 없어서** 토스트가 dialog 컨텐츠를 가릴 수 있음.

**수정**: command-overlay 내부 dialog(`.command-bar`, `.import-modal` 등)에 `z-index: 21` 추가하거나, 전체 z-index 체계 재정리:

```
canvas elements:  1~10
build-prompt-bar: 12  (OK)
modal overlay:    50
modal dialog:     51
toast:            60
context-menu:     70
```

---

### BUG-3 🟠 Build Prompt Bar와 Status Bar 겹침

**파일**: `styles.css` line 1852~1868, line 1194~1207

**문제**: `.build-prompt-bar`의 `bottom: 24px`이고, `.status-bar`의 `height: 24px` (line 1199). 딱 맞는 것처럼 보이지만, `border-top: 1px`이 추가되어 실제 status-bar 높이는 25px. 또한 build-prompt-bar 자체의 padding(8px)과 border(1px)를 고려하면 **겹치거나 1px 간격**만 남음.

**수정**:
```css
.build-prompt-bar {
  bottom: 32px;  /* status-bar 높이 + 여유 간격 */
}
```

---

### BUG-4 🟠 Kanban 빈 상태 메시지 구분 실패

**파일**: `KanbanView.tsx` line 67~74

**코드**:
```typescript
if (!props.runId || props.tasks.length === 0) {
  return (
    <div className="kanban-empty">
      <div className="empty-title">No tasks yet</div>
      <div className="empty-subtitle">Run a task from the Team panel to populate this board.</div>
    </div>
  );
}
```

**문제**: `!runId`(실행 전)와 `tasks.length === 0`(실행했으나 아직 task 없음)을 같은 메시지로 처리. 사용자 입장에서:
- 실행 전: "아직 Work를 제출하지 않았습니다" 가 적절
- 실행 중 task 대기: "Task를 생성하는 중..." 이 적절

**수정**: 조건을 분리하여 각각 다른 메시지 표시

---

### BUG-5 🟡 Kanban empty 메시지의 레거시 용어

**파일**: `KanbanView.tsx` line 71

**문제**: `"Run a task from the Team panel"` — "Team panel"은 현재 UI에 존재하지 않는 이름 (Task 패널이 맞음). 또한 "Run a task"는 용어 통일 기준 "Submit Work"가 적절.

**수정**: `"Submit Work from the Task panel to populate this board."` 로 변경

---

### BUG-6 🟡 `runNodeFromPanel`과 `runTaskFromPanel`의 전환 불일치

**파일**: `App.tsx` line 1393~1419 vs 1368~1391

| 함수 | canvas 전환 | panel 전환 |
|------|-----------|-----------|
| `runFlowFromPanel()` | kanban | run |
| `runTaskFromPanel()` | graph ❌ | task ❌ |
| `runNodeFromPanel()` | kanban ✅ | run ✅ |

`runNodeFromPanel`은 올바르게 `kanban + run`으로 전환하는데, `runTaskFromPanel`만 `graph + task`로 덮어씀. 일관성 위반.

---

## 3. CSS / 레이아웃 이슈

### CSS-1 🟡 `.kanban-board`에 수평 스크롤 제한 없음

**파일**: `styles.css` line 2192~2198

```css
.kanban-board {
  height: 100%;
  display: flex;
  gap: 12px;
  padding: 14px;
  overflow: auto;  /* 수평+수직 모두 */
}
```

**문제**: 4개 컬럼(`min-width: 270px` 각) = 최소 1080px + gap(36px) + padding(28px) = 1144px. 창 너비가 좁으면 수평 스크롤이 발생하는데, **세로 스크롤바와 가로 스크롤바가 동시에 표시**되어 UX 혼란.

**수정**: `overflow-x: auto; overflow-y: hidden;`으로 분리하고, 각 `.kanban-column-body`에서 세로 스크롤 담당

---

### CSS-2 🟡 모바일/좁은 화면 대응 부족

**파일**: `styles.css` line 2487 — `@media (max-width: 1140px)` 단일 breakpoint만 존재

**문제**:
1. Kanban 보드에 breakpoint 없음 → 좁은 화면에서 4컬럼이 깨짐
2. Team Panel이 좁은 화면에서 border-left → border-top으로 바뀌지만 높이 제한 없음
3. Build Prompt Card(`.build-prompt-card` width: min(780px, 100%))는 적절하나, 내부 select가 `min-width: 220px`으로 고정

**수정**: Kanban에 `@media (max-width: 800px)` breakpoint 추가 → flex-wrap 또는 탭 전환 방식

---

### CSS-3 🔵 `.node-path` word-break 정책

**파일**: `styles.css` line 705~710

```css
.node-path {
  word-break: break-all;  /* 단어 중간에서 잘림 → 가독성 저하 */
}
```

**수정**: `word-break: break-word;` 또는 `overflow-wrap: break-word;`로 변경 (단어 경계에서 우선 줄바꿈)

---

### CSS-4 🔵 `.status-bar` 중복 정의

**파일**: `styles.css` line 1194~1207, line 2366~2369

첫 번째 정의:
```css
.status-bar {
  height: 24px;
  min-height: 24px;
  padding: 0 12px;
  ...
}
```

두 번째 정의 (line 2366):
```css
.status-bar {
  justify-content: flex-start;
  padding: 0 10px;  /* ← padding 2px 차이로 덮어씀 */
}
```

**수정**: 중복 정의 합치기. padding 값을 하나로 통일 (10px 또는 12px).

---

## 4. UX / 비즈니스 플로우 이슈

### FLOW-1 🔴 핵심 비즈니스 플로우 단절

**명세 기대 플로우**:
```
Build Prompt(팀 구성) → Task Panel(Work 제출) → Kanban(Task 추적) → Run(실행 모니터링)
```

**실제 코드 플로우** (BUG-1로 인해):
```
Build Prompt → Task Panel → Submit Work
  → runFlowFromPanel() [kanban + run 설정]
  → runTaskFromPanel() [graph + task로 덮어씀] ❌
  → 결과: Graph 화면 + Task 패널에 남음
```

**사용자 체감**: "Submit Work 눌렀는데 아무 변화 없음" → 실제로는 Run이 시작되었으나 화면 전환이 안 돼서 인지 불가

---

### FLOW-2 🟠 Inspector ↔ 노드 선택 연결 불안정

**문제**:
1. 노드 클릭 → Inspector 탭 활성화 → 정상
2. 다른 탭(Library/Task) 클릭 → Inspector 비활성
3. 다시 Inspector 탭 → `selectedNode`가 유지되나 sub-tab이 "overview"로 리셋
4. Edge 선택 → Inspector 표시는 되지만 edge 전용 뷰가 빈약

---

### FLOW-3 🟡 Build Prompt → Graph 전환 UX

**현재**: Build Prompt Stage (전체 화면) → "Build Team" 클릭 → graph 모드로 전환
**문제**: 전환 후 Build Prompt Bar(하단 바)가 즉시 보이지만, 사용자가 이미 팀을 빌드한 상태에서 바가 왜 다시 나타나는지 혼란

**수정 제안**: Build 완료 후 Build Prompt Bar를 축소 상태(아이콘만)로 표시하거나, "팀이 구성되었습니다" 상태 표시

---

## 5. 타입/코드 품질 이슈

### TYPE-1 🟡 Drag-and-Drop 데이터 타입 미검증

**파일**: `KanbanView.tsx` line 94

```typescript
const droppedTaskId = event.dataTransfer.getData("application/agentcanvas-task") || dragTaskId;
```

**문제**: Library에서 skill을 Kanban에 드래그하면 `getData`가 빈 문자열을 반환하고 `dragTaskId`가 undefined이므로 무시되지만, **다른 커스텀 MIME type의 데이터**가 들어올 경우 예상치 못한 동작 가능.

**수정**: drop 핸들러에서 받은 id가 실제 task id인지 `props.tasks`에서 확인

---

### TYPE-2 🔵 Agent 연결선(Edge) 기능 미구현

**현재 상태**: `StudioEdge.type`에 `"agentLink"` 정의 있음 (protocol.ts), `--edge-agent-link` CSS 변수도 존재 (styles.css line 30), 하지만 **AgentNode에 React Flow Handle이 없어서** 실제 agent→agent 연결 드래그 불가.

**수정**: 기존 plan (stateful-booping-scroll.md Task 2) 대로 Handle 추가 구현 필요

---

### TYPE-3 🔵 Agent 더블클릭 팝업 부분 구현

**현재 상태**: `AgentDetailModal.tsx` 파일 존재, 4개 탭(Overview/Skills/Rules/MCP). 하지만 `GraphView.tsx`의 `onNodeDoubleClick`에서 agent 타입 분기가 실제로 모달을 열도록 연결되었는지 검증 필요.

---

## 6. 우선순위별 수정 작업 목록

### 🔴 P0 — 즉시 수정 (비즈니스 로직 깨짐)

| ID | 작업 | 파일 | 예상 난이도 |
|----|------|------|-----------|
| BUG-1 | `runTaskFromPanel()` line 1388-1389 제거/교체 → kanban + run | App.tsx | ⭐ |
| USR-1a | `.kanban-column`에 `min-height: 0` 추가 | styles.css:2200 | ⭐ |
| USR-1b | `.kanban-column-body`에 `flex: 1; min-height: 0` 추가 | styles.css:2233 | ⭐ |
| BUG-2 | z-index 체계 정리 (overlay→50, toast→60) | styles.css 전반 | ⭐⭐ |
| BUG-3 | `.build-prompt-bar` bottom: 24px → 32px | styles.css:1854 | ⭐ |

### 🟠 P1 — 빠른 수정 (주요 UX 문제)

| ID | 작업 | 파일 | 예상 난이도 |
|----|------|------|-----------|
| USR-2 | Inspector 연결 디버깅 (selectedNode 전달 확인) | App.tsx, RightPanel.tsx | ⭐⭐ |
| USR-3 | Schedule 뷰 높이 보장 + fitView 호출 | ScheduleView.tsx, styles.css | ⭐⭐ |
| BUG-4 | Kanban empty state 메시지 분리 (no-run vs no-task) | KanbanView.tsx:67 | ⭐ |
| BUG-5 | "Team panel" → "Task panel", "Run a task" → "Submit Work" | KanbanView.tsx:71 | ⭐ |

### 🟡 P2 — 품질 개선

| ID | 작업 | 파일 | 예상 난이도 |
|----|------|------|-----------|
| USR-4 | 7개 클래스에 text-overflow 규칙 추가 | styles.css | ⭐⭐ |
| USR-5 | Task/Run 탭 서브타이틀 추가로 차이 명시 | RightPanel.tsx | ⭐ |
| USR-6 | Library 접기/펼치기 + 타입 필터 칩 | RightPanel.tsx | ⭐⭐⭐ |
| CSS-1 | kanban-board overflow-x/y 분리 | styles.css:2192 | ⭐ |
| CSS-4 | status-bar 중복 정의 합치기 | styles.css | ⭐ |
| BUG-6 | runNodeFromPanel vs runTaskFromPanel 일관성 | App.tsx | ⭐ |
| TYPE-1 | Kanban drop 핸들러 task id 검증 | KanbanView.tsx:94 | ⭐ |

### 🔵 P3 — 향후 개선

| ID | 작업 | 파일 | 예상 난이도 |
|----|------|------|-----------|
| USR-7 | + 버튼 툴팁/라벨 추가 | App.tsx (toolbar) | ⭐ |
| CSS-2 | 모바일 breakpoint 추가 (Kanban, Team Panel) | styles.css | ⭐⭐ |
| CSS-3 | `.node-path` word-break 개선 | styles.css:705 | ⭐ |
| TYPE-2 | Agent Edge Handle 추가 (plan 참조) | AgentNode.tsx, GraphView.tsx | ⭐⭐⭐ |
| TYPE-3 | Agent 더블클릭 모달 연결 검증 | GraphView.tsx, App.tsx | ⭐⭐ |
| FLOW-3 | Build Prompt → Graph 전환 UX 개선 | App.tsx | ⭐⭐ |

---

## 7. 검증 요약

| 카테고리 | 발견 수 | 🔴 | 🟠 | 🟡 | 🔵 |
|---------|--------|-----|-----|-----|-----|
| 사용자 보고 (USR) | 7 | 1 | 2 | 3 | 1 |
| 코드 버그 (BUG) | 6 | 2 | 2 | 2 | 0 |
| CSS 레이아웃 (CSS) | 4 | 0 | 0 | 2 | 2 |
| 비즈니스 플로우 (FLOW) | 3 | 1 | 1 | 1 | 0 |
| 타입/코드 품질 (TYPE) | 3 | 0 | 0 | 1 | 2 |
| **합계** | **23** | **4** | **5** | **9** | **5** |

**핵심 결론**: 가장 긴급한 문제는 **BUG-1 (runTaskFromPanel 화면 전환 덮어쓰기)**로, 이 한 줄 수정만으로 핵심 비즈니스 플로우(Submit Work → Kanban + Run 모니터링)가 복원됩니다. 그 다음 **Kanban 스크롤 (USR-1)** 과 **z-index 정리 (BUG-2)** 를 처리하면 주요 사용성 문제가 해소됩니다.

---

## 8. 2차 코드 리뷰 — 추가 이슈 (2026-02-20)

> 코드 정적 분석 + CLI 도구 조사 결과 추가 발견된 이슈

---

### NEW-1 🔴 sendChatMessage — 사용자 메시지 미표시

**파일:** `webview-ui/src/App.tsx` line 1717~1738
**심각도:** 🔴 CRITICAL — 채팅 핵심 기능 불능

**문제 코드:**
```tsx
const sendChatMessage = async (content: string) => {
  const trimmed = content.trim();
  if (!trimmed) return;
  setChatSending(true);
  try {
    await requestToExtension({ type: "CHAT_SEND", payload: { ... } });
    // ❌ appendLocalChatMessage() 호출 없음
    setPanelMode("chat");  // ← Library 뷰 덮어씀
    setPanelOpen(true);
  } finally {
    setChatSending(false);
  }
};
```

**수정:**
```tsx
// requestToExtension 전에 로컬 메시지 추가
appendLocalChatMessage(
  createLocalChatMessage("user", [{ kind: "text", text: trimmed }])
);
```

---

### NEW-2 🔴 AgentPreviewModal.overwriteExisting — Rebuild 시 미삭제

**파일:** `webview-ui/src/panels/AgentPreviewModal.tsx` line 37
**심각도:** 🔴 CRITICAL — 데이터 누적/오염

**문제 코드:**
```tsx
const [overwriteExisting, setOverwriteExisting] = useState(false);
// Rebuild 모드 여부와 무관하게 항상 false
```

**수정:** `rebuildMode` prop 추가, Rebuild 모드이면 기본값 `true`

---

### NEW-3 🟠 chatBackendId 하드코딩 — Orchestrator 설정 무시

**파일:** `webview-ui/src/App.tsx` line 136
**심각도:** 🟠 HIGH — Orchestrator와 다른 Backend로 메시지 전송

**문제 코드:**
```tsx
const [chatBackendId, setChatBackendId] = useState<...>("claude");
// Orchestrator가 Codex로 설정되어도 Claude로 전송
```

**수정:** snapshot의 orchestrator `runtime.backendId`를 읽어 동기화하는 `useEffect` 추가

---

### NEW-4 🟠 canvas-controls z-index — Build Prompt Bar에 가려짐

**파일:** `webview-ui/src/styles.css`
**심각도:** 🟠 HIGH — Zoom 버튼 클릭 불가

**문제 코드:**
```css
.build-prompt-bar { bottom: 32px; z-index: 12; }  /* 위에 있음 */
.canvas-controls  { bottom: 14px; z-index: 5;  }  /* 가려짐 */
```

**수정:** `canvas-controls` → `bottom: 90px; z-index: 15;`

---

### NEW-5 🟡 ChatInput model — `<input>` 자유 입력, 드롭다운 아님

**파일:** `webview-ui/src/panels/ChatInput.tsx` line 68
**심각도:** 🟡 MEDIUM — 오타/잘못된 모델명 입력 가능

**문제 코드:**
```tsx
<input value={props.modelId ?? ""} placeholder="model (optional)" />
```

**수정:** `<select>` 전환, `MODEL_OPTIONS[backendId]`로 동적 옵션

---

### NEW-6 🟡 backendProfiles.ts 모델 ID 불일치

**파일:** `extension/src/services/backendProfiles.ts`
**심각도:** 🟡 MEDIUM — CLI에 잘못된 모델 ID 전달 가능

**문제:**
| Backend | 현재 등록 | 실제 올바른 ID |
|---------|----------|--------------|
| Claude | `haiku-4.5`, `sonnet-4.5`, `opus-4.5` | `claude-haiku-4-5-20251001` 등 full ID |
| Codex | `o3-mini`, `o3`, `codex-1` | `gpt-4.1`, `o4-mini` 등 누락 |

**수정:** AGENT_TEAM_BUILD_SPEC.md §12.4 참조

---

### NEW-7 🟡 팀 Apply 후 노드 자동 정렬 없음

**파일:** `webview-ui/src/canvas/GraphView.tsx`
**심각도:** 🟡 MEDIUM — 생성 후 노드 겹침

**문제:** `applyTidyLayout()` 함수는 존재하나 팀 Apply 후 자동 호출되지 않음

**수정:** `autoLayoutSignal` prop + `useEffect`로 Apply 후 자동 실행

---

### NEW-8 🔵 AgentCreationModal — Backend/Model 필드 없음

**파일:** `webview-ui/src/panels/AgentCreationModal.tsx`
**심각도:** 🔵 LOW — 기능 미비

**현재:** Agent 생성 시 backend/model 지정 불가 → 기본값으로만 생성

**수정:** Backend select + Model select 추가, `onCreate` payload 확장

---

### NEW-9 🔵 RightPanel — New Skill 섹션 잔존

**파일:** `webview-ui/src/panels/RightPanel.tsx` line 131
**심각도:** 🔵 LOW — UX 중복 (TeamPanel에서 이동 예정)

**현재:** `newSkill` LibrarySectionKey 및 관련 UI 존재
**수정:** 섹션 전체 제거, TeamPanel `+ Skill` 버튼으로 대체

---

## 9. 2차 검증 요약

| 카테고리 | 발견 수 | 🔴 | 🟠 | 🟡 | 🔵 |
|---------|--------|-----|-----|-----|-----|
| 2차 신규 (NEW) | 9 | 2 | 2 | 3 | 2 |

### 전체 누계

| 라운드 | 이슈 수 | 🔴 | 🟠 | 🟡 | 🔵 |
|--------|--------|-----|-----|-----|-----|
| 1차 (USR+BUG+CSS+FLOW+TYPE) | 23 | 4 | 5 | 9 | 5 |
| 2차 (NEW-1~9) | 9 | 2 | 2 | 3 | 2 |
| **합계** | **32** | **6** | **7** | **12** | **7** |

### 2차 수정 우선순위

| 순서 | 이슈 | 파일 | 비고 |
|------|------|------|------|
| 1 | NEW-1 메시지 미표시 | `App.tsx` | 1~2줄 수정 |
| 2 | NEW-2 Rebuild 미삭제 | `AgentPreviewModal.tsx` | prop 추가 |
| 3 | NEW-4 Zoom 가림 | `styles.css` | CSS 2줄 수정 |
| 4 | NEW-3 Backend 미동기화 | `App.tsx` | useEffect 추가 |
| 5 | NEW-5 모델 드롭다운 | `ChatInput.tsx` | input→select |
| 6 | NEW-6 모델 ID 불일치 | `backendProfiles.ts` | 배열 교체 |
| 7 | NEW-7 자동 레이아웃 | `GraphView.tsx` | signal+useEffect |
| 8 | NEW-8 Agent 모달 확장 | `AgentCreationModal.tsx` | 필드 추가 |
| 9 | NEW-9 New Skill 제거 | `RightPanel.tsx` | 섹션 삭제 |
