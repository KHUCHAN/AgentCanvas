# AGENT_COMMS_AND_OPS.md
AgentCanvas — Communication, Memory, and Ops Rules

## Design Principles
- File-first rules: durable instructions belong in markdown files.
- Deterministic enforcement over memory-only guidance.
- Least context: keep active MCP servers and skill context minimal.
- Isolation by default: avoid context bleed across users/channels.

## Standard Response Format
1. Intent
2. Assumptions and inputs
3. Plan
4. Actions and artifacts
5. Risks and safety notes
6. Next steps or DONE

## Memory Policy
- Durable decisions and preferences go to `MEMORY.md`.
- Daily execution notes go to `memory/YYYY-MM-DD.md`.
- Assume compaction can lose early chat details; keep stable rules in files.

## Skills Safety
- `user-invocable` affects menu visibility only.
- `disable-model-invocation` is the hard safety gate.
- Destructive or secret-touching skills require explicit human invocation.

## MCP Policy
- Keep MCP minimal (default 0-2 servers).
- Store environment variable names, not raw tokens.
- Prefer allowlisted tool access.

## Isolation and Stop Control
- Sessions must be isolated across users/channels.
- Provide a visible stop action for stuck loops.

## Handoff Format
HANDOFF
Context:
Goal:
DoD:
Files:
Next:
