# Dotfiles Notes

## Pi config layout

This repo currently uses `~/.pi -> ~/dotfiles/.pi-config`.

Pi auto-discovers global `settings.json`, `extensions/`, `skills/`, `themes/`, and related resources from paths under `~/.pi/agent/`, so the tracked config mirrors those resources into `.pi-config/agent/` with symlinks while keeping the source files at the top level of `.pi-config/`.

Current layout:

- Active symlink: `~/.pi -> ~/dotfiles/.pi-config`
- Runtime discovery paths: `~/.pi/agent/extensions`, `~/.pi/agent/skills`, `~/.pi/agent/agents`, `~/.pi/agent/mcp.json`
- Tracked source dirs: `.pi-config/extensions`, `.pi-config/skills`, `.pi-config/agents`, `.pi-config/mcp.json`

Recommended setup:

```bash
ln -sfn ~/dotfiles/.pi-config ~/.pi
```

Then run:

```bash
~/dotfiles/.pi-config/setup.sh
```

That script recreates the `agent/*` symlinks Pi expects.

For Pi-specific agent behavior inside the tracked config, also read `.pi-config/AGENTS.md`.

## Pi extension ownership

When editing `~/.pi/agent` / `.pi-config`, avoid loading duplicate extensions that register the same tool name from both a local file and a package.

Current intentional local ownership:

- `.pi-config/extensions/answer.ts`
- `.pi-config/extensions/execute-command.ts`

These are explicitly loaded from `.pi-config/agent/settings.json`. Do **not** also load another `execute_command` or `answer` implementation from an imported config/package unless you are deliberately replacing the local version.

## Pi config research ground truth

When planning or implementing Pi config changes in this repo:

- use `context/pi-mono` as the local ground-truth source for Pi behavior, APIs, extension events, resource loading, and settings semantics
- use the `pi` skill for Pi-specific work
- do not rely only on memory or upstream examples when the local `context/pi-mono` clone can answer the question

This is especially important for extension hooks, resource loading, AGENTS.md behavior, and other config/runtime integration changes.
