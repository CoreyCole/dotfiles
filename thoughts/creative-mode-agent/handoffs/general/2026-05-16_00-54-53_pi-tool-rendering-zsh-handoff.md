---
date: 2026-05-16T00:54:53-07:00
researcher: creative-mode-agent
git_commit: 734df714e94af37746ad9002e818da11277a6ff6
branch: main
repository: dotfiles
topic: Pi Tool Rendering and Zsh Bash Strategy
tags: [implementation, pi, extensions, tool-hooks, deterministic-docs, zsh]
status: complete
last_updated: 2026-05-16
last_updated_by: creative-mode-agent
type: implementation_strategy
---

# Handoff: Pi tool rendering and zsh bash setup

## Task(s)

- **QRSPI smart session naming** — completed and already committed/pushed in `734df71 Improve QRSPI session naming`; changed QRSPI session names from `[qrspi:prev] → next` to `[qrspi:next] <- prev` in `.pi-config/agent/extensions/smart-sessions.ts`.
- **Retroactive QRSPI session renaming** — completed in runtime session JSONL files for `~/.pi/agent/sessions/--home-ruby-cn-chestnut-flake-cn-agents--`; appended `session_info` entries for 8 sessions.
- **Pi bash uses zsh aliases** — implemented locally in dotfiles but not committed. Added a wrapper at `.pi-config/agent/bin/pi-zsh` and configured `.pi-config/agent/settings.json` with `shellPath` + `shellCommandPrefix` to load aliases from `~/.zshrc` and `~/dotfiles/.zshrc`. Verified `j --version` resolves to `just 1.50.0` through the custom bash tool.
- **Compact visual tool output** — implemented locally but not committed. `.pi-config/agent/extensions/tool-hooks/index.ts` now owns compact rendering for `bash` and `read`: collapsed bash shows command plus first 2 visual output lines; collapsed read shows first 2 visual lines. Expanded views delegate to built-in renderers.
- **Deterministic-docs conflict cleanup** — partially implemented in the installed package copy, not committed upstream. The goal is for deterministic-docs not to override/register `read`; instead it should use `tool_result` middleware to inject deterministic docs into normal read results, while `tool-hooks` owns read visual rendering.

## Critical References

- `.pi-config/agent/extensions/tool-hooks/index.ts` — local compact `bash`/`read` renderer and zsh-aware bash replacement.
- `.pi-config/agent/settings.json` + `.pi-config/agent/bin/pi-zsh` — zsh shell configuration for Pi bash tool.
- `~/.pi/agent/git/github.com/CoreyCole/pi-deterministic-docs/extensions/deterministic-docs/index.ts` — installed package copy currently patched to stop registering `read` and instead use `tool_result` middleware.

## Recent changes

- `.pi-config/agent/settings.json` — added `shellPath: /home/ruby/dotfiles/.pi-config/agent/bin/pi-zsh` and `shellCommandPrefix` that evals aliases from `~/.zshrc` and `~/dotfiles/.zshrc`.
- `.pi-config/agent/bin/pi-zsh` — new executable wrapper: if invoked as `-c <command>`, writes command to a temp script and execs `/usr/bin/zsh <script>`. This lets zsh aliases expand correctly because aliases do not expand in `zsh -c` command strings.
- `.pi-config/agent/extensions/tool-hooks/index.ts` — changed bash registration to pass `shellPath` and `commandPrefix` from settings into `createBashToolDefinition`; added compact renderers using `wrapTextWithAnsi`; added `read` override for visual preview only; expanded render paths reset `lastComponent` to avoid empty expanded output after compact component reuse.
- `.pi-config/agent/extensions/tool-hooks/index.ts` — read renderer now understands deterministic-docs metadata: preserves `loaded: /path/AGENTS.md` summary, strips injected auto-doc context from visible preview/expanded rendering, and shows target file content only.
- `~/.pi/agent/git/github.com/CoreyCole/pi-deterministic-docs/extensions/deterministic-docs/index.ts` — installed package copy rewritten so deterministic-docs no longer registers the `read` tool. It listens to `tool_result` for `read`, loads ancestor docs with a cached built-in read tool, patches `content`/`details`, and records loaded docs with `pi.appendEntry`.

## Learnings

