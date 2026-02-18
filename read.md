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

## Related Docs

- `README.md`
- `INTEGRATION_TEST_SCENARIOS.md`
- `AGENT_SYSTEM.md`
- `PROMPT_TO_AGENTS.md`
- `agent communication.md`
