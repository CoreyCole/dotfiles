---
name: q-handoff
description: Create durable QRSPI continuity handoffs.
---

# q-handoff

Write concise `Done:` and `Next:` recovery information, slice self-verification evidence, relevant artifact paths, and workspace/branch identity when applicable. Do not include ephemeral process state. The q-manager decides whether the same worker resumes an unfinished implementation plan or a later stage begins.

A child context over 200k tokens writes this handoff before the manager starts its successor. The handoff is the context the next child receives. The manager puts the handoff path in the successor task. The successor does not inherit the old session. Include source, scope, findings already proved, artifact paths, and open questions. Do not answer new research questions in the handoff.

## Manager completion

After durable work and verification, end with a normal response that names the durable handoff artifact and the smallest decision or correction needed from the q-manager or lead. Do not choose a successor or infer a human approval from a child response.

## Required ending

End a handoff in this order. Do not skip a step. Do not reverse the steps.

1. Create the handoff file under the plan directory in `thoughts/`.
1. Sync thoughts. From the chestnut-flake root, run `just sync-thoughts`. That runs `cd cn-agents/thoughts && just sync-thoughts`. From canonical cn-agents, `just sync-thoughts` is the thoughts-only sync. Do not claim the file is synced if that command fails. Say not synced.
1. The final message is the paste for the next agent. Do not add a summary after that paste. The paste names the handoff path and says whether it is synced.

If the writer is q-ceo, the paste tells the next CEO to load and follow the `q-ceo` skill. Preserving context means the next CEO does not inherit this conversation. The next CEO delegates to `q-manager` children and does not implement. A manager cannot see the old conversation unless the paste and the handoff name the lead's words, the image paths, the checkout, the branch, the commit, and the limits.

## Durable boundaries

Use `thoughts/...`-relative artifact references. Plan artifacts define QRSPI state; Pi keeps child sessions in its configured session store. Database indexes are rebuildable. Do not expose credentials, process IDs, or manager diagnostics in plan artifacts.
