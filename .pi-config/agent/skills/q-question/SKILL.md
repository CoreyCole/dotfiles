---
name: q-question
description: Decompose a task into factual research questions.
---

# q-question

Interview the lead engineer about outcomes, scope, principles, and tradeoffs. Write the questions artifact and preserve the human alignment gate before research. Ask concise unresolved questions in normal prose; do not invent alignment while awaiting an answer.

## Manager completion

After durable work and verification, end with a normal response that names the durable artifact and the smallest decision or correction needed from the q-manager or lead. Do not choose a successor or infer a human approval from a child response.

## Durable boundaries

Use `thoughts/...`-relative artifact references. Plan artifacts define QRSPI state; Pi keeps child sessions in its configured session store. Database indexes are rebuildable. Do not expose credentials, process IDs, or manager diagnostics in plan artifacts.
