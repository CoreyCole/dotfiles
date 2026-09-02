---
name: q-ceo
description: Coordinates lead-engineer tasks through durable Pi q-manager children.
compatibility: 'Requires durable Pi child tools: subagent, subagent_steer, subagent_peek, and subagent_stop.'
disable-model-invocation: true
---

# q-ceo

Own the lead engineer's task set. Start one durable `q-manager` child for each independent task. Keep one task, one manager, and one plan directory.

## Start managers

1. List the bounded tasks and their dependencies.
1. Give each task a unique stable manager name.
1. Start independent managers in parallel.
1. Start each manager with:
   - no specialist `agent` value;
   - `skills: "q-manager,qrspi-planning"` and `autoExit: false`;
   - the repository or prepared workspace as `cwd`;
   - the explicit task, constraints, and plan directory, or a bootstrap instruction.
1. Omit `model` so the manager uses the session default.

## Route manager reports

Manager settlement wakes you. Do not poll or request raw specialist output.

- On **Complete**, record the task outcome and report the durable evidence to the lead.
- On **Blocked**, resolve the smallest action or escalate it to the lead.
- On **Decision**, present the manager's options, tradeoffs, and recommendation to the lead.

Send lead answers to the same manager with `subagent_steer`. Preserve exact child identities. Do not route by latest child or ambiguous display name. Start no replacement until the durable manager cannot continue.

The manager owns QRSPI coordination. The CEO does not inspect implementation details, write plan artifacts, or direct specialists.
