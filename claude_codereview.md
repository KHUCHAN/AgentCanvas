# claude_codereview.md — AgentCanvas 전체 코드 리뷰

> 작성일: 2025-02
> 검증 범위: 사용자 보고 버그 4건 + 설계 불일치 항목 전체 정리

---

## 전체 요약

| # | 카테고리 | 파일 | 심각도 | 핵심 문제 |
|---|---------|------|--------|-----------|
| R-1 | 모델 갱신 | backendModelPoller.ts | 🔴 HIGH | Gemini 모델 조회 명령 오류, Claude/Codex도 regex 방식 불안정 |
| R-2 | 레이아웃 | styles.css + App.tsx | 🔴 HIGH | 채팅 scroll이 workspace 높이를 무제한 확장 → Kanban/Schedule 깨짐 |
| R-3 | 그래프 삭제 | GraphView.tsx + extension.ts | 🔴 HIGH | Graph에서 에이전트 노드 직접 삭제 UI 없음, 파일 삭제 시 재스캔으로 부활 |
| R-4 | 오케스트레이션 | chatOrchestrator.ts + extension.ts | 🔴 HIGH | Orchestrator가 실제 LLM 호출 없이 텍스트 파싱만으로 플랜 생성, 할당 로직도 무효화됨 |
| R-5 | 모델 라우팅 | modelRouter.ts | 🔴 HIGH | 백엔드 무관 Claude 모델 ID 반환 → Codex/Gemini CLI 오류 (V-BUG-6, 이미 수정됨) |
| R-6 | 할당 UI | AgentCreationModal.tsx | 🟡 MED | Gemini 전용 설정 필드 없음 (V-BUG-7) |
| R-7 | Rebuild 버튼 | BuildPromptBar.tsx + App.tsx | 🔴 HIGH | 컴팩트 모드 에러 무음, Promise void 폐기 (V-BUG-1, V-BUG-4) |
| R-8 | Quota Poller | claudeQuotaPoller.ts | 🔴 HIGH | `/status` 헤드리스 프롬프트 전송 (이미 수정됨) |
| R-9 | Args 필터 | cliExecutor.ts | 🔴 HIGH | `-p` 단축형 미필터링 (V-BUG-3) |

---

## 1. 모델 갱신 문제 — 프로그램 시작 시 CLI로 모델/사용량 조회

### 현재 코드 (`backendModelPoller.ts`)

```ts
// Gemini — line 73
const models = await tryExecJsonModelList(
  backend.command,
  ["models", "list", "--json"],   // ❌ 존재하지 않는 Gemini CLI 서브커맨드
  "id"
);

// Claude — line 91
const raw = await tryExec(backend.command, ["--help"]);
// ❌ --help 출력에 모델 이름이 없을 수 있음
// regex: /(claude-[a-z0-9.-]+|sonnet|haiku|opus)/gi
// → 너무 넓어서 오탐 가능

// Codex — line 91 (동일)
const raw = await tryExec(backend.command, ["--help"]);
// regex: /(gpt-[\w.-]+|o[134][\w.-]*|codex-[\w.-]+)/gi
// → --help에 모델 목록이 없음
```

### 실제 Gemini CLI 모델 조회 방법

```bash
# Gemini CLI 실제 명령어:
gemini --list-models          # 모델 목록
gemini --version              # 버전 확인
# gemini models list → 존재하지 않음 (404 오류)
```

### 사용량 조회 — 현재 미구현

| 백엔드 | 현재 상태 | 조회 방법 |
|--------|-----------|-----------|
| Claude | 🟡 부분 (status 서브커맨드) | `claude status --json` (수정됨) |
| Gemini | ❌ 없음 | `gemini --usage` 또는 API |
| Codex  | ❌ 없음 | `codex --usage` 또는 API |

### 수정 방향 — 시작 시 1회 CLI 조회

