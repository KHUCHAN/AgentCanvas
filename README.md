# AgentCanvas

AgentCanvas is a VS Code extension for designing and operating multi-agent systems on a visual canvas.
It combines agent modeling, role/delegation management, prompt-driven team generation, and interaction pattern composition in one workspace.

## What This Project Includes

- n8n-style canvas UI for agent orchestration
- Agent lifecycle management
  - Create/Delete custom agents
  - Role, description, system prompt, avatar, color editing
  - Orchestrator delegation links
- Skill and MCP assignment
  - Drag-and-drop from library to agent nodes
  - Assign/Unassign from agent detail modal
- AI Prompt workflow
  - CLI backend detection (Auto / Claude / Gemini / Codex / Aider / Custom)
  - Prompt-to-team generation
  - Preview and apply generated structures
  - Prompt history (reapply/delete)
- Interaction Pattern Library
  - 20 predefined interaction patterns
  - Pattern insert via button or drag/drop
  - Interaction edge inspector with termination validation
- Flow and observability support
  - Save/Load flow files: `.agentcanvas/flows/*.yaml`
  - Interaction event logs: `.agentcanvas/logs/<flow>/<date>.jsonl`
- Quality gates
  - Build + typecheck pipeline
  - Integration test scenarios and runnable integration script

## Architecture Overview

- `extension/`: VS Code extension backend (discovery, messaging, flow/log persistence, CLI execution)
- `webview-ui/`: React + React Flow frontend (canvas, node library, inspector, modal workflows)
- `resources/patterns/`: interaction pattern JSON templates
- `docs/interaction-patterns/patterns/`: interaction pattern documentation
- `scripts/integration-tests.cjs`: integration test runner

## Quick Start

```bash
npm install
npm --prefix webview-ui install
npm run check
```

Then in VS Code:

1. Open this project folder.
2. Press `F5` to launch Extension Development Host.
3. Open Command Palette and run `AgentCanvas: Open`.

## How to Use

### 1) Build your agent graph

1. Click `New Agent` to create custom agents.
2. Double-click an agent node to open `Agent Detail`.
3. In `Overview`, set role, description, and orchestrator options.
4. In `Delegates To`, choose worker agents for orchestration links.

### 2) Assign skills and MCP servers

1. Open `Node Library` on the right panel.
2. Drag a `Skill` item onto an agent node to assign it.
3. Drag an `MCP Server` item onto an agent node to assign it.
4. Use `Agent Detail -> Skills/MCP` tabs to unassign or adjust mappings.

### 3) Generate teams from prompt

1. Open the `AI Prompt` tab.
2. Select backend (`Auto`, `Claude`, `Gemini`, `Codex`, `Aider`, or `Custom`).
3. Enter a request (for example: code review team with orchestrator + workers).
4. Click `Generate Agent Team`.
5. Review the preview modal and click `Apply to Canvas`.

### 4) Use interaction patterns

1. In `Node Library`, find `Interaction Patterns`.
2. Click `Insert` or drag a pattern onto the canvas.
3. Click an interaction edge, open Inspector, and edit interaction JSON.
4. Keep a valid `termination` field (required for saving valid interaction config).

### 5) Save and reload flows

1. Click `Save Flow` to persist current interaction graph.
2. Click `Load Flow` and enter/select a saved flow name.
3. Check logs in `.agentcanvas/logs/<flow>/<date>.jsonl` for interaction events.

## Integration Tests

```bash
npm run test:integration
```

Covers:

- Build/type integrity
- Pattern assets/schema consistency
- Prompt parser/history roundtrip
- Agent profile CRUD/assignment/delegation
- CLI backend detection shape
- Flow save/load/list roundtrip
- Interaction JSONL log append

## UI Screenshot

![AgentCanvas UI](docs/screenshots/agentcanvas-ui.png)

## Known Issues & Pending Fixes (2026-02-20)

> 상세 스펙은 각 문서 참조. 구현 상태는 코드 정적 분석으로 검증.

| ID | 심각도 | 증상 | 관련 파일 | 스펙 |
|----|--------|------|----------|------|
| NEW-1 | 🔴 P0 | Chat 메시지 보내도 화면에 미표시 | `App.tsx:1717` | UI_REVISION_WORKORDER §TASK-9 |
| NEW-2 | 🔴 P0 | Rebuild 후 기존 Agent 미삭제 | `AgentPreviewModal.tsx:37` | UI_REVISION_WORKORDER §TASK-8 |
| NEW-3 | 🟠 P1 | Orchestrator Backend가 Chat에 미반영 | `App.tsx:136` | UI_REVISION_WORKORDER §TASK-11 |
| NEW-4 | 🟠 P1 | Build Prompt Bar가 Zoom 버튼 가림 | `styles.css` | UI_REVISION_WORKORDER §TASK-16 |
| NEW-5 | 🟡 P2 | 팀 Apply 후 노드 겹침/미정렬 | `GraphView.tsx` | UI_REVISION_WORKORDER §TASK-17 |
| NEW-6 | 🟡 P2 | CLI 모델 목록 최신화 필요 | `backendProfiles.ts` | AGENT_TEAM_BUILD_SPEC §12.3 |

## Related Docs

- `README.md`
- `INTEGRATION_TEST_SCENARIOS.md`
- `AGENT_SYSTEM.md`
- `PROMPT_TO_AGENTS.md`
- `agent communication.md`
- `BUG_FIX_SPEC.md` — 전체 버그/기능 분석 원본
- `UI_REVISION_WORKORDER.md` — UI 수정 작업지시서 (1차 + 2차)
- `CODE_REVIEW2.md` — 코드 리뷰 이슈 목록 (1차 23건 + 2차 9건)
- `CHAT_WORKFLOW_SPEC.md` — Chat 시스템 설계
- `AGENT_TEAM_BUILD_SPEC.md` — 팀 빌드 & 모델 스펙
