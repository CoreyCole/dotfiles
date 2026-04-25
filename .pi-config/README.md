# Pi dotfiles layout

This directory is the tracked source of truth for Corey Cole's global Pi config.

## Active symlink layout

The live machine layout is:

- `~/.pi -> ~/dotfiles/.pi-config`

Within that tracked config:

- `agent/` holds Pi runtime files and the paths Pi expects under `~/.pi/agent/`
- top-level `extensions/`, `skills/`, and `agents/` are the tracked source directories
- `agent/` exposes those tracked directories back to Pi via symlinks

## Why this exists

Pi auto-discovers global extensions and similar resources from paths under `~/.pi/agent/`, especially:

- `~/.pi/agent/extensions/`
- `~/.pi/agent/skills/`
- `~/.pi/agent/agents/`

Because `~/.pi` itself is symlinked to this tracked directory, the top-level path `~/.pi/extensions/` also exists, but that path is **not** the canonical auto-discovery location for Pi global extensions.

Use this mental model:

- tracked source: `~/dotfiles/.pi-config/extensions/*.ts`
- runtime discovery path: `~/.pi/agent/extensions/*.ts`
- bridge between them: `~/dotfiles/.pi-config/agent/extensions -> ../extensions`

## Important paths

### Tracked source

- `extensions/` — custom global Pi extensions checked into dotfiles
- `skills/` — custom skills checked into dotfiles
- `agents/` — custom agent definitions checked into dotfiles
- `mcp.json` — tracked MCP configuration
- `AGENTS.md` — repo-specific instructions for working on this Pi config

### Runtime state

- `agent/settings.json`
- `agent/auth.json`
- `agent/sessions/`
- `agent/run-history.jsonl`
- `agent/git/`

### Runtime symlinks

- `agent/extensions -> ../extensions`
- `agent/skills -> ../skills`
- `agent/agents -> ../agents`
- `agent/mcp.json -> ../mcp.json`

## Extension rule of thumb

When adding or editing a global extension:

1. edit the tracked file in `extensions/`
2. rely on `agent/extensions/` symlink for Pi discovery
3. do **not** assume `~/.pi/extensions/` is the correct Pi discovery path just because it exists on disk

## Setup

Run:

```bash
~/dotfiles/.pi-config/setup.sh
```

That script:

- validates the `~/.pi` symlink
- re-establishes the `agent/*` resource symlinks Pi expects
- installs the configured Pi packages
- ensures `parallel-cli` is installed for `pi-parallel`

## pi-parallel dependency

`pi-parallel` shells out to the external `parallel-cli` binary. Installing the Pi package alone is not enough.

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
