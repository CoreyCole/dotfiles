---
name: qrspi-project-planning
description: Guide nested project and milestone QRSPI planning.
---

# qrspi-project-planning

Use milestone question, research, design, and ticket-creation work rather than forcing ticket implementation stages onto an epic. The q-manager owns continuation and preserves each required human gate.

## Manager completion

After durable work and verification, end with a normal response that names the durable artifact and the smallest decision or correction needed from the q-manager or lead. Do not choose a successor or infer a human approval from a child response.

## Durable boundaries

Use `thoughts/...`-relative artifact references. Plan artifacts define QRSPI state; Pi keeps child sessions in its configured session store. Database indexes are rebuildable. Do not expose credentials, process IDs, or manager diagnostics in plan artifacts.
