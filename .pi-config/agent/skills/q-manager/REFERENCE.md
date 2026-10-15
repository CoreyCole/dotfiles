# q-manager reference

## Hierarchy

```text
lead engineer
└── q-ceo
    ├── q-manager: task A
    │   ├── planner
    │   ├── scout
    │   ├── reviewer
    │   └── worker
    └── q-manager: task B
        └── specialists
```

The CEO owns the task set. Each manager owns one task and one QRSPI plan directory. Specialists own artifacts and implementation work.

## Parent launch

q-ceo starts each manager with `agent: q-manager`, `skills: q-manager,qrspi-planning`, and `autoExit: false`. The agent file loads the `q-manager` skill and keeps spawning enabled. Do not start a manager as `worker`, `planner`, `scout`, or `reviewer`. A steer cannot repair that launch or the default exit.

The manager does not pass `autoExit: false` to a worker, scout, reviewer, or planner. Those children keep the default so their stop wakes the manager.

## Context budget

A manager keeps only:

- task and plan identity;
- current stage and human gate;
- specialist child identities;
- artifact paths;
- concise evidence, blockers, and decisions.

A manager does not ingest full code, diffs, test logs, research reports, or planning documents. It delegates review and asks children for bounded summaries.

## Routing

Use unique child names and exact child identities. A new worker is for a new approved vertical slice. The same subtask stays on the same child. Child settlement wakes the manager. Continue that child with `subagent_steer`. Do not spawn a replacement for a follow-up on the same subtask.

Report to the CEO only when:

- the task is complete;
- work is blocked after bounded recovery;
- a critical design decision needs lead judgment.

While specialists run, the manager stays up only if it was started with `autoExit: false`. Specialist stop wakes that manager, not the CEO. A specialist started with `autoExit: false` does not give the manager that stop.

## Recovery

After a provider or process error, reuse the durable child when it can continue. Start a replacement only when the prior child cannot continue. Never select a latest plan, workspace, or child.

Do not add polling, tmux, manager state files, result parsers, graph transitions, or notification protocols.
