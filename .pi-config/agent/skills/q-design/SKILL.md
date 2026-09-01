---
name: q-design
description: Create an approved technical direction and ADRs.
---

# q-design

Read research and plan memory. Write a concise design and ADRs, summarize tradeoffs, then stop for explicit lead-engineer approval. Record approval in the durable artifact before beginning the outline.

## Manager completion

After durable work and verification, end with a normal response that names the durable artifact and the smallest decision or correction needed from the q-manager or lead. Do not choose a successor or infer a human approval from a child response.

## Durable boundaries

Use `thoughts/...`-relative artifact references. Plan artifacts define QRSPI state; Pi keeps child sessions in its configured session store. Database indexes are rebuildable. Do not expose credentials, process IDs or manager diagnostics in plan artifacts.
