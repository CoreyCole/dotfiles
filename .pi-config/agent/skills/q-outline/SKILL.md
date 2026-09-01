---
name: q-outline
description: Turn approved design into an implementation outline.
---

# q-outline

Before writing, identify the explicit plan directory. For a new plan, create a timestamped directory under `thoughts/<owner>/plans/` only when the q-manager assigned a bootstrap task. Summarize slices, invariants, and exclusions and obtain required lead approval. Then write `<plan-dir>/outline.md` and recommend planning review.

## Manager completion

After durable work and verification, end with a normal response that names the durable artifact and the smallest decision or correction needed from the q-manager or lead. Do not choose a successor or infer a human approval from a child response.

## Durable boundaries

Use `thoughts/...`-relative artifact references. Plan artifacts define QRSPI state; Pi keeps child sessions in its configured session store. Database indexes are rebuildable. Do not expose credentials, process IDs or manager diagnostics in plan artifacts.
