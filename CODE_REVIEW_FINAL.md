# AgentCanvas — 종합 코드 리뷰

**Date**: 2026-02-19
**범위**: Extension Backend (47 files) + Webview UI (44 files) = 91 files 전체 리뷰
**요약**: CRITICAL 12건, HIGH 12건, MEDIUM 16건, LOW 10건 = **총 50건**

---

## 전체 요약

| 영역 | CRITICAL | HIGH | MEDIUM | LOW | 합계 |
|------|----------|------|--------|-----|------|
| Extension Backend | 6 | 8 | 10 | 4 | 28 |
| Webview UI | 6 | 4 | 6 | 6 | 22 |
| **합계** | **12** | **12** | **16** | **10** | **50** |

---

## CRITICAL — 즉시 수정 필요 (12건)

### C-01. CLI 커맨드 인젝션 위험
**파일**: `extension/src/services/cliExecutor.ts` (Line 36-37, 119-120)

사용자 프롬프트가 CLI args에 직접 전달됨. 공격자가 프롬프트를 제어하면 셸 명령 주입 가능.

```typescript
// 문제 코드
if (!input.backend.stdinPrompt) {
  args.push(input.prompt);  // ← 이스케이프 없이 직접 전달
}
```

**수정**: 셸 이스케이프 라이브러리 적용 또는 항상 stdin으로 전달

---

### C-02. memoryStore 동시 쓰기 레이스 컨디션
**파일**: `extension/src/services/memoryStore.ts` (Line 375-382)

`rewriteIndex()`가 읽기→수정→쓰기를 락 없이 수행. 여러 에이전트가 동시에 메모리를 쓰면 데이터 손실 발생.

```typescript
async function rewriteIndex(workspaceRoot, updater) {
  const rows = await readIndex(workspaceRoot);   // Read
  const updated = updater(rows);                  // Modify
  await writeIndexRows(workspaceRoot, updated);   // Write — 락 없음!
}
```

**수정**: `proper-lockfile` 패키지 도입 또는 append-only 방식으로 변경

---

### C-03. runStore JSONL 동시 쓰기 파일 손상
**파일**: `extension/src/services/runStore.ts` (Line 63-86)

`appendRunEvent()`가 JSONL 파일에 동기화 없이 append. Node.js `appendFile`은 동시 호출 시 원자적이지 않아 줄이 섞일 수 있음.

**수정**: 쓰기 큐(직렬화) 구현 또는 `write-file-atomic` 사용

---

### C-04. proposalService 패치 검증 갭
**파일**: `extension/src/services/proposalService.ts` (Line 119-120)

`git apply --check`와 `git apply`가 별도 호출. `--check` 성공 여부를 확인하지 않고 apply 진행.

```typescript
await runGit(["apply", "--check", paths.patchPath], input.workspaceRoot);
await runGit(["apply", paths.patchPath], input.workspaceRoot);  // ← check 실패해도 실행됨
```

**수정**: `--check` 결과를 명시적으로 확인 후 apply 실행

---

### C-05. scheduler 사이클 감지 경로 손실
**파일**: `extension/src/schedule/scheduler.ts` (Line 310)

`findCycleNodes()`가 `[...new Set(cycle)]`로 중복 제거 시 순서 정보 소실. 사용자가 어떤 순환인지 파악 불가.

**수정**: Set 대신 순서 유지, "A → B → C → A" 형태로 반환

---

### C-06. App.tsx useEffect 의존성 누락 (stale closure)
**파일**: `webview-ui/src/App.tsx` (Line 229-230)

Extension 메시지 리스너가 빈 의존성 배열 `[]`로 등록됨. `eslint-disable` 주석으로 경고 무시. 모든 setState 함수가 stale closure로 잡힘.

```typescript
useEffect(() => {
  const dispose = onExtensionMessage((message) => {
    // setState 함수들이 모두 최초 렌더링 시점의 참조
  });
  postToExtension({ type: "READY" });
  return dispose;
// eslint-disable-next-line react-hooks/exhaustive-deps  ← 위험!
}, []);
```

**수정**: eslint-disable 제거, 모든 의존성 명시 추가

---

### C-07. App.tsx 키보드 핸들러 stale closure
**파일**: `webview-ui/src/App.tsx` (Line 272-273)

두 번째 키보드 useEffect도 빈 의존성 배열. `refreshDiscovery`, `saveFlow`, `loadFlow` 등이 stale.

