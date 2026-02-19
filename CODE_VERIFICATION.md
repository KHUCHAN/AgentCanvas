# AgentCanvas 코드 검증 리포트

**검증일:** 2026-02-18
**대상:** Schedule/Run 시스템 전체 추가, AgentRuntime 지원, 기존 버그 수정
**빌드 상태:** ✅ extension typecheck 통과 / ✅ webview typecheck 통과

---

## 1. 변경 사항 요약

### 새로 추가된 파일

| 파일 | 설명 |
|------|------|
| `extension/src/schedule/scheduleService.ts` | 태스크 스케줄링 엔진 (구독/이벤트/CRUD) |
| `extension/src/schedule/scheduler.ts` | 토폴로지 정렬 기반 스케줄 계산 |
| `extension/src/schedule/types.ts` | 스케줄 타입 re-export |
| `extension/src/services/pinStore.ts` | 태스크 출력 핀/캐시 저장소 |
| `extension/src/services/runStore.ts` | Run 히스토리/이벤트 JSONL 저장소 |
| `webview-ui/src/canvas/ScheduleView.tsx` | 간트 차트 스타일 스케줄 뷰 |

### 주요 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `extension/src/types.ts` | AgentRuntime, CliBackendId, CliBackendOverrides, Task, TaskEvent, RunSummary, RunEvent, PinnedOutput 타입 추가 |
| `extension/src/extension.ts` | executeRunLoop, buildTasksFromFlow, resolveBackendForTask, startDemoScheduleRun, setAgentRuntime, setBackendOverrides 등 ~800줄 추가 |
| `webview-ui/src/App.tsx` | canvasMode, runHistory, scheduleTasks, applyScheduleEvent, subscribeScheduleRun 등 스케줄 통합 |
| `extension/src/messages/protocol.ts` | SCHEDULE_*, TASK_*, RUN_*, PIN_*, SET_AGENT_RUNTIME, SET_BACKEND_OVERRIDES 메시지 추가 |
| `webview-ui/src/messaging/protocol.ts` | extension protocol과 동기화 |
| `extension/src/services/agentProfileService.ts` | runtime 필드 지원, createCustomAgentProfile에 기본 runtime 설정 |
| `extension/src/services/cliExecutor.ts` | backend.env 환경변수 전달 지원 |

### 이전 세션 버그 수정

| 버그 | 수정 내용 | 상태 |
|------|-----------|------|
| 노드 위치 저장 안 됨 | workspaceState 기반 nodePositions Map 추가, refreshState에서 적용 | ✅ 수정 완료 |
| Prompt apply 에러 | applyGeneratedStructure 4단계 try-catch 구조화 | ✅ 수정 완료 |
| dagreLayout system 노드 누락 | NODE_SIZE에 system: { w: 230, h: 120 } 추가 | ✅ 수정 완료 |
| AgentCreationModal 무음 에러 | errorMessage 상태 및 .modal-error 표시 추가 | ✅ 수정 완료 |
| flowStore loadFlow 에러 | 파일 읽기/JSON 파싱 분리 try-catch | ✅ 수정 완료 |

---

## 2. 타입 호환성

### 프로토콜 동기화 상태: ✅ 일치

extension과 webview의 protocol.ts 파일에 정의된 모든 메시지 타입이 정확히 일치합니다.

- `WebviewToExtensionMessage`: 44개 메시지 타입 (양쪽 동일)
- `ExtensionToWebviewMessage`: 10개 메시지 타입 (양쪽 동일)
- 새로 추가된 메시지: SCHEDULE_SUBSCRIBE, SCHEDULE_UNSUBSCRIBE, SCHEDULE_GET_SNAPSHOT, TASK_PIN, TASK_MOVE, TASK_SET_PRIORITY, RUN_FLOW, RUN_NODE, STOP_RUN, LIST_RUNS, LOAD_RUN, PIN_OUTPUT, UNPIN_OUTPUT, SET_AGENT_RUNTIME, SET_BACKEND_OVERRIDES, SCHEDULE_EVENT

### 타입 내보내기 상태: ✅ 정상

webview protocol.ts에서 re-export 되는 타입: AgentRuntime, CliBackendOverrides, RunEvent, RunSummary, Task, TaskEvent — 모두 extension types.ts에 정의된 것과 동일합니다.

### exhaustive switch 확인: ✅ 정상

extension.ts의 `handleMessage()` switch문에 `default: never` 패턴이 적용되어 있어, 메시지 타입 누락 시 컴파일 에러가 발생합니다.

---

## 3. 발견된 이슈

### CRITICAL (3건)

#### C-1. executeRunLoop 무한루프 위험

