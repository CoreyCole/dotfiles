---
name: qrspi-planning
description: Guides delegated QRSPI planning and implementation through durable artifacts and Pi specialists.
---

# Delegated QRSPI

QRSPI planning is focused on one plan directory in the lead engineer's thoughts directory. The lead engineer is the git user on this machine. Run `scripts/spec_metadata.sh`. Use the printed `Git Username`. The plan directory is `thoughts/<Git Username>/plans/<timestamp>_<plan-name>/`. Put questions, research, design, outline, review, and handoff artifacts in that same directory. Do not create `thoughts/qrspi`. Do not select a latest plan. Already committed plans under `thoughts/qrspi` move to the committer who wrote them. New QRSPI plans use the git user from `scripts/spec_metadata.sh`.

One `q-manager` coordinates that one plan directory. Specialists own the work and artifacts. The manager keeps only status, artifact paths, gates, blockers, and critical decisions.

## Ownership

| Work | Owner |
| --- | --- |
| Question, research synthesis, design, outline, plan, and TODOs | `planner` |
| Focused factual research | `scout` |
| Planning and implementation review | `reviewer` |
| Workspace, implementation TODOs, review fixes, handoffs, and verification | `worker` |
| Stage order, exact child routing, and reports to the human or q-ceo | `q-manager` |

The planner can spawn scouts for factual gaps. A scout writes its assigned research artifact and does not edit product code. Reviewers stay read-only. Only one worker can edit an implementation workspace.

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

Give each child the active stage skill, exact plan directory, named inputs, output artifact or TODO, constraints, and final-response limit. A scout writes the assigned artifact. Name that path in the task. Do not tell a scout to stay read-only or to return the report only in chat. Reviewers do not write.

A specialist ends with a concise status, artifact paths, evidence, and the smallest question or blocker. It does not choose a successor. The persistent manager finishes its turn while specialists run, then steers the same durable child when more work is needed. When that child context is over 200k tokens, the manager steers it once to write a q-handoff, then starts one fresh child for the same subtask and gives it the handoff path.

## Durable boundaries

- Use `thoughts/...`-relative artifact references.
- Plan artifacts define QRSPI state.
- Pi keeps child sessions in its configured session store.
- Database indexes are rebuildable.
- Use the workspace recorded by workspace preparation.
- Keep implementation-review follow-up work in the reviewed workspace.
