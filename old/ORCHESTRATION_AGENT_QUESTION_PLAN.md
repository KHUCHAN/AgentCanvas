# Orchestration-First Agent Question Flow Implementation Plan

## 1) 목적

사용자 요구사항을 다음 구조로 완성한다.

1. 사용자와의 대화는 오직 **Orchestrator**가 담당한다.
2. Worker Agent가 막히거나 확인이 필요하면 사용자에게 직접 묻지 않고 **Orchestrator에게 질문을 올린다**.
3. 사용자에게는 해당 질문이 **Canvas 더블클릭 동선에서 바로 보이도록** 노출된다.
4. 사용자가 답변하면 해당 Task가 안전하게 재개된다.
5. Canvas에서 **Task 더블클릭 시 agent와 orchestrator가 해당 task에서 주고받은 전체 대화**를 볼 수 있어야 한다.

---

## 2) 현재 상태 요약

현재 코드에는 기초 기능이 이미 있다.

1. Worker 출력에서 `[NEED_HUMAN: ...]`를 감지해 Task를 `blocked` 처리함.
2. `pendingHumanQueryByTaskId` 맵으로 질문 대기 상태를 보관함.
3. `CHAT_SEND` 또는 `HUMAN_QUERY_RESPONSE`로 답변 시 Task를 `ready`로 복구함.
4. Agent 더블클릭 이벤트는 존재하지만, 질문 전용 UI로 이어지지 않고 AgentDetail로만 연결됨.
5. `human_query` 메시지 타입은 정의되어 있으나, 채팅 렌더러에서 전용 렌더링이 없음.
6. Task 상세에서 agent↔orchestrator 대화 전체를 보여주는 전용 transcript 탭/데이터 모델이 없음.

즉, 백엔드 핵심 로직은 일부 구현되어 있지만 **사용자에게 보이는 UX 경로가 미완성**이다.

---

## 3) 목표 동작(완성 상태)

### 3.1 기본 시나리오

1. Worker가 작업 중 질문 필요 상황 발생
2. Worker가 Orchestrator 규약으로 질문 생성
3. Orchestrator가 Task를 `blocked(input)`로 전환하고 질문 이벤트를 기록
4. Canvas에서 해당 Agent/Task에 “질문 대기” 상태가 명확히 표시됨
5. 사용자가 Canvas에서 **Task를 더블클릭**하면 질문/맥락/답변 입력 UI와 agent↔orchestrator 전체 대화를 바로 확인
6. 답변 제출 시 `HUMAN_QUERY_RESPONSE`로 백엔드 반영
7. Task가 `ready`로 전환되고 기존 실행 루프가 재개
8. 채팅/이벤트 로그에 “질문 요청/답변/재개” 이력이 남음

### 3.2 설계 원칙

1. 사용자와의 상호작용 단일 창구는 Orchestrator
2. 질문은 구조화된 이벤트로 남겨 재현 가능해야 함
3. UI는 “어디서 막혔는지”를 더블클릭 한 번으로 확인 가능해야 함
4. 다중 질문/다중 태스크 상황에서도 어떤 답변이 어떤 Task로 들어갔는지 식별 가능해야 함

---

## 4) 범위(Scope)

### In Scope

1. Human query 포맷/검출/이벤트 표준화
2. Canvas 더블클릭에서 질문 확인 UX 연결
3. 사용자 답변 제출 UX 및 재개 처리
4. 채팅/이벤트 타임라인 노출 강화
5. 회귀 테스트 추가

### Out of Scope (이번 단계 제외)

1. 멀티유저 동시 편집 충돌 해결
2. 외부 알림 시스템(슬랙/이메일) 연동
3. 장기 메모리 자동 요약 고도화

---

## 5) 변경 설계 상세

## 5.1 백엔드(Extension) 변경

### A. 질문 포맷 표준화

목표: **Orchestrator 프롬프트에만** `NEED_HUMAN` 규약을 주입하고, 사용자 질의 요청 포맷을 단일화.

1. Orchestrator 시스템 지시문에 명시:
   - "사용자 답변이 필요하면 반드시 `[NEED_HUMAN: <question>]` 형식으로만 출력"
