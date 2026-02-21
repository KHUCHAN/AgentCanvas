# CODE_VERIFY.md — AgentCanvas 코드 검증 리포트

> 작성일: 2025-02
> 검증 범위: BUG_FIX_SPEC.md 요구사항 대비 현재 코드 상태, 신규 버그 2건 포함

---

## 요약 (TL;DR)

| ID | 파일 | 심각도 | 상태 | 설명 |
|----|------|--------|------|------|
| V-BUG-1 | BuildPromptBar.tsx | 🔴 HIGH | **미수정** | 컴팩트(메인) 화면에 progress/error 표시 없음 → Rebuild 실패가 무음으로 사라짐 |
| V-BUG-2 | claudeQuotaPoller.ts | 🔴 HIGH | **미수정** | `-p /status` = `/status`를 프롬프트로 전송 (REPL 명령 ≠ 헤드리스 프롬프트) |
| V-BUG-3 | cliExecutor.ts | 🔴 HIGH | **미수정** | `normalizeBaseArgs()` 에서 `--print`만 필터링, `-p` 미필터 → 중복 플래그 위험 |
| V-BUG-4 | App.tsx | 🟡 MED | **미수정** | `void buildTeamFromPromptBar()` → Promise reject가 무음으로 폐기 |
| V-BUG-5 | claudeQuotaPoller.ts | 🟡 MED | **미수정** | 쿼타 체크 시 Claude API 실제 호출 → 토큰 낭비 |
| V-INFO-1 | App.tsx | 🟡 MED | 설계 확인 | `hasTeamReady` 초기엔 false → canBuild=false → Rebuild 비활성화 |
| V-BUG-6 | modelRouter.ts + configService.ts | 🔴 HIGH | **미수정** | `resolveModel()` 항상 Claude 모델 ID 반환 → Codex/Gemini에 Claude 모델 전달 → CLI 오류 |
| V-BUG-7 | AgentCreationModal.tsx | 🟡 MED | **미수정** | Gemini 전용 UI 없음 (Claude/Codex 전용 필드만 존재, Gemini 옵션 누락) |
| V-SPEC-1 | (미구현) | 🔴 HIGH | **미구현** | BUG_FIX_SPEC CLI-1~12 전부 미구현 |
| V-SPEC-2 | (미구현) | 🟠 MED | **미구현** | BUG_FIX_SPEC BUG-1~LAYOUT-2 대부분 미구현 |

---

## 1. 버그 #1 — Rebuild 버튼 (메인 화면) 작동 안 함

### 증상
메인 화면(컴팩트 모드)에서 "Rebuild" 클릭 → 아무 반응 없음

### 근본 원인 체인

```
BuildPromptBar [compact] → triggerBuild() → props.onBuildTeam()
    ↓
App.tsx:2481: onBuildTeam={() => void buildTeamFromPromptBar()}
    ↓
buildTeamFromPromptBar():
  line 1033: if (!prompt || busy) return;   ← busy=true에 걸리면 조용히 종료
  await generateAgentStructure(...)
    ↓
generateAgentStructure():
  line 986: setBusy(true)
  line 988: requestToExtension({ type: "GENERATE_AGENT_STRUCTURE" }, 180_000)
    ↓
extension.ts:631: executeCliPrompt(...)   ← CLI 실패 시 에러 throw
    ↓
generateAgentStructure catch:
  showErrorToast(error) + throw
    ↓
buildTeamFromPromptBar에서 catch 없이 throw됨
    ↓
App.tsx:2481: void ...   ← Promise reject 폐기! 에러가 사라짐
```

### 핵심 코드 문제 2가지

**문제 A — 컴팩트 모드에 progress/error 표시 없음**

```tsx
// BuildPromptBar.tsx line 140–183 (compact mode)
if (compact) {
  return (
    <div className="build-prompt-bar">
      <input ... />
      <button onClick={triggerBuild}>Rebuild</button>
      {/* ❌ progress 표시가 전혀 없음! */}
    </div>
  );
}

// 확장 모드(line 369–382)에만 존재:
{props.progress && (
  <div className={`build-prompt-progress ...`}>
    {props.progress.message}  {/* 에러 메시지 여기에 표시 */}
  </div>
)}
```

**문제 B — void로 Promise reject 폐기**

```ts
// App.tsx line 2481
onBuildTeam={() => void buildTeamFromPromptBar()}
//                  ^^^^ Promise reject가 잡히지 않음
```

### 수정 방향

