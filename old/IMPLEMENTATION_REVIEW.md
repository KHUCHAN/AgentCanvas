# AgentCanvas — 시스템 구현 상태 종합 검토 보고서

**작성일**: 2026-02-19
**목적**: 여러 기획/요구사항 명세서(`FRAMEWORK.md`, `UX.md`, `UI.md`, `WORKFLOW.md`, `AGENT_MEMORY_SPEC.md`)를 기준으로 현재 시스템의 실제 코드(프론트엔드 및 백엔드) 구현 상태를 점검하고, 완료도와 개선 과제를 평가합니다.

---

## 🏗️ 1. 전반적 완성도 평가 (Overall Assessment)

현재 AgentCanvas는 "단순한 노드 에디터"에서 **"프롬프트 우선(Prompt-First) 다중 에이전트 IDE"**로 넘어가는 엄청난 전환기를 거치고 있습니다. 
전반적으로 **백엔드 코어 서비스(로직 및 구조)는 요구사항명세에 맞춰 80~90% 이상 잘 구현되어 있으나, 이를 시각화하고 사용자 경험(UX)으로 완성하는 프론트엔드 및 검증/보안 계층의 개발이 50% 정도 진행된 과도기적 생태계**를 보여줍니다.

---

## 🔍 2. 모듈별 세부 검증 결과

### 🟢 1. Prompt-to-Agent 자동 생성 (WORKFLOW.md)
* 프롬프트를 입력하면 AI 백엔드가 에이전트 팀 구조를 자동으로 짜주는 핵심 빌딩 파이프라인입니다.
* **구현 상태**: **완성도 높음 (85%)**
  * `cliDetector.ts`, `cliExecutor.ts`, `promptBuilder.ts`, `agentStructureParser.ts` 등 CLI를 통해 LLM을 호출하고 JSON을 파싱하는 백엔드 로직이 전부 온전히 구현되어 있습니다.
  * 프론트엔드 역시 `PromptPanel.tsx`, `AgentPreviewModal.tsx`, `TeamPanel.tsx`가 성공적으로 안착되어, 사용자가 프롬프트를 내리고 결과를 확인해 적용하는 워크플로우를 완수할 수 있습니다.

### 🟡 2. 지속 메모리 공유 시스템 (AGENT_MEMORY_SPEC.md)
* 에이전트들이 정보를 기록하고 공유하는 공간(Fact, Decision, Learning 등)입니다.
* **구현 상태**: **백엔드 완비 / 프론트엔드 미구현 (60%)**
  * `extension/src/services` 내에 `memoryStore.ts`, `memoryQuery.ts`, `memoryExtractor.ts`, `contextPacker.ts` 등 명세에 정의된 4대 핵심 서비스가 전부 구현되었습니다. 
  * 하지만 이 메모리들을 화면에서 조회하고 관리하기 위해 기획된 **`MemoryPanel.tsx` 프론트엔드 UI 컴포넌트가 누락**되어 있습니다. 현재로선 파일시스템과 엔진 내부에서만 작동하는 "보이지 않는 뇌" 상태입니다.

### 🟡 3. UX 리디자인 & 칸반 레이아웃 (UX.md)
* 화면 가득 차 있던 복잡한 캔버스를 숨기고 프롬프트와 칸반(Kanban) 중심으로 전환하는 내용입니다.
* **구현 상태**: **과도기 상태 (50%)**
  * **Build Prompt 및 Team Panel**: 명세대로 오른쪽/중앙 패널로 이관되어 동작합니다.
  * **Kanban View**: 명세상 (To Do / In Progress / Done)으로 표시되어야 할 **`KanbanView.tsx`가 프론트엔드 소스에 존재하지 않습니다.** 기존의 복잡한 `ScheduleView.tsx`에 머물러 있습니다.
  * **미니멀 레이아웃**: Phase 4 내용인 좌측 사이드바(`LeftSidebar.tsx`) 제거가 이뤄지지 않고 통합 상태에 있어 화면이 다소 복잡한 이전 버전을 유지하고 있습니다.
  * **키보드 접근성**: 포커스 조작 및 단축키 접근 제한 문제는 전반적으로 아직 패치되지 않은 구간이 많습니다.

### 🟢 4. 브랜딩 및 UI 컴포넌트 (UI.md)
* Agent Studio / Open Canvas 등의 이름을 "AgentCanvas" 하나로 통합하고 스타일 규칙을 정립합니다.
* **구현 상태**: **양호 (80%)**
  * `package.json` 등을 검색한 결과, 핵심적인 명칭은 "AgentCanvas" 통일되어 적용 중입니다. 
  * `--accent`, `--bg-dark` 등 CSS 변수가 모달과 그래프뷰(`GraphView.tsx`) 전반에 일관되게 퍼져있어 디자인 시스템 가이드를 잘 따르고 있습니다. (일부 사소한 마이그레이션 이슈만 남음)

### 🔴 5. 에이전트간(A2A) 통신 및 보안 (FRAMEWORK.md & COMMUNICATION)
* 오케스트레이터와 워커 에이전트 간의 소통 규칙, 샌드박스의 격리성 등을 다룹니다.
* **구현 상태**: **구조는 좋으나 보안/검증 로직 미흡 (60%)**
  * 워커 격리를 위한 `sandboxService.ts`, 결과물을 보고하는 `proposalService.ts` 등은 완벽하게 구성되어 있습니다.
  * *앞서 분석한 바와 같이*, **런타임 시 토폴로지 방향 확인, Timeout 강제 회수, Handoff 필수 필드 강제 등의 런타임 제어 메커니즘이 크게 부실**합니다.

---

## 🎯 3. 총평 및 Next Steps

시스템은 요구사항을 충실히 반영하기 위해 설계되었으며 거대한 기반 공사(백엔드 인프라 확장)는 매우 성공적입니다. 하지만 사용자 마일스톤 관점(UI/UX)과 보안/실행 관점(A2A Communication)에 **"마감 라스트 밀(Last Mile)" 작업이 아직 진행 중**인 상태입니다.

가장 시급하게 해결해야 할 남은 과제는 아래와 같습니다:
1. **Kanban View 구현**: 사용자가 작업 경과를 한 눈에 파악할 수 있도록 `KanbanView.tsx`를 개발 및 통합.
2. **Memory 시각화 UI 구현**: 백엔드가 완비된 공유 메모리를 모니터링할 `MemoryPanel.tsx` 추가.
3. **통신 미들웨어(Firewall) 도입**: 에이전트 간 비정상적인 소통 및 타임아웃을 잡아내는 런타임 검열(Interceptor) 추가 (`AGENT_COMMUNICATION_ISSUES.md` 상세 참조).
4. **UX 화면 정리**: 안 쓰게 된 구형 컴포넌트(`LeftSidebar.tsx` 등) 삭제 및 화면 구조 단순화.
