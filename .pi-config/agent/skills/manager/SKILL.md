---
name: manager
description: Coordinate Pi subagents with attachable active and resumable sessions.
---

# Manage Pi Subagents

Delegate independent, bounded work through a normal Pi-backed `subagent`.

## Spawn defaults

- Always omit `agent` and `model`. The child uses the default model from its Pi configuration.
- Never select bundled role agents or Claude-backed models.
- Require every child to call `caller_ping` when blocked and `subagent_done` when complete.
- Pass only the task-specific `cwd`, `skills`, `files`, and `tools` overrides that the child needs. The extension loads requested skills and files in the first child turn.

`runningSubagents` contains active and resumable children. Use:

- `subagent_steer` to queue a message in an active child or resume a stopped child.
- `subagent_peek` to inspect its persisted active context and exact known usage.
- `subagent_stop` to abandon it without a completion wake.
- `/attach` to enter an active tmux pane. A resumable child must be steered first.

A blocked child calls `caller_ping`. A completed child calls `subagent_done`. Ordinary settlement and errors also stop the process and wake the manager, but keep the session resumable. Wait for these automatic wakes. Do not poll session files or fabricate child results.
