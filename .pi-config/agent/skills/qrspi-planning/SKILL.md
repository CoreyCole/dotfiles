---
name: qrspi-planning
description: Guides delegated QRSPI planning and implementation through durable artifacts and Pi specialists.
---

# Delegated QRSPI

One `q-manager` coordinates one explicit plan directory. Specialists own the work and artifacts. The manager keeps only status, artifact paths, gates, blockers, and critical decisions.

## Ownership

| Work | Owner |
| --- | --- |
| Question, research synthesis, design, outline, plan, and TODOs | `planner` |
| Focused factual research | `scout` |
| Planning and implementation review | `reviewer` |
| Workspace, implementation TODOs, review fixes, handoffs, and verification | `worker` |
| Stage order, exact child routing, and CEO reports | `q-manager` |

The planner can spawn scouts for factual gaps. Reviewers stay read-only. Only one worker can edit an implementation workspace.

## Pipeline

1. Question — align goals and research agenda with the lead engineer.
1. Research — ground facts in current code and docs.
1. Design — write direction and obtain lead approval.
1. Outline — obtain required approval before tactical planning.
1. Plan — write tactical slices and independently executable TODOs.
1. Review — review planning artifacts before workspace preparation.
1. Workspace — prepare one safe copied implementation workspace.
1. Implement — complete one TODO at a time.
1. Review — inspect implementation and route fixes.
1. Verify — collect project-specific evidence before final approval.

## Child contract

Give each child the active stage skill, exact plan directory, named inputs, output artifact or TODO, constraints, and final-response limit. The specialist writes its assigned artifact when its role permits it.

A child ends with a concise status, artifact paths, evidence, and the smallest question or blocker. It does not choose a successor. Settlement wakes the manager, which steers the same durable child when more work is needed.

## Durable boundaries

- Use `thoughts/...`-relative artifact references.
- Plan artifacts define QRSPI state.
- Pi keeps child sessions in its configured session store.
- Database indexes are rebuildable.
- Use the workspace recorded by workspace preparation.
- Keep implementation-review follow-up work in the reviewed workspace.