```ts
// backendModelPoller.ts 수정안

// Gemini 모델 조회 수정
if (backendId === "gemini") {
  // 방법 A: --list-models 플래그 사용
  const raw = await tryExec(backend.command, ["--list-models"]);
  // 방법 B: 정적 alias 목록 사용 (pro, flash, flash-lite, auto)
  // Gemini CLI는 alias 기반이므로 정적 목록이 더 안정적
  return [
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro" }
  ];
}

// Claude 모델 조회 개선
if (backendId === "claude") {
  // claude --list-models 또는 config 파일 확인
  const raw = await tryExec(backend.command, ["--list-models"]);
  if (!raw) {
    // fallback: 알려진 모델 목록
  }
}
```

**사용자 요구사항 반영**: 프로그램 시작(extension activate)시 1회 조회 → 캐시 → 주기적 갱신

```ts
// extension.ts onWebviewReady()에 추가
await Promise.allSettled([
  this.publishBackendModelsUpdate(backends),   // 모델 목록
  this.publishBackendQuotaUpdate(backends),     // 사용량
]);
```

---

## 2. 채팅 스크롤 → Kanban/Schedule 레이아웃 파괴

### 증상
- 채팅 메시지가 쌓일수록 RightPanel이 세로로 무한 확장
- `workspace-body` 전체 높이가 늘어남 → Kanban/Schedule 영역이 viewport 아래로 밀림

### 근본 원인 분석

```css
/* styles.css line 78–84 */
.studio-shell {
  display: grid;
  grid-template-columns: 260px 1fr;
  /* ❌ grid-template-rows: 없음 */
  /* ❌ height: 없음 (100% 상속받지만 명시 없음) */
}

/* styles.css line 228–233 */
.workspace-body {
  display: grid;
  grid-template-columns: 1fr auto;
  min-width: 0;
  min-height: 0;
  /* ❌ height: 없음 */
  /* ❌ grid-template-rows: 없음 */
}
```

### 레이아웃 높이 체인 분석

```
html/body/root { height: 100% } ← 정상
  └── .studio-shell { height: 100%? grid-template-columns만 있음 }
        └── [우측 영역 = 내부 컨테이너]
              ├── header { flex-shrink: 0 } ← 정상
              └── .workspace-body { height: ??? }
                    ├── .workspace-main { height: 100% }
                    │     └── KanbanView / ScheduleView { height: 100% }
                    └── .right-panel { height: 100% }
                          └── .chat-panel { height: 100% }
                                └── .chat-messages { overflow-y: auto }  ← 여기가 스크롤되어야 함
```

`.workspace-body`에 `height: 100%`가 없으면 `right-panel`의 `height: 100%`는 **컨텐츠 높이**를 기준으로 계산됨. 채팅이 늘어날수록 `workspace-body` 전체가 커짐 → Kanban/Schedule도 덩달아 커짐 → viewport 밖으로 밀림.

### 수정 방향

```tsx
// App.tsx — workspace 구조
<div className="studio-shell">
  <LeftSidebar />
  <div className="workspace-area">  {/* 새 클래스 추가 */}
    <header>...</header>
    <div className={`workspace-body ${panelOpen ? "is-team-mode" : ""}`}>
      ...
    </div>
  </div>
</div>
```

```css
/* styles.css 수정 */
.studio-shell {
  display: grid;
  grid-template-columns: 260px 1fr;
  grid-template-rows: 100%;   /* ← 추가 */
  height: 100%;               /* ← 명시적으로 추가 */
}

.workspace-area {             /* ← 신규 */
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.workspace-body {
  flex: 1;                    /* ← 추가 (남은 공간 채움) */
  min-height: 0;              /* ← 유지 */
  overflow: hidden;           /* ← 추가 (자식이 넘치면 숨김) */
}

/* chat-panel은 이미 올바름 */
.chat-panel {
  height: 100%;
  display: grid;
  grid-template-rows: 1fr auto;  /* messages 1fr, input auto */
}

.chat-messages {
  min-height: 0;      /* ← 유지 (grid 내 overflow 허용) */
  overflow-y: auto;   /* ← 유지 */
}
```

### 핵심 규칙
- 채팅 스크롤은 `.chat-messages` 내부에서만 발생해야 함
- `.workspace-body`는 viewport 높이를 넘어서면 안 됨
- `height: 100%` 체인이 끊어지지 않도록 모든 중간 컨테이너에 `min-height: 0` + `overflow: hidden`

