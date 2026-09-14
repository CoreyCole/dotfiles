---
name: q-workspace
description: Prepare the safe implementation workspace.
---

# q-workspace

A worker executes the assigned workspace-preparation TODO. Create a fresh
filesystem copy of the **canonical trunk checkout**, never a git worktree.
Verify base and stack safety, then record plan and implementation paths in
plan memory. For implementation-review follow-up work, reuse the reviewed
workspace and head.

## Copy

Copy the trunk checkout of the current repo. Do not copy a feature-branch
tree. Do not use `git clone`, `git worktree`, or `cp -al`.

A clone drops ignored env (`.env`, direnv, `node_modules`, local runtime
dirs). Hard links (`cp -al`) are not independent: an in-place edit changes
every name that shares the inode.

Use copy-on-write on the **same volume** so the second tree looks full,
edits independently, and does not duplicate bytes until a file changes.

- macOS APFS: `cp -ac src dest`
- Linux with reflink (btrfs, XFS `reflink=1`, bcachefs):
  `cp -a --reflink=always src dest`
- No CoW (ext4, other volume): full `rsync -aHAX src/ dest/`

Read [copy-on-write.md](references/copy-on-write.md) for the FS table,
overlay/snapshots, and the fail-closed clone helper.

## After the copy

Bring the copy onto **that repo’s trunk** with the repo’s normal tool
(`gt get --no-interactive <trunk>` on Graphite, otherwise checkout/pull
trunk). Do not hand-copy Graphite metadata.

If the work sits on an existing stack, get that tip **after** trunk, then
branch from there.

Host-specific copy notes, if any, live under `references/`.

## Manager completion

After durable work and verification, end with a normal response that names
the durable artifact and the smallest decision or correction needed from
the q-manager or lead. Do not choose a successor or infer a human approval
from a child response.

## Durable boundaries

Use `thoughts/...`-relative artifact references. Plan artifacts define
QRSPI state; Pi keeps child sessions in its configured session store.
Database indexes are rebuildable. Do not expose credentials, process IDs
or manager diagnostics in plan artifacts.