1. `BuildPromptBar.tsx` 컴팩트 모드에 에러 표시 추가:
   ```tsx
   {props.progress?.stage === "error" && (
     <span className="build-prompt-compact-error">{props.progress.message}</span>
   )}
   ```

2. `App.tsx` Promise 처리:
   ```ts
   onBuildTeam={() => {
     buildTeamFromPromptBar().catch((err) => {
       showErrorToast(err);
     });
   }}
   ```

---

## 2. 버그 #2 — 확장 화면 "--print 관련 에러" 출력

### 증상
확장(Expand) 화면에서 팀 생성 시 progress bar에 "--print..." 포함 에러 메시지 노출

### 근본 원인 A — `claudeQuotaPoller.ts` 잘못된 CLI 호출

```ts
// claudeQuotaPoller.ts line 44–54
async function runStatusProbe(command: string): Promise<string | undefined> {
  const { stdout, stderr } = await execFileAsync(
    command,
    ["-p", "/status", "--output-format", "json"],  // ← 문제!
    ...
  );
}
```

**의도**: Claude REPL의 `/status` 명령 실행
**실제**: Claude 헤드리스 모드로 "/status"라는 **텍스트 프롬프트** 전송

- Claude CLI에서 `-p` (= `--print`) 플래그는 **헤드리스 실행 모드**
- REPL 명령(`/status`, `/help` 등)은 **인터랙티브 PTY** 세션에서만 동작
- 결과: Claude가 "/status"에 대해 일반 대화 응답 → 쿼타 정규식 매칭 실패 → `undefined` 반환
- **추가 문제**: `--output-format json`은 전체 Claude API 추론을 실행 → **토큰 낭비**
- 이후 fallback으로 `--help` 실행 (line 63~73)

### 근본 원인 B — `normalizeBaseArgs()` `-p` 미필터

```ts
// cliExecutor.ts line 352–358
function normalizeBaseArgs(args: string[] | undefined, family: CliFamily): string[] {
  if (!args || args.length === 0) return [];
  if (family === "claude") {
    return args.filter((arg) => arg !== "--print");  // ← "--print"만 필터링!
    // ❌ "-p" (단축형)는 필터링 안 됨
  }
}
```

이후 같은 파일 line 240:
```ts
args.push("-p", prompt, "--output-format", "stream-json", "--include-partial-messages");
```

만약 사용자 backend 설정에 `-p`가 포함되어 있으면:
```
claude -p -p "actual_prompt" --output-format stream-json ...
        ^^^ 중복 플래그 → CLI 에러
```

에러 메시지 예: `error: the argument '-p <prompt>' cannot be used multiple times`
또는 일부 Claude CLI 버전: `did you mean --print?`

### "--print" 에러 에러가 표시되는 경로

```
executeCliPrompt → spawn(...) → process.stderr 수집
  → exit code != 0
  → result.error = stderr.trim() = "... --print ..."
  → extension.ts:639: throw new Error(result.error)
  → extension.ts:694: postGenerationProgress("error", detail)
  → webview: generationProgress.message = "--print ..."
  → 확장 화면 progress bar에 표시 ✓
  → 컴팩트 화면: progress 표시 없음 → 무음으로 실패 ✓
```

### 수정 방향

**A — quotaPoller 수정 (PTY 방식으로 교체)**
```ts
// claudeQuotaPoller.ts — 잘못된 방식
["-p", "/status", "--output-format", "json"]  // ← 삭제

// 올바른 방식: node-pty로 인터랙티브 세션 열기
// BUG_FIX_SPEC CLI-3 참조
import * as pty from "node-pty";
const term = pty.spawn(command, [], { name: "xterm-color", cwd: workspaceRoot });
term.write("/status\r");
// 출력 파싱 후 term.kill()
```

단기 임시 대안: `/status` 프롬프트 호출 제거, `--help` fallback만 유지

**B — normalizeBaseArgs 수정**
```ts
if (family === "claude") {
  return args.filter((arg) => arg !== "--print" && arg !== "-p");  // ← -p 추가
}
```

---

## 3. 기타 발견된 문제

### V-INFO-1 — hasTeamReady 초기 상태에서 Rebuild 비활성화

