# AgentCanvas — Bug Fix & Feature Spec

> 작성일: 2026-02-20
> 대상 디렉토리: `webview-ui/src/` + `extension/src/`
> 개발 진행 전 확인용 문서
> 참고 원본: `old/CLAUDE_CLI_APPLY_SPEC.md`, `old/CODEX_CLI_APPLY_SPEC.md`, `old/GEMINI_CLI_APPLY_SPEC.md`

---

## 목차

### 기존 항목 (BUG/FEAT/LAYOUT)
1. [BUG-1] Team Rebuild 시 기존 팀이 삭제되지 않음
2. [BUG-2] Chat Send 시 패널 초기화 + 메시지 미표시
3. [BUG-3] 팀 Confirm 화면의 사용량이 전부 0
4. [BUG-4] Orchestration 백엔드가 Chat에 반영되지 않음
5. [FEAT-5] 최신 모델 목록 반영 + 드롭다운 전환
6. [FEAT-6] 채팅 UI → 터미널 인터랙션 방식으로 개선
7. [FEAT-7] Agent 추가 모달에 Backend / Model 선택 추가
8. [FEAT-8] TeamPanel에 +Skill 버튼, RightPanel에서 New Skill 섹션 제거
9. [LAYOUT-1] Build Prompt Bar가 Zoom 버튼을 가림
10. [LAYOUT-2] 팀 생성 후 노드 배치가 정리되지 않음

### 신규 항목 (CLI 통합)
11. [CLI-1] 3-Backend cliExecutor 통합 — spawn() + stream-json 파싱
12. [CLI-2] 3-Backend 권한 정책 통합 — 권한 모드 UI 통합 슬라이더
13. [CLI-3] 3-Backend 쿼터 폴러 통합 — claudeQuota / codexQuota / geminiQuota + backendAllocator
14. [CLI-4] 동적 모델 목록 조회 — backendModelPoller.ts (PTY 기반)
15. [CLI-5] 프로젝트 컨텍스트 파일 3종 자동 생성 — CLAUDE.md + AGENTS.md + GEMINI.md
16. [CLI-6] Gemini Plan Mode — Agent 분석 전용 실행 모드 (/plan)
17. [CLI-7] 예산/턴 제한 설정 UI — --max-turns / --max-budget-usd / per-backend 정책
18. [CLI-8] 세션 재개 통합 — --resume / codex resume / gemini -r 자동화
19. [CLI-9] Google Search + Web Fetch — enableWebSearch 에이전트 플래그
20. [CLI-10] Hooks 자동 생성 — Claude PreToolUse / Gemini BeforeTool → settings 파일
21. [CLI-11] Agent Skills 3-Backend 내보내기 — SKILL.md 포맷 통합
22. [CLI-12] Docker Sandbox 격리 — Gemini + Codex --sandbox 통합 UI

---

## 우선순위 통합표

| 우선순위 | 이슈 | 설명 | 이유 |
|---------|------|------|------|
| 🔴 P0 | BUG-2 | Chat 미동작 | 핵심 기능 불가 — spawn() 전환이 선행 |
| 🔴 P0 | BUG-1 | Rebuild 미삭제 | 데이터 오염 |
| 🔴 P0 | CLI-1 | 3-Backend spawn + stream-json | BUG-2/3의 근본 수정 + Codex/Gemini 경로 추가 |
| 🔴 P0 | CLI-2 | 권한 정책 통합 UI | 실행 안전성, 3 CLI 모두 다른 플래그 → 통합 필요 |
| 🟠 P1 | BUG-3 | 사용량 0 + 쿼터 조회 | 멀티 백엔드 부하 분산의 전제 조건 |
| 🟠 P1 | BUG-4 | Backend 미동기화 | 오작동 |
| 🟠 P1 | LAYOUT-1 | Zoom 가림 | UX 차단 |
| 🟠 P1 | CLI-3 | 3-Backend 쿼터 폴러 + 분배기 | BUG-3의 확장 — Codex/Gemini 쿼터 통합 |
| 🟠 P1 | CLI-4 | 동적 모델 목록 조회 | FEAT-5의 완성 — PTY 기반 실시간 목록 |
| 🟠 P1 | CLI-5 | 컨텍스트 파일 3종 생성 | 팀 Apply 시 3 CLI 모두 컨텍스트 확보 |
| 🟠 P1 | CLI-6 | Gemini Plan Mode | Gemini 고유 기능 — 분석 전용 실행 모드 |
| 🟡 P2 | LAYOUT-2 | 생성 후 레이아웃 | UX |
| 🟡 P2 | CLI-7 | 예산/턴 제한 UI | 실행 비용/시간 제어 |
| 🟡 P2 | CLI-8 | 세션 재개 통합 | 긴 작업 재개, 비용 절감 |
| 🟡 P2 | CLI-9 | enableWebSearch 플래그 | Gemini/Codex 웹 능력 활성화 |
| 🟡 P2 | CLI-10 | Hooks 자동 생성 | 워커 에이전트 보안/로깅 정책 |
| 🟡 P2 | CLI-11 | Skills 내보내기 통합 | AgentCanvas Skill → 3 CLI SKILL.md |
| 🟡 P2 | CLI-12 | Docker Sandbox UI | Gemini 격리 실행 지원 |
| 🟢 P3 | FEAT-5 | 최신 모델 정적 목록 | CLI-4와 병행, 정적 fallback |
| 🟢 P3 | FEAT-6 | 터미널 UI | UX 개선 |
| 🟢 P3 | FEAT-7 | Agent 모달 확장 | 기능 추가 |
| 🟢 P3 | FEAT-8 | +Skill 버튼 | 기능 추가 |

---

## 1. [BUG-1] Team Rebuild 시 기존 팀이 삭제되지 않음