---

## 3. Graph 노드 삭제 안 됨

### 증상
- 생성된 에이전트 그래프 노드를 삭제하려 해도 삭제되지 않음

### 근본 원인 1 — GraphView에 에이전트 삭제 UI 없음

```tsx
// GraphView.tsx props (line 39–83)
type GraphViewProps = {
  onDeleteNote: (noteId: string) => void;   // ← Note 삭제 있음
  onHideNode: (nodeId: string) => void;     // ← 숨김 있음
  // ❌ onDeleteAgent 없음!
  // ❌ 키보드 Delete 키로 에이전트 삭제하는 핸들러 없음
};
```

에이전트 삭제는 **오직** `AgentDetailModal`의 "Delete" 버튼으로만 가능:
- Graph에서 에이전트 더블클릭 → AgentDetailModal 열림 → "Delete Agent" 버튼 → `deleteAgent()`

### 근본 원인 2 — 삭제 후 파일이 남으면 재스캔 시 부활

```ts
// extension.ts line 537–541
case "DELETE_AGENT": {
  await deleteAgentProfile(this.getWorkspaceRoot(), message.payload.agentId);
  await this.refreshState();   // ← 워크스페이스 재스캔
  return { ok: true };
}
```

```ts
// GraphView.tsx line 222–225
useEffect(() => {
  setNodes(mappedNodes);   // ← snapshot 변경 시 항상 덮어씀
  setEdges(mappedEdges);
}, [mappedEdges, mappedNodes, setEdges, setNodes]);
```

`deleteAgentProfile`이 실제로 에이전트 디렉토리/파일을 디스크에서 삭제하지 못하면 → `refreshState()` 재스캔 시 파일이 재발견 → `snapshot.nodes` 재생성 → `mappedNodes` 재계산 → `setNodes()` 재호출 → 노드가 다시 나타남.

### 현재 삭제 플로우 검증 필요 항목

```
deleteAgentProfile(workspaceRoot, agentId)
  → 실제로 ~/.claude/agents/{agentId}/ 디렉토리 삭제?
  → 또는 단순히 메타데이터 파일 삭제?
  → AGENTS.md 항목 제거?
```

### 수정 방향

**A — GraphView에 에이전트 삭제 키보드/버튼 추가**:

```tsx
// GraphView.tsx
const onKeyDown = useCallback((event: KeyboardEvent) => {
  if (event.key === "Delete" || event.key === "Backspace") {
    if (selectedNodeId) {
      const node = nodes.find((n) => n.id === selectedNodeId);
      if (node?.type === "agent") {
        onDeleteAgent?.(selectedNodeId);
      }
      if (node?.type === "note") {
        onDeleteNote(selectedNodeId);
      }
    }
  }
}, [selectedNodeId, nodes, onDeleteAgent, onDeleteNote]);
```

**B — 컨텍스트 메뉴 우클릭으로 에이전트 삭제 옵션 추가**

**C — 삭제 확인 다이얼로그 추가** (실수 삭제 방지)

**D — `deleteAgentProfile` 완전 삭제 검증**: 에이전트 홈 디렉토리 포함 전체 삭제 확인

---

## 4. Task Orchestration 로직 미구현 — 핵심 설계 불일치

### 기대 동작 (올바른 시스템 설계)

```
사용자 → 채팅 전송
  ↓
Orchestrator Agent (Claude/Codex/Gemini LLM 실제 호출)
  ↓ "작업을 분해해줘" 프롬프트
Orchestrator가 LLM 응답으로 Work Plan 생성
  ├── Task 1: "로그인 기능 구현" → 코더 에이전트 A
  ├── Task 2: "유닛 테스트 작성" → 테스터 에이전트 B
  └── Task 3: "코드 리뷰" → 리뷰어 에이전트 C
  ↓
각 에이전트가 자신의 CLI 백엔드로 실제 실행
  ├── 에이전트 A: claude --model ... "로그인 구현해줘"
  ├── 에이전트 B: codex exec "테스트 작성해줘"
  └── 에이전트 C: gemini "리뷰해줘"
```