**수정**: 콜백 함수들을 useCallback으로 래핑 후 의존성에 추가

---

### C-08. vscodeBridge 메시지 리스너 중복 등록
**파일**: `webview-ui/src/messaging/vscodeBridge.ts` (Line 42-64)

`ensureBridgeInitialized()`에서 등록한 이벤트 리스너가 제거되지 않음. webview 재초기화 시 리스너 누적 → 메모리 누수 + 중복 메시지 처리.

**수정**: 리스너 참조 저장 + `cleanupBridge()` 함수 추가

---

### C-09. App.tsx 세 번째 키보드 핸들러 의존성 불완전
**파일**: `webview-ui/src/App.tsx` (Line 380)

GraphView 키보드 핸들러의 의존성 배열에 `onSaveNote`, `onOpenCommonRulesFolder`, `onCreateCommonRuleDocs`, `onAddAgentLink` 누락.

**수정**: 누락된 콜백 함수 의존성 추가

---

### C-10. GraphView.tsx 키보드 핸들러 의존성 불완전
**파일**: `webview-ui/src/canvas/GraphView.tsx` (Line 274-392)

100줄 이상의 onKeyDown 핸들러에서 사용하는 콜백 중 `onOpenCommonRulesFolder`, `onCreateCommonRuleDocs` 등이 의존성 배열에 없음.

**수정**: 모든 참조 콜백을 의존성에 추가

---

### C-11. ScheduleView 노드 메모이제이션 의존성 누락
**파일**: `webview-ui/src/canvas/ScheduleView.tsx` (Line 91-150)

useMemo 의존성에 `laneOrder`, `laneIndex`, `timelineWidth`, `pxPerSec`가 없음. 계산된 값이 변해도 노드가 업데이트 안 될 수 있음.

**수정**: 누락된 의존성 추가 또는 내부에서 계산하도록 리팩터링

---

### C-12. RightPanel Inspector 탭 강제 리셋
**파일**: `webview-ui/src/panels/RightPanel.tsx` (Line 110-115)

노드 선택이 바뀔 때마다 Inspector 탭이 "overview"로 리셋됨. 사용자가 "variables" 탭에서 작업 중이어도 강제 전환됨.

**수정**: 모드 변경 시에만 리셋, 노드 변경 시에는 현재 탭 유지

---

## HIGH — 빠른 수정 권장 (12건)

### H-01. 샌드박스 심볼릭 링크 우회
**파일**: `sandboxService.ts` (Line 127-131)

`resolveWorkspacePath()`가 심볼릭 링크를 해석하지 않음. 심볼릭 링크로 샌드박스 탈출 가능.

**수정**: `fs.realpathSync()` 적용 후 경로 검증

---

### H-02. memoryStore JSON 파싱 스키마 검증 없음
**파일**: `memoryStore.ts` (Line 360)

`JSON.parse(line) as IndexRow` — 타입 캐스팅만 있고 실제 스키마 검증 없음. 손상된 인덱스가 런타임 에러 유발.

**수정**: zod 스키마 검증 추가

---

### H-03. configService 로드 시 자동 저장
**파일**: `configService.ts` (Line 40-41)

`loadConfig()`가 normalize 후 자동으로 파일에 저장. 사용자 의도와 무관하게 설정 덮어쓰기.

**수정**: 로드는 읽기 전용으로 변경

---

### H-04. scheduleService deepEqual 순환 참조 오판
**파일**: `scheduleService.ts` (Line 312-320)

WeakMap 기반 순환 감지에서 이미 비교한 쌍을 `true`로 반환. 다른 구조의 순환 참조를 동일하다고 오판 가능.

**수정**: JSON.stringify 비교 또는 깊이 제한 적용

---

### H-05. extension.ts 전역 상태 미정리
**파일**: `extension.ts` (Line 93)

`panelController`가 모듈 레벨 변수. 여러 패널 열면 이전 참조 유실. 정리(dispose) 없음.

**수정**: Map<panelId, controller> + dispose 처리

---

### H-06. proposalService 패치 파싱 취약
**파일**: `proposalService.ts` (Line 225-238)

regex 기반 파일 변경 목록 추출. 바이너리 파일, 이름 변경, 복사 등 미감지.

**수정**: `parse-diff` 패키지 또는 `git diff --stat` 활용

---

