---
name: q-verify
description: Perform post-implementation verification.
---

# q-verify

A worker executes the assigned verification TODO after the implementation worker is idle. Run project-defined checks, inspect artifacts or UI as required, fix bounded defects, write `verify.md`, and stop for final human approval when evidence is ready.

## Manager completion

After durable work and verification, end with a normal response that names the durable artifact and the smallest decision or correction needed from the q-manager or lead. Do not choose a successor or infer a human approval from a child response.

## Durable boundaries

Use `thoughts/...`-relative artifact references. Plan artifacts define QRSPI state; Pi keeps child sessions in its configured session store. Database indexes are rebuildable. Do not expose credentials, process IDs or manager diagnostics in plan artifacts.
