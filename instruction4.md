좋아. 네가 말한 방향(✅ **Agent가 기본 노드**, ✅ **공통 Rule은 캔버스 오른쪽 위에 상시**, ✅ **Agent 클릭하면 그 Agent의 Skill/MCP/Rule을 관리**)으로 **전체 구조를 다시 잡아서**, Codex한테 **작업 지시서(.md) 형태**로 바로 던질 수 있게 정리해줄게.

아래 3개 파일을 그대로 만들어서 Codex에 “이대로 구현”시키면 됨:

* `ARCHITECTURE_AGENT_FIRST.md` (구상/UX/데이터모델)
* `CODEX_TASKS_AGENT_FIRST.md` (일 시키는 상세 작업분해)
* `MCP_AGENT_PLAN.md` + `AGENT_VISUALS_AND_COMMS.md` (정책/소통/이미지)

---

## 1) ARCHITECTURE_AGENT_FIRST.md

```md
# ARCHITECTURE_AGENT_FIRST.md
AgentCanvas (working name) - Agent-first Canvas Architecture

## 핵심 UX 원칙
1) Agent가 캔버스의 기본 단위(항상 보임).
2) 공통 Rule은 캔버스 오른쪽 위에 고정(상시 접근).
3) Agent를 클릭하면 그 Agent의 Skill / MCP / Rule을 오른쪽 패널에서 관리.
4) 캔버스는 "개요(Overview)" + "확장(Expand)" 두 모드:
   - Overview: Agent 노드 + Common Rules 노드만 (깔끔)
   - Expand: 선택된 Agent 주변에 Skill/Rule(옵션 MCP) 노드를 펼침

---

## 화면 구성 (n8n 느낌 유지)
- Left Sidebar: Providers / Agents / Packs / Settings
- Top Bar: Active Agent selector, Refresh, Export/Import Pack, Validate, Command Bar(⌘K)
- Canvas: dot-grid + floating controls (fit/zoom/reset/tidy/+)
- Right Panel: 탭 3개
  - Inspector (선택 노드 상세)
  - Library (+) (New Skill, Import Pack, Create Override, Sticky Note)
  - Agent Manage (선택 Agent 전용: Skills / Rules / MCP)

---

## Canvas 노드 타입 (핵심 변경)
### 1) AgentNode (기본)
- 발견된 각 provider/profile마다 1개 생성
- 예:
  - "VS Code / Workspace"
  - "Codex / default" (CODEX_HOME)
  - (옵션) "OpenClaw / main"

### 2) CommonRulesNode (오른쪽 위 고정)
- 공통 Rule들을 묶어서 리스트 형태로 보여주는 컨테이너 노드
- pinned = true (Tidy에 의해 움직이지 않음)
- 내부 섹션:
  - Global rules (예: Codex global AGENTS.md/override)
  - Repo common rules (예: project root AGENTS.md or our extension-managed common rules folder)
- 클릭 시 Right Panel Inspector에서 전체 리스트 + 편집 액션 제공
- 캔버스 우측 상단 고정 위치(예: x=1000, y=40) + 사용자가 드래그로 이동 가능(옵션)

### 3) Expand 모드에서만 나타나는 노드
- SkillNode (선택 Agent 소속 스킬만)
- RuleDocNode (선택 Agent의 rule chain만)
- (옵션) McpServerNode (원하면 시각화까지)

---

## 공통 Rule 정의 (현실적인 MVP 기준)
공통 Rule은 "모든 Agent에게 적용되는 규칙"이라는 UI 개념이며, 실제 런타임 주입은 provider별로 다름.

MVP에서 CommonRulesNode에 포함할 항목:
1) Codex Global AGENTS:
   - ~/.codex/AGENTS.override.md (있으면)
   - else ~/.codex/AGENTS.md
2) Codex Repo Root AGENTS:
   - <repoRoot>/AGENTS.override.md (있으면)
   - else <repoRoot>/AGENTS.md
3) Extension-managed common rules:
   - <workspace>/.agentcanvas/rules/common/*.md (우리가 생성/관리)
   - 예: AGENT_VISUALS_AND_COMMS.md, MCP_AGENT_PLAN.md

NOTE:
- Codex는 AGENTS.md 체인 규칙이 명확하므로 "Repo Root AGENTS"는 사실상 공통 규칙 역할을 함.
- Extension-managed common rules는 런타임 자동 로딩을 보장하지 않지만,
  Agent Studio 내에서 "공통 운영 규칙"으로 관리/공유 가치가 있음.
  (추후 provider별 export: Codex용 root AGENTS.md에 자동 merge/append 기능 추가 가능)

---

## Agent 클릭 시 관리 UX
AgentNode 클릭 → Right Panel이 "Agent Manage" 탭으로 전환되고 3개 서브탭 제공:

### A) Skills
- 이 Agent가 사용하는 스킬 목록
- actions: Open / Reveal / Validate / Export / (가능하면 Enable/Disable)
- New Skill wizard 바로 열기

### B) Rules
- Common Rules (읽기/열기) 섹션
- Agent-specific Rules chain 섹션
  - (Codex) root->cwd chain 목록 + order 표시
  - Create override 버튼(현재 디렉터리에 AGENTS.override.md 생성)
  - max bytes로 chain이 잘렸으면 경고 배지

### C) MCP
- Codex MCP: ~/.codex/config.toml 또는 .codex/config.toml (trusted인 경우)에서 읽기/쓰기
- VS Code MCP: .vscode/mcp.json 읽기/쓰기
- Add server wizard + diff preview + trust warning(특히 stdio)

---

## 데이터 모델 변경 사항 (protocol)
- NodeKind에 'commonRules' 추가
- BaseNodeData에 pinned?: boolean 추가 (pinned면 tidyLayout에서 제외)
- SkillEntity/RuleDocEntity에 ownerAgentId 추가 (필터링/Expand에 필요)
- McpServerEntity 추가 (Inspector에서 사용, canvas node는 옵션)

---

## 그래프 생성 방식
- baseGraph(overview):
  nodes: [AgentNodes..., CommonRulesNode]
  edges: CommonRulesNode -> AgentNodes (kind: contains or appliesTo)
- expandedGraph(selectedAgentId):
  baseGraph + (SkillNodes + RuleDocNodes + optional MCP nodes) for selected agent
  edges: agent -> skill (contains), agent -> ruledoc (contains), ruledoc chain (overrides)

---

## Tidy Layout 규칙 (Agent-first)
- pinned nodes (CommonRulesNode)는 위치 유지
- Agent nodes는 좌측 컬럼 정렬
- Expand 모드에서:
  - Rule chain은 agent 오른쪽 근처에 세로 스택
  - Skills는 더 오른쪽 컬럼에 scope group 정렬
  - FitView 실행

Definition of Done:
- Overview에서 화면이 깔끔하고(노드 수 제한)
- Agent 클릭 시 관리가 직관적이며
- Tidy가 예측 가능한 위치로 정렬
```

