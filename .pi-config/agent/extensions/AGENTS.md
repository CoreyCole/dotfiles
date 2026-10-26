# Pi extensions

This file is for two readers. Agents that edit these extensions use the inventory and the check commands. Grok Bots use the Herdr section to run coding and research on this box.

Do not nest Herdr in tmux. Do not start tmux for this work.

## What lives here

Pi loads extension factories from this directory through `~/.pi/agent/extensions/`. `~/.pi` points at `~/dotfiles/.pi-config`.

- `answer.ts`: `/answer` extracts questions from the last assistant message and collects answers.
- `assistant-renderer.ts`: renders assistant messages and thinking quotes.
- `clipboard-osc52-tmux.ts`: copies through OSC 52 inside Herdr or tmux.
- `cost.ts`: `/cost` sums recent API cost from session files.
- `custom-footer.ts`: draws the status footer (model, fast label, request stats).
- `edit-delta.ts`: shows edit diffs with delta.
- `fast-model.ts`: virtual model `xai/fast` follows the Pi default model.
- `herdr-agent-state.ts`: Herdr owns this file. Do not edit it. `herdr integration install pi` regenerates it.
- `lead-subscribe.ts`: `/lead-subscribe` records settle events for a lead session.
- `lib/default-model.ts`: shared default-model helper. Not an extension entry.
- `pi-attachable-subagents/`: child sessions you can attach, detach, steer, and stop. See `README.local.md`.
- `pi-fast/`: `/fast` and `--fast` set priority `service_tier` on supported models. See `README.md`. `pi-fast.json` lists those models.
- `pi-grok-cli/`: adds the `grok-cli` provider and team-account login. See `README.md`. It does not replace built-in `xai`.
- `previous-prompt.ts`: shows the previous user prompt under the editor.
- `request-stats.ts`: writes request timing to `~/.local/state/pi/request-stats.csv`.
- `settled-webhook.ts`: POSTs when a gated Pi session settles or waits on a question. Details are below.
- `smart-sessions.ts`: names a session from a skill prompt or a QRSPI result.
- `tests/`: `node:test` files for these extensions.
- `tool-border.ts`: draws borders around tool calls and messages.
- `tool-display-style.ts`: shared ANSI style helpers. It must export a factory because Pi loads it.
- `tool-hooks/`: runs tool hooks from `~/.pi/config/tool-hooks.json` and project `.pi/settings.json`.
- `write-full-render.ts`: renders `write` tool content with `bat` or markdown.

## Work on the extensions

Node 24 is required. System Node is 20 and is too old. On this box, `~/.local/bin/pi` runs Pi with `~/.local/opt/node24`.

Put Node 24 first on `PATH` before checks:

```bash
export PATH="$HOME/.local/opt/node24/bin:$PATH"
cd ~/dotfiles/.pi-config
node --test --experimental-strip-types agent/extensions/tests/*.test.ts
pnpm exec tsc --noEmit -p tsconfig.json
```

The test glob covers `agent/extensions/tests/*.test.ts` only. `pi-attachable-subagents/*.test.ts` is outside that glob. Run a single file the same way when you change one extension. Node prints a module-type warning for these files. That warning is not a failure. Do not add `"type": "module"` to `package.json` unless that is the task.

`@earendil-works/pi-ai`, `@earendil-works/pi-coding-agent`, and `@earendil-works/pi-tui` are pinned to `0.82.1` in `package.json`. Install or update those deps with `pnpm` from `.pi-config/`. Do not edit files under `node_modules/`.

`tsc` typechecks `agent/extensions/**/*.ts`. It currently fails in `fast-model.ts`, `lib/default-model.ts`, and `tests/fast-model.test.ts`. Those errors are older than the settled webhook. Do not edit those files only to make `tsc` pass. Fix the files your change touches, then run the matching test file.

## Settled webhook

`settled-webhook.ts` tells one Grok Bot when a Pi session that the bot started goes idle, or when that session waits on a question. A normal `pi` launch does not POST. The extension does not open a profile file and does not read `settings.json`.