### 증상
"Rebuild" 버튼 클릭 후 팀을 생성하면 기존 Agent들이 그대로 남아 있고 새 Agent가 추가됨.

### 원인 분석

**파일**: `webview-ui/src/panels/AgentPreviewModal.tsx`

```tsx
// 현재 코드 — overwriteExisting 기본값이 false
const [overwriteExisting, setOverwriteExisting] = useState(false);
```

`AgentPreviewModal`에서 "Apply" 시 `overwriteExisting: false`로 요청이 전달됨.
Extension 측에서 이 플래그가 `false`이면 기존 Agent를 삭제하지 않고 병합만 수행.

**파일**: `webview-ui/src/App.tsx`

```tsx
// buildPromptIncludeExistingAgents 기본값이 true
const [buildPromptIncludeExistingAgents, setBuildPromptIncludeExistingAgents] = useState(true);
```

Rebuild 시나리오(hasTeam=true)에서도 동일 초기값을 사용.

### 수정 방향

| 위치 | 변경 내용 |
|------|-----------|
| `AgentPreviewModal.tsx` | `hasTeam` prop 추가, Rebuild 모드이면 `overwriteExisting` 기본값 `true`로 설정 |
| `App.tsx` | `forceBuildPrompt` + `hasTeam=true` 상태일 때 `overwriteExisting=true`를 `AgentPreviewModal`에 전달 |
| `BuildPromptBar.tsx` (compact Rebuild 버튼) | Rebuild 클릭 시 "기존 에이전트 덮어쓰기" 여부를 확인하는 confirm 다이얼로그 추가 (선택사항) |

**구현 핵심**: `AgentPreviewModal`에 `rebuildMode?: boolean` prop 추가 → `rebuildMode=true`이면 `overwriteExisting` 체크박스를 기본 체크 상태로 열기.

---

## 2. [BUG-2] Chat Send 시 패널 초기화 + 메시지 미표시

### 증상
- Chat에서 메시지를 보내면 오른쪽 패널이 Team 라이브러리 뷰에서 Chat 뷰로 전환됨 → 팀 목록이 사라진 것처럼 보임
- 전송한 메시지가 채팅창에 나타나지 않음
- 아무런 응답도 없음

### 원인 분석

**파일**: `webview-ui/src/App.tsx`

```tsx
const sendChatMessage = async (content: string) => {
  const trimmed = content.trim();
  if (!trimmed) return;

  setChatSending(true);
  try {
    await requestToExtension({
      type: "CHAT_SEND",
      payload: { content: trimmed, mode: chatMode, backendId: chatBackendId, modelId: ... }
    });
    setPanelMode("chat");   // ← 패널 모드 전환으로 라이브러리가 사라짐
    setPanelOpen(true);
  } finally {
    setChatSending(false);
  }
};
```

**문제 1 — 유저 메시지 로컬 미등록**
`requestToExtension` 전에 `appendLocalChatMessage(createLocalChatMessage("user", [...]))` 호출이 없음.
Extension이 `CHAT_MESSAGE` 이벤트를 돌려줄 때까지 메시지가 UI에 표시되지 않음.
Extension 응답이 없거나 느리면 영구적으로 빈 화면.

**문제 2 — 패널 모드 전환**
`setPanelMode("chat")` 호출이 RightPanel을 library 모드에서 chat 모드로 전환함.
RightPanel의 `normalizedMode` 로직:

```tsx
// panels/RightPanel.tsx
const normalizedMode: "library" | "chat" = props.mode === "library" ? "library" : "chat";
```

즉, library 외에 모든 mode는 chat으로 취급되어 라이브러리(Agent 목록)가 숨겨짐.
사용자는 팀이 사라진 것으로 인식.

**문제 3 — Extension CHAT_SEND 처리 미확인**
`extension/src/services/chatOrchestrator.ts`에서 CHAT_SEND 처리가 실제로 동작하는지 확인 필요.

### 수정 방향

| 위치 | 변경 내용 |
|------|-----------|
| `App.tsx` `sendChatMessage` | `requestToExtension` 호출 **전**에 `appendLocalChatMessage(createLocalChatMessage("user", [{ kind: "text", text: trimmed }]))` 추가 |
| `App.tsx` `sendChatMessage` | `setPanelMode("chat")` 제거 또는 조건부 — 이미 chat 모드일 때만 전환, 아니면 chat을 overlay 방식으로 변경 |
| `RightPanel.tsx` | "chat" 탭과 "library" 탭을 동시에 볼 수 있는 분할 뷰 또는 탭 UI 고려 |
| `extension/src/services/chatOrchestrator.ts` | CHAT_SEND 처리 로직 및 응답 CHAT_MESSAGE 발행 여부 재확인 |

---

## 3. [BUG-3] 팀 Confirm 시 사용량/잔여량이 전부 0

### 증상
`AgentPreviewModal`의 "Backend usage snapshot" 섹션이 모두 0 표시.

### 원인 분석

**파일**: `extension/src/services/backendUsageTracker.ts`

```ts
const EMPTY_PERIOD: BackendUsagePeriod = {
  callCount: 0, totalTokens: 0, estimatedCost: 0, ...
};
```

초기 실행 또는 아직 API 호출이 없었던 경우 당연히 0.
→ **CLI-3**에서 3-Backend 쿼터 폴러로 근본 해결.

### 수정 방향

**핵심 목적**: 쿼터 %를 알아야 멀티 백엔드 간 작업 배분이 가능함.

**① 구독 쿼터 % — PTY 자동화 조회** → CLI-3 참고

**② 개별 호출 토큰/비용 — stream-json 파싱** → CLI-1 참고

| 위치 | 변경 내용 |
|------|-----------|
| `AgentPreviewModal.tsx` | `backendUsageAtBuild`가 0이면 "호출 이력 없음 (첫 실행)" 표시, 퍼센트 대신 `-` 표기 |
| `BuildPromptBar` 사용량 섹션 | 0인 경우 "첫 실행 후 자동 집계됩니다" 안내 |

