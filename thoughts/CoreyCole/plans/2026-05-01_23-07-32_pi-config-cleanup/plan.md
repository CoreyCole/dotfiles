---
date: 2026-05-02T00:30:14-07:00
researcher: CoreyCole
last_updated_by: CoreyCole
git_commit: b55fe11e0d049623c5940f8b015ba5d36c3a99f9
branch: main
repository: dotfiles
stage: plan
ticket: pi-config cleanup and organization
plan_dir: thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup
---

# Implementation Plan: Pi Config Cleanup and Organization

## Status

- [x] Slice 1: Source/runtime boundary documentation and git hygiene
- [x] Slice 2: Validation-only setup script
- [x] Slice 3: Subagent name deconfliction and model normalization
- [ ] Slice 4: Package config, optional dev dependencies, and Parallel tooling docs
- [ ] Slice 5: Final validation sweep

## Global Implementation Notes

- Work on `main`; this repo intentionally does not use branches.
- Keep the active Pi layout unchanged: `~/.pi -> ~/dotfiles/.pi-config`, with resources under `.pi-config/agent/`.
- Do not move resources to `.pi-config/extensions/` or `~/.pi/extensions/`.
- Do not add install side effects to `.pi-config/setup.sh`; no `pi install`, no `npm install`, no `curl | bash`, no `brew install`.
- Keep `.pi-config/package.json` and `.pi-config/package-lock.json`; they support local TypeScript/LSP work for extensions.
- Do not edit ignored package caches under `.pi-config/agent/git/` except for read-only reference.
- Exclude `.pi-config/node_modules/` and `.pi-config/agent/git/` from repository searches unless explicitly checking ignored state.

______________________________________________________________________

## Slice 1: Source/runtime boundary documentation and git hygiene

### Files

- `.pi-config/README.md` (modify)
- `.pi-config/AGENTS.md` (modify)
- `.gitignore` (modify)
- `.pi-config/.gitignore` (modify)
- `.pi-config/agent/extensions/subagent/config.json` (keep as source config; ensure it is not ignored)
- `.pi-config/pi-subagents/**` (ensure absent from working tree; leave tracked deletions in place until commit/stage)

### Changes

**`.pi-config/README.md`**: replace the file with this content. Later slices may refine this same file; keep this as the baseline structure.

````markdown
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
````

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

````

**`.pi-config/AGENTS.md`**: edit only the `## Project Notes` bullets near the top so `agent/settings.json` is classified as tracked source config, not runtime state. The resulting block should read:

