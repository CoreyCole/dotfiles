# Debugging & Maintenance

## Debugging

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

## Maintenance

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

## App Config Locations

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