---

## 4. [BUG-4] Orchestration 백엔드가 Chat에 반영되지 않음

### 증상
팀 Orchestrator가 Codex로 설정되어 있어도 Chat은 기본값인 Claude를 사용.

### 원인 분석

**파일**: `webview-ui/src/App.tsx`

```tsx
// chatBackendId 초기값이 하드코딩
const [chatBackendId, setChatBackendId] = useState<Exclude<CliBackend["id"], "auto">>("claude");
```

Orchestrator의 `runtime.backendId`를 읽어서 동기화하는 로직이 없음.

### 수정 방향

**파일**: `App.tsx`

```tsx
const orchestratorAgent = useMemo(
  () => snapshot?.agents?.find((a) => a.isOrchestrator),
  [snapshot?.agents]
);

useEffect(() => {
  if (!orchestratorAgent?.runtime) return;
  if (orchestratorAgent.runtime.kind !== "cli") return;
  const backendId = orchestratorAgent.runtime.backendId;
  if (backendId && backendId !== "auto") {
    setChatBackendId(backendId as Exclude<CliBackend["id"], "auto">);
  }
}, [orchestratorAgent]);
```

| 위치 | 변경 내용 |
|------|-----------|
| `App.tsx` | orchestrator agent의 runtime.backendId를 읽어 `chatBackendId`를 동기화 |
| `ChatInput.tsx` | orchestrator가 고정된 경우 backend select를 `disabled` + 안내 문구 표시 |
| `ChatPanel.tsx` | "Orchestrator: Claude Code" 등 현재 사용 중인 백엔드 표시 레이블 추가 |

---

## 5. [FEAT-5] 최신 모델 목록 반영 + 드롭다운 전환

### CLI별 현재 지원 모델 (조사 결과)

#### Claude Code CLI — alias 지원
| 별칭 | 전체 모델명 | 티어 |
|------|------------|------|
| `haiku` | `claude-haiku-4-5-20251001` | Fast |
| `sonnet` | `claude-sonnet-4-5-20250929` | Standard |
| `opus` | `claude-opus-4-5-20251101` | Advanced |

#### Codex CLI (OpenAI)
| 모델명 | 설명 |
|--------|------|
| `gpt-5.3-codex` | 최신 (v0.104.0 실측) |
| `gpt-4.1`, `gpt-4.1-mini`, `gpt-4.1-nano` | GPT-4.1 계열 |
| `gpt-4o`, `gpt-4o-mini` | 멀티모달 |
| `o3`, `o3-mini`, `o4-mini` | 추론 모델 |
| `codex-1` | 코드 특화 (1M 컨텍스트) |

#### Gemini CLI — alias 지원
| alias | 설명 |
|-------|------|
| `auto` | 자동 선택 (기본) |
| `pro` | Gemini Pro 계열 |
| `flash` | Gemini Flash 계열 |
| `flash-lite` | 경량 |

### 수정 방향

| 위치 | 변경 내용 |
|------|-----------|
| `extension/src/services/backendProfiles.ts` | 각 backend `models[]` 최신 ID로 업데이트 |
| `ChatInput.tsx` | model `<input>` → `<select>` 전환 |
| `AgentPreviewModal.tsx` | model input → select 전환 |
| `AgentCreationModal.tsx` | model input → select 전환 |
| `webview-ui/src/utils/modelOptions.ts` | 신규: backend별 모델 배열 중앙 관리 |

> **CLI-4**에서 PTY 기반 동적 조회로 확장 예정. 이 항목은 정적 fallback.

---

## 6. [FEAT-6] 채팅 UI를 터미널 인터랙션 방식으로 개선

### 목표
터미널(CLI)과 동일한 느낌:
- 사용자 입력: `❯ your message here`
- 오케스트레이터 응답: 즉시 이어서 출력
- 명령 실행 로그: `[claude-code] Running task...`
- 스트리밍 청크: 타이핑 효과 (`▌` 블링크)

### 수정 방향

**파일**: `webview-ui/src/panels/ChatMessageList.tsx`

```tsx
// 변경 후: 터미널 라인 형태
<div className={`term-line term-${message.role}`}>
  <span className="term-prefix">
    {message.role === "user" ? "❯" : message.role === "system" ? "●" : "◆"}
  </span>
  <pre className="term-body">...</pre>
</div>
```

```css
.chat-messages { font-family: "JetBrains Mono", monospace; font-size: 13px; }
.term-line { display: flex; gap: 8px; margin-bottom: 4px; line-height: 1.5; }
.term-prefix { color: var(--accent); flex-shrink: 0; }
.term-line.term-user .term-prefix { color: #7ec8e3; }
.term-line.term-orchestrator .term-prefix { color: #a8e6cf; }
```

---

## 7. [FEAT-7] Agent 추가 모달에 Backend / Model 선택 추가

### 수정 방향

**`AgentCreationModal.tsx`에 추가할 필드**:

```tsx
const [backendId, setBackendId] = useState<CanonicalBackendId>("claude");
const [modelId, setModelId] = useState("");

<select value={backendId} onChange={(e) => { setBackendId(e.target.value); setModelId(""); }}>
  <option value="claude">Claude Code</option>
  <option value="codex">Codex CLI</option>
  <option value="gemini">Gemini CLI</option>
</select>

<select value={modelId} onChange={(e) => setModelId(e.target.value)}>
  {MODEL_OPTIONS[backendId].map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
</select>
```

| 위치 | 변경 내용 |
|------|-----------|
| `AgentCreationModal.tsx` | backendId, modelId 필드 추가 |
| `App.tsx` `handleCreateAgent` | backendId/modelId → `AgentProfile.runtime` 및 `preferredModel` 매핑 |