```markdown
## Project Notes

- The `pi-mono` source code is cloned at `context/pi-mono`.
- This dotfiles repo currently uses:
  - `~/.pi -> ~/dotfiles/.pi-config`
- Pi auto-discovers global resources from paths under `~/.pi/agent/`.
- Tracked Pi resources live directly in `agent/`, matching Pi's runtime layout:
  - `agent/settings.json`
  - `agent/extensions/`
  - `agent/skills/`
  - `agent/agents/`
  - `agent/mcp.json`
- Runtime state also lives in `agent/` and is ignored where appropriate:
  - `agent/auth.json`
  - `agent/sessions/`
  - `agent/run-history.jsonl`
  - `agent/git/`
- Do **not** rely on `~/.pi/extensions/` for auto-discovery. Pi loads global extensions from `~/.pi/agent/extensions/`.
````

Do not rewrite the rest of `.pi-config/AGENTS.md`.

**`.gitignore`**: remove the stale line for the deleted tracked cache copy:

```diff
-.pi-config/pi-subagents/node_modules/
```

Keep existing `.pi-config/node_modules/`, `.pi-config/agent/auth.json`, `.pi-config/agent/sessions/`, and `.pi-config/agent/run-history.jsonl` ignores.

**`.pi-config/.gitignore`**: replace the file with this content so ignored local state is explicit at the config-root level:

```gitignore
# Runtime/state files generated by pi
auth.json
git/
run-history.jsonl
sessions/
history/
context/
node_modules/
```

**`.pi-config/agent/extensions/subagent/config.json`**: keep the existing file content exactly:

```json
{
  "parallel": {
    "maxTasks": 16,
    "concurrency": 16
  }
}
```

Ensure `git check-ignore -v .pi-config/agent/extensions/subagent/config.json` prints nothing; it should be eligible to track.

**`.pi-config/pi-subagents/**`**: if the directory still exists in the working tree, remove it:

```bash
rm -rf .pi-config/pi-subagents
```

Do not recreate it. Active package code belongs under ignored `.pi-config/agent/git/github.com/nicobailon/pi-subagents/`.

### Tests

No new test files for this documentation/git-boundary slice.

### Verify

```bash
git status --short -- .pi-config .gitignore

test -f .pi-config/agent/settings.json
test -f .pi-config/agent/extensions/subagent/config.json
test ! -e .pi-config/pi-subagents

! git check-ignore -q .pi-config/agent/settings.json
! git check-ignore -q .pi-config/agent/extensions/subagent/config.json

git check-ignore -v \
  .pi-config/node_modules \
  .pi-config/agent/auth.json \
  .pi-config/agent/sessions \
  .pi-config/agent/run-history.jsonl \
  .pi-config/agent/git \
  .pi-config/history \
  .pi-config/context
```

Expected: `agent/settings.json` and `agent/extensions/subagent/config.json` are not ignored; stale `.pi-config/pi-subagents` is absent from the working tree; runtime/cache paths remain ignored.

______________________________________________________________________

## Slice 2: Validation-only setup script

### Files

- `.pi-config/setup.sh` (modify)
- `.pi-config/README.md` (confirm setup section from Slice 1 still matches behavior)

### Changes

**`.pi-config/setup.sh`**: replace the file with this validation/reporting-only script. Keep installer command text out of this script so the no-installer grep checks stay meaningful; detailed manual install commands live in `.pi-config/README.md`.

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXPECTED_PI_DIR="$HOME/.pi"
EXPECTED_AGENT_DIR="$EXPECTED_PI_DIR/agent"

# Resolve symlinks before comparing.
RESOLVED_SCRIPT_DIR="$(cd "$SCRIPT_DIR" && pwd -P)"
RESOLVED_PI_DIR="$(cd "$EXPECTED_PI_DIR" 2>/dev/null && pwd -P || echo "")"

if [ "$RESOLVED_SCRIPT_DIR" != "$RESOLVED_PI_DIR" ]; then
  echo "This tracked config is expected to be symlinked as ~/.pi"
  echo "  Current location: $SCRIPT_DIR"
  echo "  Expected symlink target: $EXPECTED_PI_DIR"
  echo ""
  echo "  Run: ln -sfn \"$SCRIPT_DIR\" \"$EXPECTED_PI_DIR\""
  exit 1
fi

echo "Validating pi-config at $EXPECTED_PI_DIR"
echo ""

missing=0

require_dir() {
  local relative_path="$1"
  if [ ! -d "$EXPECTED_AGENT_DIR/$relative_path" ]; then
    echo "missing: agent/$relative_path directory"
    missing=1
    return
  fi
  echo "ok: agent/$relative_path directory"
}

require_file() {
  local relative_path="$1"
  if [ ! -f "$EXPECTED_AGENT_DIR/$relative_path" ]; then
    echo "missing: agent/$relative_path file"
    missing=1
    return
  fi
  echo "ok: agent/$relative_path file"
}

echo "Checking required Pi resource paths under ~/.pi/agent ..."
require_dir extensions
require_dir skills
require_dir agents
require_file settings.json
require_file mcp.json

if [ "$missing" -ne 0 ]; then
  echo ""
  echo "Pi config validation failed. Fix the missing path(s) above and rerun setup."
  exit 1
fi

echo ""
echo "Checking command-line dependencies ..."

if command -v pi >/dev/null 2>&1; then
  echo "ok: pi CLI is available"
else
  echo "warning: pi CLI not found"
  echo "  Install Pi before using this config. Configured packages are declared in:"
  echo "  $EXPECTED_AGENT_DIR/settings.json"
fi

if command -v parallel-cli >/dev/null 2>&1; then
  echo "ok: parallel-cli is available"
else
  echo "warning: parallel-cli not found"
  echo "  Required only for HazAT/pi-parallel tools such as parallel_search."
  echo "  See .pi-config/README.md for manual install and authentication options."
fi

echo ""
echo "Configured Pi packages are tracked in:"
echo "  $EXPECTED_AGENT_DIR/settings.json"
echo "Pi resolves missing configured packages into ~/.pi/agent/git/ during normal startup when online."
echo "For package visibility, run the Pi package list command manually."
echo ""
echo "Optional local TypeScript/LSP dependencies for extension editing are not installed by setup."
echo "If needed, install local npm dependencies manually from:"
echo "  $EXPECTED_PI_DIR"
echo ""
echo "Validation complete. Restart pi or run /reload to pick up config/resource changes."
```

Do not add any installer command back into this script.

**`.pi-config/README.md`**: after replacing `setup.sh`, verify the `## Setup` section says the script validates and prints manual guidance only. Keep the no-installs sentence from Slice 1.

### Tests

No new test files for this shell-script slice.

### Verify

```bash
bash -n .pi-config/setup.sh
! rg -n "pi install|npm install|curl .*\| *bash|brew install" .pi-config/setup.sh
~/dotfiles/.pi-config/setup.sh
```

Expected: shell syntax passes; ripgrep finds no setup-time installer commands; running setup validates current layout and prints guidance without installing packages or external binaries.

______________________________________________________________________

## Slice 3: Subagent name deconfliction and model normalization

### Files

- `.pi-config/agent/agents/researcher.md` -> `.pi-config/agent/agents/web-researcher.md` (rename + frontmatter update)
- `.pi-config/agent/agents/reviewer.md` -> `.pi-config/agent/agents/rubric-reviewer.md` (rename + frontmatter update)
- `.pi-config/agent/agents/scout.md` -> `.pi-config/agent/agents/qrspi-scout.md` (rename + frontmatter update)
- `.pi-config/agent/agents/worker.md` -> `.pi-config/agent/agents/todo-worker.md` (rename + frontmatter update)
- `.pi-config/agent/settings.json` (modify)
- Active docs/skills under `.pi-config/` that intentionally mention the personal variants (modify only if the reference should point to a renamed local personal agent)

### Changes

Rename the files with `mv` so Git records each as a rename when possible:

```bash
mv .pi-config/agent/agents/researcher.md .pi-config/agent/agents/web-researcher.md
mv .pi-config/agent/agents/reviewer.md .pi-config/agent/agents/rubric-reviewer.md
mv .pi-config/agent/agents/scout.md .pi-config/agent/agents/qrspi-scout.md
mv .pi-config/agent/agents/worker.md .pi-config/agent/agents/todo-worker.md
```

**`.pi-config/agent/agents/web-researcher.md`**: keep the body from `researcher.md`; replace only the frontmatter with:

```yaml
---
name: web-researcher
description: Parallel.ai-backed web intelligence and code research
tools: parallel_search, parallel_research, parallel_extract, parallel_enrich, write, bash
model: openai-codex/gpt-5.5
output: research.md
---
```

**`.pi-config/agent/agents/rubric-reviewer.md`**: keep the body from `reviewer.md`; replace only the frontmatter with:

```yaml
---
name: rubric-reviewer
description: Read-only code review using the local review-rubric skill
tools: read, bash
model: openai-codex/gpt-5.5
thinking: medium
skills: review-rubric

output: review.md
---
```

**`.pi-config/agent/agents/qrspi-scout.md`**: keep the body from `scout.md`; replace only the frontmatter with:

```yaml
---
name: qrspi-scout
description: QRSPI-aware reconnaissance and context artifact writer
tools: read, grep, find, ls, bash, write
model: openai-codex/gpt-5.5
systemPromptMode: replace
inheritProjectContext: false
inheritSkills: false
---
```

**`.pi-config/agent/agents/todo-worker.md`**: keep the body from `worker.md`; replace only the frontmatter with:

```yaml
---
name: todo-worker
description: Todo/commit-oriented ad hoc implementation worker
tools: read, bash, write, edit, todo
model: openai-codex/gpt-5.5
thinking: high
skill: commit
---
```

**`.pi-config/agent/settings.json`**: preserve existing settings and add a minimal `subagents.agentOverrides` block for the package-provided builtin `worker`. Replace the file with this JSON:

```json
{
  "lastChangelogVersion": "0.70.6",
  "compaction": {
    "enabled": false
  },
  "defaultProvider": "openai-codex",
  "defaultModel": "gpt-5.5",
  "defaultThinkingLevel": "high",
  "hideThinkingBlock": false,
  "skills": [],
  "packages": [
    "git:github.com/nicobailon/pi-subagents",
    "git:github.com/nicobailon/pi-mcp-adapter",
    "git:github.com/HazAT/pi-smart-sessions",
    "git:github.com/HazAT/pi-parallel",
    "git:git@github.com:CoreyCole/pi-deterministic-docs.git",
    "git:github.com/algal/pi-context-inspect"
  ],
  "extensions": [
    "+extensions/answer.ts",
    "+extensions/execute-command.ts",
    "+extensions/tool-hooks/index.ts"
  ],
  "subagents": {
    "agentOverrides": {
      "worker": {
        "model": "openai-codex/gpt-5.5"
      }
    }
  }
}
```

**Active docs/skills references**: run this targeted search after renaming:

```bash
rg -n "\b(researcher|reviewer|scout|worker)\b" .pi-config \
  -g '!node_modules/**' \
  -g '!agent/git/**' \
  -g '!pi-subagents/**'
```

Only update references when they are clearly referring to the renamed local personal variants. Do not rewrite package builtin names in docs that intentionally describe `nicobailon/pi-subagents` builtins.

### Tests

No new test files for this subagent-config slice.

### Verify

```bash
find .pi-config/agent/agents -maxdepth 1 -type f -name '*.md' -print | sort

test -f .pi-config/agent/agents/web-researcher.md
test -f .pi-config/agent/agents/rubric-reviewer.md
test -f .pi-config/agent/agents/qrspi-scout.md
test -f .pi-config/agent/agents/todo-worker.md

test ! -e .pi-config/agent/agents/researcher.md
test ! -e .pi-config/agent/agents/reviewer.md
test ! -e .pi-config/agent/agents/scout.md
test ! -e .pi-config/agent/agents/worker.md

! rg -n "^name: (researcher|reviewer|scout|worker)$" .pi-config/agent/agents
! rg -n "gpt-5\.3|codex-spark|thinking: minimal" .pi-config/agent/agents .pi-config/agent/settings.json
python3 -m json.tool .pi-config/agent/settings.json >/dev/null
```

Expected: package builtin names are no longer overridden by local user-agent files; personal variants have explicit names; local agent model settings are GPT 5.5; settings JSON parses.

______________________________________________________________________

## Slice 4: Package config, optional dev dependencies, and Parallel tooling docs

### Files

- `.pi-config/README.md` (modify/confirm)
- `.pi-config/package.json` (keep unchanged unless verification reveals invalid JSON)
- `.pi-config/package-lock.json` (keep unchanged unless verification reveals invalid JSON)
- `.pi-config/agent/settings.json` (referenced by docs; no additional content expected beyond Slice 3)
- `.pi-config/agent/extensions/subagent/config.json` (referenced by docs; no content change expected)

### Changes

**`.pi-config/README.md`**: confirm the replacement from Slice 1 still includes all of these contracts after Slices 2-3:

- `agent/settings.json` is tracked source config and declares desired Pi packages/extension includes.
- `agent/git/` is generated package cache and remains ignored.
- Pi can resolve missing configured packages during normal resource loading when online.
- `setup.sh` does not preinstall packages or external tools.
- `package.json`/`package-lock.json` support optional local TypeScript/LSP work only.
- `parallel-cli` is external and needed only for `HazAT/pi-parallel` tools.
- `pi-subagents` parallel limits live in `agent/extensions/subagent/config.json`.

If any of these statements are missing, add the minimal sentence to the existing README section instead of creating a duplicate section.

**`.pi-config/package.json` / `.pi-config/package-lock.json`**: no content changes expected. Keep both files.

**`.pi-config/agent/settings.json`**: no content changes expected beyond the `subagents.agentOverrides.worker.model` block from Slice 3.

**`.pi-config/agent/extensions/subagent/config.json`**: no content changes expected; keep the 16/16 parallel config from Slice 1.

### Tests

No new test files for this documentation/config slice.

### Verify

```bash
python3 -m json.tool .pi-config/package.json >/dev/null
python3 -m json.tool .pi-config/package-lock.json >/dev/null
python3 -m json.tool .pi-config/agent/settings.json >/dev/null
python3 -m json.tool .pi-config/agent/extensions/subagent/config.json >/dev/null

rg -n "agent/settings.json" .pi-config/README.md .pi-config/AGENTS.md
rg -n "agent/git|node_modules|parallel-cli|agent/extensions/subagent/config.json" .pi-config/README.md
! rg -n "agent/settings.json.*runtime state|installs the configured Pi packages|ensures parallel-cli is installed" .pi-config/README.md .pi-config/AGENTS.md
```

Expected: all JSON files parse; docs distinguish tracked package declarations from ignored package caches; docs describe manual external dependency setup rather than setup-time installation.

______________________________________________________________________

## Slice 5: Final validation sweep

### Files

- All files changed by Slices 1-4.

### Changes

Run the final verification commands below and fix only failures directly related to this plan.

Do not broaden scope into unrelated local extensions (`branch.ts`, `cost.ts`, `previous-prompt.ts`, `review.ts`, `todos.ts`, `watchdog.ts`) unless one of the final checks proves they were accidentally changed.

If final validation requires staging for human review or a commit, stage only the intentional files from this plan:

```bash
git add \
  .gitignore \
  .pi-config/.gitignore \
  .pi-config/README.md \
  .pi-config/AGENTS.md \
  .pi-config/setup.sh \
  .pi-config/agent/settings.json \
  .pi-config/agent/extensions/subagent/config.json \
  .pi-config/agent/agents/web-researcher.md \
  .pi-config/agent/agents/rubric-reviewer.md \
  .pi-config/agent/agents/qrspi-scout.md \
  .pi-config/agent/agents/todo-worker.md \
  .pi-config/agent/agents/researcher.md \
  .pi-config/agent/agents/reviewer.md \
  .pi-config/agent/agents/scout.md \
  .pi-config/agent/agents/worker.md \
  .pi-config/pi-subagents
```

Do not stage ignored runtime/cache directories (`.pi-config/agent/git/`, `.pi-config/history/`, `.pi-config/context/`, `.pi-config/node_modules/`, sessions, auth, run history).

### Tests

No new test files for this final sweep.

### Verify

```bash
# Repository boundary and syntax validation
git status --short -- .pi-config .gitignore
python3 -m json.tool .pi-config/agent/settings.json >/dev/null
python3 -m json.tool .pi-config/agent/mcp.json >/dev/null
python3 -m json.tool .pi-config/agent/extensions/subagent/config.json >/dev/null
python3 -m json.tool .pi-config/package.json >/dev/null
bash -n .pi-config/setup.sh

# Documentation and behavior sanity checks
! rg -n "agent/settings.json.*runtime state|installs the configured Pi packages|ensures parallel-cli is installed" .pi-config/README.md .pi-config/AGENTS.md
! rg -n "^name: (researcher|reviewer|scout|worker)$" .pi-config/agent/agents
! rg -n "gpt-5\.3|codex-spark|thinking: minimal" .pi-config/agent/agents .pi-config/agent/settings.json
! rg -n "pi install|npm install|curl .*\| *bash|brew install" .pi-config/setup.sh

# Active setup check
~/dotfiles/.pi-config/setup.sh

# Ignored-state check
git check-ignore -v \
  .pi-config/node_modules \
  .pi-config/agent/auth.json \
  .pi-config/agent/sessions \
  .pi-config/agent/run-history.jsonl \
  .pi-config/agent/git \
  .pi-config/history \
  .pi-config/context

! git check-ignore -q .pi-config/agent/settings.json
! git check-ignore -q .pi-config/agent/extensions/subagent/config.json
```

Expected: all syntax checks pass; stale documentation phrases are gone; any `~/.pi/extensions/` mention is only a warning that it is not the discovery path; no local builtin-name collisions remain; setup runs without performing installs; git status shows only intentional docs/config/script changes, renamed agent files, newly tracked/trackable `agent/extensions/subagent/config.json`, and deleted stale `.pi-config/pi-subagents/**` files.
