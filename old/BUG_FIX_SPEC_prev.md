# AgentCanvas — Bug Fix & Feature Spec

> 작성일: 2026-02-20
> 대상 디렉토리: `webview-ui/src/` + `extension/src/`
> 개발 진행 전 확인용 문서

---

## 목차

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

### CLI 도구별 사용량 확인 방법 조사

#### Claude Code CLI (`claude`)

```
버전: 2.1.34 (Claude Code)
--max-budget-usd <amount>  : 세션 최대 비용 제한 (출력 전용)
--model <model>            : 모델 지정
```

**실측 확인 (2026-02-20)**: REPL에서 `/status` → `→→` (또는 Tab)으로 Usage 탭 진입 시:

```
Current session         32% used   (Resets 12:59am)
Current week (all)      50% used   (Resets Feb 23, 2:59pm)
Current week (Sonnet)    3% used   (Resets Feb 24, 11pm)
Extra usage             비활성
```

- `/status` Usage 탭 = **구독 쿼터 비율** (세션/주간 한도 대비 %)
- 외부에서 자동 조회 불가 — REPL 인터랙티브 TUI 전용
- **개별 호출 토큰/비용**은 `--output-format stream-json` 응답의 `result` 메시지에 포함됨
- `claude usage`, `claude balance` 등 독립 커맨드는 미지원

#### Codex CLI (`codex` / `@openai/codex`)

- 현재 VM에 설치되지 않음 (`which codex` 결과 없음)
- OpenAI 공식 Codex CLI: `codex exec -` 형태로 stdin 프롬프트 처리
- 사용량 조회: OpenAI API 자체에 `/v1/usage` 엔드포인트 있으나 CLI 레벨에서 미노출
- 토큰 정보는 API 응답 JSON `usage` 필드에서 파싱

#### Gemini CLI (`gemini`)

- 현재 VM에 설치되지 않음
- `gemini --version`으로 버전 확인 가능
- 토큰 정보는 API 응답의 `usageMetadata` 필드 파싱

### 원인 분석

**파일**: `extension/src/services/backendUsageTracker.ts`

```ts
// .agentcanvas/usage/{backendId}/{YYYY-MM-DD}.json 파일에 누적
// 해당 파일이 없으면 → callCount: 0, estimatedCost: 0
const EMPTY_PERIOD: BackendUsagePeriod = {
  callCount: 0, totalTokens: 0, estimatedCost: 0, ...
};
```

초기 실행 또는 아직 API 호출이 없었던 경우 당연히 0.
AgentPreviewModal의 `backendUsageAtBuild`는 팀 빌드 시점의 snapshot — 아직 실제 호출이 없으면 0.

### 수정 방향

**핵심 목적**: 쿼터 %를 알아야 멀티 백엔드 간 작업 배분이 가능함.
예) Claude 세션 90% 사용 → 남은 작업은 자동으로 Codex/Gemini로 전환.

사용량을 두 가지 계층으로 분리하여 처리:

---

**① 구독 쿼터 % (세션/주간 한도) — `node-pty` PTY 자동화로 조회**

`/status` → Usage 탭은 REPL TUI지만, `node-pty`로 PTY를 생성해 자동으로 명령/키 입력을 보내고 출력을 파싱하면 프로그래밍적으로 가져올 수 있음.

| 위치 | 변경 내용 |
|------|-----------|
| `extension/src/services/claudeQuotaPoller.ts` (신규) | `node-pty`로 `claude` 스폰 → `/status\r` 입력 → `→→` 입력 → ANSI 제거 후 `(\d+)% used` 정규식 파싱 |
| `extension/src/services/backendAllocator.ts` (신규) | 각 백엔드의 `remainingPct` 비교 → 작업 weight에 따라 최적 백엔드 선택 |
| `webview-ui/src/messaging/protocol.ts` | `BACKEND_QUOTA_UPDATE` 메시지 타입 추가 |
| `AgentPreviewModal.tsx` | 쿼터 Progress Bar 표시: 세션 잔여 %, 주간 잔여 %, 리셋 시각 |
| `BuildPromptBar` | 쿼터 요약 + 🔄 수동 갱신 버튼 |

