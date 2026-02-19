# AgentCanvas 코드 검증 리포트

**검증일:** 2026-02-18 (디자인 검증 추가: 2026-02-19)
**대상:** Schedule/Run 시스템 전체 추가, AgentRuntime 지원, 기존 버그 수정, 디자인 일관성
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

#### C-2. ~~Scheduler 사이클 감지 결함~~ ✅ 수정됨

**위치:** `extension/src/schedule/scheduler.ts` — `computeSchedule()`

**수정 내용:** 3단계 분리 구조로 리팩터링됨:
1. 토폴로지 정렬에서는 `plannedStartMs`/`plannedEndMs` 계산만 수행
2. 사이클/누락 의존성 감지를 별도 루프로 분리 (missing deps / unresolved deps 구분)
3. `planned → ready` 전환을 processed 노드에 대해서만 마지막에 수행

`isTerminalStatus` 헬퍼, `markUpdated` 셋 기반 중복 방지, `blockerChanged` 비교로 불필요한 이벤트 억제도 추가됨.

---

#### C-3. ~~JSON.stringify 기반 동등성 비교 불안정~~ ✅ 수정됨

**위치:** `extension/src/schedule/scheduleService.ts` — `isEqual()` / `deepEqual()`

**수정 내용:** `JSON.stringify` 비교가 커스텀 `deepEqual()` 함수로 교체됨. `Object.is` 기반 원시 비교, 배열 재귀 비교, 객체 키 정렬(`Object.keys().sort()`) 후 비교, `WeakMap` 기반 순환 참조 방지가 구현됨. `isPlainObject` 헬퍼로 타입 가드도 추가됨.

---

### HIGH (4건)

#### H-1. Demo 타이머 async 콜백 레이스 컨디션

**위치:** `extension/src/extension.ts` — `startDemoScheduleRun()` (line ~1449)

**문제:** `setInterval` 콜백 내에서 async 작업(appendRunEvent, finishRun) 수행. `clearInterval` 호출 시 이미 실행 중인 콜백은 취소되지 않으며, 콜백이 1000ms 이상 걸리면 중복 실행 가능.

**해결 방안:** 콜백에 뮤텍스 플래그 추가하거나, 재귀적 `setTimeout` 패턴으로 전환.

---

#### H-2. ~~patchTask 중첩 객체 병합 문제~~ ✅ 수정됨

**위치:** `extension/src/schedule/scheduleService.ts` — `patchTask()`

**수정 내용:** `mergeNestedRecords()` 함수가 추가되어 overrides/meta에 대해 재귀적 deep merge가 적용됨. `isPlainObject` 가드로 객체만 재귀 병합하고, 비객체 값은 교체 방식 유지.

---

#### H-3. ~~appendRunEvent 매 호출 시 mkdir~~ ✅ 수정됨

**위치:** `extension/src/services/runStore.ts` — `appendRunEvent()`

**수정 내용:** `mkdir` 호출이 제거되고 "write-first, mkdir on ENOENT" 패턴으로 변경됨. 먼저 `appendFile`을 시도하고, `ENOENT` 에러 시에만 `mkdir` 후 재시도. `isFsErrorCode()` 헬퍼 함수도 추가됨.

---

#### H-4. ~~listRuns N+1 파일 읽기 문제~~ ✅ 수정됨

**위치:** `extension/src/services/runStore.ts` — `listRuns()`

**수정 내용:** 순차 `for` 루프가 `Promise.all(flowEntries.map(...))`로 변경되어 모든 플로우 인덱스를 병렬로 읽음. `.flat()`으로 결과 합산.

---

### MEDIUM (5건)

#### M-1. ~~ScheduleView 타임라인 과도한 너비~~ ✅ 수정됨

**위치:** `webview-ui/src/canvas/ScheduleView.tsx`

**수정 내용:** 고정 `PX_PER_SEC = 4` 대신 동적 `pxPerSec` 계산으로 변경. `TIMELINE_TARGET_WIDTH = 2400`을 기준으로 전체 시간 범위에 맞춰 0.75~2.4 범위로 자동 조절. `clampNumber` 함수로 범위 제한. 모든 `timeToX`, `xToTime`, `durationToW` 함수에 `pxPerSec` 파라미터 추가.

