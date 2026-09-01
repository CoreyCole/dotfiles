---
name: q-research-for-review
description: Research factual gaps found by planning review.
---

# q-research-for-review

Answer only the review questions with codebase facts, then recommend applying those findings to the parent planning artifacts.

## Manager completion

After durable work and verification, end with a normal response that names the durable artifact and the smallest decision or correction needed from the q-manager or lead. Do not choose a successor or infer a human approval from a child response.

## Durable boundaries

Use `thoughts/...`-relative artifact references. Plan artifacts define QRSPI state; Pi keeps child sessions in its configured session store. Database indexes are rebuildable. Do not expose credentials, process IDs or manager diagnostics in plan artifacts.