**폴링 시점**: Extension 활성화 시 1회 + 팀 Confirm 모달 열릴 때 갱신 + 5분 캐시

**쿼터 < 25%이면**: ⚠️ 경고 + 대안 백엔드 자동 추천

---

**② 개별 호출 토큰/비용 — stream-json 파싱 (누적 집계)**

| 위치 | 변경 내용 |
|------|-----------|
| `extension/src/services/cliExecutor.ts` | `exec()` → `spawn()` 전환 후 `--output-format stream-json` 적용, `result` 메시지의 `cost_usd` + `usage.input_tokens` + `usage.output_tokens` 파싱 → `backendUsageTracker.recordCall()` |
| `AgentPreviewModal.tsx` | `backendUsageAtBuild`가 0이면 "호출 이력 없음 (첫 실행)" 표시, 퍼센트 대신 `-` 표기 |
| `BuildPromptBar` 사용량 섹션 | 0인 경우 "첫 실행 후 자동 집계됩니다" 안내 |

**전제 조건**: `cliExecutor.ts`가 `exec()`(전체 stdout 수집) 방식이면 스트리밍 파싱 불가.
`spawn()` 방식 전환이 BUG-2(메시지 미표시), BUG-3(사용량 0), FEAT-6(터미널 UI) 세 이슈의 공통 선행 조건.

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

**파일**: `webview-ui/src/messaging/protocol.ts`

```ts
export type AgentRuntime =
  | { kind: "cli"; backendId: CliBackendId; modelId?: string; ... }
  | { kind: "openclaw"; ... };

export type AgentProfile = {
  ...
  runtime?: AgentRuntime;
  ...
};
```

Orchestrator 에이전트의 `runtime.backendId`에 해당 정보가 존재.

### 수정 방향

**파일**: `App.tsx`

```tsx
// snapshot에서 orchestrator 탐지 → chatBackendId 동기화
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

#### Claude Code CLI

`--model <model>` — alias 또는 full name 지원

| 별칭 | 전체 모델명 | 티어 | 컨텍스트 |
|------|------------|------|---------|
| `haiku` | `claude-haiku-4-5-20251001` | Fast | 200K |
| `sonnet` | `claude-sonnet-4-5-20250929` | Standard | 200K |
| `opus` | `claude-opus-4-5-20251101` | Advanced | 200K |

> 출처: `claude --help` `--model` 설명 + Anthropic 공식 모델 ID
> `backendProfiles.ts` 현재 등록: `haiku-4.5`, `sonnet-4.5`, `opus-4.5` (full ID 아님)

#### Codex CLI (OpenAI)

`codex exec` — `--model` 플래그 지원 (OpenAI 공식 모델)

| 모델명 | 설명 |
|--------|------|
| `gpt-4.1` | 최신 GPT-4.1 (코딩 최적화) |
| `gpt-4.1-mini` | 경량 버전 |
| `gpt-4.1-nano` | 초경량 |
| `gpt-4o` | 멀티모달 |
| `gpt-4o-mini` | 경량 멀티모달 |
| `o3` | 추론 모델 |
| `o3-mini` | 추론 경량 |
| `o4-mini` | 최신 추론 경량 |
| `codex-1` | 코드 특화 (1M 컨텍스트) |

> `backendProfiles.ts` 현재 등록: `o3-mini`, `o3`, `codex-1` (gpt-4.1 계열 누락)

#### Gemini CLI (Google)

`gemini` — `--model` 플래그 지원

| 모델명 | 설명 |
|--------|------|
| `gemini-2.5-flash` | 빠름, 1M 컨텍스트 |
| `gemini-2.5-pro` | 고성능, 1M 컨텍스트 |
| `gemini-2.0-flash` | 이전 세대 빠름 |
| `gemini-1.5-pro` | 안정 버전 |

> `backendProfiles.ts` 현재 등록: `gemini-2.5-flash`, `gemini-2.5-pro` — 비교적 최신이나 하위 호환 모델 추가 필요

#### Aider

`aider --model <model>` — OpenAI / Anthropic 모델 모두 사용 가능 (설치된 API 키에 따라 다름)

### 현재 문제

**파일**: `webview-ui/src/panels/ChatInput.tsx`

```tsx
// 현재: 자유 입력 input
<input
  value={props.modelId ?? ""}
  onChange={(event) => props.onModelChange(event.target.value)}
  placeholder="model (optional)"
