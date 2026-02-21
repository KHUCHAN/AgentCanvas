# AgentCanvas — Prompt Caching & 비용 최적화 개발 지시서

**Date**: 2026-02-19
**목적**: AgentCanvas의 멀티에이전트 실행 시 API 비용을 최대 90% 절감하는 캐싱 시스템 구현

---

## 1. 문제 정의

AgentCanvas는 `cliExecutor.ts` → CLI 백엔드(Claude/Gemini/Codex/Aider) → API 호출 구조로 에이전트를 실행한다.

현재 문제:
- `promptBuilder.ts`가 매 호출마다 전체 컨텍스트를 새로 조립하여 전송
- 에이전트의 systemPrompt, AGENTS.md 룰 체인, commonRules 등 **매번 반복되는 정적 컨텍스트**가 8,000~15,000 토큰
- 하나의 Flow 실행(executeRunLoop)에서 에이전트당 최소 1~3회 CLI 호출 → 동일 컨텍스트 반복 전송
- 비용: Standard Input $3.00/1M 토큰 기준, 캐시 Read는 $0.30/1M (90% 절감 가능)

---

## 2. 대상 파일 분석 (현재 코드)

### 2.1 `extension/src/services/promptBuilder.ts` (83줄)

현재 구조:
```typescript
buildAgentGenerationPrompt(input) → string
```
- 에이전트/스킬/MCP 컨텍스트를 JSON.stringify로 직렬화
- 모든 내용을 하나의 문자열로 join → CLI stdin으로 전달
- **캐시 마킹 없음** — 정적/동적 구분 없이 매번 전체 재전송

### 2.2 `extension/src/services/cliExecutor.ts` (109줄)

현재 구조:
```typescript
executeCliPrompt({ backend, prompt, workspacePath, timeoutMs }) → CliExecutionResult
```
- `spawn(command, args, { cwd, env })` 로 CLI 프로세스 생성
- prompt를 stdin으로 전달 (stdinPrompt 모드) 또는 args에 직접 포함
- **응답에서 토큰 사용량을 파싱하지 않음** — cacheRead/cacheWrite 정보 수집 안 됨

### 2.3 `extension/src/types.ts`

- `RunEvent.usage?: Record<string, number>` 필드 존재하지만 **실제로 채워지지 않음**
- `AgentProfile.runtime: AgentRuntime` — `cli` 또는 `openclaw` 타입
- `CliBackend` — command, args, env 정보 보유
- **모델 선택/라우팅 필드 없음**

### 2.4 `extension/src/extension.ts` — executeRunLoop

- 태스크별로 `executeCliPrompt()` 호출
- `appendRunEvent()` 로 JSONL 이벤트 기록
- `RunEvent.usage` 필드가 있지만 **빈 객체로 전달**

---

## 3. 구현 지시

### 3.1 AgentProfile에 모델 라우팅 필드 추가

**파일**: `extension/src/types.ts`

`AgentProfile` 인터페이스에 추가:
```typescript
export interface AgentProfile {
  // ... 기존 필드 ...
  preferredModel?: string;   // "haiku-4.5" | "sonnet-4.5" | "opus-4.5"
}
```

`AgentRuntime`의 `cli` 타입에 추가:
```typescript
| {
    kind: "cli";
    backendId: CliBackendId;
    cwdMode?: "workspace" | "agentHome";
    modelId?: string;          // 신규: 해당 에이전트가 사용할 모델
  }
```

### 3.2 캐싱 설정 타입 추가

**파일**: `extension/src/types.ts`

```typescript
export interface CacheConfig {
  retention: "short" | "long";       // short=5분, long=1시간
  contextPruning: {
    mode: "cache-ttl";
    ttlSeconds: number;              // 기본 3600
  };
  diagnostics: {
    enabled: boolean;
    logPath: string;                 // 기본 ".agentcanvas/logs/cache-trace.jsonl"
  };
  modelRouting: {
    heartbeat: string;               // 기본 "haiku-4.5"
    cron: string;                    // 기본 "haiku-4.5"
    default: string;                 // 기본 "sonnet-4.5"
  };
  contextThreshold: number;          // 기본 180000 토큰
}

export interface CacheMetrics {
  cacheRead: number;
  cacheWrite: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  savedCost: number;
  model: string;
  hitRate: number;                   // cacheRead / (cacheRead + inputTokens)
}
```