2. Worker 프롬프트에는 해당 강제 지시를 넣지 않음(오케스트레이터 전용 규칙).
3. 런타임 감지 포맷은 1차 기준 `[NEED_HUMAN: ...]` 단일 표준으로 운영.
4. 파서 함수 분리:
   - `parseHumanQuery(output: string): { question: string } | undefined`
5. 런타임 감지 적용 범위는 Orchestrator 실행 컨텍스트로 제한(Worker 출력은 사용자 질의 트리거로 승격하지 않음).
6. 감지 성공 시:
   - Task `blocked`
   - blocker.kind = `input`
   - pending map 저장
   - run event/collab event 기록
   - chat message(`human_query`) append

### E. Task별 Agent↔Orchestrator 대화 추적 저장

목표: Task 더블클릭 시 해당 Task의 양방향 대화를 모두 조회 가능하게 함.

1. Task 실행 중 오케스트레이터 발화/지시를 taskId 기준으로 이벤트화
2. Worker 출력(스트리밍 포함)을 taskId 기준으로 agent 메시지로 정규화
3. 저장 단위:
   - `runId + taskId + turnIndex`
   - `role(orchestrator|agent)`
   - `content`
   - `timestamp`
4. 조회 API:
   - `GET_TASK_CONVERSATION { runId, taskId }`
   - 반환: 시간순 transcript 배열

### B. pending query 저장 구조 강화

현재: `Map<taskId, {question, runId}>`

개선:

1. `createdAt`, `agentId`, `nodeId`, `messageId` 포함
2. 조회 API 추가:
   - run 기준 조회
   - agent 기준 조회
3. 답변 처리 시 상태 전이 로그 추가:
   - `human_query_answered`
   - `task_resumed`

### C. 답변 라우팅 안정화

현재 `CHAT_SEND`는 run 내 첫 pending 항목에 답변을 매핑할 수 있어 모호성 있음.

개선:

1. 우선순위:
   - 명시적 `HUMAN_QUERY_RESPONSE(runId, taskId, answer)` 우선
2. `CHAT_SEND` 자동 매핑은 한 개 pending일 때만 허용
3. 두 개 이상 pending이면 자동 매핑 금지 + Orchestrator 안내 메시지 반환

### D. 협업 이벤트 타입 확장

`COLLAB_EVENT`에 다음 이벤트 타입 추가:

1. `human_query_requested`
2. `human_query_answered`
3. `task_resumed_after_human_query`

이로써 RunPanel/타임라인에서 질문 흐름 추적 가능.

---

## 5.2 프로토콜 변경 (extension/messages + webview/messaging)

### A. Chat content 렌더 대상 정합성

기존 `human_query`는 타입만 있고 UI 렌더 미구현.

작업:

1. `ChatMessageContent`의 `human_query` 유지
2. `ChatMessageList`에서 `human_query` 카드 렌더 분기 추가
3. 카드에서 답변 입력 + 제출 액션 제공

### B. 요청/응답 메시지

현재 `HUMAN_QUERY_RESPONSE`는 이미 있음.

추가 권장:

1. `GET_PENDING_HUMAN_QUERIES` (선택)
2. `PENDING_HUMAN_QUERIES` push message (선택)
3. `GET_TASK_CONVERSATION` / `TASK_CONVERSATION` (Task 더블클릭 transcript 조회용)

선택 기능은 2차로 미뤄도 됨. 1차는 스케줄 Task의 blocker/meta로 충분히 구현 가능.

---

## 5.3 프론트엔드(Webview UI) 변경

### A. Chat 패널

목표: 질문이 채팅에 올라오면 사용자가 즉시 답변 가능.

작업:

1. `ChatMessageList`에 `human_query` 카드 컴포넌트 추가
2. 카드 정보:
   - taskId
   - question
   - runId
3. 카드 액션:
   - 답변 textarea
   - “Send answer” 버튼
   - 제출 시 `HUMAN_QUERY_RESPONSE`

### B. Canvas Task 더블클릭 동선

