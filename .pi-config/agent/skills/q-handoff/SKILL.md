---
name: q-handoff
description: Create durable QRSPI continuity handoffs.
---

# q-handoff

Write concise `Done:` and `Next:` recovery information, slice self-verification evidence, relevant artifact paths, and workspace/branch identity when applicable. Do not include ephemeral process state. The q-manager decides whether the same worker resumes an unfinished implementation plan or a later stage begins.

## Manager completion

After durable work and verification, end with a normal response that names the durable handoff artifact and the smallest decision or correction needed from the q-manager or lead. Do not choose a successor or infer a human approval from a child response.

## Durable boundaries

Use `thoughts/...`-relative artifact references. Plan artifacts define QRSPI state; Pi keeps child sessions in its configured session store. Database indexes are rebuildable. Do not expose credentials, process IDs, or manager diagnostics in plan artifacts.