---

## 8. [FEAT-8] TeamPanel에 +Skill 버튼, RightPanel의 New Skill 섹션 제거

### 수정 방향

**`TeamPanel.tsx`**:

```tsx
<div className="team-panel-inline-actions">
  <button type="button" onClick={props.onCreateAgent}>+ Agent</button>
  <button type="button" onClick={props.onCreateSkill}>+ Skill</button>  {/* 추가 */}
  <button type="button" onClick={props.onRebuildTeam}>Rebuild</button>
</div>
```

**`RightPanel.tsx`**: `"newSkill"` LibrarySectionKey 및 관련 UI 블록 삭제

---

## 9. [LAYOUT-1] Build Prompt Bar가 Zoom 버튼을 가림

### 수정 방향

**옵션 A — canvas-controls를 위로 이동** (권장):

```css
.canvas-controls {
  bottom: 80px;   /* 32px (bar 높이) + 여유 */
  z-index: 15;    /* bar보다 높게 */
}
```

**옵션 C — canvas-controls를 우측 수직 배치**:

```css
.canvas-controls {
  right: 14px; top: 50%;
  transform: translateY(-50%);
  flex-direction: column; bottom: auto;
}
```

---

## 10. [LAYOUT-2] 팀 생성 후 노드 배치가 정리되지 않음

### 수정 방향

**방법 A — Apply 후 자동 tidyLayout 실행** (권장):

```tsx
// App.tsx
const handleApplyGenerated = async (...) => {
  await requestToExtension({ type: "APPLY_GENERATED_STRUCTURE", ... });
  setAutoLayoutSignal((prev) => prev + 1);
};

// GraphView.tsx
useEffect(() => {
  if (!autoLayoutSignal) return;
  const nextNodes = applyTidyLayout(nodes, edges);
  setNodes(nextNodes);
  nextNodes.forEach((node) => onSaveNodePosition(node.id, node.position));
}, [autoLayoutSignal]);
```

---

---

# 신규 CLI 통합 항목

---

## 11. [CLI-1] 3-Backend cliExecutor 통합 — spawn() + stream-json

**출처**: `old/CLAUDE_CLI_APPLY_SPEC.md §1`, `old/CODEX_CLI_APPLY_SPEC.md §1`, `old/GEMINI_CLI_APPLY_SPEC.md §1`

### 배경

BUG-2/BUG-3의 근본 원인: `cliExecutor.ts`가 `exec()`(전체 stdout 수집)를 사용.
→ 스트리밍 불가 / 토큰 파싱 불가 / 3 CLI 모두 미지원.

### 3 CLI별 비인터랙티브 실행 명령

```bash
# Claude Code
claude -p "..." --output-format stream-json --include-partial-messages --model sonnet

# Codex
codex exec --json "..."
codex exec -o result.txt "..."   # 결과 파일 저장

# Gemini
gemini --output-format stream-json --model flash "..."
cat input.txt | gemini "..."     # 파이프 입력
```

### 구현 방향

**파일**: `extension/src/services/cliExecutor.ts`

```ts
// 공통 spawn 패턴 (3 CLI 모두 동일 구조)
function spawnBackend(backend: BackendId, args: string[]): ChildProcess {
  const cmd = { claude: "claude", codex: "codex", gemini: "gemini" }[backend];
  return spawn(cmd, args, { env: process.env });
}

// stream-json 파싱 (Claude / Gemini 공통)
proc.stdout.on("data", (chunk) => {
  for (const line of chunk.toString().split("\n").filter(Boolean)) {
    try {
      const msg = JSON.parse(line);
      if (msg.type === "assistant") {
        panel.webview.postMessage({ type: "CHAT_STREAM_CHUNK", payload: msg });
      }
      if (msg.type === "result") {
        backendUsageTracker.recordCall(backendId, {
          inputTokens: msg.usage?.input_tokens ?? 0,
          outputTokens: msg.usage?.output_tokens ?? 0,
          cost: msg.cost_usd ?? 0,
        });
      }
    } catch { /* 비-JSON 무시 */ }
  }
});

// Codex JSONL 파싱 (형식이 다를 경우 분기)
// codex exec --json → 이벤트 타입 확인 후 동일 패턴 적용
```

### 신규/수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `extension/src/services/cliExecutor.ts` | `exec()` → `spawn()` 전환 + 3 CLI 분기 |
| `webview-ui/src/messaging/protocol.ts` | `CHAT_STREAM_CHUNK` 메시지 타입 확인/추가 |

---

## 12. [CLI-2] 3-Backend 권한 정책 통합 — 권한 모드 UI 슬라이더

**출처**: `old/CLAUDE_CLI_APPLY_SPEC.md §5`, `old/CODEX_CLI_APPLY_SPEC.md §2`, `old/GEMINI_CLI_APPLY_SPEC.md §12`

### 3 CLI 권한 플래그 매핑

| 수준 | Claude Code | Codex | Gemini |
|------|------------|-------|--------|
| 안전 (기본) | `--permission-mode default` | `--ask-for-approval on-request` | `--approval-mode default` |
| 편집 자동 승인 | `--permission-mode acceptEdits` | `--ask-for-approval never` | `--approval-mode auto_edit` |
| 완전 자동 | `--dangerously-skip-permissions` | `--full-auto` / `--yolo` | `--approval-mode yolo` |
| 샌드박스 격리 | 없음 | `--sandbox workspace-write` | `--sandbox` (Docker) |

### 구현 방향

**파일**: `extension/src/types/agentProfile.ts`