**위치:** `extension/src/extension.ts` — `executeRunLoop()` (line ~1800)

**문제:** 태스크의 deps 배열에 현재 런에 존재하지 않는 taskId가 포함된 경우, `deps.every(depId => tasks.find(item => item.id === depId)?.status === "done")` 조건이 영원히 false를 반환합니다. `sleep(120)` 폴링이 무한 반복되며 CPU를 소비합니다.

```typescript
// 문제 코드
if (!nextTask) {
  await sleep(120);  // 120ms 폴링 → 무한루프
  continue;
}
```

**해결 방안:** 최대 반복 횟수 제한 또는 "진행 없음" 감지 로직 추가. 예를 들어 10초간 새로운 태스크가 시작되지 않으면 남은 태스크를 blocked 처리하고 종료.

---

#### C-2. Scheduler 사이클 감지 결함

**위치:** `extension/src/schedule/scheduler.ts` — `computeSchedule()` (line ~93-101, 115-139)

**문제:** 토폴로지 정렬 과정에서 큐에 먼저 들어온 노드들은 line 97에서 `status = "ready"`로 전환됩니다. 그러나 이후 사이클 감지(line 115)에서는 `processed` 셋에 포함되지 않은 노드만 blocked 처리합니다. 사이클의 일부 노드가 이미 "ready"로 전환된 경우, 해당 노드는 blocked 되지 않습니다.

```typescript
// line 93-101: 큐에서 처리된 노드 → ready로 전환
if (task.status === "planned" && ...) {
  task.status = "ready";  // 사이클 노드도 여기서 ready가 될 수 있음
}

// line 115: 사이클 감지 → processed에 없는 노드만 blocked
if (processed.size !== tasks.size) {
  // processed에 포함된 노드는 건너뜀
  // → 이미 ready로 바뀐 사이클 노드는 blocked 안 됨
}
```

**해결 방안:** 사이클 감지 시 "ready" 상태도 blocked로 전환하도록 수정. 또는 status 변경을 사이클 감지 이후로 이동.

---

#### C-3. JSON.stringify 기반 동등성 비교 불안정

**위치:** `extension/src/schedule/scheduleService.ts` — `isEqual()` (line 246)

**문제:** 객체 키 순서가 다르면 동일한 데이터라도 다르게 판단합니다. 예: `{a:1, b:2}` vs `{b:2, a:1}`. 이로 인해 patch 이벤트가 누락되거나 불필요하게 발생할 수 있습니다. 또한 circular reference 시 예외가 발생합니다.

```typescript
function isEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
```

**해결 방안:** 키 정렬 후 비교하거나, lodash의 `isEqual` 같은 deep equality 함수 사용.

---

### HIGH (4건)

#### H-1. Demo 타이머 async 콜백 레이스 컨디션

**위치:** `extension/src/extension.ts` — `startDemoScheduleRun()` (line ~1449)

**문제:** `setInterval` 콜백 내에서 async 작업(appendRunEvent, finishRun) 수행. `clearInterval` 호출 시 이미 실행 중인 콜백은 취소되지 않으며, 콜백이 1000ms 이상 걸리면 중복 실행 가능.

**해결 방안:** 콜백에 뮤텍스 플래그 추가하거나, 재귀적 `setTimeout` 패턴으로 전환.

---

#### H-2. patchTask 중첩 객체 병합 문제

**위치:** `extension/src/schedule/scheduleService.ts` — `patchTask()` (line ~112)

**문제:** overrides/meta의 1단계 속성만 shallow merge됩니다. 중첩 속성(예: `{ customData: { foo: 'bar' } }`)은 전체 교체되어 기존 값이 손실될 수 있습니다.

**해결 방안:** deep merge 유틸리티 적용 또는 문서화하여 사용 시 전체 overrides 객체를 전달하도록 안내.

---

#### H-3. appendRunEvent 매 호출 시 mkdir

**위치:** `extension/src/services/runStore.ts` — `appendRunEvent()` (line ~69)

**문제:** 이벤트 기록 시마다 `mkdir(dir, { recursive: true })`를 호출합니다. 데모 스케줄이 수백 건의 이벤트를 발생시키면 불필요한 syscall이 누적됩니다.

**해결 방안:** 디렉터리 생성을 `startRun()` 시 1회만 수행하고, `appendRunEvent`에서는 생략.

---

#### H-4. listRuns N+1 파일 읽기 문제

**위치:** `extension/src/services/runStore.ts` — `listRuns()` (line ~125)

**문제:** flowName 미지정 시 모든 플로우 디렉터리의 index.json을 순차 읽기합니다. 100+ 플로우 시 수 초 소요 가능.

