# AgentCanvas — Agent 시스템 확장 계획

> Agent에 Role 개념 도입, Orchestrator 패턴, 드래그 앤 드롭 Skill/MCP 할당

---

## 1. 현재 상태 (AS-IS)

### 데이터 모델

```typescript
// AgentProfile (extension/src/types.ts)
{
  id: string;
  name: string;           // "VS Code / Workspace", "Codex / default"
  providerId: string;     // "agent-skills", "codex-guidance"
  workspaceRoot?: string;
  homeDir: string;
  metadata?: Record<string, string>;
}
```

**문제점**: `role`, `description`, `systemPrompt`, `isOrchestrator` 같은 필드가 전혀 없다. Agent가 단순히 "파일 시스템에서 발견된 설정 묶음"일 뿐, 역할이나 목적이 정의되지 않는다.

### Agent 노드 (캔버스)

```typescript
// AgentNode.tsx — 현재 표시 정보
- 아바타 (이니셜 2글자)
- 이름
- provider ID
```

**문제점**: Role이 보이지 않는다. 모든 Agent가 동일한 모양으로 렌더링된다. Orchestrator와 일반 Worker를 구분할 수 없다.

### Agent 상세 모달 (더블클릭)

현재 3개 탭: Skills, Rules, MCP Servers — 모두 `ownerAgentId`로 필터링해서 표시.

**문제점**: Role 설정/편집 UI가 없다. Skill/MCP를 여기서 "할당/해제"하는 기능이 없다 (읽기 전용).

### 오른쪽 패널 (RightPanel)

Library 모드: 전체 Skill 목록 + Rule Doc 목록을 보여줌.
Inspector 모드: 선택된 노드의 상세 정보 표시.

**문제점**: 드래그 앤 드롭 지원이 전혀 없다. Skill이나 MCP를 Agent에 연결하려면 파일 시스템을 직접 수정해야 한다.

### Agent 간 연결 (agentLink)

React Flow의 Handle + onConnect로 agent끼리 선을 연결하는 기능이 있다. 파란색 점선으로 표시된다.

**문제점**: 연결에 의미(방향성, 역할)가 없다. "누가 누구를 orchestrate하는가"를 표현할 수 없다.

---

## 2. 목표 상태 (TO-BE)

### 2.1 핵심 개념

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

- **Orchestrator**: 다른 Agent들에게 작업을 위임하는 상위 Agent
- **Worker**: 특정 역할을 수행하는 Agent (Coder, Researcher, Reviewer 등)
- 한 Agent가 여러 Skill/MCP를 가질 수 있고, 이를 드래그 앤 드롭으로 관리

---

## 3. 추가/변경 항목

### 3.1 데이터 모델 확장

#### `AgentProfile` 타입 확장

**파일**: `extension/src/types.ts`, `webview-ui/src/messaging/protocol.ts`

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
```

#### `StudioEdge` 타입 확장

**파일**: `extension/src/types.ts`, `webview-ui/src/messaging/protocol.ts`

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

---

### 3.2 Agent 노드 UI 개선

**파일**: `webview-ui/src/canvas/nodes/AgentNode.tsx`, `webview-ui/src/styles.css`

#### 현재 → 개선

| 항목 | 현재 | 개선 |
|------|------|------|
| 역할 표시 | 없음 | Role 배지 (e.g. `🎯 Orchestrator`) |
| 설명 | 없음 | 한 줄 description |
| Orchestrator 구분 | 없음 | 다른 색상 테두리 + 크라운 아이콘 |
| 연결된 리소스 수 | 없음 | `Skills: 3 · MCP: 2` 카운트 표시 |
| 드롭 대상 | 없음 | 드래그 중 하이라이트 표시 |

#### AgentNode 컴포넌트 개선안

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

#### Orchestrator 전용 CSS

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

---

### 3.3 Agent 상세 모달 확장

**파일**: `webview-ui/src/panels/AgentDetailModal.tsx`

#### 현재 3탭 → 4탭

| 탭 | 현재 | 변경 |
|----|------|------|
| **Overview** (신규) | — | Role 선택, 설명 편집, 시스템 프롬프트, Orchestrator 토글 |
| Skills | 읽기 전용 | 할당/해제 가능 + 오른쪽 패널에서 드래그 수신 |
| Rules | 읽기 전용 | 유지 (기존과 동일) |
| MCP Servers | 읽기 전용 | 할당/해제 가능 + 오른쪽 패널에서 드래그 수신 |

#### Overview 탭 UI

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

---

### 3.4 드래그 앤 드롭: 오른쪽 패널 → Agent

**파일**: `webview-ui/src/panels/RightPanel.tsx`, `webview-ui/src/canvas/nodes/AgentNode.tsx`, `webview-ui/src/App.tsx`

#### 동작 흐름

```
1. 사용자가 Right Panel (Library)에서 Skill 항목을 드래그 시작
2. 캔버스 위의 Agent 노드로 가져감
3. Agent 노드에 드롭 하이라이트 표시
4. 드롭하면 해당 Skill이 Agent에 할당됨
5. extension에 메시지 전송 → 파일 시스템 반영 (해당 Agent의 스킬 디렉토리에 심볼릭 링크 또는 설정 파일 수정)
```

#### 구현 요소

**RightPanel — 드래그 시작**:
```tsx
// Library의 각 Skill/MCP 항목
<div
  draggable
  onDragStart={(e) => {
    e.dataTransfer.setData("application/agentcanvas-skill", JSON.stringify({
      type: "skill",
      id: skill.id,
      name: skill.name
    }));
    e.dataTransfer.effectAllowed = "copy";
  }}
  className="library-item draggable"
