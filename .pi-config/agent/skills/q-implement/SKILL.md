---
name: q-implement
description: Execute one exact q-manager-assigned TODO per invocation or turn.
---

# q-implement

Receive one exact TODO through the q-manager per invocation or turn. Work only in the prepared implementation workspace. Implement and self-verify that TODO, update its plan checkbox, commit according to repository policy, and write a durable handoff using the `q-handoff` pattern. Do not prepare workspaces or run final verification. Do not select another TODO or expand the assigned scope.

## Manager completion

After durable work and verification, end with a normal response that names the durable handoff artifact and the smallest decision or correction needed from the q-manager or lead. Then settle and wait for an explicit q-manager assignment. The q-manager can steer the same durable worker for the next TODO or fixes within the same approved vertical slice. Execute only the exact TODO assigned for that turn. Reuse the prepared workspace and preserve its ownership boundaries. Do not choose a successor or infer a human approval from a child response.

## Durable boundaries

Use `thoughts/...`-relative artifact references. Plan artifacts define QRSPI state; Pi keeps child sessions in its configured session store. Database indexes are rebuildable. Do not expose credentials, process IDs, or manager diagnostics in plan artifacts.
