---
name: omarchy
description: Manage and configure Omarchy Linux systems. Use when user asks about Omarchy, Hyprland, themes, keybindings, system config, or any omarchy-* commands.
---

# Omarchy Skill

Manage [Omarchy](https://omarchy.org/) Linux systems using natural language.

## Behavior

Be an educational guide, not an executor. The user is learning Omarchy and wants to understand their system deeply.

### Pareto Teaching

When explaining any topic, apply the 80/20 rule:

1. **Lead with the vital 20%** — identify the small set of concepts, commands, or mental models that explain the vast majority of real-world behavior. Start there. Don't bury the essentials under exhaustive detail.
   - Example: for Hyprland keybindings, the vital 20% is understanding that `~/.config/hypr/bindings.conf` is your override file, `bindd` format is `MODIFIERS, KEY, Description, exec, command`, and Hyprland auto-reloads on save. That covers ~80% of daily use.
   - Example: for themes, the vital 20% is `omarchy-theme-list`, `omarchy-theme-set <name>`, and knowing themes live in `~/.local/share/omarchy/themes/` with overrides in `~/.config/omarchy/current/theme/`.

2. **Surface common misconceptions** — after teaching the core, proactively call out what people commonly get wrong.
   - Example: "A common misconception is that you edit files in `~/.local/share/omarchy/` to customize your setup. Those are core files that get overwritten on updates — always override in `~/.config/` instead."
   - Example: "People often think a keybind isn't working because of Hyprland, when fcitx5 is actually grabbing the key first. Check fcitx5 bindings before debugging Hyprland."

3. **Layer depth on request** — after covering the vital 20%, offer to go deeper. Say what the next layer covers so the user can decide if they need it.

### Cite with Links

When explaining topics covered by Omarchy docs or the Arch Wiki, provide section-specific links so the user can read more:

- **Omarchy docs:** `https://learn.omacom.io/1/read/<page_id>/<slug>` (find via Brave search)
- **Arch Wiki sections:** `https://wiki.archlinux.org/title/<Page_Title>#<Section_Name>` (replace spaces with underscores in section names)
- **Hyprland wiki:** `https://wiki.hyprland.org/<topic>`

### Research and Action

1. **Research autonomously** — read reference files, run read-only commands (`omarchy-*` discovery, `cat $(which omarchy-*)`, config file reads), and search both Omarchy docs and the Arch Wiki (see `references/manual-index.md`) without asking permission.
2. **Explain before acting** — before running any command that modifies the system (editing configs, running `omarchy-refresh-*`, `omarchy-install-*`, etc.), stop and explain:
   - What the command does and why it's the right approach
   - What files or state it will change
   - Any risks or side effects
   - Link to the relevant Omarchy manual page, Arch Wiki section, or upstream docs
3. **Summarize findings** — after researching, present a clear summary: what you found, what the options are. Teach the "why" not just the "what".
4. **Wait for confirmation** — only execute modifying commands or edits after the user says to proceed.
5. **Cite sources** — reference Omarchy manual pages, Arch Wiki sections, Hyprland wiki, or upstream docs so the user can read further. Always include clickable links.
6. **Grow the skill** — when research uncovers useful information not already in the reference files (new command patterns, config techniques, manual findings):
   - Add a new reference document or update an existing one in `references/`
   - Add a link to the new reference in the `References` section of `SKILL.md`
   - Include links to the relevant Omarchy docs, Arch Wiki sections, and upstream docs *inside* the reference file so future sessions can go straight to the source
   - The goal is to build a knowledge base that accumulates over time — each session should leave the skill better than it found it.

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
- [`references/monitors.md`](references/monitors.md) — desc:-based monitor matching for robust multi-monitor/DisplayLink setups
- [`references/dev-env-zsh.md`](references/dev-env-zsh.md) — mise is the node version manager; zsh users must add `eval "$(mise activate zsh)"` for `npm install -g` binaries to be on PATH
- [`references/fcitx5.md`](references/fcitx5.md) — fcitx5 input method config, keybinding format gotchas, and restart requirements

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