`RunEvent`의 `usage` 필드를 구체화:
```typescript
export interface RunEvent {
  // ... 기존 필드 ...
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    cacheRead?: number;
    cacheWrite?: number;
    model?: string;
    cost?: number;
    savedCost?: number;
  };
}
```

### 3.3 configService 구현

**파일 (신규)**: `extension/src/services/configService.ts`

```
역할: .agentcanvas/config.json 로드/저장/감시

loadConfig(workspaceRoot) → CacheConfig
saveConfig(workspaceRoot, config) → void
watchConfig(workspaceRoot, onChange) → Disposable

기본값:
  retention: "long"
  contextPruning: { mode: "cache-ttl", ttlSeconds: 3600 }
  diagnostics: { enabled: false, logPath: ".agentcanvas/logs/cache-trace.jsonl" }
  modelRouting: { heartbeat: "haiku-4.5", cron: "haiku-4.5", default: "sonnet-4.5" }
  contextThreshold: 180000
```

저장 위치: `.agentcanvas/config.json` (기존 `.agentcanvas/` 구조 활용)

### 3.4 promptBuilder 리팩터링

**파일**: `extension/src/services/promptBuilder.ts`

현재 `buildAgentGenerationPrompt()` 함수를 확장하여 **정적/동적 블록을 분리**한다.

```
신규 함수: buildCachedPrompt(input) → { staticBlock: string, dynamicBlock: string }

staticBlock (캐시 대상 — 변경 빈도 낮음):
  1. 에이전트 systemPrompt
  2. AGENTS.md 룰 체인 (commonRulesService에서 로드)
  3. 에이전트 role/description/constraints
  4. 할당된 Skill 메타데이터
  5. 할당된 MCP server 목록

dynamicBlock (비캐시 — 매 호출 변경):
  1. 현재 태스크 지시
  2. 이전 태스크 출력 (의존성 결과)
  3. 타임스탬프/런타임 상태
```

`buildAgentGenerationPrompt()`는 기존 로직 유지하되, staticBlock 앞에 캐시 마커 주석을 삽입:
```
<!-- CACHE_STATIC_START -->
[정적 컨텐츠]
<!-- CACHE_STATIC_END -->
[동적 컨텐츠]
```

각 CLI 백엔드가 이 마커를 활용할 수 있도록 한다.

### 3.5 cliExecutor 확장

**파일**: `extension/src/services/cliExecutor.ts`

`CliExecutionResult`에 캐시 메트릭 추가:
```typescript
export interface CliExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  durationMs: number;
  usage?: {                    // 신규
    inputTokens?: number;
    outputTokens?: number;
    cacheRead?: number;
    cacheWrite?: number;
    model?: string;
  };
}
```

CLI 출력에서 토큰 사용량 파싱 로직 추가:
- Claude CLI: stderr에서 `"input_tokens":`, `"cache_read_input_tokens":` 등 JSON 추출
- Codex CLI: stderr에서 usage 블록 파싱
- 파싱 실패 시 usage는 undefined (graceful degradation)

### 3.6 모델 라우팅 서비스

**파일 (신규)**: `extension/src/services/modelRouter.ts`

```
역할: 태스크/에이전트 조합에 따라 최적 모델 결정

resolveModel(input: {
  agent: AgentProfile,
  taskType: "generation" | "execution" | "heartbeat" | "cron",
  config: CacheConfig
}) → string

로직:
  1. agent.preferredModel이 있으면 → 그대로 사용
  2. agent.runtime?.modelId가 있으면 → 그대로 사용
  3. taskType이 "heartbeat" | "cron" → config.modelRouting.heartbeat / cron
  4. 나머지 → config.modelRouting.default
```

### 3.7 토큰 추적 서비스

**파일 (신규)**: `extension/src/services/tokenTracker.ts`

```
역할: 호출별/세션별/플로우별 토큰 사용량 및 비용 추적

기능:
  recordUsage(event: RunEvent) → void
    - RunEvent.usage에서 cacheRead/cacheWrite/inputTokens/outputTokens 추출
    - 플로우별 누적

  getSessionMetrics(flowName) → {
    totalInputTokens, totalOutputTokens,
    totalCacheRead, totalCacheWrite,
    totalCost, totalSavedCost,
    hitRate, callCount
  }

  getContextSize(flowName) → number
    - 현재 세션의 누적 컨텍스트 크기 추정

비용 계산 (하드코딩된 가격표):
  const PRICING = {
    "sonnet-4.5":  { input: 3.00, cacheWrite: 3.75, cacheRead: 0.30, output: 15.00 },
    "haiku-4.5":   { input: 0.80, cacheWrite: 1.00, cacheRead: 0.08, output: 4.00 },
    "opus-4.5":    { input: 15.00, cacheWrite: 18.75, cacheRead: 1.50, output: 75.00 },
  };  // 단위: $/1M tokens
```

