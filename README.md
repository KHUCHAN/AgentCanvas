# AgentCanvas

AgentCanvas is a VS Code extension that discovers agent skills and rule documents, visualizes them on an n8n-style canvas, and supports packaging/importing skill packs.

## Implemented MVP Scope

- Extension command: `AgentCanvas: Open`
- Extension + Webview scaffolding (TypeScript + Vite React + React Flow)
- Discovery providers
  - `AgentSkillsProvider`
    - Scans project/personal skill locations
    - Reads `chat.agentSkillsLocations`
    - Parses `SKILL.md` frontmatter with `gray-matter`
    - Validates `name`, `description`, folder-name consistency + reference warnings
  - `CodexGuidanceProvider`
    - Detects global `CODEX_HOME`/`~/.codex` AGENTS file (`AGENTS.override.md` first)
    - Builds project AGENTS chain from root to workspace path
    - Reads Codex `config.toml` for `project_root_markers` and fallback filenames
- Canvas UX
  - Dot grid background
  - Node types: `agent`, `provider(GPT/Claude/Gemini)`, `skill`, `ruleDoc`, `folder`, `note`
  - Hover actions: open/enable-disable/hide/override/reveal/export
  - Node Library + Inspector split panel
  - Double click node to open
  - Floating controls: fit / zoom in / zoom out / reset / tidy
  - Dual layout actions: `Tidy` (deterministic) and `Auto` (dagre)
  - Empty placeholder: `Add first agent / Add first skill`
  - Status bar summary (skills/rules/errors/warnings)
  - Right-top canvas action: `+ Rule` (add common rule)
- Inspector
  - Skill details + validation list
  - Actions: open / reveal / validate / export
  - Frontmatter edit form: `name`, `description`, `extraFrontmatter(JSON)` + save
  - Rule doc details + chain order + create override
- Skill creation
  - Skill Wizard modal with validation (`name`/`description`)
  - Scope selection + optional `agents/openai.yaml` generation
  - Template-based `SKILL.md` creation
- Shortcuts
  - Pan: `Ctrl+drag`, `Space+drag`, `Middle drag`
  - Zoom: `Ctrl+Wheel`, `+`, `-`, `0`, `1`
  - Library: `Ctrl/Cmd+L` and `+`
  - Sticky note: `Shift+S`
  - Command bar: `Ctrl/Cmd+K` (plus top bar button)
- Common rule workflow
  - `Common Rule` button or canvas `+ Rule` opens modal
  - Appends rule section into workspace-root `AGENTS.md`
  - Automatically refreshes and renders as rule node
  - `Ops Docs` action generates shared ops docs under `.agentcanvas/rules/common`
- Skill pack share
  - Export selected skills to zip
  - `skillpack.json` manifest included
  - Import preview before install (skill list + warnings)
  - Risk warnings for `scripts/` and `allowed-tools`
  - Conflict policy default suffix (`-1`, `-2`, ...)
  - Optional overwrite mode
- Safety and resilience improvements
  - Zip/path traversal guards for pack import and skill creation
  - Runtime message validation in webview bridge
  - ErrorBoundary for webview rendering failures
  - Basic accessibility upgrades (dialog ARIA + control labels + reduced-motion)

## Development

```bash
npm install
npm --prefix webview-ui install
npm run build
npm run check
```

## Run in VS Code

1. Open this folder in VS Code.
2. Press `F5` to open Extension Development Host.
3. Run command: `AgentCanvas: Open`.

## Optional Dev Webview Mode

Set VS Code setting:

- `agentCanvas.webviewDevServerUrl`: e.g. `http://localhost:5173`

When set, the extension tries to load the webview from that dev server. If unavailable, it falls back to bundled `webview-ui/dist` assets.

## Project Paths

- `/Users/gimchan-yeong/Desktop/Open Claw/extension/src`
- `/Users/gimchan-yeong/Desktop/Open Claw/webview-ui/src`
- `/Users/gimchan-yeong/Desktop/Open Claw/mvp.md`
