# Open Claw Framework — 아키텍처, 에이전트 시스템, 프로토콜

**Date**: 2026-02-19 (용어 정의 추가: 2026-02-20)

---

## 0. 핵심 용어 정의 (Glossary)

> Open Claw 전체 문서에서 공통으로 사용하는 핵심 개념입니다. 모든 문서는 이 정의를 따릅니다.

### Skill (스킬) — 정적 능력

**정의:** Agent가 보유하는 **재사용 가능한 지침·도구 패키지**. `SKILL.md` 파일을 필수로 포함하는 폴더 단위.

```
Skill = SKILL.md (frontmatter + instructions) + (optional) scripts/ + references/ + assets/
```

| 속성 | 설명 |
|------|------|
| 본질 | "무엇을 **할 수 있는가**" — Agent의 역량/도구 |
| 생명주기 | **영속적** — 프로젝트에 파일로 존재, 여러 실행에 걸쳐 재사용 |
| 소유자 | Agent (`ownerAgentId`) |
| 스코프 | project / personal / shared / global |
| 발견 | 파일 시스템 스캔 (.github/skills/, .claude/skills/, .agents/skills/ 등) |
| 호출 방식 | Agent가 Task 실행 중 description 매칭으로 **자동 활성화** 또는 명시 호출 |
| 점진적 로딩 | Level 1: name/description만 로드 → Level 2: SKILL.md 본문 로드 → Level 3: 스크립트/리소스 로드 |
| UI 표현 | AgentDetailModal → Skills 탭, Node Library, SkillNode (캔버스) |

**예시:** `code-review` 스킬, `test-runner` 스킬, `docs-writer` 스킬

### Task (태스크) — 동적 작업 단위

**정의:** 한 번의 실행(Run)에서 생성되는 **구체적 작업 단위**. Orchestrator가 사용자의 Work Prompt를 분해하여 생성하며, 각 Task는 특정 Agent에 할당됨.

```
Work Prompt → Orchestrator 분해 → Task[] 생성 → Agent별 할당 → 실행 → 결과
```

| 속성 | 설명 |
|------|------|
| 본질 | "무엇을 **해야 하는가**" — 구체적 실행 지시 |
| 생명주기 | **일시적** — Run 시작 시 생성, 완료/실패로 종료 |
| 상태 | `planned` → `ready` → `running` → `done` / `failed` / `blocked` / `canceled` |
| 할당 | Agent (`agentId`) |
| 의존성 | `deps: string[]` — 선행 Task ID 목록 |
| 시간 속성 | `estimateMs`, `plannedStartMs`, `actualStartMs`, `progress` (0~1) |
| UI 표현 | 칸반 카드, Schedule 타임라인 블록, Task 탭 Active Tasks |

**예시:** "PR #42의 auth 모듈 코드 리뷰", "API 엔드포인트 리팩터링", "단위 테스트 작성"

### Run (실행) — 작업 세션

**정의:** 사용자가 Work Prompt를 제출한 시점부터 모든 Task가 완료될 때까지의 **실행 세션**.

| 속성 | 설명 |
|------|------|
| 본질 | Task들의 실행 컨테이너 |
| 구성 | 1개 Run = N개 Task |
| 트리거 | 사용자가 Task 탭에서 `[▶ Submit Work]` 클릭 |
| 추적 | Run ID로 히스토리 관리 |
| UI 표현 | Task 탭 History, Run 탭 로그 |

### Agent (에이전트) — 실행 주체

**정의:** Skill을 보유하고 Task를 수행하는 **AI 실행 주체**. Orchestrator(지휘자) 또는 Worker(작업자) 역할.

| 속성 | 설명 |
|------|------|
| 보유 | Skill[] (정적 능력), MCP Server[] (외부 도구) |
| 수행 | Task[] (동적 작업) |
| 역할 | orchestrator / coder / tester / writer / researcher / reviewer / planner / custom |

### 관계 요약

```
┌─────────────────────────────────────────────────────────────────┐
│                        STATIC (설계 시)                          │
│                                                                  │
│   Agent ──── has ────→ Skill[]     "할 수 있는 것"               │
│     │                    │                                       │
│     │                    └── SKILL.md (지침 + 리소스)             │
│     │                                                            │
│     └──── has ────→ MCP Server[]   "접근 가능한 외부 도구"        │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                       DYNAMIC (실행 시)                           │
│                                                                  │
│   User ─── submits Work Prompt ───→ Orchestrator                 │
│                                         │                        │
│                                    decomposes                    │
│                                         │                        │
│                                    Task[] 생성                   │
│                                    │    │    │                   │
│                               Task-A Task-B Task-C               │
│                               (Agent1)(Agent2)(Agent3)           │
│                                                                  │
│   Agent가 Task 실행 시 보유한 Skill을 자동으로 활용              │
│   (description 매칭 → SKILL.md 로드 → 지침에 따라 수행)          │
│                                                                  │
│   전체 = 1 Run (실행 세션)                                       │
└─────────────────────────────────────────────────────────────────┘
```

### 혼동하기 쉬운 포인트

| 혼동 | 올바른 구분 |
|------|-----------|
| "Skill을 실행한다" | ✗ Skill은 실행되지 않음. Agent가 **Task를 실행**할 때 보유한 Skill을 **활용**함 |
| "Task를 만든다 = Run Task" | ✗ 사용자는 **Work Prompt를 제출**함. Orchestrator가 Task를 **생성**함 |
| "Skill = 작업" | ✗ Skill은 **능력**(how), Task는 **작업**(what) |
| "Run = Task" | ✗ Run은 **세션**(여러 Task의 컨테이너), Task는 **개별 작업** |

---

## 1. Agent System Architecture

### 1.1 Core Concepts

The Open Claw agent system introduces **Role-based orchestration** and **Delegation patterns** to enable multi-agent coordination.

#### Central Architecture Pattern

```
┌─────────────────────────┐
│    Orchestrator Agent    │  ← 다른 Agent들을 조율/지시
│    role: "orchestrator"  │
│    systemPrompt: "..."   │
└───────┬──────┬──────────┘
        │      │
   delegates  delegates
        │      │
  ┌─────▼──┐ ┌─▼──────────┐
  │ Coder  │ │ Researcher  │  ← 각자 역할이 있는 Worker Agent
  │ Agent  │ │ Agent       │
  └────────┘ └─────────────┘
```

**Key Actors**:
- **Orchestrator**: 다른 Agent들에게 작업을 위임하는 상위 Agent
- **Worker**: 특정 역할을 수행하는 Agent (Coder, Researcher, Reviewer, etc.)

