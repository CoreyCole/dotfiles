---
date: 2026-05-02T00:17:05-07:00
researcher: CoreyCole
last_updated_by: CoreyCole
git_commit: b55fe11e0d049623c5940f8b015ba5d36c3a99f9
branch: main
repository: dotfiles
stage: outline
ticket: pi-config cleanup and organization
plan_dir: thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup
---

# Outline: Pi Config Cleanup and Organization

## Overview

Clean up `.pi-config` by keeping the current live shape (`~/.pi -> ~/dotfiles/.pi-config`, with Pi resources under `.pi-config/agent/`) and making the source/config/runtime boundary explicit. The implementation is a documentation, validation-script, git-boundary, and subagent-name cleanup pass: no resource layout migration, no setup-time installs, and no accidental local overrides of `nicobailon/pi-subagents` builtin agent names.

## Type Definitions

This repository does not need new application types. The structural contracts are shell-script checks, JSON config shapes, and subagent markdown frontmatter.

```bash
# .pi-config/setup.sh conceptual surface
main() -> exit_code
resolve_pi_symlink() -> absolute_path
require_directory "agent/extensions" -> ok_or_error
require_file "agent/settings.json" -> ok_or_error
check_command "pi" required|optional -> ok_or_warning
check_command "parallel-cli" optional -> ok_or_warning
print_manual_remediation() -> stdout
```

