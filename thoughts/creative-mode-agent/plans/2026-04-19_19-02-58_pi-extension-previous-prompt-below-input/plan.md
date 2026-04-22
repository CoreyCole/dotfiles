---
date: 2026-04-19T19:24:08-07:00
researcher: creative-mode-agent
last_updated_by: creative-mode-agent
git_commit: e599c04c0afd1f4807867841854bdf377d79d61b
branch: feat/cctl-contrib-export-local-v2
repository: dotfiles
stage: plan
ticket: "Add a pi extension that shows the previous submitted prompt as passive text below the input editor"
plan_dir: "thoughts/creative-mode-agent/plans/2026-04-19_19-02-58_pi-extension-previous-prompt-below-input"
---

# Implementation Plan: Previous Prompt Widget Extension

## Status
- [x] Slice 1: Live widget from submitted prompts
- [ ] Slice 2: Rehydrate from session state and branch changes

## Slice 1: Live widget from submitted prompts

### Files
- `.pi-config/extensions/previous-prompt.ts` (new)

### Changes

**`.pi-config/extensions/previous-prompt.ts`** (new):

```ts
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, wrapTextWithAnsi } from "@mariozechner/pi-tui";

const WIDGET_KEY = "previous-prompt";
const WIDGET_LABEL = "Previous prompt";
const WIDGET_OPTIONS = { placement: "belowEditor" } as const;

type PromptContentBlock = {
	type: string;
	text?: string;
};

function extractPromptText(content: unknown): string | undefined {
	if (typeof content === "string") {
		const text = content.trim();
		return text ? text : undefined;
	}

	if (!Array.isArray(content)) return undefined;

	const text = (content as PromptContentBlock[])
		.filter((block): block is PromptContentBlock & { text: string } => {
			return block.type === "text" && typeof block.text === "string";
		})
		.map((block) => block.text.trim())
		.filter(Boolean)
		.join("\n")
		.trim();

	return text || undefined;
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
				const promptLines = wrapTextWithAnsi(prompt, safeWidth);
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
	pi.on("session_start", (_event, ctx) => {
		updatePreviousPromptWidget(ctx, undefined);
	});

	pi.on("message_end", (event, ctx) => {
		if (event.message.role !== "user") return;
		updatePreviousPromptWidget(ctx, extractPromptText(event.message.content));
	});
}
```

### Tests
No automated test file for this slice. Verify manually in interactive mode.

### Verify
```bash
cd /home/ruby/dotfiles
pi
```
Then in pi interactive mode:
1. Run `/reload`
2. Submit `hello world`
3. Confirm a read-only widget appears below the editor showing `hello world`
4. Submit `show me files`
5. Confirm the widget updates to `show me files`

---

## Slice 2: Rehydrate from session state and branch changes

### Files
- `.pi-config/extensions/previous-prompt.ts` (modify)

### Changes

**`.pi-config/extensions/previous-prompt.ts`** (modify): add branch scanning and startup/tree refresh.

1. Add the extra entry/message helper types directly below `PromptContentBlock`:

```ts
type SessionMessageLike = {
	role?: string;
	content?: unknown;
};

type SessionEntryLike = {
	type?: string;
	message?: SessionMessageLike;
};
```

2. Add this helper below `extractPromptText(...)`:

```ts
function findLatestUserPrompt(branch: readonly SessionEntryLike[]): string | undefined {
	for (let i = branch.length - 1; i >= 0; i--) {
		const entry = branch[i];
		if (entry.type !== "message") continue;
		if (entry.message?.role !== "user") continue;
		return extractPromptText(entry.message.content);
	}

	return undefined;
}
```

3. Replace the `session_start` handler with a branch-backed refresh:

```ts
	pi.on("session_start", (_event, ctx) => {
		const prompt = findLatestUserPrompt(ctx.sessionManager.getBranch() as SessionEntryLike[]);
		updatePreviousPromptWidget(ctx, prompt);
	});
```

4. Add a `session_tree` refresh immediately below the `session_start` handler:

```ts
	pi.on("session_tree", (_event, ctx) => {
		const prompt = findLatestUserPrompt(ctx.sessionManager.getBranch() as SessionEntryLike[]);
		updatePreviousPromptWidget(ctx, prompt);
	});
```

5. Keep the `message_end` live update handler from Slice 1 unchanged.

### Tests
No automated test file for this slice. Verify manually in interactive mode.

### Verify
```bash
cd /home/ruby/dotfiles
pi
```
Then in pi interactive mode:
1. Run `/reload`
2. Submit a prompt such as `remember this prompt`
3. Exit pi
4. Resume the same session and confirm the widget still shows `remember this prompt`
5. Run `/new` and confirm the widget clears in the new empty session
6. If you have a branched session in `/tree`, navigate to a different branch and confirm the widget updates to that branch’s latest user prompt