### 실제 동작 (현재 구현)

```
사용자 → 채팅 전송
  ↓
ChatOrchestrator.handleUserMessage() — ⚠️ LLM 호출 없음
  ↓ 단순 텍스트 파싱 (쉼표/줄바꿈/키워드 분할)
Work Plan 생성 — ⚠️ AI 분석 없음
  ├── "research" 키워드 → gemini 배정
  ├── "review" 키워드 → codex 배정
  └── 나머지 → 기본 백엔드
  ↓
confirmWorkPlanAndStart() 호출 시:
  instruction = "Execute this work plan:\n1. xxx → Agent A\n2. yyy → Agent B"
  runFlow("default", instruction)   // ⚠️ Work Plan의 에이전트 배정 무시!
  ↓
buildTasksFromFlow(flow.nodes, flow.edges)  // ⚠️ 그래프 노드 기반으로 태스크 생성
  ↓
executeRunLoop()  // 그래프 위상 순서로 모든 에이전트 순차/병렬 실행
  ↓ 각 에이전트가 동일한 instruction으로 실행됨 (개별 할당 없음)
```

### 코드 레벨 문제점

**문제 A — ChatOrchestrator가 실제 LLM을 호출하지 않음**

```ts
// chatOrchestrator.ts line 63-87
const draftPlan = this.buildDraftPlan({
  request: message,
  agents: input.context.agents,
  backendId: input.backendId
});

// buildDraftPlan() — line 90-122
function buildDraftPlan(input) {
  const fragments = splitWorkItems(input.request);
  // ❌ Claude/Codex/Gemini API 호출 없음
  // ❌ executeCliPrompt() 미호출
  // ❌ 그냥 텍스트 쪼개기 (쉼표, 줄바꿈, ' and ', ' then ' 등)
  return { id, status: "draft", items, ... };
}
```

**문제 B — confirmWorkPlanAndStart가 Work Plan 배정을 무시함**

```ts
// extension.ts line 4097-4104
const run = await this.runFlow({
  flowName: "default",   // ❌ 항상 "default" flow 실행
  instruction: `Execute this work plan:\n${instructionLines.join("\n")}`,
  // ❌ confirmed.items의 assignedAgentId는 무시됨
  // ❌ buildTasksFromFlow가 그래프 노드 기반으로 태스크 재생성
});
```

**문제 C — buildTasksFromFlow가 에이전트 배정 사용 안 함**

```ts
// extension.ts line 2533
const tasks = this.buildTasksFromFlow(run.runId, flow.nodes, flow.edges);
// flow.nodes = 그래프 캔버스 노드
// confirmed.items (Work Plan의 배정 정보) = 완전히 무시됨
```

**문제 D — 모든 에이전트가 같은 instruction으로 실행됨**

```ts
// executeRunLoop() 내부 (line ~2800-2950)
// 각 태스크마다 동일한 instruction 사용
// 개별 에이전트별 맞춤 프롬프트 없음
```

### 올바른 아키텍처 수정 방향

```ts
// Phase 1: Orchestrator가 LLM을 실제 호출해서 Work Plan 생성
async function buildDraftPlanViaLLM(input: {
  request: string;
  agents: AgentProfile[];
  backendId: NonAutoBackendId;
  workspacePath: string;
}): Promise<WorkPlan> {
  const orchestratorSystemPrompt = `
    You are an orchestrator AI. The user gave you a task.
    Break it down into subtasks. Assign each subtask to the most appropriate agent.
    Available agents: ${input.agents.map(a => `${a.id} (${a.role})`).join(", ")}
    Return JSON: { items: [{ title, description, assignedAgentId, priority }] }
  `;

  const result = await executeCliPrompt({
    backend: pickBackend(input.backendId),
    prompt: `Plan this task:\n${input.request}`,
    systemPrompt: orchestratorSystemPrompt,
    workspacePath: input.workspacePath
  });

  // JSON 파싱 → WorkPlan 생성
  return parseWorkPlanFromLLMResponse(result.output, input.agents);
}

// Phase 2: 각 Work Plan Item을 해당 에이전트에게 개별 실행
async function executeWorkPlanItems(
  planItems: WorkPlanItem[],
  agents: AgentProfile[]
): Promise<void> {
  for (const item of planItems) {
    const agent = agents.find(a => a.id === item.assignedAgentId);
    if (!agent) continue;

    await executeCliPrompt({
      backend: getBackendForAgent(agent),
      prompt: `Execute this task:\n${item.title}\n${item.description}`,
      systemPrompt: agent.systemPrompt,
      workspacePath: getAgentWorkspace(agent)
    });
  }
}
```

