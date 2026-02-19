# AgentCanvas — 미구현/미완성 기능 개발 지시서

**Date**: 2026-02-19
**기준**: 타사 참조 문서 (New features.md, canvas function.md, instruction2~5.md, agent restriction.md) 대비 현재 코드베이스 검증 결과
**전체 구현율**: 38개 기능 중 28 완료 / 7 부분 / 3 미구현 = **77%**

---

## 참조 문서 출처

| 파일 | 참조한 타사 제품 | 핵심 기능 |
|------|-----------------|-----------|
| `old/New features.md` | n8n, Dify, LangGraph Studio, VS Code AI Toolkit, CopilotKit, OpenClaw | 멀티 런타임, Run History, Pin, Replay, OpenClaw 연동 |
| `old/canvas function.md` | n8n, Dify | Schedule Canvas, Swimlane Timeline, 실시간 업데이트 |
| `old/instruction2.md` | n8n | 전체 UI 와이어프레임, 프로토콜, 노드 컴포넌트 |
| `old/instruction4.md` | n8n, Codex | Agent-first 아키텍처, CommonRules, Expand 모드 |
| `old/instruction5.md` | Claude Code, OpenClaw | 소통 규칙, 세션 격리, 스킬 보안, Kill switch |
| `old/agent restriction.md` | OpenClaw | 샌드박스, Proposal 워크플로우 |

---

## 1. 미구현 (NOT DONE) — 3건

### 1-1. Status Bar UI

**출처**: `instruction2.md` §1.1 기본 레이아웃
**참조**: n8n 하단 상태바

```
┌────────────────────────────────────────────────────────────────────┐
│ STATUS BAR (24px): Skills=12  Rules=4  Errors=1  Warnings=3       │
└────────────────────────────────────────────────────────────────────┘
```

**현황**: App.tsx에 StatusBar 컴포넌트 없음. 카운트 데이터는 DiscoverySnapshot에 존재
**구현 지시**:
- 파일: `webview-ui/src/panels/StatusBar.tsx` (신규)
- App.tsx 하단에 24px 고정 바 추가
- 표시 항목: Skills 수, Rules 수, Errors 수, Warnings 수, 현재 Focus 상태
- 데이터: DiscoverySnapshot.agents/skills/ruleDocs에서 집계
- CSS: `height: 24px; border-top: 1px solid var(--border);`

**예상 시간**: 0.5일

---

### 1-2. Expand/Overview 모드 토글

**출처**: `instruction4.md` §Phase 4
**참조**: n8n 노드 펼치기

**현황**: CommonRulesNode는 구현됨. 그러나 "Overview(Agent + CommonRules만) ↔ Expand(선택 Agent 주변에 Skill/Rule 노드 펼침)" 토글이 없음. 현재는 항상 모든 노드가 표시.

**구현 지시**:
- 파일: `webview-ui/src/App.tsx` + `webview-ui/src/canvas/Canvas.tsx`
- 상태: `expandedAgentId: string | null` 추가
- Overview 모드(expandedAgentId === null):
  - AgentNode + CommonRulesNode + SystemNode + ProviderNode만 표시
  - SkillNode, RuleDocNode, FolderNode는 숨김
- Expand 모드(expandedAgentId !== null):
  - 선택된 Agent에 연결된 Skill/Rule/MCP 노드만 추가 표시
- 토글: AgentNode 더블클릭 또는 Top Bar 버튼
- 참조: `tidyLayout.ts` — Expand 시 자동 재정렬 (Agent 왼쪽, Rules 중간, Skills 오른쪽)

**예상 시간**: 1.5일

---

### 1-3. 세션 격리 (per-user/per-channel)

**출처**: `instruction5.md` §5.1
**참조**: OpenClaw dmScope (per-peer / per-channel-peer)

**현황**: 현재 단일 워크스페이스 아키텍처. 멀티유저/멀티채널 세션 분리 없음.

