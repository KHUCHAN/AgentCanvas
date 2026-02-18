# Majority Vote Tiebreak

## Intent / When to use
- Intent: verify
- Use when topology broadcast fits the task.

## Roles
- EvaluatorA(agent)
- EvaluatorB(agent)
- EvaluatorC(agent)
- Judge(system)

## Protocol Steps
1. Initialize roles and shared context.
2. Exchange structured messages according to topology.
3. Evaluate outputs and apply termination rule.

## Defaults
- Topology: broadcast
- Sync: req_res
- Termination: {"type":"consensus_threshold","threshold":0.6}

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
