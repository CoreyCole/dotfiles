# Local attachable child sessions

Each spawned Pi child receives a native Pi UUID before launch. The manager appends one immutable child registration to its JSONL. On reload, the active manager branch rebuilds the complete child-session catalog from those registrations.

A catalog child is always resumable by its child-session UUID. `subagents_list` shows active, idle, and unavailable history. Missing native files remain visible as unavailable; peek and steer report a clear error without deleting the registration.

`/attach` is active-only. Steer an idle child by UUID (or an unambiguous prefix) first. `/stop` and `subagent_stop` stop only an active process and retain durable history.

Named children re-resolve their current named-agent definition when resumed, including its prompt, tools, deny policy, model, thinking, config directory, and cwd.

## First-turn context

The `subagent` tool accepts `skills` and `files` for its first turn. A missing requested skill fails the current run and wakes the manager; the durable child session remains in the catalog.