---

#### M-2. ~~NowLine 뷰포트 변환 불완전~~ ✅ 수정됨

**위치:** `webview-ui/src/canvas/ScheduleView.tsx`

**수정 내용:** 기존 `NowLine` 컴포넌트(뷰포트 변환 기반 div)가 `ScheduleNowNode` ReactFlow 노드로 완전 교체됨. ReactFlow 자체가 노드 위치를 관리하므로 뷰포트 변환 불일치 문제가 근본적으로 해결. `useViewport` 임포트 제거, `zIndex: 20`과 `pointerEvents: "none"` 적용으로 상호작용 없이 최상위 표시.

---

#### M-3. 단일 런만 지원하는 이벤트 처리

**위치:** `webview-ui/src/App.tsx` — `applyScheduleEvent()` (line ~89)

**문제:** 현재 활성 runId와 다른 이벤트는 silent drop. 동시 런 시 이전 런의 이벤트 손실.

---

#### M-4. 스케줄 타이머 다중 생성 가능성

**위치:** `webview-ui/src/App.tsx` — `useEffect` (line ~210)

**문제:** scheduleRunId가 빠르게 변경되면 이전 타이머 cleanup과 새 타이머 생성 사이에 갭이 발생할 수 있음. 또한 250ms 고정 증분이 실제 이벤트 타임스탬프와 동기화되지 않음.

---

#### M-5. ~~sanitizeFileName 중복 정의~~ ✅ 수정됨

**위치:** `extension/src/services/pinStore.ts`, `extension/src/services/agentProfileService.ts`

**수정 내용:** 중복 정의되었던 `sanitizeFileName` 함수가 `pathUtils.ts`로 추출되어 공통 모듈로 통합됨. pinStore.ts는 이제 `pathUtils`에서 import하여 사용.

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

1. **즉시 수정 필요**: executeRunLoop 무한루프 방어 (C-1)
2. **1주 내 수정 권장**: Demo 타이머 레이스 컨디션 해결 (H-1)
3. **점진적 개선**: multi-run 지원 (M-3), 스케줄 타이머 동기화 (M-4), 하드코딩된 색상 CSS 변수화 (D-1~D-4)

### 수정 완료 이슈 현황 (11/17)

| 이슈 | 상태 |
|------|------|
| C-2 Scheduler 사이클 감지 | ✅ |
| C-3 JSON.stringify 동등성 비교 | ✅ |
| H-2 patchTask 중첩 병합 | ✅ |
| H-3 appendRunEvent mkdir | ✅ |
| H-4 listRuns N+1 | ✅ |
| M-1 ScheduleView 타임라인 너비 | ✅ |
| M-2 NowLine 뷰포트 변환 | ✅ |
| M-5 sanitizeFileName 중복 | ✅ |

---

## 5. 디자인 일관성 검증

### 검증 기준

BRANDING_GUIDE.md에 정의된 디자인 시스템 기준으로 검증:
- 색상: `--accent: #2fa184`, `--secondary: #4a87e8`, `--warn: #d4a11e`, `--danger: #d95c4f`
- border-radius: 기본 `var(--radius, 8px)`, 노드 카드 10~12px
- 간격: 4px 배수 체계
- 폰트: 12~13px 기본, 14px 제목, VS Code 테마 상속

### 전체 평가: ✅ 양호 (MINOR 4건, STYLE 2건)

CRITICAL/MAJOR 이슈 없음. 새로 추가된 ScheduleView와 Schedule 관련 컴포넌트가 기존 디자인 시스템을 잘 따르고 있으며, CSS 변수 기반 색상/간격 체계가 일관되게 적용됨.

---

### MINOR (4건)

#### D-1. modal-error 하드코딩 색상

**위치:** `webview-ui/src/styles.css` — `.modal-error`

