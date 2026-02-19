# AgentCanvas 프로젝트 메모리

**최종 업데이트**: 2026-02-19

---

## 프로젝트 개요

- **이름**: AgentCanvas (VS Code Extension)
- **스택**: TypeScript + React(Vite) + React Flow
- **경로**: `/sessions/serene-gallant-archimedes/mnt/Open Claw/`
- **GitHub**: https://github.com/KHUCHAN/AgentCanvas (push 미완료 — 인증 실패)
- **Git 커밋**: `d8ca6a1` (로컬)

---

## 루트 .md 파일 현황

| 파일 | 크기 | 내용 |
|------|------|------|
| FRAMEWORK.md | 43KB | 아키텍처, 에이전트 시스템, 타입, 샌드박스, MCP, 상호작용 패턴, 로드맵 Phase 1~7 |
| WORKFLOW.md | 73KB | MVP 스펙, Prompt-to-Agents, 스케줄 실행, CLI 백엔드, 프로토콜, 기능 로드맵 |
| UI.md | 25KB | 브랜딩(#2fa184), 컴포넌트 스펙, CSS 변수, 디자인 검증 |
| UX.md | 42KB | Prompt-First + Kanban 리디자인, 키보드 접근성 |
| AGENT_COMMUNICATION.md | 22KB | 에이전트 소통 프로토콜, 핸드오프, 20개 패턴, 샌드박스, 검증 규칙 |
| PROMPT_CACHING_SPEC.md | 신규 | 캐싱 개발 지시서 — promptBuilder/cliExecutor/tokenTracker 등 |
| IMPLEMENTATION_VERIFICATION.md | — | 구현 검증 보고서 (전체 75%) |
| README.md | 4KB | 프로젝트 소개 |

`old/` 폴더: 원본 23개 .md + CACHING_DEV_TASKS.md

---

## 핵심 코드 구조

### Extension (Backend)

```
extension/src/
  extension.ts          (2,704줄) — 메인 메시지 핸들러, executeRunLoop
  types.ts              (359줄)   — 전체 타입 정의
  messages/protocol.ts  (194줄)   — 메시지 프로토콜
  schedule/
    scheduler.ts        — 토폴로지 정렬
    scheduleService.ts  — 태스크 관리
    types.ts            — 스케줄 타입
  services/
    agentProfileService.ts  — Agent CRUD
    agentRuntimeService.ts  — resolveAgentCwd (17줄 stub)
    cliDetector.ts          — CLI 백엔드 감지 (255줄)
    cliExecutor.ts          — CLI 실행 (109줄)
    promptBuilder.ts        — 프롬프트 빌드 (83줄)
    agentStructureParser.ts — JSON+Zod 파싱 (154줄)
    sandboxService.ts       — 샌드박스 격리 (134줄)
    proposalService.ts      — Proposal 생성/적용 (312줄)
    flowStore.ts            — Flow 저장/로드 + interaction JSONL
    runStore.ts             — Run 이벤트 JSONL (229줄)
    pinStore.ts             — 출력 핀 캐싱
    commonRulesService.ts   — 공통 룰 관리 (162줄)
    promptHistory.ts        — 프롬프트 히스토리 (104줄)
    pathUtils.ts, discovery.ts, mcpDiscovery.ts 등
```

### Webview (Frontend)

```
webview-ui/src/
  App.tsx              (1,600줄) — 메인 레이아웃, 상태관리
  styles.css           (1,800줄) — 전체 CSS (변수, Kanban, TeamPanel 등)
  views/
    BuildPrompt.tsx    — Prompt-First 빌드 화면 ✅ 완벽
    KanbanView.tsx     — Kanban 보드 (드래그 미구현)
  panels/
    TeamPanel.tsx      — 팀 패널 3섹션 ✅ 완벽
    RightPanel.tsx     — 4탭 패널 ✅ 완성 (⚠️ App.tsx에 미연결)
    RunPanel.tsx       — 실행 패널 ✅
    LeftSidebar.tsx    — 사이드바 (비인터랙티브)
    CommandBar.tsx     — Cmd+K (20+ 명령)
    SettingsModal.tsx, AgentCreationModal.tsx 등
  canvas/
    GraphView.tsx      — React Flow (8개 노드 타입 등록)
    ScheduleView.tsx   — 타임라인/간트
    nodes/ (8개: Agent, Skill, RuleDoc, Note, Folder, CommonRules, Provider, System)
  patterns/types.ts    — Interaction 타입 (webview 측)
```

---

## 구현 검증 결과 요약 (75%)

### 치명적 (2개)
- **C-1**: RightPanel이 App.tsx에서 렌더링 안 됨
- **C-2**: 20개 상호작용 패턴 0% 구현

### 높음 (6개)
- H-1: Interaction 타입 extension 측 부재 → **해결됨** (types.ts에 추가됨)
- H-2: Validation 규칙 미적용
- H-3: agentRuntimeService stub (17줄)
- H-4: Flow YAML 실제 YAML 미사용
- H-5: 패턴 메시지 핸들러 부재
- H-6: SystemNodeData 타입 부재 → **해결됨** (types.ts에 추가됨)

### 중간 (8개)
- M-1~M-8: Kanban 드래그, 키보드 단축키, LeftSidebar, 핸드오프 구조화 등

---

## 최근 작업 이력

1. CODE_VERIFICATION.md 업데이트 (M-2, M-5 해결 마킹)
2. 검증/디자인 보고서 별도 파일 생성
3. UX 리디자인: Prompt-First + Kanban 패러다임 (3회 반복)
4. 24개 .md → 4개 통합 파일 + old/ 아카이브
5. AGENT_COMMUNICATION.md 신규 작성 (에이전트 소통 프로토콜)
6. 5개 문서 기반 전체 구현 검증 → IMPLEMENTATION_VERIFICATION.md
7. **PROMPT_CACHING_SPEC.md 작성** — OpenClaw 캐싱 가이드를 AgentCanvas에 맞춘 개발 지시서

---

## 사용자 선호

- 한국어로 대화
- .md 파일은 별도 파일로 분리 선호 (기존 문서에 통합 X)
- OpenClaw 원본이 아닌 우리 시스템에 맞춘 개발 지시서 형태 선호
- 빠른 응답 선호 ("너무 느려")
