---
date: 2026-04-19T20:16:47-07:00
researcher: creative-mode-agent
last_updated_by: creative-mode-agent
git_commit: c17853f152992d191be230bfa7558b4cc80d0771
branch: feat/cctl-contrib-export-local-v2
repository: dotfiles
stage: plan
ticket: "Fix previous-prompt flashing on skill expansion"
plan_dir: "thoughts/creative-mode-agent/plans/2026-04-19_19-08-15_pi-nested-agents-on-read"
---

# Implementation Plan: previous-prompt widget should keep raw slash commands and avoid skill-expansion flash

## Status
- [ ] Slice 1: Replace message-content parsing with raw-input tracking

---

## Slice 1: Replace message-content parsing with raw-input tracking

### Files
- `.pi-config/extensions/previous-prompt.ts` (modify)

### Changes

**`.pi-config/extensions/previous-prompt.ts`** (modify):

Replace the current "read the last user message content" approach with an in-memory raw-input pipeline:

1. Delete `PromptContentBlock` and `extractPromptText()` entirely.
   - They are the source of the bug because `message_end` sees the expanded `<skill ...>` payload, not the raw `/skill:name ...` command the user typed.
   - Do not replace them with any session lookups or message-content parsing.

2. Add a small normalizer for raw prompt text with a display cap.
   - Add `const MAX_PROMPT_CHARS = 160;` near the widget constants.
   - Normalize by trimming whitespace, returning `undefined` for empty input, and truncating long prompts with a trailing ellipsis.
   - Apply the character cap to the raw prompt text itself, so the widget still shows only the literal slash invocation plus the text the user typed — never expanded skill bodies.

```ts
const MAX_PROMPT_CHARS = 160;

function normalizePromptText(text: string): string | undefined {
	const normalized = text.trim();
	if (!normalized) return undefined;
	if (normalized.length <= MAX_PROMPT_CHARS) return normalized;
	return `${normalized.slice(0, MAX_PROMPT_CHARS - 1).trimEnd()}…`;
}
```

3. Keep the widget copy and placement exactly as they are, but cap rendered height.
   - Add `const MAX_PROMPT_LINES = 4;` near the widget constants.
   - `updatePreviousPromptWidget()` stays responsible only for drawing or clearing the widget.
   - Keep the `Previous prompt` label and `belowEditor` placement unchanged.
   - After `wrapTextWithAnsi()`, limit the rendered prompt to four lines and force a trailing `…` on the last visible line when more content exists.

```ts
const MAX_PROMPT_LINES = 4;

function truncatePromptLines(lines: string[], width: number): string[] {
	if (lines.length <= MAX_PROMPT_LINES) return lines;

	const visibleLines = lines.slice(0, MAX_PROMPT_LINES);
	const lastLineIndex = visibleLines.length - 1;
	if (width <= 1) {
		visibleLines[lastLineIndex] = "…";
		return visibleLines;
	}

	visibleLines[lastLineIndex] = `${truncateToWidth(visibleLines[lastLineIndex].trimEnd(), width - 1)}…`;
	return visibleLines;
}
```

4. Add two pieces of in-memory state inside `previousPromptExtension()`:

```ts
let pendingPrompt: string | undefined;
let sentPrompts: string[] = [];
```

5. Add a local reset helper and use it from `session_start` and `session_tree`.
   - `session_start`: clear both in-memory variables and clear the widget.
   - `session_tree`: do the same, because without lookups we cannot honestly reconstruct the previous prompt for a different branch.

```ts
const reset = (ctx: ExtensionContext) => {
	pendingPrompt = undefined;
	sentPrompts = [];
	updatePreviousPromptWidget(ctx, undefined);
};
```

6. Add an `input` handler that captures the raw prompt before skill/template expansion.
   - Ignore `event.source === "extension"` so `pi.sendUserMessage()` does not pollute the widget.
   - Normalize `event.text`; if empty after trim, do nothing.
   - If `ctx.isIdle()` is `true`, store the raw prompt in `pendingPrompt`.
     - This is only a candidate. Do not update the widget yet.
     - Overwrite the prior `pendingPrompt`; failed sends should not accumulate.
   - If `ctx.isIdle()` is `false`, push the raw prompt directly into `sentPrompts`.
     - While streaming, the prompt is being queued as steer/follow-up work, so preserve arrival order.

```ts
pi.on("input", (event, ctx) => {
	if (event.source === "extension") {
		return { action: "continue" as const };
	}

	const prompt = normalizePromptText(event.text);
	if (!prompt) {
		return { action: "continue" as const };
	}

	if (ctx.isIdle()) {
		pendingPrompt = prompt;
	} else {
		sentPrompts.push(prompt);
	}

	return { action: "continue" as const };
});
```

7. Add a `before_agent_start` handler that commits the idle-path candidate only when the prompt is actually about to be sent.
   - If `pendingPrompt` is set, push it into `sentPrompts` and clear `pendingPrompt`.
   - This is the key simplification: only committed sends become eligible for widget updates.
   - No session lookups, no message parsing, no attempt to reverse skill expansion.

```ts
pi.on("before_agent_start", () => {
	if (!pendingPrompt) return;
	sentPrompts.push(pendingPrompt);
	pendingPrompt = undefined;
});
```

