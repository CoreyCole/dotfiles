# q-manager reference

## Hierarchy

Child manager:

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

Top-level manager, for a smaller task that needs high human touch:

```text
lead engineer
└── q-manager
    ├── planner
    ├── scout
    ├── reviewer
    └── worker
```

There is no q-ceo in that tree. The human talks to the manager. The CEO owns the task set only in the child-manager tree. Each manager owns one task and one QRSPI plan directory in the lead engineer's thoughts directory. The lead engineer is the git user on this machine. Run `scripts/spec_metadata.sh`. Use the printed `Git Username`. The plan directory is `thoughts/<Git Username>/plans/<timestamp>_<plan-name>/`. Do not create `thoughts/qrspi`. Do not select a latest plan. Already committed plans under `thoughts/qrspi` move to the committer who wrote them. New QRSPI plans use the git user from `scripts/spec_metadata.sh`. Specialists own artifacts and implementation work.

## Parent launch

q-ceo starts each child manager with `agent: q-manager`, `skills: q-manager,qrspi-planning`, and `autoExit: false`. The agent file loads the `q-manager` skill and keeps spawning enabled. Do not start a manager as `worker`, `planner`, `scout`, or `reviewer`. A steer cannot repair that launch or the default exit. A top-level manager is the session the human is typing into. It is not started by q-ceo, and it does not use `autoExit`.

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

Use unique child names and exact child identities. A new worker is for a new approved vertical slice. The same subtask stays on the same child while its context is under 200k tokens. Child settlement wakes the manager. Continue that child with `subagent_steer`. Do not spawn a replacement for a follow-up on the same subtask only because the last turn settled or the question is more specific.

When a child context is over 200k tokens, steer that child once to write a q-handoff, then start one fresh child for the same subtask. Give the fresh child the handoff path. Do not attach the old session. That fresh child is the required continuation, not a forbidden replacement.

Report upward only when:

- the task is complete;
- work is blocked after bounded recovery;
- a critical design decision needs lead judgment.

A child manager reports to q-ceo. A top-level manager reports to the human.

While specialists run, a child manager stays up only if it was started with `autoExit: false`. A top-level manager stays up because it is the human's session. Specialist stop wakes that manager, not q-ceo. A specialist started with `autoExit: false` does not give the manager that stop.

## Recovery

After a provider or process error, reuse the durable child when it can continue and its context is under 200k tokens. If it cannot continue, or its context is over 200k tokens, require a q-handoff from that child when it can still write, then start one fresh child with that handoff path. Never select a latest plan, workspace, or child.

Do not add polling, tmux, manager state files, result parsers, graph transitions, or notification protocols.