### 1.2 Data Model

#### AgentProfile Type Extension

**File**: `extension/src/types.ts`, `webview-ui/src/messaging/protocol.ts`

```typescript
export interface AgentProfile {
  id: string;
  name: string;
  providerId: string;
  workspaceRoot?: string;
  homeDir: string;
  metadata?: Record<string, string>;

  // ──── 신규 필드 ────
  role: AgentRole;                    // Agent의 역할 (orchestrator, worker, custom)
  roleLabel?: string;                 // 사용자 정의 역할 라벨 (e.g. "코드 리뷰어")
  description?: string;               // Agent가 무엇을 하는지 한 줄 설명
  systemPrompt?: string;              // Agent의 시스템 프롬프트 (선택)
  isOrchestrator: boolean;            // 다른 Agent를 지휘하는 역할인지
  delegatesTo?: string[];             // 이 Agent가 위임하는 대상 Agent ID 목록
  assignedSkillIds?: string[];        // 이 Agent에 할당된 Skill ID 목록
  assignedMcpServerIds?: string[];    // 이 Agent에 할당된 MCP Server ID 목록
  color?: string;                     // 캔버스에서의 테두리/강조색 (선택)
  avatar?: string;                    // 이모지 또는 이니셜
  runtime?: AgentRuntime;             // CLI execution configuration
}

export type AgentRole =
  | "orchestrator"
  | "coder"
  | "researcher"
  | "reviewer"
  | "planner"
  | "tester"
  | "writer"
  | "custom";

export interface AgentRuntime {
  kind: "cli";
  backendId: "auto" | "claude" | "codex" | "gemini" | "custom";
  cwdMode?: "workspace" | "agentHome";  // 워커는 agentHome, 오케스트레이터는 workspace
}
```

#### StudioEdge Type Extension

**File**: `extension/src/types.ts`

```typescript
export interface StudioEdge {
  id: string;
  source: string;
  target: string;
  type: "contains" | "overrides" | "locatedIn" | "appliesTo" | "agentLink" | "delegates";
  label?: string;  // 엣지에 표시할 텍스트 (e.g. "delegates", "reports to")
}
```

`"delegates"` 타입 추가 — Orchestrator → Worker 관계를 나타내는 방향성 있는 엣지.

### 1.3 Agent Node UI Rendering

**File**: `webview-ui/src/canvas/nodes/AgentNode.tsx`

#### Node Component Improvements

| 항목 | 현재 | 개선 |
|------|------|------|
| 역할 표시 | 없음 | Role 배지 (e.g. `🎯 Orchestrator`) |
| 설명 | 없음 | 한 줄 description |
| Orchestrator 구분 | 없음 | 다른 색상 테두리 + 크라운 아이콘 |
| 연결된 리소스 수 | 없음 | `Skills: 3 · MCP: 2` 카운트 표시 |
| 드롭 대상 | 없음 | 드래그 중 하이라이트 표시 |

#### AgentNode Component Implementation

```tsx
export default function AgentNode({ data, selected }: NodeProps<AgentNodeData>) {
  return (
    <div
      className={`node-card node-agent ${selected ? "is-selected" : ""} ${data.isOrchestrator ? "is-orchestrator" : ""}`}
      onDragOver={handleDragOver}   // 드롭 대상 표시
      onDrop={handleDrop}           // Skill/MCP 드롭 수신
    >
      <Handle type="target" position={Position.Left} className="agent-handle" />
      <div className="node-header">
        <span className="node-header-label">
          <NodeTypeIcon kind="agent" />
          {data.avatar && <span className="agent-avatar">{data.avatar}</span>}
          {data.isOrchestrator ? "Orchestrator" : "Agent"}
        </span>
        <span className="agent-role-badge">{data.roleLabel || data.role}</span>
      </div>
      <div className="node-title">{data.name}</div>
      {data.description && <div className="node-description">{data.description}</div>}
      <div className="node-meta">
        Skills: {data.skillCount ?? 0} · MCP: {data.mcpCount ?? 0}
      </div>
      <Handle type="source" position={Position.Right} className="agent-handle" />
    </div>
  );
}
```

#### Orchestrator CSS Styling

```css
.node-agent.is-orchestrator {
  border-color: var(--orchestrator-accent, #e8a64a);
  border-width: 2px;
  background: linear-gradient(135deg, var(--bg-strong), color-mix(in srgb, var(--orchestrator-accent) 8%, var(--bg-strong)));
}

.agent-role-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent) 20%, transparent);
  color: var(--fg-muted);
}
```

### 1.4 Agent Detail Modal

**File**: `webview-ui/src/panels/AgentDetailModal.tsx`

#### Tab Structure

| 탭 | 현재 | 변경 |
|----|------|------|
| **Overview** (신규) | — | Role 선택, 설명 편집, 시스템 프롬프트, Orchestrator 토글 |
| Skills | 읽기 전용 | 할당/해제 가능 + 오른쪽 패널에서 드래그 수신 |
| Rules | 읽기 전용 | 유지 (기존과 동일) |
| MCP Servers | 읽기 전용 | 할당/해제 가능 + 오른쪽 패널에서 드래그 수신 |

#### Overview Tab UI

```
┌─────────────────────────────────────────┐
│  Role: [orchestrator ▼]                 │  ← 드롭다운 선택
│  Label: [코드 품질 관리자          ]     │  ← 자유 입력
│  Description: [코드 리뷰, 테스트...]     │  ← 한 줄 설명
│                                          │
│  ☑ Is Orchestrator                       │  ← 토글 체크박스
│                                          │
│  System Prompt:                          │
│  ┌─────────────────────────────────────┐ │
│  │ You are a code quality manager...   │ │  ← 멀티라인 텍스트
│  │ Review code, suggest improvements   │ │
│  └─────────────────────────────────────┘ │
│                                          │
│  Delegates To:                           │
│  [Coder Agent] [Reviewer Agent] [+Add]   │  ← 다른 Agent 선택
│                                          │
│  Color: [● #e8a64a]                      │  ← 색상 선택
│                                          │
│  [Save]  [Reset]                         │
└─────────────────────────────────────────┘
```

### 1.5 Edge Types and Orchestration Visualization

**File**: `webview-ui/src/canvas/GraphView.tsx`

| 엣지 타입 | 스타일 | 의미 |
|-----------|--------|------|
| `contains` | 초록색 실선 | Agent → Skill/Rule 소유 |
| `agentLink` | 파란색 점선 | Agent 간 일반 연결 |
| `delegates` (신규) | 주황색 실선 + 화살표 | Orchestrator → Worker 위임 |

