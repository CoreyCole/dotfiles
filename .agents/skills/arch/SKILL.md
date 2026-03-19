---
name: arch
description: Use when working on an Arch Linux system — resolving pacman/yay errors (conflicting files, locked database, failed transactions), managing packages (pacman, yay, AUR), configuring Hyprland/Wayland, troubleshooting PipeWire audio, managing btrfs snapshots with snapper, systemd services, Limine bootloader, kernel issues, or any Arch-specific system administration.
---

# Arch Linux System Skill

Guidance for Arch Linux system administration tailored to this system's stack:
**Hyprland (Wayland) + Limine + Btrfs/Snapper + PipeWire + yay + zsh**

Authority: Official Arch Wiki (https://wiki.archlinux.org/)

## Searching the Arch Wiki

For questions not covered in this skill, use Brave LLM Context API with Goggles to search the Arch Wiki:

```bash
curl -s "https://api.search.brave.com/res/v1/llm/context" \
  -H "Accept: application/json" \
  -H "X-Subscription-Token: ${BRAVE_SEARCH_API_KEY}" \
  -G \
  --data-urlencode "q=<search terms>" \
  --data-urlencode 'goggles=$discard
$site=wiki.archlinux.org'
```

This returns pre-extracted page content (text, tables, code) directly — no need for a separate WebFetch.

## System Hardware

| Component | Details |
|-----------|---------|
| Machine | AZW SER mini PC |
| CPU | AMD Ryzen 7 255 (Zen 4, 8C/16T) |
| GPU | AMD Radeon 780M (RDNA3 integrated, HawkPoint1) |
| RAM | 64 GB DDR5 |
| Storage | 1 TB NVMe (nvme0n1) |
| Monitor | Dell U2717D — 2560x1440@60Hz via HDMI-A-1, portrait rotation (transform: 1) |
| Network | Ethernet (eno1) + Wi-Fi (wlan0) |

## Disk Layout

```
nvme0n1 (931.5G)
├─ nvme0n1p1  2G    vfat         /boot (ESP)
└─ nvme0n1p2  929.5G crypto_LUKS
   └─ root    929.5G btrfs       (LUKS encrypted)
      ├─ @       → /
      ├─ @home   → /home
      ├─ @log    → /var/log
      └─ @pkg    → /var/cache/pacman/pkg
```

Btrfs options: `compress=zstd:3,ssd,space_cache=v2`

## Key Software Versions

| Package | Version |
|---------|---------|
| Kernel | linux 6.19.8.arch1-1 |
| Hyprland | 0.54.2 |
| Waybar | 0.15.0 |
| PipeWire | 1.6.2 |
| WirePlumber | 0.5.13 |
| Mesa | 26.0.2 |
| Vulkan (radeon) | 26.0.2 |
| Limine | 10.8.5 |
| Snapper | 0.13.0 |
| yay | 12.5.7 |
| zsh | 5.9 |
| Starship | 1.24.2 |
| Alacritty | 0.16.1 |

## GPU (AMD RDNA3 Integrated)

Open-source Mesa/RADV stack — no proprietary driver needed:
- `mesa` — OpenGL/Vulkan (radeonsi/RADV)
- `vulkan-radeon` — Vulkan ICD
- `linux-firmware-amdgpu` — firmware blobs
- `libdrm` — Direct Rendering Manager

```bash
# Check GPU driver in use
lspci -k | grep -A 2 VGA

# Verify Vulkan
vulkaninfo --summary

# Monitor GPU usage
cat /sys/class/drm/card*/device/gpu_busy_percent
```

## Quick Reference

### Package Management (pacman)

```bash
# Full system upgrade (always do this before installing new packages)
sudo pacman -Syu

# Install / remove
sudo pacman -S package_name
sudo pacman -Rs package_name        # remove + unused deps

# Search & info
pacman -Ss search_term               # search repos
pacman -Si package_name              # repo package info
pacman -Qs search_term               # search installed
pacman -Qi package_name              # installed package info
pacman -Qo /path/to/file             # which package owns this file?
pacman -Ql package_name              # list files in package
pacman -Qe                           # explicitly installed packages
pacman -Qm                           # foreign (AUR) packages

# Cache management
sudo pacman -Sc                      # remove old cached packages
sudo pacman -Scc                     # remove ALL cached packages
paccache -r                          # keep only last 3 versions (pacman-contrib)

# Check for orphaned packages
pacman -Qtdq                         # list orphans
sudo pacman -Rns $(pacman -Qtdq)     # remove orphans
```

### AUR (yay)

```bash
# Search and install AUR packages
yay -Ss search_term
yay search_term                      # interactive search
yay -S package_name

# Update all packages (official + AUR)
yay -Syu

# Show AUR package info
yay -Si package_name

# Clean unneeded build deps
yay -Yc

# Edit PKGBUILD before building (always review AUR packages!)
yay -S package_name --editmenu
```

### Common Package Errors

```bash
# "unable to lock database"
# First check if another pacman process is running:
ps aux | grep pacman
# Only if no pacman is running:
sudo rm /var/lib/pacman/db.lck

# "conflicting files" — identify owner first
pacman -Qo /path/to/conflicting/file
# If orphaned (no owner), safe to overwrite:
sudo pacman -S package --overwrite '/path/to/file'

# "failed to commit transaction (invalid or corrupted package)"
sudo pacman -Scc && sudo pacman -Syyu

# "key is unknown" / PGP signature errors
sudo pacman-key --refresh-keys
# Or for a specific key:
sudo pacman-key --recv-keys KEY_ID
sudo pacman-key --lsign-key KEY_ID

# Partial upgrade breakage (never run pacman -Sy without -u)
# Boot from Arch ISO, mount, arch-chroot, then:
pacman -Syu
```

### Systemd Services

```bash
# Start / stop / restart
sudo systemctl start service_name
sudo systemctl stop service_name
sudo systemctl restart service_name

# Enable at boot / disable
sudo systemctl enable service_name
sudo systemctl enable --now service_name   # enable + start immediately
sudo systemctl disable service_name

# Status & logs
systemctl status service_name
journalctl -u service_name                  # all logs for service
journalctl -u service_name -b               # logs from current boot
journalctl -u service_name -f               # follow live
journalctl -b                               # all logs, current boot
journalctl -b -1                            # previous boot logs
journalctl -p err -b                        # only errors, current boot

# User services (no sudo)
systemctl --user status service_name
systemctl --user restart service_name
journalctl --user -u service_name

# List failed services
systemctl --failed
```

### Hyprland / Wayland

Config files in `~/.config/hypr/`:

```
~/.config/hypr/
├── hyprland.conf      # Main config (sources others)
├── bindings.conf      # Keybindings
├── monitors.conf      # Display configuration
├── input.conf         # Keyboard/mouse settings
├── looknfeel.conf     # Appearance (gaps, borders, animations)
├── envs.conf          # Environment variables
├── autostart.conf     # Startup applications
├── hypridle.conf      # Idle behavior (screen off, lock, suspend)
├── hyprlock.conf      # Lock screen appearance
└── hyprsunset.conf    # Night light / blue light filter
```

```bash
# Reload Hyprland config (no restart needed, also auto-reloads on save)
hyprctl reload

# List monitors
hyprctl monitors

# List active windows
hyprctl clients

# Dispatch commands
hyprctl dispatch exec [command]
hyprctl dispatch workspace 3
hyprctl dispatch togglefloating
hyprctl dispatch fullscreen

# Get current keybindings
hyprctl binds

# Screenshot (with grim + slurp)
grim                                        # full screen
grim -g "$(slurp)"                          # select region

# Screen recording (wf-recorder)
wf-recorder -g "$(slurp)"                   # select region
wf-recorder -a                              # with audio

# Check Wayland-specific env vars
echo $WAYLAND_DISPLAY
echo $XDG_SESSION_TYPE
```

**Keybinding syntax** (in `bindings.conf`):
```
bind = SUPER, Return, exec, xdg-terminal-exec
bind = SUPER, Q, killactive
bind = SUPER SHIFT, E, exit
bind = SUPER, 1, workspace, 1
bind = SUPER SHIFT, 1, movetoworkspace, 1
```

**Monitor config** (in `monitors.conf`):
```
monitor = eDP-1, 1920x1080@60, 0x0, 1
monitor = HDMI-A-1, 2560x1440@144, 1920x0, 1
monitor = , preferred, auto, 1              # fallback for any monitor
```

**Environment variables for Wayland** (in `envs.conf`):
```
env = QT_QPA_PLATFORM,wayland
env = GDK_BACKEND,wayland
env = MOZ_ENABLE_WAYLAND,1
```

**hypridle** — idle behavior (in `hypridle.conf`):
```
listener {
    timeout = 300                            # 5 min
    on-timeout = hyprlock                    # lock screen
}
listener {
    timeout = 600                            # 10 min
    on-timeout = hyprctl dispatch dpms off   # screen off
    on-resume = hyprctl dispatch dpms on
}
```

**hyprsunset** — night light:
```bash
# Toggle night light
hyprsunset -t 4000                          # warm (4000K)
# Kill to disable
pkill hyprsunset
```

Portal config: `~/.config/xdg-desktop-portal/portals.conf`
```ini
[preferred]
default=hyprland;gtk
org.freedesktop.impl.portal.FileChooser=gtk
```

### Waybar

Config: `~/.config/waybar/config.jsonc` (JSONC format — supports comments)
Style: `~/.config/waybar/style.css`

```bash
# Restart waybar
killall waybar && waybar &

# Test config with debug output
waybar -l debug
```

### App Config Locations

| App | Config Path |
|-----|-------------|
| Alacritty | `~/.config/alacritty/alacritty.toml` |
| Kitty | `~/.config/kitty/kitty.conf` |
| Ghostty | `~/.config/ghostty/config` |
| btop | `~/.config/btop/btop.conf` |
| fastfetch | `~/.config/fastfetch/config.jsonc` |
| lazygit | `~/.config/lazygit/config.yml` |
| starship | `~/.config/starship.toml` |
| git | `~/.config/git/config` |
| walker | `~/.config/walker/config.toml` |

### PipeWire Audio

```bash
# Check PipeWire status
systemctl --user status pipewire pipewire-pulse wireplumber

# Restart audio stack
systemctl --user restart pipewire pipewire-pulse wireplumber

# List audio devices
wpctl status

# Set default sink (output)
wpctl set-default SINK_ID

# Set volume
wpctl set-volume @DEFAULT_AUDIO_SINK@ 0.5        # 50%
wpctl set-volume @DEFAULT_AUDIO_SINK@ 5%+         # increase 5%
wpctl set-volume @DEFAULT_AUDIO_SINK@ 5%-         # decrease 5%

# Mute/unmute
wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle

# Interactive TUI
pavucontrol                                        # GUI mixer
```

### Btrfs & Snapper

```bash
# List subvolumes
sudo btrfs subvolume list /

# Show filesystem usage
sudo btrfs filesystem usage /
btrfs filesystem df /

# Scrub (check integrity)
sudo btrfs scrub start /
sudo btrfs scrub status /

# Balance (rebalance data across devices)
sudo btrfs balance start /
sudo btrfs balance status /

# Snapper — list snapshots
sudo snapper list

# Create manual snapshot
sudo snapper create -d "before update"

# Compare snapshots
sudo snapper diff 1..2

# Undo changes between snapshots
sudo snapper undochange 1..2

# Delete old snapshots
sudo snapper delete SNAPSHOT_NUMBER

# Snapper config
sudo snapper list-configs
cat /etc/snapper/configs/root
```

### Limine Bootloader

Config: `/boot/limine.conf` or `/boot/limine/limine.conf`

```bash
# After kernel update, regenerate initramfs
sudo mkinitcpio -P

# Limine config example entry:
# /Arch Linux
#     PROTOCOL=linux
#     KERNEL_PATH=boot():/vmlinuz-linux
#     CMDLINE=root=/dev/sdXn rw
#     MODULE_PATH=boot():/initramfs-linux.img

# Reinstall Limine to disk (if boot broken)
sudo limine bios-install /dev/sdX      # BIOS/MBR
# For UEFI: copy limine files to ESP
```

### Kernel & Hardware

```bash
# Current kernel
uname -r

# List installed kernels
pacman -Q | grep linux | grep -v lib

# Regenerate initramfs for all presets
sudo mkinitcpio -P

# View kernel messages
dmesg
dmesg -w                                # follow live
journalctl -b -k                        # kernel log, current boot

# Loaded modules
lsmod
modinfo module_name

# Load / unload module
sudo modprobe module_name
sudo modprobe -r module_name

# Blacklist a module: /etc/modprobe.d/blacklist.conf
# blacklist module_name
```

### Network (systemd-networkd + iwd)

This system uses **systemd-networkd** for network management and **iwd** for Wi-Fi — NOT NetworkManager.

```bash
# Check network interfaces
ip link
ip addr

# DNS resolution (systemd-resolved)
resolvectl status

# Restart networking
sudo systemctl restart systemd-networkd
sudo systemctl restart systemd-resolved

# Wi-Fi (iwd via iwctl)
iwctl station wlan0 scan
iwctl station wlan0 get-networks
iwctl station wlan0 connect SSID

# Check Wi-Fi status
iwctl station wlan0 show

# iwd known networks
iwctl known-networks list

# Check open ports
ss -tulnp

# Network config files
# /etc/systemd/network/*.network
# /var/lib/iwd/ (Wi-Fi profiles)
```

### Debugging

```bash
# Get backtrace of crashed app
gdb /path/to/binary
(gdb) run
(gdb) bt full

# Attach to running process
gdb -p $(pidof process_name)

# Core dumps (systemd-coredump)
coredumpctl list
coredumpctl info PID
coredumpctl gdb PID

# Debuginfod auto-downloads symbols from debuginfod.archlinux.org
```

### Maintenance

```bash
# Full update routine
sudo pacman -Syu && yay -Sua

# Check for .pacnew / .pacsave files after updates
sudo pacdiff                             # interactive merge (pacman-contrib)
find /etc -name "*.pacnew" -o -name "*.pacsave"

# Check system health
systemctl --failed
journalctl -p 3 -b                       # critical + error logs

# Disk usage
df -h
dust                                     # if installed, better du
ncdu /                                   # interactive

# Downgrade a package
sudo pacman -U /var/cache/pacman/pkg/package-old_version.pkg.tar.zst
# Or use the `downgrade` AUR package
```

## Common Workflows

### System Won't Boot

1. Boot from Arch ISO USB
2. Mount your root partition: `mount /dev/sdXn /mnt`
3. If btrfs, mount subvolume: `mount -o subvol=@ /dev/sdXn /mnt`
4. Mount boot: `mount /dev/sdXn /mnt/boot`
5. Chroot: `arch-chroot /mnt`
6. Check `journalctl -b -1` for previous boot errors
7. Regenerate initramfs: `mkinitcpio -P`
8. Check bootloader config: `cat /boot/limine.conf`
9. If package broke things, downgrade or `pacman -Syu`

### Snapper Rollback

```bash
# List snapshots to find pre-update state
sudo snapper list

# Compare what changed
sudo snapper diff PRE..POST

# Undo changes
sudo snapper undochange PRE..POST

# Or restore a snapshot (btrfs)
# Boot from ISO, mount btrfs root, mv broken subvol, snapshot good one
```

### No Audio After Update

```bash
# Restart the full audio stack
systemctl --user restart pipewire pipewire-pulse wireplumber

# Check if devices are detected
wpctl status

# Check for muted sinks
wpctl get-volume @DEFAULT_AUDIO_SINK@

# Check logs
journalctl --user -u pipewire -b
journalctl --user -u wireplumber -b

# Nuclear option: remove config and restart
rm -rf ~/.local/state/wireplumber/
systemctl --user restart wireplumber
```

### Hyprland Display Issues

```bash
# Check monitor detection
hyprctl monitors

# Force monitor config in hyprland.conf:
# monitor=DP-1,1920x1080@60,0x0,1

# If screen tearing, ensure in hyprland.conf:
# misc {
#     vfr = true
# }

# Check GPU driver
lspci -k | grep -A 2 VGA
```

## Troubleshooting Index

| Symptom | First Check | Deep Dive |
|---------|------------|-----------|
| Package conflict | `pacman -Qo /path` | Check if orphaned, then `--overwrite` |
| Locked database | `ps aux \| grep pacman` | Remove lock only if no pacman running |
| Service won't start | `systemctl status svc` + `journalctl -u svc` | Check deps, config files |
| No audio | `wpctl status` | Restart pipewire stack |
| Black screen on boot | Boot ISO, `arch-chroot`, check `journalctl -b -1` | GPU drivers, Limine config |
| Hyprland crash | `journalctl --user -u hyprland` | Check config syntax, GPU |
| Wi-Fi gone | `iwctl station wlan0 show` | `ip link`, check kernel module, restart iwd |
| Btrfs errors | `sudo btrfs device stats /` | `sudo btrfs scrub start /` |
| Slow boot | `systemd-analyze blame` | Disable slow services |
| Key/signature error | `sudo pacman-key --refresh-keys` | Re-init keyring |
