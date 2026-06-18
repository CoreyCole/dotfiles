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
- `package.json` and `pnpm-lock.yaml` — local TypeScript extension runtime/development dependencies

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

That script validates the `~/.pi` symlink and required `agent/*` paths, installs this config package's local `pnpm` dependencies, then prints manual remediation guidance for missing external tools. It does not install Pi packages, Homebrew packages, or `parallel-cli`.

## Local extension dependencies

The root `package.json` and `pnpm-lock.yaml` provide runtime dependencies for local TypeScript extensions plus useful dependency metadata and LSP support.

Run setup to install them:

```bash
~/dotfiles/.pi-config/setup.sh
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

## pi-docparser host dependencies

`maxedapps/pi-docparser` is configured as a Pi package and provides the `document_parse` tool. It uses LiteParse locally, so some formats need host conversion tools in addition to the Pi package itself.

Install the common dependencies for the document types you expect to parse:

```bash
# macOS
brew install --cask libreoffice
brew install imagemagick ghostscript

# If the current Homebrew LibreOffice cask is broken on your macOS version,
# download the ARM DMG from https://www.libreoffice.org/download/.
# The app includes /Applications/LibreOffice.app/Contents/MacOS/soffice;
# this repo's .zshrc adds that directory to PATH on Darwin when present.

# Ubuntu / Debian
apt-get install libreoffice imagemagick ghostscript

# Windows, using Chocolatey
choco install libreoffice-fresh imagemagick.app ghostscript
```

Dependency purposes:

- LibreOffice / LibreOffice Still: many Office document and spreadsheet conversion paths (`.docx`, `.pptx`, `.xlsx`, etc.)
- ImageMagick: image-to-PDF conversion paths
- Ghostscript: some image/vector conversion paths

If document parsing fails or you want a machine-specific preflight check, run inside Pi:

```text
/docparser:doctor
/docparser:doctor @./path/to/document.docx
```

Upstream reference: <https://github.com/maxedapps/pi-docparser/tree/main#host-dependencies>

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
