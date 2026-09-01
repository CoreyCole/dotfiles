---
name: q-milestone-create-tickets
description: Create approved provider tickets for a milestone.
---

# q-milestone-create-tickets

Draft ticket bodies, obtain approval for each required ticket, create only approved tickets, and update durable routing/status artifacts.

## Manager completion

After durable work and verification, end with a normal response that names the durable artifact and the smallest decision or correction needed from the q-manager or lead. Do not choose a successor or infer a human approval from a child response.

## Durable boundaries

Use `thoughts/...`-relative artifact references. Plan artifacts define QRSPI state; Pi keeps child sessions in its configured session store. Database indexes are rebuildable. Do not expose credentials, process IDs or manager diagnostics in plan artifacts.