```ts
// App.tsx line 510–521
const hasTeamReady = useMemo(() => {
  const customAgents = snapshot?.agents.filter(...).length ?? 0;
  return (
    customAgents > 0 ||
    patternNodes.length > 0 ||
    runHistory.length > 0 ||
    promptHistory.some((item) => item.applied) ||
    (snapshot?.agents.length ?? 0) > 2
  );
}, [...]);

// App.tsx line 1023–1026
const canBuildTeamFromPrompt =
  hasTeamReady ||                           // false (초기)
  buildPromptText.trim().length > 0 ||      // false (빈 텍스트)
  latestPromptFromHistory.length > 0;       // false (히스토리 없음)
// → canBuildTeamFromPrompt = false → Rebuild 버튼 disabled
```

**설계 의도**: 아무 컨텍스트도 없을 때 빌드 방지
**문제**: 사용자가 텍스트를 입력하지 않으면 초기에 버튼이 비활성화되어 "고장난 것처럼" 보일 수 있음
**권장**: placeholder나 tooltip으로 "프롬프트를 입력하세요" 안내 추가

### V-INFO-2 — generateAgentStructure 내부 try/catch 구조는 정상

```ts
// App.tsx line 976–1011
const generateAgentStructure = async (...) => {
  setBusy(true);    // ← 항상 먼저 실행
  try {
    const result = await requestToExtension(...);
    ...
  } catch (error) {
    showErrorToast(error);
    throw error;    // ← 재throw
  } finally {
    setBusy(false); // ← 에러가 있어도 반드시 실행 ✓
  }
};
```

`finally`에서 `setBusy(false)` 처리는 정상 → `busy` stuck 문제는 없음
단, 상위 caller(`buildTeamFromPromptBar`)에서 `void`로 reject를 버림

### V-INFO-3 — Gemini CLI 빌드 인보케이션 미구현

```ts
// cliExecutor.ts line 275–313: Codex만 구현
if (family === "codex") { ... }
// Gemini 분기 없음 → family="gemini"면 line 315로 fallback:
const args = [...baseArgs, ...resolveModelArgs(family, modelId)];
args.push(...resolvePromptArgs(baseArgs, prompt));
// → gemini --model "..." -- "prompt"  (plain text, 스트리밍 없음)
```

Gemini CLI는 `--output-format stream-json`이 없음 → 별도 분기 필요
`BUG_FIX_SPEC CLI-1` 참조

---

## 4. BUG_FIX_SPEC 이행 상태 (현재 기준)

### 오리지널 10개 항목

| ID | 항목 | 구현 상태 | 비고 |
|----|------|-----------|------|
| BUG-1 | 빌드 진행 표시 (stream-json) | 🟡 부분 | 확장 모드만 표시, 컴팩트 무음 |
| BUG-2 | Quota 폴러 수정 (PTY) | ❌ 미구현 | 현재 헤드리스 프롬프트 방식 사용 |
| BUG-3 | normalizeBaseArgs `-p` 필터 | ❌ 미구현 | `--print`만 필터링 중 |
| BUG-4 | preferredBackends 저장 | ✅ 구현됨 | App.tsx state로 관리 |
| BUG-5 | canBuild 조건 개선 | 🟡 부분 | hasTeamReady 포함은 됨 |
| FEAT-1 | Smart/Manual 전략 전환 | ✅ 구현됨 | UI 완성 |
| FEAT-2 | Budget constraint UI | ✅ 구현됨 | strict/soft 드롭다운 |
| FEAT-3 | Usage dashboard | ✅ 구현됨 | 진행바 표시 |
| LAYOUT-1 | 확장/컴팩트 모드 토글 | ✅ 구현됨 | Expand/Collapse 버튼 |
| LAYOUT-2 | 체크박스 (기존 포함) | ✅ 구현됨 | agents/skills/mcp 3종 |

### 신규 CLI-12개 항목 (모두 미구현)

| ID | 항목 | 우선순위 |
|----|------|---------|
| CLI-1 | 3-Backend spawn() + stream-json | P0 |
| CLI-2 | 3-Backend permission policy 통합 UI | P0 |
| CLI-3 | 3-Backend quota pollers + backendAllocator | P1 |
| CLI-4 | Dynamic model list via PTY | P1 |
| CLI-5 | CLAUDE.md + AGENTS.md + GEMINI.md 자동 생성 | P1 |
| CLI-6 | Gemini Plan Mode (/plan) | P1 |
| CLI-7 | Budget/turn limit UI | P2 |
| CLI-8 | Session resume 통합 | P2 |
| CLI-9 | enableWebSearch 플래그 | P2 |
| CLI-10 | Hooks 자동 생성 | P2 |
| CLI-11 | Skills 3-backend export | P2 |
| CLI-12 | Docker Sandbox UI | P2 |