### 단기 수정 (최소 개선)

```ts
// confirmWorkPlanAndStart()에서 Work Plan 배정 존중
for (const item of confirmed.items) {
  const task = createTaskFromWorkPlanItem(item);  // item의 배정 정보 사용
  scheduleService.addTask(runId, task);
}

// executeRunLoop에서 각 태스크별 맞춤 실행
const agentSpecificInstruction = buildAgentInstruction(task, item);
// agent.systemPrompt + item.description 조합
```

---

## 5. 기타 발견된 설계 불일치

### 5-1. Gemini CLI 실행 분기 없음 (`cliExecutor.ts`)

```ts
// cliExecutor.ts — Gemini는 별도 분기 없이 fallback 사용
if (family === "claude") { ... }   // ✅ 있음
if (family === "codex") { ... }    // ✅ 있음
// ❌ if (family === "gemini") → 없음!

// fallback (line 315-330):
const args = [...baseArgs, ...resolveModelArgs(family, modelId)];
args.push(...resolvePromptArgs(baseArgs, prompt));
return { command: input.backend.command, args, stdinPrompt: false, streamFormat: "plain" };
// → gemini --model "..." -- "prompt"
// ❌ Gemini는 이 형식이 아님!
// ❌ streamFormat: "plain" → 스트리밍 없음
```

**올바른 Gemini CLI 호출**:
```bash
# Gemini CLI 헤드리스 모드:
gemini -p "prompt"
# 또는:
echo "prompt" | gemini
# 출력 형식:
gemini --output-format stream-json -p "prompt"  # 지원 여부 미확인
```

### 5-2. 백엔드 `stdinPrompt` 설정이 잘못됨

```ts
// cliDetector.ts DEFAULT_BACKENDS
{ id: "claude", stdinPrompt: true }   // ❌ Claude는 -p 플래그 사용, stdin 아님
{ id: "gemini", stdinPrompt: true }   // ❌ Gemini도 -p 플래그 사용
{ id: "codex",  stdinPrompt: true }   // ❌ Codex는 positional arg 사용
```

```ts
// cliExecutor.ts — stdinPrompt가 true면 stdin으로 전달
if (invocation.stdinPrompt) {
  child.stdin.write(prompt);
  child.stdin.write("\n");
}
child.stdin.end();
```

하지만 `buildCliInvocation`에서 Claude는 `-p prompt` 방식으로 args에 추가하고 `stdinPrompt: false`를 반환함. 이 불일치는 `DEFAULT_BACKENDS.stdinPrompt`가 실제 실행에 영향을 주지 않는 것처럼 보이지만, custom/fallback 경로에서는 영향을 줄 수 있음.

### 5-3. normalizeBaseArgs `-p` 미필터 (V-BUG-3)

```ts
// cliExecutor.ts line 356-358
if (family === "claude") {
  return args.filter((arg) => arg !== "--print");  // ❌ "-p" 미필터
}
```

### 5-4. BuildPromptBar 컴팩트 모드 에러 무음 (V-BUG-1)

```tsx
// 컴팩트 모드에 progress/error 표시 없음
// 채팅 generate 실패 시 사용자에게 아무 피드백 없음
```

### 5-5. Gemini 전용 에이전트 생성 UI 없음 (V-BUG-7)

```tsx
// AgentCreationModal.tsx
{backendId === "claude" && (<> Claude 전용 필드 </>)}
{backendId === "codex"  && (<> Codex 전용 필드 </>)}
// ❌ backendId === "gemini" 분기 없음
```

---

## 6. 수정 우선순위 및 파일 목록

### 🔴 Phase 1 — 즉시 수정 (critical bugs)

