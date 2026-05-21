import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";

const WIDGET_KEY = "previous-prompt";
const WIDGET_PREFIX = "❓ ";
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
				const promptWidth = Math.max(1, safeWidth - WIDGET_PREFIX.length);
				const promptLines = truncatePromptLines(wrapTextWithAnsi(prompt, promptWidth), promptWidth);
				return promptLines.map((line, index) => {
					const prefix = index === 0 ? WIDGET_PREFIX : " ".repeat(WIDGET_PREFIX.length);
					return truncateToWidth(theme.fg("muted", `${prefix}${line}`), safeWidth);
				});
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
