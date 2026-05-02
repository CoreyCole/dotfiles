# Pi dotfiles layout

This directory is the tracked source of truth for Corey Cole's global Pi config.

## Active layout

The live machine layout is:

- `~/.pi -> ~/dotfiles/.pi-config`

Within that tracked config, `agent/` is both the tracked resource location and the runtime location Pi expects under `~/.pi/agent/`.

## Why this exists

Pi auto-discovers global extensions and similar resources from paths under `~/.pi/agent/`, especially:

- `~/.pi/agent/extensions/`
- `~/.pi/agent/skills/`
- `~/.pi/agent/agents/`

Because `~/.pi` is symlinked to this tracked directory, those paths resolve directly to:

- `~/dotfiles/.pi-config/agent/extensions/`
- `~/dotfiles/.pi-config/agent/skills/`
- `~/dotfiles/.pi-config/agent/agents/`

There is no extra resource symlink layer.

## Important paths

### Tracked source config

- `agent/settings.json` — tracked Pi settings, package declarations, and explicit extension includes
- `agent/mcp.json` — tracked MCP configuration
- `agent/extensions/` — custom global Pi extensions checked into dotfiles
- `agent/extensions/subagent/config.json` — tracked `nicobailon/pi-subagents` parallel limit config
- `agent/skills/` — custom skills checked into dotfiles
- `agent/agents/` — custom agent definitions checked into dotfiles
- `agent/scripts/` — scripts used by tracked extensions/tool hooks
- `config/tool-hooks.json` — tracked tool-hook configuration
- `AGENTS.md` — repo-specific instructions for working on this Pi config
- `package.json` and `package-lock.json` — optional local TypeScript/LSP support for extension development

### Ignored runtime/cache/local state

- `agent/auth.json`
- `agent/sessions/`
- `agent/run-history.jsonl`
- `agent/git/`
- `history/`
- `context/`
- `node_modules/`

## Package declarations vs package caches

Configured Pi packages are declared in tracked source config at:

```text
.pi-config/agent/settings.json
```

Global git package caches are generated under:

```text
.pi-config/agent/git/<host>/<path>
```

That cache directory is intentionally ignored. Do not copy package code into another tracked directory. If a configured package is missing, Pi can resolve it into `agent/git/` during normal startup when online. Use `pi list` for visibility and `pi install <source>` only when manually remediating a package.

## Extension rule of thumb

When adding or editing a global extension, edit the tracked file in:

```text
.pi-config/agent/extensions/
```

Do **not** assume `~/.pi/extensions/` is the correct Pi discovery path just because `~/.pi` points at this directory. Pi's global discovery path is `~/.pi/agent/extensions/`.

## Setup

Run:

```bash
~/dotfiles/.pi-config/setup.sh
```

That script validates the `~/.pi` symlink and required `agent/*` paths, then prints manual remediation guidance for missing tools. It does not install Pi packages, npm dependencies, Homebrew packages, or `parallel-cli`.

## Optional local extension development

The root `package.json` and `package-lock.json` are kept so local TypeScript extensions get useful dependency metadata and LSP support.

They are not required for normal Pi startup. If you are editing local TypeScript extensions and want local dependencies installed, run manually:

```bash
cd ~/.pi
npm install
```

## pi-parallel dependency

`HazAT/pi-parallel` is configured as a Pi package, but it shells out to the external `parallel-cli` binary. Installing or resolving the Pi package alone is not enough for Parallel.ai tools.

Preferred install method:

```bash
curl -fsSL https://parallel.ai/install.sh | bash
```

Alternative install methods documented by Parallel include:

```bash
brew install parallel-web/tap/parallel-cli
npm install -g parallel-web-cli
```

Authentication:

```bash
parallel-cli login
```

Headless or CI alternative:

```bash
export PARALLEL_API_KEY="your_api_key"
```

Documentation discovery entrypoint:

```text
https://docs.parallel.ai/llms.txt
```

If `parallel-cli` is missing, Pi tools like `parallel_search`, `parallel_extract`, `parallel_research`, and `parallel_enrich` fail with errors like:

```text
spawn parallel-cli ENOENT
```

## pi-subagents parallel limits

The `nicobailon/pi-subagents` package reads optional config from:

```text
~/.pi/agent/extensions/subagent/config.json
```

This repo tracks that file at:

```text
.pi-config/agent/extensions/subagent/config.json
```

Current intended limits:

```json
{
  "parallel": {
    "maxTasks": 16,
    "concurrency": 16
  }
}
```
