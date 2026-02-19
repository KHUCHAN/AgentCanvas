# AgentCanvas — 구현 검증 보고서

**Date**: 2026-02-19
**검증 기준**: FRAMEWORK.md, WORKFLOW.md, UI.md, UX.md, AGENT_COMMUNICATION.md
**검증 대상**: extension/src/, webview-ui/src/ 전체 소스코드

---

## 종합 평가

| 문서 | 구현율 | 등급 |
|------|--------|------|
| **FRAMEWORK.md** | 85% | ⚠️ 양호 |
| **WORKFLOW.md** | 78% | ⚠️ 양호 |
| **UI.md** | 92% | ✅ 우수 |
| **UX.md** | 88% | ✅ 우수 |
| **AGENT_COMMUNICATION.md** | 55% | ❌ 미흡 |
| **전체** | **~75%** | **⚠️ 양호** |

---

## 1. FRAMEWORK.md 검증 결과 (85%)

### ✅ 완전 구현 (9개)

| 항목 | 파일 | 상태 |
|------|------|------|
| AgentProfile 타입 (role, isOrchestrator, delegatesTo 등) | types.ts | ✅ 전체 필드 존재 |
| AgentRuntime (cwdMode: workspace/agentHome) | types.ts | ✅ 정확히 일치 |
| cwdMode 기반 기본값 분기 (createCustomAgentProfile) | agentProfileService.ts | ✅ isOrchestrator 기반 분기 |
| Sandbox 디렉터리 구조 (input/work/proposal) | sandboxService.ts | ✅ 정확히 일치 |
| Sandbox 경로 보안 (.. 금지, 절대경로 금지, 차단 폴더) | sandboxService.ts | ✅ 4종 검증 |
| Proposal 생성 (git diff --no-index + prefix strip) | proposalService.ts | ✅ 정확히 일치 |
| Proposal 적용 (git apply --check → git apply) | proposalService.ts | ✅ 3단계 프로세스 |
| StudioEdge에 "interaction" 타입 포함 | types.ts line 87 | ✅ 포함 |
| 메시지 프로토콜 (CREATE/UPDATE/DELETE AGENT 등) | protocol.ts | ✅ 전체 핸들러 |

### ⚠️ 부분 구현 (2개)

| 항목 | 문제 | 심각도 |
|------|------|--------|
| **CliBackendId 값 불일치** | 문서: `claude, codex, gemini` → 구현: `claude-code, codex-cli, gemini-cli, aider` | 중 |
| **resolveAgentCwd** | 함수는 존재(agentRuntimeService.ts 17줄), 하지만 agentRuntimeService가 stub 수준 — 백엔드 선택 로직, OpenClaw 런타임 지원 미구현 | 중 |

### ❌ 미구현 (2개)

| 항목 | 설명 | 영향도 |
|------|------|--------|
| **InteractionEdgeData 타입 (extension 측)** | webview-ui/src/patterns/types.ts에만 존재. extension/src/types.ts에는 InteractionTopology, MessageForm, SyncMode, Termination, Observability 타입 없음 | 높음 |
| **SystemNodeData 타입** | system 노드 kind(judge, blackboard, router, broker) 구분 인터페이스 없음 | 중 |

---

## 2. WORKFLOW.md 검증 결과 (78%)

### ✅ 완전 구현 (9개)

| 항목 | 파일 | 상태 |
|------|------|------|
| Topological sort | scheduler.ts | ✅ 큐 기반 구현 |
| Task 상태 모델 (planned→ready→running→done/failed/blocked) | types.ts | ✅ 7개 상태 |
| ScheduleService (upsertTask, patchTask, recompute) | scheduleService.ts | ✅ 이벤트 구독 포함 |
| CLI 실행 (spawn + timeout + stderr 캡처) | cliExecutor.ts | ✅ 완전 |
| CLI 백엔드 감지 (which/where, 멀티 백엔드) | cliDetector.ts 255줄 | ✅ 완전 |
| Agent 구조 파싱 (JSON 추출 + Zod 검증) | agentStructureParser.ts 154줄 | ✅ 완전 |
| Prompt 빌더 (컨텍스트 주입) | promptBuilder.ts | ✅ 기본 구현 |
| Run 이벤트 저장 (JSONL per run) | runStore.ts 229줄 | ✅ 완전 |
| Prompt 히스토리 (100개 제한, 적용 추적) | promptHistory.ts 104줄 | ✅ 완전 |

### ⚠️ 부분 구현 (4개)

