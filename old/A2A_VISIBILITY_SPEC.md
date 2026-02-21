# AgentCanvas — A2A 가시화 개발 지시서

**Date**: 2026-02-19
**목적**: 에이전트 간 소통(A2A)을 사용자에게 투명하게 보여주는 시스템 구현

---

## 1. 현재 상태

AgentCanvas는 이미 다음을 갖추고 있다:

- `executeRunLoop` (extension.ts) — 태스크별 CLI 실행
- `runStore.ts` — RunEvent JSONL 저장 (`.agentcanvas/runs/<flow>/<runId>.jsonl`)
- `sandboxService.ts` — 워커 격리 (input/work/proposal)
- `proposalService.ts` — git diff 생성 + git apply 적용
- `RunEvent.usage` — 토큰 메트릭 필드 (types.ts UsageMetrics)
- `ScheduleView` + `KanbanView` — 태스크 상태 시각화

**없는 것**: 에이전트 간 메시지 흐름의 가시화, announce 메커니즘, provenance 구분, 협업 로그 UI

---

## 2. 구현할 3겹 가시화 레이어

### Layer A — 이벤트 카드 (실시간)

에이전트가 무엇을 시키고 받았는지를 UI에서 실시간 스트리밍.

현재 RunPanel.tsx에 이벤트 목록이 있지만, 단순 텍스트 나열 수준이다. 이를 **카드 형태**로 확장:

| 카드 유형 | 표시 내용 | 발생 시점 |
|-----------|-----------|-----------|
| `task_dispatched` | 오케스트레이터 → 워커 지시 내용 | executeRunLoop에서 태스크 시작 |
| `proposal_submitted` | 워커 → 오케스트레이터 패치 요약 | proposalService.createProposal 완료 |
| `proposal_reviewed` | 적용/거절/수정요청 + 사유 | proposalService.applyProposal 완료 |
| `announce` | 워커 결과 요약 (사용자용) | 태스크 done 전환 |

### Layer B — Announce (결과 보고)

워커가 끝나면 오케스트레이터에게 **구조화된 결과**를 보고. 오케스트레이터가 검토 후 사용자에게 공개.

```
Worker 완료
  → announce(internal): 패치 + 요약 + 테스트 결과 → 오케스트레이터
  → 오케스트레이터 검토: apply / reject / revise
  → announce(user): 승인된 변경만 사용자에게 표시
```

핵심: **자동 적용 금지**. 반드시 오케스트레이터 승인 게이트를 거침.

### Layer C — 세션 트랜스크립트 탐색

사용자가 원하면 각 워커의 내부 작업 로그를 펼쳐볼 수 있다.

- 기존 `.agentcanvas/runs/<flow>/<runId>.jsonl` 활용
- 워커별 sandbox 내 작업 이력을 별도 JSONL로 분리

---

## 3. 타입 추가

**파일**: `extension/src/types.ts`

```typescript
// 이벤트 출처 구분
export type EventProvenance =
  | "user_input"              // 사용자가 직접 입력
  | "orchestrator_to_worker"  // 오케스트레이터 → 워커 지시
  | "worker_proposal"         // 워커 → 오케스트레이터 proposal
  | "announce_internal"       // 워커 완료 보고 (내부)
  | "announce_user"           // 사용자에게 공개된 결과
  | "system";                 // 시스템 자동 생성

// 기존 RunEvent 확장
export interface RunEvent {
  // ... 기존 필드 유지 ...
  provenance?: EventProvenance;     // 신규
  parentRunId?: string;             // 신규: 부모 런 ID (워커→오케스트레이터 추적)
  actor?: string;                   // 신규: 이벤트 생성 주체 agentId
}

// Announce 메시지 구조
export interface AnnounceMessage {
  runId: string;
  workerId: string;
  workerName: string;
  status: "ok" | "error" | "timeout";
  summary: string;                  // 사용자용 1~3줄 요약
  proposalPath?: string;            // proposal.json 경로
  touchedFiles: string[];
  testsRun?: { passed: number; failed: number };
  durationMs: number;
}

// 오케스트레이터 검토 결과
export type ReviewDecision = "apply" | "reject" | "revise";

export interface ProposalReview {
  runId: string;
  taskId: string;
  decision: ReviewDecision;
  reason?: string;                  // 거절/수정 시 사유
  appliedAt?: number;               // apply 성공 시 타임스탬프
}
```

---

## 4. 서비스 구현

### 4.1 announceService.ts (신규)