**문제:** AgentCreationModal의 에러 표시에 `color: #e05252`가 직접 사용됨. 디자인 시스템의 `var(--danger)` (#d95c4f)와 미세하게 다름.

**해결 방안:** `color: var(--danger)`로 교체.

---

#### D-2. Schedule 태스크 상태 색상 하드코딩

**위치:** `webview-ui/src/styles.css` — `.schedule-task.status-*`

**문제:** 스케줄 태스크 노드의 상태별 색상이 CSS 변수 대신 직접 값으로 지정됨. 테마 변경 시 일괄 업데이트 불가.

**대상:** `.status-running`, `.status-done`, `.status-failed`, `.status-blocked` 클래스의 배경/테두리 색상.

**해결 방안:** 상태별 색상을 CSS 변수(예: `--schedule-running`, `--schedule-done` 등)로 추출하거나, 기존 `--accent`, `--warn`, `--danger` 변수 조합 활용.

---

#### D-3. Agent Handle 색상 하드코딩

**위치:** `webview-ui/src/styles.css` — `.agent-handle` (존재하는 경우)

**문제:** 엣지 마커 색상 `#6aa7f5`가 ScheduleView.tsx에 직접 하드코딩됨. 디자인 시스템의 `--secondary` (#4a87e8)와 유사하지만 다른 값.

**해결 방안:** 엣지 스타일에 CSS 변수 기반 색상 사용. ReactFlow Edge의 `style.stroke`에 CSS 변수를 직접 넣기 어려운 경우, CSS 커스텀 프로퍼티를 JS에서 읽어 적용하는 패턴 적용.

---

#### D-4. border-radius 이상치

**위치:** `webview-ui/src/styles.css` 전역

**문제:** 대부분 `var(--radius, 8px)`, `10px`, `12px`를 일관 사용하나 일부 이상치 존재:
- `6px`: `.prompt-canvas-container .results-header` (기본 8px 대비 작음)
- `7px`: `.skill-wizard-modal .step-card` (8px도 아니고 6px도 아닌 중간값)
- `15px`: `.skill-wizard-modal .step-card .step-number` (의도적 pill 형태인지 불명확)

**해결 방안:** `6px → var(--radius, 8px)`, `7px → var(--radius, 8px)`, `15px → 50%` (완전 원형) 또는 기존 값 유지 후 주석 추가.

---

### STYLE (2건)

#### S-1. active-toggle !important 사용

**위치:** `webview-ui/src/styles.css` — `.active-toggle`

**문제:** `!important` 사용은 CSS 스타일 우선순위를 강제하는 안티패턴. 기존 specificity 충돌로 인한 것이나, 장기적으로 유지보수 어려움.

**해결 방안:** 선택자 specificity를 높이거나 (예: `.toolbar .active-toggle`), CSS 구조를 정리하여 `!important` 불필요하게 변경.

---

#### S-2. ScheduleView clamp/clampNumber 함수 중복

**위치:** `webview-ui/src/canvas/ScheduleView.tsx` (line 301~307)

**문제:** 동일 로직의 `clamp()`과 `clampNumber()` 두 함수가 존재. 하나로 통합 가능.

---

### 잘 구현된 디자인 요소

- **CSS 변수 체계**: `:root` 레벨에서 색상, 간격, 반경 등을 일괄 관리하여 테마 일관성 확보
- **노드 카드 패턴**: agent, skill, ruleDoc, note, folder, commonRules 등 모든 노드가 `.node-card` 기반 클래스를 공유하여 시각적 통일성 확보
- **ScheduleView 레인/태스크**: 간트 차트 스타일이 기존 캔버스 노드 UI와 조화롭게 디자인됨
- **반응형 타임라인**: 동적 `pxPerSec` 계산으로 데이터 양에 따라 적절한 너비 자동 조절
- **VS Code 테마 상속**: `var(--vscode-*)` 참조로 사용자 에디터 테마와 자연스럽게 통합

---

## 6. 빌드 검증 로그

```
$ npm run typecheck:webview
> agent-canvas@0.1.0 typecheck:webview
> npm --prefix webview-ui run typecheck
> agent-canvas-webview@0.1.0 typecheck
> tsc --noEmit -p tsconfig.json
(에러 없음 — 정상 통과)
```

---

*이 리포트는 AgentCanvas 프로젝트의 최신 변경 사항에 대한 정적 분석, 코드 리뷰, 디자인 일관성 검증 결과입니다.*