---

## 2) CODEX_TASKS_AGENT_FIRST.md (Codex에게 “자세히 일 시키는” 작업분해)

```md
# CODEX_TASKS_AGENT_FIRST.md
AgentCanvas MVP - Codex Work Plan (Agent-first)

## 목표
- AgentNode가 기본.
- CommonRulesNode가 캔버스 오른쪽 위에 고정.
- Agent 클릭 시 Right Panel에서 Skills/Rules/MCP를 관리.
- Expand 모드로 선택 Agent 주변에 Skill/Rule(옵션 MCP) 노드를 펼침.

---

# Phase 0 — 브랜치/토대
- [ ] repo에 새 브랜치: feat/agent-first-canvas
- [ ] protocol.ts에 아래 변경 적용:
  - [ ] NodeKind에 'commonRules' 추가
  - [ ] BaseNodeData에 pinned?: boolean 추가
  - [ ] SkillEntity에 ownerAgentId: string 추가
  - [ ] RuleDocEntity에 ownerAgentId: string 추가
  - [ ] McpServerEntity 타입 추가:
    - serverId, name, providerId('codex'|'vscode'), kind('stdio'|'http'), configLocationUri, enabled, tools(optional)
- [ ] StudioState에 commonRules: RuleDocEntity[] 추가 or commonRulesNodeData가 ruleDocIds 들고 있게 구성
- [ ] StudioState에 skillLocations 포함 유지(기존 wizard)

Acceptance:
- 타입 컴파일 통과

---

# Phase 1 — Discovery: Agent 목록(기본 노드)
## 1.1 Agent Profiles 구성
- [ ] 최소 2개 Agent 만들기:
  - [ ] agentId='vscode:workspace' displayName='VS Code / Workspace' providerId='agentSkills'
  - [ ] agentId='codex:default' displayName='Codex / default' providerId='codex'
- [ ] (옵션) OpenClaw agent는 phase 후순위

Acceptance:
- 캔버스 Overview에 Agent 노드 2개가 뜬다

---

# Phase 2 — CommonRulesNode (오른쪽 위 고정)
## 2.1 Common Rules 수집 규칙 구현
- [ ] Codex common rules:
  - [ ] ~/.codex/AGENTS.override.md 있으면 포함, 없으면 ~/.codex/AGENTS.md
  - [ ] repoRoot의 AGENTS.override.md 있으면 포함, 없으면 repoRoot AGENTS.md
  - [ ] 위 파일들이 없으면 "Create root AGENTS.md" CTA 제공
- [ ] Extension-managed common rules 폴더:
  - [ ] <workspace>/.agentcanvas/rules/common/*.md 스캔
  - [ ] 없다면 폴더 생성 CTA 제공

## 2.2 CommonRulesNode UI 구현 (ReactFlow nodeTypes)
- [ ] nodeTypes에 CommonRulesNode 추가:
  - [ ] pinned: true (tidy에서 제외)
  - [ ] 내부에 리스트 4~6개까지만 표시, 더 많으면 "+N more"
  - [ ] 버튼:
    - Open root AGENTS
    - Create root AGENTS (없을 때)
    - Open common folder
- [ ] 기본 위치: canvas top-right
  - [ ] 구현: graphBuilder에서 CommonRulesNode.position = { x: 980, y: 40 } (임시)
  - [ ] 사용자가 움직인 위치는 webview state로 저장/복원 (optional)

Acceptance:
- Overview에서 CommonRulesNode가 오른쪽 위에 고정 표시
- 클릭 시 Inspector에 공통 규칙 리스트/버튼 표시

---

# Phase 3 — Agent 클릭 → Right Panel "Agent Manage" 탭
## 3.1 UI 라우팅
- [ ] AgentNode 클릭 시:
  - [ ] state.selectedAgentId 설정
  - [ ] Right Panel 탭을 Agent Manage로 자동 전환

## 3.2 Agent Manage 탭 구성
- [ ] 서브탭: Overview / Skills / Rules / MCP
- [ ] Skills:
  - [ ] ownerAgentId == selectedAgentId 스킬만 테이블로 표시
  - [ ] actions: Open / Reveal / Validate / Export
  - [ ] "New Skill" → Wizard 열기
- [ ] Rules:
  - [ ] Common Rules 섹션 (CommonRulesNode와 동일 목록)
  - [ ] Agent-specific chain 섹션:
    - (Codex) discoverCodexAgentsChain(cwd) 결과를 orderIndex 순서로 표시
    - Create override: 현재 디렉터리에 AGENTS.override.md 생성
    - truncated 경고 표시
- [ ] MCP:
  - [ ] Codex MCP 목록: config.toml의 [mcp_servers.*] read
  - [ ] VS Code MCP 목록: .vscode/mcp.json read
  - [ ] Add server wizard + diff preview + apply

Acceptance:
- Agent 클릭하면 관리탭이 열리고, 최소한 Skills/Rules 리스트가 정상 렌더
- Rules 탭에서 root AGENTS 생성 가능

---

# Phase 4 — Expand 모드: 선택 Agent 주변에 Skill/Rule 노드 펼치기
## 4.1 Expand 토글
- [ ] Top bar 또는 Agent Manage에 "Expand on canvas" 토글 추가
- [ ] 토글 ON이면 selectedAgentId 기준으로 graphBuilder가 확장 노드를 생성

## 4.2 GraphBuilder 수정
- [ ] overviewGraph():
  - nodes = AgentNodes + CommonRulesNode
  - edges = CommonRulesNode -> AgentNodes (appliesTo)
- [ ] expandedGraph(selectedAgentId):
  - overviewGraph + SkillNodes(ownerAgentId=selected) + RuleDocNodes(ownerAgentId=selected)
  - edges:
    - agent -> skill (contains)
    - agent -> ruledoc (contains)
    - ruledoc chain overrides (dashed)
- [ ] tidyLayout 적용:
  - pinned(CommonRulesNode)는 위치 유지
  - agent 왼쪽, rules 중간, skills 오른쪽

Acceptance:
- Expand ON 시 선택 Agent 주변에 nodes가 펼쳐짐
- Expand OFF면 다시 깔끔해짐

---

# Phase 5 — Tidy Layout 업데이트 (pinned 제외)
- [ ] tidyLayout()에서 data.pinned === true 인 노드는 위치 유지
- [ ] Agent-first 컬럼 정렬 규칙 반영:
  - agentX=80, ruleX=420, skillX=820
- [ ] tidy 후 fitView 실행(애니메이션)

Acceptance:
- CommonRulesNode가 tidy 눌러도 움직이지 않음
- 선택 Agent 기준으로 보기 좋게 정렬됨

---

# Phase 6 — MCP 연결(읽기/쓰기) 최소 구현
## 6.1 Codex MCP
- [ ] ~/.codex/config.toml read
- [ ] (trusted일 때만) <repo>/.codex/config.toml read & write
- [ ] Add server wizard:
  - stdio: command, args, env(var name only)
  - http: url, bearer_token_env_var
- [ ] Apply 전 diff preview modal
- [ ] Apply 시 TOML merge:
  - [mcp_servers.<name>] 생성/수정

## 6.2 VS Code MCP
- [ ] .vscode/mcp.json read
- [ ] Add server wizard(stdio/http)
- [ ] Apply 시 JSON merge

Security:
- stdio server는 "arbitrary code" 경고 배너 표시

Acceptance:
- MCP 탭에서 서버 추가 후 config 파일이 실제로 생성/갱신됨
- 저장 전 diff 확인 가능

---

# Phase 7 — 문서 생성(자동)
- [ ] workspace에 `.agentcanvas/rules/common/` 폴더 생성 기능
- [ ] 아래 md를 자동 생성 버튼으로 제공:
  - AGENT_VISUALS_AND_COMMS.md
  - MCP_AGENT_PLAN.md
- [ ] 생성 후 CommonRulesNode에 자동 반영

Acceptance:
- 버튼 누르면 파일 생성 + 리스트에 보임

---

# 최종 DoD (MVP)
- Overview는 깔끔(Agent + CommonRules만)
- CommonRules는 오른쪽 위 고정 + 클릭 편집 가능
- Agent 클릭하면 Skills/Rules/MCP 관리가 한 화면에서 가능
- Expand 토글로 시각화 상세 전환 가능
```