```css
/* delegates 엣지 */
.react-flow__edge[data-type="delegates"] path {
  stroke: var(--orchestrator-accent, #e8a64a);
  stroke-width: 3;
}
```

### 1.6 Agent Profile Persistence

**저장 위치 구조**:

```
.agentcanvas/
├── agents/
│   ├── orchestrator-main.json    ← Agent 프로필
│   ├── coder-agent.json
│   └── reviewer-agent.json
├── rules/
│   └── common/
└── config.json
```

**Agent JSON 파일 예시**:

```json
{
  "id": "orchestrator-main",
  "name": "Main Orchestrator",
  "role": "orchestrator",
  "roleLabel": "팀 리더",
  "description": "모든 작업을 분배하고 결과를 취합하는 메인 오케스트레이터",
  "systemPrompt": "You are the main orchestrator...",
  "isOrchestrator": true,
  "delegatesTo": ["coder-agent", "reviewer-agent"],
  "assignedSkillIds": ["skill-1", "skill-2"],
  "assignedMcpServerIds": ["mcp-github"],
  "color": "#e8a64a",
  "avatar": "🎯"
}
```

---

## 2. Communication Protocol

### 2.1 Message Structure

All agent communications follow a standard structure:

1. **Intent**: one-line objective.
2. **Inputs and assumptions**: files, paths, constraints.
3. **Plan**: 3-7 ordered steps.
4. **Actions and artifacts**: changed files and command results.
5. **Open questions**: max 1-3 concrete questions.

### 2.2 Handoff Protocol

Use this block when passing work between agents:

```
HANDOFF
Context:
Goal:
DoD (Definition of Done):
SandboxWorkDir: .agentcanvas/sandboxes/<runId>/<agentId>/work
ProposalJson: .agentcanvas/sandboxes/<runId>/<agentId>/proposal/proposal.json
ChangedFiles:
- path/to/file
Tests:
- (optional) npm test ...
Next:
- Orchestrator: review + apply or request changes
```

### 2.3 Standard Response Format

All agents use this structure unless the task is trivial:

1. Intent (1 sentence)
2. Assumptions / Inputs (bullets)
3. Plan (3–7 bullets)
4. Actions / Artifacts
   - files changed
   - commands run + results
5. Risks / Safety notes
6. Next steps (or DONE)

### 2.4 Message Type Extensions

**File**: `webview-ui/src/messaging/protocol.ts`, `extension/src/messages/protocol.ts`

```typescript
// Agent 프로필 업데이트
| RequestMessage<"UPDATE_AGENT_PROFILE", {
    agentId: string;
    role?: AgentRole;
    roleLabel?: string;
    description?: string;
    systemPrompt?: string;
    isOrchestrator?: boolean;
    color?: string;
    avatar?: string;
  }>

// Skill을 Agent에 할당
| RequestMessage<"ASSIGN_SKILL_TO_AGENT", {
    agentId: string;
    skillId: string;
  }>

// Skill을 Agent에서 해제
| RequestMessage<"UNASSIGN_SKILL_FROM_AGENT", {
    agentId: string;
    skillId: string;
  }>

// MCP Server를 Agent에 할당
| RequestMessage<"ASSIGN_MCP_TO_AGENT", {
    agentId: string;
    mcpServerId: string;
  }>

// MCP Server를 Agent에서 해제
| RequestMessage<"UNASSIGN_MCP_FROM_AGENT", {
    agentId: string;
    mcpServerId: string;
  }>

// Orchestrator의 위임 관계 설정
| RequestMessage<"SET_DELEGATION", {
    orchestratorId: string;
    workerIds: string[];
  }>

// Agent 생성
| RequestMessage<"CREATE_AGENT", {
    name: string;
    role: AgentRole;
    roleLabel?: string;
    description?: string;
    systemPrompt?: string;
    isOrchestrator?: boolean;
  }>

// Agent 삭제
| RequestMessage<"DELETE_AGENT", {
    agentId: string;
  }>
```

### 2.5 Image Handling Rules

- Ask for screenshots when the task is visual (layout, spacing, hover/focus states).
- Do not guess unreadable text from images; request a clearer image.
- For CLI image attachments: `codex -i ./screenshots/ui.png "Analyze this UI issue."`
- Do not commit sensitive screenshots (tokens, emails, private data).

### 2.6 Definition of Done Templates

#### UI Definition of Done
- [ ] Canvas renders without errors.
- [ ] Tidy/Auto layout produce stable placements.
- [ ] Keyboard shortcuts work (Tab, +/-, 0, 1, Space+drag, Shift+S).
- [ ] Inspector data matches selected node.
- [ ] Theme colors follow VS Code variables.

#### Skills Definition of Done
- [ ] `SKILL.md` validation passes (name/description).
- [ ] Folder name and frontmatter `name` match.
- [ ] Export/Import works with conflict handling.

---

## 3. Worker Sandbox & Proposal Workflow

### 3.1 Sandbox Directory Convention

**워크스페이스 루트 기준**:

```
.agentcanvas/
  sandboxes/
    <runId>/
      <agentIdSanitized>/
        input/         # 오케스트레이터가 복사해준 기준본 (읽기 전용 취급)
        work/          # 워커가 실제 수정하는 공간 (워커 homeDir)
        proposal/
          proposal.json
          changes.patch
          summary.md
          test.log      # 선택
```

**Key Principle**: 워커는 `work/`만 수정; `input/`은 baseline(기준본)

### 3.2 Worker CWD Isolation

#### Runtime Configuration

**Orchestrator**: `cwdMode: "workspace"`
**Worker**: `cwdMode: "agentHome"` + `homeDir = .../sandboxes/<runId>/<agentId>/work`

#### resolveAgentCwd() Function

```typescript
import type { AgentProfile } from "../types";

export function resolveAgentCwd(agent: AgentProfile, workspaceRoot: string): string {
  const runtime = agent.runtime;
  if (runtime?.kind === "cli" && runtime.cwdMode === "agentHome") {
    return agent.homeDir;
  }
  return workspaceRoot;
}
```

### 3.3 Sandbox Service

**File**: `extension/src/services/sandboxService.ts`

#### Minimum API

```typescript
prepareSandbox({
  workspaceRoot: string;
  runId: string;
  agentId: string;
  files: string[]
}): Promise<void>

getSandboxPaths({
  workspaceRoot: string;
  runId: string;
  agentId: string
}): { inputDir: string; workDir: string; proposalDir: string }
```

