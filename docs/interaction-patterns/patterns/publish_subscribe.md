# Publish Subscribe

## Intent / When to use
- Intent: align
- Use when topology broadcast fits the task.

## Roles
- Publisher(agent)
- SubscriberA(agent)
- SubscriberB(agent)

## Protocol Steps
1. Initialize roles and shared context.
2. Exchange structured messages according to topology.
3. Evaluate outputs and apply termination rule.

## Defaults
- Topology: broadcast
- Sync: async
- Termination: {"type":"timeout_ms","ms":180000}

## Failure modes & mitigations
- Cascading hallucination: add verifier/judge and bounded rounds.
- Infinite loops: enforce timeout/max_rounds guard.
- Context drift: require structured_json message form.

## UI mapping
- Render role nodes as agent/system nodes.
- Render coordination links as interaction edges.
- Validate termination before saving.

## Sources
- survey-2025-multi-agent
- agent communication.md
