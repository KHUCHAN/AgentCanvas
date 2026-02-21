# AgentCanvas Fix Report (2026-02-20)

## Scope
요청된 3개 문제 + 관련 재발 방지 패치

1. Rebuild 시 이전 Agent가 남아있는 문제
2. Orchestration 실행 시 Gemini 입력 오류 (`No input provided via stdin ... use --prompt`)
3. Rebuild 이후 사용량(Usage) 반영이 부정확한 문제

추가로, 콘솔에 반복 노출되던 passive listener warning도 함께 정리함.

---

## 1) Rebuild stale agent cleanup

### 문제
`overwriteExisting=true`로 Rebuild를 해도, 새 구조에 없는 기존 custom agent가 디스크에 남아서 캔버스에 계속 재등장함.

### 수정
- Rebuild 시작 시(`overwriteExisting=true`):
  - 새 구조(`structure.agents`)에 없는 기존 `custom:*` agent profile을 삭제
  - 삭제된 agent를 참조하는 agent link(edge)도 정리
- 이후 생성/업데이트 단계 진행

### 수정 파일
- `extension/src/extension.ts`
  - `applyGeneratedStructure(...)`

---

## 2) Gemini orchestration stdin 오류 수정

### 문제
Gemini CLI 실행 시 prompt 전달 방식이 CLI 기대와 불일치하여 아래 오류 발생:

`No input provided via stdin. Input can be provided by piping data into gemini or using the --prompt option.`

### 수정
- Gemini invocation을 항상 `--prompt <text>` 방식으로 전달
- Gemini base args 정규화 시 기존 `--prompt`, `-p`, `--prompt=...` 중복 인자 제거
- `--` 토큰도 Gemini 경로에서 제거

### 수정 파일
- `extension/src/services/cliExecutor.ts`

---

## 3) Rebuild 이후 Usage 반영 개선

### 문제
Team apply/rebuild 직후 UI usage가 즉시 최신화되지 않는 케이스 존재.

### 수정
- `APPLY_GENERATED_STRUCTURE` / `REAPPLY_PROMPT_HISTORY` 완료 후:
  - backend 재탐지
  - `publishBackendUsageUpdate(...)` 즉시 실행
- UI가 최신 usage summary를 바로 수신하도록 보강

### 수정 파일
- `extension/src/extension.ts`

---

## 4) Gemini 모델 목록 최신군 정렬/갱신

### 목적
드롭다운에 구형 모델이 보이는 문제를 줄이고 최신 라인업 중심으로 표시.

### 반영 모델
- `gemini-2.5-pro`
- `gemini-2.5-flash`
- `gemini-2.5-flash-lite`
- `gemini-2.0-flash`
- `gemini-2.0-flash-lite`

### 수정 파일
- `extension/src/services/backendProfiles.ts`
- `extension/src/services/backendModelPoller.ts`
- `webview-ui/src/utils/modelOptions.ts`
- `extension/src/services/configService.ts` (latest alias 정규화)
- `extension/src/services/costCalculator.ts` (pricing/alias)
- `scripts/integration-tests.cjs` (model coverage 검증 보강)

---

## 5) Passive listener warning 완화

### 문제
Webview console에 반복 출력:
`Unable to preventDefault inside passive event listener invocation.`

### 수정
- Graph canvas wheel handler에서 `preventDefault()` 호출 제거, `stopPropagation()` 사용
- ReactFlow에 `preventScrolling={false}` 설정
- Graph에서 `panOnScroll={false}` 명시
- ScheduleView에도 `preventScrolling={false}` 적용

### 수정 파일
- `webview-ui/src/canvas/GraphView.tsx`
- `webview-ui/src/canvas/ScheduleView.tsx`

참고: `Unleash ... 502`는 VS Code/Antigravity 쪽 feature-toggle 네트워크 오류로 AgentCanvas 앱 로직과 직접 무관.

---

## 6) Status command 오인식 수정

### 문제
`진행`, `progress` 같은 단어가 일반 작업 요청에 포함되면 상태조회로 오인되어  
`No active tasks right now...` 응답이 나오는 문제.

### 수정
- 상태조회 트리거를 명시 명령으로 제한:
  - `status`, `/status`, `progress`, `/progress`, `state`, `/state`, `상태`, `/상태`
  - 위 명령 + 공백 뒤 파라미터 형태(`status xxx`)만 허용
- 일반 요청 문장에 포함된 `진행` 키워드는 상태조회로 처리하지 않음

### 수정 파일
- `extension/src/services/chatOrchestrator.ts`

---

## 7) Gemini 모델 목록 우선순위 보정

### 문제
동적(model poller) 결과가 fallback을 완전히 덮어써 최신 모델이 UI에서 밀릴 수 있음.

### 수정
- model catalog 구성 시 `fallback(큐레이션 최신군) + dynamic` 병합
- 동일 model id는 dedupe
- 결과적으로 최신 모델군이 항상 드롭다운 상단에서 유지됨

### 수정 파일
- `extension/src/services/backendModelPoller.ts`

---

## Verification

실행 결과(모두 통과):
- `npm run build:extension`
- `npm run build:webview`
- `npm run test:integration`

통합 테스트 항목 포함:
- Backend profile 최신 모델 커버리지
- CLI invocation 빌더 (Claude/Codex/Gemini)
- Flow/Run/Schedule/Pin/Sandbox roundtrip

---

## Quick manual checks

1. Rebuild
- 기존 팀이 있는 상태에서 Rebuild 실행
- 새 구조에 없는 custom agent가 자동 제거되는지 확인

2. Orchestration with Gemini
- Orchestrator backend를 Gemini로 고정 후 Chat 실행
- stdin 관련 오류 없이 응답 생성되는지 확인

3. Usage refresh
- Rebuild/Apply 직후 우측 usage/preview에 callCount/cost 반영 확인

4. Console warnings
- Graph에서 Ctrl/Cmd + wheel 동작 시 passive warning 반복 감소 확인