#### Security Validations

- `files`는 반드시 워크스페이스 루트 기준 상대경로만 허용
- `..` 포함 금지, 절대경로 금지
- `.agentcanvas/`, `.git/`, `node_modules/`, `dist/` 같은 기본 차단

### 3.4 Proposal Format

**File**: `.agentcanvas/sandboxes/<runId>/<agentId>/proposal/proposal.json`

```json
{
  "version": "1",
  "runId": "run_xxx",
  "agentId": "custom:coder-1",
  "createdAt": "2026-02-19T00:00:00.000Z",
  "base": {
    "gitHead": "abc123"
  },
  "paths": {
    "inputDir": "input",
    "workDir": "work",
    "patchFile": "proposal/changes.patch",
    "summaryFile": "proposal/summary.md"
  },
  "changedFiles": [
    { "path": "src/foo.ts", "status": "modified" }
  ],
  "notes": "..."
}
```

### 3.5 Proposal Creation (Diff Standardization)

#### Flow

```
1. git diff --no-index --binary <inputDir> <workDir> 실행
2. diff 텍스트에서 a/input/ → a/, b/work/ → b/ 변환
3. proposal/changes.patch로 저장
```

#### Implementation

```typescript
// proposalService.ts
async function createProposal(
  workspaceRoot: string,
  runId: string,
  agentId: string
): Promise<void> {
  // 1. git diff --no-index로 patch 생성
  // 2. prefix strip (a/input/, b/work/ 제거)
  // 3. proposal.json 작성
  // 4. summary.md 생성
}
```

### 3.6 Proposal Apply (Orchestrator Review & Apply)

#### Three-stage Process

1. **Review Stage**: 워커가 생성한 patch + summary 리뷰
2. **Check Stage**: `git apply --check`로 적용 가능 여부 확인
3. **Apply Stage**: 실제 적용 (`git apply`) + 실패 시 원자성 보장

#### Safety Checks (Automatic)

```typescript
// patch가 건드리는 파일 경로 검증
- .. 포함하는지 확인
- 절대경로인지 확인
- .agentcanvas/ 같은 내부 폴더인지 확인
- 허용 리스트/허용 디렉터리 밖인지 확인
```

#### Apply Implementation

```typescript
// proposalService.ts
async function applyProposal(
  workspaceRoot: string,
  proposalPath: string
): Promise<{ success: boolean; error?: string }> {
  // 1. git apply --check
  // 2. 안전검사 (경로 검증)
  // 3. git apply 실행
  // 4. 실패 시 롤백/에러 로깅
}
```

### 3.7 Proposal Event Tracking

**File**: `.agentcanvas/logs/...`

Minimum events to track:
- `proposal_created`
- `proposal_reviewed`
- `proposal_applied` / `proposal_rejected`

---

## 4. MCP Integration

### 4.1 Goals

- Manage MCP servers for Codex and VS Code from one UI.
- Keep secure defaults (allowlist tools, timeout controls).
- Avoid secret leakage (store env var names, not token values).

### 4.2 Target Integrations

#### Codex MCP

- **Source files**:
  - User: `~/.codex/config.toml`
  - Project: `.codex/config.toml` (trusted workspace only)
- **Server key format**: `[mcp_servers.<name>]`
- Support stdio and HTTP server definitions.

#### VS Code MCP

- **Source file**: `.vscode/mcp.json`
- Support workspace-shared server definitions.
- Preserve existing server entries when editing.

### 4.3 UX Proposal

**MCP Tab in Right Panel**:
- Codex MCP
- VS Code MCP

**Actions**:
- Add server (wizard)
- Enable/disable
- Tool allow/deny config
- Config diff preview before write

### 4.4 Security Defaults

- Use `enabled_tools` allowlist by default.
- Display explicit warning for local stdio servers (arbitrary code execution).
- Never store raw tokens in config files.
- Store credential references only as env var names.

### 4.5 Minimal MCP Policy

- Default: 0–2 MCP servers only.
- Add more only when it materially reduces risk or time.
- MCP servers add large tool definitions to every request; track per-server "context cost".

**Secrets Policy**:
- Never store tokens in config files.
- Store only ENV VAR NAMES (e.g., `BEARER_TOKEN_ENV_VAR`).
- Require users to set env securely.

### 4.6 Incremental Build Plan

1. Read/parse Codex and VS Code MCP config files.
2. Render MCP server list in Open Claw UI.
3. Implement add/edit/delete with schema validation.
4. Add diff preview and apply changes.
5. Add smoke checks and docs.

---

## 5. Agent-First Architecture: CommonRulesNode & Interaction Patterns

### 5.1 Interaction Taxonomy

Each Interaction (엣지/패턴) has these dimensions:

**1) Intent (목적)**:
- solve / verify / negotiate / explore / simulate / align

**2) Topology (구조)**:
- peer-to-peer
- manager-worker (centralized)
- pipeline/assembly-line
- blackboard(shared state)
- market/auction
- debate/judge
- broker/facilitator
- router/targeted

**3) Message Form (메시지 형태)**:
- natural language (chat)
- structured JSON (schema)
- speech-act/performatives (ACL)
- learned vector (참고용)
- multimodal (이미지/파일 포함)

**4) Sync (동기화)**:
- strict turn-taking (round-based)
- request/response
- async event-driven
- streaming

**5) Termination (종료)**:
- max_rounds
- consensus_threshold
- judge_decision
- timeouts
- quality_gate(pass/fail)

**6) Verification & Safety (검증)**:
- critic loop
- cross-check/vote
- tool-based verification
- sandbox constraints
- audit log

### 5.2 Graph Data Model

#### New Node Types

```typescript
export type NodeType = "agent" | "system" | "note";

// system node kinds: Judge, Blackboard, Router, Broker, Registry, Timer, etc.
export interface SystemNodeData {
  kind: "judge" | "blackboard" | "router" | "broker" | "registry" | "timer";
  label: string;
  config?: Record<string, unknown>;
}
```

#### Interaction Edge Data