**파일**: `extension/src/services/announceService.ts`

```
역할: 워커 완료 시 announce 메시지 생성 + 오케스트레이터 전달 + 사용자 노출

buildAnnounce(input: {
  runId: string,
  task: Task,
  agent: AgentProfile,
  proposal: CreateProposalResult,
  durationMs: number
}) → AnnounceMessage

- proposal.changedFiles에서 touchedFiles 추출
- proposal.summary에서 사용자용 요약 생성
- status 판단: proposal 생성 성공 → "ok", 실패 → "error"
```

### 4.2 reviewGate.ts (신규)

**파일**: `extension/src/services/reviewGate.ts`

```
역할: 오케스트레이터 승인 게이트

reviewProposal(input: {
  runId: string,
  taskId: string,
  announce: AnnounceMessage,
  autoApprove?: boolean       // 설정에 따라 자동 승인 가능
}) → ProposalReview

로직:
  1. autoApprove=true이면 바로 apply
  2. 아니면 오케스트레이터 에이전트에게 review 프롬프트 전달
  3. 오케스트레이터 응답 파싱: "APPLY" / "REJECT: 사유" / "REVISE: 수정 지시"
  4. ProposalReview 반환 + RunEvent로 기록
```

### 4.3 collaborationLogger.ts (신규)

**파일**: `extension/src/services/collaborationLogger.ts`

```
역할: 에이전트 간 협업 이벤트를 JSONL로 기록 + 마크다운 리포트 생성

appendCollabEvent(input: {
  runId: string,
  event: "task_dispatched" | "proposal_submitted" | "proposal_reviewed" | "announce",
  actor: string,
  provenance: EventProvenance,
  payload: unknown
}) → void

저장: .agentcanvas/runs/<flow>/<runId>-collab.jsonl

generateCollabReport(runId: string) → string (마크다운)
  - 타임라인 형태
  - 각 워커 proposal 요약
  - 오케스트레이터 결정
  - 최종 변경 목록
```

---

## 5. executeRunLoop 수정

**파일**: `extension/src/extension.ts`

executeRunLoop 내부 태스크 실행 흐름에 A2A 가시화를 삽입:

```
기존:
  태스크 선택 → sandbox 준비 → CLI 실행 → 결과 저장 → 다음 태스크

변경:
  태스크 선택
  → collaborationLogger: task_dispatched (provenance: orchestrator_to_worker)
  → sandbox 준비
  → CLI 실행
  → proposal 생성
  → collaborationLogger: proposal_submitted (provenance: worker_proposal)
  → announceService: buildAnnounce
  → reviewGate: reviewProposal
    → apply → proposalService.applyProposal + collaborationLogger: proposal_reviewed
    → reject → 사유 기록 + 태스크 failed
    → revise → 수정 지시로 재실행
  → collaborationLogger: announce (provenance: announce_user)
  → webview에 카드 이벤트 전송
  → 다음 태스크
```

---

## 6. 프로토콜 메시지

**파일**: `extension/src/messages/protocol.ts` + `webview-ui/src/messaging/protocol.ts`

```typescript
// Extension → Webview
| { type: "COLLAB_EVENT"; payload: {
    event: "task_dispatched" | "proposal_submitted" | "proposal_reviewed" | "announce";
    actor: string;
    provenance: EventProvenance;
    data: unknown;
    ts: number;
  }}

// Webview → Extension
| RequestMessage<"GET_COLLAB_LOG", { runId: string }>
| RequestMessage<"GET_COLLAB_REPORT_MD", { runId: string }>
| RequestMessage<"MANUAL_REVIEW", { runId: string; taskId: string; decision: ReviewDecision; reason?: string }>
```

---

## 7. UI 구현

### 7.1 RunPanel에 협업 타임라인 추가

**파일**: `webview-ui/src/panels/RunPanel.tsx`

기존 "Last Run Events" 섹션을 **카드형 타임라인**으로 교체:

```
┌─ task_dispatched ─────────────────────────┐
│ 🎯 Orchestrator → Coder                   │
│ "src/api.ts 리팩터링"                      │
│ 10:00:01                                   │
└────────────────────────────────────────────┘

┌─ proposal_submitted ──────────────────────┐
│ 📦 Coder → Orchestrator                   │
│ 3 files changed | tests: 5/5 passed       │
│ "API 엔드포인트 분리 + 에러 핸들링 추가"    │
│ 10:02:45                                   │
│ [패치 보기]  [상세 로그]                    │
└────────────────────────────────────────────┘

┌─ proposal_reviewed ───────────────────────┐
│ ✅ Orchestrator: APPLY                     │
│ "테스트 통과, 코드 품질 양호"              │
│ 10:02:50                                   │
└────────────────────────────────────────────┘
```

