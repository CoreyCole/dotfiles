---
name: cmux
description: |
  Manage cmux workspaces and notifications. For terminal multiplexing
  (windows, panes, running processes), use the tmux skill instead.
---

# cmux Workspace Management

Use this skill for **workspace-level operations only** — creating/closing
workspaces and sending notifications. All terminal multiplexing (windows,
panes, dev servers, test runners) is handled by tmux.

**Prerequisite:** Running inside cmux (check for `CMUX_SOCKET_PATH`).

---

## Environment Variables

cmux auto-sets these in every shell it spawns:

| Variable | Purpose |
|----------|---------|
| `CMUX_WORKSPACE_ID` | UUID of the current workspace |
| `CMUX_SURFACE_ID` | UUID of the current surface/panel |
| `CMUX_SOCKET_PATH` | Unix socket path (usually `/tmp/cmux.sock`) |

---

## Commands

### Create a new workspace (for full project isolation)

```bash
cmux new-workspace [--cwd <path>] [--command "<text>"]
# Returns: OK workspace:<n>
```

### Close a workspace

```bash
cmux close-workspace --workspace <ref>
```

### List workspaces

```bash
cmux list-workspaces --json
cmux tree --json                   # Full layout with all details
```

### Notifications

```bash
cmux notify --title "<text>" --body "<text>"
```

---

## Important Notes

- **Use tmux for terminal work** — windows, panes, dev servers, tests all go
  through tmux. Each cmux workspace auto-starts a tmux session.
- Workspace refs are ephemeral — always capture from command output.
- Notifications trigger the cmux sidebar blue ring and tab highlight.