```ts
export type UnifiedPermissionLevel = "safe" | "auto-edit" | "full-auto";

function toClaudePermissionFlag(level: UnifiedPermissionLevel): string[] {
  const map = {
    "safe": ["--permission-mode", "default"],
    "auto-edit": ["--permission-mode", "acceptEdits"],
    "full-auto": ["--dangerously-skip-permissions"],
  };
  return map[level];
}

function toCodexPermissionFlag(level: UnifiedPermissionLevel): string[] {
  const map = {
    "safe": ["--ask-for-approval", "on-request"],
    "auto-edit": ["--ask-for-approval", "never"],
    "full-auto": ["--full-auto"],
  };
  return map[level];
}

function toGeminiPermissionFlag(level: UnifiedPermissionLevel): string[] {
  const map = {
    "safe": ["--approval-mode", "default"],
    "auto-edit": ["--approval-mode", "auto_edit"],
    "full-auto": ["--approval-mode", "yolo"],
  };
  return map[level];
}
```

**AgentCanvas UI**: Agent 카드 또는 팀 설정 패널에 `안전 ↔ 자동` 슬라이더 (3단계) 추가

---

## 13. [CLI-3] 3-Backend 쿼터 폴러 통합 — 자동 부하 분산

**출처**: `old/CLAUDE_CLI_APPLY_SPEC.md §11`, `old/CODEX_CLI_APPLY_SPEC.md §12`, `old/GEMINI_CLI_APPLY_SPEC.md §10`

### 각 CLI 쿼터 조회 방법 (실측)

| CLI | 조회 방법 | 출력 포맷 | PTY 필요 |
|-----|----------|----------|---------|
| Claude Code | `/status` → `→→` → Usage 탭 | `32% used` (세션/주간) | ✅ |
| Codex | `/status` 직접 | `97% left` (5h 롤링/주간, 티어별) + Session UUID | ✅ |
| Gemini | `/stats` | 미확인 — 실측 필요 | ✅ |

### claudeQuotaPoller.ts (PTY 구현)

```ts
const proc = pty.spawn("claude", [], { name: "xterm-color", cols: 120, rows: 30 });
// step 0: ">" 대기 → "/status\r"
// step 1: "Settings" 대기 → "\x1b[C\x1b[C" (→→)
// step 2: "Current session" 파싱
const sessionMatch = clean.match(/Current session\s+(\d+)%\s+used.*?Resets\s+([^\n]+)/);
```

### codexQuotaPoller.ts (PTY 구현, 실측 포맷)

```ts
// /status 실제 출력 파싱
const main5h = clean.match(/5h limit[^%]*(\d+)%\s+left.*?resets\s+([^)\n]+)/);
const sparkWeekly = [...clean.matchAll(/Weekly limit[^%]*(\d+)%\s+left/g)][1];
const sessionId = clean.match(/Session:\s+([\w-]{36})/)?.[1] ?? "";
const currentModel = clean.match(/Model:\s+([^\n(]+)/)?.[1]?.trim() ?? "";

export interface CodexQuotaSnapshot {
  main5hLeftPct: number; mainWeeklyLeftPct: number;
  spark5hLeftPct: number; sparkWeeklyLeftPct: number;
  sessionId: string; currentModel: string;
}
```

### geminiQuotaPoller.ts (⚠️ 실측 필요)

```ts
// /stats 출력 포맷 미확인 → 실측 후 정규식 보완
const proc = pty.spawn("gemini", [], { name: "xterm-color", cols: 120, rows: 30 });
// step 0: ">" 대기 → "/stats\r"
// step 1: 통계 출력 파싱 (실측 후 확정)
```

### backendAllocator.ts — 통합 분배 로직

```ts
interface BackendQuota {
  backendId: "claude" | "codex" | "gemini";
  remainingPct: number;   // 통일: 잔여 % (claude는 100-usedPct, codex/gemini는 leftPct)
}

const THRESHOLD = { light: 10, medium: 25, heavy: 40 };

export function selectBackend(
  quotas: BackendQuota[],
  taskWeight: "light" | "medium" | "heavy"
): string {
  const required = THRESHOLD[taskWeight];
  const available = quotas
    .filter((q) => q.remainingPct >= required)
    .sort((a, b) => b.remainingPct - a.remainingPct);
  return available[0]?.backendId ?? "codex";
}
```

### 신규 파일

| 파일 | 역할 |
|------|------|
| `extension/src/services/claudeQuotaPoller.ts` | Claude `/status` PTY 파싱 |
| `extension/src/services/codexQuotaPoller.ts` | Codex `/status` PTY 파싱 |
| `extension/src/services/geminiQuotaPoller.ts` | Gemini `/stats` PTY 파싱 (실측 후) |
| `extension/src/services/backendAllocator.ts` | 3-Backend 쿼터 → 최적 백엔드 선택 |
| `webview-ui/src/messaging/protocol.ts` | `BACKEND_QUOTA_UPDATE` 메시지 타입 |

> **⚠️ 다음 액션**: Gemini REPL에서 `/stats` 실행 → 출력 공유 → `geminiQuotaPoller.ts` 정규식 확정

---

## 14. [CLI-4] 동적 모델 목록 조회 — backendModelPoller.ts

**출처**: `old/CLAUDE_CLI_APPLY_SPEC.md §13`, `old/CODEX_CLI_APPLY_SPEC.md §4`, `old/GEMINI_CLI_APPLY_SPEC.md §11`

### 각 CLI 모델 조회 방식

| CLI | 방식 | PTY 필요 |
|-----|------|---------|
| Claude Code | `/model` TUI picker 파싱 | ✅ |
| Codex | `/model` TUI picker 파싱 | ✅ |
| Gemini | alias 정적 목록 (`auto/pro/flash/flash-lite`) + `/model` fallback | ❌ (기본) |

### 구현 방향

**파일**: `extension/src/services/backendModelPoller.ts` (신규)