```typescript
export type InteractionTopology =
  | "p2p"
  | "manager_worker"
  | "pipeline"
  | "blackboard"
  | "market_auction"
  | "debate_judge"
  | "broker"
  | "router_targeted"
  | "broadcast";

export type MessageForm = "nl_text" | "structured_json" | "acl_performative" | "multimodal";

export type SyncMode = "turn_based" | "req_res" | "async" | "streaming";

export type Termination =
  | { type: "max_rounds"; rounds: number }
  | { type: "timeout_ms"; ms: number }
  | { type: "judge_decision" }
  | { type: "consensus_threshold"; threshold: number }
  | { type: "quality_gate"; metric: string; op: ">=" | "<="; value: number };

export type Observability = {
  logs: boolean;          // 기본 true
  traces: boolean;        // 기본 false (MVP)
  retain_days?: number;   // 팀 플랜에서 유료화 가능
};

export type InteractionParams = Record<string, unknown>;

export type InteractionEdgeData = {
  patternId: string;            // e.g. "debate_judge"
  topology: InteractionTopology;
  messageForm: MessageForm;
  sync: SyncMode;
  termination: Termination;
  params: InteractionParams;    // rounds, roles, scoring, etc
  observability: Observability;
  // Evidence / traceability
  sources?: Array<{ kind: "paper" | "spec"; ref: string; note?: string }>;
};
```

### 5.3 CommonRulesNode: Right Panel "Common Rules"

**Location**: 우상단 패널 (항상 접근 가능)

**Purpose**: 모든 agent가 공유하는 rules/policies를 중앙 집중식으로 관리

**Content**:
- Global rule chain references (e.g., `CODEX_GLOBAL:~/.codex/AGENTS.md`, `PROJECT:./AGENTS.md`)
- Common communication protocol (이 문서의 섹션 2)
- Shared memory policy (MEMORY.md 참조)
- Isolation/security policies

**UI**:
- Read-only 렌더링 (프로젝트별로 관리)
- 선택 가능한 rule 문서 링크

### 5.4 Expand Mode: Subgraph Templates

When inserting an interaction pattern from the library:

```
1. 사용자가 Right Panel (Pattern Library)에서 패턴 선택
2. 캔버스에 드래그 또는 "Insert" 버튼 클릭
3. 서브그래프(여러 노드+엣지+기본 파라미터) 삽입
4. "Quick Configure" 모달 팝업:
   - rounds / timeout / judge / blackboard 등 핵심 파라미터만 설정
5. 캔버스에 반영 + YAML 저장
```

### 5.5 Agent Manage UI: Overview Tab Integration

**File**: `webview-ui/src/panels/AgentDetailModal.tsx` → Overview Tab

**Integration with CommonRulesNode**:
- Overview 탭에서 "Rules" 섹션 추가
- CommonRulesNode에서 관련 rule을 링크로 표시
- Agent의 `systemPrompt`는 global rules와 상호작용 명시

### 5.6 Pattern Library (20 Interaction Patterns)

#### Pattern Document Template

**File**: `docs/interaction-patterns/patterns/<patternId>.md`

Required sections:
- Intent / When to use
- Roles (agent/system)
- Protocol Steps (step-by-step)
- Defaults (params/termination)
- Failure modes & mitigations
- UI mapping
- Sources (paper/spec reference list)

#### Pattern Template Schema

**File**: `resources/patterns/<patternId>.json`

```json
{
  "id": "debate_judge",
  "name": "Debate + Judge",
  "nodes": [
    {"type": "agent", "id": "debater_a", "data": {"role": "Debater"}},
    {"type": "agent", "id": "debater_b", "data": {"role": "Debater"}},
    {"type": "system", "id": "judge", "data": {"role": "Judge"}}
  ],
  "edges": [
    {"type": "interaction", "id": "e1", "source": "debater_a", "target": "judge",
      "data": {"patternId":"debate_judge","topology":"debate_judge","messageForm":"nl_text","sync":"turn_based",
               "termination":{"type":"max_rounds","rounds":3},"params":{"rounds":3},"observability":{"logs":true,"traces":false}}}
  ],
  "sources": [
    {"kind":"paper","ref":"arXiv:1805.00899","note":"AI safety via debate"},
    {"kind":"paper","ref":"arXiv:2305.14325","note":"Multiagent debate improves factuality/reasoning"}
  ]
}
```

#### 20 Required Patterns

**P01) manager_worker** (AutoGen 계열)
- Roles: Manager(system or agent), Worker agents
- Steps: manager decomposes → assigns → workers report → manager integrates → quality gate
- Default termination: max_rounds=2 + quality_gate("tests_passed")

**P02) role_play_pair** (CAMEL)
- Roles: "User/Client" agent + "Assistant/Executor" agent
- Steps: inception prompt → 협업 → deliverable
- Default: max_rounds=6

**P03) chat_chain_pipeline** (ChatDev)
- Roles: Planner → Designer → Coder → Tester → DocWriter
- Steps: waterfall chat chain + 각 단계 출력 검증
- Default: 각 단계 1~2 turn + gate

**P04) sop_assembly_line** (MetaGPT)
- Roles: PM/Architect/Engineer/QA (SOP로 고정)
- Steps: SOP 단계별 산출물 템플릿 + cross-verify
- Default: gate가 핵심

**P05) debate_judge** (Irving + Du)
- Roles: Debater A, Debater B, Judge
- Steps: A/B 번갈아 주장 → judge decision
- Default: rounds=3, termination=judge_decision

**P06) critic_refiner_curator** (Table-Critic류)
- Roles: Judge, Critic, Refiner, Curator
- Steps: judge 오류 찾기 → critic 피드백 → refiner 수정 → curator 패턴화
- Default: max_rounds=3 + converge condition

**P07) majority_vote_with_tiebreak**
- Roles: N evaluators + tie-break judge
- Steps: independent propose → vote → tie-break
- Default: threshold=0.6

**P08) self_consistency_ensemble**
- Roles: same role agent N개 + aggregator
- Steps: N drafts → score/rank → select
- Default: N=5

**P09) contract_net_auction** (Contract Net Protocol)
- Roles: Manager(initiator) + bidders(workers)
- Steps: announce task → bids → award → execute → report
- Default: timeout + award rule(best bid)

**P10) bilateral_negotiation_offer_counteroffer**
- Roles: Proposer, Responder
- Steps: offer/counteroffer 반복 → accept/reject
- Default: max_rounds=5, timeout

**P11) blackboard_shared_state**
- Roles: multiple agents + Blackboard(system)
- Steps: post observations/partials → others consume → update
- Default: async + retention policy

**P12) publish_subscribe** (ACL subscribe/notify 느낌)
- Roles: Publisher, Subscriber(s)
- Steps: subscribe → notify updates → unsubscribe/timeout
- Default: timeout_ms

**P13) broker_facilitator** (KQML/FIPA Directory Facilitator 느낌)
- Roles: Requester, Provider(s), Broker(system)
- Steps: requester query → broker routes/forwards → provider response
- Default: router_targeted

