# Dotfiles Notes

## Pi config layout

The tracked Pi config in this repo must be the direct target of `~/.pi/agent`.

- Correct: `~/.pi/agent -> ~/dotfiles/.pi-config`
- Also correct if you rename the tracked dir: `~/.pi/agent -> ~/dotfiles/.pi-agents`
- Wrong: `~/.pi -> ~/dotfiles/.pi-config`
- Wrong: `~/.pi/agent -> ~/dotfiles/.pi-config/agent`

Pi resolves global `settings.json`, `extensions/`, `skills/`, `themes/`, and other auto-discovered resources relative to `~/.pi/agent`, so those directories must live directly under the symlink target.

Recommended setup:

```bash
mkdir -p ~/.pi
ln -sfn ~/dotfiles/.pi-config ~/.pi/agent
```

If `~/.pi/agent` already exists as a real directory, remove or move it first, then recreate the symlink.

For Pi-specific agent behavior inside the tracked config, also read `.pi-config/AGENTS.md`.
