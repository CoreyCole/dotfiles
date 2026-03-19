# Hyprland / Wayland

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

## Waybar

Config: `~/.config/waybar/config.jsonc` (JSONC format — supports comments)
Style: `~/.config/waybar/style.css`

```bash
# Restart waybar
killall waybar && waybar &

# Test config with debug output
waybar -l debug
```

## Display Troubleshooting

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