### H-07. memoryExtractor regex 기반 파일 감지
**파일**: `memoryExtractor.ts` (Line 97-99)

태스크 출력에서 파일 경로를 regex로 추출. 유니코드 이름, 인용 경로 등 미감지.

**수정**: 명시적 파일 변경 목록을 인자로 전달

---

### H-08. discovery 폴백 에이전트 불완전
**파일**: `discovery.ts` (Line 146-156)

폴백 에이전트에 runtime, systemPrompt 누락. 실행 시 백엔드 선택 실패 가능.

**수정**: 폴백에도 완전한 runtime 기본값 설정

---

### H-09. RunPanel/MoveTask 레이스 컨디션
**파일**: `App.tsx` (Line 1414-1426)

`pinScheduleTask`, `moveScheduleTask`가 fire-and-forget. `scheduleRunId` 변경 시 잘못된 런에 적용 가능.

**수정**: requestToExtension으로 변경 + runId 검증

---

### H-10. ScheduleView 노드 전체 재생성
**파일**: `ScheduleView.tsx` (Line 91-150)

nowMs 변경마다 모든 task 노드가 재생성됨. 대규모 스케줄에서 성능 저하.

**수정**: nowMs와 task 노드를 분리 메모이제이션

---

### H-11. AgentNode/SkillNode 키보드 접근성 누락
**파일**: `canvas/nodes/AgentNode.tsx` (Line 67-75)

`tabIndex={0}`, `role="button"` 있지만 `onKeyDown` (Space/Enter) 핸들러 없음.

**수정**: 키보드 이벤트 핸들러 추가

---

### H-12. RightPanel JSON 파싱 에러 처리 미흡
**파일**: `RightPanel.tsx` (Line 543-544)

`JSON.parse(dataText)` 후 타입 캐스팅만 수행. 잘못된 형식이면 런타임 에러.

**수정**: try-catch + 유효성 검증

---

## MEDIUM — 개선 권장 (16건)

| # | 파일 | 이슈 |
|---|------|------|
| M-01 | `promptBuilder.ts` (23-103) | 토큰 오버플로우 감지 없음. 모델 컨텍스트 초과 가능 |
| M-02 | `contextPacker.ts` (7) | DEFAULT_BUDGET_TOKENS 하드코딩. 설정에서 읽도록 변경 |
| M-03 | `reviewGate.ts` (55-58) | 알 수 없는 decision을 "revise"로 기본 처리. 에러 throw 권장 |
| M-04 | `collaborationLogger.ts` (133) | JSON 문자열 160자 자르기 → 잘못된 JSON 생성 |
| M-05 | `costCalculator.ts` (12-16) | 가격 하드코딩. 외부 설정으로 이동 필요 |
| M-06 | `pinStore.ts` (전체) | 핀 만료(TTL) 없음. 무한 디스크 증가 |
| M-07 | `memoryQuery.ts` (133-138) | `text.length / 4` 나이브 토큰 추정. 30%+ 오차 |
| M-08 | `agentProfileService.ts` (139-160) | 프로필 패치 시 스키마 검증 없음 |
| M-09 | `discovery.ts` (271-278) | 엣지 중복 시 데이터 손실 (무시 처리) |
| M-10 | `runStore.ts` (18-20) | RunID 엔트로피 32bit. 충돌 가능. `crypto.randomUUID()` 권장 |
| M-11 | `vscodeBridge.ts` (94-107) | 컴포넌트 언마운트 시 pending 요청 미정리 → 메모리 누수 |
| M-12 | `App.tsx` (145-147) | schedule 상태가 state + ref 혼합. 추론 어려움 |
| M-13 | `CommandBar.tsx` (57) | debouncedQuery 변경 시 selectedIndex 리셋 중복 로직 |
| M-14 | `AgentDetailModal.tsx` (104-106) | useEffect 내부에서 정의한 함수로 이벤트 리스너 등록/해제 — 정상 작동하나 리마운트 시 누수 가능 |
| M-15 | `App.tsx` (314-340) | composedSnapshot useMemo — patternNodes 변경마다 전체 재계산 |
| M-16 | `RightPanel.tsx` (전체) | 100+ props 전달. React Context로 리팩터링 권장 |

---

## LOW — 참고 (10건)

