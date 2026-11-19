# Attachable subagents

This file states how a child pane closes.

## autoExit

`autoExit` defaults to `true`. A child pane closes when that child stops. That stop wakes the manager.

`autoExit` false is for a manager. A manager must settle while it waits for its children to finish. Ordinary settlement does not close that pane. The manager remains in the pane and can receive the child results.

A worker, scout, planner, or reviewer keeps the default. Their stop wakes the manager. A child with `autoExit` false remains in the pane and does not wake the manager.

`subagent_done` ends the current run. The process exits. The durable session remains. The pane closes because the process stopped. `autoExit` false does not keep the pane open after `subagent_done`.

A steer does not change `autoExit`.

## Spawn

Set `autoExit` to `false` only when you spawn a manager.
Omit `autoExit` when you spawn a worker, scout, planner, or reviewer.

## Herdr workspace

Herdr children start in one shared workspace, `pi-subagents`.
They do not start in the manager workspace.
`/attach` moves the child pane onto the manager tab.
`/detach` moves that pane back to `pi-subagents`.
A `hold` tab stays in `pi-subagents`.
Herdr closes a workspace when its last pane leaves.
`/attach` creates that tab before it moves a pane out.
`/detach` uses the live `pi-subagents` workspace when the recorded id is gone.
A cross-workspace move changes the public pane id.
The terminal id does not change.
Use the terminal id to find the pane after a move.

## /new

`/new` keeps each pane that is still open. It also keeps the child catalog. It does not open a pane that already closed. A quit or a restart closes the panes that remain. A later resume of the old session does not own those children.

Pane checks and session tails must not block the terminal. Do not call `readScreen` or read a whole child session file from a render, a status tick, or a watcher tick. Use the cached async pane probe and the byte-offset tail.
