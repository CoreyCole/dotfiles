---
name: q-workspace
description: Prepare the safe implementation workspace.
---

# q-workspace

A worker executes the assigned workspace-preparation TODO. Create a fresh filesystem copy, never a git worktree. Verify base and stack safety, then record plan and implementation paths in plan memory. For implementation-review follow-up work, reuse the reviewed workspace and head.

## Manager completion

After durable work and verification, end with a normal response that names the durable artifact and the smallest decision or correction needed from the q-manager or lead. Do not choose a successor or infer a human approval from a child response.

## Durable boundaries

Use `thoughts/...`-relative artifact references. Plan artifacts define QRSPI state; Pi keeps child sessions in its configured session store. Database indexes are rebuildable. Do not expose credentials, process IDs or manager diagnostics in plan artifacts.
