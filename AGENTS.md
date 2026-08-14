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

The global `.pi-config` owns user-level, project-agnostic resources that must load for every Pi session. Provider performance telemetry is one example.

Vamos owns all Vamos-specific skills, extensions, prompts, agents, launcher guidance, and Hermes-to-Pi behavior. The canonical staging source is `~/cn/chestnut-flake/vamos`; use its `docs/cli-launcher.md` for installation and repair.

Dotfiles owns only project-agnostic Pi configuration. Do not copy, symlink, or globally auto-load Vamos resources from `.pi-config`. Managed children must load them explicitly from the Vamos checkout selected by the stable launcher.

When editing `~/.pi/agent` or `.pi-config`, avoid duplicate extensions that register the same tool name from local and package sources.

Current intentional local ownership:

- `.pi-config/agent/extensions/answer.ts`

Do **not** load another `answer` implementation from an imported config or package unless you intentionally replace the local version.

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

## Vamos CLI launcher

The stable PATH launcher uses `~/cn/chestnut-flake/vamos` as its staging runtime source. Canonical setup, override, doctor, and repair instructions live in `~/cn/chestnut-flake/vamos/docs/cli-launcher.md`; do not duplicate them here.
