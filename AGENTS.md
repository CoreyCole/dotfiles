# Dotfiles Notes

## Pi config layout

This repo currently uses `~/.pi -> ~/dotfiles/.pi-config`.

Pi auto-discovers global `settings.json`, `extensions/`, `skills/`, `themes/`, and related resources from paths under `~/.pi/agent/`, so the tracked config stores those resources directly under `.pi-config/agent/`.

Current layout:

- Active symlink: `~/.pi -> ~/dotfiles/.pi-config`
- Runtime/tracked discovery paths: `.pi-config/agent/extensions`, `.pi-config/agent/skills`, `.pi-config/agent/agents`, `.pi-config/agent/mcp.json`

Recommended setup:

```bash
ln -sfn ~/dotfiles/.pi-config ~/.pi
```

Then run:

```bash
~/dotfiles/.pi-config/setup.sh
```

That script validates the `~/.pi` symlink and required `agent/*` resource paths.

For Pi-specific agent behavior inside the tracked config, also read `.pi-config/AGENTS.md`.

## Pi extension ownership

When editing `~/.pi/agent` / `.pi-config`, avoid loading duplicate extensions that register the same tool name from both a local file and a package.

Current intentional local ownership:

- `.pi-config/agent/extensions/answer.ts`
- `.pi-config/agent/extensions/execute-command.ts`

These are explicitly loaded from `.pi-config/agent/settings.json`. Do **not** also load another `execute_command` or `answer` implementation from an imported config/package unless you are deliberately replacing the local version.

## Pi config research ground truth

When planning or implementing Pi config changes in this repo:

- use `context/pi-mono` as the local ground-truth source for Pi behavior, APIs, extension events, resource loading, and settings semantics
- use the `pi` skill for Pi-specific work
- do not rely only on memory or upstream examples when the local `context/pi-mono` clone can answer the question

This is especially important for extension hooks, resource loading, AGENTS.md behavior, and other config/runtime integration changes.
