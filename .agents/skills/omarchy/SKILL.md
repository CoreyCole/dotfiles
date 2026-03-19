---
name: omarchy
description: Manage and configure Omarchy Linux systems. Use when user asks about Omarchy, Hyprland, themes, keybindings, system config, or any omarchy-* commands.
---

# Omarchy Skill

Manage [Omarchy](https://omarchy.org/) Linux systems using natural language.

## NEVER MODIFY CORE FILES

**DO NOT edit, write, or delete any files in `~/.local/share/omarchy/`**

This directory contains Omarchy's core system files. User configuration belongs in `~/.config/` instead.

If you need to change behavior controlled by a file in `~/.local/share/omarchy/`, find or create the corresponding override in `~/.config/`.

## Discovery

Omarchy provides ~145 commands following the pattern `omarchy-<category>-<action>`.

### Find Commands

```bash
# List all omarchy commands
compgen -c | grep -E '^omarchy-' | sort -u

# Find commands by category
compgen -c | grep -E '^omarchy-theme'
compgen -c | grep -E '^omarchy-restart'

# Read a command's source to understand it
cat $(which omarchy-theme-set)
```

### Command Categories

| Prefix | Purpose | Example |
|--------|---------|---------|
| `omarchy-refresh-*` | Reset config to Omarchy defaults (backs up first) | `omarchy-refresh-waybar` |
| `omarchy-restart-*` | Restart a service/app | `omarchy-restart-waybar` |
| `omarchy-toggle-*` | Toggle feature on/off | `omarchy-toggle-nightlight` |
| `omarchy-theme-*` | Theme management | `omarchy-theme-set <name>` |
| `omarchy-install-*` | Install optional software | `omarchy-install-docker-dbs` |
| `omarchy-launch-*` | Launch apps | `omarchy-launch-browser` |
| `omarchy-cmd-*` | System commands | `omarchy-cmd-screenshot` |
| `omarchy-pkg-*` | Package management | `omarchy-pkg-install <pkg>` |
| `omarchy-setup-*` | Initial setup tasks | `omarchy-setup-fingerprint` |
| `omarchy-update-*` | System updates | `omarchy-update` |

## References

See `references/` for detailed documentation:

- [`references/config-locations.md`](references/config-locations.md) — Config file paths for Hyprland, Waybar, terminals, UWSM, etc.
- [`references/safe-editing.md`](references/safe-editing.md) — Backup, edit, restart workflow for modifying configs
- [`references/common-tasks.md`](references/common-tasks.md) — Themes, keybindings, monitors, screenshots, fonts, troubleshooting
- [`references/manual-index.md`](references/manual-index.md) — Omarchy manual topic index (fetch from `https://learn.omacom.io` before answering "how do I" questions)
- [`references/looknfeel.md`](references/looknfeel.md) — Custom window border and gap settings

## Example Requests

- "Change my theme to catppuccin"
- "Add a keybinding for Super+E to open file manager"
- "Configure my external monitor"
- "Make the window gaps smaller"
- "Set up night light to turn on at sunset"
- "Show me what omarchy commands are available for bluetooth"
- "Increase waybar height"
- "Change my terminal font"
- "How do I install Steam?"
- "How do I install Windows on Omarchy?"
- "What keyboard shortcuts are available?"
- "How do I set up my fingerprint reader?"