목표: “Canvas에서 Task 더블클릭하면 질문 + agent↔orchestrator 전체 대화를 본다”를 만족.

권장 UX:

1. Kanban/Schedule에서 Task 더블클릭 시 `TaskDetailModal` 오픈(기존 동선 유지)
2. `TaskDetailModal`에 `Conversation` 탭 추가
3. `Conversation` 탭에서 해당 task의 agent↔orchestrator 전 대화(turn-by-turn) 표시
4. 같은 화면에서 `HUMAN_QUERY_RESPONSE` 제출 가능하게 연결

### C. Kanban / Schedule / Run 패널

목표: 질문 대기 상태를 빠르게 발견.

작업:

1. Kanban blocked 카드에 질문 아이콘 + 질문 문구 요약
2. Schedule task tooltip/메타에 blocker 질문 노출
3. RunPanel 타임라인에 `human_query_*` 이벤트 카드 노출

### D. TaskDetailModal 강화

작업:

1. `events` 탭에서 human_query 관련 이벤트 하이라이트
2. output 탭 상단에 “Pending question” 박스 표시(존재 시)
3. `Conversation` 탭 신설: agent↔orchestrator 전체 대화 표시
4. 즉답 입력 action 제공(선택)

---

## 6) 파일 단위 작업 목록

### 백엔드

1. `extension/src/extension.ts`
   - human query 파서 호출 분리
   - orchestrator 프롬프트에만 `[NEED_HUMAN]` 지시 주입
   - pending query 저장 구조 확장
   - task conversation 이벤트 누적/조회 핸들러 추가
   - `CHAT_SEND` 자동 매핑 안전장치
   - collab event 확장 emit
2. `extension/src/messages/protocol.ts`
   - collab 이벤트 타입 확장
   - `GET_TASK_CONVERSATION` / `TASK_CONVERSATION` 메시지 타입 추가
3. `extension/src/services/promptBuilder.ts`
   - Orchestrator 지시문에 `[NEED_HUMAN: <question>]` 규칙 명시
   - Worker 지시문에는 해당 규칙 미삽입

### 프론트엔드

1. `webview-ui/src/panels/ChatMessageList.tsx`
   - `human_query` 렌더 분기 추가
2. `webview-ui/src/panels/ChatPanel.tsx`
   - 답변 제출 핸들러 전달
3. `webview-ui/src/App.tsx`
   - `HUMAN_QUERY_RESPONSE` request 핸들러 연결
   - `GET_TASK_CONVERSATION` 요청/응답 상태 관리
   - 필요 시 pending query 파생 상태 계산
4. `webview-ui/src/panels/TaskDetailModal.tsx`
   - `Conversation` 탭 추가
   - task transcript 렌더링
   - 답변 입력 액션 연결
5. `webview-ui/src/views/KanbanView.tsx`
   - blocked 질문 요약 표시
6. `webview-ui/src/canvas/ScheduleView.tsx`
   - blocker 질문 표시 강화
7. `webview-ui/src/panels/RunPanel.tsx`
   - human_query 협업 이벤트 카드 표시
8. `webview-ui/src/messaging/protocol.ts`
   - 타입 동기화

---

## 7) 단계별 실행 계획

## Phase 1: Protocol + Backend Stabilization

목표: 질문 감지/저장/재개를 안정화.

1. human query 파서 함수 도입
2. pending map 구조 확장
3. 답변 라우팅 안전장치(`CHAT_SEND` ambiguity 처리)
4. run/collab event 추가

완료 기준:

1. 단일 질문 시 답변 후 정상 재개
2. 다중 질문 시 잘못된 task 매핑이 발생하지 않음
3. run log에서 질문 생성/답변/재개가 식별됨

## Phase 2: Chat UX Completion

목표: 채팅 패널에서 질문 확인/답변 가능.

1. `human_query` 카드 렌더
2. 답변 전송 버튼 연결
3. 전송 성공/실패 토스트 처리

완료 기준:

1. 질문이 채팅에 보임
2. 카드에서 바로 답변 가능
3. 답변 후 상태가 blocked -> ready(->running)로 전이

