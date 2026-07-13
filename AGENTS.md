# Dotfiles Notes

## Party on main

We don't make branches for this repo. Pull with rebase and commit to main.

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

Do **not** also load another `answer` implementation from an imported config/package unless you are deliberately replacing the local version.

## Pi config research ground truth

When planning or implementing Pi config changes in this repo:

- use `context/pi` as the local ground-truth source for Pi behavior, APIs, extension events, resource loading, and settings semantics
- use the `pi` skill for Pi-specific work
- do not rely only on memory or upstream examples when the local `context/pi` clone can answer the question

This is especially important for extension hooks, resource loading, AGENTS.md behavior, and other config/runtime integration changes.

## Pi config dependencies and imports

The `.pi-config` package uses pnpm. When installing, updating, or removing dependencies for Pi config, run commands from `.pi-config/` with `pnpm`.

Pi extensions should import Pi APIs and TUI components by package name so the config works across machines:

```ts
import { type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
```

## Vamos CLI launcher in `context/vamos`

The `vamos` command on PATH is intentionally a stable launcher binary, not the runtime itself. It reads launcher config, fingerprints the configured runtime source checkout, builds a cached `vamos-runtime` when relevant source changes, then execs that runtime.

For this dotfiles checkout, runtime development happens in `~/dotfiles/context/vamos`. If `vamos launcher doctor` shows `runtime source root: /Users/swarm/dotfiles/context/vamos`, source edits under `context/vamos` go live automatically on the next `vamos ...` invocation after the launcher rebuilds the managed runtime cache. You do not need to rebuild `~/.local/bin/vamos` for normal runtime changes.

Only rebuild the launcher itself when changing `cmd/vamos-launcher`:

```bash
cd ~/dotfiles/context/vamos
go build -o ~/.local/bin/vamos ./cmd/vamos-launcher
vamos launcher configure --runtime-source-root ~/dotfiles/context/vamos
vamos launcher doctor
```

Useful checks:

```bash
which vamos
vamos launcher doctor
VAMOS_PACKAGE_ROOT=~/dotfiles/context/vamos vamos qrspi --help
```

Use `VAMOS_PACKAGE_ROOT=/absolute/path/to/checkout` to temporarily force a feature checkout as the runtime source without changing persisted launcher config.
