---
date: 2026-04-19T19:22:22-07:00
researcher: creative-mode-agent
last_updated_by: creative-mode-agent
git_commit: e599c04c0afd1f4807867841854bdf377d79d61b
branch: feat/cctl-contrib-export-local-v2
repository: dotfiles
stage: outline
ticket: "Add a pi extension that shows the previous submitted prompt as passive text below the input editor"
plan_dir: "thoughts/creative-mode-agent/plans/2026-04-19_19-02-58_pi-extension-previous-prompt-below-input"
---

# Outline: Previous Prompt Widget Extension

## Overview
Build a small pi extension that shows the single most recent submitted user prompt as passive read-only text below the input editor in interactive mode. The implementation should use the existing widget API rather than a custom editor, and should derive its state entirely from normal session messages on the current branch.

## Type Definitions

```ts
type PromptContentBlock = {
  type: string;
  text?: string;
};

type SessionMessageLike = {
  role?: string;
  content?: unknown;
};

type SessionEntryLike = {
  type?: string;
  message?: SessionMessageLike;
};

function extractPromptText(content: unknown): string | undefined;
function findLatestUserPrompt(branch: readonly SessionEntryLike[]): string | undefined;
function buildWidgetLines(prompt: string | undefined): string[] | undefined;
function updatePreviousPromptWidget(ctx: ExtensionContext, prompt: string | undefined): void;
```

## Package / File Structure

- `.pi-config/extensions/previous-prompt.ts` — new global extension, auto-discovered from the tracked pi config
- `thoughts/creative-mode-agent/plans/2026-04-19_19-02-58_pi-extension-previous-prompt-below-input/context/outline/2026-04-19_19-22-22_extension-surface.md` — supporting scout context artifact

## API Surface

```ts
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI): void;

pi.on("session_start", async (event, ctx) => { ... });
pi.on("message_end", async (event, ctx) => { ... });
pi.on("session_tree", async (event, ctx) => { ... });
```

```ts
ctx.ui.setWidget("previous-prompt", lines, { placement: "belowEditor" });
ctx.ui.setWidget("previous-prompt", undefined, { placement: "belowEditor" });
ctx.sessionManager.getBranch();
```

## Slices

### Slice 1: Live widget from submitted prompts

**Files:**
- `.pi-config/extensions/previous-prompt.ts` (new)

```ts
function extractPromptText(content: unknown): string | undefined;
function buildWidgetLines(prompt: string | undefined): string[] | undefined;
function updatePreviousPromptWidget(ctx: ExtensionContext, prompt: string | undefined): void;
```

**Scope:**
- Register a new extension in `.pi-config/extensions/`
- Guard all widget behavior behind `ctx.hasUI`
- Listen to `message_end`
- When `event.message.role === "user"`, extract textual content from the submitted user message
- Render a passive widget below the editor showing that prompt
- Clear the widget when there is no displayable prompt text
- Keep the widget read-only: no keyboard handling, no editor replacement, no history stack

**Test checkpoint:**
- Run pi interactively from `/home/ruby/dotfiles`
- Run `/reload`
- Submit `hello world`
- Confirm a widget appears below the editor showing `hello world`
- Submit `show me files`
- Confirm the widget updates to `show me files`

### Slice 2: Rehydrate from session state and branch changes

**Files:**
- `.pi-config/extensions/previous-prompt.ts` (modify from Slice 1)

```ts
function findLatestUserPrompt(branch: readonly SessionEntryLike[]): string | undefined;

pi.on("session_start", async (event, ctx) => { ... });
pi.on("session_tree", async (event, ctx) => { ... });
```

**Scope:**
- On `session_start`, reconstruct the latest textual user prompt from `ctx.sessionManager.getBranch()`
- Re-render or clear the widget on startup, reload, resume, new session, and fork based on the active branch state
- Refresh from `getBranch()` again on `session_tree` so `/tree` navigation keeps the widget aligned with the active branch
- Do not add any persistence layer beyond normal session messages

**Test checkpoint:**
- After Slice 1 works, exit pi and resume the same session
- Confirm the widget still shows the last submitted prompt from that session branch
- Run `/new` and confirm the widget clears in the fresh session
- If `/tree` is used to navigate to another branch, confirm the widget updates to that branch’s latest user prompt

## Out of Scope

- custom editor replacement
- prompt history stacks or search
- clickable or editable prompt UI
- persistence outside normal session state
- non-interactive mode behavior
- rich formatting beyond a small label plus prompt text
