# Integration Test Scenarios

## Scope
- AGENT_SYSTEM profile CRUD, assignment, delegation
- PROMPT_TO_AGENTS parser/history/backend detection pipeline pieces
- agent communication pattern assets and pattern schema constraints
- End-to-end build/typecheck for extension + webview

## Scenarios
1. Build + type integrity
- Command: `npm run check`
- Expected: webview build, extension build, webview typecheck all pass.

2. Pattern asset integrity (20 patterns)
- Verify `resources/patterns/*.json` count and schema.
- Verify `docs/interaction-patterns/patterns/*.md` exists for every pattern id.
- Verify `webview-ui/public/patterns/index.json` references 20 entries.
- Expected: every interaction edge has `data.termination.type`.

3. Generated structure parsing (fenced JSON)
- Use parser on markdown-fenced JSON.
- Expected: parser extracts JSON, validates shape, returns at least one orchestrator.

4. Prompt history roundtrip
- Append history entry -> read -> mark applied -> find -> delete.
- Expected: state transitions reflected exactly.

5. Agent profile roundtrip
- Create custom agent -> patch profile -> assign skill/MCP -> set delegation -> list -> delete.
- Expected: persisted fields include assignments/delegation and clean delete.

6. CLI detector shape
- Run backend detector.
- Expected: includes `auto` and known backend ids in result.

7. Flow store roundtrip
- Save a flow to `.agentcanvas/flows/<name>.yaml` (JSON-as-YAML format).
- List flows and load back the saved flow.
- Expected: saved flow name appears in list, nodes/edges count preserved.

8. Interaction observability log append
- Append one interaction event to `.agentcanvas/logs/<flow>/<date>.jsonl`.
- Expected: latest JSONL row contains correct `interactionId`, `edgeId`, `event`.

## Execution
- Primary command: `npm run check`
- Integration suite command:
  - `node scripts/integration-tests.cjs`
