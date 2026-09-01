---
name: q-review
description: Route and perform QRSPI review.
---

# q-review

Review planning artifacts or implementation handoffs and return read-only findings. Preserve human decisions. The q-manager routes planning fixes to the planner and implementation fixes to a worker. Recommend a follow-up plan only for substantive work.

## Manager completion

After durable work and verification, end with a normal response that names the durable artifact and the smallest decision or correction needed from the q-manager or lead. Do not choose a successor or infer a human approval from a child response.

## Durable boundaries

Use `thoughts/...`-relative artifact references. Plan artifacts define QRSPI state; Pi keeps child sessions in its configured session store. Database indexes are rebuildable. Do not expose credentials, process IDs or manager diagnostics in plan artifacts.
