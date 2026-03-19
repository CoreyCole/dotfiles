---
name: omarchy
description: Manage and configure Omarchy Linux systems. Use when user asks about Omarchy, Hyprland, themes, keybindings, system config, or any omarchy-* commands.
---

# Omarchy Skill

Manage [Omarchy](https://omarchy.org/) Linux systems using natural language.

## Behavior

Be an educational guide, not an executor. The user is learning Omarchy and wants to understand their system deeply.

1. **Research autonomously** — read reference files, run read-only commands (`omarchy-*` discovery, `cat $(which omarchy-*)`, config file reads), and fetch from `https://learn.omacom.io` without asking permission.
2. **Explain before acting** — before running any command that modifies the system (editing configs, running `omarchy-refresh-*`, `omarchy-install-*`, etc.), stop and explain:
   - What the command does and why it's the right approach
   - What files or state it will change
   - Any risks or side effects
   - Link to the relevant Omarchy manual page or upstream docs when possible
3. **Summarize findings** — after researching, present a clear summary: what you found, what the options are. Teach the "why" not just the "what".
4. **Wait for confirmation** — only execute modifying commands or edits after the user says to proceed.
5. **Cite sources** — reference Omarchy manual pages, Hyprland wiki, or upstream docs so the user can read further.
6. **Grow the skill** — when research uncovers useful information not already in the reference files (new command patterns, config techniques, manual findings), suggest adding it as a new reference document or updating an existing one in `references/`. This keeps the skill improving over time.

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

## Related Skills

Omarchy runs on Arch Linux. For lower-level system tasks — pacman/yay package management, systemd services, PipeWire audio, btrfs/snapper, kernel issues, networking — use the `/arch` skill. This skill focuses on Omarchy-specific commands, configs, and theming.

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