### Opt-in gate

At startup, all of these must be true. Otherwise the extension registers no POST handler:

- `PI_SETTLED_WEBHOOK` is `1`.
- `PI_SETTLED_WEBHOOK_URL` is an `https:` URL.
- `PI_SETTLED_WEBHOOK_KEY` is non-empty.
- `PI_SUBAGENT_ID` is unset.

A failed gate schedules nothing and makes no network call. `/settled-webhook` then reports `Settled webhook is unavailable.` The notice has no URL and no key.

Inside a gated process, `/settled-webhook off` stops later POSTs. `/settled-webhook on` resumes them. With no argument, the command reports on or off. The command cannot create the gate. A child with `PI_SUBAGENT_ID` never POSTs, even when it inherited the variables.

`pi-grokbot` sets the gate. Plain `pi` does not, so a normal session never notifies. The webhook does not fire for a session the bot did not launch.

### Payload

The POST body is JSON. It has no URL and no key. The `Authorization` header is `Bearer` plus the key, unless `PI_SETTLED_WEBHOOK_AUTH` sets the full header value.

Always present:

- `source`: `pi-settled-webhook`
- `eventId`
- `timestamp`
- `status`: `settled`, `question`, or `error`
- `aborted`
- `cwd`
- `sessionId`
- `sessionFile`
- `tmux` (from `TMUX`, or null)
- `tmuxPane` (from `TMUX_PANE`, or null)
- `excerpt` (assistant text only, max 800 characters)

Present only when `HERDR_ENV` is `1`:

- `herdrPaneId` from `HERDR_PANE_ID`
- `herdrTabId` from `HERDR_TAB_ID`
- `herdrWorkspaceId` from `HERDR_WORKSPACE_ID`

A blank id is null. When `HERDR_ENV` is not `1`, those three keys are absent, even if the id variables are set.

`piGrokbotProfile` is present only when `PI_GROKBOT_PROFILE` is set. `promptKind` is present only for a question prompt: `input`, `editor`, or `custom`.

`status` is `question` when the last non-empty excerpt line ends with `?`, or when Pi opens an `input`, `editor`, or `custom` prompt. Escape is `settled` with `aborted` true. `status` is `error` when the assistant stop reason is `error` or the assistant message has an error.

The settle notice waits 500 ms. A later notice in that window replaces the earlier one. The POST times out after 3 seconds. A network error does not crash Pi. The settle handler does not wait on the POST. On shutdown, Pi flushes a pending POST and waits at most 4 seconds.

Set `PI_SETTLED_WEBHOOK_DEBUG=1` to write one stderr line: `settled-webhook: POST status=<code>` or `settled-webhook: POST failed`. The line has no URL, no key, and no header.

## For Grok Bots: use pi on this box

Do coding and research with Pi in Herdr on this box. Do not use Cursor cloud agents.

House rules:

- Make local commits only. Never push, and never open a PR, on `CoreyCole/dotfiles`.
- Never touch another bot's Herdr workspace.
- Never print a webhook URL, a key, an env file, or any other secret.
- Do not nest Herdr in tmux.

Herdr on this box is `0.9.5`. Workspace, tab, pane, and agent list commands print JSON. `herdr status` prints text. `herdr agent explain` prints text unless you add `--json`. Read ids from the JSON. Do not invent them.

### Layout

The Herdr server is shared. Each bot has one workspace. The workspace label is the bot slug, for example `pi-extensions` or `sentry-fixer`. Each task has one tab. The tab label is the task.

When `herdr status` says the server is down, start it. A box update can stop it.

```bash
herdr-start-server
herdr status
```

`herdr-start-server` is safe to run again. It does not use tmux.

### One-time webhook setup

Do this once per bot.

1. Create your own Grok Bot routine with a webhook trigger.
2. Ask the user for the URL and the key from that routine panel. Each routine has its own pair. Keys are not shared. You cannot read the panel yourself.
3. Write `~/.config/grok-bot/pi-webhooks/<slug>.env` and run `chmod 600` on it. Put both variables in the file:

```bash
PI_SETTLED_WEBHOOK_URL=https://...
PI_SETTLED_WEBHOOK_KEY=...
```

The key must be in the file. A Herdr pane inherits the Herdr server environment, not your shell. A key that exists only in your shell is invisible to the pane.

4. Check the profile name. This command prints names only:

```bash
pi-grokbot --list
```

The slug must match `^[a-z0-9][a-z0-9-]*$`. Do not print the file.

### Launcher

`~/.local/bin/pi-grokbot` is outside this repo. It sources `~/.config/grok-bot/pi-webhooks/<slug>.env`, sets `PI_SETTLED_WEBHOOK=1` and `PI_GROKBOT_PROFILE`, then execs `pi`.

```bash
pi-grokbot --bot <slug> [pi args...]
PI_GROKBOT_PROFILE=<slug> pi-grokbot [pi args...]
```

The default profile is `pi-extensions`. Run the script. Do not source it. Plain `pi` never notifies.

### Start a task

Write the task to `/workspace/pi-tasks/<topic>.md` first. Then create the tab and start Pi in that pane.

List workspaces. Create one only when your slug is absent.

```bash
herdr workspace list
herdr workspace create --label <slug> --cwd <repo> --no-focus
```

In the list, read `.result.workspaces[].workspace_id` for the entry whose `label` is your slug. On create, read `.result.workspace.workspace_id`, `.result.tab.tab_id`, and `.result.root_pane.pane_id`. Workspace create already opens one tab. Use that tab for the first task. Create a new tab for each later task:

```bash
herdr tab create --workspace <ws> --cwd <repo> --label <task> --no-focus
```

Read the pane id from `.result.root_pane.pane_id`. Read the tab id from `.result.tab.tab_id`. Run Pi there:

```bash
herdr pane run <pane> "pi-grokbot --bot <slug> 'Read /workspace/pi-tasks/<topic>.md and do it.'"
```

`pane run` sends the command and Enter. Read the pane:

```bash
herdr pane read <pane> --source recent-unwrapped --lines 120
```

Send a follow-up as text, then Enter:

```bash
herdr pane send-text <pane> 'text'
herdr pane send-keys <pane> enter
```

List panes in your workspace. `agent_status` is `idle`, `working`, `blocked`, `done`, or `unknown`:

```bash
herdr pane list --workspace <ws>
herdr agent list
herdr agent get <pane-or-name>
herdr agent explain <pane-or-name>
```

Close the tab when the task is finished:

```bash
herdr tab close <tab>
```

A `Trust folder?` prompt in an untrusted cwd reports as `idle`. That status does not mean Pi is ready. Read the visible screen before you send more input:

```bash
herdr pane read <pane> --source visible
```

Stay in your own workspace. Do not close, rename, or type into another bot's workspace, tab, or pane.

### Research only

For a read-only session, write `read-only` in the task file. Point the task at `/skill:q-research` or `/skill:learn-codebase`. Ask for findings in a file, with `file:line` citations. Do not ask that session to edit code or commit.

### When the webhook fires

The POST is the settle notice for a session you launched. Read `status`, `cwd`, `excerpt`, `herdrWorkspaceId`, `herdrTabId`, and `herdrPaneId`. Then read that pane. Do not guess the pane from the focused tab.

`status` `question` means Pi is waiting. Read the pane. Answer with `send-text` and `send-keys` when the task already decides the answer. `blocked` in `herdr pane list` can mean the same wait. `status` `error` means the assistant stopped on an error. Read the pane before you retry.

Message the user only for a review or a decision. When the task is finished, close that tab. Do not close another bot's tab.

## Watch from your machine

Herdr remote attach uses plain OpenSSH:

```bash
herdr --remote <ssh-target>
herdr machine add <ssh-target> --label box
```

This box has no SSH server. `sshd` is not installed, and Tailscale SSH is off. Enable SSH first, for example Tailscale SSH. Until that is true, remote attach does not work. Do not treat these commands as working on this box yet.