---

## 3) MCP_AGENT_PLAN.md (Agent 클릭 기반으로 다시 정리)

```md
# MCP_AGENT_PLAN.md
AgentCanvas - MCP Integration (Agent-first)

## 목표
- Agent 클릭 → MCP 탭에서 해당 Agent(provider)의 MCP를 관리한다.
- Codex MCP와 VS Code MCP를 동시에 다룬다.
- 보안: stdio MCP는 로컬 코드 실행이므로 강한 경고 + diff preview 필수.

---

## Provider별 MCP 저장소
### Codex
- user-level: ~/.codex/config.toml
- project-level: <repo>/.codex/config.toml (workspace trusted일 때만 write)
- schema: [mcp_servers.<name>] 테이블로 저장

### VS Code
- workspace-level: .vscode/mcp.json
- schema: { "servers": { "<name>": { "type": "...", ... } } }

---

## UI (Agent Manage > MCP)
- Server list (name / type / enabled / location)
- Actions:
  - Add server
  - Edit
  - Disable/Enable (가능 범위 내)
  - Remove (MVP: soft remove or confirm)
  - Open config file
- Add server wizard:
  - stdio: command, args[], env(ONLY env var names), cwd(optional)
  - http: url, bearer_token_env_var, headers(optional)

---

## Apply Workflow
1) user fills wizard
2) show diff preview (before/after)
3) user confirms
4) write config
5) refresh state

---

## 보안 기본값
- stdio는 "arbitrary code" 경고를 항상 표시
- secrets는 config에 저장 금지:
  - ONLY env var name 저장
- allowlist tools(가능하면):
  - enabled_tools / disabled_tools 형태로 저장 (provider별 지원 범위 고려)
```