| # | 파일 | 이슈 |
|---|------|------|
| L-01 | `types.ts` (431) | Task.deps 타입에 optional 마커 없으나 코드에서 undefined 체크 |
| L-02 | `pathUtils.ts` | sanitizeFileName() 호출 불일관. 경로 생성 전 전수 검사 필요 |
| L-03 | `cliExecutor.ts` (40-44) | maxBuffer 미설정. 기본 1MB vs proposalService 16MB 불일치 |
| L-04 | `memoryExtractor.ts` (93) | 메모리 추출 최대 3개 하드코딩. 설정 가능하게 변경 |
| L-05 | `configService.ts` (57-87) | 파일 워처 실패 시 무시. 에러 로깅 추가 |
| L-06 | GraphView, RightPanel 등 | 인라인 콜백에 useCallback 미적용. 불필요한 리렌더링 |
| L-07 | `RightPanel.tsx` (212-221) | 대규모 스킬 리스트에 가상화(react-virtual) 미적용 |
| L-08 | `App.tsx` (2020-2024) | Toast가 onAnimationEnd 의존. 애니메이션 미발생 시 toast 미삭제 |
| L-09 | 노드 컴포넌트 전체 | 일부 icon 버튼에 aria-label 누락 |
| L-10 | `ErrorBoundary.tsx` | 앱 전체에만 적용. Canvas, Modal, RightPanel 별도 ErrorBoundary 권장 |

---

## 수정 우선순위 로드맵

### 즉시 (1~2일)

| 이슈 | 수정 | 예상 시간 |
|------|------|-----------|
| C-01 | cliExecutor 셸 이스케이프 적용 | 2시간 |
| C-06, C-07, C-09, C-10 | App.tsx useEffect 의존성 수정 (4곳) | 3시간 |
| C-08 | vscodeBridge cleanup 함수 추가 | 1시간 |
| C-12 | RightPanel Inspector 탭 리셋 조건 수정 | 30분 |
| H-01 | sandboxService에 realpathSync 추가 | 1시간 |
| H-03 | configService loadConfig 읽기 전용화 | 30분 |

### 이번 주 (3~5일)

| 이슈 | 수정 | 예상 시간 |
|------|------|-----------|
| C-02, C-03 | memoryStore + runStore 쓰기 직렬화 (파일 락) | 1일 |
| C-04 | proposalService --check 결과 확인 로직 | 2시간 |
| C-05 | scheduler 사이클 경로 순서 유지 | 1시간 |
| C-11 | ScheduleView useMemo 의존성 수정 | 1시간 |
| H-02 | memoryStore zod 스키마 검증 | 3시간 |
| H-04 | scheduleService deepEqual 수정 | 2시간 |
| H-05 | extension.ts 패널 Map + dispose | 2시간 |
| H-11 | 노드 컴포넌트 키보드 접근성 | 2시간 |

### 다음 스프린트 (1~2주)

| 이슈 | 수정 | 예상 시간 |
|------|------|-----------|
| M-01 | promptBuilder 토큰 카운팅 추가 | 0.5일 |
| M-07 | memoryQuery 토큰 추정 개선 | 0.5일 |
| M-10 | runStore UUID 적용 | 1시간 |
| M-16 | RightPanel Context 리팩터링 | 1일 |
| L-10 | ErrorBoundary 세분화 | 0.5일 |

---

## 아키텍처 소견

### 잘된 점
- **파일 기반 영속화** (JSONL + JSON) — 간결하고 디버깅 용이
- **Extension ↔ Webview 메시지 프로토콜** — 타입 안전, request/response 패턴 잘 구현
- **Sandbox 격리** — input/work/proposal 3단계 분리 우수
- **React Flow 활용** — GraphView + ScheduleView 이중 캔버스 구조 적절
- **Schedule Service** — topological sort + 이벤트 스트림 설계 안정적
- **서비스 분리** — 47개 파일이 각자 단일 책임 유지

### 개선 필요
- **동시성 처리**: 파일 I/O에 전반적으로 락/큐 부재 (C-02, C-03)
- **React 의존성 관리**: eslint-disable로 stale closure 방치 (C-06~C-10)
- **입력 검증**: 외부 입력(프롬프트, JSON, 패치)에 대한 검증 불충분
- **에러 전파**: fire-and-forget 패턴이 많아 실패 추적 어려움
- **Props 과다**: RightPanel 100+ props → Context/Store 도입 시급

---

*AgentCanvas Code Review — 2026-02-19*
*Extension 47 files + Webview 44 files = 91 files reviewed*