**P14) router_targeted** (TarMAC-inspired)
- Roles: Router(system), agents
- Steps: agent emits message with "target tags" → router delivers → ack
- Default: structured_json + rate limit

**P15) hierarchical_tree_of_agents**
- Roles: Root manager + sub-managers + workers
- Steps: recursively decompose/aggregate
- Default: termination at each subtree

**P16) redteam_defender_judge**
- Roles: Red team, Defender, Judge
- Steps: red proposes failure/exploit → defender mitigates → judge scores
- Default: max_rounds=2, gate by score

**P17) factcheck_tool_verifier**
- Roles: Producer agent + Verifier agent (tool-using) + Judge
- Steps: produce answer → verifier tool-check → judge accept/revise
- Default: gate: citations_count >= k or tool_check_pass

**P18) plan_execute_observe_reflect**
- Roles: Planner, Executor(tool), Observer, Reflector
- Steps: plan → act → observe → reflect(요약/규칙 업데이트)
- Default: 1 loop, optional repeat

**P19) memory_sync_daily_summary**
- Roles: agents + memory curator(system)
- Steps: 각 agent private log → curator summary → shared blackboard update
- Default: once per session end

**P20) protocol_bridge_mcp_acp_a2a_anp**
- Roles: Local agent + Bridge(system)
- Steps: 내부 interaction을 외부 프로토콜에 맞게 serialize하여 노출
- Default: N/A (설계만, MVP는 실행 X)

### 5.7 Flow Persistence Format

**File**: `.agentcanvas/flows/<flowName>.yaml`

```yaml
version: 0.2
commonRules:
  # 우상단 공통 룰 패널에서 관리되는 항목
  ruleChainRefs:
    - "CODEX_GLOBAL:~/.codex/AGENTS.md"
    - "PROJECT:./AGENTS.md"
agents:
  - id: a1
    name: "Planner"
    rules: []
    skills: ["requirements_refine"]
    mcp: ["jira"]
  - id: a2
    name: "Coder"
interactions:
  - id: i1
    patternId: "manager_worker"
    edges:
      - source: "a1"
        target: "a2"
        data:
          topology: "manager_worker"
          messageForm: "nl_text"
          sync: "req_res"
          termination: { type: "max_rounds", rounds: 2 }
          params: { task_template: "Implement feature X" }
          observability: { logs: true, traces: false }
layout:
  nodes: {}
  edges: {}
```

### 5.8 Validation Rules for Interactions

- interaction은 termination 없으면 저장/실행 금지
- debate/critic/negotiation 패턴은 기본 timeout_ms 반드시 설정
- blackboard는 retention policy (최소 keep_last_n 또는 keep_last_days) 필수
- broker/router는 rate limit 옵션 필수 (기본 10 msg/min)

### 5.9 Observability: Event Logging

**File**: `.agentcanvas/logs/<flow>/<date>.jsonl`

**Event Schema**:

```json
{"ts": 0, "flow":"...", "interactionId":"i1", "edgeId":"e1", "event":"configured", "data":{...}}
{"ts": 1, "flow":"...", "interactionId":"i1", "edgeId":"e1", "event":"simulated_step", "step":1, "note":"..."}
```

---

## 6. Communication & Memory Policy

### 6.1 Design Principles

- **File-first rules**: 영구적인 규칙은 마크다운 파일로 저장
- **Deterministic enforcement**: 메모리 의존 대신 정책 엔진 활용
- **Least context**: MCP 서버, 스킬, 규칙 개수 최소화
- **Isolation by default**: 사용자/세션 간 컨텍스트 분리

### 6.2 Memory Management

**Durable decisions and preferences** → `MEMORY.md` (curated)

**Day-to-day execution notes** → `memory/YYYY-MM-DD.md` (append-only)

**Compaction protection**:
- Assume early conversation details can be lost
- Put stable instructions in .md files
- Keep rule files short; prefer modularization

### 6.3 Skills Safety

- `user-invocable: false` only hides from slash menu
- `disable-model-invocation: true` is the real safety gate (prevents model invocation AND removes skill from context)

**Rule**: Any destructive/secret-touching/deployment/credential skill MUST set `disable-model-invocation: true`.

### 6.4 Session Isolation

If multiple users or channels exist:
- Use per-user/per-channel session mapping
- Group chats must be isolated from DMs
- Provide "Stop current run" action (kill switch)
- Show visible queue/status indicator

### 6.5 Continuous Improvement Loop

At the end of meaningful tasks, agents MUST add to today's log:
- What went wrong / friction points
- What rule/skill would prevent it
- Proposed changes (1–3 bullets)

This mirrors team practice: end-of-session summaries + documentation improvements.

---

## 7. Implementation Roadmap

### Phase 1 — Data Model + Role UI (2~3 days)

**Tasks**:
- [ ] AgentProfile 타입에 role, description, isOrchestrator 등 추가
- [ ] AgentNode.tsx에 Role 배지, description, 리소스 카운트 표시
- [ ] AgentDetailModal에 Overview 탭 추가
- [ ] extension에 UPDATE_AGENT_PROFILE 메시지 핸들러
- [ ] `.agentcanvas/agents/` 디렉토리에 JSON 저장/로드
- [ ] discovery.ts에서 커스텀 Agent 로드

**Files**:
| 파일 | 수정 내용 |
|------|----------|
| `extension/src/types.ts` | AgentProfile 확장, StudioEdge에 `delegates` 추가 |
| `webview-ui/src/messaging/protocol.ts` | 신규 메시지 타입 |
| `extension/src/messages/protocol.ts` | 신규 메시지 타입 |
| `webview-ui/src/canvas/nodes/AgentNode.tsx` | Role 배지, description, 드롭 핸들러 |
| `webview-ui/src/panels/AgentDetailModal.tsx` | Overview 탭 추가 |
| `webview-ui/src/styles.css` | Orchestrator 스타일 |
| `extension/src/extension.ts` | 신규 메시지 핸들러 |
| `extension/src/services/discovery.ts` | 커스텀 Agent 로드 |
| **신규**: `extension/src/services/agentProfileService.ts` | Agent JSON CRUD 서비스 |

### Phase 2 — Orchestrator Visualization (1~2 days)

**Tasks**:
- [ ] delegates 엣지 타입 + 스타일 추가
- [ ] Orchestrator 노드 차별화 CSS
- [ ] SET_DELEGATION 메시지 처리
- [ ] discovery.ts에서 delegation 관계를 edges로 변환

