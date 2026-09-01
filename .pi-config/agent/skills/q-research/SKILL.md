---
name: q-research
description: Answer plan research questions with codebase facts.
---

# q-research

The planner reads the plan guidance and question artifacts, delegates focused factual gaps to scouts, and writes the cited research artifact. Recommend another research pass when material code-answerable questions remain. Otherwise recommend design.

## Manager completion

After durable work and verification, end with a normal response that names the durable artifact and the smallest decision or correction needed from the q-manager or lead. Do not choose a successor or infer a human approval from a child response.

## Durable boundaries

Use `thoughts/...`-relative artifact references. Plan artifacts define QRSPI state; Pi keeps child sessions in its configured session store. Database indexes are rebuildable. Do not expose credentials, process IDs or manager diagnostics in plan artifacts.
