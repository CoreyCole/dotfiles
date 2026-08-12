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

Vamos is the reusable open-source orchestration platform for all managed projects. It owns shared context, agent-session data, QRSPI skills, and Hermes-to-Pi communication.

Vamos implements QRSPI with separate Pi context windows for each workflow stage. Its Pi extensions belong under `~/cn/chestnut-flake/vamos/.pi/extensions/`.

`cn-agents` is the Chestnut host and library consumer of the Vamos server. It does not own generic Vamos orchestration extensions.

During `/q-hermes-manager`, Hermes starts managed workers through `vamos hermes pi start`. The launcher must load Vamos-owned extensions from the selected Vamos runtime checkout, independent of the worker's project directory.

Do not copy, symlink, or globally auto-load Vamos extensions from `.pi-config/agent/extensions/`. Develop them in `~/cn/chestnut-flake/vamos` and promote them through the normal Vamos merge workflow.

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

The `vamos` command on PATH is intentionally a stable launcher binary, not the runtime itself. It reads launcher config, fingerprints the configured runtime source checkout, builds a cached `vamos-runtime` when relevant source changes, then execs that runtime.

Dogfood runtime and Pi skill development happens in `~/cn/chestnut-flake/vamos`. Point the launcher and Pi skill configuration at that working checkout, verify changes there, and promote tested commits to `~/cn/chestnut-flake/vamos-main` afterward. Runtime source edits go live automatically on the next `vamos ...` invocation after the launcher rebuilds its managed cache; normal runtime changes do not require rebuilding `~/.local/bin/vamos`.

Only rebuild the stable launcher when changing `cmd/vamos-launcher` itself:

```bash
cd ~/cn/chestnut-flake/vamos
go build -o ~/.local/bin/vamos ./cmd/vamos-launcher
vamos launcher configure --runtime-source-root ~/cn/chestnut-flake/vamos
vamos launcher doctor
```

Useful checks:

```bash
which vamos
vamos launcher doctor
VAMOS_PACKAGE_ROOT=~/cn/chestnut-flake/vamos vamos hermes pi start --help
```

Use `VAMOS_PACKAGE_ROOT=/absolute/path/to/checkout` to temporarily force a feature checkout as the runtime source without changing persisted launcher config.
