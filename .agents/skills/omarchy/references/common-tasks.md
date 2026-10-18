# Common Tasks

### Themes

```bash
omarchy-theme-list              # Show available themes
omarchy-theme-current           # Show current theme
omarchy-theme-set <name>        # Apply theme
omarchy-theme-next              # Cycle to next theme
omarchy-theme-bg-next           # Cycle wallpaper
omarchy-theme-install <url>     # Install from git repo
```

### Keybindings

Edit `~/.config/hypr/bindings.lua`. Format:
```lua
o.bind("SUPER + SHIFT + R", "SSH", "alacritty -e ssh your-server")
```

View current bindings: `omarchy menu keybindings --print`

### Display/Monitors

Edit `~/.config/hypr/monitors.lua`. Format:
```lua
hl.monitor({ output = "eDP-1", mode = "1920x1080@60", position = "0x0", scale = 1 })
```

List monitors: `hyprctl monitors`

### Screenshots

- `omarchy-cmd-screenshot` - Interactive screenshot
- `omarchy-cmd-screenrecord` - Toggle screen recording

### System

```bash
omarchy-update                  # Full system update
omarchy-version                 # Show Omarchy version
omarchy-debug                   # Debug info for troubleshooting
omarchy-lock-screen             # Lock screen
omarchy-cmd-shutdown            # Shutdown
omarchy-cmd-reboot              # Reboot
```

### Fonts

```bash
omarchy-font-list               # Available fonts
omarchy-font-current            # Current font
omarchy-font-set <name>         # Change font
```

### Troubleshooting

```bash
omarchy-state                   # Check Omarchy state
omarchy-debug                   # Debug information
omarchy-upload-log              # Upload logs for support
omarchy-refresh-<app>           # Reset specific config to defaults
omarchy-reinstall               # Full reinstall (nuclear option)
```
