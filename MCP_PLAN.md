# MCP_PLAN.md
AgentCanvas - MCP Integration Plan

## Goals
- Manage MCP servers for Codex and VS Code from one UI.
- Keep secure defaults (allowlist tools, timeout controls).
- Avoid secret leakage (store env var names, not token values).

## Target Integrations
### Codex MCP
- Source files:
  - user: `~/.codex/config.toml`
  - project: `.codex/config.toml` (trusted workspace only)
- Server key format: `[mcp_servers.<name>]`
- Support stdio and HTTP server definitions.

### VS Code MCP
- Source file: `.vscode/mcp.json`
- Support workspace-shared server definitions.
- Preserve existing server entries when editing.

## UX Proposal
- Add an MCP tab in the right panel:
  - Codex MCP
  - VS Code MCP
- Actions:
  - Add server (wizard)
  - Enable/disable
  - Tool allow/deny config
  - Config diff preview before write

## Security Defaults
- Use `enabled_tools` allowlist by default.
- Display explicit warning for local stdio servers (arbitrary code execution).
- Never store raw tokens in config files.
- Store credential references only as env var names.

## Incremental Build Plan
1. Read/parse Codex and VS Code MCP config files.
2. Render MCP server list in AgentCanvas UI.
3. Implement add/edit/delete with schema validation.
4. Add diff preview and apply changes.
5. Add smoke checks and docs.
