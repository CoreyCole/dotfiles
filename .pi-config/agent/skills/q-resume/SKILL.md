---
name: q-resume
description: Resume a QRSPI handoff in its recorded workspace.
---

# q-resume

Read the handoff, plan memory, current plan status, and only needed artifacts. Confirm the workspace is safe, then self-verify the handoff's completed slice with its targeted tests and relevant diff/check evidence before performing one bounded pending activity. Record that evidence in the replacement handoff or final completion. If implementation slices remain unchecked, continue implementation rather than routing a slice to review or verify.

## Manager completion

After durable work and verification, end with a normal response that names the durable artifact and the smallest decision or correction needed from the q-manager or lead. Do not choose a successor or infer a human approval from a child response.

## Durable boundaries

Use `thoughts/...`-relative artifact references. Plan artifacts define QRSPI state; Pi keeps child sessions in its configured session store. Database indexes are rebuildable. Do not expose credentials, process IDs or manager diagnostics in plan artifacts.
