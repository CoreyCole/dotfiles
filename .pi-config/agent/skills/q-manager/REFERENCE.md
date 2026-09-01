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

## Context budget

A manager keeps only:

- task and plan identity;
- current stage and human gate;
- specialist child identities;
- artifact paths;
- concise evidence, blockers, and decisions.

A manager does not ingest full code, diffs, test logs, research reports, or planning documents. It delegates review and asks children for bounded summaries.

## Routing

Use unique child names and exact child identities. Child settlement wakes the manager. Continue the same specialist with `subagent_steer` for routine corrections.

Report to the CEO only when:

- the task is complete;
- work is blocked after bounded recovery;
- a critical design decision needs lead judgment.

Intermediate settlements use `In progress; no CEO action.`

## Recovery

After a provider or process error, reuse the durable child when it can continue. Start a replacement only when the prior child cannot continue. Never select a latest plan, workspace, or child.

Do not add polling, tmux, manager state files, result parsers, graph transitions, or notification protocols.
