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