---

## 4) AGENT_VISUALS_AND_COMMS.md (Agent “이미지/소통” 규칙 + 캔버스 UI 기준)

```md
# AGENT_VISUALS_AND_COMMS.md
AgentCanvas - Agent Visual Identity & Communication Protocol

## Agent Visuals (UI Avatar Rules)
- 아이콘/이미지는 "브랜드 복제 금지" 원칙:
  - 기본: 원형 배지 + 2글자 이니셜 (예: CX, VS, OC)
  - 색상은 VS Code theme 변수를 사용 (하드코딩 금지)
- 각 provider 매핑:
  - Codex: "CX"
  - VS Code: "VS"
  - OpenClaw: "OC"
- 상태 배지:
  - OK: ✓
  - Warning: !
  - Error: ×

## Canvas Semantics
- AgentNode는 기본 노드이며 항상 보인다.
- CommonRulesNode는 캔버스 오른쪽 위에 고정(pinned)되어 공통 운영 규칙을 관리한다.
- Expand 모드에서만 세부 노드(Skills/Rules/MCP)를 캔버스에 펼친다.

## Communication Protocol (Agent Outputs)
All agent messages SHOULD follow:
1) Intent
2) Assumptions / Inputs
3) Plan
4) Actions / Artifacts
5) Open Questions (<=3)

## Handoff Block (필수)
When handing off work between agents, include:

HANDOFF
Context:
Goal:
DoD:
Files:
Next:

## Image Handling
- UI/레이아웃 이슈는 스크린샷 요청
- 이미지에서 작은 글씨는 추측 금지 → 확대샷/텍스트 복사 요청
- 민감정보(토큰/메일) 포함되면 즉시 redaction 요청
```

---

## 5) 프로젝트 이름 추천(Agent-first 컨셉 반영)

네 요구사항이 “캔버스 중심 + 에이전트가 기본 노드”라서 **이게 가장 잘 맞음**:

* **AgentCanvas** (추천 1순위)
* AgentDock (공통 rules 도킹 느낌)
* AgentGraph Studio (조금 길지만 의미 명확)

---

## 빠르게 다음 단계(너가 Codex에 시킬 방식)

Codex에게 이렇게 던져:

1. “`ARCHITECTURE_AGENT_FIRST.md` 구현 기반으로 구조 바꿔라”
2. “`CODEX_TASKS_AGENT_FIRST.md` Phase 0~7 순서대로 PR 쪼개서 구현해라”
3. “CommonRulesNode + Agent Manage 탭이 먼저고, Expand는 그 다음”
4. “MCP는 read-only 먼저 → write/diff는 Phase 6에서”

원하면, 내가 **GraphBuilder(overview/expanded) 실제 코드 파일**까지 만들어서 “붙여넣으면 돌아가게” 형태로도 더 내려줄게.