- Pi built-in bash output truncation is not configurable via settings. Core constants are `DEFAULT_MAX_LINES = 2000`, `DEFAULT_MAX_BYTES = 50KB`; collapsed TUI preview is separately controlled by renderer behavior.
- Pi's `createBashToolDefinition` can accept `shellPath`, `commandPrefix`, and `spawnHook`. Our `tool-hooks` extension already replaces/registers bash, so this is the correct place to preserve tool hooks, env-file injection, zsh aliases, and compact bash rendering together.
- `zsh -c 'alias j=just\nj --version'` does not expand aliases the way we need; writing the command into a temp script and running `/usr/bin/zsh script` does.
- Built-in read has special compact call rendering for resource files like `AGENTS.md` (`read resource AGENTS.md:1-30 (to expand)`) and returns an empty result string in compact mode for those resource reads. Reusing a compact `ReadPreviewComponent` as `lastComponent` in expanded mode caused “expand is empty”; reset `lastComponent: undefined` when delegating expanded rendering to built-ins.
- Deterministic-docs originally owned `read` to inject context and render `loaded:` summaries. That conflicts with any other read replacement. Cleaner boundary: deterministic-docs should be middleware (`tool_result`), and the local tool rendering extension should own visual read behavior.
- Deterministic-docs state remembers loaded docs per session/hash. After the first read of `~/cn/chestnut-flake/monorepo/justfile`, subsequent reads in the same session no longer show `loaded:` because the docs are already remembered.

## Artifacts

- `.pi-config/agent/extensions/smart-sessions.ts` — committed/pushed QRSPI naming change in `734df71`.
- `.pi-config/agent/extensions/tool-hooks/index.ts` — uncommitted local compact render/zsh integration changes.
- `.pi-config/agent/settings.json` — uncommitted local shell settings.
- `.pi-config/agent/bin/pi-zsh` — uncommitted new wrapper file.
- `~/.pi/agent/git/github.com/CoreyCole/pi-deterministic-docs/extensions/deterministic-docs/index.ts` — uncommitted installed-package patch; must be ported to the actual `CoreyCole/pi-deterministic-docs` repo/package source before package update.
- `thoughts/creative-mode-agent/handoffs/general/2026-05-16_00-54-53_pi-tool-rendering-zsh-handoff.md` — this handoff.

## Action Items & Next Steps

1. **Reload and visually verify** in Pi TUI:
   - `/reload`
   - Bash: run `printf 'one\ntwo\nthree\nfour\n' && j --version`; collapsed view should show command, then `one`, `two`, `3 more lines...`.
   - Read: in a fresh session or after deterministic-docs state reset, read `/home/ruby/cn/chestnut-flake/monorepo/justfile`; collapsed view should show `loaded: /home/ruby/cn/chestnut-flake/AGENTS.md` and/or monorepo AGENTS paths, then first 2 visual lines of the target justfile, not the injected AGENTS body.
   - Expanded read should show `loaded:` summary plus target content; it should not be empty.
1. **Port deterministic-docs middleware change upstream**:
   - Clone/open the actual `CoreyCole/pi-deterministic-docs` source repo, apply the installed-package diff from `~/.pi/agent/git/...`, test, commit, push.
   - The installed copy is runtime state and may be overwritten by `pi update`.
1. **Decide commit scope in dotfiles**:
   - Commit `.pi-config/agent/extensions/tool-hooks/index.ts`, `.pi-config/agent/settings.json`, and `.pi-config/agent/bin/pi-zsh` together if visual verification passes.
   - Do not include unrelated current working tree changes unless intentionally part of another task: `.agents/skills/q-review-plan/SKILL.md`, `.pi-config/package-lock.json`, deleted `.pi/rules/cctl-go-collections-set.mdc`, `.zcompdump-*` files.
1. **Consider simplification later**:
   - The compact read/bash render helper code in `tool-hooks/index.ts` is sizeable. After behavior stabilizes, consider extracting renderer helpers to a sibling file under `.pi-config/agent/extensions/tool-hooks/`.

## Other Notes

- Current dotfiles branch is `main`, commit before local changes is `734df714e94af37746ad9002e818da11277a6ff6`.
- Current repo has unrelated local changes that predate/are separate from this task. Preserve them unless the user explicitly wants cleanup.
- The final user concern before this handoff: deterministic-docs used to show `loaded: .../AGENTS.md`; after moving rendering out, that disappeared. The latest `tool-hooks` patch restores the `loaded:` summary from deterministic-docs details while keeping deterministic-docs out of read rendering.