>
```

**AgentNode — 드롭 수신**:
```tsx
const handleDragOver = (e: React.DragEvent) => {
  if (e.dataTransfer.types.includes("application/agentcanvas-skill") ||
      e.dataTransfer.types.includes("application/agentcanvas-mcp")) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDropHighlight(true);
  }
};

const handleDrop = (e: React.DragEvent) => {
  e.preventDefault();
  setDropHighlight(false);
  const skillData = e.dataTransfer.getData("application/agentcanvas-skill");
  if (skillData) {
    const parsed = JSON.parse(skillData);
    data.onAssignSkill?.(data.id, parsed.id);
  }
  // MCP도 동일 패턴
};
```

#### 신규 메시지 타입

**파일**: `webview-ui/src/messaging/protocol.ts`, `extension/src/messages/protocol.ts`

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
```

---

### 3.5 Orchestrator 시각화

**파일**: `webview-ui/src/canvas/GraphView.tsx`, `webview-ui/src/styles.css`

#### 엣지 스타일 구분

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

#### GraphView에 delegates 엣지 추가

```typescript
// toFlowEdges 함수에 추가
: edge.type === "delegates"
  ? { stroke: palette.delegates, strokeWidth: 3 }
```

---

### 3.6 Agent 생성 기능

**현재**: Agent는 discovery에서 자동 감지만 됨 (Provider가 반환하는 Agent만 존재)
**목표**: 사용자가 캔버스에서 직접 새 Agent를 생성할 수 있음

#### 신규 기능: "New Agent" 버튼/커맨드

**파일**: `webview-ui/src/App.tsx`, `extension/src/extension.ts`

```
CommandBar → "Create new agent" 선택
→ AgentCreationModal 팝업
→ 이름, 역할, 설명 입력
→ extension에 CREATE_AGENT 메시지 전송
→ 해당 Agent용 디렉토리 + 설정 파일 생성
→ 캔버스에 노드 추가
```

#### 신규 메시지

```typescript
| RequestMessage<"CREATE_AGENT", {
    name: string;
    role: AgentRole;
    roleLabel?: string;
    description?: string;
    systemPrompt?: string;
    isOrchestrator?: boolean;
  }>

| RequestMessage<"DELETE_AGENT", {
    agentId: string;
  }>
```

---

### 3.7 오른쪽 패널 MCP 섹션 추가

**파일**: `webview-ui/src/panels/RightPanel.tsx`

#### 현재 Library 구성

```
Skills  (목록)
Rule Docs  (목록)
New Skill  (폼)
```

#### 개선 Library 구성

```
Skills  (목록, 드래그 가능)
MCP Servers  (목록, 드래그 가능)  ← 신규
Rule Docs  (목록)
New Skill  (폼)
```

MCP 서버도 Library 패널에서 보이고, 드래그해서 Agent에 할당할 수 있게 한다.

