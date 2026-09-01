---
name: q-plan
description: Write a tactical implementation plan from reviewed design and outline.
---

# q-plan

Read relevant code before planning. Write vertical slices with verification and repository commit guidance. Create independently executable TODOs with exact references, constraints, and acceptance criteria. Run the project artifact sync when available, then recommend planning review.

## Manager completion

After durable work and verification, end with a normal response that names the durable artifact and the smallest decision or correction needed from the q-manager or lead. Do not choose a successor or infer a human approval from a child response.

## Durable boundaries

Use `thoughts/...`-relative artifact references. Plan artifacts define QRSPI state; Pi keeps child sessions in its configured session store. Database indexes are rebuildable. Do not expose credentials, process IDs or manager diagnostics in plan artifacts.
