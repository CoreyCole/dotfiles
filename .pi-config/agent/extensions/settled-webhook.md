# Settled webhook

This extension tells Grok Bot when a Pi session that Grok Bot started goes idle, or when that session waits on a question prompt.

Your own `pi` sessions do not fire. This config is shared across machines. A normal `pi` launch has no webhook env gate, so the extension does nothing.

## Env gate

The extension reads only the process environment. It does not open a config file. It does not read `settings.json`.

At startup, all of these must be true or the extension registers no POST handler:

- `PI_SETTLED_WEBHOOK` is `1`.
- `PI_SETTLED_WEBHOOK_URL` is an `https:` URL.
- `PI_SETTLED_WEBHOOK_KEY` is non-empty.
- `PI_SUBAGENT_ID` is unset.

A failed gate schedules nothing and makes no network call. `/settled-webhook` then reports `Settled webhook is unavailable.` The notice has no URL and no key.

Inside a gated process, `/settled-webhook off` stops later POSTs. `/settled-webhook on` resumes them. The command cannot create the gate. A child process with `PI_SUBAGENT_ID` never POSTs, even if it inherited the variables.

## Launcher

Grok Bot starts Pi with `~/.local/bin/pi-grokbot`. That script is outside this repo.

The script sources `~/.config/grok-bot/settled-webhook.env`, sets `PI_SETTLED_WEBHOOK=1`, and requires `PI_SETTLED_WEBHOOK_KEY` from the box environment. It then execs `pi`. Run the script. Do not source it into an interactive shell.

The extension does not open that env file. The URL stays in that file. Do not copy the URL or the key into this repo.

## Payload

The POST body is JSON. It has these fields:

- `source`: `pi-settled-webhook`
- `eventId`
- `timestamp`
- `status`: `settled`, `question`, or `error`
- `aborted`
- `cwd`
- `sessionId`
- `sessionFile`
- `tmux`
- `tmuxPane`
- `excerpt`
- `promptKind`, only for a question prompt

The body has no URL and no key. The `Authorization` header is `Bearer` plus the key, unless `PI_SETTLED_WEBHOOK_AUTH` sets the full header value.

`status` is `question` when the last non-empty excerpt line ends with `?`, or when Pi opens an `input`, `editor`, or `custom` prompt. Escape is `settled` with `aborted` true.

## Failure

A network error does not crash Pi. The settle handler does not wait on the POST. On shutdown, Pi flushes a pending POST and waits at most 4 seconds. That covers `pi -p`.

Set `PI_SETTLED_WEBHOOK_DEBUG=1` to write one stderr line, `settled-webhook: POST status=<code>`, or `settled-webhook: POST failed`. The line has no URL, no key, and no header.

## Checks

From `.pi-config`:

```bash
node --experimental-strip-types --test agent/extensions/tests/settled-webhook.test.ts
pnpm exec tsc --noEmit -p tsconfig.json
```

The unit checks use a local server or an injected `fetch`. They do not call Grok Bot.