```tsx
<div className="library-block">
  <div className="library-title">MCP Servers</div>
  {mcpServers.map((server) => (
    <div
      key={server.id}
      className="library-item draggable"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/agentcanvas-mcp", JSON.stringify({
          type: "mcp",
          id: server.id,
          name: server.name
        }));
      }}
    >
      <div className="item-main">
        <div className="item-title">{server.name}</div>
        <div className="item-subtitle">{server.kind} · {server.providerId}</div>
      </div>
    </div>
  ))}
</div>
```

---

### 3.8 Extension 백엔드 처리

**파일**: `extension/src/extension.ts`, `extension/src/services/discovery.ts`

#### 3.8.1 Agent 프로필 저장

Agent 프로필(role, description, systemPrompt 등)은 워크스페이스에 저장해야 한다.

**저장 위치 옵션**:

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

각 Agent JSON 파일:

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

#### 3.8.2 Discovery 통합

`discovery.ts`의 `buildGraph`에서 `.agentcanvas/agents/` 디렉토리를 읽어 Agent 프로필을 로드하고, 기존 Provider 기반 Agent와 병합.

```typescript
// discovery.ts에 추가
async function loadCustomAgentProfiles(workspacePath: string): Promise<AgentProfile[]> {
  const agentsDir = join(workspacePath, ".agentcanvas", "agents");
  // JSON 파일들을 읽어서 AgentProfile[]로 변환
}
```

#### 3.8.3 Skill/MCP 할당 처리

Skill을 Agent에 할당할 때의 extension 측 처리:

```typescript
// ASSIGN_SKILL_TO_AGENT 핸들러
case "ASSIGN_SKILL_TO_AGENT": {
  const { agentId, skillId } = message.payload;
  // 1. Agent 프로필 JSON 로드
  // 2. assignedSkillIds에 skillId 추가
  // 3. JSON 저장
  // 4. refreshState 호출하여 캔버스 갱신
}
```

---

## 4. 캔버스 시각화 예시

### 4.1 기본 Orchestrator 패턴

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

### 4.2 Agent Detail 모달 (더블클릭)

```
┌─────────────────────────────────────────────┐
│  🎯 Main Orchestrator                       │
│  Agent ID: orchestrator-main                │
├─────────────────────────────────────────────┤
│  [Overview]  [Skills (2)]  [Rules (3)]  [MCP (1)]  │
├─────────────────────────────────────────────┤
│                                             │
│  Role: orchestrator                         │
│  Label: 팀 리더                              │
│  Description: 모든 작업을 분배하고...         │
│  ☑ Is Orchestrator                          │
│                                             │
│  Delegates to:                              │
│  ┌─────────┐  ┌──────────┐                  │
│  │ 💻 Coder │  │ 🔍 Reviewer│  [+ Add]      │
│  └─────────┘  └──────────┘                  │
│                                             │
│  System Prompt:                             │
│  ┌─────────────────────────────────────┐    │
│  │ You are the main orchestrator...    │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  [Save]                    [Close]          │
└─────────────────────────────────────────────┘
```

### 4.3 드래그 앤 드롭 흐름

```
  Right Panel (Library)          Canvas
  ┌──────────────────┐          ┌──────────────────┐
  │ Skills           │          │                  │
  │ ┌──────────────┐ │  drag   │  ┌────────────┐  │
  │ │ 📦 code-gen  │─┼────────→│  │ 💻 Coder   │  │
  │ └──────────────┘ │  →drop  │  │ (하이라이트)│  │
  │ ┌──────────────┐ │          │  └────────────┘  │
  │ │ 📦 test-run  │ │          │                  │
  │ └──────────────┘ │          │                  │
  │                  │          │                  │
  │ MCP Servers      │          │                  │
  │ ┌──────────────┐ │  drag   │  ┌────────────┐  │
  │ │ 🔌 GitHub    │─┼────────→│  │ 🔍 Reviewer│  │
  │ └──────────────┘ │  →drop  │  │ (하이라이트)│  │
  │ ┌──────────────┐ │          │  └────────────┘  │
  │ │ 🔌 Jira      │ │          │                  │
  │ └──────────────┘ │          └──────────────────┘
  └──────────────────┘
```

---

## 5. 구현 순서 (로드맵)

