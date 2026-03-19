# Virtualization (quickemu / QEMU)

quickemu (AUR) wraps QEMU with sane defaults. Depends on: `qemu-full`, `edk2-ovmf`, `spice-gtk`, `swtpm`.

## VM Configuration

Conf files live in `~/vms/`. Paths inside are relative to the working directory.

```bash
# Launch a VM
cd ~/vms && quickemu --vm omarchy.conf

# Launch headless (no viewer window)
cd ~/vms && quickemu --vm omarchy.conf --viewer none

# Kill a VM
quickemu --vm omarchy.conf --kill
```

**Key conf variables:**
```bash
guest_os="linux"                # "linux", "linux_old", "windows", "macos"
disk_img="name/disk.qcow2"     # qcow2 is thin-provisioned (grows on demand)
iso="name/installer.iso"       # remove after install completes
disk_size="128G"                # only applies on first disk creation
ram="8G"
cpu_cores="4"
boot="efi"                     # "efi" or "legacy"
secureboot="off"
tpm="off"
gl="on"                        # VirGL GPU acceleration (needs virglrenderer)
display="spice"                # "spice", "gtk", "sdl", "none"
ssh_port="22221"               # IMPORTANT: each VM needs a unique port (default: 22220)
```

## Current VMs

| VM | Conf | RAM | Disk | Cores | GL | SSH Port | Purpose |
|----|------|-----|------|-------|----|----------|---------|
| Omarchy | `omarchy.conf` | 8G | 128G | 4 | on | 22221 | Arch + Hyprland desktop |
| CM | `cm.conf` | 32G | 128G | 8 | off | 22220 | Ubuntu Server 24.04 LTS |

## systemd User Services

quickemu forks QEMU into the background — **must use `Type=forking` with `PIDFile`**. Using `Type=simple` causes systemd to think the service exited and triggers ExecStop, killing the VM.

```ini
[Unit]
Description=VM name (quickemu)
After=default.target

[Service]
Type=forking
WorkingDirectory=/home/coreycole/vms
PIDFile=/home/coreycole/vms/<name>/<name>.pid
ExecStart=/usr/bin/quickemu --vm <name>.conf --viewer none
ExecStop=/usr/bin/quickemu --vm <name>.conf --kill
Restart=no

[Install]
WantedBy=default.target
```

```bash
# Enable lingering so user services start at boot (before login)
sudo loginctl enable-linger coreycole

# Manage VMs
systemctl --user start quickemu-omarchy
systemctl --user stop quickemu-omarchy
systemctl --user status quickemu-omarchy
```

## SPICE Display (connect on demand)

VMs run headless with `--viewer none`. Connect via SPICE when needed:

```bash
# Connect to Omarchy desktop
cd ~/vms && spicy --uri="spice+unix://omarchy/omarchy.sock"

# Connect to CM console
cd ~/vms && spicy --uri="spice+unix://cm/cm.sock"
```

Close the viewer window — VM keeps running. Socket only exists while VM is active.

## SPICE Clipboard — Does NOT Work on Wayland

**spice-vdagent is X11-only.** Clipboard sharing will not work with Hyprland/Wayland guests. This is a known upstream limitation with no fix planned (gitlab.freedesktop.org/spice/linux/vd_agent/-/issues/26). SPICE itself is deprecated — Red Hat dropped it from RHEL 9.

The `agent: yes` in spicy status bar means the agent connected for mouse/resolution, but clipboard is non-functional under Wayland.

## 9P Filesystem Sharing

quickemu auto-exposes `~/Public` to guests via virtio-9p. Mount inside the guest:

```bash
sudo mount -t 9p -o trans=virtio,version=9p2000.L,msize=104857600 Public-coreycole ~/Public
```

Persist in guest `/etc/fstab`:
```
Public-coreycole /home/<user>/Public 9p trans=virtio,version=9p2000.L,msize=104857600,nofail 0 0
```

`nofail` prevents boot hang if the 9P device is unavailable.

**Security model:** quickemu uses `security_model=mapped-xattr` for 9P. Guest permission changes (chmod) are stored as extended attributes on the host — they don't modify actual host file permissions. This is fine for editing files and git, but don't expect permission changes from the guest to reflect on the host.

**inotify limitation:** inotify does NOT fire on 9P mounts for changes originating from the host. Guest-side file watchers must use polling instead of `inotifywait`.

**Shared dotfiles:** `~/Public/dotfiles` contains the dotfiles git repo, symlinked from `~/dotfiles` on both host and guest. Edits and git operations work from either side.

## Clipboard Sync (custom workaround)

Bidirectional clipboard sharing over 9P using `~/.local/bin/clipboard-sync`:

- Host clipboard changes → writes to `~/Public/.clip-host` → guest polls and runs `wl-copy`
- Guest clipboard changes → writes to `~/Public/.clip-guest` → host `inotifywait` fires and runs `wl-copy`
- Content comparison on each side prevents infinite loops
- Host uses `inotifywait` (works on local fs), guest uses 0.5s polling (9P inotify limitation)

Dependencies: `wl-clipboard`, `inotify-tools` (both sides)

```bash
# Runs as systemd user service on both host and guest
systemctl --user status clipboard-sync

# Service files
# Host: ~/.config/systemd/user/clipboard-sync.service (runs "clipboard-sync host")
# Guest: ~/.config/systemd/user/clipboard-sync.service (runs "clipboard-sync guest")
```

## Troubleshooting

```bash
# VM won't start — check for port conflict
# Error: "Could not set up host forwarding rule 'tcp::22220-:22'"
# Fix: set unique ssh_port in each .conf file

# VM dies immediately under systemd
# Fix: use Type=forking + PIDFile, not Type=simple

# SPICE viewer can't connect — "No such file or directory"
# The VM isn't running. Start it first, then connect.

# Guest pacman "database file does not exist"
# Fresh Omarchy install needs: sudo pacman -Sy

# Clipboard not syncing host→guest
# Check guest clipboard-sync service: systemctl --user status clipboard-sync
# Verify 9P mount: mount | grep 9p
```