---

## 5. 수정 우선순위 및 작업 순서

```
Phase 1 — 즉시 수정 (현재 버그 fix)
  P0-V1: BuildPromptBar 컴팩트 모드 에러 표시 추가
  P0-V2: App.tsx void → catch 추가
  P0-V3: normalizeBaseArgs에 "-p" 필터 추가
  P0-V4: claudeQuotaPoller /status 헤드리스 호출 제거 (--help fallback 유지)

Phase 2 — 신규 P0 구현
  CLI-1: Gemini CLI spawn 분기 추가 (cliExecutor.ts)
  CLI-2: UnifiedPermissionLevel → 3-backend 플래그 매핑

Phase 3 — P1 구현
  CLI-3: backendAllocator.ts + geminiQuotaPoller.ts (node-pty)
  CLI-4: PTY 기반 모델 목록 동적 조회
  CLI-5: 3종 context 파일 자동 생성

Phase 4 — P2 구현
  CLI-6~12: 나머지 기능들
```

---

## 6. 파일별 수정 필요 목록

| 파일 | 수정 내용 |
|------|-----------|
| `webview-ui/src/components/BuildPromptBar.tsx` | 컴팩트 모드에 error progress 표시 추가 |
| `webview-ui/src/App.tsx` | `void buildTeamFromPromptBar()` → `.catch()` 추가 |
| `extension/src/services/cliExecutor.ts` | `normalizeBaseArgs` `-p` 필터 추가, Gemini 분기 추가 |
| `extension/src/services/claudeQuotaPoller.ts` | `/status` 헤드리스 호출 제거, PTY 방식으로 교체 |
| `extension/src/services/backendAllocator.ts` | 신규 생성 (CLI-3) |
| `extension/src/services/geminiQuotaPoller.ts` | 신규 생성 (CLI-3) |
| `extension/src/services/permissionMapper.ts` | 신규 생성 (CLI-2) |
| `extension/src/services/contextFileWriter.ts` | 신규 생성 (CLI-5) |

---

---

## 7. 신규 버그 — AI Prompt 모델 클릭 시 백엔드별 모델 미구분 (V-BUG-6)

### 증상
AI Prompt(PromptPanel) 또는 BuildPromptBar에서 Codex / Gemini 백엔드를 선택해도
실행되는 CLI에 **Claude 모델 ID**(`claude-sonnet-4-5-20250929`)가 그대로 전달됨

### 근본 원인 — `modelRouter.ts` 백엔드 미인식

```ts
// extension/src/services/configService.ts
export const DEFAULT_CACHE_CONFIG = {
  modelRouting: {
    heartbeat: "claude-haiku-4-5-20251001",
    cron:      "claude-haiku-4-5-20251001",
    default:   "claude-sonnet-4-5-20250929"   // ← Claude 전용 모델 ID
  }
};

// extension/src/services/modelRouter.ts
export function resolveModel(input: {
  agent: AgentProfile | undefined;
  taskType: "generation" | "execution" | "heartbeat" | "cron";
  config: CacheConfig;
}): string {
  // ... agent modelId 없으면 config.modelRouting.default 반환
  return input.config.modelRouting.default;   // ← "claude-sonnet-4-5-20250929" 반환
  // ❌ 백엔드 파라미터 없음 — Codex/Gemini를 알 수 없음
}
```

### 오류 전파 경로

```
extension.ts GENERATE_AGENT_STRUCTURE:
  const modelId = resolveModel({ agent: undefined, taskType: "generation", config });
  // modelId = "claude-sonnet-4-5-20250929" (항상 Claude 모델!)

  let backend = pickPromptBackend(backends, "codex", usageSummaries);
  // backend = Codex CLI

  await executeCliPrompt({ backend: codexBackend, modelId: "claude-sonnet-4-5-20250929" })
    ↓
  buildCliInvocation (family = "codex"):
    args.push("--model", "claude-sonnet-4-5-20250929")
    ↓
  실행: codex exec --json --model claude-sonnet-4-5-20250929 "..."
  // ❌ Codex는 claude 모델 모름 → CLI 오류!

  // Gemini의 경우:
  gemini --model claude-sonnet-4-5-20250929 -- "..."
  // ❌ Gemini도 claude 모델 모름 → CLI 오류!
```

### 에이전트 실행 시도 시도 시도 시도에도 동일 문제 발생