```
Phase 1 — 데이터 모델 + Role UI (2~3일)
├── AgentProfile 타입에 role, description, isOrchestrator 등 추가
├── AgentNode.tsx에 Role 배지, description, 리소스 카운트 표시
├── AgentDetailModal에 Overview 탭 추가
├── extension에 UPDATE_AGENT_PROFILE 메시지 핸들러
└── .agentcanvas/agents/ 디렉토리에 JSON 저장/로드

Phase 2 — Orchestrator 시각화 (1~2일)
├── delegates 엣지 타입 + 스타일 추가
├── Orchestrator 노드 차별화 CSS
├── SET_DELEGATION 메시지 처리
└── discovery.ts에서 delegation 관계를 edges로 변환

Phase 3 — 드래그 앤 드롭 (2~3일)
├── RightPanel Library 항목에 draggable 속성 추가
├── MCP Servers 섹션을 Library에 추가
├── AgentNode에 onDragOver/onDrop 핸들러 구현
├── ASSIGN_SKILL_TO_AGENT / ASSIGN_MCP_TO_AGENT 메시지 처리
├── AgentDetailModal의 Skills/MCP 탭에서 할당/해제 버튼 추가
└── extension에서 Agent 프로필 JSON의 assigned 배열 업데이트

Phase 4 — Agent 생성/삭제 (1~2일)
├── AgentCreationModal 컴포넌트 생성
├── CommandBar에 "Create Agent" 커맨드 추가
├── CREATE_AGENT / DELETE_AGENT 메시지 처리
└── extension에서 .agentcanvas/agents/ 파일 생성/삭제
```

---

## 6. 파일별 수정 범위

| 파일 | 수정 내용 | Phase |
|------|----------|-------|
| `extension/src/types.ts` | AgentProfile 확장, StudioEdge에 `delegates` 추가 | 1 |
| `webview-ui/src/messaging/protocol.ts` | 동기화 + 신규 메시지 6종 | 1, 3 |
| `extension/src/messages/protocol.ts` | 동기화 + 신규 메시지 6종 | 1, 3 |
| `webview-ui/src/canvas/nodes/AgentNode.tsx` | Role 배지, description, 드롭 핸들러 | 1, 3 |
| `webview-ui/src/panels/AgentDetailModal.tsx` | Overview 탭 추가, Skills/MCP 할당 UI | 1, 3 |
| `webview-ui/src/panels/RightPanel.tsx` | MCP 섹션 추가, draggable 속성 | 3 |
| `webview-ui/src/styles.css` | Orchestrator 스타일, 드롭 하이라이트, delegates 엣지 | 1, 2, 3 |
| `webview-ui/src/canvas/GraphView.tsx` | delegates 엣지 스타일, 드롭 이벤트 전파 | 2, 3 |
| `webview-ui/src/App.tsx` | AgentCreationModal 통합, 신규 핸들러 연결 | 1, 4 |
| `extension/src/extension.ts` | 신규 메시지 핸들러 6종, Agent JSON 저장/로드 | 1, 2, 3, 4 |
| `extension/src/services/discovery.ts` | 커스텀 Agent 로드, delegates 엣지 생성 | 1, 2 |
| **신규**: `AgentCreationModal.tsx` | Agent 생성 모달 컴포넌트 | 4 |
| **신규**: `extension/src/services/agentProfileService.ts` | Agent JSON CRUD 서비스 | 1 |

---

## 7. 주의사항

### 7.1 기존 Provider 기반 Agent와의 호환

현재 Agent는 Provider(codex, vscode)가 자동 감지한다. 커스텀 Agent를 추가할 때 기존 Agent와 ID 충돌이 없도록 네임스페이스를 분리해야 한다.

```
기존: "vscode-workspace", "codex-default"  (Provider가 생성)
커스텀: "custom:orchestrator-main"          (사용자가 생성, "custom:" 접두사)
```

### 7.2 파일 시스템 반영

Skill/MCP 할당은 UI에서의 논리적 매핑이다. 실제 Agent 프레임워크(Claude, Codex 등)가 이를 인식하려면 각 프레임워크의 설정 파일 형식에 맞게 변환이 필요할 수 있다. MVP에서는 `.agentcanvas/agents/*.json`에 저장하고, 프레임워크별 export는 별도 기능으로 분리한다.

### 7.3 드래그 앤 드롭과 React Flow

React Flow 캔버스 위에서의 드래그 앤 드롭은 React Flow의 내부 드래그 이벤트와 충돌할 수 있다. `onDragOver`에서 `e.preventDefault()`를 호출하고, React Flow의 `nodesDraggable` 속성과 충돌하지 않도록 주의가 필요하다. 드롭 대상은 AgentNode 내부 `div`로 한정한다.
