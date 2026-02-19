# AGENT_COMMS.md
AgentCanvas - Image Handling and Communication Protocol

## Message Structure
1. Intent: one-line objective.
2. Inputs and assumptions: files, paths, constraints.
3. Plan: 3-7 ordered steps.
4. Actions and artifacts: changed files and command results.
5. Open questions: max 1-3 concrete questions.

## Handoff Protocol
Use this block when passing work between agents:

```
HANDOFF
Context:
Goal:
DoD:
SandboxWorkDir:
ProposalJson:
ChangedFiles:
- path/to/file
Tests:
- (optional) npm test ...
Next:
- Orchestrator: review + apply or request changes
```

## Image Rules
- Ask for screenshots when the task is visual (layout, spacing, hover/focus states).
- Do not guess unreadable text from images; request a clearer image.
- For Codex CLI image attachments:
  - `codex -i ./screenshots/ui.png "Analyze this UI issue."`
- Do not commit sensitive screenshots (tokens, emails, private data).

## Tone and Style
- Direct, technical, and concise.
- Use bullet lists and checklists.
- Explicitly report failures and blockers.

## Definition of Done Templates
### UI
- [ ] Canvas renders without errors.
- [ ] Tidy/Auto layout produce stable placements.
- [ ] Keyboard shortcuts work (Tab, +/-, 0, 1, Space+drag, Shift+S).
- [ ] Inspector data matches selected node.
- [ ] Theme colors follow VS Code variables.

### Skills
- [ ] `SKILL.md` validation passes (name/description).
- [ ] Folder name and frontmatter `name` match.
- [ ] Export/Import works with conflict handling.
