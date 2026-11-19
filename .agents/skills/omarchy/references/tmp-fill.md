# Host `/tmp` filling up

Checked 2026-11-12 on this machine. Not an Omarchy-specific bug. Stock systemd `tmp.mount`.

## What `/tmp` is here

- Live mount: `tmpfs` on `/tmp`, about 30G, 50% of RAM. Unit: `/usr/lib/systemd/system/tmp.mount` (`size=50%%`, `nr_inodes=1m`, `x-systemd.graceful-option=usrquota`). No drop-in.
- It is RAM/swap, not the btrfs root. A full `/tmp` does not mean the 930G disk is full.
- With `usrquota` on the mount, a write that hits the cap can fail as `Disk quota exceeded` rather than only `No space left on device`.
- tmpfs is wiped only on reboot. This boot started 2026-09-22 (51 days up at the check). `systemd-tmpfiles-clean.timer` is the only routine cleaner.

## What was using the space

About 23G of 30G, almost all owned by `coreycole`:

| Kind | Size | What it is |
| --- | --- | --- |
| `/tmp/go-build*` and `/tmp/go-link*` | 15.3G, 130 dirs | Go compiler work dirs. Not `GOCACHE`. |
| agent/export dirs (`pro*-prefix*`, `pro*-export-audit*`) | 2.6G | Left in `/tmp` on purpose by agents |
| `tmp.*` mktemp dirs | 1.8G | One dir, `tmp.HVnTuaDu8K`, is a hash-sharded cache (Go build-cache shape) |
| other test bins, logs, twisp dumps | 2.8G | Many small leftovers |

`GOTMPDIR` and `TMPDIR` were unset. `go env GOCACHE` is `~/.cache/go-build` (on disk). The `go` command still puts the per-build work directory in the system temp dir. It deletes that dir on a clean exit. A killed `go test` / `go build` (agent timeout, OOM, SIGKILL) leaves the dir. One leaked tree here was 150M–1.4G.

Docker `api` and `worker` `/tmp` were empty (4G tmpfs, 0 used). Do not confuse those with the host.

## Why the 10-day cleaner does not keep up

`/usr/lib/tmpfiles.d/tmp.conf` is `q /tmp 1777 root root 10d`. `systemd-tmpfiles-clean.service` runs daily and exits 0. That is not a dead timer.

Age is the newest of atime, mtime, and ctime. See [systemd Temporary Directories](https://systemd.io/TEMPORARY_DIRECTORIES/) (Automatic Clean-Up). A file written 24 days ago is kept if anything opened it in the last 10 days.

On this check, every sampled old `go-build` tree had file mtime 23–27 days and file atime 2 days. Same 2-day atime on 2425 other old files. One sweep read `/tmp` around 2026-11-09/10 and reset the clock. The cleaner then correctly left them.

Even with no reads, anything younger than 10 days stays. 6.2G of `go-build` dirs were younger than 10 days. Leaks arrive faster than a 10-day drain.

`plocate` does not scan this: `/etc/updatedb.conf` prunes both `tmpfs` and `/tmp`.

## Leftover that does not fix the host

`/tmp/clean-chestnut-go-tmp.sh` has been running since 2026-10-23 (`systemd — bash — that script — sleep 120`). It only deletes `go-build*` inside the `api` and `worker` containers, and only if the dir is older than 15 minutes. It does not touch host `/tmp`.

## Fixes (do not run until asked)

1. Delete abandoned host `/tmp/go-build*` and `/tmp/go-link*` older than a day. That is the large reclaim. Leave dirs newer than the oldest live `go` process.
1. Point `GOTMPDIR` at a directory on the btrfs disk (for example `~/.cache/go-tmp`) so compiler work dirs stop using RAM. `GOCACHE` is already on disk; setting it does not fix this.
1. Stop the Oct 23 container loop if nothing still needs it. Container `/tmp` was already empty.
1. A reboot clears `/tmp`, but it does not stop the next killed `go build` from filling it again.

Do not edit `/usr/lib/systemd/system/tmp.mount`. A size change belongs in a drop-in under `/etc/systemd/system/tmp.mount.d/`.

## Sources

- [systemd: Using /tmp/ and /var/tmp/ Safely](https://systemd.io/TEMPORARY_DIRECTORIES/)
- [Arch Wiki: tmpfs](https://wiki.archlinux.org/title/Tmpfs)
- [tmpfiles.d(5)](https://man.archlinux.org/man/tmpfiles.d.5.en) — age field; `q` is the same as `d` on non-btrfs
- [Go environment variables](https://pkg.go.dev/cmd/go#hdr-Environment_variables) — `GOTMPDIR`