**해결 방안:** 전체 런 인덱스 캐시 도입 또는 `Promise.all`로 병렬 읽기.

---

### MEDIUM (5건)

#### M-1. ScheduleView 타임라인 과도한 너비

**위치:** `webview-ui/src/canvas/ScheduleView.tsx` — `PX_PER_SEC = 4` (line 30)

**문제:** 4px/sec 비율로 2분 태스크가 480px, 10분이면 2400px. 실제 사용 시 과도한 가로 스크롤 필요. 데모 태스크 90초~135초는 360px~540px로 비교적 양호하나, 실 환경(수분~수십분 태스크)에서는 비실용적.

---

#### M-2. NowLine 뷰포트 변환 불완전

**위치:** `webview-ui/src/canvas/ScheduleView.tsx` — `NowLine` (line 247)

**문제:** `screenX = worldX * viewport.zoom + viewport.x`이 CSS 포지셔닝 컨텍스트를 고려하지 않음. ReactFlow 내부 transform 중첩 시 부정확.

---

#### M-3. 단일 런만 지원하는 이벤트 처리

**위치:** `webview-ui/src/App.tsx` — `applyScheduleEvent()` (line ~89)

**문제:** 현재 활성 runId와 다른 이벤트는 silent drop. 동시 런 시 이전 런의 이벤트 손실.

---

#### M-4. 스케줄 타이머 다중 생성 가능성

**위치:** `webview-ui/src/App.tsx` — `useEffect` (line ~210)

**문제:** scheduleRunId가 빠르게 변경되면 이전 타이머 cleanup과 새 타이머 생성 사이에 갭이 발생할 수 있음. 또한 250ms 고정 증분이 실제 이벤트 타임스탬프와 동기화되지 않음.

---

#### M-5. sanitizeFileName 중복 정의

**위치:** `extension/src/services/pinStore.ts` (line 90) + `extension/src/services/agentProfileService.ts`

**문제:** 동일한 `sanitizeFileName` 함수가 두 파일에 독립적으로 정의됨. DRY 원칙 위반.

**해결 방안:** `pathUtils.ts`에 공통 함수로 추출.

---

### LOW (3건)

#### L-1. executeRunLoop 폴링 간격 120ms

**위치:** `extension/src/extension.ts` (line ~1805)

120ms 폴링은 다소 공격적. 대기 시간이 길어지면 CPU 낭비. 500ms~1s로 조정하거나 이벤트 기반으로 전환 권장.

---

#### L-2. schedule/types.ts 불필요한 re-export

**위치:** `extension/src/schedule/types.ts`

types.ts의 모든 내용이 `../types`에서 re-export하는 것뿐. 직접 import로 전환 가능하나, 모듈 경계 분리 목적이라면 유지.

---

#### L-3. executeRunLoop cleanup 시 demoRunTimers 미확인

**위치:** `extension/src/extension.ts` (line ~1951)

`executeRunLoop` 종료 시 `activeRunStops`, `activeRunFlowById`만 정리. `demoRunTimers`는 데모 런 전용이지만, 데모 런과 일반 런의 정리 경로가 분리되어 있어 stale 엔트리 가능.

---

## 4. 아키텍처 평가

### 잘 구현된 부분

- **프로토콜 동기화**: extension과 webview의 메시지 타입이 완벽히 일치하며, exhaustive switch로 누락 방지
- **ScheduleService 설계**: 구독 기반 이벤트 시스템이 깔끔하게 분리됨
- **노드 위치 지속성**: workspaceState 기반 저장이 적절하며, refreshState에서 올바르게 적용
- **에러 핸들링 구조**: applyGeneratedStructure의 4단계 try-catch가 부분 실패를 잘 처리
- **타입 안전성**: AgentRuntime discriminated union 패턴이 적절

### 개선 권장 사항

1. **즉시 수정 필요**: executeRunLoop 무한루프 방어, scheduler 사이클 감지 보완, isEqual 함수 교체
2. **1주 내 수정 권장**: runStore 성능 개선, 타이머 레이스 컨디션 해결
3. **점진적 개선**: sanitizeFileName 통합, ScheduleView 타임스케일 조정, multi-run 지원

---

## 5. 빌드 검증 로그

```
$ npm run typecheck:webview
> agent-canvas@0.1.0 typecheck:webview
> npm --prefix webview-ui run typecheck
> agent-canvas-webview@0.1.0 typecheck
> tsc --noEmit -p tsconfig.json
(에러 없음 — 정상 통과)
```

---

*이 리포트는 AgentCanvas 프로젝트의 최신 변경 사항에 대한 정적 분석 및 코드 리뷰 결과입니다.*
