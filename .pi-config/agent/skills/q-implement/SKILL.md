---
name: q-implement
description: Execute exactly one unchecked implementation item.
---

# q-implement

Receive one exact TODO through the q-manager. Work only in the prepared implementation workspace. Implement and self-verify that TODO, update its plan checkbox, commit according to repository policy, and write a durable handoff using the `q-handoff` pattern. Do not prepare workspaces, run final verification, or take another TODO.

## Manager completion

After durable work and verification, end with a normal response that names the durable handoff artifact and the smallest decision or correction needed from the q-manager or lead. Do not choose a successor or infer a human approval from a child response.

## Durable boundaries

Use `thoughts/...`-relative artifact references. Plan artifacts define QRSPI state; Pi keeps child sessions in its configured session store. Database indexes are rebuildable. Do not expose credentials, process IDs, or manager diagnostics in plan artifacts.
