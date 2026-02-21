# AgentCanvas – 에이전트 소통 방식(A2A) 검증 결과 보고서

**작성일**: 2026-02-19
**목적**: AgentCanvas 내 에이전트 간 소통 시스템의 구현 상태 및 제약 조건(예: 일방향 토폴로지에서의 통신 제한)이 요구사항(`AGENT_COMMUNICATION.md` 등)에 맞게 정상적으로 강제되고 있는지 검증하고, 발견된 문제점을 정리합니다.

---

## 🧐 검증 요약

현재 시스템은 에이전트 간의 소통 경로(Topology)를 정적(UI 및 설정 파일)으로는 정의하고 유효성을 검사(`interactionValidation.ts`)하고 있으나, **실행 환경(Runtime)에서는 이를 강제(Enforcement)하는 로직이 완전히 누락**되어 있습니다. 
따라서 A->B 일방향 통신만 허용된 하위 에이전트(B)가 시스템 상의 다른 에이전트(C)나 상위 에이전트(A)에게 독립적으로 메시지/핸드오프를 보낼 수 있는 취약점과 구조적 한계가 존재합니다.

---

## 🚨 발견된 문제점 상세

### 1. 런타임 토폴로지(Topology) 제약 강제 부재
- **증상**: 하위 워커 에이전트가 허가되지 않은 다른 에이전트에게 말을 걸 거나 작업을 넘길(Handoff) 수 있습니다.
- **원인**: `extension/src/services/interactionValidation.ts`에서는 `termination` 조건이나 특정 파라미터 유무만 정적으로 검증할 뿐, `executeRunLoop` (실행 엔진) 단에서는 에이전트가 보내는 타겟(`toAgentId`)이 유효한 엣지(Edge) 기반인지 검사하지 않습니다.
- **결과**: `manager_worker` 토폴로지에서 오케스트레이터->워커로 일방향 지시만 있어야 함에도, 워커가 다른 워커를 직접 호출하거나 우회 통신하는 것을 막지 못합니다.

### 2. 핸드오프(Handoff) 프로토콜 데이터의 유효성 검증 부재
- **증상**: `AGENT_COMMUNICATION.md` 규약에 따르면 Handoff 시 필수적으로 `SandboxWorkDir`, `ProposalJson`, `ChangedFiles`가 포함되어야 하지만, 실제 시스템에서는 이를 강제하지 않고 단순 로깅만 수행합니다.
- **원인**: `extension/src/types.ts`의 `HandoffEnvelope` 타입 정의를 보면 `intent`, `inputs`, `plan`, `constraints`, `deliverables` 등 기획 단계의 필드만 존재하며 제안 제출용 필수 필드가 누락되어 있습니다. 또한 `extension.ts`의 `handleHandoffReceived` 함수는 수신 시 아무런 검증 없이 `applyRunEvent`로 `handoff_received` 로그만 남기고 끝납니다.
- **결과**: 잘못된 포맷의 핸드오프가 허용되어 오케스트레이터가 리뷰할 수 없는 상태로 메시지가 전달되며, 이는 파이프라인의 오류나 중단으로 이어질 수 있습니다.

### 3. 메시지 라우터 및 차단(Firewall) 메커니즘 부재
- **증상**: 샌드박스 서비스(`sandboxService.ts`)를 통해 워커 에이전트의 워크스페이스(파일시스템)는 격리(`cwdMode: "agentHome"`)되지만, **메시징/라우팅 격리**는 구현되어 있지 않습니다.
- **원인**: Agent → Agent 메시징을 중계하는 역할을 수행하는 과정에서 출발지(Source)와 목적지(Target) 사이의 Flow Edge 방향성을 검사하는 `Review Gate`나 통제 로직 로직이 없습니다.
- **결과**: 에이전트가 할당받은 작업과 무관한 에이전트를 대상으로 작업을 분기(Spawn)시키거나 무한 핑퐁(Ping-pong) 대화에 빠질 잠재적 위험성이 있습니다.

### 4. Announce 및 Proposal 검토 체계의 구멍
- **증상**: 워커가 작업을 마쳤을 때 오직 상위 오케스트레이터에게만 내부 메시지(internal)로 보고하고, 오케스트레이터가 검토 후 최종 사용자에게 퍼블리시해야 한다는 규칙(`A2A_VISIBILITY_SPEC.md`)이 인터랙션 라우팅 수준에서 완벽하게 통제되지 않습니다.
- **원인**: 오케스트레이터의 검토 게이트(`reviewGate.ts`)는 마련되어 있고 UI 상에서 "proposal"을 보여주고 있으나, 이를 무시하고 자체 Tool Call 등으로 사용자 화면이나 다른 에이전트 채널에 출력할 수 있는 경로를 통제하는 메시징 미들웨어가 부족합니다.

