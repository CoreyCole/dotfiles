# Copy-on-write workspace copies

Goal: a second tree that looks like a full copy, can be edited independently,
and does not duplicate bytes until a file actually changes. That is
copy-on-write (CoW), not a normal `cp -R`, not `git clone`, not
`git worktree`.

Hard-link trees (`cp -al`) are fast but **not** independent. Editing a file
in place changes every name that shares the inode. Many editors hide that
by “write temp + rename,” which *breaks* the link — so behavior is
inconsistent. Do not use hard links unless you want a snapshot-style backup
you will not edit.

`dest` must be on the **same filesystem** as `src`. CoW never works across
volumes.

## Filesystem clones (true CoW)

### macOS (APFS)

APFS is the default on modern Macs. Use clonefile:

```bash
cp -ac src dest
# or
cp -cR src dest
```

`-c` = clone; `-a`/`-R` = recursive + metadata. Finder copies do this
automatically on APFS. `clonefile(2)` can clone a whole directory in one
syscall.

If you leave APFS (external HFS+, network share, another volume), `-c`
fails or falls back — then you get a real copy.

```bash
diskutil info / | grep "File System"
df -h src dest   # same volume?
```

### Linux (btrfs, XFS with reflink, bcachefs; sometimes ZFS)

```bash
cp -a --reflink=always src dest
```

`--reflink=auto` (GNU coreutils 9.0+ default) clones when possible and
copies otherwise. Use `always` if you want it to fail rather than silently
eat disk.

```bash
findmnt -no FSTYPE,SOURCE --target /path/to/src
# XFS must have been mkfs'd with reflink=1:
xfs_info /mount | grep reflink
```

**ext4 does not support this.** Ubuntu/Fedora default disks are usually
ext4 — then `cp --reflink` is just a slow full copy.

| Platform | FS | Command | Extra space until edits |
|---|---|---|---|
| macOS | APFS | `cp -ac src dest` | ~metadata |
| Linux | btrfs / XFS(reflink) / bcachefs | `cp -a --reflink=always src dest` | ~metadata |
| Linux | ext4, NFS, tmpfs | none | full copy |

Helpers that wrap the same syscalls: `ctree`, `cow-cli`, `fcp` (macOS uses
CoW; Linux uses parallelism + reflink when available).

## Linux-only alternative: overlay

Even closer to a container rootfs than a worktree: original stays the lower
layer; only writes land in an upper dir.

```bash
mkdir -p /tmp/wt/upper /tmp/wt/work /tmp/wt/merged
sudo mount -t overlay overlay \
  -olowerdir=/path/to/src,upperdir=/tmp/wt/upper,workdir=/tmp/wt/work \
  /tmp/wt/merged
```

Work in `/tmp/wt/merged`. Unchanged files are still the original bytes.
Deletes become whiteouts in `upper`.

Caveats:

- Needs mount permission, or a user namespace, or `fuse-overlayfs`
  (unprivileged).
- `src` should stay stable while mounted as lower.
- Directory rename of a lower-only dir can return `EXDEV` unless
  `redirect_dir` is enabled.
- Tools that inspect real paths (`stat` on the backing file, some build
  caches) can be surprised.

Use this when you want many cheap checkouts of one immutable base (deps,
`node_modules`, a built tree). Not the default for q-workspace.

## Volume snapshots

- **btrfs:** `btrfs subvolume snapshot src dest`
- **ZFS:** `zfs snapshot` + `zfs clone`
- **LVM thin:** snapshot the LV
- **APFS:** `tmutil` / `diskutil apfs` snapshots (heavier; more
  backup-oriented)

These are excellent if the project already lives on a snapshot-capable
volume. Overkill if you just need one extra tree on APFS/btrfs.

## No CoW (ext4, or crossing disks)

You cannot get CoW. Minimize pain:

```bash
rsync -aHAX --info=progress2 src/ dest/
```

Moving the project onto APFS, btrfs, or XFS-with-reflink is the actual fix.

## Helper

```bash
same_fs() { [ "$(df -P "$1" | awk 'NR==2{print $1}')" = "$(df -P "$2" | awk 'NR==2{print $1}')" ]; }

clone_tree() {
  src=$1 dest=$2
  case "$(uname)" in
    Darwin)
      cp -ac "$src" "$dest"
      ;;
    Linux)
      if cp -a --reflink=always "$src" "$dest" 2>/dev/null; then
        :
      else
        echo "no reflink on this FS; doing full copy" >&2
        rsync -aHAX "$src"/ "$dest"/
      fi
      ;;
  esac
}
```

Put `dest` on the same filesystem as `src`.

## What to pick

- **Mac:** `cp -ac src dest`. That is the worktree analog.
- **Linux on btrfs/XFS-reflink/bcachefs:** `cp -a --reflink=always src dest`.
- **Many cheap writable views of one frozen tree:** overlayfs /
  fuse-overlayfs.
- **ext4 laptop:** either full `rsync` or put the tree on a btrfs/XFS
  loop/disk image if you do this often.
- **Do not** use `cp -al` for independent editing.

If the directory is a git repo and you only wanted extra checkouts, git
worktrees still win for the `.git` objects. q-workspace does not use
worktrees; the methods above replace the *working-tree copy* part (env
files, `node_modules`, build artifacts).