### 3.8 캐시 진단 로거

**파일 (신규)**: `extension/src/services/cacheDiagnostics.ts`

```
역할: 캐시 적중/미스를 JSONL로 기록

logCacheEvent(input: {
  flowName: string,
  runId: string,
  nodeId?: string,
  usage: RunEvent["usage"],
  model: string
}) → void

저장: .agentcanvas/logs/cache-trace.jsonl

JSONL 포맷:
{"ts":"ISO","flowName":"...","runId":"...","nodeId":"...","model":"sonnet-4.5","cacheRead":8590,"cacheWrite":266,"inputTokens":8856,"cost":0.011,"savedCost":0.196}

조건: CacheConfig.diagnostics.enabled === true 일 때만 기록
```

### 3.9 extension.ts executeRunLoop 수정

**파일**: `extension/src/extension.ts`

executeRunLoop 내부에서:

1. **configService에서 CacheConfig 로드** (executeRunLoop 시작 시 1회)

2. **태스크 실행 전 모델 결정**:
```typescript
const model = resolveModel({
  agent: taskAgent,
  taskType: "execution",
  config: cacheConfig
});
```

3. **CLI 실행 후 usage 수집**:
```typescript
const result = await executeCliPrompt({ ... });
// result.usage 가 있으면
if (result.usage) {
  tokenTracker.recordUsage({ ...runEvent, usage: result.usage });
  if (cacheConfig.diagnostics.enabled) {
    cacheDiagnostics.logCacheEvent({ flowName, runId, nodeId, usage: result.usage, model });
  }
}
```

4. **appendRunEvent에 usage 전달**:
```typescript
await appendRunEvent({
  ...기존 필드,
  usage: result.usage   // 현재는 빈 객체 → 실제 값으로 교체
});
```

5. **컨텍스트 임계치 확인**:
```typescript
const contextSize = tokenTracker.getContextSize(flowName);
if (contextSize > cacheConfig.contextThreshold) {
  // webview에 경고 메시지 전송
  panel.webview.postMessage({
    type: "CONTEXT_THRESHOLD_WARNING",
    payload: { current: contextSize, threshold: cacheConfig.contextThreshold }
  });
}
```

### 3.10 Webview 프로토콜 메시지 추가

**파일**: `extension/src/messages/protocol.ts` + `webview-ui/src/messaging/protocol.ts`

신규 메시지 타입:
```typescript
// Extension → Webview
| { type: "CACHE_METRICS_UPDATE"; payload: CacheMetrics }
| { type: "CONTEXT_THRESHOLD_WARNING"; payload: { current: number; threshold: number } }

// Webview → Extension
| RequestMessage<"GET_CACHE_METRICS", { flowName: string }>
| RequestMessage<"UPDATE_CACHE_CONFIG", CacheConfig>
| RequestMessage<"GET_CACHE_CONFIG", void>
```

### 3.11 StatusBar UI 수정

**파일**: `webview-ui/src/App.tsx`

현재 StatusBar (하단):
```
agents: N | tasks: N | errors: N | Flow: name
```

추가 표시:
```
agents: N | tasks: N | errors: N | 💰 $0.025 (92% saved) | Context: 120k/180k | Flow: name
```

- `CACHE_METRICS_UPDATE` 메시지 수신 시 state 업데이트
- `CONTEXT_THRESHOLD_WARNING` 수신 시:
  - 150k 미만: 정상 (흰색)
  - 150k~180k: 경고 (노란색 `--warn`)
  - 180k 이상: 위험 (빨간색 `--danger`)

### 3.12 SettingsModal 캐싱 섹션

**파일**: `webview-ui/src/panels/SettingsModal.tsx`

신규 섹션 "Cache & Cost" 추가:

```
┌─ Cache & Cost ──────────────────────────────┐
│                                              │
│ Cache Retention:  [short ▼]  [long ▼]        │
│                                              │
│ Context Threshold: [180000] tokens           │
│                                              │
│ Model Routing:                               │
│   Heartbeat: [haiku-4.5 ▼]                  │
│   Cron:      [haiku-4.5 ▼]                  │
│   Default:   [sonnet-4.5 ▼]                 │
│                                              │
│ Diagnostics: [✓] Enable cache trace logging  │
│                                              │
│ [Save]                                       │
└──────────────────────────────────────────────┘
```