8. Update `message_end` to consume only committed raw prompts.
   - Keep the existing `event.message.role !== "user"` guard.
   - On user messages, shift from `sentPrompts`.
   - If no committed raw prompt exists, do nothing.
   - If one exists, render that raw prompt in the widget.

```ts
pi.on("message_end", (event, ctx) => {
	if (event.message.role !== "user") return;

	const prompt = sentPrompts.shift();
	if (!prompt) return;

	updatePreviousPromptWidget(ctx, prompt);
});
```

9. The final file should be:

```ts
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, wrapTextWithAnsi } from "@mariozechner/pi-tui";

const WIDGET_KEY = "previous-prompt";
const WIDGET_LABEL = "Previous prompt";
const WIDGET_OPTIONS = { placement: "belowEditor" } as const;
const MAX_PROMPT_CHARS = 160;
const MAX_PROMPT_LINES = 4;

function normalizePromptText(text: string): string | undefined {
	const normalized = text.trim();
	if (!normalized) return undefined;
	if (normalized.length <= MAX_PROMPT_CHARS) return normalized;
	return `${normalized.slice(0, MAX_PROMPT_CHARS - 1).trimEnd()}…`;
}

function truncatePromptLines(lines: string[], width: number): string[] {
	if (lines.length <= MAX_PROMPT_LINES) return lines;

	const visibleLines = lines.slice(0, MAX_PROMPT_LINES);
	const lastLineIndex = visibleLines.length - 1;
	if (width <= 1) {
		visibleLines[lastLineIndex] = "…";
		return visibleLines;
	}

	visibleLines[lastLineIndex] = `${truncateToWidth(visibleLines[lastLineIndex].trimEnd(), width - 1)}…`;
	return visibleLines;
}

function updatePreviousPromptWidget(ctx: ExtensionContext, prompt: string | undefined): void {
	if (!ctx.hasUI) return;

	if (!prompt) {
		ctx.ui.setWidget(WIDGET_KEY, undefined, WIDGET_OPTIONS);
		return;
	}

	ctx.ui.setWidget(
		WIDGET_KEY,
		(_tui, theme) => ({
			render(width: number): string[] {
				const safeWidth = Math.max(1, width);
				const promptLines = truncatePromptLines(wrapTextWithAnsi(prompt, safeWidth), safeWidth);
				return [
					truncateToWidth(theme.fg("dim", WIDGET_LABEL), safeWidth),
					...promptLines.map((line) => truncateToWidth(theme.fg("muted", line), safeWidth)),
				];
			},
			invalidate() {},
		}),
		WIDGET_OPTIONS,
	);
}

export default function previousPromptExtension(pi: ExtensionAPI) {
	let pendingPrompt: string | undefined;
	let sentPrompts: string[] = [];

	const reset = (ctx: ExtensionContext) => {
		pendingPrompt = undefined;
		sentPrompts = [];
		updatePreviousPromptWidget(ctx, undefined);
	};

	pi.on("session_start", (_event, ctx) => {
		reset(ctx);
	});

	pi.on("session_tree", (_event, ctx) => {
		reset(ctx);
	});

	pi.on("input", (event, ctx) => {
		if (event.source === "extension") {
			return { action: "continue" as const };
		}

		const prompt = normalizePromptText(event.text);
		if (!prompt) {
			return { action: "continue" as const };
		}

		if (ctx.isIdle()) {
			pendingPrompt = prompt;
		} else {
			sentPrompts.push(prompt);
		}

		return { action: "continue" as const };
	});

	pi.on("before_agent_start", () => {
		if (!pendingPrompt) return;
		sentPrompts.push(pendingPrompt);
		pendingPrompt = undefined;
	});

	pi.on("message_end", (event, ctx) => {
		if (event.message.role !== "user") return;

		const prompt = sentPrompts.shift();
		if (!prompt) return;

		updatePreviousPromptWidget(ctx, prompt);
	});
}
```

### Tests

There is no dedicated automated test harness for this extension. Verify behavior interactively after `/reload`.

### Verify

1. Start pi in this repo.
2. Run `/reload`.
3. Submit a normal prompt like `hello world`.
   - The widget should show `hello world`.
4. Submit a skill command like `/skill:pi inspect previous prompt widget`.
   - The widget should show the literal `/skill:pi inspect previous prompt widget` text plus any text you typed with it.
   - It must not flash the expanded `<skill name=...>` body.
5. Submit a long prompt longer than 160 characters.
   - The widget should show the raw prompt text truncated with a trailing `…`.
6. Paste multiline content such as HTML that would normally wrap or span many lines.
   - The widget should render at most four prompt lines below the label.
   - The last visible line should end with `…` when more wrapped lines exist.
7. While the agent is still streaming, submit another short prompt.
   - The widget should advance in submission order.
8. Run `/tree` to switch branches.
   - The widget should clear instead of attempting branch reconstruction.

A concrete manual verification run:

```text
pi
/reload
hello world
/skill:pi inspect previous prompt widget
/tree
```

Expected outcome: the widget never renders skill markdown, long prompts are truncated by character count and rendered line count with `…`, and after `/tree` it is cleared.