```ts
export async function fetchModelsViaPty(backend: "claude" | "codex"): Promise<string[]> {
  const proc = pty.spawn(backend, [], { name: "xterm-color", cols: 120, rows: 30 });
  // step 0: ">" 대기 → "/model\r"
  // step 1: TUI picker 항목 파싱 → 모델 ID 목록 추출
  // step 2: ESC로 닫기 → 프로세스 종료
  return parsedModels;
}

// Gemini는 alias 정적 목록 (PTY 불필요)
export const GEMINI_MODEL_ALIASES = [
  { alias: "auto", label: "Auto (기본)" },
  { alias: "pro",  label: "Gemini Pro" },
  { alias: "flash", label: "Gemini Flash" },
  { alias: "flash-lite", label: "Flash Lite" },
];
```

**캐시**: 1시간 TTL, Extension 활성화 시 1회 실행 + 수동 갱신 버튼

---

## 15. [CLI-5] 프로젝트 컨텍스트 파일 3종 자동 생성

**출처**: `old/CLAUDE_CLI_APPLY_SPEC.md §8`, `old/CODEX_CLI_APPLY_SPEC.md §5`, `old/GEMINI_CLI_APPLY_SPEC.md §2`

### 개념

각 CLI가 세션 시작 시 자동으로 읽는 프로젝트 기억 파일 → 팀 Apply 시 3종 동시 생성.

| 파일 | CLI | 위치 |
|------|-----|------|
| `CLAUDE.md` | Claude Code | 프로젝트 루트 |
| `AGENTS.md` | Codex | 프로젝트 루트 |
| `GEMINI.md` | Gemini CLI | 프로젝트 루트 / `.gemini/` |

### 구현 방향

**파일**: `extension/src/services/projectContextWriter.ts` (신규)

```ts
export async function writeAllContextFiles(
  projectRoot: string,
  teamConfig: AgentTeamConfig
): Promise<void> {
  const content = buildContextContent(teamConfig);
  await Promise.all([
    fs.promises.writeFile(path.join(projectRoot, "CLAUDE.md"), content, "utf8"),
    fs.promises.writeFile(path.join(projectRoot, "AGENTS.md"), content, "utf8"),
    fs.promises.writeFile(path.join(projectRoot, "GEMINI.md"), content, "utf8"),
  ]);
}

function buildContextContent(teamConfig: AgentTeamConfig): string {
  return `# AgentCanvas 프로젝트 컨텍스트

## 팀 구성
${teamConfig.agents.map((a) => `- **${a.name}** (${a.role}): ${a.systemPrompt}`).join("\n")}

## 실행 정책
- 권한 모드: ${teamConfig.permissionLevel}
- 웹 검색: ${teamConfig.enableWebSearch ? "활성화" : "비활성화"}
`;
}
```

**트리거**: 팀 Apply(`APPLY_GENERATED_STRUCTURE`) 성공 후 자동 실행

---

## 16. [CLI-6] Gemini Plan Mode — Agent 분석 전용 실행 모드

**출처**: `old/GEMINI_CLI_APPLY_SPEC.md §3`

### 개념

Gemini CLI 전용 `/plan` 명령 — 파일 수정 없이 계획만 세우고 사용자 컨펌 대기.
Claude Code의 `--permission-mode plan`과 유사하나 REPL 명령으로 진입.

```bash
/plan "이 리포지토리의 인증 로직을 JWT로 바꿔줘"
# → Planning 단계: 파일 변경 없음, 계획 출력 → 사용자 컨펌 → 실행
```

### 구현 방향

**파일**: `extension/src/types/agentProfile.ts`

```ts
export interface AgentExecutionOptions {
  approvalMode: "default" | "auto_edit" | "yolo";
  sandbox: boolean;
  planOnly: boolean;      // ← 신규: Plan Mode (Gemini 전용)
  model: string;
  enableWebSearch: boolean;
}
```

**cliExecutor.ts** — Gemini Plan Mode 분기:

```ts
if (backend === "gemini" && opts.planOnly) {
  const proc = pty.spawn("gemini", [], { name: "xterm-color", cols: 120, rows: 30 });
  await waitFor(proc, ">");
  proc.write(`/plan "${prompt}"\r`);
  const plan = await collectUntil(proc, "Planning complete");
  panel.webview.postMessage({ type: "GEMINI_PLAN_RESULT", payload: { plan } });
  // 사용자 "실행" 클릭 시 실제 실행 분기로
}
```

**UI**: Agent 카드에 "📋 분석만" / "▶ 실행" 토글 버튼 추가 (Gemini backend 선택 시만 활성화)

---

## 17. [CLI-7] 예산/턴 제한 설정 UI

**출처**: `old/CLAUDE_CLI_APPLY_SPEC.md §2`

### 지원 플래그

```bash
# Claude Code
claude -p "..." --max-turns 10 --max-budget-usd 0.50

# Codex (동등 기능 — 확인 필요)
codex exec --max-tokens 4096 "..."

# Gemini (동등 기능 — 확인 필요)
gemini --max-turns 5 "..."
```

### 구현 방향

**파일**: `webview-ui/src/panels/AgentCreationModal.tsx` / `AgentPreviewModal.tsx`

```tsx
// 신규 필드
const [maxTurns, setMaxTurns] = useState<number | undefined>(undefined);
const [maxBudgetUsd, setMaxBudgetUsd] = useState<number | undefined>(undefined);

<input type="number" placeholder="최대 턴 수 (기본: 무제한)" value={maxTurns ?? ""}
  onChange={(e) => setMaxTurns(Number(e.target.value) || undefined)} />
<input type="number" step="0.01" placeholder="최대 비용 $USD (Claude Code)" value={maxBudgetUsd ?? ""}
  onChange={(e) => setMaxBudgetUsd(Number(e.target.value) || undefined)} />
```

**cliExecutor.ts**: 설정값 있을 때만 플래그 추가:

```ts
if (opts.maxTurns) args.push("--max-turns", String(opts.maxTurns));
if (opts.maxBudgetUsd && backend === "claude") args.push("--max-budget-usd", String(opts.maxBudgetUsd));
```

