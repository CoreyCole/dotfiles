---
name: manager
description: Coordinate durable Pi child sessions.
---

# Manage Pi Child Sessions

Use named `agent` values (`planner`, `scout`, `worker`, or `reviewer`) when the requested workflow requires that role. Normally omit `model` so the named-agent default applies.

Every child session remains visible and resumable after settlement, `caller_ping`, `subagent_done`, provider error, or process error. `subagent_stop` stops only an active process. Never use it to discard history.

Normal interaction is:

```text
child settles → manager wakes with its last assistant message
→ manager replies with subagent_steer → child runs another turn
```

Repeat until the work is complete. `agent_settled` is the ordinary wake. It is **not** task completion. The child is idle in the same session. Call `subagent_steer` on that child. Do not spawn a replacement for the same task unless the session file is missing or the child never produced an assistant message. `subagent_done` is the only "task complete" signal.

Answer interactive questions with `subagent_steer`; do not require `caller_ping` for normal planner questions. `caller_ping` is another explicit wake mechanism for a blocker or requested action. It does not necessarily mean failure.

Use `subagent_peek` after a wake to inspect context. It is inspection, not polling: do not poll active children. `/attach` is optional human takeover and only works for active children. Steer an idle child first.