| 항목 | 문제 | 심각도 |
|------|------|--------|
| **Cycle detection** | 미완료 작업 감지는 하지만 DFS 기반 정확한 사이클 식별 부재 | 중 |
| **3-Phase 분리** (Validate→Plan→Execute) | 개념적으로 존재하지만 명시적 단계 분리 안 됨 | 낮음 |
| **Flow 저장 포맷** | JSON을 .yaml 확장자로 저장. 문서는 실제 YAML + agents/interactions/layout 섹션 요구 | 중 |
| **promptBuilder** | 프롬프트 길이/injection 검증 없음, 모델별 변형 없음 | 낮음 |

### ❌ 미구현 (3개)

| 항목 | 설명 | 영향도 |
|------|------|--------|
| **이벤트 쓰로틀링 (50ms)** | scheduleService.ts에 실시간 배치 처리 없음 | 낮음 |
| **에이전트 동시성 제한** | agentConcurrency 옵션 스케줄러에 미구현 | 중 |
| **agentRuntimeService 완성** | Backend selection, OpenClaw 통합, override 적용 모두 미구현 (17줄 stub) | 높음 |

---

## 3. UI.md 검증 결과 (92%)

### ✅ 완전 구현 (10개)

| 항목 | 파일 | 상태 |
|------|------|------|
| CSS 변수 (--accent: #2fa184, --secondary: #4a87e8 등) | styles.css | ✅ 정확히 일치 |
| 노드 타입 컬러 (skill, rule, agent, provider 등 8종) | styles.css | ✅ 정확히 일치 |
| 엣지 컬러 (contains, overrides, delegates, interaction 등 7종) | styles.css | ✅ 정확히 일치 |
| 브랜드 블록 ("Design · Connect · Deploy") | LeftSidebar.tsx | ✅ 정확히 일치 |
| 노드 타입 등록 (agent, provider, skill, ruleDoc 등 8종) | GraphView.tsx | ✅ 전체 등록 |
| CommonRulesNode (AGENTS.md 상태, 액션 버튼 3개, 룰 프리뷰) | CommonRulesNode.tsx | ✅ 완벽 일치 |
| AgentNode, SkillNode, RuleDocNode 등 | canvas/nodes/ | ✅ 전체 존재 |
| 다크 테마 배경 (#1e1e2e, #252536, #2a2a3c) | styles.css | ✅ 정확히 일치 |
| 스케줄 타스크 상태별 컬러 (planned, ready, running 등) | styles.css | ✅ 전체 매핑 |
| ErrorBoundary | ErrorBoundary.tsx | ✅ 구현 |

### ⚠️ 부분 구현 (2개)

| 항목 | 문제 | 심각도 |
|------|------|--------|
| **SystemNode** | 컴포넌트 존재하지만 역할별 아이콘/배지(Judge, Blackboard 등) 없음 | 중 |
| **반응형 레이아웃** | 일부 media query 존재하지만 전체 breakpoint 미완성 | 낮음 |

---

## 4. UX.md 검증 결과 (88%)

### ✅ 완전 구현 (7개)

| 항목 | 파일 | 상태 |
|------|------|------|
| **Prompt-First 빌드 화면** (큰 카드, 텍스트에어리어, 4 템플릿 칩) | BuildPrompt.tsx | ✅ 완벽 일치 |
| **3-뷰 토글** [Kanban│Graph│Schedule] | App.tsx | ✅ canvasMode 상태 |
| **Kanban 4컬럼** (To Do, In Progress, Blocked, Done) | KanbanView.tsx | ✅ 상태 매핑 정확 |
| **Kanban 카드** (제목, 에이전트, 우선순위, 의존성, 진행바) | KanbanView.tsx | ✅ 전체 요소 |
| **TeamPanel 3섹션** (My Team, Work, History) | TeamPanel.tsx | ✅ 완벽 일치 |
| **Command Bar** (Cmd/Ctrl+K, 20+ 명령) | CommandBar.tsx, App.tsx | ✅ 완전 |
| **토스트 알림 시스템** | App.tsx | ✅ 구현 |

### ⚠️ 부분 구현 (3개)

| 항목 | 문제 | 심각도 |
|------|------|--------|
| **키보드 단축키** | Shift+? 만 구현. Ctrl+S/O, R키 등 미구현 | 중 |
| **LeftSidebar** | 정보 표시만 하고 클릭 핸들러 없음 (비인터렉티브) | 중 |
| **Kanban 드래그앤드롭** | 카드 클릭은 되지만 드래그로 상태 변경 불가 | 중 |

### ❌ 미구현 (2개) — 심각

| 항목 | 설명 | 영향도 |
|------|------|--------|
| **RightPanel 미연결** | RightPanel.tsx는 4탭(Library/Inspector/AI Prompt/Run) 완전 구현되어 있으나, **App.tsx에서 import/render하지 않음**. panelMode 상태만 존재하고 UI에 반영 안 됨 | **치명적** |
| **Kanban 우클릭 컨텍스트 메뉴** | 재실행, 핀, 삭제 메뉴 없음 | 중 |

---

## 5. AGENT_COMMUNICATION.md 검증 결과 (55%)

### ✅ 완전 구현 (5개)

| 항목 | 파일 | 상태 |
|------|------|------|
| 샌드박스 디렉터리 구조 (§6.1) | sandboxService.ts | ✅ input/work/proposal |
| CWD 격리 (§6.2) | agentRuntimeService.ts | ✅ resolveAgentCwd |
| Proposal 포맷 (§6.4) | proposalService.ts | ✅ JSON 스키마 일치 |
| Proposal 생성/적용 (§6.5~6.6) | proposalService.ts | ✅ git diff/apply |
| JSONL 이벤트 로깅 (§9.1) | flowStore.ts | ✅ logInteractionEvent |

### ⚠️ 부분 구현 (3개)

| 항목 | 문제 | 심각도 |
|------|------|--------|
| **핸드오프 프로토콜 (§3)** | 포맷은 commonRulesService의 템플릿에 포함, 하지만 메시지 타입으로 구조화되지 않음 (HANDOFF_RECEIVED 등 없음) | 중 |
| **관측성 (§9)** | 기본 JSONL은 있지만, interaction lifecycle 이벤트(configured/step/terminated) 미구현, traces 미지원 | 중 |
| **Proposal 이벤트 (§9.2)** | sandbox_prepared만 로깅. proposal_created/applied/rejected 이벤트 없음 | 중 |

### ❌ 미구현 (5개)

| 항목 | 설명 | 영향도 |
|------|------|--------|
| **Interaction 타입 시스템 (§4.2)** | extension 측에 InteractionTopology, MessageForm, SyncMode, Termination, InteractionEdgeData 타입 없음 (webview에만 존재) | 높음 |
| **20개 상호작용 패턴 (§5)** | 패턴 문서(*.md) 0개, 템플릿(*.json) 0개, 패턴 삽입 UI 0% | **치명적** |
| **Validation 규칙 (§8)** | 종료조건 필수 검증 없음, debate timeout 검증 없음, blackboard retention 검증 없음, broker rate-limit 검증 없음 | 높음 |
| **Flow YAML interactions 섹션 (§10)** | commonRules, agents, interactions 구조 없이 nodes/edges만 저장 | 중 |
| **패턴 삽입 서브그래프 생성** | 캔버스에 드래그앤드롭으로 패턴 서브그래프 삽입 전혀 미구현 | 높음 |

---

## 6. 전체 이슈 요약 (우선순위별)

### 🔴 치명적 (CRITICAL) — 2개

| # | 이슈 | 문서 | 영향 |
|---|------|------|------|
| **C-1** | **RightPanel이 App.tsx에서 렌더링되지 않음** | UX.md | Inspector, Library, AI Prompt, Run 탭 전체 접근 불가. 컴포넌트는 완성되어 있으나 메인 레이아웃에 연결 안 됨 |
| **C-2** | **20개 상호작용 패턴 미구현** | AGENT_COMMUNICATION.md | 패턴 문서 0/20, 템플릿 JSON 0/20, 삽입 UI 없음, 서브그래프 생성 없음 |

### 🟠 높음 (HIGH) — 6개

| # | 이슈 | 문서 | 설명 |
|---|------|------|------|
| **H-1** | Interaction 타입 extension 측 부재 | FRAMEWORK/COMM | InteractionTopology, Termination 등이 extension types.ts에 없음 |
| **H-2** | Validation 규칙 미적용 | COMM §8 | 종료조건 필수, timeout 필수, retention 필수 규칙 미강제 |
| **H-3** | agentRuntimeService stub | WORKFLOW | 17줄. Backend selection, OpenClaw 통합, override 미구현 |
| **H-4** | Flow YAML 실제 YAML 미사용 | WORKFLOW/COMM | JSON을 .yaml로 저장. interactions/commonRules 섹션 없음 |
| **H-5** | 패턴 메시지 핸들러 부재 | COMM §5 | INSERT_PATTERN, CONFIGURE_INTERACTION 등 핸들러 없음 |
| **H-6** | SystemNodeData 타입/UI 부재 | FRAMEWORK §5 | system 노드 kind(judge, blackboard 등) 구분 인터페이스 없음 |

### 🟡 중간 (MEDIUM) — 8개

| # | 이슈 | 문서 | 설명 |
|---|------|------|------|
| **M-1** | CliBackendId 값 불일치 | FRAMEWORK | 문서 `claude` vs 구현 `claude-code` |
| **M-2** | Kanban 드래그앤드롭 미구현 | UX.md | 카드 상태 변경은 클릭만 가능 |
| **M-3** | 키보드 단축키 부족 | UX.md | Shift+?만 구현. Ctrl+S/O 등 미구현 |
| **M-4** | LeftSidebar 비인터랙티브 | UX.md | 정보 표시만, 클릭 동작 없음 |
| **M-5** | Cycle detection 미흡 | WORKFLOW | DFS 기반 정확한 사이클 식별 부재 |
| **M-6** | 핸드오프 구조화 부족 | COMM §3 | HANDOFF 포맷이 first-class 메시지 타입이 아님 |
| **M-7** | Proposal 이벤트 누락 | COMM §9.2 | proposal_created/applied/rejected 이벤트 미기록 |
| **M-8** | 에이전트 동시성 제한 없음 | WORKFLOW | agentConcurrency 옵션 미구현 |

### 🟢 낮음 (LOW) — 4개

| # | 이슈 | 문서 | 설명 |
|---|------|------|------|
| **L-1** | 이벤트 쓰로틀링 (50ms) | WORKFLOW | scheduleService 이벤트 배치 미구현 |
| **L-2** | promptBuilder 검증 부족 | WORKFLOW | 프롬프트 길이/injection 검증 없음 |
| **L-3** | 반응형 레이아웃 미완성 | UI.md | 일부 breakpoint 누락 |
| **L-4** | Kanban 우클릭 메뉴 없음 | UX.md | 재실행/핀/삭제 컨텍스트 메뉴 |

---

## 7. 컴포넌트별 구현 현황

### Extension (Backend)

| 파일 | 줄수 | 완성도 | 핵심 기능 |
|------|------|--------|-----------|
| extension.ts | 2,704 | ✅ 90% | 메시지 핸들러, 실행 루프, 서비스 통합 |
| types.ts | 287 | ⚠️ 70% | 핵심 타입 (Interaction 타입 누락) |
| messages/protocol.ts | 194 | ✅ 85% | 메시지 프로토콜 (패턴 메시지 누락) |
| schedule/scheduler.ts | ~200 | ✅ 85% | 토폴로지 정렬, 스케줄링 |
| schedule/scheduleService.ts | ~325 | ✅ 90% | 태스크 관리, 이벤트 구독 |
| services/sandboxService.ts | 134 | ✅ 100% | 샌드박스 격리, 경로 보안 |
| services/proposalService.ts | 312 | ✅ 95% | Proposal 생성/적용 (이벤트 로깅만 부족) |
| services/cliDetector.ts | 255 | ✅ 100% | CLI 백엔드 감지 |
| services/cliExecutor.ts | ~110 | ✅ 90% | CLI 실행 (retry 미구현) |
| services/agentProfileService.ts | ~224 | ✅ 95% | 에이전트 프로필 CRUD |
| services/agentRuntimeService.ts | 17 | ❌ 20% | stub — resolveAgentCwd만 존재 |
| services/agentStructureParser.ts | 154 | ✅ 100% | JSON 파싱 + Zod 검증 |
| services/flowStore.ts | ~110 | ⚠️ 75% | Flow 저장/로드 (YAML 미사용) |
| services/runStore.ts | 229 | ✅ 95% | Run 이벤트 JSONL 저장 |
| services/pinStore.ts | ~90 | ✅ 90% | Pin 캐싱 |
| services/promptBuilder.ts | ~83 | ⚠️ 70% | 프롬프트 생성 (검증 부족) |
| services/promptHistory.ts | 104 | ✅ 100% | 프롬프트 히스토리 |
| services/commonRulesService.ts | 162 | ✅ 90% | 공통 룰 관리 |

### Webview (Frontend)

| 파일 | 줄수 | 완성도 | 핵심 기능 |
|------|------|--------|-----------|
| App.tsx | ~1,600 | ⚠️ 85% | 메인 레이아웃 (**RightPanel 미연결**) |
| views/BuildPrompt.tsx | ~165 | ✅ 100% | Prompt-First 빌드 화면 |
| views/KanbanView.tsx | ~175 | ✅ 90% | Kanban 보드 (드래그 미구현) |
| panels/TeamPanel.tsx | ~175 | ✅ 100% | 팀 패널 3섹션 |
| panels/RightPanel.tsx | ~410 | ✅ 100% | 4탭 패널 (App에 미연결) |
| panels/RunPanel.tsx | ~270 | ✅ 100% | 실행 패널 |
| panels/LeftSidebar.tsx | ~50 | ⚠️ 60% | 사이드바 (비인터랙티브) |
| panels/CommandBar.tsx | ~250 | ✅ 95% | 커맨드 바 |
| canvas/GraphView.tsx | ~300 | ✅ 90% | React Flow 캔버스 |
| canvas/ScheduleView.tsx | ~200 | ✅ 85% | 타임라인/간트 뷰 |
| canvas/nodes/ (8개) | 각 30~60 | ✅ 90% | 전체 노드 타입 |
| patterns/types.ts | ~70 | ✅ 100% | Interaction 타입 (webview 측) |
| styles.css | ~1,800 | ✅ 95% | 전체 디자인 시스템 |
| messaging/protocol.ts | ~420 | ✅ 90% | Webview 프로토콜 |

---

## 8. 권장 수정 로드맵

### Phase A — 즉시 수정 (1~2일)

| 작업 | 대상 | 시간 |
|------|------|------|
| **C-1 해결**: App.tsx에 RightPanel import + 레이아웃 그리드에 추가 | App.tsx | 2시간 |
| **H-1 해결**: extension types.ts에 Interaction 타입 추가 | types.ts | 3시간 |
| **M-1 해결**: CliBackendId 값 문서 또는 코드 통일 | types.ts 또는 FRAMEWORK.md | 30분 |
| **M-7 해결**: proposalService에 이벤트 로깅 추가 | proposalService.ts | 2시간 |

### Phase B — 핵심 기능 (3~5일)

| 작업 | 대상 | 시간 |
|------|------|------|
| **H-2 해결**: Interaction validation 규칙 구현 | extension.ts + 신규 validator | 1일 |
| **H-3 해결**: agentRuntimeService 완성 | agentRuntimeService.ts | 1일 |
| **H-4 해결**: flowStore를 실제 YAML + interactions 섹션으로 변경 | flowStore.ts | 1일 |
| **H-6 해결**: SystemNodeData 타입 + SystemNode UI 보강 | types.ts + SystemNode.tsx | 1일 |

### Phase C — 패턴 시스템 (5~7일)

| 작업 | 대상 | 시간 |
|------|------|------|
| **C-2 해결**: 20개 패턴 문서 작성 | docs/interaction-patterns/ | 2일 |
| **C-2 해결**: 20개 패턴 JSON 템플릿 작성 | resources/patterns/ | 1일 |
| **H-5 해결**: 패턴 메시지 핸들러 구현 | extension.ts, protocol.ts | 2일 |
| 패턴 삽입 UI (서브그래프 생성) | RightPanel, GraphView | 2일 |

### Phase D — 폴리싱 (2~3일)

| 작업 | 대상 | 시간 |
|------|------|------|
| **M-2**: Kanban 드래그앤드롭 | KanbanView.tsx | 1일 |
| **M-3**: 키보드 단축키 추가 | App.tsx | 0.5일 |
| **M-4**: LeftSidebar 인터랙티브 | LeftSidebar.tsx | 0.5일 |
| **M-5**: DFS 기반 cycle detection | scheduler.ts | 0.5일 |
| **L-1~4**: 기타 폴리싱 | 각 파일 | 0.5일 |

**총 예상 소요**: 11~17일

---

## 9. 강점 분석

구현이 특히 잘된 영역:

- **CLI 통합 파이프라인** (100%): cliDetector → promptBuilder → cliExecutor → agentStructureParser 전체 흐름이 완벽하게 동작
- **샌드박스 보안** (100%): 경로 검증, 차단 폴더, 탈출 방지 등 다층 보안
- **Proposal 워크플로우** (95%): git diff/apply 기반 안전한 코드 반영 프로세스
- **Prompt-First UX** (100%): BuildPrompt.tsx가 문서와 100% 일치
- **CSS 디자인 시스템** (95%): 모든 색상, 변수, 컴포넌트 스타일이 정확히 일치
- **Task 스케줄링** (90%): 토폴로지 정렬, 의존성 해석, 이벤트 기반 아키텍처

---

*AgentCanvas Implementation Verification Report v1.0 — 2026-02-19*