```ts
// extension.ts line 2992 (에이전트 실행 경로)
const modelId = resolveModel({ agent: agentProfile, taskType: "execution", config: cacheConfig });
// agent.runtime.modelId가 없으면 → config.default = claude-sonnet
// 에이전트가 Codex 백엔드여도 claude 모델 ID 전달 → 동일 오류
```

### 수정 방향

**A — `resolveModel`에 backend 파라미터 추가**

```ts
// modelRouter.ts 수정안
const BACKEND_DEFAULT_MODELS: Record<string, string> = {
  claude: "claude-sonnet-4-5-20250929",
  codex:  "gpt-4.1",
  gemini: "gemini-2.5-flash",
  aider:  "",      // aider는 자체 모델 관리
  custom: ""       // custom은 모델 지정 안 함
};

export function resolveModel(input: {
  agent: AgentProfile | undefined;
  taskType: "generation" | "execution" | "heartbeat" | "cron";
  config: CacheConfig;
  backendFamily?: string;   // ← 추가
}): string | undefined {
  const preferred = input.agent?.preferredModel?.trim();
  if (preferred) return preferred;

  const runtimeModel = input.agent?.runtime?.kind === "cli"
    ? input.agent.runtime.modelId?.trim() : undefined;
  if (runtimeModel) return runtimeModel;

  // 백엔드별 기본값 사용
  const backendDefault = input.backendFamily
    ? BACKEND_DEFAULT_MODELS[input.backendFamily]
    : undefined;
  if (backendDefault) return backendDefault;

  // Claude 전용 taskType 기본값 (heartbeat/cron은 Claude에서만 사용)
  if (input.taskType === "heartbeat") return input.config.modelRouting.heartbeat;
  if (input.taskType === "cron") return input.config.modelRouting.cron;
  return input.config.modelRouting.default;
}
```

**B — GENERATE_AGENT_STRUCTURE에서 backend-aware 호출**

```ts
// extension.ts 수정안
const backendFamily = normalizeBackendId(backend.id) ?? "claude";
const modelId = resolveModel({
  agent: undefined,
  taskType: "generation",
  config: cacheConfig,
  backendFamily   // ← 추가
});
```

### 관련 파일

| 파일 | 변경 내용 |
|------|-----------|
| `extension/src/services/modelRouter.ts` | `backendFamily` 파라미터 추가, 백엔드별 기본 모델 맵 추가 |
| `extension/src/services/configService.ts` | `modelRouting`에 `codex`, `gemini` 기본값 필드 추가 |
| `extension/src/extension.ts` | `resolveModel` 호출 시 `backendFamily` 전달 |

---

## 8. 신규 버그 — AgentCreationModal Gemini 전용 UI 없음 (V-BUG-7)

### 증상
에이전트 생성 모달에서 Gemini 백엔드 선택 시 Gemini 전용 설정 항목 없음

### 현재 코드

```tsx
// AgentCreationModal.tsx
{backendId === "claude" && (
  <> Claude 전용 필드: promptMode, maxTurns, maxBudgetUsd, permissionMode, allowedTools </>
)}
{backendId === "codex" && (
  <> Codex 전용 필드: codexApproval, codexSandbox, additionalDirs, enableWebSearch </>
)}
// ❌ backendId === "gemini" 분기 없음!
```

### 누락된 Gemini 전용 필드

| 필드 | 설명 | Gemini CLI 플래그 |
|------|------|-------------------|
| Approval mode | 자동 승인 수준 | `--approval-mode default/auto_edit/yolo` |
| Docker sandbox | 격리 실행 | `--sandbox` |
| Web search | 구글 검색 | `--yolo --google-search` (내장) |
| Plan mode | 계획만 생성 | PTY `/plan` 명령 |

### 수정 방향

```tsx
{backendId === "gemini" && (
  <>
    <div className="inspector-field">
      <label>Approval mode</label>
      <select value={geminiApproval} onChange={...}>
        <option value="default">Default (ask per tool)</option>
        <option value="auto_edit">Auto-edit (code edits without ask)</option>
        <option value="yolo">Full-auto (never ask)</option>
      </select>
    </div>
    <label className="checkbox-row">
      <input type="checkbox" checked={geminiSandbox} onChange={...} />
      Enable Docker sandbox
    </label>
    <label className="checkbox-row">
      <input type="checkbox" checked={enableWebSearch} onChange={...} />
      Enable web search (Google Search built-in)
    </label>
  </>
)}
```

---

*검증 완료 — 다음 단계: Phase 1 버그 수정 후 Phase 2 CLI-1 구현 착수*
