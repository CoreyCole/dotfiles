# Configuration Locations

### Hyprland (Window Manager)

Omarchy Quattro configures Hyprland in Lua. User files load after Omarchy defaults:

```
~/.config/hypr/
├── hyprland.lua       # Main config (loads Omarchy defaults, then user files)
├── bindings.lua       # Keybindings
├── monitors.lua       # Display configuration
├── input.lua          # Keyboard/mouse settings
├── looknfeel.lua      # Appearance (gaps, borders, animations)
├── autostart.lua      # Startup applications
├── hyprsunset.conf    # Night light / blue light filter
└── xdph.conf          # Screen sharing / desktop portal
```

**Restart/Refresh:**
- Hyprland auto-reloads Lua on save; force with `hyprctl reload` and check `hyprctl configerrors`
- `omarchy refresh hyprland` - Reset Lua config files to defaults
- `omarchy restart hyprsunset` / `omarchy refresh hyprsunset` for night light

Do not edit or relink retired Omarchy 3 files: `hyprland.conf`, `bindings.conf`, `monitors.conf`, `input.conf`, `looknfeel.conf`, `autostart.conf`, `hypridle.conf`, `hyprlock.conf`.

### Omarchy Shell (Bar, Launcher, Lock, Idle)

One Quickshell process replaced Waybar, Walker, Mako, SwayOSD, hyprlock, and hypridle.

```
~/.config/omarchy/shell.json   # Bar layout, idle timings, plugins
~/.config/omarchy/shell.toml   # Shell appearance and dimensions
```

**Commands:**
- `omarchy bar ...` - Position, transparency, widget layout
- `omarchy toggle bar` - Show/hide
- `omarchy restart shell` / `omarchy refresh shell`

Do not track or symlink `~/.config/waybar` or `~/.config/walker`.

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

### fcitx5 (Input Method)

```
~/.config/fcitx5/
├── profile                # Input method groups/layouts
└── conf/
    ├── keyboard.conf      # Spell hints, completion, candidate keys
    ├── clipboard.conf     # Clipboard manager
    ├── xcb.conf           # XCB settings
    └── notifications.conf # Notification preferences
```

**Restart:** `killall fcitx5; sleep 1; fcitx5 --disable notificationitem -d`
(`fcitx5-remote -r` does NOT reliably reload keybinding changes)

See [`references/fcitx5.md`](fcitx5.md) for keybinding details and config format gotchas.

### Other Configs

| App | Location |
|-----|----------|
| btop | `~/.config/btop/btop.conf` |
| fastfetch | `~/.config/fastfetch/config.jsonc` |
| lazygit | `~/.config/lazygit/config.yml` |
| starship | `~/.config/starship.toml` |
| git | `~/.config/git/config` |

### Omarchy Data

Package/core files (never edit):

```
/usr/share/omarchy/
├── bin/               # omarchy-* commands
├── config/            # Default config templates
├── default/           # Default Hyprland Lua, UWSM env, etc.
└── themes/            # Packaged themes
```

Generated current theme state (do not track):

```
~/.local/state/omarchy/current/
```