/>
```

**파일**: `webview-ui/src/panels/AgentPreviewModal.tsx`

```tsx
// 현재: 자유 입력 input
<input value={agent.assignedModel ?? ""} ... />
```

### 수정 방향

| 위치 | 변경 내용 |
|------|-----------|
| `extension/src/services/backendProfiles.ts` | 각 backend의 `models[]` 배열을 최신 모델 ID로 업데이트 |
| `ChatInput.tsx` | model `<input>` → `<select>` 전환, `backendId` prop에 따라 모델 옵션 동적 변경 |
| `AgentPreviewModal.tsx` | model input → select 전환 |
| `AgentCreationModal.tsx` | model input → select 전환 (Feature 7과 동일 작업) |

**모델 목록 상수 파일 생성 권장**:
`webview-ui/src/utils/modelOptions.ts` — backend별 모델 배열을 한 곳에서 관리

---

## 6. [FEAT-6] 채팅 UI를 터미널 인터랙션 방식으로 개선

### 현재 상태

**파일**: `webview-ui/src/panels/ChatMessageList.tsx`
현재: 버블 형태 (`chat-message user` / `chat-message orchestrator` CSS 클래스)

### 목표

터미널(CLI)과 동일한 느낌:
- 사용자 입력: `$ your message here`
- 오케스트레이터 응답: 즉시 이어서 출력
- 명령 실행 로그: `[claude-code] Running task...`
- 스트리밍 청크: 타이핑 효과

### 수정 방향

**파일**: `webview-ui/src/panels/ChatMessageList.tsx`

```tsx
// 변경 전: 버블 형태
<div className={`chat-message ${message.role}`}>
  <div className="chat-message-role">{message.role}</div>
  <div className="chat-message-body">...</div>
</div>

// 변경 후: 터미널 라인 형태
<div className={`term-line term-${message.role}`}>
  <span className="term-prefix">
    {message.role === "user" ? "❯" : message.role === "system" ? "●" : "◆"}
  </span>
  <pre className="term-body">...</pre>