### 7.2 카드 CSS

**파일**: `webview-ui/src/styles.css`

```css
.collab-card {
  border-left: 3px solid var(--accent);
  padding: 8px 12px;
  margin: 4px 0;
  border-radius: 4px;
  background: var(--bg-elevated);
}
.collab-card[data-event="task_dispatched"] { border-left-color: var(--secondary); }
.collab-card[data-event="proposal_submitted"] { border-left-color: var(--warn); }
.collab-card[data-event="proposal_reviewed"][data-decision="apply"] { border-left-color: var(--ok); }
.collab-card[data-event="proposal_reviewed"][data-decision="reject"] { border-left-color: var(--danger); }
.collab-card[data-event="announce"] { border-left-color: var(--accent); }
```

### 7.3 CommandBar 커맨드

```
"View Collaboration Report" → GET_COLLAB_REPORT_MD → 마크다운 표시
"Manual Review Proposal"    → MANUAL_REVIEW → 수동 승인/거절 UI
```

---

## 8. 마크다운 리포트 자동 생성

`collaborationLogger.generateCollabReport()` 출력 예시:

```markdown
# Run Report: team-alpha / run_20260219_100000

## Timeline

| 시간 | 이벤트 | 에이전트 | 내용 |
|------|--------|---------|------|
| 10:00:01 | task_dispatched | Orchestrator → Coder | src/api.ts 리팩터링 |
| 10:02:45 | proposal_submitted | Coder | 3 files, tests 5/5 |
| 10:02:50 | proposal_reviewed | Orchestrator | APPLY |

## Proposals

### Coder — src/api.ts 리팩터링
- Status: ✅ Applied
- Changed: src/api.ts, src/routes.ts, tests/api.test.ts
- Summary: API 엔드포인트 분리 + 에러 핸들링 추가

## Final Changes
- 3 files modified
- Applied at commit: abc1234
```

---

## 9. 파일 변경 요약

### 신규 (3개)

| 파일 | 역할 |
|------|------|
| `extension/src/services/announceService.ts` | Announce 메시지 생성 |
| `extension/src/services/reviewGate.ts` | 오케스트레이터 승인 게이트 |
| `extension/src/services/collaborationLogger.ts` | 협업 JSONL 로깅 + MD 리포트 |

### 수정 (6개)

| 파일 | 수정 |
|------|------|
| `extension/src/types.ts` | EventProvenance, AnnounceMessage, ProposalReview 타입 |
| `extension/src/extension.ts` | executeRunLoop에 announce/review/collab 삽입 |
| `extension/src/messages/protocol.ts` | COLLAB_EVENT, GET_COLLAB_LOG 등 |
| `webview-ui/src/messaging/protocol.ts` | 동기화 |
| `webview-ui/src/panels/RunPanel.tsx` | 카드형 협업 타임라인 |
| `webview-ui/src/styles.css` | .collab-card 스타일 |

---

## 10. 구현 순서

| Step | 내용 | 시간 |
|------|------|------|
| 1 | types.ts에 EventProvenance, AnnounceMessage, ProposalReview 추가 | 2시간 |
| 2 | collaborationLogger.ts — JSONL 기록 + MD 생성 | 1일 |
| 3 | announceService.ts — announce 메시지 빌드 | 0.5일 |
| 4 | reviewGate.ts — 승인 게이트 로직 | 0.5일 |
| 5 | executeRunLoop 수정 — 서비스 통합 | 1일 |
| 6 | 프로토콜 + RunPanel 카드 UI | 1일 |

**총 예상: 4~5일**

---

## 11. 검증 기준

- [ ] Flow 실행 시 `.agentcanvas/runs/<flow>/<runId>-collab.jsonl`에 이벤트 기록됨
- [ ] 각 이벤트에 provenance 필드로 출처 구분 가능
- [ ] RunPanel에 카드형 타임라인 표시
- [ ] proposal_submitted 카드에서 패치 보기 클릭 가능
- [ ] 오케스트레이터 자동 승인 OFF 시 수동 review UI 작동
- [ ] "View Collaboration Report" 커맨드로 마크다운 리포트 생성

---

*AgentCanvas A2A Visibility Development Spec v1.0 — 2026-02-19*