**구현 지시**:
- 파일: `extension/src/services/sessionService.ts` (신규)
- SessionScope 타입: `"workspace" | "user" | "channel"`
- 세션 키 생성: `${flowName}:${scope}:${scopeId}`
- ScheduleService, runStore에 sessionId 기반 분리 적용
- 컨텍스트 유출 방지: 다른 세션의 taskOutputs를 참조하지 않도록 격리
- UI: RunPanel에 "Session" 필터 드롭다운

**예상 시간**: 2일
**우선순위**: 낮음 (멀티유저 사용 시나리오 확정 후)

---

## 2. 부분 구현 (PARTIAL) — 7건

### 2-1. Backends UI — "Test Backend" 기능 누락

**출처**: `New features.md` §7.1
**참조**: VS Code AI Toolkit 백엔드 검증

**현황**:
- ✅ CLI_BACKENDS 메시지로 가용 백엔드 목록 전달
- ✅ RunPanel에서 백엔드 선택 가능
- ✅ backendOverrides 설정 존재
- ❌ "Test backend" 버튼 (샘플 프롬프트 1회 실행) 없음
- ❌ 백엔드별 버전/상태 표시 없음

**구현 지시**:
- 파일: `extension/src/services/cliDetector.ts` 확장
- `testBackend(backendId: string)` 함수 추가
  - 샘플 프롬프트 "Hello, respond with your model name" 실행
  - 응답 시간 + 모델명 반환
- 프로토콜: `TEST_BACKEND` 메시지 추가
- UI: RunPanel 또는 AgentDetailModal 내 "🧪 Test" 버튼
- 결과: Toast로 "✅ claude-code: 1.2s, Claude Sonnet 4.5" 또는 "❌ gemini-cli: not found"

**예상 시간**: 0.5일

---

### 2-2. Run History — Timeline UI + Replay 기능 누락

**출처**: `New features.md` §5.3, §5.4
**참조**: Dify Run History, LangGraph Studio Time-travel

**현황**:
- ✅ Run History 리스트 + 정렬 (RunPanel.tsx)
- ✅ RunEvent JSONL 저장 + 로드
- ✅ Pin/Unpin 개별 노드 출력
- ❌ Timeline 시각화 (노드별 시작/종료 시간 바 차트)
- ❌ Replay 버튼 (동일 입력/핀으로 재실행)
- ❌ "Prompt 수정 후 재실행" (prompt hotfix)

**구현 지시**:
- 파일: `webview-ui/src/panels/RunHistoryDetail.tsx` (신규)
- Timeline: 각 node_started → node_output 간격을 수평 바로 표시
- Replay: `REPLAY_RUN { runId, modifiedPrompts?: Map<nodeId, string> }` 메시지 추가
  - extension에서 기존 RunEvent를 읽고 동일 설정으로 재실행
  - usePinnedOutputs: true로 변경되지 않은 노드는 스킵
- UI: 런 상세 보기에 "▶ Replay" + "✏️ Modify & Replay" 버튼

**예상 시간**: 2일

---

### 2-3. Inspector — "Variables" 탭 누락

**출처**: `New features.md` §5.2
**참조**: Dify Variable Inspect

**현황**:
- ✅ Inspector 패널 존재 (agent, skill, ruleDoc 상세)
- ✅ RUN_NODE 단일 노드 실행 가능
- ❌ "Variables" 탭: 선택 노드의 마지막 실행 output JSON 트리 + "Edit pinned output" 기능

**구현 지시**:
- 파일: `webview-ui/src/panels/InspectorVariables.tsx` (신규)
- 선택된 노드의 마지막 RunEvent(node_output) 조회
- JSON 트리 뷰어 (접기/펼치기)
- "Pin this output" 버튼: 현재 출력을 pinStore에 저장
- "Edit pinned output" 버튼: JSON 에디터로 수정 후 저장

**예상 시간**: 1일

---

### 2-4. OpenClaw Runtime — 실제 연동 코드 누락

**출처**: `New features.md` §6
**참조**: OpenClaw Gateway WS + CLI

**현황**:
- ✅ AgentRuntime 타입에 `{ kind: "openclaw"; gatewayUrl?; agentKey? }` 정의됨
- ✅ AgentDetailModal에서 gatewayUrl/agentKey 설정 가능
- ❌ 실제 OpenClaw CLI 실행 (`openclaw agent --message "..."`) 코드 없음
- ❌ Gateway WebSocket 연결/이벤트 구독 구현 없음
- ❌ OpenClaw 이벤트 → RunEvent 변환 없음