| 순서 | 파일 | 수정 내용 |
|------|------|-----------|
| 1 | `webview-ui/src/styles.css` | `.studio-shell`에 height + grid-template-rows 추가, `.workspace-body` 높이 체인 수정 |
| 2 | `webview-ui/src/App.tsx` | workspace-area 래퍼 div 추가, `void buildTeamFromPromptBar()` → `.catch()` 추가 |
| 3 | `webview-ui/src/components/BuildPromptBar.tsx` | 컴팩트 모드에 에러 progress 표시 추가 |
| 4 | `extension/src/services/cliExecutor.ts` | Gemini 전용 빌드 분기 추가, `-p` 필터 추가 |
| 5 | `extension/src/services/backendModelPoller.ts` | Gemini 모델 조회 명령 수정 (`--list-models`), Claude/Codex도 개선 |
| 6 | `webview-ui/src/canvas/GraphView.tsx` | 에이전트 노드 Delete 키 핸들러 추가, `onDeleteAgent` prop 추가 |

### 🟠 Phase 2 — 아키텍처 수정 (high importance)

| 순서 | 파일 | 수정 내용 |
|------|------|-----------|
| 7 | `extension/src/services/chatOrchestrator.ts` | `buildDraftPlan` → `executeCliPrompt` 실제 LLM 호출로 대체 |
| 8 | `extension/src/extension.ts` | `confirmWorkPlanAndStart` → Work Plan 배정 존중, 에이전트별 개별 태스크 실행 |
| 9 | `webview-ui/src/panels/AgentCreationModal.tsx` | Gemini 전용 필드 (approval mode, sandbox, web search) 추가 |
| 10 | `extension/src/services/backendModelPoller.ts` | 시작 시 모델 목록 + 사용량 조회 로직 통합 |

### 🟡 Phase 3 — 개선 사항 (medium importance)

| 순서 | 파일 | 수정 내용 |
|------|------|-----------|
| 11 | `extension/src/services/cliDetector.ts` | `stdinPrompt` 기본값 수정 |
| 12 | `extension/src/extension.ts` | `GENERATE_AGENT_STRUCTURE`에 `backendFamily` 전달 (V-BUG-6, 이미 수정됨) |
| 13 | `extension/src/services/claudeQuotaPoller.ts` | PTY 방식 quota 조회 완성 (현재 status 서브커맨드 방식으로 부분 수정됨) |

---

## 7. 우리 시스템과 다르게 개발된 부분 요약

| 우리 설계 | 현재 구현 | 파일 |
|-----------|-----------|------|
| Orchestrator가 LLM으로 플랜 생성 | 텍스트 키워드 파싱으로 플랜 생성 | chatOrchestrator.ts |
| Work Plan 배정이 실제 실행에 반영 | runFlow("default")가 배정 무시하고 graph 기반 실행 | extension.ts |
| 각 에이전트가 자신의 CLI로 태스크 실행 | 모든 에이전트가 같은 instruction으로 실행 | extension.ts |
| Gemini CLI 전용 실행 경로 | Gemini는 generic fallback 사용 (잘못된 형식) | cliExecutor.ts |
| 모델 목록 CLI로 동적 조회 | Gemini는 존재하지 않는 명령어 사용 | backendModelPoller.ts |
| 채팅 스크롤이 내부에서만 발생 | 채팅 overflow가 전체 layout 높이를 확장 | styles.css |
| Graph에서 에이전트 직접 삭제 가능 | 삭제는 Modal 통해서만 가능, 파일 삭제 안 되면 부활 | GraphView.tsx |
| Gemini 에이전트 생성 시 전용 설정 | Gemini 전용 UI 없음 | AgentCreationModal.tsx |
| 백엔드별 모델 ID 매핑 | 항상 Claude 모델 ID 사용 (이미 수정됨) | modelRouter.ts |
| Rebuild 실패 시 에러 표시 | 컴팩트 모드 silent fail | BuildPromptBar.tsx |

---

*이 문서는 코드 검토 결과를 정리한 것입니다. Phase 1부터 순서대로 수정을 진행하시기 바랍니다.*