---

## 💡 해결 로직 / 개선 방향 (Next Steps)

1. **라우팅 미들웨어 추가 (Topology Firewall)**
   - `handleHandoffReceived` 및 에이전트가 다른 에이전트를 호출하는 모든 지점에 `validateCommunicationEdge(fromAgentId, toAgentId)` 함수를 도입하여, 현재 실행 중인 Flow의 Edges 정의 상 유효한 통신 경로인지 확인하고, 불법일 경우 차단하여 에이전트에게 오류(Error Response)를 반환하도록 수정해야 합니다.
2. **Handoff 타입 업데이트 및 엄격한 검증**
   - `types.ts`의 `HandoffEnvelope`를 명세에 맞게 `SandboxWorkDir`, `ProposalJson`, `ChangedFiles` (최소 1개 이상) 필드를 필수로 포함하도록 확장합니다.
   - 런타임 수신 시 해당 값이 유효한 샌드박스 내 경로인지 검사합니다.
3. **Targeted Routing 명시적 제한**
   - 워커 에이전트가 주입받는 시스템 프롬프트(System Prompt)나 컨텍스트(Context Packet)에서 "본인이 말을 걸 수 있는 대상(Target Agents)" 목록을 명시적으로 제한하여 LLM 헛기침(Hallucination)에 의한 잘못된 대상 호출을 선제적으로 예방해야 합니다.

---

## 🚀 추가 개선 권고사항 (Advanced Improvements)

기존 스펙(`AGENT_COMMUNICATION.md` 및 OpenClaw 연구 결과)을 검토한 결과, A2A 협업의 안정성을 높이기 위해 다음 3가지 시스템적 보완을 제안합니다.

### A. Proposal 내 테스트 아티팩트(Test Artifacts) 검증 자동화
- **현재 상황**: `proposalService.ts`는 파일 변경사항(diff)을 추출하고 `summary.md`를 생성하지만, 워커가 주장하는 "테스트 통과 여부"를 오케스트레이터나 시스템이 기계적으로 검증할 수 없습니다.
- **제안사항**: 워커가 `proposal` 폴더 내에 `test.log` 또는 구조화된 테스트 결과 파일(`tests.json`)을 의무적으로 남기도록 강제하고, 오케스트레이터 승인 게이트(`reviewGate.ts`)에서 이 파일의 존재 및 "Passed" 상태를 파싱하여 UI 카드에 신뢰도 마커(Trust Marker)로 표시해야 합니다.

### B. 상호작용 타임아웃(Interaction Timeout)의 런타임 강제 종료 메커니즘
- **현재 상황**: `interactionValidation.ts`에서 패턴에 따른 `timeout_ms`가 설정되어 있는지 정적 확인은 하지만, `extension.ts`의 `executeRunLoop`가 특정 워커의 실행이 해당 제한 시간을 초과했을 때 강제로 샌드박스를 회수하고 에러를 발생시키는 타이머 훅(Timer Hook)이 부족합니다. 
- **제안사항**: 각 Task 실행 시 `AbortController`를 생성하고, 토폴로지에 정의된 `timeout_ms`가 만료되면 `stopRun` 또는 Task Canceled 이벤트를 트리거하여 무한 생성을 방지해야 합니다.

### C. 에이전트 간 메모리/컨텍스트 오염 방지 (Context Window Isolation)
- **현재 상황**: 에이전트들이 통신할 때 메시지 원본(`HandoffEnvelope`)만 주고받게 되면, 이전 워커의 잘못된 추론(Hallucination)이 다음 워커의 프롬프트에 그대로 섞여 들어갈 수 있습니다.
- **제안사항**: `sessionService.ts` 또는 `contextPacker.ts`에서 각 워커의 세션 히스토리를 독립적으로 유지하되, 핸드오프 시에는 "상태 요약(Summary)"과 "작업 지시서"만 프로토콜 형태로 전달하고 전체 이전 대화 컨텍스트는 차단(Prune)하는 엄격한 **Least Context 정책**을 실행 엔진 수준에서 강제해야 합니다.