</div>
```

**CSS 추가 (`styles.css`)**:

```css
.chat-messages {
  font-family: "JetBrains Mono", "Fira Code", "Courier New", monospace;
  font-size: 13px;
  background: var(--bg);
  padding: 12px 16px;
}
.term-line { display: flex; gap: 8px; margin-bottom: 4px; line-height: 1.5; }
.term-prefix { color: var(--accent); flex-shrink: 0; }
.term-line.term-user .term-prefix { color: #7ec8e3; }
.term-line.term-orchestrator .term-prefix { color: #a8e6cf; }
.term-line.term-system .term-prefix { color: #888; }
.term-body { margin: 0; white-space: pre-wrap; word-break: break-word; }
```

**ChatInput 변경**: placeholder를 `"❯ Message the orchestrator..."` 형태로 변경

**스트리밍 표시**: `CHAT_STREAM_CHUNK` 수신 중엔 커서 `▌` 블링크 효과

---

## 7. [FEAT-7] Agent 추가 모달에 Backend / Model 선택 추가

### 현재 상태

**파일**: `webview-ui/src/panels/AgentCreationModal.tsx`

현재 필드: Name, Role, Role label, Description, Is Orchestrator, System Prompt
→ `onCreate` payload에 backend / model 정보 없음

**파일**: `webview-ui/src/messaging/protocol.ts`

```ts
export type AgentProfile = {
  ...
  runtime?: AgentRuntime;       // ← backend 정보 여기 있음
  preferredModel?: string;      // ← model 정보 여기 있음
};
```

### 수정 방향

**`AgentCreationModal.tsx`에 추가할 필드**:

```tsx
// State 추가
const [backendId, setBackendId] = useState<CanonicalBackendId>("claude");
const [modelId, setModelId] = useState("");

// UI 추가 (Role 아래에)
<div className="inspector-field">
  <label>Backend (CLI)</label>
  <select value={backendId} onChange={(e) => { setBackendId(e.target.value); setModelId(""); }}>
    <option value="claude">Claude Code</option>
    <option value="codex">Codex CLI</option>
    <option value="gemini">Gemini CLI</option>
    <option value="aider">Aider</option>
    <option value="custom">Custom</option>
  </select>
</div>

<div className="inspector-field">
  <label>Model</label>
  <select value={modelId} onChange={(e) => setModelId(e.target.value)}>
    {MODEL_OPTIONS[backendId].map((m) => (
      <option key={m.id} value={m.id}>{m.label}</option>
    ))}
  </select>
</div>
```

**`onCreate` payload 확장**:

```tsx
await onCreate({
  name, role, roleLabel, description, systemPrompt, isOrchestrator,
  backendId,   // 추가
  modelId,     // 추가
});
```

**`App.tsx` `handleCreateAgent` 수정**: 받은 backendId/modelId를 `AgentProfile.runtime` 및 `preferredModel`에 매핑

---

## 8. [FEAT-8] TeamPanel에 +Skill 버튼, RightPanel의 New Skill 섹션 제거

### 현재 상태

**파일**: `webview-ui/src/panels/TeamPanel.tsx`

```tsx
<div className="team-panel-inline-actions">
  <button type="button" onClick={props.onCreateAgent}>+ Agent</button>
  <button type="button" onClick={props.onRebuildTeam}>Rebuild</button>
</div>
```

→ `+ Skill` 버튼 없음

**파일**: `webview-ui/src/panels/RightPanel.tsx`

```tsx
// 625~631 줄 — New Skill 섹션 존재
<button onClick={() => toggleLibrarySection("newSkill")} ...>
  <span className="library-title">New Skill</span>
  ...
</button>
{!collapsedSections.newSkill && (
  // New Skill 폼 렌더링
)}
```

### 수정 방향

**`TeamPanel.tsx`**:

```tsx
// onCreateSkill prop 추가
type TeamPanelProps = {
  ...
  onCreateSkill: () => void;   // 추가
};

// 버튼 추가
<div className="team-panel-inline-actions">
  <button type="button" onClick={props.onCreateAgent}>+ Agent</button>
  <button type="button" onClick={props.onCreateSkill}>+ Skill</button>   // 추가
  <button type="button" onClick={props.onRebuildTeam}>Rebuild</button>
</div>
```

**`App.tsx`**:
`TeamPanel`에 `onCreateSkill={() => setSkillWizardOpen(true)}` 연결

**`RightPanel.tsx`**:
- `"newSkill"` LibrarySectionKey 제거
- `collapsedSections.newSkill` 관련 UI 블록 삭제
- `skillName`, `skillDescription` state 및 관련 로직 정리
- `onCreateSkill` prop 제거 (또는 유지하되 TeamPanel에서만 호출)

---

## 9. [LAYOUT-1] Build Prompt Bar가 Zoom 버튼을 가림

### 현재 상태

**파일**: `webview-ui/src/styles.css`

```css
/* Build Prompt Bar — 팀이 있을 때 compact 모드 */
.build-prompt-bar {
  bottom: 32px;
  z-index: 12;
}

/* Canvas Controls (Zoom 버튼) */
.canvas-controls {
  bottom: 14px;
  z-index: 5;
}
```

Build prompt bar(`z-index: 12`)가 canvas controls(`z-index: 5`)보다 위에 위치하고 `bottom` 값도 겹쳐서 줌 버튼을 덮음.

**파일**: `webview-ui/src/canvas/GraphView.tsx`

```tsx
<div className="canvas-controls">
  <button>1</button>   {/* Fit */}
  <button>+</button>   {/* Zoom In */}
  <button>-</button>   {/* Zoom Out */}
  <button>0</button>   {/* Reset */}
  <button>Tidy</button>
  <button>Auto</button>
</div>
```

### 수정 방향

**옵션 A — canvas-controls를 위로 이동** (권장):

```css
.canvas-controls {
  bottom: 80px;   /* 32px (bar 높이) + 여유 */
  z-index: 15;    /* bar보다 높게 */
}
```

**옵션 B — build-prompt-bar를 하단이 아닌 다른 위치에 배치**:
- 중앙 하단 → 중앙 상단 또는 별도 floating 영역으로 이동
- 캔버스 하단이 아닌 헤더 아래 인라인 배치 고려

**옵션 C — canvas-controls를 canvas 우측에 수직 배치**:

```css
.canvas-controls {
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  flex-direction: column;
  bottom: auto;
}
```

---

## 10. [LAYOUT-2] 팀 생성 후 노드 배치가 정리되지 않음

### 증상
팀 Apply 직후 Agent 노드들이 캔버스에 겹치거나 임의 위치에 배치됨.

### 원인 분석

**파일**: `extension/src/services/agentStructureParser.ts`
팀 생성 시 각 Agent에 position 정보가 없거나 기본값(0, 0) 등이 들어감.

**파일**: `webview-ui/src/canvas/layout/tidyLayout.ts`

```ts
// tidyLayout 함수는 존재하지만 팀 Apply 직후 자동 호출되지 않음
export function applyTidyLayout(nodes: Node[], edges: Edge[]): Node[] { ... }
```

**파일**: `webview-ui/src/canvas/GraphView.tsx`

```tsx
const tidyLayout = useCallback(() => {
  // 사용자가 "Tidy" 버튼 클릭 시에만 실행
  const nextNodes = applyTidyLayout(nodes, edges);
  setNodes(nextNodes);
}, [nodes, edges]);
```

자동 실행 트리거가 없음.

### tidyLayout 배치 규칙 (`tidyLayout.ts`)

```
X.agent = 90       → Agent 노드
X.provider = 360   → Provider 노드
X.rule = 360       → Rule 노드
X.skill = 680      → Skill 노드
X.folder = 520     → Folder 노드
X.note = 980       → Note 노드

GAP.row = 24       → 같은 열 내 노드 간격
GAP.section = 46   → Agent 간 섹션 간격
```

### 수정 방향

**방법 A — Apply 후 자동 tidyLayout 실행** (권장):

`App.tsx`에서 `APPLY_GENERATED_STRUCTURE` 성공 후:

```tsx
const handleApplyGenerated = async (...) => {
  await requestToExtension({ type: "APPLY_GENERATED_STRUCTURE", ... });
  // 잠시 후 snapshot이 업데이트되면 GraphView에 tidy 트리거 전달
  setAutoLayoutSignal((prev) => prev + 1);
};
```

`GraphView.tsx`에 `autoLayoutSignal` prop 추가:

```tsx
useEffect(() => {
  if (!autoLayoutSignal) return;
  const nextNodes = applyTidyLayout(nodes, edges);
  setNodes(nextNodes);
  // 노드 위치 저장
  nextNodes.forEach((node) => onSaveNodePosition(node.id, node.position));
}, [autoLayoutSignal]);
```

**방법 B — Extension에서 position 계산 후 전달**:
`agentStructureParser.ts`에서 팀 구조 파싱 시 각 Agent에 tidyLayout 규칙에 맞는 초기 position 부여.

---

## 파일별 변경 요약

| 파일 | 변경 사항 | 관련 이슈 |
|------|-----------|-----------|
| `webview-ui/src/App.tsx` | - sendChatMessage에 로컬 메시지 추가<br>- orchestrator backendId 동기화<br>- autoLayoutSignal state 추가<br>- TeamPanel onCreateSkill 연결 | BUG-2, BUG-4, LAYOUT-2, FEAT-8 |
| `webview-ui/src/panels/AgentCreationModal.tsx` | - backendId, modelId 필드 추가<br>- onCreate payload 확장 | FEAT-7 |
| `webview-ui/src/panels/AgentPreviewModal.tsx` | - rebuildMode prop 추가<br>- overwriteExisting 기본값 조건부 변경<br>- model input → select 전환<br>- 쿼터 Progress Bar 표시 (세션/주간 잔여%) | BUG-1, BUG-3, FEAT-5 |
| `webview-ui/src/panels/ChatInput.tsx` | - model input → select 전환<br>- orchestrator 고정 시 backend disabled | BUG-4, FEAT-5 |
| `webview-ui/src/panels/ChatMessageList.tsx` | - 터미널 스타일 렌더링으로 교체 | FEAT-6 |
| `webview-ui/src/panels/ChatPanel.tsx` | - 현재 backend 레이블 표시 | BUG-4 |
| `webview-ui/src/panels/TeamPanel.tsx` | - onCreateSkill prop 추가<br>- + Skill 버튼 추가 | FEAT-8 |
| `webview-ui/src/panels/RightPanel.tsx` | - New Skill 섹션 제거 | FEAT-8 |
| `webview-ui/src/canvas/GraphView.tsx` | - autoLayoutSignal prop 처리<br>- canvas-controls 위치 조정 | LAYOUT-1, LAYOUT-2 |
| `webview-ui/src/styles.css` | - canvas-controls bottom 값 조정<br>- 터미널 스타일 CSS 추가 | LAYOUT-1, FEAT-6 |
| `webview-ui/src/utils/modelOptions.ts` | - 신규 파일: backend별 모델 목록 상수 | FEAT-5 |
| `extension/src/services/backendProfiles.ts` | - 각 backend 모델 ID 최신화 | FEAT-5 |
| `extension/src/services/agentStructureParser.ts` | - 생성 시 초기 position 부여 (선택) | LAYOUT-2 |
| `extension/src/services/chatOrchestrator.ts` | - CHAT_SEND 처리 및 CHAT_MESSAGE 응답 확인 | BUG-2 |
| `extension/src/services/cliExecutor.ts` | - exec() → spawn() 전환<br>- `--output-format stream-json` 적용<br>- result 메시지에서 cost_usd / usage 파싱 | BUG-2, BUG-3 |
| `extension/src/services/claudeQuotaPoller.ts` | - **신규**: node-pty로 `/status` Usage 탭 자동 파싱<br>- sessionUsedPct / weekAllUsedPct / weekSonnetUsedPct 반환 | BUG-3 |
| `extension/src/services/backendAllocator.ts` | - **신규**: 각 백엔드 잔여 쿼터 비교 → 작업 weight별 최적 백엔드 선택 | BUG-3 |
| `webview-ui/src/messaging/protocol.ts` | - BACKEND_QUOTA_UPDATE 메시지 타입 추가 | BUG-3 |
| `webview-ui/src/panels/BuildPromptBar.tsx` | - 쿼터 요약 표시 + 🔄 수동 갱신 버튼 | BUG-3 |

---

## 우선순위

| 우선순위 | 이슈 | 이유 |
|---------|------|------|
| 🔴 P0 | BUG-2 (Chat 미동작) | 핵심 기능 불가 — spawn() 전환이 선행 |
| 🔴 P0 | BUG-1 (Rebuild 미삭제) | 데이터 오염 |
| 🟠 P1 | BUG-3 (사용량 0 + 쿼터 조회) | 멀티 백엔드 부하 분산의 전제 조건 — 단순 표시 오류 아님 |
| 🟠 P1 | BUG-4 (Backend 미동기화) | 오작동 |
| 🟠 P1 | LAYOUT-1 (Zoom 가림) | UX 차단 |
| 🟡 P2 | LAYOUT-2 (생성 후 레이아웃) | UX |
| 🟢 P3 | FEAT-5 (최신 모델) | 기능 개선 |
| 🟢 P3 | FEAT-6 (터미널 UI) | UX 개선 |
| 🟢 P3 | FEAT-7 (Agent 모달 확장) | 기능 추가 |
| 🟢 P3 | FEAT-8 (+Skill 버튼) | 기능 추가 |
