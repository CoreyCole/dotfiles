# Recover system RAM held by Hyprland GPU buffers

Use this procedure when RAM use greatly exceeds process totals on an AMD integrated GPU.
Do not assume that Docker, Java, VMs, or Pi explain the missing RAM.

## Identify the memory owner

Run these read-only commands:

```bash
free -h
grep -E 'MemAvailable|GPUActive|GPUReclaim' /proc/meminfo
zramctl
hyprctl instances -j
```

Inspect AMD counters without assuming a DRM card number:

```bash
for device in /sys/class/drm/card*/device; do
  test -r "$device/mem_info_gtt_used" || continue
  printf '\n%s\n' "$device"
  grep . "$device"/mem_info_{gtt,vram}_{used,total}
done
```

| Counter | Meaning |
|---|---|
| `GPUActive` | System RAM held by GPU allocations. It can be absent on other kernels. |
| `GPUReclaim` | GPU pages eligible for reclamation. These pages still occupy RAM. |
| `mem_info_gtt_used` | GPU system-memory placement accounting, not a complete measure of allocated RAM. |
| zram `TOTAL` | Physical RAM used by compressed swap and its overhead. Do not count its logical swap size as RAM. |

GPU buffers do not appear completely in normal process RSS totals.
Inspect `/proc/<pid>/fdinfo/*` for `drm-client-id` and `drm-resident-gtt` to identify the owner.
Count each DRM client once. Shared buffers can also appear under multiple clients.
Use `drm-resident-*` counters for physical placement, not `drm-total-*` alone.

On this machine, `sudo /home/coreycole/.local/bin/gpu-mem` provides an additional diagnostic report.
The script calls its threshold a cap. Use the qualified meaning in the next section.
Its `--evict` action can reduce GTT placement without freeing the underlying RAM.
Do not report recovery from a lower GTT counter alone.

## Apply the TTM reclaim threshold

The previous fix uses the kernel TTM driver, not a Hyprland animation configuration.
Do not substitute blur or animation changes for this fix without evidence.

Inspect the live threshold and page size:

```bash
cat /sys/module/ttm/parameters/pages_limit
getconf PAGESIZE
```

With 4096-byte pages, `1048576` pages equals 4 GiB.
The observed default was `7680288` pages, approximately 29.3 GiB.

Before applying the threshold, explain that GPU reclamation can cause stutter or additional swap activity.
Obtain approval for the privileged change.

If the page size is 4096 bytes, apply the verified live value:

```bash
echo 1048576 | sudo tee /sys/module/ttm/parameters/pages_limit
cat /sys/module/ttm/parameters/pages_limit
```

Expected value: `1048576`. A desktop restart or reboot is not necessary to change this value.
The driver attempts swapout during subsequent allocations that exceed the threshold.
This is **not a strict memory ceiling**. Unreclaimable buffers can exceed it.
The write does not immediately free existing buffers or prove that a leak is fixed.

For persistence, merge this line into `/etc/modprobe.d/ttm.conf` without removing unrelated configuration:

```conf
options ttm pages_limit=1048576
```

The file already exists on this machine. Inspect it before editing.
A saved module configuration does not prove that the live driver uses that value.
If TTM loads from the initramfs, include the configuration in the initramfs through the supported rebuild procedure.
Verify the live value after the next boot. Do not assume that the file alone guarantees persistence.

## Release retained buffers without rebooting the machine

A Hyprland configuration reload keeps windows open, but is not a proven release mechanism for these buffers.
Exiting Hyprland released them in the verified incident.

**CAUTION: Obtain explicit approval before exiting Hyprland. All graphical windows close, including terminals.**

Before exiting:

1. Save unsaved GUI work.
2. Verify that important agents run under a persistent multiplexer server, not directly under the terminal window.
3. For Herdr, run `herdr status server` and inspect the agent ancestry with `ps -eo pid,ppid,sid,tty,comm,args`.
4. Verify that the headless server is independent of Hyprland and the terminal client.
5. Inspect logout behavior with `loginctl show-user "$USER" -p Linger -p Sessions` and `systemd-analyze cat-config systemd/logind.conf`.
6. Do not promise survival from the process name alone. Logout policy can terminate background processes.

The verified ancestry was `herdr server → shell → pi`. The detached server survived the graphical session exit.
Docker containers also remain independent of the compositor. Foreground terminal commands need separate verification.

List the current Hyprland instances:

```bash
hyprctl instances -j
```

If exactly one instance exists, select index `0` explicitly:

```bash
hyprctl -i 0 version
hyprctl -i 0 dispatch 'hl.dsp.exit()'
```

With multiple instances, select the intended signature or index before dispatching.
The explicit instance works from SSH or shells without `HYPRLAND_INSTANCE_SIGNATURE`.
The Lua dispatcher syntax worked on Hyprland 0.56.2. Bare `dispatch exit` failed on this build.
Do not stop Herdr, Docker, or the whole machine to restart the graphical session.

After the session ends, log back in and run `herdr` to reconnect.
Verify `free -h`, `GPUActive`, the live TTM threshold, and the protected processes again.
Do not use a GPU reset or unload `amdgpu` while the desktop is active.

## Verified result: 2026-10-20

| Measurement | Before recovery | After the Hyprland exit |
|---|---:|---:|
| Available RAM | Approximately 3 GiB | 28 GiB |
| `GPUActive` | Approximately 29 GiB initially | 0.06 GiB |
| Live TTM threshold | 29.3 GiB initially | 4 GiB |
| Protected sessions | Herdr-backed Pi processes | Herdr server and 23 Pi processes remained alive |

The live threshold alone did not release most retained buffers. The Hyprland exit released them.
The exact cause of buffer retention remains unconfirmed. The threshold is mitigation, not a proven permanent fix.

## Sources

- [Linux v7.2 TTM source](https://github.com/torvalds/linux/blob/v7.2/drivers/gpu/drm/ttm/ttm_tt.c): writable `pages_limit` parameter and allocation-time swapout loop.
- [Arch Wiki: kernel module configuration](https://wiki.archlinux.org/title/Kernel_module#Using_files_in_/etc/modprobe.d/): persistent module parameters and initramfs considerations.
- [Arch Wiki: mkinitcpio hooks](https://wiki.archlinux.org/title/Mkinitcpio#HOOKS): `modconf` includes module configuration in the initramfs.
- [Herdr](https://herdr.dev): local `herdr --help` documents persistent sessions and the headless server.
- Local verification: Hyprland 0.56.2, Linux 7.2.3, AMD Radeon 780M, 4096-byte pages.