---

## 18. [CLI-8] 세션 재개 통합 — --resume / codex resume / gemini -r

**출처**: `old/CLAUDE_CLI_APPLY_SPEC.md §9`, `old/CODEX_CLI_APPLY_SPEC.md §6`, `old/GEMINI_CLI_APPLY_SPEC.md §6`

### 3 CLI 세션 재개 방법

```bash
# Claude Code
claude --resume <session-id>
claude --continue   # 최신 세션 자동 재개

# Codex (Session ID는 /status에서 자동 추출)
codex resume <SESSION_ID>

# Gemini
gemini -r "latest"
gemini -r "<session-id>"
```

### 구현 방향

**파일**: `extension/src/runtime/agentRuntime.ts`

```ts
interface AgentSessionState {
  claude?: { sessionId: string };
  codex?: { sessionId: string };    // /status UUID 자동 추출 (CLI-3)
  gemini?: { sessionId: string; chatTag?: string };
}

export function buildResumeArgs(backend: BackendId, state: AgentSessionState): string[] {
  switch (backend) {
    case "claude": return state.claude?.sessionId
      ? ["--resume", state.claude.sessionId]
      : ["--continue"];
    case "codex":  return ["resume", state.codex?.sessionId ?? ""];
    case "gemini": return ["-r", state.gemini?.sessionId ?? "latest"];
  }
}
```

**UI**: Agent 카드에 "🔄 이전 세션 이어서" 버튼 추가 (세션 ID 있을 때만 활성)

---

## 19. [CLI-9] Google Search + Web Fetch — enableWebSearch 에이전트 플래그

**출처**: `old/GEMINI_CLI_APPLY_SPEC.md §7`, `old/CODEX_CLI_APPLY_SPEC.md §9`

### CLI별 웹 검색 지원

| CLI | 방법 | 특징 |
|-----|------|------|
| Claude Code | MCP 서버 필요 | 별도 설정 |
| Codex | `--search` 플래그 | 명시적 활성화 |
| Gemini | `google_web_search` 내장 | 기본 활성화 |

### 구현 방향

**파일**: `extension/src/types/agentProfile.ts`

```ts
export interface AgentProfile {
  enableWebSearch: boolean;
  webSearchDomainAllowlist?: string[];
}
```

**cliExecutor.ts**:

```ts
// Codex
if (opts.enableWebSearch && backend === "codex") args.push("--search");

// Gemini: 기본 활성화 상태, 비활성화 시 settings.json tool 필터링 필요
// Claude: enableWebSearch=true이면 MCP web-search 서버 자동 주입
```

**UI**: Agent 카드에 🌐 웹 검색 토글 버튼

---

## 20. [CLI-10] Hooks 자동 생성 — Claude PreToolUse / Gemini BeforeTool

**출처**: `old/CLAUDE_CLI_APPLY_SPEC.md §6`, `old/GEMINI_CLI_APPLY_SPEC.md §9`

### 각 CLI Hooks 설정

```json
// Claude Code: .claude/settings.json
{
  "hooks": {
    "PreToolUse": [{ "matcher": ".*", "hooks": [{ "type": "command", "command": ".claude/hooks/pre.sh" }] }],
    "PostToolUse": [{ "matcher": ".*", "hooks": [{ "type": "command", "command": ".claude/hooks/post.sh" }] }]
  }
}

// Gemini: .gemini/settings.json
{
  "hooks": {
    "BeforeTool": [{ "matcher": "write_file|replace", "hooks": [{ "name": "pre-check", "type": "command", "command": "$GEMINI_PROJECT_DIR/.gemini/hooks/pre.sh", "timeout": 5000 }] }],
    "AfterTool": [{ "matcher": "*", "hooks": [{ "name": "logger", "type": "command", "command": "$GEMINI_PROJECT_DIR/.gemini/hooks/log.sh" }] }]
  }
}
```

### 구현 방향

**파일**: `extension/src/services/hooksGenerator.ts` (신규)

```ts
export async function writeClaudeHooks(projectRoot: string, policy: WorkerPolicy): Promise<void> {
  const settingsPath = path.join(projectRoot, ".claude", "settings.json");
  // PreToolUse / PostToolUse 블록 생성 후 파일 쓰기
}

export async function writeGeminiHooks(projectRoot: string, policy: WorkerPolicy): Promise<void> {
  const settingsPath = path.join(projectRoot, ".gemini", "settings.json");
  // BeforeTool / AfterTool 블록 생성 후 파일 쓰기
}
```

---

## 21. [CLI-11] Agent Skills 3-Backend 내보내기 — SKILL.md 포맷 통합

**출처**: `old/CLAUDE_CLI_APPLY_SPEC.md §7`, `old/GEMINI_CLI_APPLY_SPEC.md §5`

### 각 CLI Skill 위치

| CLI | 위치 | 파일 |
|-----|------|------|
| Claude Code | `.claude/skills/<name>/` | `SKILL.md` |
| Gemini | `.gemini/skills/<name>/` | `SKILL.md` (YAML frontmatter 필수) |
| Codex | `/skills` TUI | 구조 미확인 |

### 구현 방향

**파일**: `extension/src/services/skillExporter.ts` (신규)