**Files**:
| 파일 | 수정 내용 |
|------|----------|
| `extension/src/types.ts` | StudioEdge에 `delegates` 타입 추가 |
| `webview-ui/src/styles.css` | delegates 엣지 스타일 |
| `webview-ui/src/canvas/GraphView.tsx` | delegates 엣지 스타일, 드롭 이벤트 전파 |
| `extension/src/extension.ts` | SET_DELEGATION 핸들러 |
| `extension/src/services/discovery.ts` | delegation 엣지 생성 |

### Phase 3 — Drag & Drop + Skill/MCP Assignment (2~3 days)

**Tasks**:
- [ ] RightPanel Library 항목에 draggable 속성 추가
- [ ] MCP Servers 섹션을 Library에 추가
- [ ] AgentNode에 onDragOver/onDrop 핸들러 구현
- [ ] ASSIGN_SKILL_TO_AGENT / ASSIGN_MCP_TO_AGENT 메시지 처리
- [ ] AgentDetailModal의 Skills/MCP 탭에서 할당/해제 버튼 추가
- [ ] extension에서 Agent 프로필 JSON의 assigned 배열 업데이트

**Files**:
| 파일 | 수정 내용 |
|------|----------|
| `webview-ui/src/panels/RightPanel.tsx` | MCP 섹션 추가, draggable 속성 |
| `webview-ui/src/canvas/nodes/AgentNode.tsx` | 드롭 핸들러 |
| `webview-ui/src/panels/AgentDetailModal.tsx` | Skills/MCP 할당 UI |
| `webview-ui/src/styles.css` | 드롭 하이라이트 |
| `extension/src/extension.ts` | ASSIGN_SKILL_TO_AGENT 등 핸들러 |

### Phase 4 — Agent Creation/Deletion (1~2 days)

**Tasks**:
- [ ] AgentCreationModal 컴포넌트 생성
- [ ] CommandBar에 "Create Agent" 커맨드 추가
- [ ] CREATE_AGENT / DELETE_AGENT 메시지 처리
- [ ] extension에서 `.agentcanvas/agents/` 파일 생성/삭제

**Files**:
| 파일 | 수정 내용 |
|------|----------|
| `webview-ui/src/App.tsx` | AgentCreationModal 통합 |
| **신규**: `webview-ui/src/panels/AgentCreationModal.tsx` | Agent 생성 모달 |
| `extension/src/extension.ts` | CREATE_AGENT / DELETE_AGENT 핸들러 |

### Phase 5 — Worker Sandbox & Proposal Workflow (2~3 days)

**Tasks**:
- [ ] resolveAgentCwd() 함수 구현
- [ ] sandboxService.prepareSandbox() 구현 (input/work 복사)
- [ ] proposalService.createProposal() 구현 (git diff --no-index + prefix strip)
- [ ] proposalService.applyProposal() 구현 (git apply --check → apply)
- [ ] AGENT_COMMS.md HANDOFF 포맷 확장

**Files**:
| 파일 | 수정 내용 |
|------|----------|
| **신규**: `extension/src/services/sandboxService.ts` | Sandbox 관리 |
| **신규**: `extension/src/services/proposalService.ts` | Proposal 생성/적용 |
| `extension/src/extension.ts` | CLI 실행 시 resolveAgentCwd() 적용 |
| `AGENT_COMMS.md` | HANDOFF 포맷 확장 |

### Phase 6 — Interaction Patterns & CommonRulesNode (3~4 days)

