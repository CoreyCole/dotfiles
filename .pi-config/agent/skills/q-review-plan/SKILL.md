---
name: q-review-plan
description: Review planning artifacts before implementation.
---

# q-review-plan

Check design, optional product design, outline, plan, and code assumptions. Return read-only findings. If facts are missing, request focused research. Otherwise recommend workspace preparation, or implementation for an existing review-follow-up workspace. The planner applies approved document fixes.

## Manager completion

After durable work and verification, end with a normal response that names the durable artifact and the smallest decision or correction needed from the q-manager or lead. Do not choose a successor or infer a human approval from a child response.

## Durable boundaries

Use `thoughts/...`-relative artifact references. Plan artifacts define QRSPI state; Pi keeps child sessions in its configured session store. Database indexes are rebuildable. Do not expose credentials, process IDs or manager diagnostics in plan artifacts.
