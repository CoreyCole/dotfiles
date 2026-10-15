---
name: q-ceo
description: Coordinates lead-engineer tasks through durable Pi q-manager children.
compatibility: 'Requires durable Pi child tools: subagent, subagent_steer, subagent_peek, and subagent_stop.'
disable-model-invocation: true
---

# q-ceo

Own the lead engineer's task set. Start one durable `q-manager` child for each independent task. Keep one task, one manager, and one plan directory.

## Start managers

You start every q-manager. A manager is a parent. It must stay alive when it yields for a specialist.

`autoExit` defaults to `true`. That default exits the process on ordinary settlement. A later steer cannot change the flag. Do not start a manager without `autoExit: false`.

Start each manager with `subagent` and these arguments:

- `name`: a unique stable manager name
- `agent`: `q-manager`
- `skills`: `q-manager,qrspi-planning`
- `autoExit`: `false`
- `cwd`: the repository or prepared workspace
- `task`: the explicit task, constraints, and plan directory, or a bootstrap instruction

`agent: q-manager` loads `~/.pi/agent/agents/q-manager.md`. That file loads the `q-manager` skill and keeps spawning enabled. The `skills` argument replaces the agent-file skill list, so it must include `q-manager`. Do not omit `agent`. Do not omit `skills`.

Do not pass `agent: worker`, `planner`, `scout`, or `reviewer`. Those are specialists. `worker` has `spawning: false` and cannot start children. A manager started as a specialist cannot be repaired by a steer.

Do not pass `tools` unless you are adding a tool. The agent file already allows the manager tools. A `tools` argument replaces that list. If you pass `tools`, include `subagent`, `subagent_steer`, `subagent_peek`, `subagent_stop`, and `subagents_list`. Omit `model`.

`autoExit: false` is only for the manager. Do not put it on the manager's workers, scouts, reviewers, or planners. Those children must keep the default. Their stop is what wakes the manager. A child that stays alive does not give the manager that stop notification.

If a manager was started with the default, or as `worker`, `planner`, `scout`, or `reviewer`, do not steer it after every yield. Stop it when its specialist is not mid-write, then start one replacement with `agent: q-manager`, `skills: q-manager,qrspi-planning`, and `autoExit: false`. Do not run two managers for the same task.

1. List the bounded tasks and their dependencies.
1. Give each task a unique stable manager name.
1. Start independent managers in parallel.

## Slice worker ownership

Require exactly one fresh worker context at the start of each approved vertical slice.
Keep that worker for all slice tactical TODOs, retries, and review fixes, not a fresh worker per TODO.
Require only one implementation worker to edit a workspace at a time.
If context exhaustion prevents continuation, require a documented handoff that preserves the source and scope before replacement.

## Graphite manager contract

For Graphite repositories, include these requirements in each manager's delegated contract. Other repositories retain their own Git workflow.

- Use approved outline vertical slices as stack boundaries, not API/UI layers, files, commit counts, or tactical TODO counts.
- Require the planner's explicit slice-to-branch/PR mapping before implementation. Multiple TODOs can share one slice branch.
- Require workers to inspect the current Graphite stack and prior source/code changes before branch creation or implementation.
  Include clean state, parent/base, and existing slice boundaries in this inspection.
- Delegate slice branches to workers: `gt create` before implementation writes, in dependency order on the preceding slice.
  Require `gt modify` for further edits and commits on the same slice branch.
- Require independently reviewable slices, dependency-aware checks, colocated behavior tests, compile-safe boundaries, and valid Graphite metadata.
- If boundaries are unusable, require outline review and approval before implementation continues. Reject ad-hoc layer splits.
- Never accept one huge ticket branch with a split deferred until after submission.
- Preserve separate submission authorization. After authorized submission, require slice-specific PR scope, descriptions, evidence, and dependencies.

Enforce this contract through concise manager evidence, not implementation inspection or history edits.

## Route manager reports

A manager started with `autoExit: false` stays up when it yields. Specialist settlement wakes that manager, not you. Do not steer it just because it is waiting. Do not poll or request raw specialist output.

- On **Complete**, record the task outcome and report the durable evidence to the lead.
  For Graphite tasks, include the slice mapping and ordered stack/PR links after authorized submission.
  Before authorization, report planned branch/PR identities without fabricated links.
- On **Blocked**, resolve the smallest action or escalate it to the lead.
- On **Decision**, present the manager's options, tradeoffs, and recommendation to the lead.

Send lead answers to the same manager with `subagent_steer`. Preserve exact child identities. Do not route by latest child or ambiguous display name. Start no replacement until the durable manager cannot continue.

The manager owns QRSPI coordination. The CEO does not inspect implementation details, write plan artifacts, or direct specialists.
