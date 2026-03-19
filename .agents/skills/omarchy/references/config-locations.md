# Configuration Locations

### Hyprland (Window Manager)

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

**Restart/Refresh:**
- `omarchy-refresh-hyprland` - Reset to defaults
- Hyprland auto-reloads on config save (no restart needed)
- `omarchy-restart-hypridle` / `omarchy-restart-hyprsunset` for those services

### Waybar (Status Bar)

```
~/.config/waybar/
├── config.jsonc       # Bar layout and modules (JSONC format)
└── style.css          # Styling
```

**Restart/Refresh:**
- `omarchy-restart-waybar` - Restart waybar
- `omarchy-refresh-waybar` - Reset to defaults
- `omarchy-toggle-waybar` - Show/hide

### Walker (App Launcher)

```
~/.config/walker/
└── config.toml        # Launcher configuration
```

**Restart/Refresh:**
- `omarchy-restart-walker`
- `omarchy-refresh-walker`

### Terminals

```
~/.config/alacritty/alacritty.toml
~/.config/kitty/kitty.conf
~/.config/ghostty/config
```

**Restart:**
- `omarchy-restart-terminal`

### Default Applications (UWSM)

```
~/.config/uwsm/default       # Default terminal, editor, browser + env vars
```

Sets the environment variables that Omarchy reads to determine which apps to launch. Changes require a restart. Key variables:
- `TERMINAL` - Terminal emulator (default: `xdg-terminal-exec`)
- `EDITOR` - Text editor (default: `nvim`)
- `BROWSER` - Web browser (default: `zen-browser`)
- `OMARCHY_SCREENSHOT_DIR` - Custom screenshot directory
- `OMARCHY_SCREENRECORD_DIR` - Custom screenrecord directory

### Default Terminal (xdg-terminal-exec)

```
~/.config/xdg-terminals.list   # Preferred terminal for xdg-terminal-exec
```

List `.desktop` entry IDs one per line in order of preference. The first installed terminal wins. Example:
```
org.wezfurlong.wezterm.desktop
```

Common terminals: `org.wezfurlong.wezterm.desktop`, `com.mitchellh.ghostty.desktop`, `kitty.desktop`, `Alacritty.desktop`, `org.codeberg.dnkl.foot.desktop`

**Note:** The file must be at `~/.config/xdg-terminals.list` (NOT in a subdirectory). Takes effect immediately, no restart needed.

### MIME Type Associations

```
~/.config/mimeapps.list       # File type → application mappings
```

Controls which app opens when you open a file by type (e.g., images → imv, PDFs → Evince, videos → mpv). Edit this file to change what app handles each file type.

### Other Configs

| App | Location |
|-----|----------|
| btop | `~/.config/btop/btop.conf` |
| fastfetch | `~/.config/fastfetch/config.jsonc` |
| lazygit | `~/.config/lazygit/config.yml` |
| starship | `~/.config/starship.toml` |
| git | `~/.config/git/config` |

### Omarchy Data

```
~/.local/share/omarchy/
├── bin/               # All omarchy-* scripts
├── config/            # Default config templates
├── themes/            # Installed themes
└── version            # Current version info
```
