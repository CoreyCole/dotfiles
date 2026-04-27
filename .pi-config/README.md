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

### Tracked resources

- `agent/extensions/` — custom global Pi extensions checked into dotfiles
- `agent/skills/` — custom skills checked into dotfiles
- `agent/agents/` — custom agent definitions checked into dotfiles
- `agent/mcp.json` — tracked MCP configuration
- `AGENTS.md` — repo-specific instructions for working on this Pi config

### Runtime state

- `agent/settings.json`
- `agent/auth.json`
- `agent/sessions/`
- `agent/run-history.jsonl`
- `agent/git/`

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

That script:

- validates the `~/.pi` symlink
- validates required `agent/*` resource paths
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