**구현 지시**:
- 파일: `extension/src/services/openclawRuntime.ts` (신규)
- Phase A (CLI): `openclaw agent --message "..." --format json` 호출 + 결과 파싱
- Phase B (WS): `ws://127.0.0.1:18789` 연결 → 세션 생성 → 이벤트 구독 → RunEvent로 변환
- cliExecutor.ts의 executeCliPrompt 패턴을 따르되, openClaw 전용 파싱 로직 추가
- 프로토콜: `CONNECT_OPENCLAW { gatewayUrl, agentKey }` + `OPENCLAW_STATUS` 메시지

**예상 시간**: 3일 (Phase A: 1일, Phase B: 2일)

---

### 2-5. Kill Switch — 큐 상태 시각화 누락

**출처**: `instruction5.md` §5.2
**참조**: OpenClaw `/stop` + 큐 상태

**현황**:
- ✅ STOP_RUN 메시지로 현재 런 중단 가능
- ❌ 큐 상태 시각화 (현재 태스크, 마지막 도구 호출, 마지막 에러, 재시도 횟수)
- ❌ 진단 로그 바로가기

**구현 지시**:
- 파일: `webview-ui/src/panels/RunPanel.tsx` 확장
- 실행 중일 때 표시:
  ```
  ┌─ Running ──────────────────────────┐
  │ 🔄 Current: task-03 (agent:coder)  │
  │ 🔧 Last tool: file_write           │
  │ ⏱️  Duration: 45s                   │
  │ ❌ Last error: (none)              │
  │ 🔁 Retries: 0                      │
  │ [Stop] [View Log]                  │
  └─────────────────────────────────────┘
  ```
- 데이터: RunEvent 스트림에서 실시간 추출
- "View Log" 버튼: JSONL 파일 열기 (OPEN_FILE 메시지)

**예상 시간**: 0.5일

---

### 2-6. Proposal 이벤트 로깅 — UI 연동 누락

**출처**: `agent restriction.md` §6
**참조**: AgentCanvas RunEvent 확장

**현황**:
- ✅ proposalService.createProposal(), applyProposal() 구현됨
- ✅ sandboxService 완전 구현
- ❌ proposal_created, proposal_reviewed, proposal_applied, proposal_rejected 이벤트가 RunEvent 타입에 없음
- ❌ RunPanel에서 Proposal 상태/결과 표시 없음

**구현 지시**:
- 파일: `extension/src/types.ts`
  - RunEvent.type에 `"proposal_created" | "proposal_reviewed" | "proposal_applied" | "proposal_rejected"` 추가
  - payload에 `patchFilePath`, `changedFiles`, `reviewResult` 포함
- 파일: `extension/src/extension.ts` — executeRunLoop 내 proposal 단계에서 이벤트 추가
- UI: RunPanel 카드에 Proposal 상태 배지 (📝 Created → ✅ Applied / ❌ Rejected)

**예상 시간**: 0.5일

---

### 2-7. Backends — 백엔드별 상세 설정 UI 누락

**출처**: `New features.md` §4.2, §4.3
**참조**: n8n Credentials 관리

**현황**:
- ✅ backendOverrides 타입 정의 (command, args, env)
- ✅ SET_BACKEND_OVERRIDES 메시지 존재
- ❌ 백엔드별 command/args/env 편집 UI 없음
- ❌ "Set as workspace default" UI 없음
- ❌ 백엔드 상세 설정 모달/패널 없음

**구현 지시**:
- 파일: `webview-ui/src/panels/BackendSettingsModal.tsx` (신규)
- 각 백엔드(claude-code, gemini-cli, codex-cli, aider, custom)별:
  - Command 경로 (자동 감지값 + override)
  - Args 배열 편집
  - 환경변수 이름 편집 (값은 표시 안 함)
  - "Set as workspace default" 버튼
  - "Test" 버튼 (2-1과 연동)
- 트리거: RunPanel의 백엔드 드롭다운 옆 ⚙️ 아이콘

