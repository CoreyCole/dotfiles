---
name: q-milestone-design
description: Design a milestone and proposed ticket set.
---

# q-milestone-design

Write milestone ownership, outcomes, gap map, dependencies, and ticket proposals. Stop for human alignment before ticket creation.

## Manager completion

After durable work and verification, end with a normal response that names the durable artifact and the smallest decision or correction needed from the q-manager or lead. Do not choose a successor or infer a human approval from a child response.

## Durable boundaries

Use `thoughts/...`-relative artifact references. Plan artifacts define QRSPI state; Pi keeps child sessions in its configured session store. Database indexes are rebuildable. Do not expose credentials, process IDs or manager diagnostics in plan artifacts.