```ts
export async function exportSkill(
  skill: AgentCanvasSkill,
  targets: ("claude" | "gemini")[],
  projectRoot: string
): Promise<void> {
  for (const target of targets) {
    const dir = target === "claude"
      ? path.join(projectRoot, ".claude", "skills", skill.name)
      : path.join(projectRoot, ".gemini", "skills", skill.name);

    await fs.promises.mkdir(path.join(dir, "scripts"), { recursive: true });

    const frontmatter = target === "gemini"
      ? `---\nname: ${skill.name}\ndescription: |\n  ${skill.description}\n---\n\n`
      : "";

    await fs.promises.writeFile(
      path.join(dir, "SKILL.md"),
      `${frontmatter}# ${skill.name}\n\n${skill.instructions}`,
      "utf8"
    );
  }
}
```

---

## 22. [CLI-12] Docker Sandbox 격리 — Gemini + Codex --sandbox 통합 UI

**출처**: `old/GEMINI_CLI_APPLY_SPEC.md §4`, `old/CODEX_CLI_APPLY_SPEC.md §2`

### 각 CLI Sandbox 방식

| CLI | 격리 기술 | 플래그 | 전제 조건 |
|-----|----------|--------|---------|
| Codex | OS-level sandbox | `--sandbox workspace-write` | 없음 |
| Gemini | Docker 컨테이너 | `--sandbox` | Docker 설치 필요 |

### 구현 방향

**Docker 사전 체크**:

```ts
async function checkDockerAvailable(): Promise<boolean> {
  try { await execAsync("docker info --format '{{.ServerVersion}}'"); return true; }
  catch { return false; }
}

if (opts.sandbox && backend === "gemini" && !(await checkDockerAvailable())) {
  vscode.window.showWarningMessage(
    "Gemini sandbox는 Docker가 필요합니다. Docker 설치 후 다시 시도하세요."
  );
  return;
}
```

**cliExecutor.ts**:

```ts
// Gemini
if (opts.sandbox && backend === "gemini") args.push("--sandbox");

// Codex
if (opts.sandbox && backend === "codex") args.push("--sandbox", "workspace-write");
```

**UI**: Agent 권한 패널에 🔒 Sandbox 토글 + backend별 격리 방식 설명 툴팁

---

## 파일별 변경 요약 (전체)

| 파일 | 변경 사항 | 관련 이슈 |
|------|-----------|-----------|
| `webview-ui/src/App.tsx` | sendChatMessage 로컬 메시지 / orchestrator 동기화 / autoLayoutSignal / TeamPanel onCreateSkill | BUG-2, BUG-4, LAYOUT-2, FEAT-8 |
| `webview-ui/src/panels/AgentCreationModal.tsx` | backendId/modelId/maxTurns/maxBudget 필드 추가 | FEAT-7, CLI-7 |
| `webview-ui/src/panels/AgentPreviewModal.tsx` | rebuildMode / model select / 쿼터 Progress Bar | BUG-1, BUG-3, FEAT-5 |
| `webview-ui/src/panels/ChatInput.tsx` | model select / orchestrator disabled | BUG-4, FEAT-5 |
| `webview-ui/src/panels/ChatMessageList.tsx` | 터미널 스타일 렌더링 | FEAT-6 |
| `webview-ui/src/panels/TeamPanel.tsx` | +Skill 버튼 / onCreateSkill prop | FEAT-8 |
| `webview-ui/src/panels/RightPanel.tsx` | New Skill 섹션 제거 | FEAT-8 |
| `webview-ui/src/canvas/GraphView.tsx` | autoLayoutSignal / canvas-controls 위치 | LAYOUT-1, LAYOUT-2 |
| `webview-ui/src/styles.css` | canvas-controls bottom / 터미널 CSS | LAYOUT-1, FEAT-6 |
| `webview-ui/src/utils/modelOptions.ts` | **신규**: backend별 모델 목록 상수 | FEAT-5 |
| `webview-ui/src/messaging/protocol.ts` | CHAT_STREAM_CHUNK / BACKEND_QUOTA_UPDATE / GEMINI_PLAN_RESULT | CLI-1, CLI-3, CLI-6 |
| `extension/src/services/cliExecutor.ts` | exec()→spawn() / 3 CLI 분기 / stream-json / sandbox / approval-mode | BUG-2, CLI-1, CLI-2, CLI-12 |
| `extension/src/services/backendProfiles.ts` | 모델 ID 최신화 | FEAT-5 |
| `extension/src/services/chatOrchestrator.ts` | CHAT_SEND 처리 확인 | BUG-2 |
| `extension/src/services/claudeQuotaPoller.ts` | **신규**: Claude /status PTY 파싱 | BUG-3, CLI-3 |
| `extension/src/services/codexQuotaPoller.ts` | **신규**: Codex /status PTY 파싱 (% left, Session UUID) | BUG-3, CLI-3 |
| `extension/src/services/geminiQuotaPoller.ts` | **신규**: Gemini /stats PTY 파싱 (실측 후 완성) | CLI-3 |
| `extension/src/services/backendAllocator.ts` | **신규**: 3-Backend 쿼터 → 최적 백엔드 선택 | CLI-3 |
| `extension/src/services/backendModelPoller.ts` | **신규**: PTY 기반 /model 목록 조회 | CLI-4 |
| `extension/src/services/projectContextWriter.ts` | **신규**: CLAUDE.md + AGENTS.md + GEMINI.md 동시 생성 | CLI-5 |
| `extension/src/services/hooksGenerator.ts` | **신규**: Claude/Gemini hooks 설정 파일 자동 생성 | CLI-10 |
| `extension/src/services/skillExporter.ts` | **신규**: AgentCanvas Skill → SKILL.md (claude/gemini) 변환 | CLI-11 |
| `extension/src/services/geminiSettingsWriter.ts` | **신규**: .gemini/settings.json (MCP + Hooks + approval) | CLI-2, CLI-10 |
| `extension/src/runtime/agentRuntime.ts` | AgentSessionState 3-Backend / buildResumeArgs | CLI-8 |
| `extension/src/types/agentProfile.ts` | UnifiedPermissionLevel / planOnly / enableWebSearch / maxTurns | CLI-2, CLI-6, CLI-9 |
| `extension/src/config/geminiModels.ts` | **신규**: Gemini alias 정적 목록 | CLI-4 |