Save 클릭 → `UPDATE_CACHE_CONFIG` 메시지 → configService.saveConfig

### 3.13 CommandBar 커맨드 추가

**파일**: `webview-ui/src/panels/CommandBar.tsx` (또는 App.tsx의 commands 배열)

```typescript
{ label: "Cache Status", action: () => postMessage({ type: "GET_CACHE_METRICS", ... }) },
{ label: "Reset Cache Metrics", action: () => postMessage({ type: "RESET_CACHE_METRICS" }) },
```

---

## 4. 파일 변경 요약

### 신규 파일 (5개)

| 파일 | 역할 | 예상 줄수 |
|------|------|----------|
| `extension/src/services/configService.ts` | 캐싱 설정 로드/저장/감시 | ~80 |
| `extension/src/services/modelRouter.ts` | 태스크별 모델 라우팅 | ~40 |
| `extension/src/services/tokenTracker.ts` | 토큰 사용량/비용 추적 | ~120 |
| `extension/src/services/cacheDiagnostics.ts` | Cache trace JSONL 로거 | ~60 |
| `extension/src/services/costCalculator.ts` | 모델별 가격표/비용 산출 | ~50 |

### 수정 파일 (8개)

| 파일 | 수정 내용 |
|------|-----------|
| `extension/src/types.ts` | CacheConfig, CacheMetrics 타입, AgentProfile.preferredModel, RunEvent.usage 구체화 |
| `extension/src/services/promptBuilder.ts` | buildCachedPrompt() 추가, 정적/동적 블록 분리 |
| `extension/src/services/cliExecutor.ts` | CliExecutionResult.usage 추가, CLI 출력에서 토큰 파싱 |
| `extension/src/extension.ts` | executeRunLoop에 configService/modelRouter/tokenTracker/cacheDiagnostics 통합 |
| `extension/src/messages/protocol.ts` | CACHE_METRICS_UPDATE, GET_CACHE_CONFIG 등 메시지 |
| `webview-ui/src/messaging/protocol.ts` | 동일 메시지 타입 동기화 |
| `webview-ui/src/App.tsx` | StatusBar에 비용/컨텍스트 크기 표시, 임계치 경고 |
| `webview-ui/src/panels/SettingsModal.tsx` | Cache & Cost 설정 섹션 |

---

## 5. 구현 순서

### Step 1 — 타입 + 설정 (0.5일)

1. `types.ts`에 CacheConfig, CacheMetrics, preferredModel 추가
2. `configService.ts` 구현 (로드/저장/기본값)
3. `.agentcanvas/config.json` 기본 파일 생성 로직

### Step 2 — 프롬프트 분리 + CLI 파싱 (1일)

4. `promptBuilder.ts`에 `buildCachedPrompt()` 추가
5. `cliExecutor.ts`에 usage 파싱 추가 (Claude stderr JSON 파싱)
6. `CliExecutionResult`에 usage 필드 반영

### Step 3 — 추적 + 라우팅 (1일)

7. `modelRouter.ts` 구현
8. `tokenTracker.ts` 구현 (가격표 포함)
9. `cacheDiagnostics.ts` 구현

### Step 4 — executeRunLoop 통합 (1일)

10. `extension.ts`의 executeRunLoop에 위 서비스들 연결
11. appendRunEvent에 usage 전달
12. 컨텍스트 임계치 경고 로직

### Step 5 — UI (1일)

13. 프로토콜 메시지 추가 (양쪽)
14. App.tsx StatusBar 수정
15. SettingsModal 캐싱 섹션
16. CommandBar 커맨드

**총 예상: 4~5일**

---

## 6. 검증 기준

- [ ] `.agentcanvas/config.json` 생성/로드/저장 동작
- [ ] Flow 실행 시 RunEvent.usage에 inputTokens/cacheRead/cacheWrite 기록됨
- [ ] `cache-trace.jsonl`에 호출별 로그 기록 (diagnostics.enabled 시)
- [ ] StatusBar에 비용/절감률 실시간 표시
- [ ] 에이전트별 preferredModel 설정 시 해당 모델로 CLI 호출
- [ ] 컨텍스트 150k 초과 시 경고, 180k 초과 시 위험 표시
- [ ] SettingsModal에서 캐싱 설정 변경 → config.json 반영

---

*AgentCanvas Prompt Caching Development Spec v1.0 — 2026-02-19*