**Tasks**:
- [ ] Interaction edge type + InteractionEdgeData 타입 추가
- [ ] system node type 추가 (Judge, Blackboard, Router 등)
- [ ] RightPanel에 "Interaction Patterns" 섹션 추가
- [ ] Pattern drag/drop → 서브그래프 삽입
- [ ] Edge inspector에 Interaction JSON 편집 폼
- [ ] CommonRulesNode (우상단 패널) UI 추가
- [ ] 20개 패턴 템플릿 (resources/patterns/*.json) 작성
- [ ] 20개 패턴 문서 (docs/interaction-patterns/patterns/*.md) 작성
- [ ] Flow YAML 저장/로드 (commonRules 섹션 포함)
- [ ] Interaction event logging (.agentcanvas/logs/*.jsonl)
- [ ] Validation (termination 필수, 무한루프 방지)

**Files**:
| 파일 | 수정 내용 |
|------|----------|
| `extension/src/types.ts` | Interaction 타입, system node 추가 |
| `webview-ui/src/messaging/protocol.ts` | Interaction 메시지 타입 |
| `webview-ui/src/canvas/nodes/SystemNode.tsx` | System node 렌더링 (신규) |
| `webview-ui/src/canvas/edges/InteractionEdge.tsx` | Interaction edge 렌더링 (신규) |
| `webview-ui/src/panels/RightPanel.tsx` | Interaction Patterns 섹션 |
| `webview-ui/src/panels/EdgeInspector.tsx` | Interaction JSON 편집 (신규) |
| `webview-ui/src/panels/CommonRulesPanel.tsx` | CommonRulesNode UI (신규) |
| `webview-ui/src/canvas/GraphView.tsx` | pattern drag/drop, subgraph insert |
| `extension/src/extension.ts` | Interaction 메시지 핸들러 |
| **신규**: `extension/src/services/patternService.ts` | Pattern 템플릿 로드 |
| **신규**: `extension/src/services/interactionService.ts` | Interaction 이벤트 로깅 |
| `resources/patterns/` | 20개 패턴 JSON 템플릿 |
| `docs/interaction-patterns/patterns/` | 20개 패턴 마크다운 문서 |

### Phase 7 — MCP Server Management (2~3 days)

**Tasks**:
- [ ] MCP config 파일 읽기/파싱 (Codex + VS Code)
- [ ] MCP server 목록 UI 렌더링
- [ ] Add/Edit/Delete server with schema validation
- [ ] Diff preview before write
- [ ] Security warnings (stdio servers, secrets)

**Files**:
| 파일 | 수정 내용 |
|------|----------|
| **신규**: `extension/src/services/mcpConfigService.ts` | MCP config CRUD |
| `webview-ui/src/panels/RightPanel.tsx` | MCP Servers 탭 추가 |
| `webview-ui/src/panels/MCPServerModal.tsx` | Server 추가/편집 모달 (신규) |
| `extension/src/extension.ts` | MCP 관련 메시지 핸들러 |

---

## 8. Important Notes

### 8.1 Existing Provider-based Agent Compatibility

현재 Agent는 Provider(codex, vscode)가 자동 감지한다. 커스텀 Agent를 추가할 때 기존 Agent와 ID 충돌이 없도록 네임스페이스를 분리한다.

```
기존: "vscode-workspace", "codex-default"  (Provider가 생성)
커스텀: "custom:orchestrator-main"          (사용자가 생성, "custom:" 접두사)
```

### 8.2 File System Reflection

Skill/MCP 할당은 UI에서의 논리적 매핑이다. 실제 Agent 프레임워크(Claude, Codex 등)가 이를 인식하려면 각 프레임워크의 설정 파일 형식에 맞게 변환이 필요할 수 있다. MVP에서는 `.agentcanvas/agents/*.json`에 저장하고, 프레임워크별 export는 별도 기능으로 분리한다.

### 8.3 Drag & Drop with React Flow

React Flow 캔버스 위에서의 드래그 앤 드롭은 React Flow의 내부 드래그 이벤트와 충돌할 수 있다. `onDragOver`에서 `e.preventDefault()`를 호출하고, React Flow의 `nodesDraggable` 속성과 충돌하지 않도록 주의가 필요하다. 드롭 대상은 AgentNode 내부 `div`로 한정한다.

### 8.4 Context Protection: Avoiding Context Bleed

Multi-user 시나리오에서:
- Session 컨텍스트는 사용자별로 격리
- 그룹 채팅은 별도 session key로 자동 격리
- MCP 서버는 최소 2개 이하 유지 (컨텍스트 비용)
- Rule 파일은 간결하게 유지 (모듈화)

### 8.5 Skills Safety in Detail

- **user-invocable** = "/" 메뉴 노출 제어 (UI visibility only)
- **disable-model-invocation** = 실제 모델 호출 차단 + 컨텍스트 제거 (hard safety gate)

파괴적인 스킬(deployment, secret access, deletion)은 반드시 `disable-model-invocation: true` 필수.

---

## 9. Deliverables & Definition of Done

### 9.1 Code Deliverables

- [ ] Agent system fully typed (AgentProfile, AgentRuntime, AgentRole)
- [ ] Agent node UI with role badge, description, resource count
- [ ] Agent detail modal with Overview, Skills, Rules, MCP tabs
- [ ] Orchestrator visualization (delegates edges, special styling)
- [ ] Drag & drop skill/MCP assignment from RightPanel
- [ ] Agent creation/deletion workflow
- [ ] Worker sandbox with input/work directory structure
- [ ] Proposal creation (git diff --no-index) and apply (git apply --check)
- [ ] Interaction edge + system node support
- [ ] CommonRulesNode panel (우상단)
- [ ] 20 interaction pattern templates + documentation
- [ ] Flow persistence (YAML with commonRules, interactions)
- [ ] Event logging (.agentcanvas/logs/*.jsonl)
- [ ] Validation (termination required, no infinite loops)
- [ ] MCP config management (read/parse/edit/save)

### 9.2 Documentation Deliverables

- [ ] AGENT_SYSTEM.md (Agent roles, Orchestrator pattern)
- [ ] AGENT_COMMS.md (Message format, Handoff protocol)
- [ ] AGENT_COMMS_AND_OPS.md (Safety, isolation, skills, memory policy)
- [ ] agent restriction.md (Sandbox, proposal workflow)
- [ ] MCP_PLAN.md (MCP integration strategy)
- [ ] 20 pattern documents (docs/interaction-patterns/patterns/*.md)
- [ ] README with quick start + usage examples
- [ ] Integration test scenarios
- [ ] API/type reference (TypeScript interfaces)

### 9.3 Test Deliverables

- [ ] Unit tests: Agent profile CRUD
- [ ] Unit tests: Skill/MCP assignment logic
- [ ] Integration tests: Flow save/load roundtrip
- [ ] Integration tests: Pattern subgraph insertion
- [ ] Integration tests: Proposal creation + apply flow
- [ ] Visual tests: Node rendering, drag/drop UX
- [ ] Security tests: Sandbox path validation, secret non-leakage

---

## 10. Canvas Visualization Examples

### 10.1 Basic Orchestrator Pattern

```
     ┌──────────────────────────┐
     │  🎯 Main Orchestrator    │
     │  role: orchestrator       │
     │  "모든 작업을 총괄"         │
     │  Skills: 2 · MCP: 1      │
     └────┬──────────┬──────────┘
          │          │
     delegates   delegates
     (주황 실선)   (주황 실선)
          │          │
  ┌───────▼──────┐ ┌─▼─────────────┐
  │  💻 Coder    │ │  🔍 Reviewer   │
  │  role: coder │ │  role: reviewer│
  │  Skills: 5   │ │  Skills: 2     │
  │  MCP: 2      │ │  MCP: 1        │
  └──────────────┘ └────────────────┘
```

### 10.2 Interaction Pattern Example: Debate + Judge

```
┌─────────────────────────────────────────┐
│          🎯 Judge (system)              │
│          role: Judge                    │
│          max_rounds: 3                  │
└──────────┬───────────────────┬──────────┘
           │                   │
    interaction          interaction
    (debate_judge)       (debate_judge)
           │                   │
           ▼                   ▼
     ┌──────────┐         ┌──────────┐
     │ Debater A│         │ Debater B│
     │ (agent)  │         │ (agent)  │
     └──────────┘         └──────────┘
```

### 10.3 Sandbox & Proposal Flow Diagram

```
Orchestrator                  Worker (Sandbox)
┌─────────────────┐          ┌────────────────────────┐
│ Main Workspace  │          │ .agentcanvas/sandboxes │
│                 │          │  /<runId>/<agentId>/   │
│ src/            │   copy   │  ├── input/    (RO)    │
│ package.json    │ ────────→│  │  ├── src/           │
│ etc/            │          │  │  └── package.json   │
└─────────────────┘          │  ├── work/     (RW)    │
                             │  │  └── (modified)     │
                             │  └── proposal/         │
                             │     ├── proposal.json  │
                             │     ├── changes.patch  │
                             │     └── summary.md     │
                             └────────────────────────┘
                                      │
                                      │ git diff --no-index
                                      │ (input vs work)
                                      ▼
                                  patch file
                                      │
                             ┌────────▼──────────┐
                             │  Orchestrator     │
                             │  Review Stage:    │
                             │  - Read patch     │
                             │  - Read summary   │
                             │  Check Stage:     │
                             │  git apply --check
                             │  Apply Stage:     │
                             │  git apply        │
                             └───────────────────┘
```

---

**End of FRAMEWORK.md**