## Phase 3: Canvas Double-Click UX

목표: 사용자 요구 핵심인 Canvas 더블클릭 확인 동선 완성.

1. Task 더블클릭 시 `TaskDetailModal` 오픈 흐름을 단일 진입점으로 확정
2. `TaskDetailModal`에 `Conversation` 탭 추가
3. 해당 task의 agent↔orchestrator 전체 대화 표시
4. 질문 답변 액션을 동일 모달에서 제공

완료 기준:

1. Canvas에서 task 더블클릭 후 질문 + 전체 대화 확인 가능
2. 모달에서 답변 제출 시 task 재개 가능
3. 대화 내역이 시간순으로 누락 없이 표시됨

## Phase 4: Visibility + Polish

목표: 상태 가시성 및 운영 추적성 강화.

1. Kanban/Schedule/RunPanel 표시 강화
2. collab 이벤트 UI 반영
3. empty/loading/error 상태 정리

완료 기준:

1. 막힌 이유를 화면 어디서든 빠르게 확인 가능
2. run 타임라인에 질문 lifecycle 표시

---

## 8) 테스트 계획

## 8.1 단위 테스트

1. human query 파서
   - `[NEED_HUMAN: ...]` 정상 추출
   - malformed 포맷 무시
2. orchestrator-only 지시 주입
   - orchestrator prompt에는 `[NEED_HUMAN]` 지시 포함
   - worker prompt에는 `[NEED_HUMAN]` 지시 미포함
3. 자동 매핑 가드
   - pending 1개: 자동 매핑 허용
   - pending 2개 이상: 자동 매핑 차단
4. task conversation 집계
   - 동일 task의 orchestrator/agent turn 순서 보장

## 8.2 통합 테스트

1. Worker 질문 -> blocked -> 답변 -> 재개
2. 다중 worker 동시 질문 시 정확한 taskId 라우팅
3. run replay 시 human query 이벤트 재현 확인
4. task transcript 조회 시 orchestrator/agent 전체 대화 반환 확인

## 8.3 UI E2E 시나리오

1. Chat 카드에서 답변 제출
2. Canvas Task 더블클릭 -> Conversation 탭에서 전체 대화 확인
3. TaskDetail에서 질문 이벤트 + 답변 액션 확인
4. RunPanel 타임라인에서 질문 lifecycle 확인

---

## 9) 리스크 및 대응

1. 리스크: 질문 포맷이 모델별로 흔들림  
   대응: 다중 패턴 파서 + 프롬프트 표준화 + fallback 로그

2. 리스크: 자동 매핑 오답변 삽입  
   대응: 다중 pending 시 자동 매핑 금지

3. 리스크: UI 복잡도 증가  
   대응: 1차는 최소 카드/섹션 방식으로 적용, 별도 대시보드는 2차

4. 리스크: 기존 더블클릭 UX 충돌  
   대응: 기존 AgentDetail 흐름 유지 + 내부 섹션 확장 방식 채택

---

## 10) 수용 기준 (Acceptance Criteria)

1. Worker 질문이 Orchestrator를 통해서만 사용자에게 노출된다.
2. 질문 발생 시 해당 Task는 `blocked(input)`로 전환되고 질문 텍스트가 보인다.
3. Orchestrator 프롬프트에만 `[NEED_HUMAN: <question>]` 형식 규칙이 주입된다.
4. Canvas Task 더블클릭 경로에서 사용자가 질문과 agent↔orchestrator 전체 대화를 확인할 수 있다.
5. 사용자가 답변하면 정확한 Task에 반영되고 실행이 재개된다.
6. 질문 요청/답변/재개가 이벤트 로그와 UI 타임라인에서 추적 가능하다.

---

## 11) 구현 우선순위 제안

1. `Phase 1` + `Phase 2` 먼저 완료 (기능 정상화)
2. 이후 `Phase 3`로 Canvas 더블클릭 UX 완성
3. 마지막 `Phase 4`로 시각적 가시성/운영성 마감

이 순서가 가장 빠르게 사용자 체감 문제를 해결한다.