**예상 시간**: 1일

---

## 3. 구현 완료 확인 — 28건

| # | 기능 | 출처 | 상태 |
|---|------|------|------|
| 1 | Provider Layer — 멀티 런타임 config | New features.md | ✅ DONE |
| 2 | Per-agent runtime override | New features.md | ✅ DONE |
| 3 | Run History + node I/O 저장 | New features.md | ✅ DONE |
| 5 | Run Panel (Run/Stop/Streaming) | New features.md | ✅ DONE |
| 8 | Pin Data (.agentcanvas/pins/) | New features.md | ✅ DONE |
| 10 | OpenClaw Provider 타입 정의 | New features.md | ✅ DONE |
| 12 | ScheduleService | canvas function.md | ✅ DONE |
| 13 | ScheduleView (Swimlane Timeline) | canvas function.md | ✅ DONE |
| 14 | NowLine overlay | canvas function.md | ✅ DONE |
| 15 | Task drag-to-reschedule | canvas function.md | ✅ DONE |
| 16 | computeSchedule (topological sort) | canvas function.md | ✅ DONE |
| 17 | 전체 메시지 프로토콜 | instruction2.md | ✅ DONE |
| 18 | Graph snapshot 직렬화 | instruction2.md | ✅ DONE |
| 19 | VsCodeBridge 메시징 | instruction2.md | ✅ DONE |
| 20 | 노드 타입 (agent/skill/ruleDoc/note/folder+) | instruction2.md | ✅ DONE |
| 21 | Command Bar (⌘K) | instruction2.md | ✅ DONE |
| 23 | CommonRulesNode | instruction4.md | ✅ DONE |
| 25 | Agent Manage 탭 (Skills/Rules/MCP) | instruction4.md | ✅ DONE |
| 26 | MCP 관리 (config.toml + mcp.json) | instruction4.md | ✅ DONE |
| 27 | Tidy Layout (pinned 제외) | instruction4.md | ✅ DONE |
| 28 | File-first rules | instruction5.md | ✅ DONE |
| 29 | Compaction 보호 | instruction5.md | ✅ DONE |
| 30 | Skills 호출 보안 | instruction5.md | ✅ DONE |
| 33 | Sandbox (input/work/proposal) | agent restriction.md | ✅ DONE |
| 34 | resolveAgentCwd() | agent restriction.md | ✅ DONE |
| 35 | SandboxService.prepareSandbox() | agent restriction.md | ✅ DONE |
| 36 | ProposalService (git diff) | agent restriction.md | ✅ DONE |
| 37 | ProposalService.applyProposal() | agent restriction.md | ✅ DONE |

---

## 4. 구현 우선순위

| 우선순위 | 기능 | 시간 | 근거 |
|----------|------|------|------|
| **P0** | 2-5. Kill Switch 큐 상태 시각화 | 0.5일 | 사용자 경험 직결 (Stuck 방지) |
| **P0** | 2-6. Proposal 이벤트 로깅 | 0.5일 | 기존 코드에 이벤트만 추가 |
| **P1** | 1-1. Status Bar | 0.5일 | 빈 하단 영역 활용, 전체 상태 파악 |
| **P1** | 2-1. Test Backend | 0.5일 | 설정 검증에 필수 |
| **P1** | 2-3. Inspector Variables 탭 | 1일 | Dify 핵심 UX, 디버깅에 필수 |
| **P2** | 2-2. Run History Timeline + Replay | 2일 | LangGraph Studio 핵심 차별화 |
| **P2** | 2-7. Backend 상세 설정 UI | 1일 | 멀티 런타임 설정 완성 |
| **P2** | 1-2. Expand/Overview 모드 | 1.5일 | 대규모 캔버스 정리에 필요 |
| **P3** | 2-4. OpenClaw Runtime 연동 | 3일 | 외부 의존성 (OpenClaw 설치 필요) |
| **P3** | 1-3. 세션 격리 | 2일 | 멀티유저 시나리오 확정 후 |

**총 예상: ~12.5일**

---

*AgentCanvas Unimplemented Features Report v1.0 — 2026-02-19*
