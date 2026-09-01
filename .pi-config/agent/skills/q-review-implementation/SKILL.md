---
name: q-review-implementation
description: Review completed implementation.
---

# q-review-implementation

Inspect the code, tests, and handoffs. Return read-only findings with exact evidence. The q-manager routes straightforward fixes to a worker and deeper work to a planner for a nested follow-up plan. When clean, recommend verification.

## Manager completion

After durable work and verification, end with a normal response that names the durable artifact and the smallest decision or correction needed from the q-manager or lead. Do not choose a successor or infer a human approval from a child response.

## Durable boundaries

Use `thoughts/...`-relative artifact references. Plan artifacts define QRSPI state; Pi keeps child sessions in its configured session store. Database indexes are rebuildable. Do not expose credentials, process IDs or manager diagnostics in plan artifacts.