```json
{
  "defaultProvider": "openai-codex",
  "defaultModel": "gpt-5.5",
  "defaultThinkingLevel": "high",
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

```yaml
# Renamed local-agent frontmatter pattern
name: web-researcher | rubric-reviewer | qrspi-scout | todo-worker
model: openai-codex/gpt-5.5
thinking: high | medium | off
```

```text
Tracked source config:
  agent/settings.json
  agent/mcp.json
  agent/extensions/**
  agent/extensions/subagent/config.json
  agent/skills/**
  agent/agents/**
  agent/scripts/**
  config/tool-hooks.json
  package.json
  package-lock.json

Ignored runtime/cache/local state:
  agent/auth.json
  agent/sessions/
  agent/run-history.jsonl
  agent/git/
  history/
  context/
  node_modules/
```

## Database Schema

Not applicable. This cleanup does not introduce persistent application data or schema changes.

## Package / File Structure

- `.pi-config/README.md` (modify) — document tracked source config, ignored runtime/cache state, validation-only setup, package cache semantics, and optional local extension development dependencies.
- `.pi-config/AGENTS.md` (modify) — correct plan-critical Pi config notes, especially `agent/settings.json` classification and setup behavior.
- `.pi-config/setup.sh` (modify) — validation/reporting only; no package install and no external binary installer.
- `.gitignore` (modify) — remove stale `.pi-config/pi-subagents/node_modules/` ignore entry once the stale tracked cache is committed as deleted.
- `.pi-config/.gitignore` (modify) — keep local runtime/cache ignores explicit; add `context/` and `node_modules/` if desired for locality.
- `.pi-config/agent/settings.json` (modify) — preserve existing package and extension declarations while adding minimal `subagents.agentOverrides` for builtin agent tweaks, especially builtin `worker` GPT 5.5 normalization.
- `.pi-config/agent/extensions/subagent/config.json` (track) — keep the intentional `pi-subagents` parallel-limit config.
- `.pi-config/agent/agents/researcher.md` -> `.pi-config/agent/agents/web-researcher.md` (rename + frontmatter update).
- `.pi-config/agent/agents/reviewer.md` -> `.pi-config/agent/agents/rubric-reviewer.md` (rename + frontmatter update).
- `.pi-config/agent/agents/scout.md` -> `.pi-config/agent/agents/qrspi-scout.md` (rename + frontmatter update).
- `.pi-config/agent/agents/worker.md` -> `.pi-config/agent/agents/todo-worker.md` (rename + frontmatter update).
- `.pi-config/pi-subagents/**` (delete from git index) — stale tracked cache copy; active package code lives in ignored `.pi-config/agent/git/github.com/nicobailon/pi-subagents/`.
- `.pi-config/package.json` / `.pi-config/package-lock.json` (keep) — document as optional local TypeScript/LSP support, not normal runtime bootstrap.

## API Surface

No external API surface changes. The user-facing operational contract becomes:

```text
ln -sfn ~/dotfiles/.pi-config ~/.pi
~/dotfiles/.pi-config/setup.sh

# Optional visibility/remediation commands printed by setup when useful:
pi list
parallel-cli login
export PARALLEL_API_KEY=...
cd ~/.pi && npm install   # only for local TypeScript extension development/LSP support
```

## Slices

### Slice 1: Source/Runtime Boundary Documentation and Git Hygiene

**Files:**

- `.pi-config/README.md` (modify)
- `.pi-config/AGENTS.md` (modify)
- `.gitignore` (modify)
- `.pi-config/.gitignore` (modify)
- `.pi-config/agent/extensions/subagent/config.json` (track)
- `.pi-config/pi-subagents/**` (delete from git index)

```text
README sections:
  Active layout
  Tracked source config
  Ignored runtime/cache/local state
  Package declarations vs package caches
  Optional local extension development dependencies

AGENTS.md project note:
  agent/settings.json belongs to tracked source config, not runtime state.
```

**Test checkpoint:**

```bash
git status --short -- .pi-config .gitignore
git ls-files -- .pi-config/agent/settings.json .pi-config/agent/extensions/subagent/config.json
git status --short -- .pi-config/pi-subagents
test -z "$(git ls-files -- .pi-config/pi-subagents)"

git check-ignore -v \
  .pi-config/node_modules \
  .pi-config/agent/auth.json \
  .pi-config/agent/sessions \
  .pi-config/agent/run-history.jsonl \
  .pi-config/agent/git \
  .pi-config/history \
  .pi-config/context
```

Expected assertions: `agent/settings.json` and `agent/extensions/subagent/config.json` are tracked source config; stale `.pi-config/pi-subagents/**` files are removed from the tracked index, with any pending deletions visible in status until committed; runtime/cache paths remain ignored.

### Slice 2: Validation-Only Setup Script

**Files:**

- `.pi-config/setup.sh` (modify)
- `.pi-config/README.md` (modify)

```bash
# Remove side-effectful operations from setup.sh:
pi install ...                         # delete
curl -fsSL https://parallel.ai/...     # delete
npm install                            # do not add

# Keep/report checks:
require ~/.pi symlink target == this directory
require ~/.pi/agent/{extensions,skills,agents}
require ~/.pi/agent/{settings.json,mcp.json}
warn if pi is missing, with install guidance
warn if parallel-cli is missing, with manual install/auth guidance
suggest pi list for configured package visibility
```

**Test checkpoint:**

```bash
bash -n .pi-config/setup.sh
! rg -n "pi install|npm install|curl .*\| *bash|brew install" .pi-config/setup.sh
~/dotfiles/.pi-config/setup.sh
```

Expected assertions: shell syntax passes; grep finds no setup-time installer commands; running setup validates current layout and prints guidance without installing packages or external binaries.

### Slice 3: Subagent Name Deconfliction and Model Normalization

**Files:**

- `.pi-config/agent/agents/researcher.md` -> `.pi-config/agent/agents/web-researcher.md`
- `.pi-config/agent/agents/reviewer.md` -> `.pi-config/agent/agents/rubric-reviewer.md`
- `.pi-config/agent/agents/scout.md` -> `.pi-config/agent/agents/qrspi-scout.md`
- `.pi-config/agent/agents/worker.md` -> `.pi-config/agent/agents/todo-worker.md`
- `.pi-config/agent/settings.json` (modify)
- Any docs/skills that intentionally reference the local personal variants (modify only when references are clearly local-variant references)

```yaml
# web-researcher.md
name: web-researcher
description: Parallel.ai-backed web intelligence and code research
model: openai-codex/gpt-5.5

# rubric-reviewer.md
name: rubric-reviewer
description: Read-only code review using the local review-rubric skill
model: openai-codex/gpt-5.5
thinking: medium
skills: review-rubric

# qrspi-scout.md
name: qrspi-scout
description: QRSPI-aware reconnaissance and context artifact writer
model: openai-codex/gpt-5.5

# todo-worker.md
name: todo-worker
description: Todo/commit-oriented ad hoc implementation worker
model: openai-codex/gpt-5.5
thinking: high
```

```json
{
  "subagents": {
    "agentOverrides": {
      "worker": {
        "model": "openai-codex/gpt-5.5"
      }
    }
  }
}
```

**Test checkpoint:**

```bash
find .pi-config/agent/agents -maxdepth 1 -type f -name '*.md' -print | sort
! rg -n "^name: (researcher|reviewer|scout|worker)$" .pi-config/agent/agents
! rg -n "gpt-5\.3|codex-spark|thinking: minimal" .pi-config/agent/agents .pi-config/agent/settings.json
python3 -m json.tool .pi-config/agent/settings.json >/dev/null
```

Expected assertions: no local agent frontmatter collides with package builtin names; personal variants use explicit names; local agent models no longer use GPT 5.3 or spark variants; settings JSON parses.

### Slice 4: Package Config, Optional Dev Dependencies, and Parallel Tooling Docs

**Files:**

- `.pi-config/README.md` (modify)
- `.pi-config/package.json` (keep, possibly no content change)
- `.pi-config/package-lock.json` (keep, no content change expected)
- `.pi-config/agent/settings.json` (referenced by docs)
- `.pi-config/agent/extensions/subagent/config.json` (referenced by docs)

```text
Documentation contracts:
  agent/settings.json declares desired Pi packages and extension includes.
  agent/git/ is generated package cache and should stay ignored.
  Pi can resolve missing configured packages during normal resource loading.
  setup.sh does not preinstall packages.
  package.json/package-lock.json support local extension TypeScript/LSP work.
  parallel-cli is external and required only for HazAT/pi-parallel tools.
  pi-subagents parallel limits live in agent/extensions/subagent/config.json.
```

**Test checkpoint:**

```bash
python3 -m json.tool .pi-config/package.json >/dev/null
python3 -m json.tool .pi-config/package-lock.json >/dev/null
python3 -m json.tool .pi-config/agent/settings.json >/dev/null
python3 -m json.tool .pi-config/agent/extensions/subagent/config.json >/dev/null
rg -n "agent/settings.json" .pi-config/README.md .pi-config/AGENTS.md
rg -n "pi install|curl -fsSL|node_modules|agent/git|parallel-cli|agent/extensions/subagent/config.json" .pi-config/README.md
```

Expected assertions: all JSON files parse; docs distinguish package declarations from package caches; docs describe manual external dependency setup rather than setup-time installation.

### Slice 5: Final Validation Sweep

**Files:**

- All files changed by slices 1-4.

```bash
# Repository boundary and syntax validation
git status --short -- .pi-config .gitignore
python3 -m json.tool .pi-config/agent/settings.json >/dev/null
python3 -m json.tool .pi-config/agent/mcp.json >/dev/null
python3 -m json.tool .pi-config/agent/extensions/subagent/config.json >/dev/null
python3 -m json.tool .pi-config/package.json >/dev/null
bash -n .pi-config/setup.sh

# Active behavior sanity checks
! rg -n "agent/settings.json.*runtime state|installs the configured Pi packages|ensures parallel-cli is installed" .pi-config/README.md .pi-config/AGENTS.md
! rg -n "^name: (researcher|reviewer|scout|worker)$" .pi-config/agent/agents
! rg -n "gpt-5\.3|codex-spark|thinking: minimal" .pi-config/agent/agents .pi-config/agent/settings.json
~/dotfiles/.pi-config/setup.sh
```

**Test checkpoint:** all syntax checks pass; stale documentation phrases are gone; any `~/.pi/extensions/` mention is only a warning that it is not the discovery path; no local builtin-name collisions remain; setup runs without performing installs; git status shows only intentional docs/config/script changes, renamed agent files, tracked `agent/extensions/subagent/config.json`, and deleted stale `.pi-config/pi-subagents/**` files.

## Out of Scope

- Moving tracked resources out of `.pi-config/agent/`.
- Introducing extra symlinks such as `~/.pi/extensions` or mirrored resource directories.
- Tracking generated package caches under `.pi-config/agent/git/`.
- Installing Pi packages, npm dependencies, Homebrew packages, or `parallel-cli` from setup.
- Auditing or deleting unrelated auto-discovered local extensions such as `branch.ts`, `cost.ts`, `previous-prompt.ts`, `review.ts`, `todos.ts`, and `watchdog.ts` unless a later review explicitly scopes that work.
- Changing QRSPI skill names or removing retained `q-*` skills.
