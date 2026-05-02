---
date: 2026-05-02T00:12:07-07:00
researcher: CoreyCole
last_updated_by: CoreyCole
git_commit: b55fe11e0d049623c5940f8b015ba5d36c3a99f9
branch: main
repository: dotfiles
stage: design
artifact: adr
ticket: pi-config cleanup and organization
plan_dir: thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup
related_artifact: thoughts/CoreyCole/plans/2026-05-01_23-07-32_pi-config-cleanup/design.md
---

# ADR: Validation-Only Setup

## Status

Accepted

## Context

Current `.pi-config/setup.sh` validates the symlink and required files, then installs configured Pi packages and installs `parallel-cli` via `curl | bash` when missing.
The desired setup experience is portable and unsurprising: validate the layout, report missing dependencies, and print manual commands without mutating the machine.
Pi already resolves missing configured git/npm packages during normal resource loading unless offline mode is enabled.

## Decision Drivers

- Setup should be safe to run repeatedly on fresh or existing machines.
- Installing external binaries through `curl | bash` is too much side effect for a dotfiles validation script.
- Pi package caches are generated state, not tracked source.
- Users still need clear guidance when `pi`, configured packages, or `parallel-cli` are missing.

## Decision

Rewrite `setup.sh` as a validation/reporting script only.
It should keep symlink and required resource checks, check whether key commands exist, and print manual remediation steps.
It must not run `pi install`, `npm install`, `brew install`, or `curl | bash`.
It may suggest `pi list` for visibility and manual package commands when useful, but it should not create package caches itself.
It should explain that `parallel-cli` is required only for `HazAT/pi-parallel` tools and that authentication is done with `parallel-cli login` or `PARALLEL_API_KEY`.

## Alternatives Considered

### Alternative A: Keep installing configured Pi packages in setup

**Status:** Rejected

This duplicates Pi's package-manager behavior and makes setup mutate ignored cache state.
It also creates the impression that package caches are part of dotfiles setup rather than generated runtime state.

### Alternative B: Keep auto-installing `parallel-cli`

**Status:** Rejected

`parallel-cli` is an external dependency with its own installer and authentication flow.
Setup should report the missing dependency and show installation options, not execute a remote installer automatically.

### Alternative C: Remove setup entirely

**Status:** Rejected

A validation entrypoint is still useful on fresh machines because it checks the symlink, required paths, tracked config files, and optional tool dependencies in one place.

## Consequences

- Fresh-machine setup becomes safer and more transparent.
- Users may need one extra manual command for missing external dependencies.
- README and AGENTS docs must stop promising install side effects.
- Verification should prove setup exits cleanly for the current machine without performing installations.
